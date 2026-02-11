import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis } from "../_lib/redis.js";
import { getSession, deleteSession, clearSessionCookie, AUTH_KEYS } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Require authentication
    const session = await getSession(req);
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { user } = session;

    // Delete user's shared palettes (anonymize if designs use them)
    const paletteIds = await redis.zrange("palettes:list", 0, -1) as string[];
    for (const paletteId of paletteIds) {
      const palette = await redis.get<{ userId?: string }>(`palette:${paletteId}`);
      if (palette?.userId === user.id) {
        // Check if designs use this palette
        const designIds = await redis.smembers(`palette:${paletteId}:designs`) as string[];
        if (designIds.length > 0) {
          // Anonymize
          await redis.set(`palette:${paletteId}`, {
            ...palette,
            name: "Removed by user",
            description: undefined,
            userId: undefined,
            userName: undefined,
            swatchMeta: undefined,
            tags: undefined,
          });
        } else {
          // Delete
          await redis.del(`palette:${paletteId}`);
          await redis.zrem("palettes:list", paletteId);
        }
      }
    }

    // Delete user's shared designs
    const designIds = await redis.zrange("designs:list", 0, -1) as string[];
    for (const designId of designIds) {
      const design = await redis.get<{ userId?: string; paletteId?: string }>(`design:${designId}`);
      if (design?.userId === user.id) {
        await redis.del(`design:${designId}`);
        await redis.zrem("designs:list", designId);
        if (design.paletteId) {
          await redis.srem(`palette:${design.paletteId}:designs`, designId);
        }
      }
    }

    // Delete user's saved palettes
    await redis.del(`user:${user.id}:palettes`);

    // Delete user record
    await redis.del(AUTH_KEYS.user(user.id));
    await redis.del(AUTH_KEYS.userByEmail(user.email));

    // Delete session
    await deleteSession(req);
    clearSessionCookie(res);

    return res.status(200).json({ success: true, message: "Account deleted" });
  } catch (error) {
    console.error("Delete account error:", error);
    return res.status(500).json({ error: "Failed to delete account" });
  }
}
