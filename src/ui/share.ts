// Share modal UI logic

import { isFabricSwatch, type Swatch } from "../types";
import { sharePalette, updateDisplayName, type User } from "../api-client";

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

interface ShareSwatchMeta {
  fabricName: string;
  fabricBrand: string;
  shopUrl: string;
}

let shareSwatchMeta: ShareSwatchMeta[] = [];
let activeShareSwatchIndex = -1;
let currentUserRef: User | null = null;

// DOM refs
let shareConfirmModal: HTMLElement;
let sharePreviewSwatches: HTMLElement;
let sharePaletteName: HTMLInputElement;
let sharePaletteDesc: HTMLTextAreaElement;
let sharePaletteTags: HTMLInputElement;
let shareAuthorRow: HTMLElement;
let shareAuthorName: HTMLInputElement;
let shareFabricList: HTMLElement;
let shareCancelBtn: HTMLElement;
let shareConfirmBtn: HTMLElement;

function renderShareSwatches(swatches: Swatch[]) {
  sharePreviewSwatches.innerHTML = "";
  shareFabricList.innerHTML = "";
  shareSwatchMeta = swatches.map(() => ({ fabricName: "", fabricBrand: "", shopUrl: "" }));
  
  swatches.slice(0, 6).forEach((swatch, idx) => {
    // Preview swatch (clickable)
    const dot = document.createElement("div");
    dot.className = "share-swatch";
    if (isFabricSwatch(swatch)) {
      dot.style.backgroundImage = `url(${swatch.dataUrl})`;
    } else {
      dot.style.backgroundColor = swatch as string;
    }
    dot.addEventListener("click", () => selectShareSwatch(idx));
    sharePreviewSwatches.appendChild(dot);
    
    // Fabric detail input row
    const item = document.createElement("div");
    item.className = "share-fabric-item";
    item.dataset.index = String(idx);
    
    const swatchPreview = document.createElement("div");
    swatchPreview.className = "share-fabric-swatch";
    if (isFabricSwatch(swatch)) {
      swatchPreview.style.backgroundImage = `url(${swatch.dataUrl})`;
    } else {
      swatchPreview.style.backgroundColor = swatch as string;
    }
    
    const fields = document.createElement("div");
    fields.className = "share-fabric-fields";
    fields.innerHTML = `
      <input type="text" placeholder="Fabric name (e.g., Kona Cotton - Nautical)" data-field="fabricName" />
      <input type="text" placeholder="Brand (e.g., Robert Kaufman)" data-field="fabricBrand" />
      <input type="url" placeholder="Shop URL (optional)" data-field="shopUrl" />
    `;
    
    // Wire up field changes
    fields.querySelectorAll("input").forEach(input => {
      (input as HTMLInputElement).addEventListener("input", () => {
        const field = (input as HTMLInputElement).dataset.field as keyof ShareSwatchMeta;
        shareSwatchMeta[idx][field] = (input as HTMLInputElement).value;
        updateSwatchMetaIndicator(idx);
      });
    });
    
    item.appendChild(swatchPreview);
    item.appendChild(fields);
    shareFabricList.appendChild(item);
  });
}

function selectShareSwatch(idx: number) {
  if (activeShareSwatchIndex === idx) {
    activeShareSwatchIndex = -1;
  } else {
    activeShareSwatchIndex = idx;
  }
  
  sharePreviewSwatches.querySelectorAll(".share-swatch").forEach((el, i) => {
    el.classList.toggle("active", i === activeShareSwatchIndex);
  });
  shareFabricList.querySelectorAll(".share-fabric-item").forEach((el, i) => {
    el.classList.toggle("active", i === activeShareSwatchIndex);
  });
}

function updateSwatchMetaIndicator(idx: number) {
  const meta = shareSwatchMeta[idx];
  const hasData = !!(meta.fabricName || meta.fabricBrand || meta.shopUrl);
  const swatch = sharePreviewSwatches.children[idx];
  if (swatch) {
    swatch.classList.toggle("has-meta", hasData);
  }
}

export function closeShareModal() {
  shareConfirmModal.classList.remove("open");
  activeShareSwatchIndex = -1;
}

export interface ShareModalCallbacks {
  getCurrentPalette: () => { name: string; colors: string[]; swatches?: Swatch[] };
  onSuccess: () => void;
  onUserUpdate: (user: User) => void;
}

let callbacks: ShareModalCallbacks;

export function openShareModal(user: User | null) {
  currentUserRef = user;
  activeShareSwatchIndex = -1;
  
  const palette = callbacks.getCurrentPalette();
  const swatchesToShow = palette.swatches || palette.colors;
  renderShareSwatches(swatchesToShow as Swatch[]);
  
  sharePaletteName.value = palette.name || "My Palette";
  sharePaletteDesc.value = "";
  sharePaletteTags.value = "";
  
  const isFirstShare = user && user.displayName === user.name;
  shareAuthorRow.style.display = isFirstShare ? "flex" : "none";
  if (isFirstShare && user) {
    shareAuthorName.value = user.displayName;
  }
  
  shareConfirmModal.classList.add("open");
}

async function handleShare() {
  const name = sharePaletteName.value.trim();
  if (!name) {
    sharePaletteName.focus();
    return;
  }
  
  const isFirstShare = currentUserRef && currentUserRef.displayName === currentUserRef.name;
  if (isFirstShare && shareAuthorName.value.trim()) {
    try {
      currentUserRef = await updateDisplayName(shareAuthorName.value.trim());
      callbacks.onUserUpdate(currentUserRef);
    } catch (err) {
      alert("Failed to update name: " + (err as Error).message);
      return;
    }
  }
  
  const palette = callbacks.getCurrentPalette();
  
  try {
    shareConfirmBtn.textContent = "Sharing...";
    shareConfirmBtn.setAttribute("disabled", "true");
    
    const fabricDataUrls = palette.swatches
      ?.map(s => isFabricSwatch(s) ? s.dataUrl : "");
    
    const swatchMeta = shareSwatchMeta.map(m => ({
      fabricName: m.fabricName || undefined,
      fabricBrand: m.fabricBrand || undefined,
      shopUrl: m.shopUrl || undefined,
    }));
    const hasAnyMeta = swatchMeta.some(m => m.fabricName || m.fabricBrand || m.shopUrl);
    
    const tags = sharePaletteTags.value
      .split(",")
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);
    
    await sharePalette(
      name,
      palette.colors,
      fabricDataUrls?.some(u => u) ? fabricDataUrls : undefined,
      {
        description: sharePaletteDesc.value.trim() || undefined,
        swatchMeta: hasAnyMeta ? swatchMeta : undefined,
        tags: tags.length > 0 ? tags : undefined,
      }
    );
    
    closeShareModal();
    callbacks.onSuccess();
    
  } catch (err) {
    alert("Failed to share palette: " + (err as Error).message);
  } finally {
    shareConfirmBtn.textContent = "Share";
    shareConfirmBtn.removeAttribute("disabled");
  }
}

export function initShareModal(cbs: ShareModalCallbacks) {
  callbacks = cbs;
  
  // Get DOM refs
  shareConfirmModal = $("share-confirm-modal");
  sharePreviewSwatches = $("share-preview-swatches");
  sharePaletteName = $("share-palette-name") as HTMLInputElement;
  sharePaletteDesc = $("share-palette-desc") as HTMLTextAreaElement;
  sharePaletteTags = $("share-palette-tags") as HTMLInputElement;
  shareAuthorRow = $("share-author-row");
  shareAuthorName = $("share-author-name") as HTMLInputElement;
  shareFabricList = $("share-fabric-list");
  shareCancelBtn = $("share-cancel");
  shareConfirmBtn = $("share-confirm");
  
  // Event listeners
  shareCancelBtn.addEventListener("click", closeShareModal);
  
  shareConfirmModal.addEventListener("click", (e) => {
    if (e.target === shareConfirmModal) closeShareModal();
  });
  
  shareConfirmBtn.addEventListener("click", handleShare);
}
