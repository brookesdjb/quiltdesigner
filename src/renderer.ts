import type { AppState, QuiltBlock } from "./types";
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
