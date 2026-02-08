// API client for shared palettes and auth

export interface User {
  id: string;
  name: string;
  email: string;
  picture?: string;
}

export interface SharedPalette {
  id: string;
  name: string;
  colors: string[];
  hasFabrics: boolean;
  fabricDataUrls?: string[];
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
  fabricDataUrls?: string[]
): Promise<SharedPalette> {
  const res = await fetch(`${API_BASE}/palettes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, colors, fabricDataUrls }),
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
