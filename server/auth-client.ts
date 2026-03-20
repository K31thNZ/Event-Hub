import type { Request, Response, NextFunction } from "express";

const AUTH_URL = process.env.AUTH_SERVICE_URL ?? "https://meh-auth.onrender.com";

export interface MEHUser {
  id: number;
  username: string;
  role: string;
  displayName?: string;
  avatarUrl?: string;
  email?: string;
  interests?: string[];
  isExpatMember: boolean;
  isGamesMember: boolean;
  dice: number;
}

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
  (req as any).user = user;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = await getUser(req);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admins only" });
  (req as any).user = user;
  next();
}
