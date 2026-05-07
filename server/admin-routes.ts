// server/admin-routes.ts
//
// Admin-only API routes for the Event Hub frontend server.
// All routes require the caller to be authenticated AND have the "admin" role
// in the external auth service (checked by requireAdmin from ./auth-client).
//
// Mount in server/routes.ts inside registerRoutes():
//   registerAdminRoutes(app);

import type { Express } from "express";
import { db } from "./db";
import { storage } from "./storage";
// Import the admin guard directly from the auth client
import { requireAdmin } from "./auth-client";
import { groups, groupMembers, events } from "@shared/schema";
import { desc } from "drizzle-orm";

// No custom requireAdmin here – using the one from auth-client which checks
// the user's role in the external auth service.

export function registerAdminRoutes(app: Express) {

  // ── GET /api/admin/events ─────────────────────────────────────────────────
  app.get("/api/admin/events", requireAdmin, async (_req, res) => {
    try {
      const all = await db.query.events.findMany({
        with:    { ticketTypes: true },
        orderBy: [desc(events.createdAt)],
      });
      res.json(all);
    } catch (err: any) {
      console.error("[admin] GET /api/admin/events", err);
      res.status(500).json({ message: err.message ?? "Failed to fetch events" });
    }
  });

  // ── PATCH /api/admin/events/:id ───────────────────────────────────────────
  app.patch("/api/admin/events/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid event ID" });

      const existing = await storage.getEvent(id);
      if (!existing) return res.status(404).json({ message: "Event not found" });

      const updated = await storage.updateEvent(id, req.body);
      res.json(updated);
    } catch (err: any) {
      console.error("[admin] PATCH /api/admin/events/:id", err);
      res.status(500).json({ message: err.message ?? "Failed to update event" });
    }
  });

  // ── DELETE /api/admin/events/:id ──────────────────────────────────────────
  app.delete("/api/admin/events/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid event ID" });

      const existing = await storage.getEvent(id);
      if (!existing) return res.status(404).json({ message: "Event not found" });

      await storage.deleteEvent(id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[admin] DELETE /api/admin/events/:id", err);
      res.status(500).json({ message: err.message ?? "Failed to delete event" });
    }
  });

  // ── GET /api/admin/groups ─────────────────────────────────────────────────
  app.get("/api/admin/groups", requireAdmin, async (_req, res) => {
    try {
      const all = await db.query.groups.findMany({
        with:    { members: true },
        orderBy: [desc(groups.createdAt)],
      });
      const mapped = all.map(g => ({
        ...g,
        memberCount: Array.isArray(g.members) ? g.members.length : 0,
      }));
      res.json(mapped);
    } catch (err: any) {
      console.error("[admin] GET /api/admin/groups", err);
      res.status(500).json({ message: err.message ?? "Failed to fetch groups" });
    }
  });

  // ── PATCH /api/admin/groups/:id ───────────────────────────────────────────
  app.patch("/api/admin/groups/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid group ID" });

      const existing = await db.query.groups.findFirst({
        where: (g, { eq }) => eq(g.id, id),
      });
      if (!existing) return res.status(404).json({ message: "Group not found" });

      const { name, description, category } = req.body;
      const patch: Record<string, any> = {};
      if (name        !== undefined) patch.name        = name;
      if (description !== undefined) patch.description = description;
      if (category    !== undefined) patch.category    = category;

      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }

      const [updated] = await db
        .update(groups)
        .set(patch)
        .where(((g: any, { eq }: any) => eq(g.id, id)) as any)
        .returning();

      res.json(updated);
    } catch (err: any) {
      console.error("[admin] PATCH /api/admin/groups/:id", err);
      res.status(500).json({ message: err.message ?? "Failed to update group" });
    }
  });

  // ── DELETE /api/admin/groups/:id ──────────────────────────────────────────
  app.delete("/api/admin/groups/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid group ID" });

      const existing = await db.query.groups.findFirst({
        where: (g, { eq }) => eq(g.id, id),
      });
      if (!existing) return res.status(404).json({ message: "Group not found" });

      await db.transaction(async (tx) => {
        await tx
          .delete(groupMembers)
          .where(((gm: any, { eq }: any) => eq(gm.groupId, id)) as any);

        await tx
          .update(events)
          .set({ groupId: null })
          .where(((e: any, { eq }: any) => eq(e.groupId, id)) as any);

        await tx
          .delete(groups)
          .where(((g: any, { eq }: any) => eq(g.id, id)) as any);
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("[admin] DELETE /api/admin/groups/:id", err);
      res.status(500).json({ message: err.message ?? "Failed to delete group" });
    }
  });
}
