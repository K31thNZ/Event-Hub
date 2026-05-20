// server/recommendations.ts
import type { Express } from "express";
import { db } from "./db";
import { events, rsvps } from "@shared/schema";
import { requireAuth } from "./auth-client";
import { embedText } from "./embeddings";
import { eq, sql } from "drizzle-orm";

export function registerRecommendationRoutes(app: Express) {

  // GET /api/events/recommendations
  app.get("/api/events/recommendations", requireAuth, async (req: any, res) => {
    try {
      const userId = Number(req.user.id);

      // 1. Gather the user's RSVPs to build a taste profile
      const userRsvps = await db
        .select({ eventId: rsvps.eventId })
        .from(rsvps)
        .where(eq(rsvps.userId, userId))
        .limit(20);

      if (userRsvps.length === 0) {
        return res.json([]);
      }

      // 2. Fetch the embeddings of those events
      const eventIds = userRsvps.map(r => r.eventId);
      const likedEvents = await db
        .select({ embedding: events.embedding })
        .from(events)
        .where(sql`${events.id} = ANY(${eventIds}) AND ${events.embedding} IS NOT NULL`);

      const validEmbeddings = likedEvents
        .map(e => e.embedding)
        .filter((v): v is number[] => v != null && v.length > 0);

      if (validEmbeddings.length === 0) {
        return res.json([]);
      }

      // 3. Compute the average user vector
      const userVector = averageVectors(validEmbeddings);

      // 4. Serialize vector as a Postgres vector literal (e.g. '[0.1,0.2,...]')
      // pgvector expects a string like '[0.1, 0.2, ...]' when cast to ::vector
      const vectorLiteral = `[${userVector.join(",")}]`;

      // 5. Find the closest upcoming events (excluding already RSVP'd)
      // NOTE: schema defines vector(768) — Gemini text-embedding-004 produces 768 dims.
      const results = await db.execute(
        sql`SELECT id, title, description, category, date, venue_city, venue_address,
                   image_url, 1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
            FROM events
            WHERE published = true
              AND date > now()
              AND embedding IS NOT NULL
              AND id != ALL(${eventIds}::int[])
            ORDER BY embedding <=> ${vectorLiteral}::vector
            LIMIT 10`
      );

      res.json(results.rows);
    } catch (err: any) {
      console.error("[recommendations] Error:", err);
      res.status(500).json({ error: "Failed to generate recommendations" });
    }
  });
}

// Helper: average multiple vectors into one
function averageVectors(vectors: number[][]): number[] {
  const dim = vectors[0].length;
  const result = new Array(dim).fill(0);
  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      result[i] += vec[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    result[i] /= vectors.length;
  }
  return result;
}
