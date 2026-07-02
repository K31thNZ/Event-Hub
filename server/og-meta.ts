// server/og-meta.ts
// Server-side Open Graph / meta tag injection for shareable pages.
//
// Handles: /events/:id, /groups/:slug, /guides/:slug, and all other pages.
// No SSR framework needed — we splice meta into index.html before serving.

import { db } from "./db";
import { events, groups } from "@shared/schema";
import { eq } from "drizzle-orm";

const SITE_URL   = (process.env.APP_URL ?? "https://expatevents.org").replace(/\/$/, "");
const SITE_NAME  = "Expat Events Moscow";
const DEFAULT_OG = `${SITE_URL}/og-default.png`;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function truncate(s: string, n = 200): string {
  const clean = s.replace(/\n/g, " ").trim();
  return clean.length > n ? clean.slice(0, n) + "…" : clean;
}

// ── EVENT ─────────────────────────────────────────────────────────────────
function buildEventMeta(event: {
  id: number; title: string; description: string;
  imageUrl: string | null; venueCity: string; venueAddress: string;
  date: Date | string; category: string;
}): string {
  const url   = `${SITE_URL}/events/${event.id}`;
  const image = event.imageUrl ?? DEFAULT_OG;
  const title = esc(event.title);
  const desc  = esc(truncate(event.description));
  const venue = esc(`${event.venueCity} — ${event.venueAddress}`);

  return `<title>${title} | ${SITE_NAME}</title>
    <meta name="description" content="${desc}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type"         content="website" />
    <meta property="og:site_name"    content="${esc(SITE_NAME)}" />
    <meta property="og:url"          content="${url}" />
    <meta property="og:title"        content="${title}" />
    <meta property="og:description"  content="${desc}" />
    <meta property="og:image"        content="${esc(image)}" />
    <meta property="og:image:width"  content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card"        content="summary_large_image" />
    <meta name="twitter:title"       content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image"       content="${esc(image)}" />
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Event","name":"${title}","description":"${desc}","startDate":"${new Date(event.date).toISOString()}","location":{"@type":"Place","name":"${venue}","address":"${venue}"},"image":"${esc(image)}","url":"${url}","organizer":{"@type":"Organization","name":"${esc(SITE_NAME)}","url":"${SITE_URL}"}}</script>`;
}

// ── GROUP ─────────────────────────────────────────────────────────────────
function buildGroupMeta(group: {
  slug: string; name: string; description: string;
  imageUrl: string | null; category: string;
}): string {
  const url   = `${SITE_URL}/groups/${group.slug}`;
  const image = group.imageUrl ?? DEFAULT_OG;
  const title = esc(group.name);
  const desc  = esc(truncate(group.description || `Join the ${group.name} group on Expat Events Moscow.`));

  return `<title>${title} | ${SITE_NAME}</title>
    <meta name="description" content="${desc}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type"         content="website" />
    <meta property="og:site_name"    content="${esc(SITE_NAME)}" />
    <meta property="og:url"          content="${url}" />
    <meta property="og:title"        content="${title}" />
    <meta property="og:description"  content="${desc}" />
    <meta property="og:image"        content="${esc(image)}" />
    <meta property="og:image:width"  content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card"        content="summary_large_image" />
    <meta name="twitter:title"       content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image"       content="${esc(image)}" />
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"${title}","description":"${desc}","image":"${esc(image)}","url":"${url}"}</script>`;
}

// ── GUIDE ─────────────────────────────────────────────────────────────────
function buildGuideMeta(guide: {
  slug: string; title: string; summary: string;
}): string {
  const url   = `${SITE_URL}/guides/${guide.slug}`;
  const title = esc(guide.title);
  const desc  = esc(truncate(guide.summary || "A guide for expats living in Moscow."));

  return `<title>${title} | ${SITE_NAME}</title>
    <meta name="description" content="${desc}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type"         content="article" />
    <meta property="og:site_name"    content="${esc(SITE_NAME)}" />
    <meta property="og:url"          content="${url}" />
    <meta property="og:title"        content="${title}" />
    <meta property="og:description"  content="${desc}" />
    <meta property="og:image"        content="${DEFAULT_OG}" />
    <meta property="og:image:width"  content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card"        content="summary_large_image" />
    <meta name="twitter:title"       content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image"       content="${DEFAULT_OG}" />
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"${title}","description":"${desc}","url":"${url}","publisher":{"@type":"Organization","name":"${esc(SITE_NAME)}","url":"${SITE_URL}"}}</script>`;
}

// ── DEFAULT / HOMEPAGE ────────────────────────────────────────────────────
const DEFAULT_META = `<title>${SITE_NAME}</title>
    <meta name="description" content="Find and join expat events in Moscow — networking, culture, sports, language exchange and more." />
    <link rel="canonical" href="${SITE_URL}" />
    <meta property="og:type"         content="website" />
    <meta property="og:site_name"    content="${esc(SITE_NAME)}" />
    <meta property="og:url"          content="${SITE_URL}" />
    <meta property="og:title"        content="${esc(SITE_NAME)}" />
    <meta property="og:description"  content="Find and join expat events in Moscow — networking, culture, sports, language exchange and more." />
    <meta property="og:image"        content="${DEFAULT_OG}" />
    <meta property="og:image:width"  content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card"        content="summary_large_image" />
    <meta name="twitter:title"       content="${esc(SITE_NAME)}" />
    <meta name="twitter:description" content="Find and join expat events in Moscow — networking, culture, sports, language exchange and more." />
    <meta name="twitter:image"       content="${DEFAULT_OG}" />`;

// ── INJECT ────────────────────────────────────────────────────────────────
export function injectMeta(html: string, meta: string): string {
  return html.replace("<head>", `<head>\n    ${meta}`);
}

// ── PUBLIC RENDERERS ──────────────────────────────────────────────────────

export async function renderEventHtml(id: number, baseHtml: string): Promise<string | null> {
  try {
    const event = await db.query.events.findFirst({
      where: eq(events.id, id),
      columns: { id: true, title: true, description: true, imageUrl: true, venueCity: true, venueAddress: true, date: true, category: true },
    });
    if (!event) return null;
    return injectMeta(baseHtml, buildEventMeta(event));
  } catch { return null; }
}

export async function renderGroupHtml(slug: string, baseHtml: string): Promise<string | null> {
  try {
    const group = await db.query.groups.findFirst({
      where: eq(groups.slug, slug),
      columns: { slug: true, name: true, description: true, imageUrl: true, category: true, status: true },
    });
    if (!group || group.status !== "active") return null;
    return injectMeta(baseHtml, buildGroupMeta(group));
  } catch { return null; }
}

export async function renderGuideHtml(
  slug: string,
  baseHtml: string,
  fetchGuides: (q: Record<string, unknown>) => Promise<any>
): Promise<string | null> {
  try {
    const data  = await fetchGuides({ slug, is_published: true });
    const items: any[] = Array.isArray(data) ? data : (data.items ?? []);
    if (!items.length) return null;
    return injectMeta(baseHtml, buildGuideMeta(items[0]));
  } catch { return null; }
}

export function renderDefaultHtml(baseHtml: string): string {
  return injectMeta(baseHtml, DEFAULT_META);
}
