// server/picks-routes.ts
// Curator picks API routes for Event-Hub.
// Mounted in server/routes.ts alongside the existing routes.

import type { Express, Request, Response } from "express";
import { db } from "./db";
import { curatorPicks, events, ticketTypes } from "@shared/schema";
import { eq, desc, and, inArray } from "drizzle-orm";

// ── Auth helpers (same pattern as existing routes) ────────────────────────
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  next();
}

async function requireCuratorOrAdmin(req: Request, res: Response, next: Function) {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const { storage } = await import("./storage");
  const user = await storage.getUser(req.session.userId);
  if (!user || !["curator", "admin"].includes(user.role ?? "")) {
    return res.status(403).json({ message: "Curator or admin access required" });
  }
  next();
}

async function requireAdmin(req: Request, res: Response, next: Function) {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const { storage } = await import("./storage");
  const user = await storage.getUser(req.session.userId);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

// ── Resolve event IDs to full EventWithTickets objects ────────────────────
async function resolvePickEvents(eventIds: number[]) {
  if (eventIds.length === 0) return [];
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

  // ── GET /api/picks ─────────────────────────────────────────────────────
  // Public — returns the latest published picks edition with resolved events.
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

  // ── GET /api/picks/all ─────────────────────────────────────────────────
  // Public — returns all published editions (for archive/history).
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

  // ── GET /api/curator/picks ─────────────────────────────────────────────
  // Curator — returns all their own picks (published + drafts).
  app.get("/api/curator/picks", requireCuratorOrAdmin, async (req, res) => {
    try {
      const picks = await db
        .select()
        .from(curatorPicks)
        .where(eq(curatorPicks.curatorId, String(req.session.userId)))
        .orderBy(desc(curatorPicks.weekOf));
      res.json(picks);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/curator/picks ────────────────────────────────────────────
  // Curator — create a new picks edition (as draft).
  app.post("/api/curator/picks", requireCuratorOrAdmin, async (req, res) => {
    try {
      const { storage } = await import("./storage");
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "User not found" });

      const { intro, eventIds, weekOf, curatorSpecialty } = req.body;

      if (!intro || !Array.isArray(eventIds) || eventIds.length === 0) {
        return res.status(400).json({ message: "intro and eventIds are required" });
      }
      if (eventIds.length > 6) {
        return res.status(400).json({ message: "Maximum 6 picks per edition" });
      }

      const [pick] = await db.insert(curatorPicks).values({
        curatorId: String(user.id),
        curatorName: user.displayName ?? user.username,
        curatorAvatarUrl: user.avatarUrl,
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

  // ── PATCH /api/curator/picks/:id ──────────────────────────────────────
  // Curator — update their pick edition.
  app.patch("/api/curator/picks/:id", requireCuratorOrAdmin, async (req, res) => {
    try {
      const pickId = parseInt(req.params.id);
      const [existing] = await db.select().from(curatorPicks).where(eq(curatorPicks.id, pickId));

      if (!existing) return res.status(404).json({ message: "Pick not found" });
      if (existing.curatorId !== String(req.session.userId)) {
        const { storage } = await import("./storage");
        const user = await storage.getUser(req.session.userId!);
        if (user?.role !== "admin") return res.status(403).json({ message: "Not your pick" });
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

  // ── DELETE /api/curator/picks/:id ─────────────────────────────────────
  app.delete("/api/curator/picks/:id", requireCuratorOrAdmin, async (req, res) => {
    try {
      const pickId = parseInt(req.params.id);
      const [existing] = await db.select().from(curatorPicks).where(eq(curatorPicks.id, pickId));
      if (!existing) return res.status(404).json({ message: "Pick not found" });

      if (existing.curatorId !== String(req.session.userId)) {
        const { storage } = await import("./storage");
        const user = await storage.getUser(req.session.userId!);
        if (user?.role !== "admin") return res.status(403).json({ message: "Not your pick" });
      }

      await db.delete(curatorPicks).where(eq(curatorPicks.id, pickId));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/admin/users ───────────────────────────────────────────────
  // Admin — fetch all users from meh-auth for the user management tab.
  // Proxies to meh-auth so we get role info.
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
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

  // ── PATCH /api/admin/users/:id/role ───────────────────────────────────
  // Admin — update a user's role via meh-auth.
  app.patch("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
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
