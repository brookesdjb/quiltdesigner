// Share Design modal UI logic

import { shareDesign, sharePalette, type User } from "../api-client";
import { isFabricSwatch, type AppState, type Palette } from "../types";
import { BASE_PALETTES } from "../palette";

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

// State
let thumbnailDataUrl: string | null = null;
let isDefaultPalette = false;
let defaultPaletteName: string | null = null;

// DOM refs (populated in init)
let modal: HTMLElement;
let thumbnailPreview: HTMLElement;
let designNameInput: HTMLInputElement;
let designDescInput: HTMLTextAreaElement;
let designTagsInput: HTMLInputElement;
let paletteSelectorSection: HTMLElement;
let defaultPaletteMessage: HTMLElement;
let paletteInfoMessage: HTMLElement;
let cancelBtn: HTMLElement;
let confirmBtn: HTMLElement;

export interface ShareDesignCallbacks {
  getCurrentState: () => AppState;
  getCurrentPalette: () => Palette;
  getCurrentPaletteIndex: () => number;
  getCanvasThumbnail: () => string; // Returns data URL
  getGeneratedName: () => string;   // Auto-generated design name
  onSuccess: () => void;
}

let callbacks: ShareDesignCallbacks;

export function closeShareDesignModal() {
  modal.classList.remove("open");
  thumbnailDataUrl = null;
}

export async function openShareDesignModal(user: User | null) {
  if (!user) {
    alert("Please sign in to share designs");
    return;
  }
  
  // Generate thumbnail
  thumbnailDataUrl = callbacks.getCanvasThumbnail();
  thumbnailPreview.innerHTML = "";
  if (thumbnailDataUrl) {
    const img = document.createElement("img");
    img.src = thumbnailDataUrl;
    img.alt = "Design preview";
    thumbnailPreview.appendChild(img);
  }
  
  // Check if using a default palette
  const paletteIndex = callbacks.getCurrentPaletteIndex();
  const currentPalette = callbacks.getCurrentPalette();
  isDefaultPalette = paletteIndex < BASE_PALETTES.length;
  
  if (isDefaultPalette) {
    defaultPaletteName = BASE_PALETTES[paletteIndex].name;
    defaultPaletteMessage.textContent = `Using built-in palette: ${defaultPaletteName}`;
    defaultPaletteMessage.style.display = "block";
    paletteSelectorSection.style.display = "none";
  } else {
    defaultPaletteName = null;
    defaultPaletteMessage.style.display = "none";
    paletteSelectorSection.style.display = "block";
    // Show palette info
    paletteInfoMessage.innerHTML = `Your palette "<strong>${currentPalette.name}</strong>" will be shared with this design.`;
  }
  
  // Reset form - use generated name as placeholder
  const generatedName = callbacks.getGeneratedName();
  designNameInput.value = "";
  designNameInput.placeholder = generatedName;
  designDescInput.value = "";
  designTagsInput.value = "";
  
  // Always enabled (name uses placeholder as fallback)
  confirmBtn.toggleAttribute("disabled", false);
  
  modal.classList.add("open");
  designNameInput.focus();
}

async function handleShare() {
  // Use entered name or fall back to generated placeholder
  const name = designNameInput.value.trim() || designNameInput.placeholder;
  
  confirmBtn.textContent = "Sharing...";
  confirmBtn.setAttribute("disabled", "true");
  
  try {
    // Serialize design state
    const state = callbacks.getCurrentState();
    const currentPalette = callbacks.getCurrentPalette();
    const designData = serializeDesignState(state, currentPalette.colors);
    
    // Parse tags
    const tags = designTagsInput.value
      .split(",")
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);
    
    if (isDefaultPalette && defaultPaletteName) {
      // Using a default palette - no need to share palette
      await shareDesign({
        name,
        defaultPaletteName,
        designData: JSON.stringify(designData),
        description: designDescInput.value.trim() || undefined,
        thumbnailUrl: thumbnailDataUrl || undefined,
        tags: tags.length > 0 ? tags : undefined,
      });
    } else {
      // Custom palette - share it (backend deduplicates automatically)
      const fabricDataUrls = currentPalette.swatches
        ?.map(s => isFabricSwatch(s) ? s.dataUrl : "");
      
      const sharedPalette = await sharePalette(
        currentPalette.name || "My Palette",
        currentPalette.colors,
        fabricDataUrls?.some(u => u) ? fabricDataUrls : undefined
      );
      
      // Use the returned palette ID (might be existing if duplicate)
      await shareDesign({
        name,
        paletteId: sharedPalette.id,
        designData: JSON.stringify(designData),
        description: designDescInput.value.trim() || undefined,
        thumbnailUrl: thumbnailDataUrl || undefined,
        tags: tags.length > 0 ? tags : undefined,
      });
    }
    
    closeShareDesignModal();
    callbacks.onSuccess();
    
  } catch (err) {
    alert("Failed to share design: " + (err as Error).message);
  } finally {
    confirmBtn.textContent = "Share Design";
    confirmBtn.removeAttribute("disabled");
  }
}

// Serialize only the fields needed to reconstruct the design
function serializeDesignState(state: AppState, paletteColors: string[]): Partial<AppState> & { paletteColors?: string[] } {
  return {
    seed: state.seed,
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
    symmetry: state.symmetry,
    symmetryMode: state.symmetryMode,
    enabledShapes: state.enabledShapes,
    shapeRatios: state.shapeRatios,
    paletteColorCount: state.paletteColorCount,
    colorCountMode: state.colorCountMode,
    repeatWidth: state.repeatWidth,
    repeatHeight: state.repeatHeight,
    outerBorder: state.outerBorder,
    sashingBorder: state.sashingBorder,
    // Include palette colors for preview cards and default palette matching
    paletteColors,
  };
}

export function initShareDesignModal(cbs: ShareDesignCallbacks) {
  callbacks = cbs;
  
  // Get DOM refs
  modal = $("share-design-modal");
  thumbnailPreview = $("share-design-thumbnail");
  designNameInput = $("share-design-name") as HTMLInputElement;
  designDescInput = $("share-design-desc") as HTMLTextAreaElement;
  designTagsInput = $("share-design-tags") as HTMLInputElement;
  paletteSelectorSection = $("share-design-palette-selector");
  defaultPaletteMessage = $("share-design-default-palette");
  paletteInfoMessage = $("share-design-palette-info");
  cancelBtn = $("share-design-cancel");
  confirmBtn = $("share-design-confirm");
  
  // Event listeners
  cancelBtn.addEventListener("click", closeShareDesignModal);
  
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeShareDesignModal();
  });
  
  confirmBtn.addEventListener("click", handleShare);
}
