// Shared palette types for API

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
  description?: string;   // Optional palette description
  colors: string[];       // Hex colors (or placeholder for fabrics)
  hasFabrics: boolean;
  fabricDataUrls?: string[];  // Base64 fabric images (only for fabric palettes)
  swatchMeta?: SwatchMeta[];  // Metadata per swatch (fabric names, shop links, etc.)
  tags?: string[];        // Searchable tags
  createdAt: number;
  likes: number;
  userId?: string;        // Creator's user ID
  userName?: string;      // Creator's display name
}

export interface CreatePaletteRequest {
  name: string;
  description?: string;
  colors: string[];
  fabricDataUrls?: string[];
  swatchMeta?: SwatchMeta[];
  tags?: string[];
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
  paletteId: string;      // Required: links to a shared palette
  paletteName?: string;   // Denormalized for display
  paletteColors?: string[]; // Denormalized for card preview
  designData: string;     // JSON-encoded design state
  thumbnailUrl?: string;  // Base64 PNG thumbnail for cards
  tags?: string[];
  createdAt: number;
  likes: number;
  userId?: string;
  userName?: string;
}

export interface CreateDesignRequest {
  name: string;
  description?: string;
  paletteId: string;
  designData: string;     // JSON-encoded design state
  thumbnailUrl?: string;  // Base64 PNG thumbnail
  tags?: string[];
}

export interface DesignListResponse {
  designs: SharedDesign[];
  cursor?: string;
  hasMore: boolean;
}

// Combined response for community browse (palettes + designs)
export interface CommunityListResponse {
  items: Array<
    | { type: "palette"; data: SharedPalette }
    | { type: "design"; data: SharedDesign }
  >;
  cursor?: string;
  hasMore: boolean;
}
