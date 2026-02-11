import type { VercelRequest, VercelResponse } from "@vercel/node";
import { exchangeFacebookCode, upsertUser, createSession, setSessionCookie } from "../../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const code = req.query.code as string;
  const error = req.query.error as string;

  if (error) {
    console.error("Facebook OAuth error:", error);
    return res.redirect("/?auth_error=cancelled");
  }

  if (!code) {
    return res.redirect("/?auth_error=no_code");
  }

  try {
    // Exchange code for user info
    const facebookUser = await exchangeFacebookCode(code);
    
    if (!facebookUser) {
      return res.redirect("/?auth_error=exchange_failed");
    }

    // Create or update user
    const user = await upsertUser({
      email: facebookUser.email,
      name: facebookUser.name,
      picture: facebookUser.picture,
      provider: "facebook",
    });

    // Create session
    const sessionToken = await createSession(user.id);
    
    // Set cookie and redirect
    setSessionCookie(res, sessionToken);
    res.redirect("/?auth_success=1");
    
  } catch (err) {
    console.error("Facebook auth callback error:", err);
    res.redirect("/?auth_error=server_error");
  }
}
