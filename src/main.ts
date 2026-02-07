import { Store, defaultState } from "./state";
import { generateGrid } from "./layout";
import { render, renderSvg } from "./renderer";
import { bindUI } from "./ui";

const store = new Store(defaultState());
const canvas = document.getElementById("quilt-canvas") as HTMLCanvasElement;
let currentGrid = generateGrid(store.get());

function downloadPng() {
  const state = store.get();
  const link = document.createElement("a");
  link.download = `quilt-${state.seed}-${state.gridWidth}x${state.gridHeight}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function downloadSvg() {
  const state = store.get();
  const svg = renderSvg(currentGrid, state);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `quilt-${state.seed}-${state.gridWidth}x${state.gridHeight}.svg`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
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
