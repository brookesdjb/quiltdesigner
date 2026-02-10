// Community view - browse and share palettes & designs

import {
  fetchSharedPalettes,
  fetchSharedDesigns,
  likePalette,
  likeDesign,
  deletePalette,
  deleteDesign,
  formatTimeAgo,
  type SharedPalette,
  type SharedDesign,
} from "./api-client";

type FilterType = "all" | "palettes" | "designs";

interface CommunityState {
  filter: FilterType;
  search: string;
  paletteCursor?: string;
  designCursor?: string;
  hasMorePalettes: boolean;
  hasMoreDesigns: boolean;
  palettes: SharedPalette[];
  designs: SharedDesign[];
  loading: boolean;
}

const state: CommunityState = {
  filter: "all",
  search: "",
  hasMorePalettes: true,
  hasMoreDesigns: true,
  palettes: [],
  designs: [],
  loading: false,
};

let onImportPalette: ((palette: SharedPalette) => void) | null = null;
let onImportDesign: ((design: SharedDesign) => void) | null = null;

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function createPaletteCard(palette: SharedPalette): HTMLElement {
  const card = document.createElement("div");
  card.className = "community-card";
  card.dataset.type = "palette";
  card.dataset.id = palette.id;

  // Swatch preview
  const preview = document.createElement("div");
  preview.className = "card-preview";

  const swatchCount = Math.min(6, palette.colors.length);
  for (let i = 0; i < swatchCount; i++) {
    const swatch = document.createElement("div");
    swatch.className = "card-swatch";
    if (palette.hasFabrics && palette.fabricDataUrls?.[i]) {
      swatch.style.backgroundImage = `url(${palette.fabricDataUrls[i]})`;
    } else {
      swatch.style.backgroundColor = palette.colors[i];
    }
    preview.appendChild(swatch);
  }

  // Info section
  const info = document.createElement("div");
  info.className = "card-info";
  info.innerHTML = `
    <div class="card-type">Palette${palette.hasFabrics ? " · 🧵 Fabrics" : ""}</div>
    <div class="card-name">${escapeHtml(palette.name)}</div>
    <div class="card-meta">
      ${palette.userName ? `<span>by ${escapeHtml(palette.userName)}</span>` : ""}
      <span>${formatTimeAgo(palette.createdAt)}</span>
      <span>❤️ ${palette.likes}</span>
    </div>
    ${palette.tags?.length ? `
      <div class="card-tags">
        ${palette.tags.slice(0, 3).map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join("")}
      </div>
    ` : ""}
  `;

  card.appendChild(preview);
  card.appendChild(info);

  card.addEventListener("click", () => openPaletteDetail(palette));

  return card;
}

function createDesignCard(design: SharedDesign): HTMLElement {
  const card = document.createElement("div");
  card.className = "community-card";
  card.dataset.type = "design";
  card.dataset.id = design.id;

  // Preview
  const preview = document.createElement("div");
  preview.className = "card-preview design-preview";

  if (design.thumbnailUrl) {
    const img = document.createElement("img");
    img.src = design.thumbnailUrl;
    img.alt = design.name;
    preview.appendChild(img);
  } else {
    // Fallback to palette colors
    preview.classList.remove("design-preview");
    const colors = design.paletteColors || [];
    for (let i = 0; i < Math.min(6, colors.length); i++) {
      const swatch = document.createElement("div");
      swatch.className = "card-swatch";
      swatch.style.backgroundColor = colors[i];
      preview.appendChild(swatch);
    }
  }

  // Info section
  const info = document.createElement("div");
  info.className = "card-info";
  info.innerHTML = `
    <div class="card-type">Design</div>
    <div class="card-name">${escapeHtml(design.name)}</div>
    <div class="card-meta">
      ${design.userName ? `<span>by ${escapeHtml(design.userName)}</span>` : ""}
      <span>${formatTimeAgo(design.createdAt)}</span>
      <span>❤️ ${design.likes}</span>
    </div>
    ${design.paletteName ? `<div class="card-tags"><span class="card-tag">🎨 ${escapeHtml(design.paletteName)}</span></div>` : ""}
  `;

  card.appendChild(preview);
  card.appendChild(info);

  card.addEventListener("click", () => openDesignDetail(design));

  return card;
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function loadContent(append = false) {
  if (state.loading) return;
  state.loading = true;

  const grid = $("community-grid");
  const loadMoreRow = $("community-load-more");

  if (!append) {
    grid.innerHTML = '<div class="community-loading">Loading...</div>';
    state.palettes = [];
    state.designs = [];
    state.paletteCursor = undefined;
    state.designCursor = undefined;
    state.hasMorePalettes = true;
    state.hasMoreDesigns = true;
  }

  try {
    const shouldLoadPalettes = state.filter === "all" || state.filter === "palettes";
    const shouldLoadDesigns = state.filter === "all" || state.filter === "designs";

    // Load in parallel
    const [paletteRes, designRes] = await Promise.all([
      shouldLoadPalettes && state.hasMorePalettes
        ? fetchSharedPalettes(state.paletteCursor, state.search || undefined)
        : null,
      shouldLoadDesigns && state.hasMoreDesigns
        ? fetchSharedDesigns(state.designCursor, state.search || undefined)
        : null,
    ]);

    if (paletteRes) {
      state.palettes = append ? [...state.palettes, ...paletteRes.palettes] : paletteRes.palettes;
      state.paletteCursor = paletteRes.cursor;
      state.hasMorePalettes = paletteRes.hasMore;
    }

    if (designRes) {
      state.designs = append ? [...state.designs, ...designRes.designs] : designRes.designs;
      state.designCursor = designRes.cursor;
      state.hasMoreDesigns = designRes.hasMore;
    }

    // Render
    if (!append) {
      grid.innerHTML = "";
    } else {
      const loading = grid.querySelector(".community-loading");
      if (loading) loading.remove();
    }

    // Interleave palettes and designs for "all" view, or show filtered
    const items: Array<{ type: "palette"; data: SharedPalette } | { type: "design"; data: SharedDesign }> = [];

    if (state.filter === "all") {
      // Interleave by createdAt
      let pi = append ? Math.max(0, state.palettes.length - (paletteRes?.palettes.length || 0)) : 0;
      let di = append ? Math.max(0, state.designs.length - (designRes?.designs.length || 0)) : 0;

      while (pi < state.palettes.length || di < state.designs.length) {
        const p = state.palettes[pi];
        const d = state.designs[di];

        if (p && (!d || p.createdAt >= d.createdAt)) {
          items.push({ type: "palette", data: p });
          pi++;
        } else if (d) {
          items.push({ type: "design", data: d });
          di++;
        }
      }
    } else if (state.filter === "palettes") {
      const startIdx = append ? Math.max(0, state.palettes.length - (paletteRes?.palettes.length || 0)) : 0;
      for (let i = startIdx; i < state.palettes.length; i++) {
        items.push({ type: "palette", data: state.palettes[i] });
      }
    } else {
      const startIdx = append ? Math.max(0, state.designs.length - (designRes?.designs.length || 0)) : 0;
      for (let i = startIdx; i < state.designs.length; i++) {
        items.push({ type: "design", data: state.designs[i] });
      }
    }

    if (items.length === 0 && !append) {
      grid.innerHTML = `
        <div class="community-empty">
          <h3>${state.search ? "No results found" : "No content yet"}</h3>
          <p>${state.search ? "Try a different search term" : "Be the first to share!"}</p>
        </div>
      `;
    } else {
      for (const item of items) {
        if (item.type === "palette") {
          grid.appendChild(createPaletteCard(item.data));
        } else {
          grid.appendChild(createDesignCard(item.data));
        }
      }
    }

    // Show/hide load more
    const hasMore =
      (state.filter === "all" && (state.hasMorePalettes || state.hasMoreDesigns)) ||
      (state.filter === "palettes" && state.hasMorePalettes) ||
      (state.filter === "designs" && state.hasMoreDesigns);

    loadMoreRow.style.display = hasMore ? "flex" : "none";
  } catch (err) {
    console.error("Failed to load community content:", err);
    if (!append) {
      grid.innerHTML = `
        <div class="community-empty">
          <h3>Failed to load</h3>
          <p>Please try again later</p>
        </div>
      `;
    }
  } finally {
    state.loading = false;
  }
}

function openPaletteDetail(palette: SharedPalette) {
  // For now, create a simple detail modal
  // This will be enhanced in Phase 3
  const existing = document.getElementById("detail-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "detail-modal";
  modal.className = "detail-modal-overlay open";
  modal.innerHTML = `
    <div class="detail-modal">
      <div class="detail-header">
        <div>
          <h2>${escapeHtml(palette.name)}</h2>
          <div class="detail-meta">
            ${palette.userName ? `<span>by ${escapeHtml(palette.userName)}</span>` : ""}
            <span>${formatTimeAgo(palette.createdAt)}</span>
            <span>❤️ ${palette.likes}</span>
          </div>
        </div>
        <button class="detail-close">&times;</button>
      </div>
      <div class="detail-preview">
        <div class="detail-swatches">
          ${palette.colors.map((color, i) => {
            const hasFabric = palette.hasFabrics && palette.fabricDataUrls?.[i];
            const meta = palette.swatchMeta?.[i];
            return `
              <div class="detail-swatch" style="${hasFabric ? `background-image: url(${palette.fabricDataUrls![i]})` : `background-color: ${color}`}">
                ${meta?.fabricName ? `<span class="detail-swatch-info">${escapeHtml(meta.fabricName)}</span>` : ""}
              </div>
            `;
          }).join("")}
        </div>
      </div>
      <div class="detail-body">
        ${palette.description ? `<p class="detail-description">${escapeHtml(palette.description)}</p>` : ""}
        ${palette.swatchMeta?.some(m => m?.fabricName) ? `
          <div class="detail-fabric-list">
            <label style="font-size: 0.8rem; color: #8888aa; text-transform: uppercase; letter-spacing: 1px;">Fabric Details</label>
            ${palette.swatchMeta.map((meta, i) => {
              if (!meta?.fabricName) return "";
              const hasFabric = palette.hasFabrics && palette.fabricDataUrls?.[i];
              return `
                <div class="detail-fabric-item">
                  <div class="detail-fabric-swatch" style="${hasFabric ? `background-image: url(${palette.fabricDataUrls![i]})` : `background-color: ${palette.colors[i]}`}"></div>
                  <div class="detail-fabric-info">
                    <div class="detail-fabric-name">${escapeHtml(meta.fabricName)}</div>
                    ${meta.fabricBrand ? `<div class="detail-fabric-brand">${escapeHtml(meta.fabricBrand)}</div>` : ""}
                    ${meta.shopUrl ? `<a href="${escapeHtml(meta.shopUrl)}" target="_blank" rel="noopener" class="detail-fabric-link">View in shop →</a>` : ""}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        ` : ""}
      </div>
      <div class="detail-actions">
        <button class="btn btn-secondary" id="detail-like">❤️ Like</button>
        <button class="btn" id="detail-import">Import Palette</button>
        <button class="btn btn-danger" id="detail-delete" style="display: none;">🗑 Delete</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Check if palette already exists
  const alreadyImported = hasPaletteColors?.(palette.colors) ?? false;
  const importBtn = modal.querySelector("#detail-import") as HTMLButtonElement;
  if (alreadyImported && importBtn) {
    importBtn.textContent = "Already Imported";
    importBtn.disabled = true;
    importBtn.classList.add("btn-disabled");
  }

  // Show delete button if user owns this palette
  const currentUserId = getCurrentUserId?.();
  const deleteBtn = modal.querySelector("#detail-delete") as HTMLButtonElement;
  if (currentUserId && palette.userId === currentUserId && deleteBtn) {
    deleteBtn.style.display = "inline-block";
  }

  // Event handlers
  modal.querySelector(".detail-close")?.addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });

  modal.querySelector("#detail-like")?.addEventListener("click", async () => {
    try {
      const result = await likePalette(palette.id);
      palette.likes = result.likes;
      modal.querySelector(".detail-meta span:last-child")!.textContent = `❤️ ${result.likes}`;
    } catch (err) {
      console.error("Failed to like:", err);
    }
  });

  deleteBtn?.addEventListener("click", async () => {
    if (!confirm("Delete this palette? If designs use it, it will be anonymized instead.")) return;
    
    try {
      deleteBtn.disabled = true;
      deleteBtn.textContent = "Deleting...";
      
      const result = await deletePalette(palette.id);
      
      if (result.anonymized) {
        alert("Palette anonymized because designs are using it.");
      }
      
      modal.remove();
      loadContent(); // Refresh the list
    } catch (err) {
      alert("Failed to delete: " + (err as Error).message);
      deleteBtn.disabled = false;
      deleteBtn.textContent = "🗑 Delete";
    }
  });

  importBtn?.addEventListener("click", () => {
    if (alreadyImported) return;
    if (onImportPalette) {
      onImportPalette(palette);
    }
    modal.remove();
    // Switch back to editor
    switchToEditor();
  });
}

function openDesignDetail(design: SharedDesign) {
  // Similar to palette detail, will be enhanced in Phase 4
  const existing = document.getElementById("detail-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "detail-modal";
  modal.className = "detail-modal-overlay open";
  modal.innerHTML = `
    <div class="detail-modal">
      <div class="detail-header">
        <div>
          <h2>${escapeHtml(design.name)}</h2>
          <div class="detail-meta">
            ${design.userName ? `<span>by ${escapeHtml(design.userName)}</span>` : ""}
            <span>${formatTimeAgo(design.createdAt)}</span>
            <span>❤️ ${design.likes}</span>
          </div>
        </div>
        <button class="detail-close">&times;</button>
      </div>
      <div class="detail-preview">
        ${design.thumbnailUrl 
          ? `<img src="${design.thumbnailUrl}" alt="${escapeHtml(design.name)}" style="max-width: 100%; border-radius: 8px;" />`
          : `<div class="detail-swatches">
              ${(design.paletteColors || []).map(color => 
                `<div class="detail-swatch" style="background-color: ${color}"></div>`
              ).join("")}
            </div>`
        }
      </div>
      <div class="detail-body">
        ${design.description ? `<p class="detail-description">${escapeHtml(design.description)}</p>` : ""}
        ${design.paletteName ? `<p style="font-size: 0.85rem; color: #8888aa;">Uses palette: <strong>${escapeHtml(design.paletteName)}</strong></p>` : ""}
      </div>
      <div class="detail-actions">
        <button class="btn btn-secondary" id="detail-like">❤️ Like</button>
        <button class="btn" id="detail-import">Load Design</button>
        <button class="btn btn-danger" id="detail-delete" style="display: none;">🗑 Delete</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Show delete button if user owns this design
  const currentUserId = getCurrentUserId?.();
  const deleteBtn = modal.querySelector("#detail-delete") as HTMLButtonElement;
  if (currentUserId && design.userId === currentUserId && deleteBtn) {
    deleteBtn.style.display = "inline-block";
  }

  modal.querySelector(".detail-close")?.addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });

  modal.querySelector("#detail-like")?.addEventListener("click", async () => {
    try {
      const result = await likeDesign(design.id);
      design.likes = result.likes;
      modal.querySelector(".detail-meta span:last-child")!.textContent = `❤️ ${result.likes}`;
    } catch (err) {
      console.error("Failed to like:", err);
    }
  });

  deleteBtn?.addEventListener("click", async () => {
    if (!confirm("Delete this design? This cannot be undone.")) return;
    
    try {
      deleteBtn.disabled = true;
      deleteBtn.textContent = "Deleting...";
      
      await deleteDesign(design.id);
      
      modal.remove();
      loadContent(); // Refresh the list
    } catch (err) {
      alert("Failed to delete: " + (err as Error).message);
      deleteBtn.disabled = false;
      deleteBtn.textContent = "🗑 Delete";
    }
  });

  modal.querySelector("#detail-import")?.addEventListener("click", () => {
    if (onImportDesign) {
      onImportDesign(design);
    }
    modal.remove();
    switchToEditor();
  });
}

let switchToEditor: () => void = () => {};
let hasPaletteColors: ((colors: string[]) => boolean) | null = null;
let getCurrentUserId: (() => string | null) | null = null;

export function initCommunityView(options: {
  onSwitchToEditor: () => void;
  onImportPalette: (palette: SharedPalette) => void;
  onImportDesign: (design: SharedDesign) => void;
  hasPaletteColors: (colors: string[]) => boolean;
  getCurrentUserId: () => string | null;
}) {
  switchToEditor = options.onSwitchToEditor;
  onImportPalette = options.onImportPalette;
  onImportDesign = options.onImportDesign;
  hasPaletteColors = options.hasPaletteColors;
  getCurrentUserId = options.getCurrentUserId;

  // Filter buttons
  const filterBtns = document.querySelectorAll(".filter-btn");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const id = btn.id;
      if (id === "filter-all") state.filter = "all";
      else if (id === "filter-palettes") state.filter = "palettes";
      else if (id === "filter-designs") state.filter = "designs";

      loadContent();
    });
  });

  // Search
  const searchInput = $("community-search") as HTMLInputElement;
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  searchInput.addEventListener("input", () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.search = searchInput.value.trim();
      loadContent();
    }, 300);
  });

  // Load more
  $("community-load-more-btn").addEventListener("click", () => {
    loadContent(true);
  });

  // Share button
  $("community-share-btn").addEventListener("click", () => {
    // Switch to editor and open share modal
    // This will be wired up by main.ts
    switchToEditor();
  });
}

export function onCommunityEnter() {
  // Called when switching to community view
  loadContent();
}

export function onCommunityLeave() {
  // Called when leaving community view
  // Could clear state if needed
}
