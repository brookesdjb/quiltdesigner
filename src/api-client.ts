// API client for shared palettes, designs, and auth

export interface User {
  id: string;
  name: string;
  displayName: string;
  email: string;
  picture?: string;
}

// Metadata for a single swatch (fabric info)
export interface SwatchMeta {
  fabricName?: string;    // e.g., "Kona Cotton - Nautical"
  fabricBrand?: string;   // e.g., "Robert Kaufman"
  shopUrl?: string;       // Link to purchase
  notes?: string;         // User notes about this fabric
}

export interface SharedPalette {
  id: string;
  name: string;
  description?: string;
  colors: string[];
  hasFabrics: boolean;
  fabricDataUrls?: string[];
  swatchMeta?: SwatchMeta[];
  tags?: string[];
  createdAt: number;
  likes: number;
  userId?: string;
  userName?: string;
}

export interface PaletteListResponse {
  palettes: SharedPalette[];
  cursor?: string;
  hasMore: boolean;
}

// Shared design types
export interface SharedDesign {
  id: string;
  name: string;
  description?: string;
  paletteId: string;
  paletteName?: string;
  paletteColors?: string[];
  designData: string;
  thumbnailUrl?: string;
  tags?: string[];
  createdAt: number;
  likes: number;
  userId?: string;
  userName?: string;
}

export interface DesignListResponse {
  designs: SharedDesign[];
  cursor?: string;
  hasMore: boolean;
}

const API_BASE = "/api";

export async function fetchSharedPalettes(cursor?: string, search?: string): Promise<PaletteListResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (search) params.set("search", search);
  const queryString = params.toString();
  
  const res = await fetch(`${API_BASE}/palettes${queryString ? `?${queryString}` : ""}`);
  
  if (!res.ok) {
    const text = await res.text();
    console.error("Fetch palettes error:", res.status, text);
    throw new Error("Failed to fetch palettes");
  }
  return res.json();
}

export async function fetchPalette(id: string): Promise<SharedPalette> {
  const res = await fetch(`${API_BASE}/palettes/${id}`);
  if (!res.ok) {
    throw new Error("Failed to fetch palette");
  }
  return res.json();
}

export async function sharePalette(
  name: string, 
  colors: string[], 
  fabricDataUrls?: string[],
  options?: {
    description?: string;
    swatchMeta?: SwatchMeta[];
    tags?: string[];
  }
): Promise<SharedPalette> {
  const res = await fetch(`${API_BASE}/palettes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      name, 
      colors, 
      fabricDataUrls,
      description: options?.description,
      swatchMeta: options?.swatchMeta,
      tags: options?.tags,
    }),
  });
  
  if (!res.ok) {
    const text = await res.text();
    console.error("Share palette error:", res.status, text);
    try {
      const error = JSON.parse(text);
      throw new Error(error.error || "Failed to share palette");
    } catch {
      throw new Error(`Failed to share palette: ${res.status}`);
    }
  }
  return res.json();
}

export async function likePalette(id: string): Promise<{ likes: number }> {
  const res = await fetch(`${API_BASE}/palettes/${id}?action=like`, {
    method: "POST",
  });
  
  if (!res.ok) {
    throw new Error("Failed to like palette");
  }
  return res.json();
}

// --- Design API ---

export async function fetchSharedDesigns(
  cursor?: string, 
  search?: string,
  paletteId?: string
): Promise<DesignListResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (search) params.set("search", search);
  if (paletteId) params.set("paletteId", paletteId);
  const queryString = params.toString();
  
  const res = await fetch(`${API_BASE}/designs${queryString ? `?${queryString}` : ""}`);
  
  if (!res.ok) {
    const text = await res.text();
    console.error("Fetch designs error:", res.status, text);
    throw new Error("Failed to fetch designs");
  }
  return res.json();
}

export async function fetchDesign(id: string): Promise<SharedDesign> {
  const res = await fetch(`${API_BASE}/designs/${id}`);
  if (!res.ok) {
    throw new Error("Failed to fetch design");
  }
  return res.json();
}

export async function shareDesign(data: {
  name: string;
  paletteId: string;
  designData: string;
  description?: string;
  thumbnailUrl?: string;
  tags?: string[];
}): Promise<SharedDesign> {
  const res = await fetch(`${API_BASE}/designs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const text = await res.text();
    console.error("Share design error:", res.status, text);
    try {
      const error = JSON.parse(text);
      throw new Error(error.error || "Failed to share design");
    } catch {
      throw new Error(`Failed to share design: ${res.status}`);
    }
  }
  return res.json();
}

export async function likeDesign(id: string): Promise<{ likes: number }> {
  const res = await fetch(`${API_BASE}/designs/${id}?action=like`, {
    method: "POST",
  });
  
  if (!res.ok) {
    throw new Error("Failed to like design");
  }
  return res.json();
}

// Format relative time
export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// Auth functions
export async function getCurrentUser(): Promise<User | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  } catch {
    return null;
  }
}

export function getLoginUrl(): string {
  return `${API_BASE}/auth/login/google`;
}

export function getLogoutUrl(): string {
  return `${API_BASE}/auth/logout`;
}

// User palettes (cloud sync)
export interface SavedPalette {
  name: string;
  colors: string[];
  swatches?: Array<string | { type: "fabric"; dataUrl: string; sourceUrl?: string }>;
}

export async function getUserPalettes(): Promise<SavedPalette[]> {
  const res = await fetch(`${API_BASE}/user/palettes`, {
    credentials: "include",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.palettes || [];
}

export async function saveUserPalettes(
  palettes: SavedPalette[], 
  merge = false
): Promise<SavedPalette[]> {
  const res = await fetch(`${API_BASE}/user/palettes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ palettes, merge }),
  });
  if (!res.ok) {
    throw new Error("Failed to save palettes");
  }
  const data = await res.json();
  return data.palettes;
}

export async function updateDisplayName(displayName: string): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ displayName }),
  });
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to update profile");
  }
  
  const data = await res.json();
  return data.user;
}
