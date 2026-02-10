// Share Design modal UI logic

import { shareDesign, sharePalette, fetchSharedPalettes, type User, type SharedPalette } from "../api-client";
import { isFabricSwatch, type AppState, type Palette } from "../types";
import { BASE_PALETTES } from "../palette";

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

// State
let currentUserRef: User | null = null;
let selectedPaletteId: string | null = null;
let userSharedPalettes: SharedPalette[] = [];
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
let paletteDropdown: HTMLSelectElement;
let sharePaletteFirstBtn: HTMLElement;
let shareNewPaletteSection: HTMLElement;
let newPaletteNameInput: HTMLInputElement;
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

async function loadUserSharedPalettes() {
  try {
    // Fetch palettes - we'll filter to user's own later if needed
    // For now, fetch recent ones the user might have shared
    const res = await fetchSharedPalettes(undefined, undefined);
    userSharedPalettes = res.palettes.filter(p => p.userId === currentUserRef?.id);
    renderPaletteDropdown();
  } catch (err) {
    console.error("Failed to load user palettes:", err);
    userSharedPalettes = [];
    renderPaletteDropdown();
  }
}

function renderPaletteDropdown() {
  paletteDropdown.innerHTML = "";
  
  // Default option
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = userSharedPalettes.length > 0 
    ? "-- Select a shared palette --" 
    : "-- No shared palettes yet --";
  paletteDropdown.appendChild(defaultOpt);
  
  // User's shared palettes
  for (const palette of userSharedPalettes) {
    const opt = document.createElement("option");
    opt.value = palette.id;
    opt.textContent = `${palette.name} (${palette.colors.length} colors)`;
    paletteDropdown.appendChild(opt);
  }
  
  // Reset selection
  selectedPaletteId = null;
  paletteDropdown.value = "";
  updateShareButton();
}

function updateShareButton() {
  // Name is optional - will use generated placeholder if empty
  
  // For default palettes, always enabled (name has placeholder fallback)
  if (isDefaultPalette) {
    confirmBtn.toggleAttribute("disabled", false);
    return;
  }
  
  // For custom palettes, need either a selected palette or creating a new one
  const hasPalette = selectedPaletteId !== null;
  const isCreatingNew = shareNewPaletteSection.style.display !== "none";
  const hasNewPaletteName = newPaletteNameInput.value.trim().length > 0;
  
  const canShare = hasPalette || (isCreatingNew && hasNewPaletteName);
  confirmBtn.toggleAttribute("disabled", !canShare);
}

function showShareNewPaletteSection() {
  shareNewPaletteSection.style.display = "block";
  sharePaletteFirstBtn.style.display = "none";
  
  // Pre-fill with current palette name
  const currentPalette = callbacks.getCurrentPalette();
  newPaletteNameInput.value = currentPalette.name || "My Palette";
  updateShareButton();
}

export function closeShareDesignModal() {
  modal.classList.remove("open");
  selectedPaletteId = null;
  thumbnailDataUrl = null;
}

export async function openShareDesignModal(user: User | null) {
  if (!user) {
    alert("Please sign in to share designs");
    return;
  }
  
  currentUserRef = user;
  
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
  }
  
  // Reset form - use generated name as placeholder
  const generatedName = callbacks.getGeneratedName();
  designNameInput.value = "";
  designNameInput.placeholder = generatedName;
  designDescInput.value = "";
  designTagsInput.value = "";
  shareNewPaletteSection.style.display = "none";
  sharePaletteFirstBtn.style.display = "block";
  newPaletteNameInput.value = "";
  selectedPaletteId = null;
  
  // Load user's shared palettes (only needed for custom palette flow)
  if (!isDefaultPalette) {
    await loadUserSharedPalettes();
  }
  
  updateShareButton();
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
      // Using a default palette - no need to share or select a palette
      await shareDesign({
        name,
        defaultPaletteName,
        designData: JSON.stringify(designData),
        description: designDescInput.value.trim() || undefined,
        thumbnailUrl: thumbnailDataUrl || undefined,
        tags: tags.length > 0 ? tags : undefined,
      });
    } else {
      // Custom palette flow
      let paletteId = selectedPaletteId;
      
      // If creating new palette, share it first
      if (!paletteId && shareNewPaletteSection.style.display !== "none") {
        const paletteName = newPaletteNameInput.value.trim();
        if (!paletteName) {
          newPaletteNameInput.focus();
          return;
        }
        
        const fabricDataUrls = currentPalette.swatches
          ?.map(s => isFabricSwatch(s) ? s.dataUrl : "");
        
        const sharedPalette = await sharePalette(
          paletteName,
          currentPalette.colors,
          fabricDataUrls?.some(u => u) ? fabricDataUrls : undefined
        );
        
        // Check if this was a duplicate palette
        if (sharedPalette._duplicate && sharedPalette._message) {
          console.log("Using existing palette:", sharedPalette._message);
        }
        
        paletteId = sharedPalette.id;
      }
      
      if (!paletteId) {
        alert("Please select or create a palette to link with this design");
        return;
      }
      
      await shareDesign({
        name,
        paletteId,
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
  paletteDropdown = $("share-design-palette") as HTMLSelectElement;
  sharePaletteFirstBtn = $("share-palette-first-btn");
  shareNewPaletteSection = $("share-new-palette-section");
  newPaletteNameInput = $("share-new-palette-name") as HTMLInputElement;
  cancelBtn = $("share-design-cancel");
  confirmBtn = $("share-design-confirm");
  
  // Event listeners
  cancelBtn.addEventListener("click", closeShareDesignModal);
  
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeShareDesignModal();
  });
  
  paletteDropdown.addEventListener("change", () => {
    selectedPaletteId = paletteDropdown.value || null;
    updateShareButton();
  });
  
  sharePaletteFirstBtn.addEventListener("click", showShareNewPaletteSection);
  
  designNameInput.addEventListener("input", updateShareButton);
  newPaletteNameInput.addEventListener("input", updateShareButton);
  
  confirmBtn.addEventListener("click", handleShare);
}
