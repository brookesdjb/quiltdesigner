// API client for shared palettes

export interface SharedPalette {
  id: string;
  name: string;
  colors: string[];
  hasFabrics: boolean;
  fabricDataUrls?: string[];
  createdAt: number;
  likes: number;
}

export interface PaletteListResponse {
  palettes: SharedPalette[];
  cursor?: string;
  hasMore: boolean;
}

const API_BASE = "/api";

export async function fetchSharedPalettes(cursor?: string): Promise<PaletteListResponse> {
  const url = new URL(`${API_BASE}/palettes`, window.location.origin);
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }
  
  const res = await fetch(url.toString());
  if (!res.ok) {
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
  fabricDataUrls?: string[]
): Promise<SharedPalette> {
  const res = await fetch(`${API_BASE}/palettes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, colors, fabricDataUrls }),
  });
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to share palette");
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

// Format relative time
export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
