// server/notify-routes.ts
// Routes called by Event-Hub (and future hubs) after events are published.
// Also exposes admin routes for availability match management,
// and bot endpoints for RSVP operations (RSVPs now stored in expatevents DB).

import type { Express } from "express";
import { requireAuth, requireAdmin } from "./auth";
import { notifyMatchingUsers, notifyOrganiserDemand } from "./bot";
import { storage } from "./storage";
import { db } from "./db";
import { availabilityMatches, hosts, rsvps } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { runAvailabilityMatcher } from "./matcher";
import { z } from "zod";

const notifyEventSchema = z.object({
  id:           z.number(),
  title:        z.string(),
  category:     z.string(),
  date:         z.coerce.date(),
  venueCity:    z.string(),
  venueAddress: z.string(),
  description:  z.string(),
  organizerId:  z.number().optional(),
  imageUrl:     z.string().optional(),
});

// Shared secret for Event-Hub calls
function validateServiceSecret(req: any, res: any): boolean {
  const secret = process.env.SERVICE_SECRET;
  if (!secret) return true;
  if (req.headers["x-service-secret"] !== secret) {
    res.status(403).json({ error: "Invalid service secret" });
    return false;
  }
  return true;
}

// Bot secret guard – used for RSVP endpoints called by Telegram bot
function validateBotSecret(req: any, res: any): boolean {
  const botSecret = process.env.EXPAT_API_SECRET;
  if (!botSecret) return true; // dev mode
  if (req.headers["x-bot-secret"] !== botSecret) {
    res.status(403).json({ error: "Invalid bot secret" });
    return false;
  }
  return true;
}

export function registerNotifyRoutes(app: Express) {

  // ── POST /api/notify/event ────────────────────────────────────────────────
  app.post("/api/notify/event", async (req, res) => {
    if (!validateServiceSecret(req, res)) return;

    try {
      const event = notifyEventSchema.parse(req.body);
      const result = await notifyMatchingUsers(event);
      res.json({ ok: true, ...result });
    } catch (err: any) {
      if (err?.name === "ZodError") {
        return res.status(400).json({ error: "Invalid event data", details: err.errors });
      }
      console.error("[notify] Error:", err);
      res.status(500).json({ error: "Notification failed" });
    }
  });

  // ── POST /api/notify/profile-updated ─────────────────────────────────────
  app.post("/api/notify/profile-updated", async (req, res) => {
    if (!validateServiceSecret(req, res)) return;

    res.json({ ok: true, message: "Matcher queued" });

    setImmediate(async () => {
      try {
        await runAvailabilityMatcher();
        console.log("[notify] Profile-triggered matcher run complete");
      } catch (err: any) {
        console.error("[notify] Profile-triggered matcher failed:", err.message);
      }
    });
  });

  // ── GET /api/admin/availability-matches ───────────────────────────────────
  app.get("/api/admin/availability-matches", requireAdmin, async (req, res) => {
    try {
      const matches = await db.select().from(availabilityMatches);
      res.json(matches);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch matches" });
    }
  });

  // ── POST /api/admin/availability-matches/:id/approve ─────────────────────
  app.post("/api/admin/availability-matches/:id/approve", requireAdmin, async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      const { organiserId } = req.body;

      if (!organiserId) {
        return res.status(400).json({ error: "organiserId required" });
      }

      const [match] = await db
        .select()
        .from(availabilityMatches)
        .where(eq(availabilityMatches.id, matchId));

      if (!match) return res.status(404).json({ error: "Match not found" });

      await notifyOrganiserDemand(organiserId, {
        category: match.category,
        day: match.day,
        hour: match.hour,
        userCount: match.userIds.length,
      });

      await db
        .update(availabilityMatches)
        .set({ notified: true })
        .where(eq(availabilityMatches.id, matchId));

      res.json({ ok: true });
    } catch (err) {
      console.error("[notify] Approve error:", err);
      res.status(500).json({ error: "Failed to approve match" });
    }
  });

  // ── POST /api/admin/run-matcher ───────────────────────────────────────────
  app.post("/api/admin/run-matcher", requireAdmin, async (req, res) => {
    try {
      await runAvailabilityMatcher();
      res.json({ ok: true, message: "Matcher ran successfully" });
    } catch (err) {
      res.status(500).json({ error: "Matcher failed" });
    }
  });

  // ── GET /api/admin/telegram-stats ─────────────────────────────────────────
  app.get("/api/admin/telegram-stats", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getUsersWithTelegramId();
      const interestCounts: Record<string, number> = {};

      for (const user of allUsers) {
        for (const interest of user.interests ?? []) {
          interestCounts[interest] = (interestCounts[interest] ?? 0) + 1;
        }
      }

      res.json({
        totalConnected: allUsers.length,
        byInterest: interestCounts,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW: Bot RSVP endpoints — RSVPs now live in expatevents DB
  // ═══════════════════════════════════════════════════════════════════════════

  // POST /api/bot/events/:id/rsvp — upsert RSVP and return fresh counts
  app.post("/api/bot/events/:id/rsvp", async (req, res) => {
    if (!validateBotSecret(req, res)) return;

    const eventId = parseInt(req.params.id, 10);
    if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event ID" });

    const { userId, status, sourceChatId, sourceChatTitle } = req.body;
    if (!userId || !status || !["going", "maybe", "no", "none"].includes(status)) {
      return res.status(400).json({ error: "userId and status (going|maybe|no|none) required" });
    }

    try {
      if (status === "none") {
        await db
          .delete(rsvps)
          .where(and(eq(rsvps.eventId, eventId), eq(rsvps.userId, parseInt(userId))));
      } else {
        await db
          .insert(rsvps)
          .values({
            eventId,
            userId: parseInt(userId),
            status,
            source: "telegram",
            sourceChatId: sourceChatId ?? null,
            sourceChatTitle: sourceChatTitle ?? null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [rsvps.eventId, rsvps.userId],
            set: {
              status,
              sourceChatId: sourceChatId ?? null,
              sourceChatTitle: sourceChatTitle ?? null,
              updatedAt: new Date(),
            },
          });
      }

      // Return updated counts
      const counts = await loadRsvpCounts(eventId);
      res.json({ success: true, counts });
    } catch (err: any) {
      console.error("[bot] RSVP upsert error:", err.message);
      res.status(500).json({ error: "RSVP update failed" });
    }
  });

  // GET /api/bot/events/:id/rsvp-summary — return { going, maybe, no }
  app.get("/api/bot/events/:id/rsvp-summary", async (req, res) => {
    if (!validateBotSecret(req, res)) return;

    const eventId = parseInt(req.params.id, 10);
    if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event ID" });

    try {
      const counts = await loadRsvpCounts(eventId);
      res.json(counts);
    } catch (err: any) {
      console.error("[bot] RSVP summary error:", err.message);
      res.status(500).json({ error: "Failed to load RSVP counts" });
    }
  });

  // GET /api/bot/events/:id/attendees — list of attendees with user info
  app.get("/api/bot/events/:id/attendees", async (req, res) => {
    if (!validateBotSecret(req, res)) return;

    const eventId = parseInt(req.params.id, 10);
    if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event ID" });

    try {
      const rows = await db
        .select({
          userId: rsvps.userId,
          status: rsvps.status,
          sourceChatTitle: rsvps.sourceChatTitle,
        })
        .from(rsvps)
        .where(eq(rsvps.eventId, eventId));

      // Enrich with user telegram info if possible (the bot needs username/telegramId)
      const result = await Promise.all(
        rows.map(async (r) => {
          try {
            // Fetch user from the same DB — users table is shared via import
            const [user] = await db
              .select({
                telegramId: users.telegramId,
                username: users.username,
              })
              .from(users)
              .where(eq(users.id, r.userId));
            return {
              userId: r.userId,
              status: r.status,
              sourceChatTitle: r.sourceChatTitle,
              telegramId: user?.telegramId ?? null,
              username: user?.username ?? null,
            };
          } catch {
            return {
              userId: r.userId,
              status: r.status,
              sourceChatTitle: r.sourceChatTitle,
              telegramId: null,
              username: null,
            };
          }
        })
      );

      res.json(result);
    } catch (err: any) {
      console.error("[bot] Attendees fetch error:", err.message);
      res.status(500).json({ error: "Failed to fetch attendees" });
    }
  });

  // GET /api/bot/events/:id/my-rsvp — return { status } for a given user
  // The bot sends the user ID via X-User-Id header.
  app.get("/api/bot/events/:id/my-rsvp", async (req, res) => {
    if (!validateBotSecret(req, res)) return;

    const eventId = parseInt(req.params.id, 10);
    const userId = parseInt(req.headers["x-user-id"] as string, 10);

    if (isNaN(eventId) || isNaN(userId)) {
      return res.status(400).json({ error: "Invalid event ID or user ID" });
    }

    try {
      const [r] = await db
        .select({ status: rsvps.status })
        .from(rsvps)
        .where(and(eq(rsvps.eventId, eventId), eq(rsvps.userId, userId)));

      res.json({ status: r?.status ?? null });
    } catch (err: any) {
      console.error("[bot] my-rsvp error:", err.message);
      res.status(500).json({ error: "Failed to fetch RSVP status" });
    }
  });
}

// Helper function to compute RSVP counts for an event
async function loadRsvpCounts(eventId: number): Promise<{ going: number; maybe: number; no: number }> {
  const rows = await db
    .select({ status: rsvps.status })
    .from(rsvps)
    .where(eq(rsvps.eventId, eventId));

  const counts = { going: 0, maybe: 0, no: 0 };
  for (const r of rows) {
    const k = r.status as keyof typeof counts;
    if (k in counts) counts[k]++;
  }
  return counts;
}
