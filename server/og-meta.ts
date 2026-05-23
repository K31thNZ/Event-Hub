// server/og-meta.ts
// Server-side Open Graph / meta tag injection for shareable pages.
//
// How it works:
//   1. Express intercepts /events/:id (and /orders/:id) BEFORE the catch-all
//      HTML handler.
//   2. We query the DB for the event, build a complete <head> block, and splice
//      it into the index.html template string.
//   3. Crawlers (Telegram, WhatsApp, Twitter, Google) see real OG tags.
//   4. Real users load the same HTML — React hydrates normally on top.
//
// No SSR framework needed.

import { db } from "./db";
import { events } from "@shared/schema";
import { eq } from "drizzle-orm";

const SITE_URL   = (process.env.APP_URL ?? "https://expatevents.org").replace(/\/$/, "");
const SITE_NAME  = "Expat Events Moscow";
const DEFAULT_OG = `${SITE_URL}/og-default.png`;

// ── Escape HTML special chars so user-supplied strings can't break the tag ──
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Format a Date as a human-readable string ──────────────────────────────
function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "short",
    day:     "numeric",
    month:   "long",
    year:    "numeric",
  });
}

// ── Build the OG <head> block for an event page ───────────────────────────
function buildEventMeta(event: {
  id:           number;
  title:        string;
  description:  string;
  imageUrl:     string | null;
  venueCity:    string;
  venueAddress: string;
  date:         Date | string;
  category:     string;
}): string {
  const url         = `${SITE_URL}/events/${event.id}`;
  const image       = event.imageUrl ?? DEFAULT_OG;
  const title       = esc(event.title);
  const description = esc(
    event.description.slice(0, 200).replace(/\n/g, " ") +
    (event.description.length > 200 ? "…" : "")
  );
  const dateStr = esc(fmtDate(event.date));
  const venue   = esc(`${event.venueCity} — ${event.venueAddress}`);

  return `
    <title>${title} | ${SITE_NAME}</title>
    <meta name="description" content="${description}" />

    <!-- Open Graph -->
    <meta property="og:type"        content="website" />
    <meta property="og:site_name"   content="${esc(SITE_NAME)}" />
    <meta property="og:url"         content="${url}" />
    <meta property="og:title"       content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image"       content="${esc(image)}" />
    <meta property="og:image:width"  content="1200" />
    <meta property="og:image:height" content="630" />

    <!-- Twitter Card -->
    <meta name="twitter:card"        content="summary_large_image" />
    <meta name="twitter:title"       content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image"       content="${esc(image)}" />

    <!-- Structured data for Google -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Event",
      "name": "${title}",
      "description": "${description}",
      "startDate": "${new Date(event.date).toISOString()}",
      "location": {
        "@type": "Place",
        "name": "${venue}",
        "address": "${venue}"
      },
      "image": "${esc(image)}",
      "url": "${url}",
      "organizer": {
        "@type": "Organization",
        "name": "${esc(SITE_NAME)}"
      }
    }
    </script>`.trim();
}

// ── Default meta for non-event pages ─────────────────────────────────────
const DEFAULT_META = `
    <title>${SITE_NAME}</title>
    <meta name="description" content="Find and discover expat events in Moscow — networking, culture, sports, language exchange and more." />
    <meta property="og:type"      content="website" />
    <meta property="og:site_name" content="${esc(SITE_NAME)}" />
    <meta property="og:url"       content="${SITE_URL}" />
    <meta property="og:title"     content="${esc(SITE_NAME)}" />
    <meta property="og:description" content="Find and discover expat events in Moscow — networking, culture, sports, language exchange and more." />
    <meta property="og:image"     content="${DEFAULT_OG}" />
    <meta name="twitter:card"     content="summary_large_image" />`.trim();

// ── Inject meta tags into an index.html string ───────────────────────────
// We splice after <head> — this way the injected tags come first and any
// existing tags in the template serve as fallback.
export function injectMeta(html: string, meta: string): string {
  return html.replace("<head>", `<head>\n    ${meta}`);
}

// ── Fetch event and return fully-injected HTML (or null if not found) ──────
export async function renderEventHtml(
  id: number,
  baseHtml: string
): Promise<string | null> {
  try {
    const event = await db.query.events.findFirst({
      where: eq(events.id, id),
      columns: {
        id: true, title: true, description: true,
        imageUrl: true, venueCity: true, venueAddress: true,
        date: true, category: true,
      },
    });
    if (!event) return null;
    return injectMeta(baseHtml, buildEventMeta(event));
  } catch {
    return null;
  }
}

// ── Default meta injection (used for every other page) ───────────────────
export function renderDefaultHtml(baseHtml: string): string {
  return injectMeta(baseHtml, DEFAULT_META);
}
