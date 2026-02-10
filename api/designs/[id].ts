import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis, KEYS } from "../_lib/redis.js";
import type { SharedDesign } from "../_lib/types.js";

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

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
