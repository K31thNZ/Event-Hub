// server/auth-client.ts
// Auth helpers that proxy identity checks to the meh-auth service.
//
// Performance fix: results are cached in a short-lived in-memory Map
// keyed by the request's session cookie. This cuts the number of
// cross-service HTTP calls from one-per-protected-route to at most
// one per user per TTL window (30 s), while still respecting logout:
// the cache entry for a cookie is dropped the moment meh-auth returns
// a non-200 (expired session, logged-out user, etc.).

import type { Request, Response, NextFunction } from "express";

// MEHUser — shape returned by the external meh-auth service
export interface MEHUser {
  id: number | string;
  username?: string;
  role: string;
  displayName?: string;
  avatarUrl?: string;
  email?: string;
  isExpatMember?: boolean;
  telegramId?: string | number | null;
  [key: string]: unknown;
}

declare global {
  namespace Express {
    interface Request {
      user?: MEHUser;
    }
  }
}

const AUTH_URL = process.env.AUTH_SERVICE_URL ?? "https://meh-auth.onrender.com";

// ── In-memory session cache ───────────────────────────────────────────────
const CACHE_TTL_MS = 30_000; // 30 seconds

interface CacheEntry {
  user:      MEHUser | null;
  expiresAt: number;
}

const sessionCache = new Map<string, CacheEntry>();

// Prune stale entries every 5 minutes so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of sessionCache) {
    if (entry.expiresAt < now) sessionCache.delete(key);
  }
}, 5 * 60_000).unref(); // .unref() so this timer doesn't keep the process alive

// Extract the session cookie string from the request — used as cache key.
// We use the full cookie header so different users on the same machine
// (e.g. shared IP) are never confused.
function sessionKey(req: Request): string {
  return req.headers.cookie ?? "__no_cookie__";
}

// ── Core identity fetch (with cache) ─────────────────────────────────────
export async function getUser(req: Request): Promise<MEHUser | null> {
  const key = sessionKey(req);
  const now = Date.now();

  const cached = sessionCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.user;
  }

  let user: MEHUser | null = null;
  try {
    const res = await fetch(`${AUTH_URL}/api/user`, {
      headers: { cookie: req.headers.cookie ?? "" },
    });
    if (res.ok) {
      user = await res.json();
    } else {
      // Non-200 means the session is invalid/expired — evict from cache.
      sessionCache.delete(key);
      return null;
    }
  } catch {
    // Network error — don't cache, fail open with null.
    return null;
  }

  sessionCache.set(key, { user, expiresAt: now + CACHE_TTL_MS });
  return user;
}

// ── Middleware ────────────────────────────────────────────────────────────
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  req.user = user;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = await getUser(req);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admins only" });
  req.user = user;
  next();
}
