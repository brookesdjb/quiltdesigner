import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis } from "../_lib/redis.js";
import { getSession } from "../_lib/auth.js";

// Key for user's custom palettes
const userPalettesKey = (userId: string) => `user:${userId}:palettes`;

export interface SavedPalette {
  name: string;
  colors: string[];
  swatches?: Array<string | { type: "fabric"; dataUrl: string; sourceUrl?: string }>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Require authentication
  const session = await getSession(req);
  if (!session) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const key = userPalettesKey(session.user.id);

  try {
    if (req.method === "GET") {
      const palettes = await redis.get<SavedPalette[]>(key);
      return res.status(200).json({ palettes: palettes || [] });
    }

    if (req.method === "POST") {
      const { palettes, merge } = req.body as { 
        palettes: SavedPalette[]; 
        merge?: boolean;
      };

      if (!Array.isArray(palettes)) {
        return res.status(400).json({ error: "Palettes must be an array" });
      }

      // Validate size (limit to prevent abuse)
      const jsonSize = JSON.stringify(palettes).length;
      if (jsonSize > 2_000_000) { // 2MB limit per user
        return res.status(400).json({ error: "Palette data too large (max 2MB)" });
      }

      let finalPalettes = palettes;

      // If merge mode, combine with existing
      if (merge) {
        const existing = await redis.get<SavedPalette[]>(key) || [];
        
        // Merge: add new palettes that don't exist by name
        const existingNames = new Set(existing.map(p => p.name.toLowerCase()));
        const newPalettes = palettes.filter(p => !existingNames.has(p.name.toLowerCase()));
        
        finalPalettes = [...existing, ...newPalettes];
      }

      await redis.set(key, finalPalettes);
      
      return res.status(200).json({ 
        palettes: finalPalettes,
        merged: merge ? palettes.length : 0,
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("User palettes error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
