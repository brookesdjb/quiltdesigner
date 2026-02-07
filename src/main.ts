import { Store, defaultState } from "./state";
import { generateGrid } from "./layout";
import { render } from "./renderer";
import { bindUI } from "./ui";

const store = new Store(defaultState());
const canvas = document.getElementById("quilt-canvas") as HTMLCanvasElement;

function redraw() {
  const state = store.get();
  const grid = generateGrid(state);
  render(canvas, grid, state);
}

// Re-render on any state change
store.subscribe(redraw);

// Re-render on resize
window.addEventListener("resize", redraw);

// Wire up UI controls
bindUI(store);

// Initial render
redraw();
