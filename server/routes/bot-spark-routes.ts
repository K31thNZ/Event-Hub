// server/routes/bot-spark-routes.ts
//
// Internal API routes called by the meh-auth Telegram bot (X-Bot-Secret auth).
// The handleSparkRespond function is also exported for use by the main
// session-authenticated frontend route at POST /api/sparks/:id/respond.
//
// Mount in your main router:
//   import { botSparkRouter, handleSparkRespond } from "./routes/bot-spark-routes";
//   app.use("/api/bot", botSparkRouter);
//   app.post("/api/sparks/:id/respond", requireAuth, handleSparkRespond);

import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { sparks, sparkResponses } from "@shared/schema";
import { eq, and, inArray, gte } from "drizzle-orm";

export const botSparkRouter = Router();

// ── Bot-secret auth ───────────────────────────────────────────────────────────

const BOT_SECRET = process.env.EXPAT_API_SECRET ?? "";

function requireBotSecret(req: Request, res: Response, next: NextFunction) {
  if (!BOT_SECRET || req.headers["x-bot-secret"] !== BOT_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

botSparkRouter.use(requireBotSecret);

// ── GET /api/bot/sparks/active ────────────────────────────────────────────────

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

    const withResponses = await Promise.all(
      activeSparks.map(async s => {
        const responses = await db
          .select()
          .from(sparkResponses)
          .where(eq(sparkResponses.sparkId, s.id));
        return { ...s, responses };
      })
    );

    res.json(withResponses);
  } catch (err: any) {
    console.error("[bot-routes] GET /sparks/active:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/bot/sparks ──────────────────────────────────────────────────────

botSparkRouter.post("/sparks", async (req, res) => {
  try {
    const {
      senderId, title, description, activity, location,
      meetTime, expiresInMins, maxRespondents, lat, lng,
    } = req.body as {
      senderId:       string;
      title:          string;
      description?:   string;
      activity:       string;
      location:       string;
      meetTime:       string;
      expiresInMins:  number;
      maxRespondents: number;
      lat?:           number | null;
      lng?:           number | null;
    };

    if (!senderId || !title || !activity || !location || !meetTime) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const meetDate = new Date(meetTime);
    if (isNaN(meetDate.getTime())) {
      res.status(400).json({ error: "Invalid meetTime" });
      return;
    }

    const now       = new Date();
    const expiresAt = new Date(now.getTime() + (expiresInMins ?? 60) * 60_000);

    const [inserted] = await db
      .insert(sparks)
      .values({
        senderId,
        title:          title.slice(0, 100),
        description:    description?.slice(0, 500) ?? "",
        activity,
        location:       location.slice(0, 200),
        lat:            lat ?? null,
        lng:            lng ?? null,
        meetTime:       meetDate,
        expiresAt,
        maxRespondents: Math.min(Math.max(maxRespondents ?? 5, 1), 20),
        status:         "pending",
      })
      .returning();

    res.status(201).json(inserted);
  } catch (err: any) {
    console.error("[bot-routes] POST /sparks:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/bot/sparks/:id/respond ─────────────────────────────────────────
// Bot route — responderId comes from body.

botSparkRouter.post("/sparks/:id/respond", handleSparkRespond);

// ── Shared respond handler (bot + frontend) ───────────────────────────────────
// For the frontend session route, the caller is responsible for extracting
// the authenticated user's id and putting it in req.body.responderId before
// calling this, OR you can override it from req.session in a wrapper.

export async function handleSparkRespond(req: Request, res: Response): Promise<void> {
  try {
    const sparkId = parseInt(req.params.id, 10);
    if (isNaN(sparkId)) {
      res.status(400).json({ error: "Invalid spark id" });
      return;
    }

    // For the session-auth frontend route, responderId may come from session
    const responderId: string =
      req.body.responderId ??
      String((req as any).user?.id ?? (req as any).session?.userId ?? "");

    const status: string = req.body.status ?? "";

    if (!responderId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!["accepted", "declined"].includes(status)) {
      res.status(400).json({ error: "status must be 'accepted' or 'declined'" });
      return;
    }

    // ── Load spark ────────────────────────────────────────────────────────
    const [spark] = await db
      .select()
      .from(sparks)
      .where(eq(sparks.id, sparkId));

    if (!spark) {
      res.status(404).json({ ok: false, message: "Spark not found." });
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

    // ── Capacity check ────────────────────────────────────────────────────
    if (status === "accepted") {
      const currentAccepted = await db
        .select()
        .from(sparkResponses)
        .where(
          and(
            eq(sparkResponses.sparkId, sparkId),
            eq(sparkResponses.status, "accepted")
          )
        );
      // Don't count the responder's own existing row
      const othersAccepted = currentAccepted.filter(r => r.responderId !== responderId);
      if (othersAccepted.length >= spark.maxRespondents) {
        res.json({ ok: false, message: "This Spark is full." });
        return;
      }
    }

    // ── Upsert ────────────────────────────────────────────────────────────
    // Relies on the unique constraint:
    //   unique("spark_responses_spark_id_responder_id_unique")
    //   on (spark_id, responder_id)
    // defined in schema.ts. Without that constraint onConflictDoUpdate fails.
    const [upserted] = await db
      .insert(sparkResponses)
      .values({
        sparkId,
        responderId,
        status,
        message:   null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [sparkResponses.sparkId, sparkResponses.responderId],
        set: {
          status,
          updatedAt: new Date(),
        },
      })
      .returning();

    // ── Promote spark to "active" on first accept ─────────────────────────
    if (status === "accepted" && spark.status === "pending") {
      await db
        .update(sparks)
        .set({ status: "active" })
        .where(eq(sparks.id, sparkId));
    }

    res.json({
      ok:       true,
      response: upserted,
      spark: {
        id:       spark.id,
        title:    spark.title,
        location: spark.location,
        senderId: spark.senderId,
      },
    });
  } catch (err: any) {
    console.error("[spark-respond] error:", err.message);
    res.status(500).json({ message: `Failed query: ${err.message}` });
  }
}
