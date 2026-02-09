import { type QuiltBlock, ShapeType } from "./types";

// --- Block transforms (copied from layout.ts for now, could be shared) ---

function mirrorH(block: QuiltBlock): QuiltBlock {
  const b = { ...block, colors: [...block.colors] };
  if (b.shape === ShapeType.HST) {
    b.colors = [b.colors[1], b.colors[0]];
    b.rotation = (450 - b.rotation) % 360;
  } else if (b.shape === ShapeType.QST) {
    b.colors = [b.colors[0], b.colors[3], b.colors[2], b.colors[1]];
    b.rotation = (360 - b.rotation) % 360;
  }
  return b;
}

function mirrorV(block: QuiltBlock): QuiltBlock {
  const b = { ...block, colors: [...block.colors] };
  if (b.shape === ShapeType.HST) {
    b.rotation = (90 - b.rotation + 360) % 360;
  } else if (b.shape === ShapeType.QST) {
    b.colors = [b.colors[2], b.colors[1], b.colors[0], b.colors[3]];
    b.rotation = (180 - b.rotation + 360) % 360;
  }
  return b;
}

// --- Manual Editor State ---

export interface ManualEditorState {
  // Primary segment cells (top-left quadrant for 4-way)
  cells: QuiltBlock[][];
  repeatWidth: number;
  repeatHeight: number;
}

export function createEmptyManualState(width: number, height: number, defaultColor: string): ManualEditorState {
  const cells: QuiltBlock[][] = [];
  for (let row = 0; row < height; row++) {
    const rowCells: QuiltBlock[] = [];
    for (let col = 0; col < width; col++) {
      rowCells.push({
        shape: ShapeType.Square,
        colors: [defaultColor],
        rotation: 0,
      });
    }
    cells.push(rowCells);
  }
  return { cells, repeatWidth: width, repeatHeight: height };
}

// Get the cell size for the primary segment (4-way assumes top-left quadrant)
export function getPrimarySegmentSize(repeatWidth: number, repeatHeight: number): { width: number; height: number } {
  // For 4-way symmetry, primary is top-left quadrant
  return {
    width: Math.ceil(repeatWidth / 2),
    height: Math.ceil(repeatHeight / 2),
  };
}

// Check if a cell is in the primary (editable) segment
export function isInPrimarySegment(row: number, col: number, repeatWidth: number, repeatHeight: number): boolean {
  const halfW = Math.ceil(repeatWidth / 2);
  const halfH = Math.ceil(repeatHeight / 2);
  return row < halfH && col < halfW;
}

// Generate full repeat tile from primary segment using 4-way symmetry
export function generateFromPrimary(state: ManualEditorState): QuiltBlock[][] {
  const { cells, repeatWidth, repeatHeight } = state;
  const halfW = Math.ceil(repeatWidth / 2);
  const halfH = Math.ceil(repeatHeight / 2);
  
  const tile: QuiltBlock[][] = [];
  
  for (let row = 0; row < repeatHeight; row++) {
    const rowBlocks: QuiltBlock[] = [];
    for (let col = 0; col < repeatWidth; col++) {
      let block: QuiltBlock;
      
      if (row < halfH && col < halfW) {
        // Top-left: primary segment (direct)
        block = cells[row][col];
      } else if (row < halfH && col >= halfW) {
        // Top-right: mirror horizontally from top-left
        const srcCol = repeatWidth - 1 - col;
        block = mirrorH(cells[row][srcCol]);
      } else if (row >= halfH && col < halfW) {
        // Bottom-left: mirror vertically from top-left
        const srcRow = repeatHeight - 1 - row;
        block = mirrorV(cells[srcRow][col]);
      } else {
        // Bottom-right: mirror both (or rotate 180)
        const srcRow = repeatHeight - 1 - row;
        const srcCol = repeatWidth - 1 - col;
        block = mirrorH(mirrorV(cells[srcRow][srcCol]));
      }
      
      rowBlocks.push(block);
    }
    tile.push(rowBlocks);
  }
  
  return tile;
}

// --- Shape cycling ---

const SHAPE_CYCLE: ShapeType[] = [ShapeType.Square, ShapeType.HST, ShapeType.QST];

export function cycleShape(block: QuiltBlock, paletteColors: string[]): QuiltBlock {
  const currentIdx = SHAPE_CYCLE.indexOf(block.shape as ShapeType);
  const nextIdx = (currentIdx + 1) % SHAPE_CYCLE.length;
  const newShape = SHAPE_CYCLE[nextIdx];
  
  // Adjust colors array for the new shape
  let newColors: string[];
  const baseColor = block.colors[0] || paletteColors[0];
  
  switch (newShape) {
    case ShapeType.Square:
      newColors = [baseColor];
      break;
    case ShapeType.HST:
      newColors = [baseColor, paletteColors[1] || paletteColors[0]];
      break;
    case ShapeType.QST:
      newColors = [
        baseColor,
        paletteColors[1] || paletteColors[0],
        paletteColors[2] || paletteColors[0],
        paletteColors[3] || paletteColors[0],
      ];
      break;
    default:
      newColors = [baseColor];
  }
  
  return { shape: newShape, colors: newColors, rotation: block.rotation };
}

export function rotateBlock(block: QuiltBlock): QuiltBlock {
  return {
    ...block,
    colors: [...block.colors],
    rotation: (block.rotation + 90) % 360,
  };
}

export function cycleColor(block: QuiltBlock, colorIndex: number, paletteColors: string[]): QuiltBlock {
  const newColors = [...block.colors];
  const currentColor = newColors[colorIndex];
  const currentPaletteIdx = paletteColors.findIndex(c => c.toUpperCase() === currentColor.toUpperCase());
  const nextPaletteIdx = (currentPaletteIdx + 1) % paletteColors.length;
  newColors[colorIndex] = paletteColors[nextPaletteIdx];
  return { ...block, colors: newColors };
}

// --- Hit testing for triangles ---

export interface HitZone {
  type: 'square' | 'triangle';
  colorIndex: number;
}

// Determine which color zone was clicked within a cell
// x, y are normalized 0-1 within the cell
export function getHitZone(block: QuiltBlock, x: number, y: number): HitZone {
  if (block.shape === ShapeType.Square) {
    return { type: 'square', colorIndex: 0 };
  }
  
  if (block.shape === ShapeType.HST) {
    // HST diagonal goes from top-left to bottom-right at rotation 0
    // rotation 0: diagonal \, colors[0] = bottom-left, colors[1] = top-right
    // We need to account for rotation
    const rot = block.rotation;
    let adjusted = { x, y };
    
    // Rotate the hit point back to rotation 0 space
    for (let i = 0; i < rot / 90; i++) {
      const newX = adjusted.y;
      const newY = 1 - adjusted.x;
      adjusted = { x: newX, y: newY };
    }
    
    // At rotation 0, diagonal is \, below diagonal = colors[0], above = colors[1]
    const isBelow = adjusted.y > adjusted.x;
    return { type: 'triangle', colorIndex: isBelow ? 0 : 1 };
  }
  
  if (block.shape === ShapeType.QST) {
    // QST has 4 triangles: top, right, bottom, left
    // At rotation 0: colors[0]=top, colors[1]=right, colors[2]=bottom, colors[3]=left
    const rot = block.rotation;
    let adjusted = { x, y };
    
    // Rotate the hit point back to rotation 0 space
    for (let i = 0; i < rot / 90; i++) {
      const newX = adjusted.y;
      const newY = 1 - adjusted.x;
      adjusted = { x: newX, y: newY };
    }
    
    // Determine quadrant using diagonals
    const cx = 0.5, cy = 0.5;
    const dx = adjusted.x - cx;
    const dy = adjusted.y - cy;
    
    // Four triangles divided by X diagonals
    if (Math.abs(dx) > Math.abs(dy)) {
      // Left or right
      return { type: 'triangle', colorIndex: dx > 0 ? 1 : 3 };
    } else {
      // Top or bottom
      return { type: 'triangle', colorIndex: dy > 0 ? 2 : 0 };
    }
  }
  
  return { type: 'square', colorIndex: 0 };
}

// --- Interactive canvas overlay ---

export interface ManualEditorCallbacks {
  onCellChange: (row: number, col: number, block: QuiltBlock) => void;
  getPaletteColors: () => string[];
  getCell: (row: number, col: number) => QuiltBlock;
}

export function createManualEditorOverlay(
  container: HTMLElement,
  repeatWidth: number,
  repeatHeight: number,
  callbacks: ManualEditorCallbacks
): {
  update: (cellSize: number, offsetX: number, offsetY: number) => void;
  destroy: () => void;
} {
  const overlay = document.createElement('div');
  overlay.className = 'manual-editor-overlay';
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  `;
  container.appendChild(overlay);
  
  const primaryW = Math.ceil(repeatWidth / 2);
  const primaryH = Math.ceil(repeatHeight / 2);
  
  let cellSize = 0;
  let offsetX = 0;
  let offsetY = 0;
  let hoveredCell: { row: number; col: number } | null = null;
  
  // Create hover controls
  const hoverControls = document.createElement('div');
  hoverControls.className = 'cell-hover-controls';
  hoverControls.style.cssText = `
    position: absolute;
    display: none;
    pointer-events: auto;
    z-index: 10;
  `;
  hoverControls.innerHTML = `
    <button class="cell-btn type-btn" title="Change shape">◧</button>
    <button class="cell-btn rotate-btn" title="Rotate">↻</button>
  `;
  overlay.appendChild(hoverControls);
  
  const typeBtn = hoverControls.querySelector('.type-btn') as HTMLButtonElement;
  const rotateBtn = hoverControls.querySelector('.rotate-btn') as HTMLButtonElement;
  
  // Click zones for colors (transparent overlay per cell)
  const clickZone = document.createElement('div');
  clickZone.className = 'cell-click-zone';
  clickZone.style.cssText = `
    position: absolute;
    pointer-events: auto;
    cursor: pointer;
    display: none;
  `;
  overlay.appendChild(clickZone);
  
  function updateHoverControls() {
    if (!hoveredCell) {
      hoverControls.style.display = 'none';
      clickZone.style.display = 'none';
      return;
    }
    
    const { row, col } = hoveredCell;
    const x = offsetX + col * cellSize;
    const y = offsetY + row * cellSize;
    
    hoverControls.style.display = 'flex';
    hoverControls.style.left = `${x + cellSize - 48}px`;
    hoverControls.style.top = `${y + 4}px`;
    
    clickZone.style.display = 'block';
    clickZone.style.left = `${x}px`;
    clickZone.style.top = `${y}px`;
    clickZone.style.width = `${cellSize}px`;
    clickZone.style.height = `${cellSize}px`;
  }
  
  // Event handlers
  typeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!hoveredCell) return;
    const { row, col } = hoveredCell;
    const block = callbacks.getCell(row, col);
    const newBlock = cycleShape(block, callbacks.getPaletteColors());
    callbacks.onCellChange(row, col, newBlock);
  });
  
  rotateBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!hoveredCell) return;
    const { row, col } = hoveredCell;
    const block = callbacks.getCell(row, col);
    const newBlock = rotateBlock(block);
    callbacks.onCellChange(row, col, newBlock);
  });
  
  clickZone.addEventListener('click', (e) => {
    if (!hoveredCell) return;
    const { row, col } = hoveredCell;
    const block = callbacks.getCell(row, col);
    
    const rect = clickZone.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    const hitZone = getHitZone(block, x, y);
    const newBlock = cycleColor(block, hitZone.colorIndex, callbacks.getPaletteColors());
    callbacks.onCellChange(row, col, newBlock);
  });
  
  // Mouse tracking on the container
  function onMouseMove(e: MouseEvent) {
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    // Check if in primary segment
    const col = Math.floor((mx - offsetX) / cellSize);
    const row = Math.floor((my - offsetY) / cellSize);
    
    if (row >= 0 && row < primaryH && col >= 0 && col < primaryW) {
      if (!hoveredCell || hoveredCell.row !== row || hoveredCell.col !== col) {
        hoveredCell = { row, col };
        updateHoverControls();
      }
    } else {
      if (hoveredCell) {
        hoveredCell = null;
        updateHoverControls();
      }
    }
  }
  
  function onMouseLeave() {
    hoveredCell = null;
    updateHoverControls();
  }
  
  container.addEventListener('mousemove', onMouseMove);
  container.addEventListener('mouseleave', onMouseLeave);
  
  return {
    update: (newCellSize: number, newOffsetX: number, newOffsetY: number) => {
      cellSize = newCellSize;
      offsetX = newOffsetX;
      offsetY = newOffsetY;
      updateHoverControls();
    },
    destroy: () => {
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseleave', onMouseLeave);
      overlay.remove();
    },
  };
}
