/**
 * date-utils.ts
 *
 * Timezone-aware date formatting helpers.
 *
 * The app stores all event dates as UTC timestamps.
 * We display them in the timezone of:
 *   1. The viewer's profile city  (preferred)
 *   2. The event's venueCity      (fallback)
 *   3. UTC                        (last resort)
 *
 * Usage:
 *   import { formatEventDate, formatEventTime, formatEventDateTime } from "@/lib/date-utils";
 *   formatEventDate(event.date, user?.city ?? event.venueCity)   // "Saturday, June 7, 2026"
 *   formatEventTime(event.date, user?.city ?? event.venueCity)   // "7:00 PM"
 *   formatEventDateTime(event.date, user?.city ?? event.venueCity) // "Jun 7 · 7:00 PM"
 */

import { cityToTimezone } from "@/lib/constants";

/** Resolve a city name to an IANA timezone and validate it works */
function resolveTimezone(city?: string | null): string {
  const tz = cityToTimezone(city);
  try {
    // Validate — throws if tz is unknown
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/**
 * Returns an Intl.DateTimeFormat formatter for a given city.
 * Results are NOT cached per call — use the returned formatter directly.
 */
function formatter(city: string | null | undefined, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const tz = resolveTimezone(city);
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: tz });
}

/** "Saturday, June 7, 2026" */
export function formatEventDate(date: string | Date, city?: string | null): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatter(city, { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(d);
}

/** "07 Jun" (short, for cards) */
export function formatEventDateShort(date: string | Date, city?: string | null): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatter(city, { day: "2-digit", month: "short" }).format(d);
}

/** "7:00 PM" */
export function formatEventTime(date: string | Date, city?: string | null): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatter(city, { hour: "numeric", minute: "2-digit", hour12: true }).format(d);
}

/** "Jun 7, 2026 · 7:00 PM" */
export function formatEventDateTime(date: string | Date, city?: string | null): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const datePart = formatter(city, { month: "short", day: "numeric", year: "numeric" }).format(d);
  const timePart = formatter(city, { hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  return `${datePart} · ${timePart}`;
}

/** "Sat, Jun 7 · 7:00 PM" (compact, for list items) */
export function formatEventCompact(date: string | Date, city?: string | null): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const datePart = formatter(city, { weekday: "short", month: "short", day: "numeric" }).format(d);
  const timePart = formatter(city, { hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  return `${datePart} · ${timePart}`;
}

/** "7" (day number for event card badge) */
export function formatEventDay(date: string | Date, city?: string | null): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatter(city, { day: "numeric" }).format(d);
}

/** "Jun" (month abbrev for event card badge) */
export function formatEventMonth(date: string | Date, city?: string | null): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatter(city, { month: "short" }).format(d);
}

/**
 * Returns a timezone label suffix for display, e.g. " (MSK)" or " (GMT+5:30)"
 * so users can see which timezone is being applied.
 */
export function formatTimezoneLabel(city?: string | null): string {
  const tz = resolveTimezone(city);
  if (tz === "UTC") return " (UTC)";
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date());
    const tzName = parts.find(p => p.type === "timeZoneName")?.value ?? tz;
    return ` (${tzName})`;
  } catch {
    return "";
  }
}

/**
 * Convert a local date+time string (in the user's city timezone) to a UTC Date.
 * Used in CreateEvent when saving an event to the database.
 *
 * @param dateStr  "YYYY-MM-DD"
 * @param timeStr  "HH:MM"
 * @param city     profile/event city
 */
export function localToUtc(dateStr: string, timeStr: string, city?: string | null): Date {
  const tz = resolveTimezone(city);
  // Build an ISO string and interpret it as local time in the given timezone
  // by using the Temporal-polyfill approach via Intl
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes]   = timeStr.split(":").map(Number);

  // Strategy: find the UTC time that corresponds to the given wall-clock
  // time in the target timezone by binary-searching the offset.
  // For production cities (fixed or simple DST) this converges in 1 step.
  const naive = Date.UTC(year, month - 1, day, hours, minutes, 0);

  // Get the UTC offset at approximately that instant
  const probe = new Date(naive);
  const localStr = probe.toLocaleString("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  // en-CA gives "YYYY-MM-DD, HH:MM:SS"
  const probedDate = new Date(localStr.replace(",", "") + " UTC");
  const offsetMs = probedDate.getTime() - probe.getTime();

  // Apply the offset: wall-clock - offset = UTC
  return new Date(naive - offsetMs);
}
