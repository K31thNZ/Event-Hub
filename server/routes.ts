import { registerGroupRoutes } from "./group-routes";
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
import { eq } from "drizzle-orm";
import crypto from "crypto";

// ── Cloudflare R2 SDK imports ───────────────────────────────────────────────
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerPicksRoutes(app);
  registerGroupRoutes(app);

  // ── Cloudflare R2: generate presigned upload URL ─────────────────────────
  const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  app.post("/api/r2-presigned-url", async (req, res) => {
    try {
      const { fileName, fileType } = req.body;
      if (!fileName || !fileType) {
        return res.status(400).json({ error: "Missing fileName or fileType" });
      }

      // Sanitize filename
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `avatars/${Date.now()}-${safeName}`;

      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        ContentType: fileType,
      });

      const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 }); // 1 hour

      const publicUrl = `https://pub-bbcea9b00e1042e59b8ffab29ad09276.r2.dev/${key}`;

      res.json({ uploadUrl, publicUrl });
    } catch (error) {
      console.error("R2 presigned URL error:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // ── Geocoding endpoints (forward & reverse) – free OpenStreetMap Nominatim ──
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
      if (!address && data.display_name) {
        address = data.display_name.split(",")[0];
      }
      const city = a.city ?? a.town ?? a.village ?? a.county ?? "";
      res.json({ address, city });
    } catch (error) {
      console.error("Reverse geocode error:", error);
      res.status(500).json({ error: "Failed to reverse geocode" });
    }
  });

  // ── Current authenticated user ────────────────────────────────────────
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

  // ── Current user profile (local DB) ──────────────────────────────────
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

  // ── Telegram routes ───────────────────────────────────────────────────
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
    const token  = generateLinkToken();
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
          const data  = linkTokens.get(token);
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

  // ── Events ────────────────────────────────────────────────────────────

  // GET /api/events — list all published events with optional filters
  app.get(api.events.list.path, async (req, res) => {
    try {
      const { search, category, city } = req.query as Record<string, string>;
      const events = await storage.getEvents({
        search:   search   || undefined,
        category: category || undefined,
        city:     city     || undefined,
      });
      res.json(events);
    } catch (err) {
      console.error("[GET /api/events]", err);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // GET /api/events/me — events created by the current user
  app.get(api.events.myEvents.path, requireAuth, async (req: any, res) => {
    try {
      const events = await storage.getEventsByOrganizer(String(req.user.id));
      res.json(events);
    } catch (err) {
      console.error("[GET /api/events/me]", err);
      res.status(500).json({ message: "Failed to fetch your events" });
    }
  });

  // GET /api/events/:id — single event
  app.get(api.events.get.path, async (req, res) => {
    try {
      const id    = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid event ID" });
      const event = await storage.getEvent(id);
      if (!event)   return res.status(404).json({ message: "Event not found" });
      res.json(event);
    } catch (err) {
      console.error("[GET /api/events/:id]", err);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  // POST /api/events — create a new event
  app.post(api.events.create.path, requireAuth, async (req: any, res) => {
    try {
      const parsed = api.events.create.input.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.errors[0]?.message ?? "Validation error",
          field:   parsed.error.errors[0]?.path?.join("."),
        });
      }
      const event = await storage.createEvent(String(req.user.id), parsed.data);
      res.status(201).json(event);
    } catch (err: any) {
      console.error("[POST /api/events]", err);
      res.status(500).json({ message: err.message ?? "Failed to create event" });
    }
  });

  // PATCH /api/events/:id — update an event
  app.patch(api.events.update.path, requireAuth, async (req: any, res) => {
    try {
      const id    = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid event ID" });

      const existing = await storage.getEvent(id);
      if (!existing)  return res.status(404).json({ message: "Event not found" });

      // Only organizer or admin may update
      const localUser = await db.query.users.findFirst({
        where: eq(users.id, String(req.user.id)),
      });
      if (existing.organizerId !== String(req.user.id) && !localUser?.isAdmin) {
        return res.status(403).json({ message: "Not authorized to update this event" });
      }

      const parsed = api.events.update.input.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.errors[0]?.message ?? "Validation error",
        });
      }

      const updated = await storage.updateEvent(id, parsed.data);
      res.json(updated);
    } catch (err: any) {
      console.error("[PATCH /api/events/:id]", err);
      res.status(500).json({ message: err.message ?? "Failed to update event" });
    }
  });

  // DELETE /api/events/:id — delete an event
  app.delete(api.events.delete.path, requireAuth, async (req: any, res) => {
    try {
      const id    = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid event ID" });

      const existing = await storage.getEvent(id);
      if (!existing)  return res.status(404).json({ message: "Event not found" });

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

  // ── Orders ────────────────────────────────────────────────────────────

  // GET /api/orders/me — orders placed by the current user
  app.get(api.orders.myOrders.path, requireAuth, async (req: any, res) => {
    try {
      const orders = await storage.getOrdersByAttendee(String(req.user.id));
      res.json(orders);
    } catch (err) {
      console.error("[GET /api/orders/me]", err);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // GET /api/orders/:id — single order
  app.get(api.orders.get.path, requireAuth, async (req: any, res) => {
    try {
      const id    = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid order ID" });

      const order = await storage.getOrder(id);
      if (!order)   return res.status(404).json({ message: "Order not found" });

      // Only the attendee or an admin may view an order
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

  // POST /api/orders — place an order
  app.post(api.orders.create.path, requireAuth, async (req: any, res) => {
    try {
      const parsed = api.orders.create.input.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.errors[0]?.message ?? "Validation error",
          field:   parsed.error.errors[0]?.path?.join("."),
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

  await seedDatabase();
  scheduleTicketReminders();
  return httpServer;
}

async function seedDatabase() {
  // Add any seed logic here if needed
}
