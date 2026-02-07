import type { AppState, QuiltBlock } from "./types";
import { ShapeType } from "./types";
import { drawBlock } from "./shapes";

export function render(
  canvas: HTMLCanvasElement,
  grid: QuiltBlock[][],
  state: AppState
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

  // Calculate cell size to fit canvas with padding
  const padding = 20;
  const availW = displayWidth - padding * 2;
  const availH = displayHeight - padding * 2;
  const cellSize = Math.floor(Math.min(availW / cols, availH / rows));

  // Center the grid
  const totalW = cellSize * cols;
  const totalH = cellSize * rows;
  const offsetX = Math.floor((displayWidth - totalW) / 2);
  const offsetY = Math.floor((displayHeight - totalH) / 2);

  // Draw blocks
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = offsetX + col * cellSize;
      const y = offsetY + row * cellSize;
      drawBlock(ctx, grid[row][col], x, y, cellSize);
    }
  }

  // Draw grid lines
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.lineWidth = 1;
  for (let row = 0; row <= rows; row++) {
    const y = offsetY + row * cellSize;
    ctx.beginPath();
    ctx.moveTo(offsetX, y);
    ctx.lineTo(offsetX + totalW, y);
    ctx.stroke();
  }
  for (let col = 0; col <= cols; col++) {
    const x = offsetX + col * cellSize;
    ctx.beginPath();
    ctx.moveTo(x, offsetY);
    ctx.lineTo(x, offsetY + totalH);
    ctx.stroke();
  }

  // Draw repeat block boundaries
  const repW = state.repeatWidth > 0 ? Math.min(state.repeatWidth, cols) : 0;
  const repH = state.repeatHeight > 0 ? Math.min(state.repeatHeight, rows) : 0;
  if (repW > 0 || repH > 0) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 2;
    if (repH > 0) {
      for (let row = repH; row < rows; row += repH) {
        const y = offsetY + row * cellSize;
        ctx.beginPath();
        ctx.moveTo(offsetX, y);
        ctx.lineTo(offsetX + totalW, y);
        ctx.stroke();
      }
    }
    if (repW > 0) {
      for (let col = repW; col < cols; col += repW) {
        const x = offsetX + col * cellSize;
        ctx.beginPath();
        ctx.moveTo(x, offsetY);
        ctx.lineTo(x, offsetY + totalH);
        ctx.stroke();
      }
    }
  }

  // Outer border
  ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
  ctx.lineWidth = 2;
  ctx.strokeRect(offsetX, offsetY, totalW, totalH);
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
  }
): HTMLCanvasElement {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const cellSize = options?.cellSize ?? 80;
  const scale = options?.scale ?? 1;
  const includeGrid = options?.includeGrid ?? true;
  const includeRepeat = options?.includeRepeat ?? true;
  const background = options?.background ?? "#1a1a2e";

  const canvas = document.createElement("canvas");
  if (rows === 0 || cols === 0) {
    canvas.width = 0;
    canvas.height = 0;
    return canvas;
  }

  const width = cols * cellSize;
  const height = rows * cellSize;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellSize;
      const y = row * cellSize;
      drawBlock(ctx, grid[row][col], x, y, cellSize);
    }
  }

  if (includeGrid) {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
    ctx.lineWidth = 1;
    for (let row = 0; row <= rows; row++) {
      const y = row * cellSize;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    for (let col = 0; col <= cols; col++) {
      const x = col * cellSize;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }

  if (includeRepeat) {
    const repW = state.repeatWidth > 0 ? Math.min(state.repeatWidth, cols) : 0;
    const repH = state.repeatHeight > 0 ? Math.min(state.repeatHeight, rows) : 0;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 2;
    if (repH > 0) {
      for (let row = repH; row < rows; row += repH) {
        const y = row * cellSize;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }
    if (repW > 0) {
      for (let col = repW; col < cols; col += repW) {
        const x = col * cellSize;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }
  }

  ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, width, height);

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
