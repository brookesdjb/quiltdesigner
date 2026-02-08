import { type AppState, type QuiltBlock, ShapeType, SymmetryMode } from "./types";
import { SeededRandom } from "./random";
import { getAllPalettes } from "./palette";

function buildWeightedShapePool(state: AppState): ShapeType[] {
  const pool: ShapeType[] = [];
  for (const shape of Object.values(ShapeType)) {
    if (state.enabledShapes[shape]) {
      const weight = state.shapeRatios[shape];
      for (let i = 0; i < weight; i++) {
        pool.push(shape);
      }
    }
  }
  if (pool.length === 0) {
    pool.push(ShapeType.Square);
  }
  return pool;
}

function randomBlock(rng: SeededRandom, pool: ShapeType[], paletteColors: string[]): QuiltBlock {
  const shape = rng.pick(pool);
  const rotation = rng.pick([0, 90, 180, 270]);

  let colors: string[];
  switch (shape) {
    case ShapeType.Square:
      colors = [rng.pick(paletteColors)];
      break;
    case ShapeType.HST:
      colors = [rng.pick(paletteColors), rng.pick(paletteColors)];
      break;
    case ShapeType.QST:
      colors = [
        rng.pick(paletteColors),
        rng.pick(paletteColors),
        rng.pick(paletteColors),
        rng.pick(paletteColors),
      ];
      break;
    default:
      // HSTSplit and other derived shapes are only created by simplification
      colors = [rng.pick(paletteColors)];
      break;
  }

  return { shape, colors, rotation };
}

// --- Block transforms ---

/** Mirror across the vertical axis (left↔right) */
function mirrorH(block: QuiltBlock): QuiltBlock {
  const b = { ...block, colors: [...block.colors] };
  if (b.shape === ShapeType.HST) {
    // Horizontal flip: swap colors AND flip diagonal (90° shift)
    b.colors = [b.colors[1], b.colors[0]];
    b.rotation = (450 - b.rotation) % 360;
  } else if (b.shape === ShapeType.QST) {
    // top(0), right(1), bottom(2), left(3) → swap right/left
    b.colors = [b.colors[0], b.colors[3], b.colors[2], b.colors[1]];
    b.rotation = (360 - b.rotation) % 360;
  }
  return b;
}

/** Mirror across the horizontal axis (top↔bottom) */
function mirrorV(block: QuiltBlock): QuiltBlock {
  const b = { ...block, colors: [...block.colors] };
  if (b.shape === ShapeType.HST) {
    // Vertical flip: flip diagonal without swapping colors
    // (90° shift flips the diagonal from \ to / or vice versa)
    b.rotation = (90 - b.rotation + 360) % 360;
  } else if (b.shape === ShapeType.QST) {
    // swap top/bottom
    b.colors = [b.colors[2], b.colors[1], b.colors[0], b.colors[3]];
    b.rotation = (180 - b.rotation + 360) % 360;
  }
  return b;
}

/** Rotate 180° around center */
function rotate180(block: QuiltBlock): QuiltBlock {
  const b = { ...block, colors: [...block.colors] };
  if (b.shape === ShapeType.HST) {
    b.rotation = (b.rotation + 180) % 360;
  } else if (b.shape === ShapeType.QST) {
    b.colors = [b.colors[2], b.colors[3], b.colors[0], b.colors[1]];
    b.rotation = (b.rotation + 180) % 360;
  }
  return b;
}

/** Rotate 90° clockwise in 90° steps. */
function rotateCW(block: QuiltBlock, turns: number): QuiltBlock {
  const normalized = ((turns % 4) + 4) % 4;
  if (normalized === 0) return block;
  const b = { ...block, colors: [...block.colors] };
  b.rotation = (b.rotation + normalized * 90) % 360;
  return b;
}

/** Mirror across the top-left → bottom-right diagonal (\).
 *  Position (r,c) maps to (c,r). Block content: reflect across that diagonal. */
function mirrorDiagTLBR(block: QuiltBlock): QuiltBlock {
  // Diagonal \ reflection = transpose = mirrorH then rotate 90° CW
  // which is the same as: swap top↔left, swap right↔bottom
  const b = { ...block, colors: [...block.colors] };
  if (b.shape === ShapeType.HST) {
    // The diagonal line in an HST aligns with this axis, so we swap + adjust rotation
    b.colors = [b.colors[1], b.colors[0]];
    b.rotation = ((90 - b.rotation + 360) % 360);
  } else if (b.shape === ShapeType.QST) {
    // top(0)↔left(3), right(1)↔bottom(2)
    b.colors = [b.colors[3], b.colors[2], b.colors[1], b.colors[0]];
    b.rotation = ((90 - b.rotation + 360) % 360);
  }
  return b;
}

/** Mirror across the top-right → bottom-left diagonal (/).
 *  Position (r,c) in an NxN maps to (N-1-c, N-1-r). */
function mirrorDiagTRBL(block: QuiltBlock): QuiltBlock {
  // Diagonal / reflection = mirrorV then rotate 90° CW
  // which is: swap top↔right, swap left↔bottom
  const b = { ...block, colors: [...block.colors] };
  if (b.shape === ShapeType.HST) {
    b.colors = [b.colors[1], b.colors[0]];
    b.rotation = ((270 - b.rotation + 360) % 360);
  } else if (b.shape === ShapeType.QST) {
    // top(0)↔right(1), left(3)↔bottom(2)
    b.colors = [b.colors[1], b.colors[0], b.colors[3], b.colors[2]];
    b.rotation = ((270 - b.rotation + 360) % 360);
  }
  return b;
}

// --- Tile symmetry source lookup ---

/** For a given (row, col) in a tile, return the canonical source (srcRow, srcCol)
 *  and the transform function to apply to the source block. Returns null if
 *  this cell IS the canonical source (should be generated fresh). */
function getSymmetrySource(
  row: number,
  col: number,
  tileW: number,
  tileH: number,
  mode: SymmetryMode
): { srcRow: number; srcCol: number; transform: (b: QuiltBlock) => QuiltBlock } | null {
  const halfW = Math.ceil(tileW / 2);
  const halfH = Math.ceil(tileH / 2);
  const dim = Math.min(tileW, tileH); // for diagonal modes

  switch (mode) {
    case SymmetryMode.None:
      return null;

    case SymmetryMode.Horizontal:
      // Left half is canonical, right half mirrors
      if (col < halfW) return null;
      return { srcRow: row, srcCol: tileW - 1 - col, transform: mirrorH };

    case SymmetryMode.Vertical:
      // Top half is canonical, bottom half mirrors
      if (row < halfH) return null;
      return { srcRow: tileH - 1 - row, srcCol: col, transform: mirrorV };

    case SymmetryMode.FourWay:
      // Top-left quadrant with diagonal symmetry is canonical, then rotate 90° into other quadrants.
      if (tileW !== tileH) {
        // Fallback to mirror-based symmetry for non-square tiles.
        if (row < halfH && col < halfW) return null;
        const srcRow = row < halfH ? row : tileH - 1 - row;
        const srcCol = col < halfW ? col : tileW - 1 - col;
        if (col >= halfW && row < halfH) {
          return { srcRow, srcCol, transform: mirrorH };
        } else if (col < halfW && row >= halfH) {
          return { srcRow, srcCol, transform: mirrorV };
        } else {
          return { srcRow, srcCol, transform: (b) => mirrorH(mirrorV(b)) };
        }
      }
      {
        const size = tileW;
        const half = Math.ceil(size / 2);
        let turns = 0;

        if (row < half && col >= half) turns = 1; // top-right
        else if (row >= half && col >= half) turns = 2; // bottom-right
        else if (row >= half && col < half) turns = 3; // bottom-left

        let srcRow = row;
        let srcCol = col;
        if (turns === 1) {
          srcRow = size - 1 - col;
          srcCol = row;
        } else if (turns === 2) {
          srcRow = size - 1 - row;
          srcCol = size - 1 - col;
        } else if (turns === 3) {
          srcRow = col;
          srcCol = size - 1 - row;
        }

        let needsDiag = false;
        if (srcRow > srcCol) {
          [srcRow, srcCol] = [srcCol, srcRow];
          needsDiag = true;
        }

        if (turns === 0 && !needsDiag) return null;
        return {
          srcRow,
          srcCol,
          transform: (b) => {
            let out = b;
            if (needsDiag) out = mirrorDiagTLBR(out);
            if (turns !== 0) out = rotateCW(out, turns);
            return out;
          },
        };
      }

    case SymmetryMode.DiagonalTLBR:
      // Canonical region: row <= col (upper-right triangle including diagonal)
      // Actually: below the diagonal mirrors from above
      if (col >= row) return null; // above or on diagonal = canonical
      if (row >= dim) return null;  // outside square region = canonical (no mirror source)
      return { srcRow: col, srcCol: row, transform: mirrorDiagTLBR };

    case SymmetryMode.DiagonalTRBL:
      // Canonical region: row + col < dim (upper-left triangle)
      if (row + col < dim) return null;
      {
        const sr = dim - 1 - col;
        const sc = dim - 1 - row;
        if (sr < 0 || sc < 0 || sr >= tileH || sc >= tileW) return null;
        return { srcRow: sr, srcCol: sc, transform: mirrorDiagTRBL };
      }

    case SymmetryMode.Rotational:
      // Top half is canonical, bottom half is 180° rotation
      if (row < halfH) return null;
      // Center row in odd-height tiles: no mirror
      if (tileH % 2 === 1 && row === halfH - 1) return null;
      return {
        srcRow: tileH - 1 - row,
        srcCol: tileW - 1 - col,
        transform: rotate180,
      };

    default:
      return null;
  }
}

// Ensure all colors are used in the tile (for exact mode)
// Only modifies canonical (source) cells - cells that don't derive from another via symmetry
function ensureAllColorsUsed(
  tile: QuiltBlock[][], 
  paletteColors: string[], 
  rng: SeededRandom,
  symmetryMode: SymmetryMode
): void {
  const tileH = tile.length;
  const tileW = tile[0]?.length || 0;
  
  // Find which colors are used in canonical cells only
  const usedColors = new Set<string>();
  const canonicalPositions: { row: number; col: number; colorIdx: number }[] = [];
  
  for (let row = 0; row < tileH; row++) {
    for (let col = 0; col < tileW; col++) {
      // Check if this is a canonical cell (no symmetry source)
      const source = getSymmetrySource(row, col, tileW, tileH, symmetryMode);
      if (source) continue; // Skip derived cells
      
      const block = tile[row][col];
      for (let colorIdx = 0; colorIdx < block.colors.length; colorIdx++) {
        usedColors.add(block.colors[colorIdx].toUpperCase());
        canonicalPositions.push({ row, col, colorIdx });
      }
    }
  }
  
  // Find unused colors
  const unusedColors = paletteColors.filter(c => !usedColors.has(c.toUpperCase()));
  if (unusedColors.length === 0) return;
  
  // Shuffle canonical positions and assign unused colors
  for (let i = canonicalPositions.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [canonicalPositions[i], canonicalPositions[j]] = [canonicalPositions[j], canonicalPositions[i]];
  }
  
  for (let i = 0; i < unusedColors.length && i < canonicalPositions.length; i++) {
    const pos = canonicalPositions[i];
    tile[pos.row][pos.col].colors[pos.colorIdx] = unusedColors[i];
  }
}

function generateTile(
  tileW: number,
  tileH: number,
  symmetry: number,
  symmetryMode: SymmetryMode,
  rng: SeededRandom,
  pool: ShapeType[],
  paletteColors: string[],
  exactColors: boolean
): QuiltBlock[][] {
  // First pass: fill everything randomly
  const tile: QuiltBlock[][] = Array.from({ length: tileH }, () =>
    Array.from({ length: tileW }, () => randomBlock(rng, pool, paletteColors))
  );

  // If exact colors mode, ensure all colors are used in canonical cells BEFORE symmetry
  if (exactColors) {
    ensureAllColorsUsed(tile, paletteColors, rng, symmetryMode);
  }

  if (symmetryMode === SymmetryMode.None) return tile;

  // Second pass: apply symmetry to non-canonical cells
  for (let row = 0; row < tileH; row++) {
    for (let col = 0; col < tileW; col++) {
      const source = getSymmetrySource(row, col, tileW, tileH, symmetryMode);
      if (!source) continue;

      const useSymmetry = rng.next() * 100 < symmetry;
      if (useSymmetry) {
        tile[row][col] = source.transform(tile[source.srcRow][source.srcCol]);
      }
    }
  }

  return tile;
}

export function generateGrid(state: AppState): QuiltBlock[][] {
  const rng = new SeededRandom(state.seed);
  const palettes = getAllPalettes(state.customPalettes);
  const palette = palettes[state.paletteIndex % palettes.length];
  const colorCount = Math.max(1, Math.min(state.paletteColorCount, palette.colors.length));
  const paletteColors = palette.colors.slice(0, colorCount);
  const pool = buildWeightedShapePool(state);
  const { gridWidth, gridHeight, symmetry, symmetryMode, repeatWidth, repeatHeight } = state;
  const exactColors = state.colorCountMode === "exact";

  const tileW = repeatWidth > 0 ? Math.min(repeatWidth, gridWidth) : gridWidth;
  const tileH = repeatHeight > 0 ? Math.min(repeatHeight, gridHeight) : gridHeight;

  const tile = generateTile(tileW, tileH, symmetry, symmetryMode, rng, pool, paletteColors, exactColors);

  const grid: QuiltBlock[][] = Array.from({ length: gridHeight }, (_, row) =>
    Array.from({ length: gridWidth }, (_, col) => tile[row % tileH][col % tileW])
  );

  return grid;
}
