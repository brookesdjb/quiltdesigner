import { Redis } from "@upstash/redis";

// Initialize Redis client from environment variables
// Uses Vercel KV naming convention
export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// Key prefixes
export const KEYS = {
  // Palettes
  palette: (id: string) => `palette:${id}`,
  paletteList: "palettes:list",  // Sorted set by timestamp
  paletteLikes: (id: string) => `palette:${id}:likes`,
  paletteByHash: (hash: string) => `palette:hash:${hash}`, // Deduplication: color hash → palette ID
  
  // Designs
  design: (id: string) => `design:${id}`,
  designList: "designs:list",    // Sorted set by timestamp
  designLikes: (id: string) => `design:${id}:likes`,
  designsByPalette: (paletteId: string) => `palette:${paletteId}:designs`, // Set of design IDs using this palette
};
