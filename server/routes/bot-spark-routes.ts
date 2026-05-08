// server/routes/bot-spark-routes.ts
//
// Internal API routes called exclusively by the meh-auth Telegram bot.
// Protected by a shared secret (X-Bot-Secret header) — never exposed publicly.
//
// Mount in your main router as:
//   app.use("/api/bot", botSparkRouter);
//
// Routes:
//   GET  /api/bot/sparks/active          — list active, non-expired sparks
//   POST /api/bot/sparks                 — create a spark (from Telegram wizard)
//   POST /api/bot/sparks/:id/respond     — accept or decline a spark

import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { sparks, sparkResponses, users } from "@shared/schema";
import { eq, and, inArray, gte, sql } from "drizzle-orm";

export const botSparkRouter = Router();

// ── Auth middleware — shared secret ──────────────────────────────────────────

const BOT_SECRET = process.env.EXPAT_API_SECRET ?? "";

function requireBotSecret(req: Request, res: Response, next: NextFunction) {
  const provided = req.headers["x-bot-secret"];
  if (!BOT_SECRET || provided !== BOT_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

botSparkRouter.use(requireBotSecret);

// ── GET /api/bot/sparks/active ────────────────────────────────────────────────
// Returns all sparks that are pending/active, not yet expired, and meeting time
// is still in the future. The bot filters by user interests client-side.

botSparkRouter.get("/sparks/active", async (_req, res) => {
  try {
    const now = new Date();

    const activeSparks = await db
      .select()
      .from(sparks)
      .where(
        and(
          inArray(sparks.status, ["pending", "active"]),
          gte(sparks.expiresAt, now),
          gte(sparks.meetTime,  now)
        )
      )
      .orderBy(sparks.meetTime);

    // Attach basic response counts so the bot can show "X/Y going"
    const withCounts = await Promise.all(
      activeSparks.map(async spark => {
        const responses = await db
          .select()
          .from(sparkResponses)
          .where(eq(sparkResponses.sparkId, spark.id));
        return { ...spark, responses };
      })
    );

    res.json(withCounts);
  } catch (err: any) {
    console.error("[bot-routes] GET /sparks/active error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/bot/sparks ──────────────────────────────────────────────────────
// Creates a new spark from the Telegram wizard.
// Body: { senderId, title, description?, activity, location, meetTime (ISO),
//         expiresInMins, maxRespondents }

botSparkRouter.post("/sparks", async (req, res) => {
  try {
    const {
      senderId,
      title,
      description,
      activity,
      location,
      meetTime,
      expiresInMins,
      maxRespondents,
    } = req.body as {
      senderId:       string;
      title:          string;
      description?:   string;
      activity:       string;
      location:       string;
      meetTime:       string;   // ISO string from the bot
      expiresInMins:  number;
      maxRespondents: number;
    };

    if (!senderId || !title || !activity || !location || !meetTime) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const now       = new Date();
    const expiresAt = new Date(now.getTime() + (expiresInMins ?? 60) * 60_000);
    const meetDate  = new Date(meetTime);

    if (isNaN(meetDate.getTime())) {
      res.status(400).json({ error: "Invalid meetTime" });
      return;
    }

    const [inserted] = await db
      .insert(sparks)
      .values({
        senderId,
        title:          title.slice(0, 100),
        description:    description?.slice(0, 500) ?? "",
        activity,
        location:       location.slice(0, 200),
        meetTime:       meetDate,
        expiresAt,
        maxRespondents: Math.min(Math.max(maxRespondents ?? 5, 1), 20),
        status:         "pending",
        // lat/lng not available from Telegram text wizard — null is fine
        lat:            null,
        lng:            null,
      })
      .returning();

    res.status(201).json(inserted);
  } catch (err: any) {
    console.error("[bot-routes] POST /sparks error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/bot/sparks/:id/respond ─────────────────────────────────────────
// Accept or decline a spark on behalf of a user.
// Body: { responderId: string, status: "accepted" | "declined" }
// Returns: { ok, message?, spark?, creatorTelegramId? }

botSparkRouter.post("/sparks/:id/respond", async (req, res) => {
  try {
    const sparkId    = parseInt(req.params.id, 10);
    const { responderId, status } = req.body as {
      responderId: string;
      status:      "accepted" | "declined";
    };

    if (!responderId || !["accepted", "declined"].includes(status)) {
      res.status(400).json({ error: "Missing or invalid fields" });
      return;
    }

    // Load the spark
    const [spark] = await db.select().from(sparks).where(eq(sparks.id, sparkId));
    if (!spark) {
      res.json({ ok: false, message: "Spark not found." });
      return;
    }
    if (!["pending", "active"].includes(spark.status)) {
      res.json({ ok: false, message: "This Spark is no longer open." });
      return;
    }
    if (new Date(spark.expiresAt) < new Date()) {
      res.json({ ok: false, message: "This Spark has expired." });
      return;
    }
    if (spark.senderId === responderId) {
      res.json({ ok: false, message: "You can't respond to your own Spark." });
      return;
    }

    // Check capacity when accepting
    if (status === "accepted") {
      const accepted = await db
        .select()
        .from(sparkResponses)
        .where(
          and(
            eq(sparkResponses.sparkId, sparkId),
            eq(sparkResponses.status, "accepted")
          )
        );
      // Don't count the user's own existing accepted response against the cap
      const othersAccepted = accepted.filter(r => r.responderId !== responderId);
      if (othersAccepted.length >= spark.maxRespondents) {
        res.json({ ok: false, message: "This Spark is full." });
        return;
      }
    }

    // Upsert the response
    await db
      .insert(sparkResponses)
      .values({
        sparkId,
        responderId,
        status,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target:  [sparkResponses.sparkId, sparkResponses.responderId],
        set:     { status, updatedAt: new Date() },
      });

    // Promote to "active" when first accepted response arrives
    if (status === "accepted" && spark.status === "pending") {
      await db
        .update(sparks)
        .set({ status: "active" })
        .where(eq(sparks.id, sparkId));
    }

    // Resolve the creator's telegramId so the bot can DM them
    let creatorTelegramId: string | null = null;
    try {
      const [creator] = await db
        .select({ telegramId: users.telegramId })
        .from(users)
        .where(sql`${users.id}::text = ${spark.senderId}`);
      creatorTelegramId = creator?.telegramId ?? null;
    } catch { /* non-critical */ }

    res.json({
      ok:   true,
      spark: {
        id:       spark.id,
        title:    spark.title,
        location: spark.location,
      },
      creatorTelegramId,
    });
  } catch (err: any) {
    console.error("[bot-routes] POST /sparks/:id/respond error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});
