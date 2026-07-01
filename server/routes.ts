import { botSparkRouter, handleSparkRespond } from "./routes/bot-spark-routes";
import { registerAdminRoutes } from "./admin-routes";
import { registerGroupRoutes } from "./group-routes";
import { registerSparkRoutes } from "./spark-routes";
import { scheduleTicketReminders } from "./ticket-reminders";
import { registerPicksRoutes } from "./picks-routes";
import { registerNotifyRoutes } from "./notify-routes";
import { registerRecommendationRoutes } from "./recommendations";
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, buildUrl } from "@shared/routes";
import { requireAuth, getUser } from "./auth-client";
import { z } from "zod";
import { db } from "./db";
import { sql, desc, gt, eq, and } from "drizzle-orm";
import { events, groups, rsvps, eventReviews, guides } from "@shared/schema";
import { inArray } from "drizzle-orm";
import uploadRouter from "./routes/upload";

// NOTE: No local users table in Event-Hub DB.
// User identity and Telegram linking are managed by the meh-auth service.
// All userId / organizerId / attendeeId values are meh-auth integer IDs.

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? "https://auth.expatevents.org";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Register external route modules
  registerPicksRoutes(app);
  registerGroupRoutes(app);
  registerSparkRoutes(app);
  registerAdminRoutes(app);
  registerNotifyRoutes(app);
  registerRecommendationRoutes(app);


  // ── Sitemap ──────────────────────────────────────────────────────────
  // Server-rendered XML sitemap — covers all published events and groups.
  // Bots and Google see real URLs; regenerated on every request (cheap query).
  const SITE_URL = (process.env.APP_URL ?? "https://expatevents.org").replace(/\/$/, "");

  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const now = new Date();

      const [allEvents, allGroups] = await Promise.all([
        db
          .select({ id: events.id, updatedAt: events.createdAt })
          .from(events)
          .where(sql`${events.published} = true`)
          .orderBy(desc(events.createdAt))
          .limit(5000),
        db
          .select({ slug: groups.slug, updatedAt: groups.updatedAt })
          .from(groups)
          .orderBy(desc(groups.updatedAt))
          .limit(1000),
      ]);

      const staticPages = [
        { loc: `/`,         priority: "1.0", changefreq: "daily"   },
        { loc: `/groups`,   priority: "0.8", changefreq: "daily"   },
        { loc: `/language`, priority: "0.7", changefreq: "weekly"  },
      ];

      const urls = [
        ...staticPages.map(p =>
          `  <url>\n    <loc>${SITE_URL}${p.loc}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`
        ),
        ...allEvents.map(e =>
          `  <url>\n    <loc>${SITE_URL}/events/${e.id}</loc>\n    <lastmod>${(e.updatedAt ?? now).toISOString().split("T")[0]}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>`
        ),
        ...allGroups.map(g =>
          `  <url>\n    <loc>${SITE_URL}/groups/${g.slug}</loc>\n    <lastmod>${(g.updatedAt ?? now).toISOString().split("T")[0]}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`
        ),
      ];

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;

      res
        .status(200)
        .set("Content-Type", "application/xml; charset=utf-8")
        .set("Cache-Control", "public, max-age=3600")   // 1 hr CDN cache
        .end(xml);
    } catch (err: any) {
      console.error("[sitemap] error:", err.message);
      res.status(500).end("<?xml version=\"1.0\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"/>");
    }
  });

  // ── Server‑mediated uploads ────────────────────────────────────────
  // ── Admin: Cloudinary URL audit ───────────────────────────────────────────
  // GET /api/admin/cloudinary-check — lists events still using Cloudinary CDN
  // URLs so they can be re-migrated to R2 before they 404.
  app.get("/api/admin/cloudinary-check", async (_req, res) => {
    try {
      const rows = await db.execute(
        sql`SELECT id, title, image_url
            FROM events
            WHERE image_url LIKE '%cloudinary.com%'
            ORDER BY id`
      );
      res.json({
        count:  rows.rows.length,
        events: rows.rows,
        status: rows.rows.length === 0 ? "clean" : "needs_migration",
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.use(uploadRouter);

  // ── Spark‑bot API ───────────────────────────────────────────────────
  app.use("/api/bot", botSparkRouter);
  app.post("/api/sparks/:id/respond", requireAuth, handleSparkRespond);

  // ── Live Map: today's events in Moscow timezone ────────────────────
  app.get("/api/live-map-events", async (req, res) => {
    try {
      const todayEvents = await db.execute(sql`
        SELECT 
          id, title, description, category,
          date AT TIME ZONE 'Europe/Moscow' AS local_time,
          venue_address, venue_city, lat, lng, image_url, published, source_url
        FROM events
        WHERE 
          (date AT TIME ZONE 'Europe/Moscow')::date = (NOW() AT TIME ZONE 'Europe/Moscow')::date
          AND lat IS NOT NULL
          AND venue_address != 'Online'
        ORDER BY date ASC
      `);

      const onlineEvents = await db.execute(sql`
        SELECT 
          id, title, description, category,
          date AT TIME ZONE 'Europe/Moscow' AS local_time,
          venue_address, image_url, published, source_url
        FROM events
        WHERE 
          (date AT TIME ZONE 'Europe/Moscow')::date = (NOW() AT TIME ZONE 'Europe/Moscow')::date
          AND venue_address = 'Online'
        ORDER BY date ASC
      `);

      const formattedDate = new Date().toLocaleDateString("en-GB", {
        timeZone: "Europe/Moscow",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      res.json({
        events: todayEvents.rows,
        online_events: onlineEvents.rows,
        total: todayEvents.rows.length + onlineEvents.rows.length,
        date: formattedDate,
      });
    } catch (err) {
      console.error("Live map error:", err);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  // ── Geocoding endpoints ───────────────────────────────────────────
  app.post("/api/forward-geocode", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Missing query" });
      }
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
      const response = await fetch(url, {
        headers: { "User-Agent": "ExpatEvents/1.0" },
      });
      const data = await response.json();
      if (!data || data.length === 0) {
        return res.status(404).json({ error: "Location not found" });
      }
      res.json({
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      });
    } catch (error) {
      console.error("Forward geocode error:", error);
      res.status(500).json({ error: "Failed to geocode" });
    }
  });

  app.post("/api/reverse-geocode", async (req, res) => {
    try {
      const { lat, lng } = req.body;
      if (typeof lat !== "number" || typeof lng !== "number") {
        return res.status(400).json({ error: "Invalid coordinates" });
      }
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
      const response = await fetch(url, {
        headers: { "User-Agent": "ExpatEvents/1.0" },
      });
      const data = await response.json();
      if (!data || !data.address) {
        return res.status(404).json({ error: "Address not found" });
      }
      const a = data.address;
      const road = a.road ?? a.pedestrian ?? a.footway ?? "";
      const houseNo = a.house_number ?? "";
      let address = [road, houseNo].filter(Boolean).join(", ");
      if (!address && data.display_name) address = data.display_name.split(",")[0];
      const city = a.city ?? a.town ?? a.village ?? a.county ?? "";
      res.json({ address, city });
    } catch (error) {
      console.error("Reverse geocode error:", error);
      res.status(500).json({ error: "Failed to reverse geocode" });
    }
  });

  // ── Current authenticated user (proxied from meh-auth) ───────────
  app.get("/api/user", async (req, res) => {
    try {
      const user = await getUser(req);
      if (!user) return res.status(401).json(null);
      res.json(user);
    } catch (err) {
      console.error("[/api/user]", err);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // ── Current user admin status (derived from meh-auth role) ───────
  // NOTE: Admin status comes from req.user.role, NOT a local DB table.
  app.get("/api/me", requireAuth, async (req, res) => {
    try {
      res.json({ isAdmin: req.user?.role === "admin" });
    } catch (err) {
      console.error("[/api/me]", err);
      res.json({ isAdmin: false });
    }
  });

  // ── Telegram routes ────────────────────────────────────────────────
  // Telegram linking is handled by the meh-auth bot. These routes
  // proxy to meh-auth so the client doesn't need to know the auth URL.
  const SERVICE_SECRET = process.env.SERVICE_SECRET;

  app.get("/api/telegram/status", (_req, res) => {
    const configured = !!(process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_USERNAME);
    res.json({ configured });
  });

  // Proxy: generate a Telegram link token via meh-auth
  app.post("/api/telegram/link", requireAuth, async (req, res) => {
    try {
      const response = await fetch(`${AUTH_SERVICE_URL}/api/telegram/link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: req.headers.cookie ?? "",
          ...(SERVICE_SECRET ? { "x-service-secret": SERVICE_SECRET } : {}),
        },
      });
      
      // Check if response is successful before trying to parse JSON
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[/api/telegram/link] Error response:", errorText);
        return res.status(response.status).json({ 
          message: "Failed to generate Telegram link",
          error: errorText 
        });
      }

      const body = await response.json();
      res.status(response.status).json(body);
    } catch (err: any) {
      console.error("[/api/telegram/link]", err);
      res.status(500).json({ message: "Failed to generate Telegram link" });
    }
  });

  // Proxy: unlink Telegram via meh-auth
  app.post("/api/telegram/unlink", requireAuth, async (req, res) => {
    try {
      const response = await fetch(`${AUTH_SERVICE_URL}/api/telegram/unlink`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: req.headers.cookie ?? "",
          ...(SERVICE_SECRET ? { "x-service-secret": SERVICE_SECRET } : {}),
        },
      });
      
      // Check if response is successful before trying to parse JSON
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[/api/telegram/unlink] Error response:", errorText);
        return res.status(response.status).json({ 
          message: "Failed to unlink Telegram account",
          error: errorText 
        });
      }

      const body = await response.json();
      res.status(response.status).json(body);
    } catch (err: any) {
      console.error("[/api/telegram/unlink]", err);
      res.status(500).json({ message: "Failed to unlink Telegram account" });
    }
  });

  // ── Events ────────────────────────────────────────────────────────
  app.get(api.events.list.path, async (req, res) => {
    try {
      const { search, category, city } = req.query;
      const events = await storage.getEvents({
        search: search as string | undefined,
        category: category as string | undefined,
        city: city as string | undefined,
      });
      res.json(events);
    } catch (err) {
      console.error("[GET /api/events]", err);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get(api.events.myEvents.path, requireAuth, async (req, res) => {
    try {
      const events = await storage.getEventsByOrganizer(Number(req.user?.id));
      res.json(events);
    } catch (err) {
      console.error("[GET /api/events/me]", err);
      res.status(500).json({ message: "Failed to fetch your events" });
    }
  });

  app.get(api.events.get.path, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid event ID" });
      const event = await storage.getEvent(id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      res.json(event);
    } catch (err) {
      console.error("[GET /api/events/:id]", err);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.post(api.events.create.path, requireAuth, async (req, res) => {
    try {
      const parsed = api.events.create.input.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.errors[0]?.message ?? "Validation error",
          field: parsed.error.errors[0]?.path?.join("."),
        });
      }
      // req.user.id is a number from meh-auth
      const event = await storage.createEvent(Number(req.user?.id), parsed.data);
      res.status(201).json(event);
    } catch (err: any) {
      console.error("[POST /api/events]", err);
      res.status(500).json({ message: err.message ?? "Failed to create event" });
    }
  });

  app.patch(api.events.update.path, requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid event ID" });
      const existing = await storage.getEvent(id);
      if (!existing) return res.status(404).json({ message: "Event not found" });
      // Authorization: organizer or admin (role from meh-auth, no local DB lookup needed)
      const isOrganizer = existing.organizerId === Number(req.user?.id);
      const isAdmin = req.user?.role === "admin";
      if (!isOrganizer && !isAdmin) {
        return res.status(403).json({ message: "Not authorized to update this event" });
      }
      const parsed = api.events.update.input.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Validation error" });
      }
      const updated = await storage.updateEvent(id, parsed.data);
      res.json(updated);
    } catch (err: any) {
      console.error("[PATCH /api/events/:id]", err);
      res.status(500).json({ message: err.message ?? "Failed to update event" });
    }
  });

  app.delete(api.events.delete.path, requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid event ID" });
      const existing = await storage.getEvent(id);
      if (!existing) return res.status(404).json({ message: "Event not found" });
      const isOrganizer = existing.organizerId === Number(req.user?.id);
      const isAdmin = req.user?.role === "admin";
      if (!isOrganizer && !isAdmin) {
        return res.status(403).json({ message: "Not authorized to delete this event" });
      }
      await storage.deleteEvent(id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[DELETE /api/events/:id]", err);
      res.status(500).json({ message: err.message ?? "Failed to delete event" });
    }
  });


  // ── Resend event notification ──────────────────────────────────────────────
  app.post("/api/events/:id/resend-notification", requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid event ID" });
      const event = await storage.getEvent(id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      const isOrganizer = event.organizerId === Number(req.user?.id);
      const isAdmin = req.user?.role === "admin";
      if (!isOrganizer && !isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const authUrl = process.env.AUTH_SERVICE_URL ?? "https://auth.expatevents.org";
      const secret  = process.env.SERVICE_SECRET;
      const notifyRes = await fetch(`${authUrl}/api/notify/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-service-secret": secret ?? "" },
        body: JSON.stringify({
          id:           event.id,
          title:        event.title,
          category:     event.category,
          date:         event.date,
          venueCity:    event.venueCity,
          venueAddress: event.venueAddress,
          locationName: event.locationName ?? undefined,
          description:  event.description,
          imageUrl:     event.imageUrl ?? undefined,
          organizerId:  event.organizerId ?? undefined,
        }),
      });
      if (!notifyRes.ok) {
        const body = await notifyRes.text();
        return res.status(502).json({ message: `Notification service error: ${body}` });
      }
      const data = await notifyRes.json();
      res.json({ ok: true, sent: data.sent, inApp: data.inApp });
    } catch (err: any) {
      console.error("[POST /api/events/:id/resend-notification]", err);
      res.status(500).json({ message: err.message ?? "Failed to resend notification" });
    }
  });


  // ── Web RSVP (authenticated users from mini-app / website) ─────────────
  app.post("/api/events/:id/rsvp", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(String(req.params.id), 10);
      if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event ID" });
      const { status } = req.body;
      if (!status || !["going", "maybe", "no", "none"].includes(status)) {
        return res.status(400).json({ error: "status must be going | maybe | none" });
      }
      const userId = Number(req.user?.id);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      if (status === "none") {
        await db.delete(rsvps).where(
          and(eq(rsvps.eventId, eventId), eq(rsvps.userId, userId))
        );
      } else {
        await db
          .insert(rsvps)
          .values({ userId, eventId, status, source: "web", updatedAt: new Date() })
          .onConflictDoUpdate({
            target: [rsvps.eventId, rsvps.userId],
            set:    { status, source: "web", updatedAt: new Date() },
          });
      }

      // Fetch live counts
      const countRows = await db.execute(
        sql`SELECT status, COUNT(*)::int AS count FROM rsvps
            WHERE event_id = ${eventId} GROUP BY status`
      );
      const counts: Record<string, number> = {};
      for (const row of (countRows as any).rows ?? countRows) {
        counts[(row as any).status] = Number((row as any).count);
      }

      // A3 fix: fetch real ticket count so organiser notification shows correct number
      const authUrl = process.env.AUTH_SERVICE_URL ?? "https://auth.expatevents.org";
      const secret  = process.env.SERVICE_SECRET ?? "";
      (async () => {
        let ticketCount = 0;
        try {
          const tcRows = await db.execute(
            sql`SELECT COUNT(*)::int AS count FROM orders WHERE event_id = ${eventId} AND status = 'paid'`
          );
          ticketCount = Number(((tcRows as any).rows?.[0] ?? (tcRows as any)[0])?.count ?? 0);
        } catch { /* non-fatal */ }
        fetch(`${authUrl}/api/notify/rsvp`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", "x-service-secret": secret },
          body:    JSON.stringify({ eventId, userId, status, going: counts["going"] ?? 0, maybe: counts["maybe"] ?? 0, no: counts["no"] ?? 0, ticketCount }),
        }).catch(() => {});
      })();

      res.json({ ok: true, status, counts: { going: counts["going"] ?? 0, maybe: counts["maybe"] ?? 0, no: counts["no"] ?? 0 } });
    } catch (err: any) {
      console.error("[POST /api/events/:id/rsvp]", err);
      res.status(500).json({ error: err.message ?? "Failed to save RSVP" });
    }
  });

  // ── GET current user RSVP status ─────────────────────────────────────────
  app.get("/api/events/:id/rsvp", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(String(req.params.id), 10);
      if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event ID" });
      const userId = Number(req.user?.id);
      const [row] = await db
        .select({ status: rsvps.status })
        .from(rsvps)
        .where(and(eq(rsvps.eventId, eventId), eq(rsvps.userId, userId)));
      res.json({ status: row?.status ?? null });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET RSVP counts for an event (public) ────────────────────────────────
  app.get("/api/events/:id/rsvp-counts", async (req, res) => {
    try {
      const eventId = parseInt(String(req.params.id), 10);
      if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event ID" });
      const countRows = await db.execute(
        sql`SELECT status, COUNT(*)::int AS count FROM rsvps
            WHERE event_id = ${eventId} GROUP BY status`
      );
      const counts: Record<string, number> = {};
      for (const row of (countRows as any).rows ?? countRows) {
        counts[(row as any).status] = Number((row as any).count);
      }
      res.json({ going: counts["going"] ?? 0, maybe: counts["maybe"] ?? 0 });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Orders ─────────────────────────────────────────────────────────
  app.get(api.orders.myOrders.path, requireAuth, async (req, res) => {
    try {
      const orders = await storage.getOrdersByAttendee(Number(req.user?.id));
      res.json(orders);
    } catch (err) {
      console.error("[GET /api/orders/me]", err);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get(api.orders.get.path, requireAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid order ID" });
      const order = await storage.getOrder(id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      const isOwner = order.attendeeId === Number(req.user?.id);
      const isAdmin = req.user?.role === "admin";
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "Not authorized to view this order" });
      }
      res.json(order);
    } catch (err) {
      console.error("[GET /api/orders/:id]", err);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.post(api.orders.create.path, requireAuth, async (req, res) => {
    try {
      const parsed = api.orders.create.input.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.errors[0]?.message ?? "Validation error",
          field: parsed.error.errors[0]?.path?.join("."),
        });
      }
      const event = await storage.getEvent(parsed.data.eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });
      const order = await storage.createOrder(Number(req.user?.id), parsed.data);
      res.status(201).json(order);
    } catch (err: any) {
      console.error("[POST /api/orders]", err);
      res.status(500).json({ message: err.message ?? "Failed to create order" });
    }
  });


  // ══════════════════════════════════════════════════════════════════════════
  // ── Attendees & Reviews ────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/events/:id/attendees
  // Returns RSVPs enriched with display data from meh-auth.
  // Visible to anyone (counts), full list to organiser or admin.
  app.get("/api/events/:id/attendees", async (req, res) => {
    try {
      const eventId = parseInt(String(req.params.id), 10);
      if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event ID" });

      const event = await storage.getEvent(eventId);
      if (!event) return res.status(404).json({ error: "Event not found" });

      const reqUserId = (req as any).user?.id ? Number((req as any).user.id) : null;
      const isOrganizer = reqUserId === event.organizerId;
      const isAdmin = (req as any).user?.role === "admin";

      // Fetch all RSVPs for this event
      const rsvpRows = await db
        .select()
        .from(rsvps)
        .where(eq(rsvps.eventId, eventId));

      if (rsvpRows.length === 0) {
        return res.json({ going: [], maybe: [], attendedCount: 0 });
      }

      // Enrich with meh-auth user data
      const userIds = [...new Set(rsvpRows.map(r => r.userId))];
      let userMap: Record<number, { id: number; displayName: string | null; avatarUrl: string | null; username: string }> = {};

      try {
        const secret = process.env.SERVICE_SECRET ?? process.env.EXPAT_API_SECRET ?? "";
        const authRes = await fetch(`${AUTH_SERVICE_URL}/api/admin/users/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-service-secret": secret },
          body: JSON.stringify({ ids: userIds }),
        });
        if (authRes.ok) {
          const users = await authRes.json() as any[];
          for (const u of users) userMap[u.id] = u;
        }
      } catch { /* enrichment failure is non-fatal — show anonymised list */ }

      // Build enriched attendee objects
      const enrich = (r: typeof rsvpRows[0]) => ({
        userId:      r.userId,
        status:      r.status,
        attended:    r.attended,
        displayName: userMap[r.userId]?.displayName ?? userMap[r.userId]?.username ?? "Member",
        avatarUrl:   userMap[r.userId]?.avatarUrl ?? null,
        // Only expose userId link to organiser/admin (privacy)
        profileLink: (isOrganizer || isAdmin) ? `/profile/${r.userId}` : null,
      });

      const going = rsvpRows.filter(r => r.status === "going").map(enrich);
      const maybe = rsvpRows.filter(r => r.status === "maybe").map(enrich);
      const attendedCount = rsvpRows.filter(r => r.attended).length;

      res.json({ going, maybe, attendedCount });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/events/:id/attendees/:userId/attended
  // Organiser marks a specific RSVP as attended=true/false.
  app.post("/api/events/:id/attendees/:userId/attended", requireAuth, async (req, res) => {
    try {
      const eventId  = parseInt(String(req.params.id), 10);
      const targetId = parseInt(String(req.params.userId), 10);
      if (isNaN(eventId) || isNaN(targetId)) return res.status(400).json({ error: "Invalid ID" });

      const event = await storage.getEvent(eventId);
      if (!event) return res.status(404).json({ error: "Event not found" });

      const reqUserId = Number((req as any).user?.id);
      const isOrganizer = reqUserId === event.organizerId;
      const isAdmin = (req as any).user?.role === "admin";
      if (!isOrganizer && !isAdmin) return res.status(403).json({ error: "Only the organiser can mark attendance" });

      const { attended } = req.body as { attended: boolean };
      if (typeof attended !== "boolean") return res.status(400).json({ error: "attended must be boolean" });

      await db
        .update(rsvps)
        .set({ attended })
        .where(and(eq(rsvps.eventId, eventId), eq(rsvps.userId, targetId)));

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/events/:id/reviews
  // Public — returns all reviews with rating, comment, display name, avatar.
  app.get("/api/events/:id/reviews", async (req, res) => {
    try {
      const eventId = parseInt(String(req.params.id), 10);
      if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event ID" });

      const reviews = await db
        .select()
        .from(eventReviews)
        .where(eq(eventReviews.eventId, eventId))
        .orderBy(desc(eventReviews.createdAt));

      const avgRating = reviews.length
        ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
        : null;

      res.json({ reviews, avgRating, count: reviews.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/events/:id/reviews
  // Submit or update a review. Caller must have RSVPd (going or maybe) or been marked attended.
  app.post("/api/events/:id/reviews", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(String(req.params.id), 10);
      if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event ID" });

      const userId = Number((req as any).user?.id);
      const { rating, comment } = req.body as { rating: number; comment?: string };

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "rating must be 1–5" });
      }

      // Check that this user actually RSVPd or was marked attended
      const [rsvpRow] = await db
        .select()
        .from(rsvps)
        .where(and(eq(rsvps.eventId, eventId), eq(rsvps.userId, userId)));

      if (!rsvpRow) {
        return res.status(403).json({ error: "You must have RSVPd to leave a review" });
      }

      // Fetch display name + avatar from meh-auth
      let displayName: string | null = null;
      let avatarUrl: string | null = null;
      try {
        const secret = process.env.SERVICE_SECRET ?? process.env.EXPAT_API_SECRET ?? "";
        const authRes = await fetch(`${AUTH_SERVICE_URL}/api/admin/users/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-service-secret": secret },
          body: JSON.stringify({ ids: [userId] }),
        });
        if (authRes.ok) {
          const [u] = await authRes.json() as any[];
          displayName = u?.displayName ?? u?.username ?? null;
          avatarUrl   = u?.avatarUrl ?? null;
        }
      } catch {}

      const [review] = await db
        .insert(eventReviews)
        .values({ eventId, userId, rating, comment: comment?.trim() || null, displayName, avatarUrl })
        .onConflictDoUpdate({
          target: [eventReviews.eventId, eventReviews.userId],
          set: { rating, comment: comment?.trim() || null, displayName, avatarUrl },
        })
        .returning();

      res.status(201).json(review);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/users/:userId/public
  // Returns safe public fields for any meh-auth user, proxied to meh-auth.
  app.get("/api/users/:userId/public", async (req, res) => {
    try {
      const userId = parseInt(String(req.params.userId), 10);
      if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });

      // Proxy to meh-auth using service secret
      const secret = process.env.SERVICE_SECRET ?? process.env.EXPAT_API_SECRET ?? "";
      const authRes = await fetch(`${AUTH_SERVICE_URL}/api/users/${userId}/public`, {
        headers: { "x-service-secret": secret },
      });

      if (authRes.status === 404) return res.status(404).json({ error: "User not found" });
      if (!authRes.ok) return res.status(502).json({ error: "Auth service unavailable" });

      const data = await authRes.json();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/users/:userId/events
  // Returns public events organised by a given user (for profile page).
  app.get("/api/users/:userId/events", async (req, res) => {
    try {
      const userId = parseInt(String(req.params.userId), 10);
      if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });

      const userEvents = await db
        .select()
        .from(events)
        .where(and(eq(events.organizerId, userId), eq(events.published, true)))
        .orderBy(desc(events.date))
        .limit(12);

      res.json(userEvents);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


    // ── Guides (Knowledge Base) ───────────────────────────────────────────────
  // Queries the local Neon postgres guides table via Drizzle.



  // ── Admin: Guide submissions ───────────────────────────────────────────────

  // GET /api/admin/guides/pending — all unpublished community submissions
  app.get("/api/admin/guides/pending", requireAuth, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    try {
      const rows = await db
        .select()
        .from(guides)
        .where(eq(guides.isPublished, false))
        .orderBy(desc(guides.createdAt));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/admin/guides/:id/approve — publish a submitted guide
  app.patch("/api/admin/guides/:id/approve", requireAuth, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    try {
      await db
        .update(guides)
        .set({ isPublished: true, updatedAt: new Date() })
        .where(eq(guides.id, Number(req.params.id)));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/admin/guides/:id — reject & delete a submission
  app.delete("/api/admin/guides/:id", requireAuth, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    try {
      await db
        .delete(guides)
        .where(eq(guides.id, Number(req.params.id)));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/guides/submit — community submission, saved unpublished for admin review
  app.post("/api/guides/submit", async (req, res) => {
    try {
      const { title, pillar, category, summary, body, sources } = req.body ?? {};
      if (!title || !pillar || !category || !summary || !body) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      if (summary.trim().length < 20 || body.trim().length < 100) {
        return res.status(400).json({ error: "Summary or body too short" });
      }

      // Derive a URL-safe slug from the title
      const baseSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 80);

      // Ensure uniqueness by appending a short timestamp suffix if needed
      const slug = `${baseSlug}-${Date.now().toString(36)}`;

      // Wrap plain-text body in basic HTML paragraphs
      const body_html = body
        .split(/\n{2,}/)
        .map((p: string) => `<p>${p.trim().replace(/\n/g, "<br>")}</p>`)
        .join("
");

      await db.insert(guides).values({
        title:       title.trim(),
        slug,
        pillar,
        category,
        summary:     summary.trim(),
        body_html,
        sources:     sources?.trim() ?? null,
        authorLabel: "Community Contributor",
        isCommunity: true,
        isPublished: false,   // pending admin review
        pinned:      false,
      });

      res.json({ ok: true, message: "Guide submitted for review" });
    } catch (err: any) {
      console.error("Guide submit error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/guides — list all published guides, pinned first
  app.get("/api/guides", async (_req, res) => {
    try {
      const rows = await db
        .select()
        .from(guides)
        .where(eq(guides.isPublished, true))
        .orderBy(desc(guides.pinned), desc(guides.createdAt));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/guides/:slug — single guide by slug, increments view count
  app.get("/api/guides/:slug", async (req, res) => {
    try {
      const rows = await db
        .select()
        .from(guides)
        .where(and(eq(guides.slug, req.params.slug), eq(guides.isPublished, true)))
        .limit(1);
      if (!rows.length) return res.status(404).json({ error: "Guide not found" });
      db.update(guides)
        .set({ viewCount: rows[0].viewCount! + 1 })
        .where(eq(guides.id, rows[0].id))
        .catch(() => {});
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Start background jobs ──────────────────────────────────────────
  scheduleTicketReminders();

  return httpServer;
}
