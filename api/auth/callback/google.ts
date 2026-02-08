import type { VercelRequest, VercelResponse } from "@vercel/node";
import { exchangeGoogleCode, upsertUser, createSession, setSessionCookie } from "../../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const code = req.query.code as string;
  const error = req.query.error as string;

  if (error) {
    console.error("OAuth error:", error);
    return res.redirect("/?auth_error=cancelled");
  }

  if (!code) {
    return res.redirect("/?auth_error=no_code");
  }

  try {
    // Exchange code for user info
    const googleUser = await exchangeGoogleCode(code);
    
    if (!googleUser) {
      return res.redirect("/?auth_error=exchange_failed");
    }

    // Create or update user
    const user = await upsertUser({
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
      provider: "google",
    });

    // Create session
    const sessionToken = await createSession(user.id);
    
    // Set cookie and redirect
    setSessionCookie(res, sessionToken);
    res.redirect("/?auth_success=1");
    
  } catch (err) {
    console.error("Auth callback error:", err);
    res.redirect("/?auth_error=server_error");
  }
}
