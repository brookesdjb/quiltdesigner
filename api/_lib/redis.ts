import { Redis } from "@upstash/redis";

// Initialize Redis client from environment variables
// Uses Vercel KV naming convention
export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// Key prefixes
export const KEYS = {
  palette: (id: string) => `palette:${id}`,
  paletteList: "palettes:list",  // Sorted set by timestamp
  paletteLikes: (id: string) => `palette:${id}:likes`,
};
