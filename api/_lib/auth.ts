import { redis } from "./redis.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export interface User {
  id: string;
  email: string;
  name: string;           // Full name from OAuth
  displayName?: string;   // User-chosen nickname (defaults to name)
  picture?: string;
  provider: "google";
  createdAt: number;
}

export interface Session {
  userId: string;
  createdAt: number;
  expiresAt: number;
}

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const COOKIE_NAME = "qd_session";

// Key prefixes
export const AUTH_KEYS = {
  session: (token: string) => `session:${token}`,
  user: (id: string) => `user:${id}`,
  userByEmail: (email: string) => `user:email:${email}`,
};

// Generate a secure random token
function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

// Create or update user from OAuth data
export async function upsertUser(data: {
  email: string;
  name: string;
  picture?: string;
  provider: "google";
}): Promise<User> {
  // Check if user exists
  const existingId = await redis.get<string>(AUTH_KEYS.userByEmail(data.email));
  
  if (existingId) {
    // Update existing user
    const user = await redis.get<User>(AUTH_KEYS.user(existingId));
    if (user) {
      const updated = { ...user, ...data };
      await redis.set(AUTH_KEYS.user(existingId), updated);
      return updated;
    }
  }
  
  // Create new user
  const id = generateToken();
  const user: User = {
    id,
    email: data.email,
    name: data.name,
    picture: data.picture,
    provider: data.provider,
    createdAt: Date.now(),
  };
  
  await redis.set(AUTH_KEYS.user(id), user);
  await redis.set(AUTH_KEYS.userByEmail(data.email), id);
  
  return user;
}

// Create a session for a user
export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const session: Session = {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };
  
  await redis.set(AUTH_KEYS.session(token), session, {
    ex: Math.floor(SESSION_DURATION_MS / 1000),
  });
  
  return token;
}

// Get session from request cookie
export async function getSession(req: VercelRequest): Promise<{ session: Session; user: User } | null> {
  const cookies = req.headers.cookie || "";
  const match = cookies.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  
  if (!match) return null;
  
  const token = match[1];
  const session = await redis.get<Session>(AUTH_KEYS.session(token));
  
  if (!session || session.expiresAt < Date.now()) {
    return null;
  }
  
  const user = await redis.get<User>(AUTH_KEYS.user(session.userId));
  if (!user) return null;
  
  return { session, user };
}

// Set session cookie on response
export function setSessionCookie(res: VercelResponse, token: string): void {
  const maxAge = Math.floor(SESSION_DURATION_MS / 1000);
  const secure = process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`
  );
}

// Clear session cookie
export function clearSessionCookie(res: VercelResponse): void {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

// Delete session from Redis
export async function deleteSession(req: VercelRequest): Promise<void> {
  const cookies = req.headers.cookie || "";
  const match = cookies.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  
  if (match) {
    await redis.del(AUTH_KEYS.session(match[1]));
  }
}

// Get the base URL for redirects
function getBaseUrl(): string {
  // Use explicit APP_URL if set, otherwise try VERCEL_URL, fallback to localhost
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, ""); // Remove trailing slash
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

// Google OAuth helpers
export function getGoogleAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${getBaseUrl()}/api/auth/callback/google`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(code: string): Promise<{
  email: string;
  name: string;
  picture?: string;
} | null> {
  const redirectUri = `${getBaseUrl()}/api/auth/callback/google`;
  
  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  
  if (!tokenRes.ok) {
    console.error("Token exchange failed:", await tokenRes.text());
    return null;
  }
  
  const tokens = await tokenRes.json();
  
  // Get user info
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  
  if (!userRes.ok) {
    console.error("User info failed:", await userRes.text());
    return null;
  }
  
  const userInfo = await userRes.json();
  
  return {
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
  };
}
