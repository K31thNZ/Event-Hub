// server/group-routes.ts
import type { Express, Request, Response } from "express";
import { db } from "./db";
import { groups, groupMembers, events, ticketTypes } from "@shared/schema";
import { eq, and, desc, sql, inArray, ne } from "drizzle-orm";
import { addWeeks } from "date-fns";
import { storage } from "./storage";
import { requireAuth } from "./auth-client"; // ← unified auth, same as routes.ts & picks-routes.ts

const MAX_MODERATORS = 5;
const MAX_RECURRING_INSTANCES = 12;

async function getMembership(groupId: number, userId: number | string | undefined) {
  if (!userId) return null;
  const [m] = await db.select().from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, String(userId))));
  return m ?? null;
}

function isPremium(role: string | null | undefined): boolean {
  return ["premium", "host", "curator", "admin"].includes(role ?? "");
}

function buildRecurringDates(
  baseDate: Date,
  recurrence: "weekly" | "biweekly" | "monthly",
  until: Date | null
): Date[] {
  const dates: Date[] = [];
  const end = until ?? addWeeks(baseDate, MAX_RECURRING_INSTANCES);
  let current = new Date(baseDate);
  for (let i = 0; i < MAX_RECURRING_INSTANCES; i++) {
    if (recurrence === "weekly")   current = addWeeks(current, 1);
    if (recurrence === "biweekly") current = addWeeks(current, 2);
    if (recurrence === "monthly")  current = new Date(current.setMonth(current.getMonth() + 1));
    if (current > end) break;
    dates.push(new Date(current));
  }
  return dates;
}

export function registerGroupRoutes(app: Express) {

  // ── GET /api/groups (public) ──────────────────────────────────────────
  app.get("/api/groups", async (req: any, res) => {
    try {
      const { category } = req.query;
      const userId = req.user?.id;

      const rows = await db.select({
        group: groups,
        memberCount: sql<number>`cast(count(${groupMembers.id}) filter (where ${groupMembers.status} = 'active') as int)`,
      })
      .from(groups)
      .leftJoin(groupMembers, eq(groupMembers.groupId, groups.id))
      .where(and(eq(groups.status, "active"), eq(groups.visibility, "public")))
      .groupBy(groups.id)
      .orderBy(desc(groups.createdAt));

      let membershipMap: Map<number, string> = new Map();
      if (userId) {
        const memberships = await db.select()
          .from(groupMembers)
          .where(and(
            eq(groupMembers.userId, String(userId)),
            eq(groupMembers.status, "active"),
            inArray(groupMembers.groupId, rows.map(r => r.group.id))
          ));
        memberships.forEach(m => membershipMap.set(m.groupId, m.role));
      }

      const result = rows
        .filter(r => !category || r.group.category === category)
        .map(r => ({
          ...r.group,
          memberCount: r.memberCount ?? 0,
          currentUserRole: membershipMap.get(r.group.id) ?? null,
        }));

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/groups/:slug (public) ────────────────────────────────────
  app.get("/api/groups/:slug", async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const [group] = await db.select().from(groups)
        .where(and(eq(groups.slug, req.params.slug), eq(groups.status, "active")));
      if (!group) return res.status(404).json({ message: "Group not found" });

      const membership = await getMembership(group.id, userId);
      const isActiveMember = membership?.status === "active";

      const members = await db.select().from(groupMembers)
        .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.status, "active")))
        .orderBy(desc(groupMembers.joinedAt));

      const groupEvents = await db.select().from(events)
        .where(and(
          eq(events.groupId, group.id),
          eq(events.published, true),
          isActiveMember ? sql`true` : eq(events.isPrivate, false)
        ))
        .orderBy(events.date);

      const eventIds = groupEvents.map(e => e.id);
      const tickets = eventIds.length > 0
        ? await db.select().from(ticketTypes).where(inArray(ticketTypes.eventId, eventIds))
        : [];
      const eventsWithTickets = groupEvents.map(e => ({
        ...e,
        ticketTypes: tickets.filter(t => t.eventId === e.id),
      }));

      res.json({
        ...group,
        members: group.membershipType === "open" || isActiveMember
          ? members
          : members.filter(m => ["owner", "moderator"].includes(m.role)),
        events: eventsWithTickets,
        memberCount: members.length,
        currentUserRole: membership?.role ?? null,
        currentUserStatus: membership?.status ?? null,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/groups (create) ─────────────────────────────────────────
  app.post("/api/groups", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!isPremium(user.role)) {
        return res.status(403).json({ message: "A premium membership is required to create a group." });
      }

      const [existing] = await db.select().from(groups)
        .where(and(eq(groups.ownerUserId, String(user.id)), ne(groups.status, "suspended")));
      if (existing) {
        return res.status(400).json({ message: "You already own a group. Premium members may own one group." });
      }

      const { name, slug, description, category, imageUrl, bannerUrl, visibility, membershipType } = req.body;
      if (!name?.trim() || !slug?.trim()) {
        return res.status(400).json({ message: "Name and slug are required" });
      }
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return res.status(400).json({ message: "Slug may only contain lowercase letters, numbers, and hyphens" });
      }

      const [group] = await db.insert(groups).values({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        description: description?.trim() ?? "",
        ownerUserId: String(user.id),
        category: category ?? "social",
        imageUrl: imageUrl ?? null,
        bannerUrl: bannerUrl ?? null,
        visibility: visibility ?? "public",
        membershipType: membershipType ?? "open",
        status: "active",
      }).returning();

      await db.insert(groupMembers).values({
        groupId: group.id,
        userId: String(user.id),
        role: "owner",
        status: "active",
        displayName: user.displayName ?? user.username,
        avatarUrl: user.avatarUrl ?? null,
      });

      res.status(201).json(group);
    } catch (err: any) {
      if (err.message?.includes("unique")) {
        return res.status(400).json({ message: "That URL slug is already taken. Please choose another." });
      }
      res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH /api/groups/:id ──────────────────────────────────────────────
  app.patch("/api/groups/:id", requireAuth, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const membership = await getMembership(groupId, req.user.id);
      if (membership?.role !== "owner") {
        return res.status(403).json({ message: "Only the group owner can edit settings" });
      }

      const { name, description, category, imageUrl, bannerUrl, visibility, membershipType } = req.body;
      const [updated] = await db.update(groups).set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(bannerUrl !== undefined && { bannerUrl }),
        ...(visibility !== undefined && { visibility }),
        ...(membershipType !== undefined && { membershipType }),
        updatedAt: new Date(),
      }).where(eq(groups.id, groupId)).returning();

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE /api/groups/:id ─────────────────────────────────────────────
  app.delete("/api/groups/:id", requireAuth, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const membership = await getMembership(groupId, req.user.id);
      if (membership?.role !== "owner" && req.user.role !== "admin") {
        return res.status(403).json({ message: "Only the group owner can delete a group" });
      }
      await db.update(groups).set({ status: "suspended", updatedAt: new Date() })
        .where(eq(groups.id, groupId));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/groups/:id/join ──────────────────────────────────────────
  app.post("/api/groups/:id/join", requireAuth, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const user = req.user;

      const [group] = await db.select().from(groups).where(eq(groups.id, groupId));
      if (!group || group.status !== "active") return res.status(404).json({ message: "Group not found" });

      const existing = await getMembership(groupId, user.id);
      if (existing?.status === "active") return res.status(409).json({ message: "Already a member" });
      if (existing?.status === "banned")  return res.status(403).json({ message: "You are banned from this group" });

      const status = group.membershipType === "open" ? "active" : "pending";
      if (existing) {
        await db.update(groupMembers).set({ status }).where(eq(groupMembers.id, existing.id));
      } else {
        await db.insert(groupMembers).values({
          groupId,
          userId: String(user.id),
          role: "member",
          status,
          displayName: user.displayName ?? user.username,
          avatarUrl: user.avatarUrl ?? null,
        });
      }
      res.json({ ok: true, status });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/groups/:id/leave ─────────────────────────────────────────
  app.post("/api/groups/:id/leave", requireAuth, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const membership = await getMembership(groupId, req.user.id);
      if (!membership) return res.status(404).json({ message: "Not a member" });
      if (membership.role === "owner") return res.status(400).json({ message: "Transfer ownership before leaving" });
      await db.delete(groupMembers).where(eq(groupMembers.id, membership.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/groups/:id/moderators ───────────────────────────────────
  app.post("/api/groups/:id/moderators", requireAuth, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const membership = await getMembership(groupId, req.user.id);
      if (membership?.role !== "owner") {
        return res.status(403).json({ message: "Only the owner can add moderators" });
      }

      const mods = await db.select().from(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.role, "moderator")));
      if (mods.length >= MAX_MODERATORS) {
        return res.status(400).json({ message: `Maximum ${MAX_MODERATORS} moderators allowed` });
      }

      const { userId } = req.body;
      const targetMembership = await getMembership(groupId, userId);
      if (!targetMembership || targetMembership.status !== "active") {
        return res.status(400).json({ message: "User must be an active group member first" });
      }
      if (targetMembership.role === "owner") {
        return res.status(400).json({ message: "Cannot change owner's role" });
      }
      await db.update(groupMembers).set({ role: "moderator" }).where(eq(groupMembers.id, targetMembership.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE /api/groups/:id/moderators/:userId ─────────────────────────
  app.delete("/api/groups/:id/moderators/:userId", requireAuth, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const membership = await getMembership(groupId, req.user.id);
      if (membership?.role !== "owner") {
        return res.status(403).json({ message: "Only the owner can remove moderators" });
      }
      const targetMembership = await getMembership(groupId, req.params.userId);
      if (!targetMembership) return res.status(404).json({ message: "Member not found" });
      await db.update(groupMembers).set({ role: "member" }).where(eq(groupMembers.id, targetMembership.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH /api/groups/:id/members/:userId ─────────────────────────────
  app.patch("/api/groups/:id/members/:userId", requireAuth, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const membership = await getMembership(groupId, req.user.id);
      if (!["owner", "moderator"].includes(membership?.role ?? "")) {
        return res.status(403).json({ message: "Moderator or owner access required" });
      }
      const { status } = req.body;
      if (!["active", "banned"].includes(status)) {
        return res.status(400).json({ message: "status must be 'active' or 'banned'" });
      }
      const target = await getMembership(groupId, req.params.userId);
      if (!target) return res.status(404).json({ message: "Member not found" });
      if (target.role === "owner") return res.status(400).json({ message: "Cannot modify owner's status" });
      await db.update(groupMembers).set({ status }).where(eq(groupMembers.id, target.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/groups/:id/events ───────────────────────────────────────
  app.post("/api/groups/:id/events", requireAuth, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const user = req.user;

      const membership = await getMembership(groupId, user.id);
      if (!["owner", "moderator"].includes(membership?.role ?? "")) {
        return res.status(403).json({ message: "Only group owners and moderators can create events" });
      }

      const {
        title, description, category, date, venueAddress, venueCity,
        imageUrl, published, isPrivate, ticketTypes: ticketTypesInput,
        recurrence, recurrenceUntil,
      } = req.body;

      const eventDate = new Date(date);
      const [baseEvent] = await db.insert(events).values({
        organizerId: String(user.id),
        groupId,
        title, description, category,
        date: eventDate,
        venueAddress, venueCity,
        imageUrl: imageUrl ?? null,
        published: published ?? true,
        isPrivate: isPrivate ?? false,
        recurrence: recurrence ?? null,
        recurrenceDay: recurrence ? eventDate.getDay() : null,
        recurrenceUntil: recurrenceUntil ? new Date(recurrenceUntil) : null,
        parentEventId: null,
      }).returning();

      if (ticketTypesInput?.length > 0) {
        await db.insert(ticketTypes).values(
          ticketTypesInput.map((t: any) => ({ ...t, eventId: baseEvent.id }))
        );
      }

      const createdInstances: typeof baseEvent[] = [];
      if (recurrence) {
        const recurUntil = recurrenceUntil ? new Date(recurrenceUntil) : null;
        const futureDates = buildRecurringDates(eventDate, recurrence, recurUntil);
        for (const instanceDate of futureDates) {
          const [instance] = await db.insert(events).values({
            organizerId: String(user.id),
            groupId,
            title, description, category,
            date: instanceDate,
            venueAddress, venueCity,
            imageUrl: imageUrl ?? null,
            published: published ?? true,
            isPrivate: isPrivate ?? false,
            recurrence,
            recurrenceDay: instanceDate.getDay(),
            recurrenceUntil: recurUntil,
            parentEventId: baseEvent.id,
          }).returning();
          if (ticketTypesInput?.length > 0) {
            await db.insert(ticketTypes).values(
              ticketTypesInput.map((t: any) => ({ ...t, eventId: instance.id }))
            );
          }
          createdInstances.push(instance);
        }
      }

      res.status(201).json({ event: baseEvent, instances: createdInstances.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/groups/my ────────────────────────────────────────────────
  app.get("/api/groups/my", requireAuth, async (req: any, res) => {
    try {
      const memberships = await db.select({
        membership: groupMembers,
        group: groups,
      })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(and(
        eq(groupMembers.userId, String(req.user.id)),
        eq(groupMembers.status, "active"),
        eq(groups.status, "active"),
      ))
      .orderBy(desc(groupMembers.joinedAt));

      res.json(memberships.map(r => ({
        ...r.group,
        currentUserRole: r.membership.role,
      })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/groups/:id/invite ────────────────────────────────────────
  app.post("/api/groups/:id/invite", requireAuth, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const membership = await getMembership(groupId, req.user.id);
      if (membership?.role !== "owner") {
        return res.status(403).json({ message: "Only the owner can send invites" });
      }
      const { userId, displayName, avatarUrl } = req.body;
      if (!userId) return res.status(400).json({ message: "userId is required" });

      const existing = await getMembership(groupId, userId);
      if (existing?.status === "active") return res.status(409).json({ message: "User is already a member" });
      if (existing?.status === "banned")  return res.status(400).json({ message: "User is banned" });

      if (existing) {
        await db.update(groupMembers).set({ status: "invited" }).where(eq(groupMembers.id, existing.id));
      } else {
        await db.insert(groupMembers).values({
          groupId,
          userId: String(userId),
          role: "member",
          status: "invited",
          displayName: displayName ?? null,
          avatarUrl: avatarUrl ?? null,
        });
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/groups/:id/accept-invite ────────────────────────────────
  app.post("/api/groups/:id/accept-invite", requireAuth, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const membership = await getMembership(groupId, req.user.id);
      if (!membership || membership.status !== "invited") {
        return res.status(400).json({ message: "No pending invite found" });
      }
      await db.update(groupMembers).set({ status: "active" }).where(eq(groupMembers.id, membership.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
