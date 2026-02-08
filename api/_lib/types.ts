// Shared palette types for API
export interface SharedPalette {
  id: string;
  name: string;
  colors: string[];  // Hex colors
  hasFabrics: boolean;
  fabricDataUrls?: string[];  // Base64 fabric images (only for fabric palettes)
  createdAt: number;
  likes: number;
  userId?: string;  // Creator's user ID
  userName?: string;  // Creator's display name
}

export interface CreatePaletteRequest {
  name: string;
  colors: string[];
  fabricDataUrls?: string[];
}

export interface PaletteListResponse {
  palettes: SharedPalette[];
  cursor?: string;
  hasMore: boolean;
}
