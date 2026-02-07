import { Store } from "./state";
import { ShapeType, SymmetryMode } from "./types";
import { getAllPalettes } from "./palette";
import type { Palette } from "./types";

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

function sanitizePaletteName(name: string, fallbackIndex: number): string {
  const trimmed = name.trim();
  if (trimmed.length > 0) return trimmed;
  return `Custom ${fallbackIndex}`;
}

export function bindUI(
  store: Store,
  actions?: { onExportPng?: () => void; onExportSvg?: () => void }
): void {
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
  function renderPaletteSwatches(palettes: Palette[], activeIdx: number) {
    palContainer.innerHTML = "";
    palettes.forEach((palette, idx) => {
      const btn = document.createElement("button");
      btn.className = "palette-btn";
      btn.title = palette.name;
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
    updatePaletteSelection(activeIdx);
  }

  function updatePaletteSelection(activeIdx: number) {
    const buttons = palContainer.querySelectorAll(".palette-btn");
    buttons.forEach((btn, i) => {
      btn.classList.toggle("active", i === activeIdx);
    });
  }

  const paletteName = $("palette-name") as HTMLInputElement;
  const paletteAdd = $("palette-add");
  const paletteColorInputs = Array.from({ length: 6 }, (_, i) =>
    $(`palette-color-${i + 1}`) as HTMLInputElement
  );
  const palettePhotoInput = $("palette-photo") as HTMLInputElement;
  const palettePhotoCanvas = $("palette-photo-canvas") as HTMLCanvasElement;
  const palettePhotoCtx = palettePhotoCanvas.getContext("2d");
  let activeColorIndex = 0;

  paletteColorInputs.forEach((input, idx) => {
    input.addEventListener("focus", () => {
      activeColorIndex = idx;
    });
    input.addEventListener("click", () => {
      activeColorIndex = idx;
    });
  });

  function resizePhotoCanvas(width: number, height: number) {
    palettePhotoCanvas.width = width;
    palettePhotoCanvas.height = height;
  }

  function drawPhotoToCanvas(img: HTMLImageElement) {
    if (!palettePhotoCtx) return;
    const maxW = 360;
    const maxH = 200;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = Math.max(1, Math.floor(img.width * scale));
    const h = Math.max(1, Math.floor(img.height * scale));
    resizePhotoCanvas(w, h);
    palettePhotoCtx.clearRect(0, 0, w, h);
    palettePhotoCtx.drawImage(img, 0, 0, w, h);
  }

  palettePhotoInput.addEventListener("change", () => {
    const file = palettePhotoInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => drawPhotoToCanvas(img);
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

  palettePhotoCanvas.addEventListener("click", (event) => {
    if (!palettePhotoCtx) return;
    const rect = palettePhotoCanvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) * (palettePhotoCanvas.width / rect.width));
    const y = Math.floor((event.clientY - rect.top) * (palettePhotoCanvas.height / rect.height));
    const pixel = palettePhotoCtx.getImageData(x, y, 1, 1).data;
    const hex = `#${[pixel[0], pixel[1], pixel[2]]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")}`.toUpperCase();
    paletteColorInputs[activeColorIndex].value = hex;
  });

  paletteAdd.addEventListener("click", () => {
    const colors = paletteColorInputs.map((input) => input.value.toUpperCase());
    const customPalettes = [...store.get().customPalettes];
    const name = sanitizePaletteName(paletteName.value, customPalettes.length + 1);
    customPalettes.push({ name, colors });
    const palettes = getAllPalettes(customPalettes);
    store.update({ customPalettes, paletteIndex: palettes.length - 1 });
    renderPaletteSwatches(palettes, palettes.length - 1);
    paletteName.value = "";
  });

  const paletteCount = $("palette-count") as HTMLInputElement;
  const paletteCountVal = $("palette-count-val");
  paletteCount.addEventListener("input", () => {
    paletteCountVal.textContent = paletteCount.value;
    store.update({ paletteColorCount: Number(paletteCount.value) });
  });

  const exportPngBtn = document.getElementById("export-png");
  if (exportPngBtn && actions?.onExportPng) {
    exportPngBtn.addEventListener("click", actions.onExportPng);
  }

  const exportSvgBtn = document.getElementById("export-svg");
  if (exportSvgBtn && actions?.onExportSvg) {
    exportSvgBtn.addEventListener("click", actions.onExportSvg);
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
    renderPaletteSwatches(getAllPalettes(s.customPalettes), s.paletteIndex);
    paletteCount.value = String(s.paletteColorCount);
    paletteCountVal.textContent = String(s.paletteColorCount);
    renderSeedHistory();
  });

  // Trigger initial sync
  updateSymModeSelection(store.get().symmetryMode);
  renderPaletteSwatches(getAllPalettes(store.get().customPalettes), store.get().paletteIndex);
  renderSeedHistory();
}
