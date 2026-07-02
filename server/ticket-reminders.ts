// server/ticket-reminders.ts
// Runs every hour and sends a Telegram reminder to anyone who has a ticket
// for an event starting within the next 24 hours, but hasn't been reminded yet.
//
// Reminder dedup is now persisted to the DB (`orders.reminder_sent_at`),
// so server restarts (e.g. Render spin-down/up) never cause duplicate messages.
//
// Architecture:
//   - Orders + events live in expatevents (Neon DB)
//   - Telegram delivery via meh-auth POST /api/internal/send-message

import { db } from "./db";
import { orders, events } from "@shared/schema";
import { eq, and, gte, lte, isNull, sql } from "drizzle-orm";

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
  const now   = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);

  try {
    // Fetch orders for events in the 23–24h window that have NOT been reminded yet.
    // The reminderSentAt IS NULL check is the persistent dedup — survives restarts.
    const toRemind = await db.query.orders.findMany({
      with: { event: true },
      where: and(
        isNull(orders.reminderSentAt),              // not yet reminded
        gte(events.date, in23h),                    // event starts > 23h from now
        lte(events.date, in24h),                    // event starts < 24h from now
        eq(events.published, true)
      ),
    });

    if (toRemind.length === 0) return;

    let sent = 0;
    for (const order of toRemind) {
      const event = order.event;
      if (!event) continue;

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

      const ok = await sendReminderToUser(String(order.attendeeId), message);

      if (ok) {
        // Persist the timestamp so we never send this reminder again,
        // even if the server restarts before the next hourly check.
        await db
          .update(orders)
          .set({ reminderSentAt: new Date() })
          .where(eq(orders.id, order.id));

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
export function scheduleTicketReminders(): void {
  const INITIAL_DELAY_MS = 2 * 60 * 1000;  // 2 min after boot
  const INTERVAL_MS      = 60 * 60 * 1000; // hourly

  setTimeout(() => {
    runTicketReminders();
    setInterval(runTicketReminders, INTERVAL_MS);
  }, INITIAL_DELAY_MS);

  console.log("[reminders] Ticket reminder scheduler started (runs hourly)");
}
