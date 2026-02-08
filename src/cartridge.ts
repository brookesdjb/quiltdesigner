// Cartridge format: embed quilt design settings in PNG/SVG metadata
// Inspired by PICO-8's cartridge format

import type { AppState } from "./types";

const CARTRIDGE_KEY = "QuiltDesigner";
const CARTRIDGE_VERSION = 1;

interface CartridgeData {
  version: number;
  state: Partial<AppState>;
}

// Fields to save in cartridge (excludes transient UI state)
function extractSaveableState(state: AppState): Partial<AppState> {
  return {
    seed: state.seed,
    symmetry: state.symmetry,
    symmetryMode: state.symmetryMode,
    enabledShapes: state.enabledShapes,
    shapeRatios: state.shapeRatios,
    paletteIndex: state.paletteIndex,
    customPalettes: state.customPalettes,
    paletteColorCount: state.paletteColorCount,
    repeatWidth: state.repeatWidth,
    repeatHeight: state.repeatHeight,
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
    outerBorder: state.outerBorder,
    sashingBorder: state.sashingBorder,
  };
}

function createCartridgeData(state: AppState): string {
  const data: CartridgeData = {
    version: CARTRIDGE_VERSION,
    state: extractSaveableState(state),
  };
  return JSON.stringify(data);
}

function parseCartridgeData(json: string): Partial<AppState> | null {
  try {
    const data: CartridgeData = JSON.parse(json);
    if (data.version && data.state) {
      return data.state;
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

export async function embedInPng(blob: Blob, state: AppState): Promise<Blob> {
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
  const cartridgeJson = createCartridgeData(state);
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

export function extractFromPng(data: Uint8Array): Partial<AppState> | null {
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

export function extractFromSvg(svgString: string): Partial<AppState> | null {
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

export async function loadCartridgeFromFile(file: File): Promise<Partial<AppState> | null> {
  if (file.type === "image/png" || file.name.endsWith(".png")) {
    const arrayBuffer = await file.arrayBuffer();
    return extractFromPng(new Uint8Array(arrayBuffer));
  }
  
  if (file.type === "image/svg+xml" || file.name.endsWith(".svg")) {
    const text = await file.text();
    return extractFromSvg(text);
  }
  
  return null;
}
