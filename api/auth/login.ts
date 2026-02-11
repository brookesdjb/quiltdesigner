import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getGoogleAuthUrl, getFacebookAuthUrl } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const provider = req.query.provider as string;

  if (provider === "google") {
    return res.redirect(302, getGoogleAuthUrl());
  }

  if (provider === "facebook") {
    return res.redirect(302, getFacebookAuthUrl());
  }

  return res.status(400).json({ error: "Invalid provider. Use ?provider=google or ?provider=facebook" });
}
