import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { rsvps } from "@shared/schema";   // assume you have this table
import { eq, and } from "drizzle-orm";

export const botEventRouter = Router();

const BOT_SECRET = process.env.EXPAT_API_SECRET ?? "";

function requireBotSecret(req: Request, res: Response, next: NextFunction) {
  if (!BOT_SECRET || req.headers["x-bot-secret"] !== BOT_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

botEventRouter.use(requireBotSecret);

// POST /api/bot/events/:id/rsvp
botEventRouter.post("/events/:id/rsvp", async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event ID" });

    const { userId, status, sourceChatId, sourceChatTitle } = req.body;
    if (!userId || !["going", "maybe", "no", "none"].includes(status)) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    // Upsert the RSVP row (uses a unique constraint on (userId, eventId))
    await db
      .insert(rsvps)
      .values({
        userId:           Number(userId),
        eventId,
        status,
        sourceChatId:     sourceChatId ?? null,
        sourceChatTitle:  sourceChatTitle ?? null,
        updatedAt:        new Date(),
      })
      .onConflictDoUpdate({
        target: [rsvps.userId, rsvps.eventId],
        set: { status, sourceChatId: sourceChatId ?? null, sourceChatTitle: sourceChatTitle ?? null, updatedAt: new Date() },
      });

    // Read back all counts for this event
    const [summary] = await db
      .select({
        going: db.fn.count().filterWhere(eq(rsvps.status, "going")),
        maybe: db.fn.count().filterWhere(eq(rsvps.status, "maybe")),
        no:    db.fn.count().filterWhere(eq(rsvps.status, "no")),
      })
      .from(rsvps)
      .where(eq(rsvps.eventId, eventId));

    res.json({ counts: { going: Number(summary.going), maybe: Number(summary.maybe), no: Number(summary.no) } });
  } catch (err: any) {
    console.error("[bot-events] RSVP failed:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/bot/events/:id/rsvp-summary
botEventRouter.get("/events/:id/rsvp-summary", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const [summary] = await db
    .select({
      going: db.fn.count().filterWhere(eq(rsvps.status, "going")),
      maybe: db.fn.count().filterWhere(eq(rsvps.status, "maybe")),
      no:    db.fn.count().filterWhere(eq(rsvps.status, "no")),
    })
    .from(rsvps)
    .where(eq(rsvps.eventId, eventId));
  res.json({ going: Number(summary.going), maybe: Number(summary.maybe), no: Number(summary.no) });
});

// GET /api/bot/events/:id/my-rsvp
botEventRouter.get("/events/:id/my-rsvp", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const userId   = parseInt(req.headers["x-user-id"] as string);
  if (isNaN(userId)) return res.status(400).json({ error: "Missing x-user-id header" });

  const [row] = await db.select({ status: rsvps.status }).from(rsvps)
    .where(and(eq(rsvps.eventId, eventId), eq(rsvps.userId, userId)));
  res.json({ status: row?.status ?? "none" });
});

// GET /api/bot/events/:id/attendees
botEventRouter.get("/events/:id/attendees", async (req, res) => {
  const eventId = parseInt(req.params.id);
  const rows = await db.select().from(rsvps).where(eq(rsvps.eventId, eventId));
  res.json(rows);
});

// GET /api/bot/events/:id/ticket-buyers
// (probably already implemented elsewhere – just an example)
botEventRouter.get("/events/:id/ticket-buyers", async (req, res) => {
  // placeholder – replace with your actual ticket query
  res.json({ count: 0, buyers: [] });
});
