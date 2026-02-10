import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis, KEYS } from "../_lib/redis.js";
import type { SharedPalette } from "../_lib/types.js";
import { getSession } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
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

    if (req.method === "DELETE") {
      // Require authentication
      const session = await getSession(req);
      if (!session) {
        return res.status(401).json({ error: "Please sign in to delete palettes" });
      }
      
      const palette = await redis.get<SharedPalette>(KEYS.palette(id));
      
      if (!palette) {
        return res.status(404).json({ error: "Palette not found" });
      }
      
      // Check ownership
      if (palette.userId !== session.user.id) {
        return res.status(403).json({ error: "You can only delete your own palettes" });
      }
      
      // Check if any designs use this palette
      const designIds = await redis.smembers(KEYS.designsByPalette(id)) as string[];
      
      if (designIds.length > 0) {
        // Anonymize instead of delete - designs depend on this palette
        const anonymized: SharedPalette = {
          ...palette,
          name: "Removed by user",
          description: undefined,
          userId: undefined,
          userName: undefined,
          swatchMeta: undefined,
          tags: undefined,
        };
        await redis.set(KEYS.palette(id), anonymized);
        
        return res.status(200).json({ 
          deleted: false, 
          anonymized: true,
          message: "Palette anonymized because designs are using it" 
        });
      }
      
      // No designs use it - full delete
      await redis.del(KEYS.palette(id));
      await redis.zrem(KEYS.paletteList, id);
      
      // Also remove the hash lookup if it exists
      const colorHash = palette.colors.map(c => c.toUpperCase().trim()).sort().join("|");
      await redis.del(KEYS.paletteByHash(colorHash));
      
      return res.status(200).json({ deleted: true, anonymized: false });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
