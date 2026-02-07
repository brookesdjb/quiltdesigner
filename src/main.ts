import { Store, defaultState } from "./state";
import { generateGrid } from "./layout";
import { render, renderSvg, renderToCanvas } from "./renderer";
import { bindUI } from "./ui";
import type { Palette } from "./types";

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
      }))
      .filter((entry) => entry.colors.length === 6);
  } catch {
    return [];
  }
}

store.update({ customPalettes: loadCustomPalettes() });

let lastCustomPalettes = "";
store.subscribe(() => {
  const json = JSON.stringify(store.get().customPalettes);
  if (json !== lastCustomPalettes) {
    localStorage.setItem(CUSTOM_PALETTES_KEY, json);
    lastCustomPalettes = json;
  }
});

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
  const exportCanvas = renderToCanvas(currentGrid, state, { cellSize: 80, scale: 2 });
  const blob = await new Promise<Blob | null>((resolve) =>
    exportCanvas.toBlob(resolve, "image/png")
  );
  if (!blob) return;
  await shareOrDownload(
    blob,
    `quilt-${state.seed}-${state.gridWidth}x${state.gridHeight}.png`
  );
}

async function downloadSvg() {
  const state = store.get();
  const svg = renderSvg(currentGrid, state);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  await shareOrDownload(
    blob,
    `quilt-${state.seed}-${state.gridWidth}x${state.gridHeight}.svg`
  );
}

function redraw() {
  const state = store.get();
  const grid = generateGrid(state);
  currentGrid = grid;
  render(canvas, grid, state);
}

// Re-render on any state change
store.subscribe(redraw);

// Re-render on resize
window.addEventListener("resize", redraw);

// Wire up UI controls
bindUI(store, { onExportPng: downloadPng, onExportSvg: downloadSvg });

// Initial render
redraw();
