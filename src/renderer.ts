import type { AppState, QuiltBlock } from "./types";
import { ShapeType, isFabricSwatch, isColorSwatch } from "./types";
import { drawBlock, type ColorToSwatchMap, getOrCreatePattern } from "./shapes";

// Helper to fill a rectangle with either a color or fabric pattern
function fillRectWithSwatch(
  ctx: CanvasRenderingContext2D,
  color: string,
  colorMap: ColorToSwatchMap | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
  _fabricCache: Map<string, HTMLImageElement> // kept for signature compatibility
): void {
  const swatch = colorMap?.get(color.toUpperCase());
  
  if (swatch && isFabricSwatch(swatch)) {
    // Use pattern for better performance
    const patternSize = 80;
    const pattern = getOrCreatePattern(ctx, swatch.dataUrl, patternSize);
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(x, y, width, height);
      return;
    }
  }
  
  // Fallback to solid color
  ctx.fillStyle = (swatch && isColorSwatch(swatch)) ? swatch : color;
  ctx.fillRect(x, y, width, height);
}

// Simple fabric image cache for borders
const borderFabricCache = new Map<string, HTMLImageElement>();

function ensureFabricLoaded(dataUrl: string): void {
  if (!borderFabricCache.has(dataUrl)) {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      borderFabricCache.set(dataUrl, img);
    };
    borderFabricCache.set(dataUrl, img); // Store even before loaded to prevent duplicate requests
  }
}

export function render(
  canvas: HTMLCanvasElement,
  grid: QuiltBlock[][],
  state: AppState,
  colorMap?: ColorToSwatchMap
): void {
  const ctx = canvas.getContext("2d")!;

  // HiDPI support — collapse canvas before measuring so it doesn't inflate the container
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = "0";
  canvas.style.height = "0";
  const container = canvas.parentElement!;
  const displayWidth = container.clientWidth;
  const displayHeight = container.clientHeight;

  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Clear
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, displayWidth, displayHeight);

  if (grid.length === 0 || grid[0].length === 0) return;

  const rows = grid.length;
  const cols = grid[0].length;
  
  // Border configuration
  const outerLineCount = state.outerBorder?.lineCount || 0;
  const sashingLineCount = state.sashingBorder?.lineCount || 0;
  const outerWidthFrac = state.outerBorder?.widthFraction || 0.25;
  const sashingWidthFrac = state.sashingBorder?.widthFraction || 0.25;
  
  const repW = state.repeatWidth > 0 ? Math.min(state.repeatWidth, cols) : cols;
  const repH = state.repeatHeight > 0 ? Math.min(state.repeatHeight, rows) : rows;
  
  // Count sashing gaps
  const sashingGapsX = repW > 0 ? Math.floor((cols - 1) / repW) : 0;
  const sashingGapsY = repH > 0 ? Math.floor((rows - 1) / repH) : 0;
  
  // Calculate cell size first (approximate), then adjust for borders
  const padding = 20;
  const approxCellSize = Math.floor(Math.min(
    (displayWidth - padding * 2) / (cols + outerLineCount * outerWidthFrac * 2 + sashingGapsX * sashingLineCount * sashingWidthFrac),
    (displayHeight - padding * 2) / (rows + outerLineCount * outerWidthFrac * 2 + sashingGapsY * sashingLineCount * sashingWidthFrac)
  ));
  
  // Border widths based on cell size
  const outerLineWidth = Math.round(approxCellSize * outerWidthFrac);
  const sashingLineWidth = Math.round(approxCellSize * sashingWidthFrac);
  
  const totalOuterBorder = outerLineCount * outerLineWidth;
  const totalSashingX = sashingGapsX * sashingLineCount * sashingLineWidth;
  const totalSashingY = sashingGapsY * sashingLineCount * sashingLineWidth;

  // Recalculate cell size with actual border widths
  const availW = displayWidth - padding * 2 - totalOuterBorder * 2 - totalSashingX;
  const availH = displayHeight - padding * 2 - totalOuterBorder * 2 - totalSashingY;
  const cellSize = Math.floor(Math.min(availW / cols, availH / rows));

  // Total dimensions
  const gridW = cellSize * cols + totalSashingX;
  const gridH = cellSize * rows + totalSashingY;
  const totalW = gridW + totalOuterBorder * 2;
  const totalH = gridH + totalOuterBorder * 2;
  
  const startX = Math.floor((displayWidth - totalW) / 2);
  const startY = Math.floor((displayHeight - totalH) / 2);

  // Pre-load fabric images for borders
  if (colorMap) {
    state.outerBorder?.colors?.forEach(c => {
      const swatch = colorMap.get(c.toUpperCase());
      if (swatch && isFabricSwatch(swatch)) ensureFabricLoaded(swatch.dataUrl);
    });
    state.sashingBorder?.colors?.forEach(c => {
      const swatch = colorMap.get(c.toUpperCase());
      if (swatch && isFabricSwatch(swatch)) ensureFabricLoaded(swatch.dataUrl);
    });
    const cornerColor = state.sashingBorder?.cornerstoneColor;
    if (cornerColor) {
      const swatch = colorMap.get(cornerColor.toUpperCase());
      if (swatch && isFabricSwatch(swatch)) ensureFabricLoaded(swatch.dataUrl);
    }
  }

  // Draw outer border
  if (outerLineCount > 0 && state.outerBorder?.colors) {
    for (let i = 0; i < outerLineCount; i++) {
      const color = state.outerBorder.colors[i] || "#888888";
      const offset = i * outerLineWidth;
      const w = totalW - offset * 2;
      const h = totalH - offset * 2;
      
      // Top
      fillRectWithSwatch(ctx, color, colorMap, startX + offset, startY + offset, w, outerLineWidth, borderFabricCache);
      // Bottom
      fillRectWithSwatch(ctx, color, colorMap, startX + offset, startY + totalH - offset - outerLineWidth, w, outerLineWidth, borderFabricCache);
      // Left
      fillRectWithSwatch(ctx, color, colorMap, startX + offset, startY + offset + outerLineWidth, outerLineWidth, h - outerLineWidth * 2, borderFabricCache);
      // Right
      fillRectWithSwatch(ctx, color, colorMap, startX + totalW - offset - outerLineWidth, startY + offset + outerLineWidth, outerLineWidth, h - outerLineWidth * 2, borderFabricCache);
    }
  }

  const gridStartX = startX + totalOuterBorder;
  const gridStartY = startY + totalOuterBorder;

  // Helper to get block position accounting for sashing
  function getBlockPos(row: number, col: number): { x: number; y: number } {
    const sashingBeforeX = repW > 0 ? Math.floor(col / repW) : 0;
    const sashingBeforeY = repH > 0 ? Math.floor(row / repH) : 0;
    return {
      x: gridStartX + col * cellSize + sashingBeforeX * sashingLineCount * sashingLineWidth,
      y: gridStartY + row * cellSize + sashingBeforeY * sashingLineCount * sashingLineWidth,
    };
  }

  // Draw sashing (between repeat blocks)
  if (sashingLineCount > 0 && state.sashingBorder?.colors) {
    ctx.save();
    
    // Vertical sashing
    if (repW > 0) {
      for (let col = repW; col < cols; col += repW) {
        const pos = getBlockPos(0, col);
        const sashX = pos.x - sashingLineCount * sashingLineWidth;
        
        for (let i = 0; i < sashingLineCount; i++) {
          const color = state.sashingBorder.colors[i] || "#888888";
          fillRectWithSwatch(ctx, color, colorMap, sashX + i * sashingLineWidth, gridStartY, sashingLineWidth, gridH, borderFabricCache);
        }
      }
    }
    
    // Horizontal sashing
    if (repH > 0) {
      for (let row = repH; row < rows; row += repH) {
        const pos = getBlockPos(row, 0);
        const sashY = pos.y - sashingLineCount * sashingLineWidth;
        
        for (let i = 0; i < sashingLineCount; i++) {
          const color = state.sashingBorder.colors[i] || "#888888";
          fillRectWithSwatch(ctx, color, colorMap, gridStartX, sashY + i * sashingLineWidth, gridW, sashingLineWidth, borderFabricCache);
        }
      }
    }
    
    // Cornerstones (intersection squares)
    const cornerstoneColor = state.sashingBorder.cornerstoneColor;
    if (cornerstoneColor && repW > 0 && repH > 0) {
      const cornerSize = sashingLineCount * sashingLineWidth;
      
      for (let row = repH; row < rows; row += repH) {
        for (let col = repW; col < cols; col += repW) {
          const pos = getBlockPos(row, col);
          const cornerX = pos.x - cornerSize;
          const cornerY = pos.y - cornerSize;
          fillRectWithSwatch(ctx, cornerstoneColor, colorMap, cornerX, cornerY, cornerSize, cornerSize, borderFabricCache);
        }
      }
    }
    
    ctx.restore();
  }

  // Draw blocks
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const pos = getBlockPos(row, col);
      drawBlock(ctx, grid[row][col], pos.x, pos.y, cellSize, colorMap);
    }
  }

  // Draw grid lines
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.lineWidth = 1;
  for (let row = 0; row <= rows; row++) {
    const pos = getBlockPos(row, 0);
    const endPos = getBlockPos(row, cols - 1);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(endPos.x + cellSize, pos.y);
    ctx.stroke();
  }
  for (let col = 0; col <= cols; col++) {
    const pos = getBlockPos(0, col);
    const endPos = getBlockPos(rows - 1, col);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x, endPos.y + cellSize);
    ctx.stroke();
  }

  // Outer border stroke
  ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
  ctx.lineWidth = 2;
  ctx.strokeRect(startX, startY, totalW, totalH);
}

export function renderToCanvas(
  grid: QuiltBlock[][],
  state: AppState,
  options?: {
    cellSize?: number;
    scale?: number;
    includeGrid?: boolean;
    includeRepeat?: boolean;
    background?: string;
    colorMap?: ColorToSwatchMap;
  }
): HTMLCanvasElement {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const baseCellSize = options?.cellSize ?? 80;
  const scale = options?.scale ?? 1;
  const includeGrid = options?.includeGrid ?? true;
  const background = options?.background ?? "#1a1a2e";
  const colorMap = options?.colorMap;

  const canvas = document.createElement("canvas");
  if (rows === 0 || cols === 0) {
    canvas.width = 0;
    canvas.height = 0;
    return canvas;
  }

  // Border configuration
  const outerLineCount = state.outerBorder?.lineCount || 0;
  const sashingLineCount = state.sashingBorder?.lineCount || 0;
  const outerWidthFrac = state.outerBorder?.widthFraction || 0.25;
  const sashingWidthFrac = state.sashingBorder?.widthFraction || 0.25;
  
  const repW = state.repeatWidth > 0 ? Math.min(state.repeatWidth, cols) : cols;
  const repH = state.repeatHeight > 0 ? Math.min(state.repeatHeight, rows) : rows;
  
  // Count sashing gaps
  const sashingGapsX = repW > 0 ? Math.floor((cols - 1) / repW) : 0;
  const sashingGapsY = repH > 0 ? Math.floor((rows - 1) / repH) : 0;
  
  // Border widths based on cell size
  const outerLineWidth = Math.round(baseCellSize * outerWidthFrac);
  const sashingLineWidth = Math.round(baseCellSize * sashingWidthFrac);
  
  const totalOuterBorder = outerLineCount * outerLineWidth;
  const totalSashingX = sashingGapsX * sashingLineCount * sashingLineWidth;
  const totalSashingY = sashingGapsY * sashingLineCount * sashingLineWidth;

  // Total dimensions
  const gridW = baseCellSize * cols + totalSashingX;
  const gridH = baseCellSize * rows + totalSashingY;
  const totalW = gridW + totalOuterBorder * 2;
  const totalH = gridH + totalOuterBorder * 2;

  canvas.width = totalW * scale;
  canvas.height = totalH * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, totalW, totalH);

  // Pre-load fabric images for borders
  if (colorMap) {
    state.outerBorder?.colors?.forEach(c => {
      const swatch = colorMap.get(c.toUpperCase());
      if (swatch && isFabricSwatch(swatch)) ensureFabricLoaded(swatch.dataUrl);
    });
    state.sashingBorder?.colors?.forEach(c => {
      const swatch = colorMap.get(c.toUpperCase());
      if (swatch && isFabricSwatch(swatch)) ensureFabricLoaded(swatch.dataUrl);
    });
    const cornerColor = state.sashingBorder?.cornerstoneColor;
    if (cornerColor) {
      const swatch = colorMap.get(cornerColor.toUpperCase());
      if (swatch && isFabricSwatch(swatch)) ensureFabricLoaded(swatch.dataUrl);
    }
  }

  // Draw outer border
  if (outerLineCount > 0 && state.outerBorder?.colors) {
    for (let i = 0; i < outerLineCount; i++) {
      const color = state.outerBorder.colors[i] || "#888888";
      const offset = i * outerLineWidth;
      const w = totalW - offset * 2;
      const h = totalH - offset * 2;
      
      fillRectWithSwatch(ctx, color, colorMap, offset, offset, w, outerLineWidth, borderFabricCache);
      fillRectWithSwatch(ctx, color, colorMap, offset, totalH - offset - outerLineWidth, w, outerLineWidth, borderFabricCache);
      fillRectWithSwatch(ctx, color, colorMap, offset, offset + outerLineWidth, outerLineWidth, h - outerLineWidth * 2, borderFabricCache);
      fillRectWithSwatch(ctx, color, colorMap, totalW - offset - outerLineWidth, offset + outerLineWidth, outerLineWidth, h - outerLineWidth * 2, borderFabricCache);
    }
  }

  const gridStartX = totalOuterBorder;
  const gridStartY = totalOuterBorder;

  // Helper to get block position accounting for sashing
  function getBlockPos(row: number, col: number): { x: number; y: number } {
    const sashingBeforeX = repW > 0 ? Math.floor(col / repW) : 0;
    const sashingBeforeY = repH > 0 ? Math.floor(row / repH) : 0;
    return {
      x: gridStartX + col * baseCellSize + sashingBeforeX * sashingLineCount * sashingLineWidth,
      y: gridStartY + row * baseCellSize + sashingBeforeY * sashingLineCount * sashingLineWidth,
    };
  }

  // Draw sashing
  if (sashingLineCount > 0 && state.sashingBorder?.colors) {
    // Vertical sashing
    if (repW > 0) {
      for (let col = repW; col < cols; col += repW) {
        const pos = getBlockPos(0, col);
        const sashX = pos.x - sashingLineCount * sashingLineWidth;
        
        for (let i = 0; i < sashingLineCount; i++) {
          const color = state.sashingBorder.colors[i] || "#888888";
          fillRectWithSwatch(ctx, color, colorMap, sashX + i * sashingLineWidth, gridStartY, sashingLineWidth, gridH, borderFabricCache);
        }
      }
    }
    
    // Horizontal sashing
    if (repH > 0) {
      for (let row = repH; row < rows; row += repH) {
        const pos = getBlockPos(row, 0);
        const sashY = pos.y - sashingLineCount * sashingLineWidth;
        
        for (let i = 0; i < sashingLineCount; i++) {
          const color = state.sashingBorder.colors[i] || "#888888";
          fillRectWithSwatch(ctx, color, colorMap, gridStartX, sashY + i * sashingLineWidth, gridW, sashingLineWidth, borderFabricCache);
        }
      }
    }
    
    // Cornerstones
    const cornerstoneColor = state.sashingBorder.cornerstoneColor;
    if (cornerstoneColor && repW > 0 && repH > 0) {
      const cornerSize = sashingLineCount * sashingLineWidth;
      
      for (let row = repH; row < rows; row += repH) {
        for (let col = repW; col < cols; col += repW) {
          const pos = getBlockPos(row, col);
          fillRectWithSwatch(ctx, cornerstoneColor, colorMap, pos.x - cornerSize, pos.y - cornerSize, cornerSize, cornerSize, borderFabricCache);
        }
      }
    }
  }

  // Draw blocks
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const pos = getBlockPos(row, col);
      drawBlock(ctx, grid[row][col], pos.x, pos.y, baseCellSize, colorMap);
    }
  }

  // Draw grid lines
  if (includeGrid) {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
    ctx.lineWidth = 1;
    for (let row = 0; row <= rows; row++) {
      const pos = getBlockPos(row, 0);
      const endPos = getBlockPos(row, cols - 1);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(endPos.x + baseCellSize, pos.y);
      ctx.stroke();
    }
    for (let col = 0; col <= cols; col++) {
      const pos = getBlockPos(0, col);
      const endPos = getBlockPos(rows - 1, col);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x, endPos.y + baseCellSize);
      ctx.stroke();
    }
  }

  // Outer border stroke
  ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, totalW, totalH);

  return canvas;
}

function points(coords: Array<[number, number]>): string {
  return coords.map(([x, y]) => `${x},${y}`).join(" ");
}

function svgBlock(block: QuiltBlock, x: number, y: number, size: number): string {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const transform = block.rotation
    ? ` transform="rotate(${block.rotation} ${cx} ${cy})"`
    : "";
  const parts: string[] = [];

  switch (block.shape) {
    case ShapeType.Square:
      parts.push(`<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${block.colors[0]}" />`);
      break;
    case ShapeType.HST:
      parts.push(
        `<polygon points="${points([
          [x, y],
          [x, y + size],
          [x + size, y + size],
        ])}" fill="${block.colors[0]}" />`
      );
      parts.push(
        `<polygon points="${points([
          [x, y],
          [x + size, y],
          [x + size, y + size],
        ])}" fill="${block.colors[1]}" />`
      );
      break;
    case ShapeType.QST: {
      const half = size / 2;
      parts.push(
        `<polygon points="${points([
          [x, y],
          [x + size, y],
          [x + half, y + half],
        ])}" fill="${block.colors[0]}" />`
      );
      parts.push(
        `<polygon points="${points([
          [x + size, y],
          [x + size, y + size],
          [x + half, y + half],
        ])}" fill="${block.colors[1]}" />`
      );
      parts.push(
        `<polygon points="${points([
          [x + size, y + size],
          [x, y + size],
          [x + half, y + half],
        ])}" fill="${block.colors[2]}" />`
      );
      parts.push(
        `<polygon points="${points([
          [x, y + size],
          [x, y],
          [x + half, y + half],
        ])}" fill="${block.colors[3]}" />`
      );
      break;
    }
    case ShapeType.HSTSplit: {
      const half = size / 2;
      // Solid half (bottom-left at rotation 0)
      parts.push(
        `<polygon points="${points([
          [x, y],
          [x, y + size],
          [x + size, y + size],
        ])}" fill="${block.colors[0]}" />`
      );
      // Split - top triangle
      parts.push(
        `<polygon points="${points([
          [x, y],
          [x + size, y],
          [x + half, y + half],
        ])}" fill="${block.colors[1]}" />`
      );
      // Split - right triangle
      parts.push(
        `<polygon points="${points([
          [x + size, y],
          [x + size, y + size],
          [x + half, y + half],
        ])}" fill="${block.colors[2]}" />`
      );
      break;
    }
  }

  return `<g${transform}>${parts.join("")}</g>`;
}

export function renderSvg(
  grid: QuiltBlock[][],
  state: AppState,
  options?: {
    cellSize?: number;
    includeGrid?: boolean;
    includeRepeat?: boolean;
    background?: string | null;
  }
): string {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const cellSize = options?.cellSize ?? 60;
  const includeGrid = options?.includeGrid ?? true;
  const includeRepeat = options?.includeRepeat ?? true;
  const background = options?.background ?? "#1a1a2e";

  if (rows === 0 || cols === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"></svg>`;
  }

  const width = cols * cellSize;
  const height = rows * cellSize;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  ];

  if (background) {
    parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${background}" />`);
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellSize;
      const y = row * cellSize;
      parts.push(svgBlock(grid[row][col], x, y, cellSize));
    }
  }

  if (includeGrid) {
    const stroke = "rgba(0, 0, 0, 0.15)";
    for (let row = 0; row <= rows; row++) {
      const y = row * cellSize;
      parts.push(
        `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${stroke}" stroke-width="1" />`
      );
    }
    for (let col = 0; col <= cols; col++) {
      const x = col * cellSize;
      parts.push(
        `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${stroke}" stroke-width="1" />`
      );
    }
  }

  if (includeRepeat) {
    const repW = state.repeatWidth > 0 ? Math.min(state.repeatWidth, cols) : 0;
    const repH = state.repeatHeight > 0 ? Math.min(state.repeatHeight, rows) : 0;
    const stroke = "rgba(255, 255, 255, 0.35)";
    if (repH > 0) {
      for (let row = repH; row < rows; row += repH) {
        const y = row * cellSize;
        parts.push(
          `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${stroke}" stroke-width="2" />`
        );
      }
    }
    if (repW > 0) {
      for (let col = repW; col < cols; col += repW) {
        const x = col * cellSize;
        parts.push(
          `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${stroke}" stroke-width="2" />`
        );
      }
    }
  }

  parts.push(
    `<rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="rgba(0, 0, 0, 0.4)" stroke-width="2" />`
  );
  parts.push("</svg>");
  return parts.join("");
}
