import { Store } from "./state";
import { ShapeType, SymmetryMode, type Swatch, type FabricSwatch, isFabricSwatch, isColorSwatch } from "./types";
import { getAllPalettes, BASE_PALETTES } from "./palette";
import { loadGenerations, saveGeneration, generateName } from "./generations";
import { createFabricEditor } from "./fabric-editor";
import type { Palette } from "./types";
import { getCurrentUser, getLoginUrl, getLogoutUrl, type User } from "./api-client";
import { initShareModal, openShareModal } from "./ui/share";

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
  return `My Palette ${fallbackIndex}`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function bindUI(
  store: Store,
  actions?: { 
    onExportImage?: (format: 'png' | 'svg') => void; 
    onExportCuttingList?: () => void;
  }
): void {
  // --- Grid size (now in canvas area, as multiples of repeat) ---
  const gridW = $("grid-width") as HTMLInputElement;
  const gridH = $("grid-height") as HTMLInputElement;
  const gridWVal = $("grid-width-val");
  const gridHVal = $("grid-height-val");

  function updateGridFromMultiplier() {
    const state = store.get();
    const multW = Number(gridW.value);
    const multH = Number(gridH.value);
    const repW = state.repeatWidth || 4;
    const repH = state.repeatHeight || 4;
    store.update({ 
      gridWidth: multW * repW, 
      gridHeight: multH * repH 
    });
  }

  gridW.addEventListener("input", () => {
    gridWVal.textContent = gridW.value;
    // Manual adjustment clears the quilt size lock
    if (store.get().quiltSize) {
      store.update({ quiltSize: "" });
    }
    updateGridFromMultiplier();
  });

  gridH.addEventListener("input", () => {
    gridHVal.textContent = gridH.value;
    if (store.get().quiltSize) {
      store.update({ quiltSize: "" });
    }
    updateGridFromMultiplier();
  });

  // --- Repeat block size ---
  const repW = $("repeat-width") as HTMLInputElement;
  const repH = $("repeat-height") as HTMLInputElement;
  const repWVal = $("repeat-width-val");
  const repHVal = $("repeat-height-val");

  repW.addEventListener("input", () => {
    repWVal.textContent = repW.value;
    const newRepW = Number(repW.value);
    store.update({ repeatWidth: newRepW });
    if (store.get().quiltSize) {
      recalcGridForQuiltSize();
    } else {
      const multW = Number(gridW.value);
      store.update({ gridWidth: multW * newRepW });
    }
  });

  repH.addEventListener("input", () => {
    repHVal.textContent = repH.value;
    const newRepH = Number(repH.value);
    store.update({ repeatHeight: newRepH });
    if (store.get().quiltSize) {
      recalcGridForQuiltSize();
    } else {
      const multH = Number(gridH.value);
      store.update({ gridHeight: multH * newRepH });
    }
  });

  // --- Randomise & History ---
  const randomiseBtn = $("randomise-btn");
  const historyToggle = $("history-toggle");
  const historyList = $("history-list");
  const currentDesignName = $("current-design-name");
  let historyOpen = false;

  function refreshHistoryList() {
    const generations = loadGenerations();
    const currentSeed = store.get().seed;
    historyList.innerHTML = "";

    if (generations.length === 0) {
      const empty = document.createElement("div");
      empty.className = "history-item";
      empty.textContent = "No saved designs yet";
      empty.style.opacity = "0.6";
      empty.style.cursor = "default";
      historyList.appendChild(empty);
      return;
    }

    for (const gen of generations) {
      const item = document.createElement("div");
      item.className = "history-item" + (gen.seed === currentSeed ? " active" : "");
      item.innerHTML = `
        <span class="history-item-name">${gen.name}</span>
        <span class="history-item-date">${formatDate(gen.createdAt)}</span>
      `;
      item.addEventListener("click", () => {
        store.update({ seed: gen.seed });
        currentDesignName.textContent = gen.name;
        closeHistory();
      });
      historyList.appendChild(item);
    }
  }

  function openHistory() {
    historyOpen = true;
    historyToggle.classList.add("open");
    historyList.classList.add("open");
    refreshHistoryList();
  }

  function closeHistory() {
    historyOpen = false;
    historyToggle.classList.remove("open");
    historyList.classList.remove("open");
  }

  historyToggle.addEventListener("click", () => {
    if (historyOpen) {
      closeHistory();
    } else {
      openHistory();
    }
  });

  // Close history when clicking outside
  document.addEventListener("click", (e) => {
    if (historyOpen && !historyToggle.contains(e.target as Node) && !historyList.contains(e.target as Node)) {
      closeHistory();
    }
  });

  randomiseBtn.addEventListener("click", () => {
    const newSeed = Math.floor(Math.random() * 2147483647);
    const gen = saveGeneration(newSeed);
    store.update({ seed: newSeed });
    currentDesignName.textContent = gen.name;
  });

  // --- Symmetry mode buttons ---
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

  // --- Symmetry strength ---
  const symSlider = $("symmetry") as HTMLInputElement;
  const symVal = $("symmetry-val");
  symSlider.addEventListener("input", () => {
    symVal.textContent = `${symSlider.value}%`;
    store.update({ symmetry: Number(symSlider.value) });
  });

  // --- Shape toggles ---
  // Only user-selectable shapes (not derived shapes like HSTSplit)
  const selectableShapes = [ShapeType.Square, ShapeType.HST, ShapeType.QST];
  for (const shape of selectableShapes) {
    const checkbox = $(`shape-${shape}`) as HTMLInputElement;
    checkbox.addEventListener("change", () => {
      const current = store.get().enabledShapes;
      store.update({
        enabledShapes: { ...current, [shape]: checkbox.checked },
      });
    });
  }

  // --- Shape ratio sliders ---
  for (const shape of selectableShapes) {
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

  // --- Palette swatches ---
  const palContainer = $("palette-swatches");
  const baseCount = BASE_PALETTES.length;
  let editingPaletteIndex: number | null = null; // Track if editing existing palette

  function renderPaletteSwatches(palettes: Palette[], activeIdx: number) {
    palContainer.innerHTML = "";
    palettes.forEach((palette, idx) => {
      const isCustom = idx >= baseCount;
      
      // Wrapper for custom palettes (to hold action buttons)
      const wrapper = document.createElement("div");
      wrapper.className = isCustom ? "palette-btn-wrapper" : "";
      
      const btn = document.createElement("button");
      btn.className = "palette-btn" + (isCustom ? " custom" : "");
      btn.title = palette.name;
      
      // Use swatches if available, otherwise colors
      const swatchesToShow = palette.swatches || palette.colors;
      for (let i = 0; i < Math.min(6, swatchesToShow.length); i++) {
        const swatch = swatchesToShow[i];
        const dot = document.createElement("span");
        dot.className = "swatch-dot";
        
        if (isFabricSwatch(swatch)) {
          dot.classList.add("fabric");
          dot.style.backgroundImage = `url(${swatch.dataUrl})`;
        } else {
          dot.style.backgroundColor = swatch;
        }
        btn.appendChild(dot);
      }
      btn.addEventListener("click", () => {
        // Remap border colors to new palette
        const state = store.get();
        const oldPalettes = getAllPalettes(state.customPalettes);
        const oldPalette = oldPalettes[state.paletteIndex % oldPalettes.length];
        const newPalette = palettes[idx % palettes.length];
        
        // Helper to remap a color from old palette index to new palette color
        const remapColors = (colors: string[]): string[] => {
          return colors.map((color, i) => {
            // Find index in old palette
            const oldIdx = oldPalette.colors.findIndex(c => c.toUpperCase() === color.toUpperCase());
            // Use same index in new palette, or fallback to position-based
            const useIdx = oldIdx >= 0 ? oldIdx : i;
            return newPalette.colors[useIdx % newPalette.colors.length];
          });
        };
        
        const newOuterColors = remapColors(state.outerBorder?.colors || []);
        const newSashingColors = remapColors(state.sashingBorder?.colors || []);
        const newCornerstoneColor = (() => {
          const color = state.sashingBorder?.cornerstoneColor;
          if (!color) return newPalette.colors[0];
          const oldIdx = oldPalette.colors.findIndex(c => c.toUpperCase() === color.toUpperCase());
          return newPalette.colors[(oldIdx >= 0 ? oldIdx : 0) % newPalette.colors.length];
        })();
        
        store.update({ 
          paletteIndex: idx,
          outerBorder: { ...state.outerBorder, colors: newOuterColors },
          sashingBorder: { ...state.sashingBorder, colors: newSashingColors, cornerstoneColor: newCornerstoneColor }
        });
        updatePaletteSelection(idx);
      });
      
      if (isCustom) {
        wrapper.appendChild(btn);
        
        // Action buttons for custom palettes
        const actions = document.createElement("div");
        actions.className = "palette-btn-actions";
        
        const editBtn = document.createElement("button");
        editBtn.className = "palette-action-btn edit";
        editBtn.innerHTML = "✎";
        editBtn.title = "Edit palette";
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openEditPalette(idx);
        });
        
        const shareBtn = document.createElement("button");
        shareBtn.className = "palette-action-btn share";
        shareBtn.innerHTML = "↗";
        shareBtn.title = "Share palette";
        shareBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          // Select this palette first, then open share modal
          store.update({ paletteIndex: idx });
          if (!currentUser) {
            window.location.href = getLoginUrl();
            return;
          }
          openShareModal(currentUser);
        });
        
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "palette-action-btn delete";
        deleteBtn.innerHTML = "×";
        deleteBtn.title = "Delete palette";
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          deletePalette(idx);
        });
        
        actions.appendChild(editBtn);
        actions.appendChild(shareBtn);
        actions.appendChild(deleteBtn);
        wrapper.appendChild(actions);
        palContainer.appendChild(wrapper);
      } else {
        palContainer.appendChild(btn);
      }
    });
    updatePaletteSelection(activeIdx);
  }

  function updatePaletteSelection(activeIdx: number) {
    const buttons = palContainer.querySelectorAll(".palette-btn");
    buttons.forEach((btn, i) => {
      btn.classList.toggle("active", i === activeIdx);
    });
  }
  
  function openEditPalette(paletteIdx: number) {
    const customIdx = paletteIdx - baseCount;
    const customPalettes = store.get().customPalettes;
    const palette = customPalettes[customIdx];
    if (!palette) return;
    
    editingPaletteIndex = customIdx;
    paletteName.value = palette.name;
    paletteAddBtn.textContent = "Save Changes";
    
    // Load swatches from palette
    editorSwatches = palette.swatches 
      ? [...palette.swatches] 
      : [...palette.colors];
    
    renderSwatchEditor();
    paletteModal.classList.add("open");
  }
  
  function deletePalette(paletteIdx: number) {
    const customIdx = paletteIdx - baseCount;
    const customPalettes = [...store.get().customPalettes];
    const paletteName = customPalettes[customIdx]?.name || "this palette";
    
    if (!confirm(`Delete "${paletteName}"?`)) return;
    
    customPalettes.splice(customIdx, 1);
    
    // Adjust paletteIndex if needed
    let newPaletteIndex = store.get().paletteIndex;
    if (newPaletteIndex >= baseCount + customPalettes.length) {
      newPaletteIndex = Math.max(0, baseCount + customPalettes.length - 1);
    } else if (newPaletteIndex > paletteIdx) {
      newPaletteIndex--;
    }
    
    store.update({ customPalettes, paletteIndex: newPaletteIndex });
    renderPaletteSwatches(getAllPalettes(customPalettes), newPaletteIndex);
  }

  // --- Custom palette modal ---
  const paletteModal = $("palette-modal");
  const createPaletteBtn = $("create-palette-btn");
  const paletteCancelBtn = $("palette-cancel");
  const paletteAddBtn = $("palette-add");
  const paletteName = $("palette-name") as HTMLInputElement;
  const paletteSwatchesEditor = $("palette-swatches-editor");
  const palettePhotoInput = $("palette-photo") as HTMLInputElement;
  const palettePhotoCanvas = $("palette-photo-canvas") as HTMLCanvasElement;
  const palettePhotoCtx = palettePhotoCanvas.getContext("2d");
  
  // Fabric editor
  const fabricEditorModal = $("fabric-editor-modal");
  const fabricEditorContainer = $("fabric-editor-container");
  const fabricFileInput = $("fabric-file-input") as HTMLInputElement;
  
  let activeColorIndex = 0;
  let editingFabricIndex = -1;
  
  // Swatch state for the editor (can be color or fabric)
  const DEFAULT_COLORS = ["#6E6259", "#8C8075", "#A99D92", "#C7BCB1", "#DED6CC", "#F1ECE4"];
  let editorSwatches: Swatch[] = [...DEFAULT_COLORS];
  
  function renderSwatchEditor() {
    paletteSwatchesEditor.innerHTML = "";
    
    editorSwatches.forEach((swatch, idx) => {
      const slot = document.createElement("div");
      slot.className = "palette-color-slot";
      
      // Type toggle buttons
      const toggleRow = document.createElement("div");
      toggleRow.className = "swatch-type-toggle";
      
      const colorBtn = document.createElement("button");
      colorBtn.className = "swatch-type-btn" + (isColorSwatch(swatch) ? " active" : "");
      colorBtn.textContent = "Color";
      colorBtn.onclick = () => {
        if (!isColorSwatch(swatch)) {
          editorSwatches[idx] = DEFAULT_COLORS[idx];
          renderSwatchEditor();
        }
      };
      
      const fabricBtn = document.createElement("button");
      fabricBtn.className = "swatch-type-btn" + (isFabricSwatch(swatch) ? " active" : "");
      fabricBtn.textContent = "Fabric";
      fabricBtn.onclick = () => {
        editingFabricIndex = idx;
        fabricFileInput.click();
      };
      
      toggleRow.appendChild(colorBtn);
      toggleRow.appendChild(fabricBtn);
      slot.appendChild(toggleRow);
      
      // Swatch input/preview
      if (isColorSwatch(swatch)) {
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = swatch;
        colorInput.addEventListener("input", () => {
          editorSwatches[idx] = colorInput.value.toUpperCase();
        });
        colorInput.addEventListener("focus", () => {
          activeColorIndex = idx;
        });
        slot.appendChild(colorInput);
      } else {
        const thumb = document.createElement("img");
        thumb.className = "fabric-preview-thumb";
        thumb.src = swatch.dataUrl;
        thumb.onclick = () => {
          editingFabricIndex = idx;
          // Re-edit existing fabric
          if (swatch.sourceUrl) {
            openFabricEditor(swatch.sourceUrl);
          } else {
            fabricFileInput.click();
          }
        };
        slot.appendChild(thumb);
      }
      
      paletteSwatchesEditor.appendChild(slot);
    });
  }
  
  function openFabricEditor(dataUrl: string) {
    fabricEditorModal.classList.add("open");
    
    const editor = createFabricEditor(fabricEditorContainer, {
      onConfirm: (croppedDataUrl, sourceDataUrl) => {
        const fabricSwatch: FabricSwatch = {
          type: "fabric",
          dataUrl: croppedDataUrl,
          sourceUrl: sourceDataUrl,
        };
        editorSwatches[editingFabricIndex] = fabricSwatch;
        fabricEditorModal.classList.remove("open");
        renderSwatchEditor();
      },
      onCancel: () => {
        fabricEditorModal.classList.remove("open");
      },
    });
    
    editor.loadImage(dataUrl);
  }
  
  fabricFileInput.addEventListener("change", () => {
    const file = fabricFileInput.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      openFabricEditor(reader.result as string);
    };
    reader.readAsDataURL(file);
    fabricFileInput.value = "";
  });

  createPaletteBtn.addEventListener("click", () => {
    editingPaletteIndex = null; // Creating new, not editing
    editorSwatches = [...DEFAULT_COLORS];
    paletteName.value = "";
    paletteAddBtn.textContent = "Add Palette";
    renderSwatchEditor();
    paletteModal.classList.add("open");
  });

  function closePaletteModal() {
    editingPaletteIndex = null;
    paletteModal.classList.remove("open");
    paletteAddBtn.textContent = "Add Palette";
  }

  paletteCancelBtn.addEventListener("click", closePaletteModal);

  paletteModal.addEventListener("click", (e) => {
    if (e.target === paletteModal) {
      closePaletteModal();
    }
  });

  function resizePhotoCanvas(width: number, height: number) {
    palettePhotoCanvas.width = width;
    palettePhotoCanvas.height = height;
  }

  function drawPhotoToCanvas(img: HTMLImageElement) {
    if (!palettePhotoCtx) return;
    const maxW = 360;
    const maxH = 140;
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
    
    // Update the active swatch if it's a color
    if (isColorSwatch(editorSwatches[activeColorIndex])) {
      editorSwatches[activeColorIndex] = hex;
      renderSwatchEditor();
    }
    // Move to next color swatch
    for (let i = 1; i <= 6; i++) {
      const nextIdx = (activeColorIndex + i) % 6;
      if (isColorSwatch(editorSwatches[nextIdx])) {
        activeColorIndex = nextIdx;
        break;
      }
    }
  });

  paletteAddBtn.addEventListener("click", () => {
    // Extract colors - use unique placeholders for fabric swatches so they map correctly
    const colors = editorSwatches.map((s, idx) => 
      isColorSwatch(s) ? s : `#FAB${String(idx).padStart(3, "0")}`
    );
    const customPalettes = [...store.get().customPalettes];
    const name = sanitizePaletteName(paletteName.value, customPalettes.length + 1);
    
    let newPaletteIndex: number;
    
    if (editingPaletteIndex !== null) {
      // Editing existing palette
      customPalettes[editingPaletteIndex] = { name, colors, swatches: [...editorSwatches] };
      newPaletteIndex = baseCount + editingPaletteIndex;
    } else {
      // Creating new palette
      customPalettes.push({ name, colors, swatches: [...editorSwatches] });
      newPaletteIndex = baseCount + customPalettes.length - 1;
    }
    
    const palettes = getAllPalettes(customPalettes);
    store.update({ customPalettes, paletteIndex: newPaletteIndex });
    renderPaletteSwatches(palettes, newPaletteIndex);
    paletteName.value = "";
    editingPaletteIndex = null;
    paletteModal.classList.remove("open");
  });

  // --- Colors used ---
  const paletteCount = $("palette-count") as HTMLInputElement;
  const paletteCountVal = $("palette-count-val");
  const colorModeMax = $("color-mode-max");
  const colorModeExact = $("color-mode-exact");
  
  paletteCount.addEventListener("input", () => {
    paletteCountVal.textContent = paletteCount.value;
    store.update({ paletteColorCount: Number(paletteCount.value) });
  });
  
  colorModeMax.addEventListener("click", () => {
    store.update({ colorCountMode: "max" });
  });
  
  colorModeExact.addEventListener("click", () => {
    store.update({ colorCountMode: "exact" });
  });
  
  function updateColorModeButtons(mode: "max" | "exact") {
    colorModeMax.classList.toggle("active", mode === "max");
    colorModeExact.classList.toggle("active", mode === "exact");
  }

  // --- Border controls ---
  const outerBorderCount = $("outer-border-count") as HTMLInputElement;
  const outerBorderCountVal = $("outer-border-count-val");
  const outerBorderWidthRow = $("outer-border-width-row");
  const outerBorderWidth = $("outer-border-width") as HTMLSelectElement;
  const outerBorderColors = $("outer-border-colors");
  
  const sashingBorderCount = $("sashing-border-count") as HTMLInputElement;
  const sashingBorderCountVal = $("sashing-border-count-val");
  const sashingBorderWidthRow = $("sashing-border-width-row");
  const sashingBorderWidth = $("sashing-border-width") as HTMLSelectElement;
  const sashingBorderColors = $("sashing-border-colors");
  const cornerstoneRow = $("cornerstone-row");
  const sashingCornerstone = $("sashing-cornerstone") as HTMLSelectElement;

  function renderBorderColorPickers(
    container: HTMLElement,
    borderType: "outerBorder" | "sashingBorder",
    count: number
  ) {
    container.innerHTML = "";
    const state = store.get();
    const palettes = getAllPalettes(state.customPalettes);
    const palette = palettes[state.paletteIndex % palettes.length];
    const currentColors = state[borderType].colors;
    const swatches = palette.swatches || palette.colors;
    
    for (let i = 0; i < count; i++) {
      const picker = document.createElement("div");
      picker.className = "border-color-picker";
      
      const label = document.createElement("span");
      label.textContent = `${i + 1}:`;
      picker.appendChild(label);
      
      // Use swatch buttons instead of select for better fabric preview
      const swatchRow = document.createElement("div");
      swatchRow.className = "border-swatch-row";
      
      swatches.forEach((swatch, idx) => {
        const color = palette.colors[idx];
        const btn = document.createElement("button");
        btn.className = "border-swatch-btn";
        if (currentColors[i] === color || (!currentColors[i] && idx === i % palette.colors.length)) {
          btn.classList.add("active");
        }
        
        if (isFabricSwatch(swatch)) {
          btn.style.backgroundImage = `url(${swatch.dataUrl})`;
          btn.style.backgroundSize = "cover";
          btn.title = `Fabric ${idx + 1}`;
        } else {
          btn.style.backgroundColor = swatch;
          btn.title = `Color ${idx + 1}`;
        }
        
        btn.addEventListener("click", () => {
          const freshState = store.get();
          const newColors = [...freshState[borderType].colors];
          newColors[i] = color;
          store.update({ [borderType]: { ...freshState[borderType], colors: newColors } });
        });
        
        swatchRow.appendChild(btn);
      });
      
      picker.appendChild(swatchRow);
      container.appendChild(picker);
    }
  }

  function updateBorderColors(borderType: "outerBorder" | "sashingBorder", count: number) {
    const state = store.get();
    const palettes = getAllPalettes(state.customPalettes);
    const palette = palettes[state.paletteIndex % palettes.length];
    
    // Ensure we have enough colors, using palette defaults
    const currentColors = [...(state[borderType]?.colors || [])];
    while (currentColors.length < count) {
      currentColors.push(palette.colors[currentColors.length % palette.colors.length]);
    }
    
    // Preserve existing config (widthFraction, cornerstoneColor) while updating lineCount and colors
    const existingConfig = state[borderType] || {};
    store.update({ 
      [borderType]: { 
        ...existingConfig,
        lineCount: count, 
        colors: currentColors.slice(0, count),
        widthFraction: existingConfig.widthFraction ?? 1
      } 
    });
  }

  function renderCornerstoneSelector() {
    const state = store.get();
    const palettes = getAllPalettes(state.customPalettes);
    const palette = palettes[state.paletteIndex % palettes.length];
    const currentColor = state.sashingBorder?.cornerstoneColor;
    const swatches = palette.swatches || palette.colors;
    
    // Replace the select with swatch buttons
    const parent = sashingCornerstone.parentElement;
    if (!parent) return;
    
    // Remove old cornerstone element and create swatch row
    let swatchRow = parent.querySelector(".cornerstone-swatch-row") as HTMLElement;
    if (!swatchRow) {
      swatchRow = document.createElement("div");
      swatchRow.className = "border-swatch-row cornerstone-swatch-row";
      sashingCornerstone.style.display = "none";
      parent.appendChild(swatchRow);
    }
    swatchRow.innerHTML = "";
    
    swatches.forEach((swatch, idx) => {
      const color = palette.colors[idx];
      const btn = document.createElement("button");
      btn.className = "border-swatch-btn";
      if (currentColor === color || (!currentColor && idx === 0)) {
        btn.classList.add("active");
      }
      
      if (isFabricSwatch(swatch)) {
        btn.style.backgroundImage = `url(${swatch.dataUrl})`;
        btn.style.backgroundSize = "cover";
        btn.title = `Fabric ${idx + 1}`;
      } else {
        btn.style.backgroundColor = swatch;
        btn.title = `Color ${idx + 1}`;
      }
      
      btn.addEventListener("click", () => {
        const freshState = store.get();
        store.update({ 
          sashingBorder: { ...freshState.sashingBorder, cornerstoneColor: color } 
        });
      });
      
      swatchRow.appendChild(btn);
    });
  }

  outerBorderCount.addEventListener("input", () => {
    const count = Number(outerBorderCount.value);
    outerBorderCountVal.textContent = String(count);
    outerBorderWidthRow.style.display = count > 0 ? "flex" : "none";
    updateBorderColors("outerBorder", count);
    renderBorderColorPickers(outerBorderColors, "outerBorder", count);
  });

  outerBorderWidth.addEventListener("change", () => {
    const state = store.get();
    store.update({ 
      outerBorder: { ...state.outerBorder, widthFraction: Number(outerBorderWidth.value) } 
    });
  });

  sashingBorderCount.addEventListener("input", () => {
    const count = Number(sashingBorderCount.value);
    sashingBorderCountVal.textContent = String(count);
    sashingBorderWidthRow.style.display = count > 0 ? "flex" : "none";
    updateBorderColors("sashingBorder", count);
    renderBorderColorPickers(sashingBorderColors, "sashingBorder", count);
    
    // Show/hide cornerstone selector
    cornerstoneRow.style.display = count > 0 ? "flex" : "none";
    if (count > 0) {
      renderCornerstoneSelector();
    }
  });

  sashingBorderWidth.addEventListener("change", () => {
    const state = store.get();
    store.update({ 
      sashingBorder: { ...state.sashingBorder, widthFraction: Number(sashingBorderWidth.value) } 
    });
  });

  // --- Scale / Quilt size controls ---
  // Standard quilt sizes (width × length in inches)
  const QUILT_SIZES: Record<string, { width: number; length: number }> = {
    baby:     { width: 30, length: 40 },
    crib:     { width: 36, length: 52 },
    throw:    { width: 50, length: 65 },
    twin:     { width: 70, length: 90 },
    xltwin:   { width: 70, length: 95 },
    double:   { width: 85, length: 108 },
    queen:    { width: 90, length: 108 },
    king:     { width: 110, length: 108 },
    calking:  { width: 106, length: 112 },
  };
  const CM_PER_INCH = 2.54;

  // Block size options: finished size (cut size with 1/4" seam allowance)
  const IMPERIAL_BLOCK_OPTIONS = [
    { value: "3.5", label: '3.5″ (4″ cut)' },
    { value: "2.5", label: '2.5″ (3″ cut)' },
    { value: "1.5", label: '1.5″ (2″ cut)' },
    { value: "0.75", label: '0.75″ (1″ cut)' },
    { value: "custom", label: "Custom…" },
  ];
  // Metric equivalents
  const METRIC_BLOCK_OPTIONS = [
    { value: String(9 / CM_PER_INCH), label: "9 cm (10 cm cut)" },
    { value: String(6 / CM_PER_INCH), label: "6 cm (7 cm cut)" },
    { value: String(4 / CM_PER_INCH), label: "4 cm (5 cm cut)" },
    { value: String(2 / CM_PER_INCH), label: "2 cm (3 cm cut)" },
    { value: "custom", label: "Custom…" },
  ];

  const scaleEnabled = $("scale-enabled") as HTMLInputElement;
  const scaleOptions = $("scale-options");
  const blockSizeSelect = $("block-size") as HTMLSelectElement;
  const blockSizeCustomRow = $("block-size-custom-row");
  const blockSizeCustom = $("block-size-custom") as HTMLInputElement;
  const blockSizeUnit = $("block-size-unit");
  const useMetricCheckbox = $("use-metric") as HTMLInputElement;
  const quiltSizeControl = $("quilt-size-control");
  const quiltSizeSelect = $("quilt-size") as HTMLSelectElement;
  const quiltDimensions = $("quilt-dimensions");

  function updateBlockSizeOptions(metric: boolean) {
    const options = metric ? METRIC_BLOCK_OPTIONS : IMPERIAL_BLOCK_OPTIONS;
    const state = store.get();
    blockSizeSelect.innerHTML = "";
    for (const opt of options) {
      const el = document.createElement("option");
      el.value = opt.value;
      el.textContent = opt.label;
      blockSizeSelect.appendChild(el);
    }
    if (state.blockSizeCustom) {
      blockSizeSelect.value = "custom";
    } else {
      const match = options.find(o => o.value !== "custom" && Math.abs(Number(o.value) - state.blockSizeInches) < 0.01);
      blockSizeSelect.value = match ? match.value : "custom";
    }
  }

  function updateScaleVisibility(enabled: boolean) {
    scaleOptions.style.display = enabled ? "block" : "none";
    quiltSizeControl.style.display = enabled ? "flex" : "none";
    quiltDimensions.style.display = enabled ? "inline" : "none";
  }

  // Calculate total quilt dimensions in inches, including borders and sashing
  function calcQuiltDimensionsInches(s: typeof store extends { get(): infer T } ? T : never) {
    const blockSize = s.blockSizeInches;
    const cols = s.gridWidth;
    const rows = s.gridHeight;

    // Outer border: lineCount lines on each side, each line = widthFraction * blockSize
    const outerLineCount = s.outerBorder?.lineCount || 0;
    const outerWidthFrac = s.outerBorder?.widthFraction || 1;
    const totalOuterPerSide = outerLineCount * outerWidthFrac * blockSize;

    // Sashing: between repeat blocks
    const sashingLineCount = s.sashingBorder?.lineCount || 0;
    const sashingWidthFrac = s.sashingBorder?.widthFraction || 1;
    const sashingGapsX = s.repeatWidth > 0 ? Math.floor((cols - 1) / s.repeatWidth) : 0;
    const sashingGapsY = s.repeatHeight > 0 ? Math.floor((rows - 1) / s.repeatHeight) : 0;
    const totalSashingX = sashingGapsX * sashingLineCount * sashingWidthFrac * blockSize;
    const totalSashingY = sashingGapsY * sashingLineCount * sashingWidthFrac * blockSize;

    return {
      width: cols * blockSize + totalSashingX + totalOuterPerSide * 2,
      height: rows * blockSize + totalSashingY + totalOuterPerSide * 2,
    };
  }

  function formatDimension(inches: number, metric: boolean): string {
    if (metric) {
      return `${(inches * CM_PER_INCH).toFixed(0)} cm`;
    }
    return Number.isInteger(inches) ? `${inches}″` : `${inches.toFixed(1)}″`;
  }

  function updateQuiltDimensions() {
    const s = store.get();
    if (!s.scaleEnabled) return;
    const dims = calcQuiltDimensionsInches(s);
    const w = formatDimension(dims.width, s.useMetric);
    const h = formatDimension(dims.height, s.useMetric);
    quiltDimensions.textContent = `${w} × ${h}`;
  }

  // Recalculate grid dimensions from the selected quilt size and current block size
  function recalcGridForQuiltSize() {
    const s = store.get();
    const quilt = QUILT_SIZES[s.quiltSize];
    if (!quilt) return;
    const blockSize = s.blockSizeInches;
    const repW_ = s.repeatWidth || 4;
    const repH_ = s.repeatHeight || 4;
    const totalCols = Math.ceil(quilt.width / blockSize);
    const totalRows = Math.ceil(quilt.length / blockSize);
    const newGridW = Math.ceil(totalCols / repW_) * repW_;
    const newGridH = Math.ceil(totalRows / repH_) * repH_;
    store.update({ gridWidth: newGridW, gridHeight: newGridH });
  }

  function updateGridSlidersDisabled(locked: boolean) {
    gridW.disabled = locked;
    gridH.disabled = locked;
    gridW.style.opacity = locked ? "0.4" : "";
    gridH.style.opacity = locked ? "0.4" : "";
  }

  scaleEnabled.addEventListener("change", () => {
    store.update({ scaleEnabled: scaleEnabled.checked });
  });

  blockSizeSelect.addEventListener("change", () => {
    if (blockSizeSelect.value === "custom") {
      blockSizeCustomRow.style.display = "flex";
      store.update({ blockSizeCustom: true });
    } else {
      blockSizeCustomRow.style.display = "none";
      store.update({ blockSizeInches: Number(blockSizeSelect.value), blockSizeCustom: false });
      recalcGridForQuiltSize();
    }
  });

  blockSizeCustom.addEventListener("input", () => {
    const val = Number(blockSizeCustom.value);
    if (val > 0) {
      const inches = store.get().useMetric ? val / CM_PER_INCH : val;
      store.update({ blockSizeInches: inches });
      recalcGridForQuiltSize();
    }
  });

  useMetricCheckbox.addEventListener("change", () => {
    const metric = useMetricCheckbox.checked;
    store.update({ useMetric: metric });
    updateBlockSizeOptions(metric);
    blockSizeUnit.textContent = metric ? "cm" : "″";
    const s = store.get();
    if (s.blockSizeCustom) {
      blockSizeCustom.value = metric
        ? (s.blockSizeInches * CM_PER_INCH).toFixed(1)
        : String(s.blockSizeInches);
    }
  });

  quiltSizeSelect.addEventListener("change", () => {
    const value = quiltSizeSelect.value;
    store.update({ quiltSize: value });
    recalcGridForQuiltSize();
  });

  // Initialize scale controls from state
  const initState = store.get();
  updateBlockSizeOptions(initState.useMetric);
  updateScaleVisibility(initState.scaleEnabled);
  scaleEnabled.checked = initState.scaleEnabled;
  useMetricCheckbox.checked = initState.useMetric;
  blockSizeUnit.textContent = initState.useMetric ? "cm" : "″";
  if (initState.blockSizeCustom) {
    blockSizeCustomRow.style.display = "flex";
    blockSizeCustom.value = initState.useMetric
      ? (initState.blockSizeInches * CM_PER_INCH).toFixed(1)
      : String(initState.blockSizeInches);
  }
  quiltSizeSelect.value = initState.quiltSize;
  updateGridSlidersDisabled(!!initState.quiltSize);
  updateQuiltDimensions();

  // --- Export buttons ---
  const exportImageBtn = document.getElementById("export-image");
  const exportFormatSelect = document.getElementById("export-format") as HTMLSelectElement | null;
  if (exportImageBtn && actions?.onExportImage) {
    exportImageBtn.addEventListener("click", () => {
      const format = (exportFormatSelect?.value || 'png') as 'png' | 'svg';
      actions.onExportImage!(format);
    });
  }

  const exportCuttingListBtn = document.getElementById("export-cutting-list");
  if (exportCuttingListBtn && actions?.onExportCuttingList) {
    exportCuttingListBtn.addEventListener("click", actions.onExportCuttingList);
  }

  // --- Auth & Share ---
  const authBtn = $("auth-btn");
  let currentUser: User | null = null;

  async function checkAuth() {
    currentUser = await getCurrentUser();
    updateAuthUI();
  }

  function updateAuthUI() {
    // Update header auth button
    if (currentUser) {
      authBtn.innerHTML = `<span class="user-info"><img class="user-avatar" src="${currentUser.picture || ''}" alt="" />${currentUser.displayName}</span>`;
      authBtn.title = "Sign out";
      authBtn.onclick = () => { window.location.href = getLogoutUrl(); };
    } else {
      authBtn.textContent = "Sign In";
      authBtn.title = "Sign in with Google";
      authBtn.onclick = () => { window.location.href = getLoginUrl(); };
    }
  }

  // Initialize share modal (used when sharing custom palettes via design share)
  initShareModal({
    getCurrentPalette: () => {
      const state = store.get();
      const palettes = getAllPalettes(state.customPalettes);
      return palettes[state.paletteIndex % palettes.length];
    },
    onSuccess: () => {},
    onUserUpdate: (user) => {
      currentUser = user;
      updateAuthUI();
    },
  });
  
  // Check auth on load
  checkAuth();

  // --- Sync UI from state ---
  store.subscribe(() => {
    const s = store.get();
    
    // Grid multipliers (grid size / repeat size)
    const multW = Math.max(1, Math.round(s.gridWidth / (s.repeatWidth || 4)));
    const multH = Math.max(1, Math.round(s.gridHeight / (s.repeatHeight || 4)));
    gridW.value = String(multW);
    gridH.value = String(multH);
    gridWVal.textContent = String(multW);
    gridHVal.textContent = String(multH);
    
    repW.value = String(s.repeatWidth);
    repH.value = String(s.repeatHeight);
    repWVal.textContent = String(s.repeatWidth);
    repHVal.textContent = String(s.repeatHeight);
    
    symSlider.value = String(s.symmetry);
    symVal.textContent = `${s.symmetry}%`;
    updateSymModeSelection(s.symmetryMode);
    renderPaletteSwatches(getAllPalettes(s.customPalettes), s.paletteIndex);
    paletteCount.value = String(s.paletteColorCount);
    paletteCountVal.textContent = String(s.paletteColorCount);
    updateColorModeButtons(s.colorCountMode || "max");
    
    // Border controls
    const outerCount = s.outerBorder?.lineCount || 0;
    const sashingCount = s.sashingBorder?.lineCount || 0;
    outerBorderCount.value = String(outerCount);
    outerBorderCountVal.textContent = String(outerCount);
    outerBorderWidthRow.style.display = outerCount > 0 ? "flex" : "none";
    outerBorderWidth.value = String(s.outerBorder?.widthFraction ?? 1);
    sashingBorderCount.value = String(sashingCount);
    sashingBorderCountVal.textContent = String(sashingCount);
    sashingBorderWidthRow.style.display = sashingCount > 0 ? "flex" : "none";
    sashingBorderWidth.value = String(s.sashingBorder?.widthFraction ?? 1);
    renderBorderColorPickers(outerBorderColors, "outerBorder", outerCount);
    renderBorderColorPickers(sashingBorderColors, "sashingBorder", sashingCount);
    
    // Cornerstone selector
    cornerstoneRow.style.display = sashingCount > 0 ? "flex" : "none";
    if (sashingCount > 0) {
      renderCornerstoneSelector();
    }
    
    // Scale controls
    scaleEnabled.checked = s.scaleEnabled;
    updateScaleVisibility(s.scaleEnabled);
    blockSizeCustomRow.style.display = s.blockSizeCustom ? "flex" : "none";
    quiltSizeSelect.value = s.quiltSize;
    updateGridSlidersDisabled(s.scaleEnabled && !!s.quiltSize);
    updateQuiltDimensions();

    // Update current design name
    const gen = loadGenerations().find(g => g.seed === s.seed);
    currentDesignName.textContent = gen?.name || generateName(s.seed);
  });

  // --- Initial sync ---
  updateSymModeSelection(store.get().symmetryMode);
  renderPaletteSwatches(getAllPalettes(store.get().customPalettes), store.get().paletteIndex);
  
  // Save initial seed to generations
  const initialSeed = store.get().seed;
  const initialGen = saveGeneration(initialSeed);
  currentDesignName.textContent = initialGen.name;
}
