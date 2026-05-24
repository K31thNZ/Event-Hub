// server/reminder-scheduler.ts
// Runs every hour and sends a friendly Telegram reminder to users who:
//   1. Have purchased a ticket for an upcoming event
//   2. The event starts within the next 24 hours
//   3. Have not already been sent a reminder for this order
//
// Reminders are delivered via meh-auth POST /api/notify/send which looks up
// the user's telegramId by their meh-auth numeric user ID and sends the message.
//
// To avoid repeat reminders, a sent flag is tracked in a simple in-memory Set
// keyed by orderId. This resets on server restart, but since reminders only
// fire within a 24h window that's fine — at worst a user gets one extra message
// after a restart, which is acceptable.

import { db } from "./db";
import { orders, events } from "@shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";

// Track which orders have already been reminded this server session
const remindedOrders = new Set<number>();

const CATEGORY_ICONS: Record<string, string> = {
  networking: "🔗", tech: "💻", culture: "🎨", food: "🍔",
  sports: "⚽", music: "🎵", language: "🌍", outdoor: "🏕️",
  games: "🎮", business: "💼", wellness: "🧘", family: "👨‍👩‍👧",
  social: "🤝", volunteering: "🙌", other: "📌",
};

async function sendReminderToUser(
  mehAuthUserId: string,
  message: string
): Promise<boolean> {
  const authUrl = process.env.AUTH_SERVICE_URL ?? "https://auth.expatevents.org";
  const secret  = process.env.SERVICE_SECRET;

  try {
    const res = await fetch(`${authUrl}/api/notify/send`, {
      method:  "POST",
      headers: {
        "Content-Type":     "application/json",
        ...(secret ? { "x-service-secret": secret } : {}),
      },
      body: JSON.stringify({ userId: mehAuthUserId, message }),
    });
    return res.ok;
  } catch (err: any) {
    console.warn("[reminders] Could not reach meh-auth:", err.message);
    return false;
  }
}

async function runReminderCheck(): Promise<void> {
  try {
    const now    = new Date();
    const in24h  = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find all orders for events starting in the next 24 hours
    const upcomingOrders = await db.query.orders.findMany({
      with: { event: true },
      where: and(
        gte(events.date, now),
        lte(events.date, in24h),
        eq(events.published, true)
      ),
    });

    if (upcomingOrders.length === 0) return;

    console.log(`[reminders] ${upcomingOrders.length} order(s) in the next 24h window`);

    let sent = 0;

    for (const order of upcomingOrders) {
      // Skip if already reminded this session
      if (remindedOrders.has(order.id)) continue;

      const event = order.event;
      if (!event) continue;

      const eventDate = new Date(event.date);
      const hoursUntil = Math.round((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60));

      const dateStr = eventDate.toLocaleDateString("en-GB", {
        weekday: "short", day: "numeric", month: "short",
        hour: "2-digit", minute: "2-digit",
      });

      const icon = CATEGORY_ICONS[event.category] ?? "🎟";
      const countdownText = hoursUntil <= 1
        ? "starting very soon"
        : `in ${hoursUntil} hour${hoursUntil !== 1 ? "s" : ""}`;

      const message =
        `${icon} *Friendly reminder — your event is ${countdownText}!*\n\n` +
        `*${event.title}*\n` +
        `📅 ${dateStr}\n` +
        `📍 ${event.venueAddress}, ${event.venueCity}\n\n` +
        `Your ticket is confirmed. See you there! 🎉\n` +
        `[View your ticket](https://expatevents.org/orders/${order.id})`;

      const ok = await sendReminderToUser(String(order.attendeeId), message);

      if (ok) {
        remindedOrders.add(order.id);
        sent++;
        console.log(`[reminders] Sent reminder for order ${order.id} (event: ${event.title})`);
      }
    }

    if (sent > 0) {
      console.log(`[reminders] Sent ${sent} reminder(s)`);
    }
  } catch (err: any) {
    console.error("[reminders] Check failed:", err.message);
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────
// Runs once an hour. Staggers the first run by a few seconds after startup
// so it doesn't compete with DB connection initialisation.
export function scheduleReminders(): void {
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  setTimeout(() => {
    runReminderCheck();
    setInterval(runReminderCheck, INTERVAL_MS);
  }, 10_000); // first run 10s after startup

  console.log("[reminders] Ticket reminder scheduler started (hourly)");
}
