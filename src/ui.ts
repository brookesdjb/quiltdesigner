import { Store } from "./state";
import { ShapeType, SymmetryMode } from "./types";
import { PALETTES } from "./palette";

const SYMMETRY_MODE_LABELS: { mode: SymmetryMode; label: string }[] = [
  { mode: SymmetryMode.None, label: "None" },
  { mode: SymmetryMode.Horizontal, label: "H ↔" },
  { mode: SymmetryMode.Vertical, label: "V ↕" },
  { mode: SymmetryMode.FourWay, label: "4-Way" },
  { mode: SymmetryMode.DiagonalTLBR, label: "Diag \\" },
  { mode: SymmetryMode.DiagonalTRBL, label: "Diag /" },
  { mode: SymmetryMode.Rotational, label: "Rotate" },
];

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

export function bindUI(store: Store): void {
  // Grid size sliders
  const gridW = $("grid-width") as HTMLInputElement;
  const gridH = $("grid-height") as HTMLInputElement;
  const gridWVal = $("grid-width-val");
  const gridHVal = $("grid-height-val");

  gridW.addEventListener("input", () => {
    gridWVal.textContent = gridW.value;
    store.update({ gridWidth: Number(gridW.value) });
  });
  gridH.addEventListener("input", () => {
    gridHVal.textContent = gridH.value;
    store.update({ gridHeight: Number(gridH.value) });
  });

  // Repeat block size
  const repW = $("repeat-width") as HTMLInputElement;
  const repH = $("repeat-height") as HTMLInputElement;
  const repWVal = $("repeat-width-val");
  const repHVal = $("repeat-height-val");

  function repeatLabel(v: number): string {
    return v === 0 ? "Off" : String(v);
  }

  repW.addEventListener("input", () => {
    repWVal.textContent = repeatLabel(Number(repW.value));
    store.update({ repeatWidth: Number(repW.value) });
  });
  repH.addEventListener("input", () => {
    repHVal.textContent = repeatLabel(Number(repH.value));
    store.update({ repeatHeight: Number(repH.value) });
  });

  // Seed
  const seedInput = $("seed-input") as HTMLInputElement;
  const rerollBtn = $("reroll-btn");
  const seedHistoryContainer = $("seed-history");

  seedInput.addEventListener("change", () => {
    store.update({ seed: Number(seedInput.value) || 0 });
  });
  rerollBtn.addEventListener("click", () => {
    const newSeed = Math.floor(Math.random() * 2147483647);
    seedInput.value = String(newSeed);
    store.update({ seed: newSeed });
  });

  function renderSeedHistory() {
    const history = store.seedHistory;
    seedHistoryContainer.innerHTML = "";
    for (const seed of history) {
      const btn = document.createElement("button");
      btn.className = "seed-history-btn";
      btn.textContent = String(seed);
      btn.addEventListener("click", () => {
        store.update({ seed });
      });
      seedHistoryContainer.appendChild(btn);
    }
  }

  // Symmetry mode buttons
  const symModesContainer = $("symmetry-modes");
  for (const { mode, label } of SYMMETRY_MODE_LABELS) {
    const btn = document.createElement("button");
    btn.className = "sym-mode-btn";
    btn.textContent = label;
    btn.dataset.mode = mode;
    btn.addEventListener("click", () => {
      store.update({ symmetryMode: mode });
    });
    symModesContainer.appendChild(btn);
  }

  function updateSymModeSelection(active: SymmetryMode) {
    symModesContainer.querySelectorAll(".sym-mode-btn").forEach((btn) => {
      const el = btn as HTMLElement;
      el.classList.toggle("active", el.dataset.mode === active);
    });
  }

  // Symmetry strength
  const symSlider = $("symmetry") as HTMLInputElement;
  const symVal = $("symmetry-val");
  symSlider.addEventListener("input", () => {
    symVal.textContent = `${symSlider.value}%`;
    store.update({ symmetry: Number(symSlider.value) });
  });

  // Shape toggles
  for (const shape of Object.values(ShapeType)) {
    const checkbox = $(`shape-${shape}`) as HTMLInputElement;
    checkbox.addEventListener("change", () => {
      const current = store.get().enabledShapes;
      store.update({
        enabledShapes: { ...current, [shape]: checkbox.checked },
      });
    });
  }

  // Shape ratio sliders
  for (const shape of Object.values(ShapeType)) {
    const slider = $(`ratio-${shape}`) as HTMLInputElement;
    const valSpan = $(`ratio-${shape}-val`);
    slider.addEventListener("input", () => {
      valSpan.textContent = slider.value;
      const current = store.get().shapeRatios;
      store.update({
        shapeRatios: { ...current, [shape]: Number(slider.value) },
      });
    });
  }

  // Palette swatches
  const palContainer = $("palette-swatches");
  PALETTES.forEach((palette, idx) => {
    const btn = document.createElement("button");
    btn.className = "palette-btn";
    btn.title = palette.name;
    // Show swatches as mini colored divs
    for (const color of palette.colors.slice(0, 5)) {
      const dot = document.createElement("span");
      dot.className = "swatch-dot";
      dot.style.backgroundColor = color;
      btn.appendChild(dot);
    }
    btn.addEventListener("click", () => {
      store.update({ paletteIndex: idx });
      updatePaletteSelection(idx);
    });
    palContainer.appendChild(btn);
  });

  function updatePaletteSelection(activeIdx: number) {
    const buttons = palContainer.querySelectorAll(".palette-btn");
    buttons.forEach((btn, i) => {
      btn.classList.toggle("active", i === activeIdx);
    });
  }

  // Sync UI from initial state
  store.subscribe(() => {
    const s = store.get();
    gridW.value = String(s.gridWidth);
    gridH.value = String(s.gridHeight);
    gridWVal.textContent = String(s.gridWidth);
    gridHVal.textContent = String(s.gridHeight);
    seedInput.value = String(s.seed);
    repW.value = String(s.repeatWidth);
    repH.value = String(s.repeatHeight);
    repWVal.textContent = repeatLabel(s.repeatWidth);
    repHVal.textContent = repeatLabel(s.repeatHeight);
    symSlider.value = String(s.symmetry);
    symVal.textContent = `${s.symmetry}%`;
    updateSymModeSelection(s.symmetryMode);
    updatePaletteSelection(s.paletteIndex);
    renderSeedHistory();
  });

  // Trigger initial sync
  updateSymModeSelection(store.get().symmetryMode);
  updatePaletteSelection(store.get().paletteIndex);
  renderSeedHistory();
}
