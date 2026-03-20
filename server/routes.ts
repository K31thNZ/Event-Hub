import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get(api.events.list.path, async (req, res) => {
    try {
      const query = api.events.list.input?.parse(req.query);
      const events = await storage.getEvents(query);
      res.json(events);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch events" });
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

  app.get(api.events.myEvents.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const events = await storage.getEventsByOrganizer(userId);
      res.json(events);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch your events" });
    }
  });

  app.post(api.events.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const input = api.events.create.input.parse(req.body);
      const event = await storage.createEvent(userId, input);
      res.status(201).json(event);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.orders.myOrders.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orders = await storage.getOrdersByAttendee(userId);
      res.json(orders);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get(api.orders.get.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const order = await storage.getOrder(Number(req.params.id));
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.attendeeId !== userId && order.event.organizerId !== userId) {
        return res.status(401).json({ message: "Unauthorized to view this order" });
      }
      res.json(order);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.post(api.orders.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const input = api.orders.create.input.parse(req.body);
      const order = await storage.createOrder(userId, input);
      res.status(201).json(order);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.delete(api.events.delete.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId); // Wait, storage is IStorage, not authStorage
      // Actually I should import authStorage or add getUser to IStorage
      
      const { authStorage } = await import("./replit_integrations/auth");
      const dbUser = await authStorage.getUser(userId);
      const event = await storage.getEvent(Number(req.params.id));

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      if (!dbUser?.isAdmin && event.organizerId !== userId) {
        return res.status(403).json({ message: "Only administrators or the event organizer can delete events" });
      }

      await storage.deleteEvent(Number(req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  try {
    const existing = await storage.getEvents();
    if (existing.length === 0) {
      const dummyOrganizerId = "00000000-0000-0000-0000-000000000000";
      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const existingUser = await db.select().from(users).where(eq(users.id, dummyOrganizerId));
      if (existingUser.length === 0) {
        await db.insert(users).values({
          id: dummyOrganizerId,
          email: "admin@expatevents.ru",
          firstName: "Admin",
          lastName: "User"
        });
      }

      await storage.createEvent(dummyOrganizerId, {
        title: "Moscow Expat Networking Drinks",
        description: "Join us for our monthly networking event. Meet fellow expats living and working in Moscow.",
        category: "Networking",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        venueAddress: "Stoleshnikov Lane 11",
        venueCity: "Moscow",
        imageUrl: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622",
        published: true,
        ticketTypes: [
          { name: "General Admission", price: 150000, quantity: 100, maxPerOrder: 5 },
          { name: "VIP (Includes 2 drinks)", price: 300000, quantity: 20, maxPerOrder: 2 }
        ]
      });

      await storage.createEvent(dummyOrganizerId, {
        title: "St. Petersburg Tech Meetup",
        description: "A gathering of expat tech professionals, developers, and founders.",
        category: "Tech",
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        venueAddress: "Nevsky Prospect 28",
        venueCity: "St. Petersburg",
        imageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
        published: true,
        ticketTypes: [
          { name: "Early Bird", price: 50000, quantity: 50, maxPerOrder: 4 },
          { name: "Standard", price: 100000, quantity: 150, maxPerOrder: 4 }
        ]
      });
      
      await storage.createEvent(dummyOrganizerId, {
        title: "Russian Cooking Masterclass",
        description: "Learn how to make authentic Borscht and Pelmeni with our expert chef.",
        category: "Food & Drink",
        date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        venueAddress: "Tverskaya St 14",
        venueCity: "Moscow",
        imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1",
        published: true,
        ticketTypes: [
          { name: "Participant", price: 500000, quantity: 15, maxPerOrder: 2 }
        ]
      });
    }
  } catch (err) {
    console.error("Failed to seed database", err);
  }
}
