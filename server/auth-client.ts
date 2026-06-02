import type { Request, Response, NextFunction } from "express";
import { MEHUser } from "@shared/schema";

// Extend Express Request interface to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: MEHUser;
    }
  }
}

const AUTH_URL = process.env.AUTH_SERVICE_URL ?? "https://meh-auth.onrender.com";

export async function getUser(req: Request): Promise<MEHUser | null> {
  try {
    const res = await fetch(`${AUTH_URL}/api/user`, {
      headers: { cookie: req.headers.cookie ?? "" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  req.user = user;  // ✅ Type-safe - Express.Request.user is now properly typed
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = await getUser(req);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admins only" });
  req.user = user;  // ✅ Type-safe
  next();
}
