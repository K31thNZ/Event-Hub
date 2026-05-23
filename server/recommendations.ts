// server/recommendations.ts
import type { Express } from "express";
import { db } from "./db";
import { events, rsvps } from "@shared/schema";
import { requireAuth } from "./auth-client";
import { eq, sql, and, gt } from "drizzle-orm";

export function registerRecommendationRoutes(app: Express) {

  // GET /api/events/recommendations
  //
  // For users with RSVPs:  vector similarity against the user's taste profile.
  // For new users (0 RSVPs) or when embeddings are unavailable:
  //   falls back to "trending" — upcoming events ranked by RSVP count (going+maybe),
  //   then by soonest date, capped at 10.
  app.get("/api/events/recommendations", requireAuth, async (req: any, res) => {
    try {
      const userId = Number(req.user.id);

      // ── 1. Load the user's recent RSVPs ──────────────────────────────
      const userRsvps = await db
        .select({ eventId: rsvps.eventId })
        .from(rsvps)
        .where(eq(rsvps.userId, userId))
        .limit(20);

      const rsvpedIds: number[] = userRsvps.map(r => r.eventId);

      // ── 2. If the user has RSVPs, try vector similarity ───────────────
      if (rsvpedIds.length > 0) {
        const likedEvents = await db
          .select({ embedding: events.embedding })
          .from(events)
          .where(sql`${events.id} = ANY(${rsvpedIds}) AND ${events.embedding} IS NOT NULL`);

        const validEmbeddings = likedEvents
          .map(e => e.embedding)
          .filter((v): v is number[] => v != null && v.length > 0);

        if (validEmbeddings.length > 0) {
          // Compute average user vector
          const userVector    = averageVectors(validEmbeddings);
          const vectorLiteral = `[${userVector.join(",")}]`;

          // Find closest upcoming events (excluding already RSVP'd)
          const results = await db.execute(
            sql`SELECT id, title, description, category, date, venue_city, venue_address,
                       image_url, 1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
                FROM events
                WHERE published = true
                  AND date > now()
                  AND embedding IS NOT NULL
                  AND id != ALL(${rsvpedIds}::int[])
                ORDER BY embedding <=> ${vectorLiteral}::vector
                LIMIT 10`
          );

          if (results.rows.length > 0) {
            return res.json(results.rows);
          }
          // Vector search returned nothing (e.g. all upcoming events already RSVP'd)
          // — fall through to trending
        }
        // No embeddings yet — fall through to trending
      }

      // ── 3. Fallback: trending — upcoming events ranked by RSVP count ──
      // Uses a LEFT JOIN on rsvps to count going+maybe RSVPs without loading
      // every row into JS. Excludes events the user already RSVP'd to.
      const excludeClause = rsvpedIds.length > 0
        ? sql`AND e.id != ALL(${rsvpedIds}::int[])`
        : sql``;

      const trending = await db.execute(
        sql`SELECT
              e.id, e.title, e.description, e.category,
              e.date, e.venue_city, e.venue_address, e.image_url,
              COUNT(r.id) FILTER (WHERE r.status IN ('going','maybe')) AS rsvp_count
            FROM events e
            LEFT JOIN rsvps r ON r.event_id = e.id
            WHERE e.published = true
              AND e.date > now()
              ${excludeClause}
            GROUP BY e.id
            ORDER BY rsvp_count DESC, e.date ASC
            LIMIT 10`
      );

      return res.json(trending.rows);
    } catch (err: any) {
      console.error("[recommendations] Error:", err);
      res.status(500).json({ error: "Failed to generate recommendations" });
    }
  });
}

// Helper: average multiple embedding vectors into one
function averageVectors(vectors: number[][]): number[] {
  const dim    = vectors[0].length;
  const result = new Array<number>(dim).fill(0);
  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) result[i] += vec[i];
  }
  for (let i = 0; i < dim; i++) result[i] /= vectors.length;
  return result;
}
