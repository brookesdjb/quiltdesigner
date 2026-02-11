import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  exchangeGoogleCode,
  exchangeFacebookCode,
  upsertUser,
  createSession,
  setSessionCookie,
} from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const provider = req.query.provider as string;
  if (provider !== "google" && provider !== "facebook") {
    return res.status(400).json({ error: "Invalid provider" });
  }

  const code = req.query.code as string;
  const error = req.query.error as string;

  if (error) {
    console.error(`${provider} OAuth error:`, error);
    return res.redirect("/?auth_error=cancelled");
  }

  if (!code) {
    return res.redirect("/?auth_error=no_code");
  }

  try {
    const userInfo = provider === "google"
      ? await exchangeGoogleCode(code)
      : await exchangeFacebookCode(code);

    if (!userInfo) {
      return res.redirect("/?auth_error=exchange_failed");
    }

    const user = await upsertUser({
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      provider,
    });

    const sessionToken = await createSession(user.id);
    setSessionCookie(res, sessionToken);
    res.redirect("/?auth_success=1");
  } catch (err) {
    console.error(`${provider} auth callback error:`, err);
    res.redirect("/?auth_error=server_error");
  }
}
