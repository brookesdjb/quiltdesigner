import { type QuiltBlock, ShapeType, type Swatch, isColorSwatch, isFabricSwatch } from "./types";

// Cache for loaded fabric images
const fabricImageCache = new Map<string, HTMLImageElement>();

// Callback for when fabric images finish loading
let onFabricLoadedCallback: (() => void) | null = null;

export function setOnFabricLoaded(callback: () => void): void {
  onFabricLoadedCallback = callback;
}

function getOrLoadImage(dataUrl: string): HTMLImageElement | null {
  if (fabricImageCache.has(dataUrl)) {
    return fabricImageCache.get(dataUrl)!;
  }
  
  // Start loading (will be available on next render)
  const img = new Image();
  img.src = dataUrl;
  img.onload = () => {
    fabricImageCache.set(dataUrl, img);
    // Trigger re-render when image loads
    if (onFabricLoadedCallback) {
      onFabricLoadedCallback();
    }
  };
  
  return null;
}

// Pre-load fabric images from swatches
export function preloadFabricSwatches(swatches: Swatch[]): void {
  for (const swatch of swatches) {
    if (isFabricSwatch(swatch)) {
      getOrLoadImage(swatch.dataUrl);
    }
  }
}

function fillWithSwatch(
  ctx: CanvasRenderingContext2D,
  swatch: Swatch,
  x: number,
  y: number,
  size: number
): void {
  if (isColorSwatch(swatch)) {
    ctx.fillStyle = swatch;
    ctx.fill();
  } else if (isFabricSwatch(swatch)) {
    const img = fabricImageCache.get(swatch.dataUrl);
    if (img && img.complete) {
      ctx.save();
      ctx.clip();
      // Draw image scaled to block size (fabric-editor uses 200px blocks)
      ctx.drawImage(img, x, y, size, size);
      ctx.restore();
    } else {
      // Fallback to gray while loading
      ctx.fillStyle = "#888888";
      ctx.fill();
      // Trigger load
      getOrLoadImage(swatch.dataUrl);
    }
  }
}

// Maps color hex strings to swatches (for fabric support)
export type ColorToSwatchMap = Map<string, Swatch>;

export function drawBlock(
  ctx: CanvasRenderingContext2D,
  block: QuiltBlock,
  x: number,
  y: number,
  size: number,
  colorMap?: ColorToSwatchMap
): void {
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.rotate((block.rotation * Math.PI) / 180);
  ctx.translate(-size / 2, -size / 2);

  // Convert colors to swatches using the color map
  const blockSwatches: Swatch[] = colorMap 
    ? block.colors.map((color) => {
        const swatch = colorMap.get(color.toUpperCase());
        return swatch ?? color;
      })
    : block.colors;

  switch (block.shape) {
    case ShapeType.Square:
      drawSquare(ctx, blockSwatches, size);
      break;
    case ShapeType.HST:
      drawHST(ctx, blockSwatches, size);
      break;
    case ShapeType.QST:
      drawQST(ctx, blockSwatches, size);
      break;
    case ShapeType.HSTSplit:
      drawHSTSplit(ctx, blockSwatches, size);
      break;
  }

  ctx.restore();
}

function drawSquare(ctx: CanvasRenderingContext2D, swatches: Swatch[], size: number): void {
  ctx.beginPath();
  ctx.rect(0, 0, size, size);
  fillWithSwatch(ctx, swatches[0], 0, 0, size);
}

function drawHST(ctx: CanvasRenderingContext2D, swatches: Swatch[], size: number): void {
  // Bottom-left triangle
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(size, size);
  ctx.closePath();
  fillWithSwatch(ctx, swatches[0], 0, 0, size);

  // Top-right triangle
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size, 0);
  ctx.lineTo(size, size);
  ctx.closePath();
  fillWithSwatch(ctx, swatches[1], 0, 0, size);
}

// HST with one half split into 2 quarter triangles
// At rotation 0: bottom-left is solid, top-right is split into 2 triangles
// colors: [solidHalf, splitA (top), splitB (right)]
function drawHSTSplit(ctx: CanvasRenderingContext2D, swatches: Swatch[], size: number): void {
  const half = size / 2;

  // Solid half (bottom-left triangle at rotation 0)
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(size, size);
  ctx.closePath();
  fillWithSwatch(ctx, swatches[0], 0, 0, size);

  // Split half - top triangle (of the top-right area)
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size, 0);
  ctx.lineTo(half, half);
  ctx.closePath();
  fillWithSwatch(ctx, swatches[1], 0, 0, size);

  // Split half - right triangle (of the top-right area)
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(size, size);
  ctx.lineTo(half, half);
  ctx.closePath();
  fillWithSwatch(ctx, swatches[2], 0, 0, size);
}

function drawQST(ctx: CanvasRenderingContext2D, swatches: Swatch[], size: number): void {
  const half = size / 2;

  // Top triangle
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size, 0);
  ctx.lineTo(half, half);
  ctx.closePath();
  fillWithSwatch(ctx, swatches[0], 0, 0, size);

  // Right triangle
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(size, size);
  ctx.lineTo(half, half);
  ctx.closePath();
  fillWithSwatch(ctx, swatches[1], 0, 0, size);

  // Bottom triangle
  ctx.beginPath();
  ctx.moveTo(size, size);
  ctx.lineTo(0, size);
  ctx.lineTo(half, half);
  ctx.closePath();
  fillWithSwatch(ctx, swatches[2], 0, 0, size);

  // Left triangle
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(0, 0);
  ctx.lineTo(half, half);
  ctx.closePath();
  fillWithSwatch(ctx, swatches[3], 0, 0, size);
}

// Legacy export for compatibility
export function drawBlockLegacy(
  ctx: CanvasRenderingContext2D,
  block: QuiltBlock,
  x: number,
  y: number,
  size: number
): void {
  drawBlock(ctx, block, x, y, size);
}
