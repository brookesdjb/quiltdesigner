import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis, KEYS } from "../_lib/redis.js";
import type { SharedPalette } from "../_lib/types.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { id } = req.query;
  
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid palette ID" });
  }

  try {
    if (req.method === "GET") {
      const palette = await redis.get<SharedPalette>(KEYS.palette(id));
      
      if (!palette) {
        return res.status(404).json({ error: "Palette not found" });
      }

      return res.status(200).json(palette);
    }

    if (req.method === "POST") {
      // Like endpoint: POST /api/palettes/[id]?action=like
      const action = req.query.action;
      
      if (action === "like") {
        const palette = await redis.get<SharedPalette>(KEYS.palette(id));
        
        if (!palette) {
          return res.status(404).json({ error: "Palette not found" });
        }

        // Increment likes
        palette.likes += 1;
        await redis.set(KEYS.palette(id), palette);

        return res.status(200).json({ likes: palette.likes });
      }

      return res.status(400).json({ error: "Unknown action" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
