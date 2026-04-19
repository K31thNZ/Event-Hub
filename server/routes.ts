import { registerGroupRoutes } from "./group-routes";
import { scheduleTicketReminders } from "./ticket-reminders";
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
import crypto from "crypto"; // for generating unique tokens

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

  // ========== TELEGRAM ROUTES ==========
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "meh_auth_bot"; // fallback

  // Helper to generate a unique token for linking
  const generateLinkToken = () => crypto.randomBytes(32).toString("hex");

  // In-memory store for link tokens (use Redis in production)
  const linkTokens = new Map<string, { userId: string; expires: number }>();

  // Status endpoint – tells frontend if bot is configured
  app.get("/api/telegram/status", (req, res) => {
    res.json({ configured: !!BOT_TOKEN });
  });

  // Generate a deep link for the user to start the bot and link their account
  app.post("/api/telegram/link", requireAuth, async (req: any, res) => {
    if (!BOT_TOKEN) {
      return res.status(503).json({ message: "Telegram bot is not configured" });
    }

    const userId = String(req.user.id);
    const token = generateLinkToken();
    // Token valid for 10 minutes
    linkTokens.set(token, { userId, expires: Date.now() + 10 * 60 * 1000 });

    // Deep link format: https://t.me/BOT_USERNAME?start=link_TOKEN
    const deepLink = `https://t.me/${BOT_USERNAME}?start=link_${token}`;
    res.json({ url: deepLink });
  });

  // Webhook endpoint that the bot will call when a user clicks /start with a token
  // You need to set this webhook URL in your bot configuration (e.g., via setWebhook)
  app.post("/api/telegram/webhook", async (req, res) => {
    const update = req.body;
    try {
      // Handle /start command with a token
      if (update.message?.text?.startsWith("/start")) {
        const text = update.message.text;
        const match = text.match(/\/start link_([a-f0-9]+)/);
        if (match) {
          const token = match[1];
          const data = linkTokens.get(token);
          if (data && data.expires > Date.now()) {
            const telegramId = String(update.message.from.id);
            // Update the user's record with telegramId
            await db.update(users).set({ telegramId }).where(eq(users.id, data.userId));
            linkTokens.delete(token);
            // Send confirmation message to the user
            // You'd need a bot instance to reply; for simplicity, we just return OK
          }
        }
      }
      res.sendStatus(200);
    } catch (err) {
      console.error("Webhook error:", err);
      res.sendStatus(500);
    }
  });

  // Unlink Telegram account
  app.post("/api/telegram/unlink", requireAuth, async (req: any, res) => {
    const userId = String(req.user.id);
    try {
      await db.update(users).set({ telegramId: null }).where(eq(users.id, userId));
      res.json({ success: true });
    } catch (err) {
      console.error("Unlink error:", err);
      res.status(500).json({ message: "Failed to unlink Telegram account" });
    }
  });

  // ── Events ────────────────────────────────────────────────────────────
  app.get(api.events.list.path, async (req, res) => {
    // ... existing code ...
  });

  // ... (all your existing event, order, and seeding code unchanged) ...

  await seedDatabase();
  scheduleTicketReminders();
  return httpServer;
}

// Keep your existing seedDatabase function unchanged
async function seedDatabase() {
  // ... unchanged ...
}
