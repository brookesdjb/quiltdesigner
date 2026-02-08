// Sprite sheet for embedding fabric swatches in exported PNGs
// Adds a strip at the bottom with fabric thumbnails for re-import

import type { AppState, Palette, FabricSwatch } from "./types";
import { isFabricSwatch } from "./types";

const SWATCH_SIZE = 64;  // Size of each swatch in the sprite strip
const STRIP_PADDING = 8; // Padding around the strip
const SEPARATOR_HEIGHT = 2; // Visual separator line

export interface SpriteInfo {
  paletteIndex: number;  // Index in custom palettes
  swatchIndex: number;   // Index within the palette
  x: number;             // X position in sprite strip
  y: number;             // Y position in sprite strip
  size: number;          // Size of the sprite
}

export interface SpriteSheetResult {
  canvas: HTMLCanvasElement;
  sprites: SpriteInfo[];
  stripHeight: number;
}

/**
 * Collect all fabric swatches from custom palettes
 */
function collectFabricSwatches(state: AppState): { 
  swatch: FabricSwatch; 
  paletteIndex: number; 
  swatchIndex: number;
}[] {
  const fabrics: { swatch: FabricSwatch; paletteIndex: number; swatchIndex: number }[] = [];
  
  state.customPalettes.forEach((palette, palIdx) => {
    const swatches = palette.swatches || palette.colors;
    swatches.forEach((swatch, swIdx) => {
      if (isFabricSwatch(swatch)) {
        fabrics.push({ swatch, paletteIndex: palIdx, swatchIndex: swIdx });
      }
    });
  });
  
  return fabrics;
}

/**
 * Add a sprite sheet strip to the bottom of a canvas
 */
export function addSpriteSheet(
  sourceCanvas: HTMLCanvasElement,
  state: AppState
): SpriteSheetResult {
  const fabrics = collectFabricSwatches(state);
  
  // If no fabrics, return original canvas
  if (fabrics.length === 0) {
    return { canvas: sourceCanvas, sprites: [], stripHeight: 0 };
  }
  
  // Calculate strip dimensions
  const stripWidth = sourceCanvas.width;
  const swatchesPerRow = Math.floor((stripWidth - STRIP_PADDING * 2) / (SWATCH_SIZE + STRIP_PADDING));
  const rows = Math.ceil(fabrics.length / swatchesPerRow);
  const stripHeight = SEPARATOR_HEIGHT + STRIP_PADDING * 2 + rows * (SWATCH_SIZE + STRIP_PADDING);
  
  // Create new canvas with sprite strip
  const newCanvas = document.createElement("canvas");
  newCanvas.width = sourceCanvas.width;
  newCanvas.height = sourceCanvas.height + stripHeight;
  
  const ctx = newCanvas.getContext("2d")!;
  
  // Draw original canvas
  ctx.drawImage(sourceCanvas, 0, 0);
  
  // Draw separator line
  ctx.fillStyle = "#3a3a5a";
  ctx.fillRect(0, sourceCanvas.height, stripWidth, SEPARATOR_HEIGHT);
  
  // Draw strip background
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, sourceCanvas.height + SEPARATOR_HEIGHT, stripWidth, stripHeight - SEPARATOR_HEIGHT);
  
  // Draw fabric swatches
  const sprites: SpriteInfo[] = [];
  const startY = sourceCanvas.height + SEPARATOR_HEIGHT + STRIP_PADDING;
  
  fabrics.forEach((fabric, idx) => {
    const row = Math.floor(idx / swatchesPerRow);
    const col = idx % swatchesPerRow;
    
    const x = STRIP_PADDING + col * (SWATCH_SIZE + STRIP_PADDING);
    const y = startY + row * (SWATCH_SIZE + STRIP_PADDING);
    
    sprites.push({
      paletteIndex: fabric.paletteIndex,
      swatchIndex: fabric.swatchIndex,
      x,
      y,
      size: SWATCH_SIZE
    });
    
    // Draw the fabric swatch
    const img = new Image();
    img.src = fabric.swatch.dataUrl;
    
    // Draw border
    ctx.strokeStyle = "#3a3a5a";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, y - 0.5, SWATCH_SIZE + 1, SWATCH_SIZE + 1);
    
    // Draw image (sync since it should be cached)
    if (img.complete) {
      ctx.drawImage(img, x, y, SWATCH_SIZE, SWATCH_SIZE);
    } else {
      // Fallback: draw placeholder
      ctx.fillStyle = "#2a2a4a";
      ctx.fillRect(x, y, SWATCH_SIZE, SWATCH_SIZE);
    }
    
    // Draw index label
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${fabric.paletteIndex + 1}.${fabric.swatchIndex + 1}`, x + SWATCH_SIZE / 2, y + SWATCH_SIZE + 12);
  });
  
  return { canvas: newCanvas, sprites, stripHeight };
}

/**
 * Extract fabric swatches from a sprite sheet strip in a PNG
 */
export function extractSpritesFromCanvas(
  canvas: HTMLCanvasElement,
  sprites: SpriteInfo[]
): Map<string, string> {
  // Map of "paletteIndex.swatchIndex" -> dataUrl
  const extracted = new Map<string, string>();
  const ctx = canvas.getContext("2d")!;
  
  for (const sprite of sprites) {
    const imageData = ctx.getImageData(sprite.x, sprite.y, sprite.size, sprite.size);
    
    // Create a small canvas to extract the sprite
    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = sprite.size;
    spriteCanvas.height = sprite.size;
    const spriteCtx = spriteCanvas.getContext("2d")!;
    spriteCtx.putImageData(imageData, 0, 0);
    
    const key = `${sprite.paletteIndex}.${sprite.swatchIndex}`;
    extracted.set(key, spriteCanvas.toDataURL("image/png"));
  }
  
  return extracted;
}

/**
 * Reconstruct fabric swatches in palettes from extracted sprite data
 */
export function reconstructFabrics(
  palettes: Palette[],
  extractedSprites: Map<string, string>
): Palette[] {
  return palettes.map((palette, palIdx) => {
    if (!palette.swatches) return palette;
    
    const newSwatches = palette.swatches.map((swatch, swIdx) => {
      if (!isFabricSwatch(swatch)) return swatch;
      
      const key = `${palIdx}.${swIdx}`;
      const dataUrl = extractedSprites.get(key);
      
      if (dataUrl) {
        return {
          ...swatch,
          dataUrl,
          sourceUrl: dataUrl // Use extracted as source too
        } as FabricSwatch;
      }
      
      return swatch;
    });
    
    return { ...palette, swatches: newSwatches };
  });
}

export const SPRITE_SHEET_INFO = {
  swatchSize: SWATCH_SIZE,
  padding: STRIP_PADDING,
  separatorHeight: SEPARATOR_HEIGHT
};
