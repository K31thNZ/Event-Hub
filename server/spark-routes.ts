// server/spark-routes.ts
//
// All Spark ("impromptu meetup ping") routes.
// Mount in server/routes.ts inside registerRoutes():
//   registerSparkRoutes(app);
//
// Endpoints:
//   GET    /api/sparks              — feed of active sparks (filtered to the viewer)
//   GET    /api/sparks/mine         — sparks sent by the current user
//   POST   /api/sparks              — send a new spark
//   DELETE /api/sparks/:id          — cancel a spark (sender only)
//   POST   /api/sparks/:id/respond  — accept or decline a spark
//   POST   /api/sparks/:id/confirm  — confirm specific respondents (sender only)

import type { Express } from "express";
import { db } from "./db";
import { sparks, sparkResponses } from "@shared/schema";
import { requireAuth, getUser } from "./auth-client";
import { eq, and, gte, inArray, desc, sql } from "drizzle-orm";
import { z } from "zod";

// ── Validation schemas ────────────────────────────────────────────────────────

const createSparkSchema = z.object({
  title:           z.string().min(3).max(100),
  description:     z.string().max(500).optional().default(""),
  activity:        z.string().min(1),
  location:        z.string().min(2).max(200),
  meetTime:        z.string().datetime(),                         // ISO string
  expiresInMins:   z.number().int().min(10).max(480).default(60), // 10 min – 8 hrs
  maxRespondents:  z.number().int().min(1).max(20).default(5),
  filterInterests: z.array(z.string()).max(5).optional(),
  filterLanguages: z.array(z.string()).max(5).optional(),
  filterMetroLine: z.string().optional().nullable(),
  // 🌍 Geo coordinates
  lat:             z.number().optional().nullable(),
  lng:             z.number().optional().nullable(),
});

const respondSchema = z.object({
  status:  z.enum(["accepted", "declined"]),
  message: z.string().max(300).optional(),
});

const confirmSchema = z.object({
  responderIds: z.array(z.string()).min(1).max(20),
});

// ── Helper: enrich spark rows with response data (without user relations) ─────
async function enrichSpark(spark: typeof sparks.$inferSelect, viewerUserId?: string) {
  const responses = await db.query.sparkResponses.findMany({
    where: eq(sparkResponses.sparkId, spark.id),
  });

  // Auto-expire: mark as expired if TTL passed and still pending
  if (spark.status === "pending" && new Date(spark.expires_at ?? spark.expiresAt) < new Date()) {
    await db.update(sparks).set({ status: "expired" }).where(eq(sparks.id, spark.id));
    spark = { ...spark, status: "expired" };
  }

  const myResponse = viewerUserId
    ? responses.find(r => r.responderId === viewerUserId) ?? null
    : null;

  return {
    ...spark,                                   // includes senderDisplayName, senderAvatarUrl, lat, lng
    responses,
    responseCount: responses.filter(r => r.status === "accepted").length,
    myResponse,
  };
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerSparkRoutes(app: Express) {

  // ── GET /api/sparks — feed of non-expired sparks for this user ──────────────
  app.get("/api/sparks", requireAuth, async (req: any, res) => {
    try {
      const viewerId = String(req.user.id);
      const now = new Date();

      const rows = await db.query.sparks.findMany({
        where: and(
          inArray(sparks.status, ["pending", "active"]),
          gte(sparks.expiresAt, now),
        ),
        orderBy: [sparks.meetTime],
      });

      const enriched = await Promise.all(rows.map(s => enrichSpark(s, viewerId)));
      res.json(enriched);
    } catch (err: any) {
      console.error("[GET /api/sparks]", err);
      res.status(500).json({ message: err.message ?? "Failed to fetch sparks" });
    }
  });

  // ── GET /api/sparks/mine — sparks sent by the current user ─────────────────
  app.get("/api/sparks/mine", requireAuth, async (req: any, res) => {
    try {
      const senderId = String(req.user.id);

      const rows = await db.query.sparks.findMany({
        where:   eq(sparks.senderId, senderId),
        orderBy: [desc(sparks.createdAt)],
      });

      const enriched = await Promise.all(rows.map(s => enrichSpark(s, senderId)));
      res.json(enriched);
    } catch (err: any) {
      console.error("[GET /api/sparks/mine]", err);
      res.status(500).json({ message: err.message ?? "Failed to fetch your sparks" });
    }
  });

  // ── POST /api/sparks — send a new spark ────────────────────────────────────
  app.post("/api/sparks", requireAuth, async (req: any, res) => {
    try {
      const parsed = createSparkSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.errors[0]?.message ?? "Validation error",
          field:   parsed.error.errors[0]?.path?.join("."),
        });
      }

      const d = parsed.data;
      const senderId = String(req.user.id);
      const meetTime = new Date(d.meetTime);
      const expiresAt = new Date(Date.now() + d.expiresInMins * 60 * 1000);

      if (meetTime < new Date()) {
        return res.status(400).json({ message: "Meet time must be in the future" });
      }

      const senderDisplayName = req.user.displayName ?? req.user.username ?? "Someone";
      const senderAvatarUrl   = req.user.avatarUrl ?? null;

      const [newSpark] = await db.insert(sparks).values({
        senderId,
        senderDisplayName,
        senderAvatarUrl,
        title:           d.title,
        description:     d.description,
        activity:        d.activity,
        location:        d.location,
        meetTime,
        expiresAt,
        maxRespondents:  d.maxRespondents,
        filterInterests: d.filterInterests ?? [],
        filterLanguages: d.filterLanguages ?? [],
        filterMetroLine: d.filterMetroLine ?? null,
        // 🌍 store coordinates if provided
        lat:             d.lat ?? null,
        lng:             d.lng ?? null,
        status:          "pending",
      }).returning();

      const enriched = await enrichSpark(newSpark, senderId);
      res.status(201).json(enriched);
    } catch (err: any) {
      console.error("[POST /api/sparks]", err);
      res.status(500).json({ message: err.message ?? "Failed to create spark" });
    }
  });

  // ── DELETE /api/sparks/:id — cancel (sender only) ──────────────────────────
  app.delete("/api/sparks/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid spark ID" });

      const spark = await db.query.sparks.findFirst({ where: eq(sparks.id, id) });
      if (!spark) return res.status(404).json({ message: "Spark not found" });
      if (spark.senderId !== String(req.user.id)) {
        return res.status(403).json({ message: "Only the sender can cancel a spark" });
      }

      await db.update(sparks).set({ status: "cancelled" }).where(eq(sparks.id, id));
      res.json({ success: true });
    } catch (err: any) {
      console.error("[DELETE /api/sparks/:id]", err);
      res.status(500).json({ message: err.message ?? "Failed to cancel spark" });
    }
  });

  // ── POST /api/sparks/:id/respond — accept or decline ───────────────────────
  app.post("/api/sparks/:id/respond", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid spark ID" });

      const parsed = respondSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Validation error" });
      }

      const spark = await db.query.sparks.findFirst({ where: eq(sparks.id, id) });
      if (!spark) return res.status(404).json({ message: "Spark not found" });
      if (spark.status === "expired" || spark.status === "cancelled") {
        return res.status(400).json({ message: "This spark is no longer active" });
      }
      if (new Date(spark.expiresAt) < new Date()) {
        await db.update(sparks).set({ status: "expired" }).where(eq(sparks.id, id));
        return res.status(400).json({ message: "This spark has expired" });
      }

      const responderId = String(req.user.id);
      if (spark.senderId === responderId) {
        return res.status(400).json({ message: "You cannot respond to your own spark" });
      }

      if (parsed.data.status === "accepted") {
        const acceptedCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(sparkResponses)
          .where(and(
            eq(sparkResponses.sparkId, id),
            eq(sparkResponses.status, "accepted"),
          ));
        if ((acceptedCount[0]?.count ?? 0) >= spark.maxRespondents) {
          return res.status(400).json({ message: "This spark is full" });
        }
      }

      const existing = await db.query.sparkResponses.findFirst({
        where: and(
          eq(sparkResponses.sparkId, id),
          eq(sparkResponses.responderId, responderId),
        ),
      });

      let response;
      if (existing) {
        [response] = await db
          .update(sparkResponses)
          .set({ status: parsed.data.status, message: parsed.data.message ?? null })
          .where(eq(sparkResponses.id, existing.id))
          .returning();
      } else {
        [response] = await db.insert(sparkResponses).values({
          sparkId:     id,
          responderId,
          status:      parsed.data.status,
          message:     parsed.data.message ?? null,
        }).returning();
      }

      if (parsed.data.status === "accepted" && spark.status === "pending") {
        await db.update(sparks).set({ status: "active" }).where(eq(sparks.id, id));
      }

      res.json(response);
    } catch (err: any) {
      console.error("[POST /api/sparks/:id/respond]", err);
      res.status(500).json({ message: err.message ?? "Failed to respond to spark" });
    }
  });

  // ── POST /api/sparks/:id/confirm — sender confirms specific people ──────────
  app.post("/api/sparks/:id/confirm", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid spark ID" });

      const parsed = confirmSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "responderIds must be a non-empty array" });
      }

      const spark = await db.query.sparks.findFirst({ where: eq(sparks.id, id) });
      if (!spark) return res.status(404).json({ message: "Spark not found" });
      if (spark.senderId !== String(req.user.id)) {
        return res.status(403).json({ message: "Only the sender can confirm a spark" });
      }

      const allResponses = await db.query.sparkResponses.findMany({
        where: eq(sparkResponses.sparkId, id),
      });

      for (const r of allResponses) {
        const isConfirmed = parsed.data.responderIds.includes(r.responderId);
        await db.update(sparkResponses)
          .set({ status: isConfirmed ? "confirmed" : "declined" })
          .where(eq(sparkResponses.id, r.id));
      }

      await db.update(sparks).set({ status: "confirmed" }).where(eq(sparks.id, id));
      res.json({ success: true, confirmed: parsed.data.responderIds.length });
    } catch (err: any) {
      console.error("[POST /api/sparks/:id/confirm]", err);
      res.status(500).json({ message: err.message ?? "Failed to confirm spark" });
    }
  });
}
