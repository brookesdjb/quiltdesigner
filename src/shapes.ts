import { type QuiltBlock, ShapeType } from "./types";

export function drawBlock(
  ctx: CanvasRenderingContext2D,
  block: QuiltBlock,
  x: number,
  y: number,
  size: number
): void {
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.rotate((block.rotation * Math.PI) / 180);
  ctx.translate(-size / 2, -size / 2);

  switch (block.shape) {
    case ShapeType.Square:
      drawSquare(ctx, block.colors, size);
      break;
    case ShapeType.HST:
      drawHST(ctx, block.colors, size);
      break;
    case ShapeType.QST:
      drawQST(ctx, block.colors, size);
      break;
  }

  ctx.restore();
}

function drawSquare(ctx: CanvasRenderingContext2D, colors: string[], size: number): void {
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, size, size);
}

function drawHST(ctx: CanvasRenderingContext2D, colors: string[], size: number): void {
  // Bottom-left triangle
  ctx.fillStyle = colors[0];
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(size, size);
  ctx.closePath();
  ctx.fill();

  // Top-right triangle
  ctx.fillStyle = colors[1];
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size, 0);
  ctx.lineTo(size, size);
  ctx.closePath();
  ctx.fill();
}

function drawQST(ctx: CanvasRenderingContext2D, colors: string[], size: number): void {
  const half = size / 2;

  // Top triangle
  ctx.fillStyle = colors[0];
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size, 0);
  ctx.lineTo(half, half);
  ctx.closePath();
  ctx.fill();

  // Right triangle
  ctx.fillStyle = colors[1];
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(size, size);
  ctx.lineTo(half, half);
  ctx.closePath();
  ctx.fill();

  // Bottom triangle
  ctx.fillStyle = colors[2];
  ctx.beginPath();
  ctx.moveTo(size, size);
  ctx.lineTo(0, size);
  ctx.lineTo(half, half);
  ctx.closePath();
  ctx.fill();

  // Left triangle
  ctx.fillStyle = colors[3];
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(0, 0);
  ctx.lineTo(half, half);
  ctx.closePath();
  ctx.fill();
}
