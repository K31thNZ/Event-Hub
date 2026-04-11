import { registerGroupRoutes } from "./group-routes";
import { registerPicksRoutes } from "./picks-routes";
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { requireAuth, getUser } from "./auth-client";
import { z } from "zod";
import { db } from "./db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerPicksRoutes(app);
  registerGroupRoutes(app);

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

  // ── Events ────────────────────────────────────────────────────────────
  app.get(api.events.list.path, async (req, res) => {
    try {
      const query = api.events.list.input?.parse(req.query);
      const events = await storage.getEvents(query);
      res.json(events);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // MUST be before /:id or Express treats "me" as an id
  app.get(api.events.myEvents.path, requireAuth, async (req: any, res) => {
    try {
      const events = req.user.role === "admin"
        ? await storage.getEvents()          // all events
        : await storage.getEventsByOrganizer(String(req.user.id)); // own events only
      res.json(events);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch your events" });
    }
  });

  app.get(api.events.get.path, async (req, res) => {
    try {
      const event = await storage.getEvent(Number(req.params.id));
      if (!event) return res.status(404).json({ message: "Event not found" });
      res.json(event);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.post(api.events.create.path, requireAuth, async (req: any, res) => {
    try {
      const input = api.events.create.input.parse(req.body);
      const event = await storage.createEvent(String(req.user.id), input);
      res.status(201).json(event);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      console.error("[createEvent]", err);
      res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.patch(api.events.update.path, requireAuth, async (req: any, res) => {
    try {
      const event = await storage.getEvent(Number(req.params.id));
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (req.user.role !== "admin" && event.organizerId !== String(req.user.id)) {
        return res.status(403).json({ message: "Only the organizer or an admin can edit this event" });
      }
      const input = api.events.update.input.parse(req.body);
      const updated = await storage.updateEvent(Number(req.params.id), input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      console.error("[updateEvent]", err);
      res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.delete(api.events.delete.path, requireAuth, async (req: any, res) => {
    try {
      const event = await storage.getEvent(Number(req.params.id));
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (req.user.role !== "admin" && event.organizerId !== String(req.user.id)) {
        return res.status(403).json({ message: "Only administrators or the event organizer can delete events" });
      }
      await storage.deleteEvent(Number(req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  // ── Orders ────────────────────────────────────────────────────────────
  // MUST be before /:id — same rule as events/me
  app.get(api.orders.myOrders.path, requireAuth, async (req: any, res) => {
    try {
      const orders = await storage.getOrdersByAttendee(String(req.user.id));
      res.json(orders);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get(api.orders.get.path, requireAuth, async (req: any, res) => {
    try {
      const order = await storage.getOrder(Number(req.params.id));
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.attendeeId !== String(req.user.id) && order.event.organizerId !== String(req.user.id) && req.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized to view this order" });
      }
      res.json(order);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.post(api.orders.create.path, requireAuth, async (req: any, res) => {
    try {
      const input = api.orders.create.input.parse(req.body);
      const order = await storage.createOrder(String(req.user.id), input);
      res.status(201).json(order);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  await seedDatabase();
  return httpServer;
}

// ── Seed ──────────────────────────────────────────────────────────────────
// Fetches the actual admin user ID from meh-auth and uses that UUID as
// organizerId, so seeded events are owned by a real user and show up in
// the admin's dashboard.
async function seedDatabase() {
  try {
    const existing = await storage.getEvents();
    if (existing.length > 0) return;

    const AUTH_URL = process.env.AUTH_SERVICE_URL ?? "https://meh-auth.onrender.com";

    // Fetch the real admin user object to get their UUID
    let adminUser: { id: string | number } | null = null;
    try {
      const res = await fetch(`${AUTH_URL}/api/users/1`);
      if (res.ok) adminUser = await res.json();
    } catch {
      adminUser = null;
    }

    if (!adminUser?.id) {
      console.log("[seed] Skipping seed — no admin user found in auth service");
      return;
    }

    // Use the actual user ID (as a string) so it matches the varchar FK
    const seedOrganizerId = String(adminUser.id);

    await storage.createEvent(seedOrganizerId, {
      title: "Moscow Expat Networking Drinks",
      description: "Join us for our monthly networking event. Meet fellow expats living and working in Moscow.",
      category: "networking",
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      venueAddress: "Stoleshnikov Lane 11",
      venueCity: "Moscow",
      imageUrl: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622",
      published: true,
      ticketTypes: [
        { name: "General Admission", price: 150000, quantity: 100, maxPerOrder: 5 },
        { name: "VIP (Includes 2 drinks)", price: 300000, quantity: 20, maxPerOrder: 2 },
      ],
    });

    await storage.createEvent(seedOrganizerId, {
      title: "St. Petersburg Tech Meetup",
      description: "A gathering of expat tech professionals, developers, and founders.",
      category: "tech",
      date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      venueAddress: "Nevsky Prospect 28",
      venueCity: "St. Petersburg",
      imageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
      published: true,
      ticketTypes: [
        { name: "Early Bird", price: 50000, quantity: 50, maxPerOrder: 4 },
        { name: "Standard", price: 100000, quantity: 150, maxPerOrder: 4 },
      ],
    });

    await storage.createEvent(seedOrganizerId, {
      title: "Russian Cooking Masterclass",
      description: "Learn how to make authentic Borscht and Pelmeni with our expert chef.",
      category: "food",
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      venueAddress: "Tverskaya St 14",
      venueCity: "Moscow",
      imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1",
      published: true,
      ticketTypes: [
        { name: "Participant", price: 500000, quantity: 15, maxPerOrder: 2 },
      ],
    });

    console.log(`[seed] Created 3 sample events (organizerId: ${seedOrganizerId})`);
  } catch (err) {
    console.error("[seed] Failed to seed database:", err);
  }
}
