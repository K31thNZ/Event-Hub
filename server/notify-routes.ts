// server/notify-routes.ts
// Bot‑facing RSVP endpoints — RSVPs are now stored in the expatevents database.
// The Telegram bot calls these endpoints instead of writing directly to the auth DB.

import type { Express } from "express";
import { db } from "./db";
import { rsvps, users, orders } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// ── Shared secret validation ────────────────────────────────────────────────
// The bot sends the same secret in the X-Bot-Secret header.
function validateBotSecret(req: any, res: any): boolean {
  const botSecret = process.env.EXPAT_API_SECRET;   // reuse existing secret
  if (!botSecret) return true;                       // dev mode – allow
  if (req.headers["x-bot-secret"] !== botSecret) {
    res.status(403).json({ error: "Invalid bot secret" });
    return false;
  }
  return true;
}

// ── Helper: count RSVPs for a given event ──────────────────────────────────
async function loadRsvpCounts(eventId: number): Promise<{
  going: number;
  maybe: number;
  no: number;
}> {
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

// ── Route registration ─────────────────────────────────────────────────────
export function registerNotifyRoutes(app: Express) {

  // ── POST /api/bot/events/:id/rsvp ──────────────────────────────────────
  // Upsert an RSVP (going | maybe | no | none to delete) and return fresh counts.
  app.post("/api/bot/events/:id/rsvp", async (req, res) => {
    if (!validateBotSecret(req, res)) return;

    const eventId = parseInt(req.params.id, 10);
    if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event ID" });

    const { userId, status, sourceChatId, sourceChatTitle } = req.body;

    if (!userId || !status || !["going", "maybe", "no", "none"].includes(status)) {
      return res.status(400).json({
        error: "userId (meh-auth integer) and status (going|maybe|no|none) are required",
      });
    }

    const mehAuthUserId = parseInt(userId, 10);
    if (isNaN(mehAuthUserId)) {
      return res.status(400).json({ error: "userId must be a number" });
    }

    try {
      if (status === "none") {
        await db
          .delete(rsvps)
          .where(and(
            eq(rsvps.eventId, eventId),
            eq(rsvps.userId, mehAuthUserId)
          ));
      } else {
        await db
          .insert(rsvps)
          .values({
            eventId,
            userId:          mehAuthUserId,
            status,
            source:          "telegram",
            sourceChatId:    sourceChatId    ?? null,
            sourceChatTitle: sourceChatTitle ?? null,
            updatedAt:       new Date(),
          })
          .onConflictDoUpdate({
            target: [rsvps.eventId, rsvps.userId],
            set: {
              status,
              sourceChatId:    sourceChatId    ?? null,
              sourceChatTitle: sourceChatTitle ?? null,
              updatedAt:       new Date(),
            },
          });
      }

      const counts = await loadRsvpCounts(eventId);
      res.json({ success: true, counts });
    } catch (err: any) {
      console.error("[bot] RSVP upsert error:", err.message);
      res.status(500).json({ error: "RSVP update failed" });
    }
  });

  // ── GET /api/bot/events/:id/rsvp-summary ──────────────────────────────
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

  // ── GET /api/bot/events/:id/attendees ──────────────────────────────────
  app.get("/api/bot/events/:id/attendees", async (req, res) => {
    if (!validateBotSecret(req, res)) return;

    const eventId = parseInt(req.params.id, 10);
    if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event ID" });

    try {
      const rows = await db
        .select({
          userId:          rsvps.userId,
          status:          rsvps.status,
          sourceChatTitle: rsvps.sourceChatTitle,
        })
        .from(rsvps)
        .where(eq(rsvps.eventId, eventId));

      // Fetch user details from meh-auth in one batch call
      const userIds = rows.map(r => r.userId);
      let userMap: Record<number, { telegramId?: string; username?: string }> = {};

      if (userIds.length > 0) {
        try {
          const mehAuthUrl = process.env.AUTH_SERVICE_URL ?? "https://auth.expatevents.org";
          const secret     = process.env.SERVICE_SECRET;
          const res2 = await fetch(`${mehAuthUrl}/api/admin/users/batch`, {
            method: "POST",
            headers: {
              "Content-Type":     "application/json",
              "x-service-secret": secret ?? "",
            },
            body: JSON.stringify({ ids: userIds }),
          });
          if (res2.ok) {
            const users: Array<{ id: number; telegramId?: string; username: string }> = await res2.json();
            userMap = Object.fromEntries(users.map(u => [u.id, u]));
          }
        } catch (err: any) {
          console.warn("[bot] Could not fetch user details from meh-auth:", err.message);
          // Non-fatal — return RSVPs without user details
        }
      }

      const result = rows.map(r => ({
        userId:          r.userId,
        status:          r.status,
        sourceChatTitle: r.sourceChatTitle,
        telegramId:      userMap[r.userId]?.telegramId ?? null,
        username:        userMap[r.userId]?.username   ?? null,
      }));

      res.json(result);
    } catch (err: any) {
      console.error("[bot] Attendees fetch error:", err.message);
      res.status(500).json({ error: "Failed to fetch attendees" });
    }
  });


  // ── GET /api/bot/events/:id/ticket-buyers ──────────────────────────────
  // Returns list of users who have a paid order for this event.
  // The bot uses this to display a ticket buyers list on event cards.
  app.get("/api/bot/events/:id/ticket-buyers", async (req, res) => {
    if (!validateBotSecret(req, res)) return;

    const eventId = parseInt(req.params.id, 10);
    if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event ID" });

    try {
      const rows = await db
        .select({
          attendeeId:    orders.attendeeId,
          attendeeName:  orders.attendeeName,
          attendeeEmail: orders.attendeeEmail,
          status:        orders.status,
        })
        .from(orders)
        .where(and(
          eq(orders.eventId, eventId),
          eq(orders.status, "paid")
        ));

      // Fetch telegram usernames from meh-auth in one batch call
      const userIds = [...new Set(rows.map(r => r.attendeeId))];
      let userMap: Record<number, { telegramId?: string; username?: string }> = {};

      if (userIds.length > 0) {
        try {
          const mehAuthUrl = process.env.AUTH_SERVICE_URL ?? "https://auth.expatevents.org";
          const secret     = process.env.SERVICE_SECRET;
          const batchRes = await fetch(`${mehAuthUrl}/api/admin/users/batch`, {
            method: "POST",
            headers: {
              "Content-Type":     "application/json",
              "x-service-secret": secret ?? "",
            },
            body: JSON.stringify({ ids: userIds }),
          });
          if (batchRes.ok) {
            const users2: Array<{ id: number; telegramId?: string; username?: string }> = await batchRes.json();
            userMap = Object.fromEntries(users2.map(u => [u.id, u]));
          }
        } catch (err: any) {
          console.warn("[bot] ticket-buyers: could not fetch usernames:", err.message);
        }
      }

      const result = rows.map(r => ({
        attendeeId:   r.attendeeId,
        attendeeName: r.attendeeName,
        username:     userMap[r.attendeeId]?.username   ?? null,
        telegramId:   userMap[r.attendeeId]?.telegramId ?? null,
      }));

      res.json({ count: result.length, buyers: result });
    } catch (err: any) {
      console.error("[bot] ticket-buyers error:", err.message);
      res.status(500).json({ error: "Failed to fetch ticket buyers" });
    }
  });

  // ── GET /api/bot/events/:id/my-rsvp ────────────────────────────────────
  // Returns the current RSVP status for a specific user.
  // The bot sends the user ID via the X-User-Id header.
  app.get("/api/bot/events/:id/my-rsvp", async (req, res) => {
    if (!validateBotSecret(req, res)) return;

    const eventId = parseInt(req.params.id, 10);
    const userId  = parseInt(req.headers["x-user-id"] as string, 10);

    if (isNaN(eventId) || isNaN(userId)) {
      return res.status(400).json({ error: "Invalid event ID or user ID" });
    }

    try {
      const [r] = await db
        .select({ status: rsvps.status })
        .from(rsvps)
        .where(and(
          eq(rsvps.eventId, eventId),
          eq(rsvps.userId, userId)          // userId is now just an integer, no join needed
        ));

      res.json({ status: r?.status ?? null });
    } catch (err: any) {
      console.error("[bot] my-rsvp error:", err.message);
      res.status(500).json({ error: "Failed to fetch RSVP status" });
    }
  });
}
