import type { VercelRequest, VercelResponse } from "@vercel/node";
import { deleteSession, clearSessionCookie } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await deleteSession(req);
    clearSessionCookie(res);
    
    // If GET request (link click), redirect to home
    if (req.method === "GET") {
      return res.redirect("/");
    }
    
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
