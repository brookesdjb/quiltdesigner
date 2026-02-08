import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis, KEYS } from "../_lib/redis.js";
import type { SharedPalette, CreatePaletteRequest, PaletteListResponse } from "../_lib/types.js";
import { getSession } from "../_lib/auth.js";

// Generate a short unique ID
function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method === "GET") {
      // List palettes (newest first)
      const limit = Math.min(Number(req.query.limit) || 20, 50);
      const cursor = Number(req.query.cursor) || Date.now();
      const search = (req.query.search as string || "").toLowerCase().trim();
      
      // Get palette IDs from sorted set (by timestamp, descending)
      // For search, we need to fetch more and filter
      const fetchLimit = search ? 100 : limit + 1;
      const ids = await redis.zrange(KEYS.paletteList, cursor, 0, {
        byScore: true,
        rev: true,
        count: fetchLimit,
      });

      // Fetch palette data
      let palettes: SharedPalette[] = [];
      for (const id of ids as string[]) {
        const palette = await redis.get<SharedPalette>(KEYS.palette(id));
        if (palette) {
          // Filter by search term if provided
          if (search) {
            if (palette.name.toLowerCase().includes(search)) {
              palettes.push(palette);
            }
          } else {
            palettes.push(palette);
          }
        }
        // Stop if we have enough for non-search queries
        if (!search && palettes.length > limit) break;
      }

      const hasMore = palettes.length > limit;
      palettes = palettes.slice(0, limit);

      const response: PaletteListResponse = {
        palettes,
        cursor: hasMore && palettes.length > 0 
          ? String(palettes[palettes.length - 1].createdAt - 1) 
          : undefined,
        hasMore,
      };

      return res.status(200).json(response);
    }

    if (req.method === "POST") {
      // Require authentication
      const session = await getSession(req);
      if (!session) {
        return res.status(401).json({ error: "Please sign in to share palettes" });
      }
      
      const body = req.body as CreatePaletteRequest;
      
      // Validate
      if (!body.name || !body.colors || body.colors.length === 0) {
        return res.status(400).json({ error: "Name and colors are required" });
      }
      
      if (body.name.length > 50) {
        return res.status(400).json({ error: "Name too long (max 50 chars)" });
      }
      
      if (body.colors.length > 12) {
        return res.status(400).json({ error: "Too many colors (max 12)" });
      }

      // Check fabric data size (limit to ~500KB total to avoid Redis limits)
      if (body.fabricDataUrls) {
        const totalSize = body.fabricDataUrls.reduce((sum, url) => sum + url.length, 0);
        if (totalSize > 500000) {
          return res.status(400).json({ error: "Fabric data too large" });
        }
      }

      const id = generateId();
      const now = Date.now();
      
      const palette: SharedPalette = {
        id,
        name: body.name.trim(),
        colors: body.colors,
        userId: session.user.id,
        userName: session.user.name,
        hasFabrics: !!body.fabricDataUrls && body.fabricDataUrls.length > 0,
        fabricDataUrls: body.fabricDataUrls,
        createdAt: now,
        likes: 0,
      };

      // Store palette and add to sorted set
      await redis.set(KEYS.palette(id), palette);
      await redis.zadd(KEYS.paletteList, { score: now, member: id });

      return res.status(201).json(palette);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
