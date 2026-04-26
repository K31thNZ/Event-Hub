// server/admin-routes.ts
//
// Admin-only API routes for the Event Hub frontend server.
// All routes require the caller to be authenticated AND have isAdmin === true
// in the local users table (the same check used in routes.ts for event/order ownership).
//
// Mount in server/routes.ts inside registerRoutes():
//   registerAdminRoutes(app);

import type { Express } from "express";
import { db } from "./db";
import { storage } from "./storage";
import { requireAuth, getUser } from "./auth-client";
import { groups, groupMembers, events } from "@shared/schema";
import { desc } from "drizzle-orm";

// ── Auth guard: must be authenticated AND isAdmin in the local DB ─────────────
async function requireAdmin(req: any, res: any, next: any) {
  const authUser = await getUser(req);
  if (!authUser) return res.status(401).json({ message: "Not authenticated" });

  const localUser = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, String(authUser.id)),
  });
  if (!localUser?.isAdmin) return res.status(403).json({ message: "Admin only" });

  req.user      = authUser;
  req.localUser = localUser;
  next();
}

export function registerAdminRoutes(app: Express) {

  // ── GET /api/admin/events ─────────────────────────────────────────────────
  // Returns ALL events (published + draft) ordered by creation date desc.
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
  // Admin can update any event regardless of organizer.
  // Reuses the same storage.updateEvent() path already used by organizers.
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
  // Admin can delete any event, cascading to ticket types and orders.
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
  // Returns ALL groups with member count, ordered by creation date desc.
  app.get("/api/admin/groups", requireAdmin, async (_req, res) => {
    try {
      const all = await db.query.groups.findMany({
        with:    { members: true },
        orderBy: [desc(groups.createdAt)],
      });
      // Flatten member count so the frontend doesn't need to count
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
  // Admin can update any group's name, description, or category.
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
  // Deletes a group and all its memberships (events are NOT deleted — they
  // just lose their groupId link, same as the existing group-routes behaviour).
  app.delete("/api/admin/groups/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid group ID" });

      const existing = await db.query.groups.findFirst({
        where: (g, { eq }) => eq(g.id, id),
      });
      if (!existing) return res.status(404).json({ message: "Group not found" });

      await db.transaction(async (tx) => {
        // Remove members first (FK constraint)
        await tx
          .delete(groupMembers)
          .where(((gm: any, { eq }: any) => eq(gm.groupId, id)) as any);

        // Nullify groupId on events that belonged to this group
        await tx
          .update(events)
          .set({ groupId: null })
          .where(((e: any, { eq }: any) => eq(e.groupId, id)) as any);

        // Delete the group itself
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
