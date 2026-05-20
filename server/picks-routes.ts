import type { Express, Request, Response } from "express";
import { db } from "./db";
import { curatorPicks, events, ticketTypes } from "@shared/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "./auth-client";
import { storage } from "./storage";

// ✅ Role comes from req.user (populated by requireAuth from meh-auth),
//    NOT from the local DB which has no role column.
function requireCuratorOrAdmin(req: Request, res: Response, next: Function) {
  const user = (req as any).user;
  if (!user?.id) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (!["curator", "admin"].includes(user.role ?? "")) {
    return res.status(403).json({ message: "Curator or admin access required" });
  }
  next();
}

async function resolvePickEvents(eventIds: number[]) {
  if (!eventIds.length) return [];
  const evts = await db
    .select()
    .from(events)
    .where(and(inArray(events.id, eventIds), eq(events.published, true)));
  const tickets = await db
    .select()
    .from(ticketTypes)
    .where(inArray(ticketTypes.eventId, eventIds));
  return eventIds
    .map(id => evts.find(e => e.id === id))
    .filter(Boolean)
    .map(event => ({
      ...event!,
      ticketTypes: tickets.filter(t => t.eventId === event!.id),
    }));
}

export function registerPicksRoutes(app: Express) {
  // Public routes
  app.get("/api/picks", async (_req, res) => {
    try {
      const [pick] = await db
        .select()
        .from(curatorPicks)
        .where(eq(curatorPicks.published, true))
        .orderBy(desc(curatorPicks.weekOf))
        .limit(1);
      if (!pick) return res.json(null);
      const pickedEvents = await resolvePickEvents(pick.eventIds);
      res.json({ ...pick, events: pickedEvents });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/picks/all", async (_req, res) => {
    try {
      const picks = await db
        .select()
        .from(curatorPicks)
        .where(eq(curatorPicks.published, true))
        .orderBy(desc(curatorPicks.weekOf));
      res.json(picks);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Authenticated curator/admin routes
  app.get("/api/curator/picks", requireAuth, requireCuratorOrAdmin, async (req: any, res) => {
    try {
      const picks = await db
        .select()
        .from(curatorPicks)
        .where(eq(curatorPicks.curatorId, Number(req.user.id)))
        .orderBy(desc(curatorPicks.weekOf));
      res.json(picks);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/curator/picks", requireAuth, requireCuratorOrAdmin, async (req: any, res) => {
    try {
      const user = req.user; // use meh-auth user directly
      const { intro, eventIds, weekOf, curatorSpecialty } = req.body;
      if (!intro || !Array.isArray(eventIds) || eventIds.length === 0) {
        return res.status(400).json({ message: "intro and eventIds are required" });
      }
      if (eventIds.length > 6) {
        return res.status(400).json({ message: "Maximum 6 picks per edition" });
      }

      const [pick] = await db.insert(curatorPicks).values({
        curatorId: Number(user.id),
        curatorName: user.displayName ?? user.username,
        curatorAvatarUrl: user.avatarUrl ?? null,
        curatorSpecialty: curatorSpecialty ?? "Events",
        weekOf: weekOf ? new Date(weekOf) : new Date(),
        intro,
        eventIds,
        published: false,
      }).returning();

      res.status(201).json(pick);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/curator/picks/:id", requireAuth, requireCuratorOrAdmin, async (req: any, res) => {
    try {
      const pickId = parseInt(req.params.id);
      const [existing] = await db.select().from(curatorPicks).where(eq(curatorPicks.id, pickId));
      if (!existing) return res.status(404).json({ message: "Pick not found" });

      if (existing.curatorId !== Number(req.user.id) && req.user.role !== "admin") {
        return res.status(403).json({ message: "Not your pick" });
      }

      const { intro, eventIds, weekOf, curatorSpecialty, published, curatorName, curatorAvatarUrl } = req.body;
      const [updated] = await db
        .update(curatorPicks)
        .set({
          ...(intro !== undefined && { intro }),
          ...(eventIds !== undefined && { eventIds }),
          ...(weekOf !== undefined && { weekOf: new Date(weekOf) }),
          ...(curatorSpecialty !== undefined && { curatorSpecialty }),
          ...(published !== undefined && { published }),
          ...(curatorName !== undefined && { curatorName }),
          ...(curatorAvatarUrl !== undefined && { curatorAvatarUrl }),
          updatedAt: new Date(),
        })
        .where(eq(curatorPicks.id, pickId))
        .returning();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/curator/picks/:id", requireAuth, requireCuratorOrAdmin, async (req: any, res) => {
    try {
      const pickId = parseInt(req.params.id);
      const [existing] = await db.select().from(curatorPicks).where(eq(curatorPicks.id, pickId));
      if (!existing) return res.status(404).json({ message: "Pick not found" });

      if (existing.curatorId !== Number(req.user.id) && req.user.role !== "admin") {
        return res.status(403).json({ message: "Not your pick" });
      }

      await db.delete(curatorPicks).where(eq(curatorPicks.id, pickId));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin user management (proxy to auth service)
  app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const authUrl = process.env.AUTH_SERVICE_URL ?? "https://auth.expatevents.org";
      const response = await fetch(`${authUrl}/api/admin/users`, {
        headers: {
          cookie: req.headers.cookie ?? "",
          "x-service-secret": process.env.SERVICE_SECRET ?? "",
        },
      });
      if (!response.ok) return res.status(response.status).json({ message: "Failed to fetch users" });
      res.json(await response.json());
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/users/:id/role", requireAuth, requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const { role } = req.body;
      const validRoles = ["free", "premium", "host", "curator", "admin"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
      }
      const authUrl = process.env.AUTH_SERVICE_URL ?? "https://auth.expatevents.org";
      const response = await fetch(`${authUrl}/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: req.headers.cookie ?? "",
          "x-service-secret": process.env.SERVICE_SECRET ?? "",
        },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) return res.status(response.status).json(await response.json());
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
