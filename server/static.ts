// server/static.ts
// Serves the built React SPA with per-route meta tag injection for SEO.
//
// Improvements over the previous version:
//  1. index.html is read from disk ONCE at startup and cached in memory.
//     (Previously re-read on every request — unnecessary disk I/O.)
//  2. /groups/:slug now gets group-specific OG tags + JSON-LD.
//  3. /guides/:slug now gets guide-specific OG tags + JSON-LD.
//  4. All pages get a <link rel="canonical"> so UTM-decorated URLs don't
//     fragment PageRank.

import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import {
  renderEventHtml,
  renderGroupHtml,
  renderGuideHtml,
  renderDefaultHtml,
} from "./og-meta";

export function serveStatic(app: Express, fetchGuides: (q: Record<string, unknown>) => Promise<any>) {
  const distPath = path.resolve(process.cwd(), "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // ── Cache index.html in memory at startup ─────────────────────────────
  // No need to hit the disk on every request — the file only changes on deploy.
  let cachedHtml: string | null = null;

  async function getBaseHtml(): Promise<string> {
    if (cachedHtml) return cachedHtml;
    const htmlPath = path.resolve(distPath, "index.html");
    cachedHtml = await fs.promises.readFile(htmlPath, "utf-8");
    return cachedHtml;
  }

  // ── OG-injected catch-all ──────────────────────────────────────────────
  app.use("/{*path}", async (req, res) => {
    let baseHtml: string;
    try {
      baseHtml = await getBaseHtml();
    } catch {
      return res.status(500).send("Internal Server Error");
    }

    // /events/:id
    const eventMatch = req.path.match(/^\/events\/(\d+)(?:\/|$)/);
    if (eventMatch) {
      const html = await renderEventHtml(parseInt(eventMatch[1], 10), baseHtml);
      if (html) {
        return res
          .status(200)
          .set("Content-Type", "text/html")
          .set("Cache-Control", "public, max-age=300, stale-while-revalidate=60")
          .end(html);
      }
      // Event not found — fall through to default (React shows 404)
    }

    // /groups/:slug
    const groupMatch = req.path.match(/^\/groups\/([^/]+)(?:\/|$)/);
    if (groupMatch && groupMatch[1] !== "create") {
      const html = await renderGroupHtml(groupMatch[1], baseHtml);
      if (html) {
        return res
          .status(200)
          .set("Content-Type", "text/html")
          .set("Cache-Control", "public, max-age=300, stale-while-revalidate=60")
          .end(html);
      }
    }

    // /guides/:slug
    const guideMatch = req.path.match(/^\/guides\/([^/]+)(?:\/|$)/);
    if (guideMatch) {
      const html = await renderGuideHtml(guideMatch[1], baseHtml, fetchGuides);
      if (html) {
        return res
          .status(200)
          .set("Content-Type", "text/html")
          .set("Cache-Control", "public, max-age=3600, stale-while-revalidate=300")
          .end(html);
      }
    }

    // All other routes — default site meta
    const html = renderDefaultHtml(baseHtml);
    return res
      .status(200)
      .set("Content-Type", "text/html")
      .end(html);
  });
}
