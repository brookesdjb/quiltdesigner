// Cartridge format: embed quilt design settings in PNG/SVG metadata
// Inspired by PICO-8's cartridge format

import type { AppState, Palette, FabricSwatch } from "./types";
import { isFabricSwatch } from "./types";
import type { SpriteInfo } from "./spritesheet";

const CARTRIDGE_KEY = "QuiltDesigner";
const CARTRIDGE_VERSION = 2; // Bumped for sprite sheet support

interface CartridgeData {
  version: number;
  state: Partial<AppState>;
  sprites?: SpriteInfo[]; // Sprite sheet info for fabric reconstruction
}

// Strip fabric dataUrls from palettes (they'll be in the sprite sheet)
function stripFabricData(palettes: Palette[]): Palette[] {
  return palettes.map(palette => {
    if (!palette.swatches) return palette;
    
    const strippedSwatches = palette.swatches.map(swatch => {
      if (isFabricSwatch(swatch)) {
        // Keep type marker but strip the heavy data
        return { type: "fabric" as const, dataUrl: "", sourceUrl: "" } as FabricSwatch;
      }
      return swatch;
    });
    
    return { ...palette, swatches: strippedSwatches };
  });
}

// Fields to save in cartridge (excludes transient UI state)
function extractSaveableState(state: AppState, stripFabrics = false): Partial<AppState> {
  return {
    seed: state.seed,
    symmetry: state.symmetry,
    symmetryMode: state.symmetryMode,
    enabledShapes: state.enabledShapes,
    shapeRatios: state.shapeRatios,
    paletteIndex: state.paletteIndex,
    customPalettes: stripFabrics 
      ? stripFabricData(state.customPalettes) 
      : state.customPalettes,
    paletteColorCount: state.paletteColorCount,
    colorCountMode: state.colorCountMode,
    repeatWidth: state.repeatWidth,
    repeatHeight: state.repeatHeight,
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
    outerBorder: state.outerBorder,
    sashingBorder: state.sashingBorder,
  };
}

function createCartridgeData(state: AppState, sprites?: SpriteInfo[]): string {
  // Strip fabric data if we have sprites (they're in the image)
  const hasSprites = sprites && sprites.length > 0;
  const data: CartridgeData = {
    version: CARTRIDGE_VERSION,
    state: extractSaveableState(state, hasSprites),
    sprites: hasSprites ? sprites : undefined,
  };
  return JSON.stringify(data);
}

interface ParsedCartridge {
  state: Partial<AppState>;
  sprites?: SpriteInfo[];
}

function parseCartridgeData(json: string): ParsedCartridge | null {
  try {
    const data: CartridgeData = JSON.parse(json);
    if (data.version && data.state) {
      return { state: data.state, sprites: data.sprites };
    }
  } catch {
    // Invalid JSON
  }
  return null;
}

// === PNG Embedding ===
// PNG files have chunks: each chunk is [length:4][type:4][data:length][crc:4]
// We'll add a tEXt chunk with our data

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  const table = new Uint32Array(256);
  
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  
  return (crc ^ 0xffffffff) >>> 0;
}

function createTextChunk(keyword: string, text: string): Uint8Array {
  const keywordBytes = new TextEncoder().encode(keyword);
  const textBytes = new TextEncoder().encode(text);
  const dataLength = keywordBytes.length + 1 + textBytes.length; // +1 for null separator
  
  const chunk = new Uint8Array(12 + dataLength);
  const view = new DataView(chunk.buffer);
  
  // Length (4 bytes, big-endian)
  view.setUint32(0, dataLength, false);
  
  // Type: "tEXt"
  chunk[4] = 0x74; // t
  chunk[5] = 0x45; // E
  chunk[6] = 0x58; // X
  chunk[7] = 0x74; // t
  
  // Data: keyword + null + text
  chunk.set(keywordBytes, 8);
  chunk[8 + keywordBytes.length] = 0; // null separator
  chunk.set(textBytes, 8 + keywordBytes.length + 1);
  
  // CRC (over type + data)
  const crcData = chunk.slice(4, 8 + dataLength);
  const crc = crc32(crcData);
  view.setUint32(8 + dataLength, crc, false);
  
  return chunk;
}

export async function embedInPng(blob: Blob, state: AppState, sprites?: SpriteInfo[]): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  
  // Verify PNG signature
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (data[i] !== signature[i]) {
      console.error("Not a valid PNG");
      return blob;
    }
  }
  
  // Find IEND chunk (last chunk)
  let iendPos = -1;
  let pos = 8;
  while (pos < data.length) {
    const view = new DataView(data.buffer, pos);
    const length = view.getUint32(0, false);
    const type = String.fromCharCode(data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]);
    
    if (type === "IEND") {
      iendPos = pos;
      break;
    }
    
    pos += 12 + length; // 4 (length) + 4 (type) + length + 4 (crc)
  }
  
  if (iendPos === -1) {
    console.error("Could not find IEND chunk");
    return blob;
  }
  
  // Create our tEXt chunk
  const cartridgeJson = createCartridgeData(state, sprites);
  const textChunk = createTextChunk(CARTRIDGE_KEY, cartridgeJson);
  
  // Build new PNG: [header + chunks before IEND] + [our tEXt chunk] + [IEND chunk]
  const beforeIend = data.slice(0, iendPos);
  const iendChunk = data.slice(iendPos);
  
  const newData = new Uint8Array(beforeIend.length + textChunk.length + iendChunk.length);
  newData.set(beforeIend, 0);
  newData.set(textChunk, beforeIend.length);
  newData.set(iendChunk, beforeIend.length + textChunk.length);
  
  return new Blob([newData], { type: "image/png" });
}

export function extractFromPng(data: Uint8Array): ParsedCartridge | null {
  // Verify PNG signature
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (data[i] !== signature[i]) {
      return null;
    }
  }
  
  // Find our tEXt chunk
  let pos = 8;
  while (pos < data.length) {
    const view = new DataView(data.buffer, pos);
    const length = view.getUint32(0, false);
    const type = String.fromCharCode(data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]);
    
    if (type === "tEXt") {
      // Parse tEXt chunk: keyword + null + text
      const chunkData = data.slice(pos + 8, pos + 8 + length);
      const nullPos = chunkData.indexOf(0);
      if (nullPos !== -1) {
        const keyword = new TextDecoder().decode(chunkData.slice(0, nullPos));
        if (keyword === CARTRIDGE_KEY) {
          const text = new TextDecoder().decode(chunkData.slice(nullPos + 1));
          return parseCartridgeData(text);
        }
      }
    }
    
    if (type === "IEND") break;
    pos += 12 + length;
  }
  
  return null;
}

// === SVG Embedding ===

export function embedInSvg(svgString: string, state: AppState): string {
  const cartridgeJson = createCartridgeData(state);
  const encoded = btoa(encodeURIComponent(cartridgeJson));
  
  // Insert metadata element after opening <svg> tag
  const metadataElement = `<metadata id="${CARTRIDGE_KEY}">${encoded}</metadata>`;
  
  // Find end of opening svg tag
  const svgTagEnd = svgString.indexOf(">") + 1;
  
  return svgString.slice(0, svgTagEnd) + metadataElement + svgString.slice(svgTagEnd);
}

export function extractFromSvg(svgString: string): ParsedCartridge | null {
  const metadataRegex = new RegExp(`<metadata id="${CARTRIDGE_KEY}">([^<]+)</metadata>`);
  const match = svgString.match(metadataRegex);
  
  if (match && match[1]) {
    try {
      const json = decodeURIComponent(atob(match[1]));
      return parseCartridgeData(json);
    } catch {
      // Invalid encoding
    }
  }
  
  return null;
}

// === File Loading ===

/**
 * Load a PNG as an image element (for sprite extraction)
 */
function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

/**
 * Extract fabric sprites from PNG and reconstruct palette data
 */
async function extractSpritesFromPng(
  file: File,
  sprites: SpriteInfo[],
  state: Partial<AppState>
): Promise<Partial<AppState>> {
  const img = await loadImageFromBlob(file);
  
  // Draw image to canvas to extract pixel data
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  
  // Extract each sprite
  const extractedFabrics = new Map<string, string>();
  
  for (const sprite of sprites) {
    const imageData = ctx.getImageData(sprite.x, sprite.y, sprite.size, sprite.size);
    
    // Create small canvas for this sprite
    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = sprite.size;
    spriteCanvas.height = sprite.size;
    const spriteCtx = spriteCanvas.getContext("2d")!;
    spriteCtx.putImageData(imageData, 0, 0);
    
    const key = `${sprite.paletteIndex}.${sprite.swatchIndex}`;
    extractedFabrics.set(key, spriteCanvas.toDataURL("image/png"));
  }
  
  // Reconstruct custom palettes with fabric data
  if (state.customPalettes) {
    const reconstructedPalettes = state.customPalettes.map((palette, palIdx) => {
      if (!palette.swatches) return palette;
      
      const newSwatches = palette.swatches.map((swatch, swIdx) => {
        if (!isFabricSwatch(swatch)) return swatch;
        
        const key = `${palIdx}.${swIdx}`;
        const dataUrl = extractedFabrics.get(key);
        
        if (dataUrl) {
          return {
            type: "fabric" as const,
            dataUrl,
            sourceUrl: dataUrl
          };
        }
        
        return swatch;
      });
      
      return { ...palette, swatches: newSwatches };
    });
    
    return { ...state, customPalettes: reconstructedPalettes };
  }
  
  return state;
}

export async function loadCartridgeFromFile(file: File): Promise<Partial<AppState> | null> {
  if (file.type === "image/png" || file.name.endsWith(".png")) {
    const arrayBuffer = await file.arrayBuffer();
    const parsed = extractFromPng(new Uint8Array(arrayBuffer));
    
    if (!parsed) return null;
    
    // If we have sprites, extract fabric data from the image
    if (parsed.sprites && parsed.sprites.length > 0) {
      return extractSpritesFromPng(file, parsed.sprites, parsed.state);
    }
    
    return parsed.state;
  }
  
  if (file.type === "image/svg+xml" || file.name.endsWith(".svg")) {
    const text = await file.text();
    const parsed = extractFromSvg(text);
    return parsed?.state || null;
  }
  
  return null;
}
