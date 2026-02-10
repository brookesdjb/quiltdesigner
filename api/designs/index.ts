import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis, KEYS } from "../_lib/redis.js";
import type { SharedDesign, CreateDesignRequest, DesignListResponse, SharedPalette } from "../_lib/types.js";
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
      // List designs (newest first)
      const limit = Math.min(Number(req.query.limit) || 20, 50);
      const cursor = Number(req.query.cursor) || Date.now();
      const search = (req.query.search as string || "").toLowerCase().trim();
      const paletteId = req.query.paletteId as string | undefined;
      
      let ids: string[];
      
      if (paletteId) {
        // Get designs for a specific palette
        ids = await redis.smembers(KEYS.designsByPalette(paletteId)) as string[];
        // Sort by fetching and checking createdAt
        const designs: SharedDesign[] = [];
        for (const id of ids) {
          const design = await redis.get<SharedDesign>(KEYS.design(id));
          if (design && design.createdAt <= cursor) {
            designs.push(design);
          }
        }
        designs.sort((a, b) => b.createdAt - a.createdAt);
        
        const hasMore = designs.length > limit;
        const result = designs.slice(0, limit);
        
        const response: DesignListResponse = {
          designs: result,
          cursor: hasMore && result.length > 0 
            ? String(result[result.length - 1].createdAt - 1) 
            : undefined,
          hasMore,
        };
        return res.status(200).json(response);
      }
      
      // Get design IDs from sorted set (by timestamp, descending)
      const fetchLimit = search ? 100 : limit + 1;
      ids = await redis.zrange(KEYS.designList, cursor, 0, {
        byScore: true,
        rev: true,
        count: fetchLimit,
      }) as string[];

      // Fetch design data
      let designs: SharedDesign[] = [];
      for (const id of ids) {
        const design = await redis.get<SharedDesign>(KEYS.design(id));
        if (design) {
          // Filter by search term if provided
          if (search) {
            const searchable = [
              design.name,
              design.description,
              design.userName,
              design.paletteName,
              ...(design.tags || []),
            ].filter(Boolean).join(" ").toLowerCase();
            
            if (searchable.includes(search)) {
              designs.push(design);
            }
          } else {
            designs.push(design);
          }
        }
        if (!search && designs.length > limit) break;
      }

      const hasMore = designs.length > limit;
      designs = designs.slice(0, limit);

      const response: DesignListResponse = {
        designs,
        cursor: hasMore && designs.length > 0 
          ? String(designs[designs.length - 1].createdAt - 1) 
          : undefined,
        hasMore,
      };

      return res.status(200).json(response);
    }

    if (req.method === "POST") {
      // Require authentication
      const session = await getSession(req);
      if (!session) {
        return res.status(401).json({ error: "Please sign in to share designs" });
      }
      
      const body = req.body as CreateDesignRequest;
      
      // Validate - need either paletteId OR defaultPaletteName
      if (!body.name || !body.designData) {
        return res.status(400).json({ error: "Name and designData are required" });
      }
      
      if (!body.paletteId && !body.defaultPaletteName) {
        return res.status(400).json({ error: "Either paletteId or defaultPaletteName is required" });
      }
      
      if (body.name.length > 100) {
        return res.status(400).json({ error: "Name too long (max 100 chars)" });
      }
      
      // Check design data size (limit to ~1MB to avoid abuse)
      if (body.designData.length > 1_000_000) {
        return res.status(400).json({ error: "Design data too large" });
      }
      
      // Check thumbnail size (limit to ~500KB)
      if (body.thumbnailUrl && body.thumbnailUrl.length > 500_000) {
        return res.status(400).json({ error: "Thumbnail too large" });
      }

      let paletteName: string;
      let paletteColors: string[];
      let paletteId: string | undefined;
      
      if (body.paletteId) {
        // Verify the shared palette exists
        const palette = await redis.get<SharedPalette>(KEYS.palette(body.paletteId));
        if (!palette) {
          return res.status(400).json({ error: "Palette not found. You must link to a shared palette." });
        }
        paletteName = palette.name;
        paletteColors = palette.colors.slice(0, 6);
        paletteId = body.paletteId;
      } else {
        // Using a default/built-in palette - extract colors from designData
        paletteName = body.defaultPaletteName!;
        try {
          const designState = JSON.parse(body.designData);
          // Colors should be included in the thumbnail or we trust the client
          paletteColors = designState.paletteColors || [];
        } catch {
          paletteColors = [];
        }
      }

      const id = generateId();
      const now = Date.now();
      
      const design: SharedDesign = {
        id,
        name: body.name.trim(),
        description: body.description?.trim(),
        paletteId,
        defaultPaletteName: body.defaultPaletteName,
        paletteName,
        paletteColors,
        designData: body.designData,
        thumbnailUrl: body.thumbnailUrl,
        tags: body.tags?.map(t => t.trim().toLowerCase()).filter(Boolean),
        userId: session.user.id,
        userName: session.user.displayName || session.user.name,
        createdAt: now,
        likes: 0,
      };

      // Store design and add to sorted set
      await redis.set(KEYS.design(id), design);
      await redis.zadd(KEYS.designList, { score: now, member: id });
      
      // Link to palette if using a shared one
      if (paletteId) {
        await redis.sadd(KEYS.designsByPalette(paletteId), id);
      }

      return res.status(201).json(design);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
