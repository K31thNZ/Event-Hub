
import { registerAdminRoutes } from "./admin-routes";
import { registerGroupRoutes } from "./group-routes";
import { registerSparkRoutes } from "./spark-routes";
import { scheduleTicketReminders } from "./ticket-reminders";
import { registerPicksRoutes } from "./picks-routes";
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, buildUrl } from "@shared/routes";
import { requireAuth, getUser } from "./auth-client";
import { z } from "zod";
import { db } from "./db";
import { users } from "@shared/models/auth";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";
import uploadRouter from "./routes/upload";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Register external route modules (ensure these files exist)
  registerPicksRoutes(app);
  registerGroupRoutes(app);
  registerSparkRoutes(app);
  registerAdminRoutes(app);

  // ── Server‑mediated uploads (avatars + event images) ────────────────
  app.use(uploadRouter);

  // ── Live Map: get today's events in Moscow timezone ─────────────────
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
  // (these are fine; consider adding a simple in‑memory cache for repeated queries)
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

  // ── Current authenticated user ────────────────────────────────────
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

  // ── Current user profile (local DB) ───────────────────────────────
  app.get("/api/me", requireAuth, async (req: any, res) => {
    try {
      const localUser = await db.query.users.findFirst({
        where: eq(users.id, String(req.user.id)),
      });
      res.json({ isAdmin: localUser?.isAdmin ?? false });
    } catch (err) {
      console.error("[/api/me]", err);
      res.json({ isAdmin: false });
    }
  });

  // ── Telegram routes ────────────────────────────────────────────────
  const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN;
  const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "meh_auth_bot";

  const generateLinkToken = () => crypto.randomBytes(32).toString("hex");
  const linkTokens = new Map<string, { userId: string; expires: number }>();

  app.get("/api/telegram/status", (_req, res) => {
    res.json({ configured: !!BOT_TOKEN });
  });

  app.post("/api/telegram/link", requireAuth, async (req: any, res) => {
    if (!BOT_TOKEN) {
      return res.status(503).json({ message: "Telegram bot is not configured" });
    }
    const userId = String(req.user.id);
    const token = generateLinkToken();
    linkTokens.set(token, { userId, expires: Date.now() + 10 * 60 * 1000 });
    const deepLink = `https://t.me/${BOT_USERNAME}?start=link_${token}`;
    res.json({ url: deepLink });
  });

  app.post("/api/telegram/webhook", async (req, res) => {
    const update = req.body;
    try {
      if (update.message?.text?.startsWith("/start")) {
        const match = update.message.text.match(/\/start link_([a-f0-9]+)/);
        if (match) {
          const token = match[1];
          const data = linkTokens.get(token);
          if (data && data.expires > Date.now()) {
            const telegramId = String(update.message.from.id);
            await db.update(users).set({ telegramId }).where(eq(users.id, data.userId));
            linkTokens.delete(token);
          }
        }
      }
      res.sendStatus(200);
    } catch (err) {
      console.error("Webhook error:", err);
      res.sendStatus(500);
    }
  });

  app.post("/api/telegram/unlink", requireAuth, async (req: any, res) => {
    try {
      await db.update(users).set({ telegramId: null }).where(eq(users.id, String(req.user.id)));
      res.json({ success: true });
    } catch (err) {
      console.error("Unlink error:", err);
      res.status(500).json({ message: "Failed to unlink Telegram account" });
    }
  });

  // ── Events ────────────────────────────────────────────────────────
  // All the event/order routes are already defined via `api` object
  // (keep as they are – they use `storage.getEvents` etc.)

  // GET /api/events
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

  // GET /api/events/me
  app.get(api.events.myEvents.path, requireAuth, async (req: any, res) => {
    try {
      const events = await storage.getEventsByOrganizer(String(req.user.id));
      res.json(events);
    } catch (err) {
      console.error("[GET /api/events/me]", err);
      res.status(500).json({ message: "Failed to fetch your events" });
    }
  });

  // GET /api/events/:id
  app.get(api.events.get.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid event ID" });
      const event = await storage.getEvent(id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      res.json(event);
    } catch (err) {
      console.error("[GET /api/events/:id]", err);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  // POST /api/events
  app.post(api.events.create.path, requireAuth, async (req: any, res) => {
    try {
      const parsed = api.events.create.input.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.errors[0]?.message ?? "Validation error",
          field: parsed.error.errors[0]?.path?.join("."),
        });
      }
      const event = await storage.createEvent(String(req.user.id), parsed.data);
      res.status(201).json(event);
    } catch (err: any) {
      console.error("[POST /api/events]", err);
      res.status(500).json({ message: err.message ?? "Failed to create event" });
    }
  });

  // PATCH /api/events/:id
  app.patch(api.events.update.path, requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid event ID" });
      const existing = await storage.getEvent(id);
      if (!existing) return res.status(404).json({ message: "Event not found" });
      const localUser = await db.query.users.findFirst({
        where: eq(users.id, String(req.user.id)),
      });
      if (existing.organizerId !== String(req.user.id) && !localUser?.isAdmin) {
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

  // DELETE /api/events/:id
  app.delete(api.events.delete.path, requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid event ID" });
      const existing = await storage.getEvent(id);
      if (!existing) return res.status(404).json({ message: "Event not found" });
      const localUser = await db.query.users.findFirst({
        where: eq(users.id, String(req.user.id)),
      });
      if (existing.organizerId !== String(req.user.id) && !localUser?.isAdmin) {
        return res.status(403).json({ message: "Not authorized to delete this event" });
      }
      await storage.deleteEvent(id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[DELETE /api/events/:id]", err);
      res.status(500).json({ message: err.message ?? "Failed to delete event" });
    }
  });

  // ── Orders ─────────────────────────────────────────────────────────
  // GET /api/orders/me
  app.get(api.orders.myOrders.path, requireAuth, async (req: any, res) => {
    try {
      const orders = await storage.getOrdersByAttendee(String(req.user.id));
      res.json(orders);
    } catch (err) {
      console.error("[GET /api/orders/me]", err);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // GET /api/orders/:id
  app.get(api.orders.get.path, requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid order ID" });
      const order = await storage.getOrder(id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      const localUser = await db.query.users.findFirst({
        where: eq(users.id, String(req.user.id)),
      });
      if (order.attendeeId !== String(req.user.id) && !localUser?.isAdmin) {
        return res.status(403).json({ message: "Not authorized to view this order" });
      }
      res.json(order);
    } catch (err) {
      console.error("[GET /api/orders/:id]", err);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // POST /api/orders
  app.post(api.orders.create.path, requireAuth, async (req: any, res) => {
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
      const order = await storage.createOrder(String(req.user.id), parsed.data);
      res.status(201).json(order);
    } catch (err: any) {
      console.error("[POST /api/orders]", err);
      res.status(500).json({ message: err.message ?? "Failed to create order" });
    }
  });

  // ── Start background jobs ──────────────────────────────────────────
  scheduleTicketReminders();

  return httpServer;
}

// No `seedDatabase` function needed – it was empty anyway.
