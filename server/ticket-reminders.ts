// server/ticket-reminders.ts
// Runs every hour and sends a friendly Telegram reminder to anyone who has
// a ticket for an event starting within the next 24 hours, but hasn't been
// reminded yet.
//
// Architecture:
//   - Orders + events live in expatevents (Neon DB)
//   - Telegram + user telegramId live in meh-auth
//   - We call POST /api/internal/send-message on meh-auth to deliver the message
//   - We track who has been reminded using the notifications table in meh-auth
//     via a simple in-memory Set per server session (safe — reminders are
//     one-per-event-per-user, and a server restart just means a harmless re-send)

import { db } from "./db";
import { orders, events } from "@shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";

// In-memory dedup: "userId:eventId" pairs already reminded this session
const alreadyReminded = new Set<string>();

async function sendReminderToUser(
  mehAuthUserId: string,
  message: string
): Promise<boolean> {
  const authUrl = process.env.AUTH_SERVICE_URL ?? "https://auth.expatevents.org";
  const secret  = process.env.SERVICE_SECRET;

  try {
    const res = await fetch(`${authUrl}/api/internal/send-message`, {
      method:  "POST",
      headers: {
        "Content-Type":     "application/json",
        ...(secret ? { "x-service-secret": secret } : {}),
      },
      body: JSON.stringify({ userId: mehAuthUserId, message }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return data.ok === true;
  } catch (err: any) {
    console.warn("[reminders] Could not reach meh-auth:", err.message);
    return false;
  }
}

export async function runTicketReminders(): Promise<void> {
  const now      = new Date();
  const in24h    = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in23h    = new Date(now.getTime() + 23 * 60 * 60 * 1000); // lower bound to avoid re-firing

  try {
    // Find all orders for events starting in the next 23–24 hours
    const upcoming = await db.query.orders.findMany({
      with: { event: true },
    });

    const toRemind = upcoming.filter(order => {
      const eventDate = new Date(order.event.date);
      return eventDate >= in23h && eventDate <= in24h && order.event.published;
    });

    if (toRemind.length === 0) return;

    let sent = 0;
    for (const order of toRemind) {
      const key = `${order.attendeeId}:${order.eventId}`;
      if (alreadyReminded.has(key)) continue;

      const event = order.event;
      const dateStr = new Date(event.date).toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "long",
        hour: "2-digit", minute: "2-digit",
      });

      const message =
        `🎟 *Friendly reminder — your event is tomorrow!*\n\n` +
        `*${event.title}*\n` +
        `📅 ${dateStr}\n` +
        `📍 ${event.venueAddress}, ${event.venueCity}\n\n` +
        `Don't forget your ticket! ` +
        `[View ticket](https://expatevents.org/orders/${order.id})`;

      const ok = await sendReminderToUser(order.attendeeId, message);

      if (ok) {
        alreadyReminded.add(key);
        sent++;
        console.log(`[reminders] Sent reminder to user ${order.attendeeId} for event ${order.eventId}`);
      }
    }

    if (sent > 0) {
      console.log(`[reminders] Sent ${sent} ticket reminder(s)`);
    }
  } catch (err: any) {
    console.error("[reminders] Error:", err.message);
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────
// Runs once an hour. Call scheduleTicketReminders() from server/index.ts.
export function scheduleTicketReminders(): void {
  // Slight delay on startup so the server is fully ready
  const INITIAL_DELAY_MS = 2 * 60 * 1000;   // 2 minutes after boot
  const INTERVAL_MS      = 60 * 60 * 1000;  // every hour

  setTimeout(() => {
    runTicketReminders();
    setInterval(runTicketReminders, INTERVAL_MS);
  }, INITIAL_DELAY_MS);

  console.log("[reminders] Ticket reminder scheduler started (runs hourly)");
}
