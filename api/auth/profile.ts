import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSession, AUTH_KEYS } from "../_lib/auth.js";
import { redis } from "../_lib/redis.js";

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

  if (req.method === "GET") {
    return res.status(200).json({
      user: {
        id: session.user.id,
        name: session.user.name,
        displayName: session.user.displayName || session.user.name,
        email: session.user.email,
        picture: session.user.picture,
      },
    });
  }

  if (req.method === "POST") {
    const { displayName } = req.body || {};

    if (!displayName || typeof displayName !== "string") {
      return res.status(400).json({ error: "Display name is required" });
    }

    const trimmed = displayName.trim();
    
    if (trimmed.length < 2 || trimmed.length > 30) {
      return res.status(400).json({ error: "Display name must be 2-30 characters" });
    }

    // Update user
    const updatedUser = {
      ...session.user,
      displayName: trimmed,
    };
    
    await redis.set(AUTH_KEYS.user(session.user.id), updatedUser);

    return res.status(200).json({
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        displayName: updatedUser.displayName,
        email: updatedUser.email,
        picture: updatedUser.picture,
      },
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
