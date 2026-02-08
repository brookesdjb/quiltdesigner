import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSession } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getSession(req);
    
    if (!session) {
      return res.status(200).json({ user: null });
    }

    return res.status(200).json({
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        picture: session.user.picture,
      },
    });
  } catch (err) {
    console.error("Auth me error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
