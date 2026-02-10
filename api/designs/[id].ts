import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis, KEYS } from "../_lib/redis.js";
import type { SharedDesign } from "../_lib/types.js";
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
    return res.status(400).json({ error: "Invalid design ID" });
  }

  try {
    if (req.method === "GET") {
      const design = await redis.get<SharedDesign>(KEYS.design(id));
      
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }

      return res.status(200).json(design);
    }

    if (req.method === "POST") {
      // Like endpoint: POST /api/designs/[id]?action=like
      const action = req.query.action;
      
      if (action === "like") {
        const design = await redis.get<SharedDesign>(KEYS.design(id));
        
        if (!design) {
          return res.status(404).json({ error: "Design not found" });
        }

        // Increment likes
        design.likes += 1;
        await redis.set(KEYS.design(id), design);

        return res.status(200).json({ likes: design.likes });
      }

      return res.status(400).json({ error: "Unknown action" });
    }

    if (req.method === "DELETE") {
      // Require authentication
      const session = await getSession(req);
      if (!session) {
        return res.status(401).json({ error: "Please sign in to delete designs" });
      }
      
      const design = await redis.get<SharedDesign>(KEYS.design(id));
      
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      
      // Check ownership
      if (design.userId !== session.user.id) {
        return res.status(403).json({ error: "You can only delete your own designs" });
      }
      
      // Remove from all indexes
      await redis.del(KEYS.design(id));
      await redis.zrem(KEYS.designList, id);
      
      // Remove from palette's design set if it has a paletteId
      if (design.paletteId) {
        await redis.srem(KEYS.designsByPalette(design.paletteId), id);
      }
      
      return res.status(200).json({ deleted: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
