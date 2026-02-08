import { Store, defaultState } from "./state";
import { generateGrid } from "./layout";
import { simplifyGrid } from "./simplify";
import { render, renderSvg, renderToCanvas } from "./renderer";
import { bindUI } from "./ui";
import type { Palette } from "./types";
import { getAllPalettes } from "./palette";
import { preloadFabricSwatches, setOnFabricLoaded, type ColorToSwatchMap } from "./shapes";
import { embedInPng, embedInSvg, loadCartridgeFromFile } from "./cartridge";
import { addSpriteSheet } from "./spritesheet";
import { inject } from "@vercel/analytics";
import { getCurrentUser, getUserPalettes, saveUserPalettes, type User } from "./api-client";

// Initialize Vercel Analytics
inject();

// Track current user for cloud sync
let currentUser: User | null = null;

function buildColorMap(state: typeof store extends { get: () => infer S } ? S : never): ColorToSwatchMap {
  const palettes = getAllPalettes(state.customPalettes);
  const palette = palettes[state.paletteIndex % palettes.length];
  const swatches = palette.swatches || palette.colors;
  
  // Map each color from palette.colors to its corresponding swatch
  const map: ColorToSwatchMap = new Map();
  palette.colors.forEach((color, idx) => {
    const swatch = swatches[idx] ?? color;
    map.set(color.toUpperCase(), swatch);
  });
  
  // Preload any fabric images
  preloadFabricSwatches(swatches);
  
  return map;
}

const store = new Store(defaultState());
const canvas = document.getElementById("quilt-canvas") as HTMLCanvasElement;
let currentGrid = generateGrid(store.get());

const CUSTOM_PALETTES_KEY = "quilt.customPalettes";
function loadCustomPalettes(): Palette[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PALETTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && typeof entry.name === "string" && Array.isArray(entry.colors))
      .map((entry) => ({
        name: String(entry.name),
        colors: entry.colors
          .filter((color: unknown) => typeof color === "string")
          .slice(0, 6),
        // Preserve swatches (may contain fabric data URLs)
        swatches: Array.isArray(entry.swatches) ? entry.swatches : undefined,
      }))
      .filter((entry) => entry.colors.length === 6);
  } catch {
    return [];
  }
}

// Load palettes from localStorage initially
store.update({ customPalettes: loadCustomPalettes() });

// Track changes for saving
let lastCustomPalettes = "";
let savingToCloud = false;

// Save palettes (to localStorage or cloud depending on auth)
async function savePalettes(palettes: Palette[]) {
  const json = JSON.stringify(palettes);
  if (json === lastCustomPalettes) return;
  lastCustomPalettes = json;
  
  if (currentUser) {
    // Save to cloud
    if (!savingToCloud) {
      savingToCloud = true;
      try {
        await saveUserPalettes(palettes);
      } catch (err) {
        console.error("Failed to save to cloud:", err);
      }
      savingToCloud = false;
    }
  } else {
    // Save to localStorage
    localStorage.setItem(CUSTOM_PALETTES_KEY, json);
  }
}

store.subscribe(() => {
  savePalettes(store.get().customPalettes);
});

// Initialize auth and sync palettes
async function initAuthAndSync() {
  try {
    currentUser = await getCurrentUser();
    
    if (currentUser) {
      // Check for auth_success (just logged in)
      const params = new URLSearchParams(window.location.search);
      const justLoggedIn = params.get("auth_success") === "1";
      
      // Clean up URL
      if (justLoggedIn) {
        window.history.replaceState({}, "", window.location.pathname);
      }
      
      // Load palettes from cloud
      const cloudPalettes = await getUserPalettes();
      const localPalettes = loadCustomPalettes();
      
      if (justLoggedIn && localPalettes.length > 0) {
        // Merge local palettes to cloud
        const merged = await saveUserPalettes(localPalettes, true);
        store.update({ customPalettes: merged });
        // Clear localStorage since we've merged
        localStorage.removeItem(CUSTOM_PALETTES_KEY);
        console.log(`Merged ${localPalettes.length} local palettes to cloud`);
      } else if (cloudPalettes.length > 0) {
        // Use cloud palettes
        store.update({ customPalettes: cloudPalettes });
        lastCustomPalettes = JSON.stringify(cloudPalettes);
      }
    }
  } catch (err) {
    console.error("Auth/sync error:", err);
  }
}

// Run auth init
initAuthAndSync();

const isIos = /iPad|iPhone|iPod/i.test(navigator.userAgent);
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

async function shareOrDownload(blob: Blob, fileName: string) {
  const file = new File([blob], fileName, { type: blob.type });
  if (
    isMobile &&
    "share" in navigator &&
    "canShare" in navigator &&
    navigator.canShare({ files: [file] })
  ) {
    await navigator.share({ files: [file], title: fileName });
    return;
  }

  const url = URL.createObjectURL(blob);
  if (isIos) {
    window.open(url, "_blank");
  } else {
    const link = document.createElement("a");
    link.download = fileName;
    link.href = url;
    link.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadPng() {
  const state = store.get();
  const colorMap = buildColorMap(state);
  const baseCanvas = renderToCanvas(currentGrid, state, { cellSize: 80, scale: 2, colorMap });
  
  // Add sprite sheet strip with fabric swatches
  const { canvas: exportCanvas, sprites } = addSpriteSheet(baseCanvas, state);
  
  let blob = await new Promise<Blob | null>((resolve) =>
    exportCanvas.toBlob(resolve, "image/png")
  );
  if (!blob) return;
  
  // Embed cartridge data (settings) in PNG metadata, with sprite info
  blob = await embedInPng(blob, state, sprites);
  
  await shareOrDownload(
    blob,
    `quilt-${state.seed}-${state.gridWidth}x${state.gridHeight}.png`
  );
}

async function downloadSvg() {
  const state = store.get();
  let svg = renderSvg(currentGrid, state);
  
  // Embed cartridge data (settings) in SVG metadata
  svg = embedInSvg(svg, state);
  
  const blob = new Blob([svg], { type: "image/svg+xml" });
  await shareOrDownload(
    blob,
    `quilt-${state.seed}-${state.gridWidth}x${state.gridHeight}.svg`
  );
}

function generateCuttingList(): string {
  const state = store.get();
  const palettes = getAllPalettes(state.customPalettes);
  const palette = palettes[state.paletteIndex % palettes.length];
  
  // Build a map of color hex -> palette index (1-based for human readability)
  const colorToIndex = new Map<string, number>();
  palette.colors.forEach((color, idx) => {
    colorToIndex.set(color.toUpperCase(), idx + 1);
  });
  
  // Count unique pieces: key = "shape|colorIndices|rotation"
  const pieces = new Map<string, { 
    shape: string; 
    colors: (number | string)[]; 
    rotation: number; 
    count: number;
  }>();
  
  for (const row of currentGrid) {
    for (const block of row) {
      const colorIndices = block.colors.map(c => colorToIndex.get(c.toUpperCase()) ?? c);
      const key = `${block.shape}|${colorIndices.join(",")}|${block.rotation}`;
      
      if (pieces.has(key)) {
        pieces.get(key)!.count++;
      } else {
        pieces.set(key, {
          shape: block.shape,
          colors: colorIndices,
          rotation: block.rotation,
          count: 1,
        });
      }
    }
  }
  
  // Build CSV with separate color columns
  const lines: string[] = [
    `# Cutting List for Quilt Design`,
    `# Seed: ${state.seed}`,
    `# Grid: ${state.gridWidth} x ${state.gridHeight}`,
    `# Palette: ${palette.name}`,
    `#`,
    `# Color Key:`,
    ...palette.colors.map((c, i) => `#   ${i + 1} = ${c}`),
    `#`,
    `# Each row = one unique piece. "Cut" = how many of that exact piece to cut.`,
    ``,
    `Shape,Color 1,Color 2,Color 3,Color 4,Rotation,Cut`,
  ];
  
  // Sort by shape, then by count descending
  const sorted = [...pieces.values()].sort((a, b) => {
    if (a.shape !== b.shape) return a.shape.localeCompare(b.shape);
    return b.count - a.count;
  });
  
  for (const piece of sorted) {
    // Pad colors array to 4 elements
    const cols = [
      piece.colors[0] ?? "",
      piece.colors[1] ?? "",
      piece.colors[2] ?? "",
      piece.colors[3] ?? "",
    ];
    lines.push(`${piece.shape},${cols.join(",")},${piece.rotation}°,${piece.count}`);
  }
  
  // Add totals
  const totalPieces = sorted.reduce((sum, p) => sum + p.count, 0);
  const uniqueVariants = sorted.length;
  lines.push(``);
  lines.push(`# Total pieces: ${totalPieces}`);
  lines.push(`# Unique variants: ${uniqueVariants}`);
  
  return lines.join("\n");
}

async function downloadCuttingList() {
  const state = store.get();
  const csv = generateCuttingList();
  const blob = new Blob([csv], { type: "text/csv" });
  await shareOrDownload(
    blob,
    `quilt-${state.seed}-cutting-list.csv`
  );
}

// Debounced redraw to prevent render pile-up
let redrawTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingRedraw = false;

function redraw() {
  const state = store.get();
  const rawGrid = generateGrid(state);
  // Simplify blocks where adjacent triangles of same color can merge
  currentGrid = simplifyGrid(rawGrid);
  const colorMap = buildColorMap(state);
  render(canvas, currentGrid, state, colorMap);
}

function scheduleRedraw() {
  if (redrawTimeout) {
    pendingRedraw = true;
    return;
  }
  
  redraw();
  
  redrawTimeout = setTimeout(() => {
    redrawTimeout = null;
    if (pendingRedraw) {
      pendingRedraw = false;
      scheduleRedraw();
    }
  }, 16); // ~60fps max
}

// Re-render (just paint, don't regenerate grid) when fabric images finish loading
function repaint() {
  const state = store.get();
  const colorMap = buildColorMap(state);
  render(canvas, currentGrid, state, colorMap);
}

// Re-render when fabric images finish loading (just repaint, grid hasn't changed)
setOnFabricLoaded(() => {
  repaint();
});

// Re-render on any state change
store.subscribe(scheduleRedraw);

// Re-render on resize (just repaint)
window.addEventListener("resize", repaint);

// Wire up UI controls
bindUI(store, { onExportPng: downloadPng, onExportSvg: downloadSvg, onExportCuttingList: downloadCuttingList });

// --- Load design functionality ---
const loadDesignBtn = document.getElementById("load-design");
const loadDesignInput = document.getElementById("load-design-input") as HTMLInputElement;

async function handleLoadFile(file: File) {
  const loadedState = await loadCartridgeFromFile(file);
  if (loadedState) {
    // Merge loaded state with current state (preserving any fields not in cartridge)
    store.update(loadedState);
    alert(`Loaded design: ${file.name}`);
  } else {
    alert("Could not load design from this file. Make sure it's a PNG or SVG saved from Quilt Designer.");
  }
}

if (loadDesignBtn && loadDesignInput) {
  loadDesignBtn.addEventListener("click", () => {
    loadDesignInput.click();
  });
  
  loadDesignInput.addEventListener("change", async () => {
    const file = loadDesignInput.files?.[0];
    if (file) {
      await handleLoadFile(file);
      loadDesignInput.value = ""; // Reset for next load
    }
  });
}

// Drag & drop support
const dropTarget = document.body;

dropTarget.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropTarget.classList.add("drop-active");
});

dropTarget.addEventListener("dragleave", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropTarget.classList.remove("drop-active");
});

dropTarget.addEventListener("drop", async (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropTarget.classList.remove("drop-active");
  
  const file = e.dataTransfer?.files[0];
  if (file && (file.type === "image/png" || file.type === "image/svg+xml" || 
      file.name.endsWith(".png") || file.name.endsWith(".svg"))) {
    await handleLoadFile(file);
  }
});

// Initial render
redraw();
