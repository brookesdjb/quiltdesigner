import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFacebookAuthUrl } from "../../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authUrl = getFacebookAuthUrl();
  res.redirect(302, authUrl);
}
