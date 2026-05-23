import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { renderEventHtml, renderDefaultHtml } from "./og-meta";

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // ── OG-injected catch-all ──────────────────────────────────────────────
  // Reads index.html once per request, injects event-specific OG/meta tags
  // for /events/:id pages, falls back to default meta for everything else.
  // Real browsers get identical HTML — React takes over after JS loads.
  app.use("/{*path}", async (req, res) => {
    const htmlPath = path.resolve(distPath, "index.html");
    let baseHtml: string;

    try {
      baseHtml = await fs.promises.readFile(htmlPath, "utf-8");
    } catch {
      return res.status(500).send("Internal Server Error");
    }

    // Match /events/:id
    const eventMatch = req.path.match(/^\/events\/(\d+)(?:\/|$)/);
    if (eventMatch) {
      const eventId = parseInt(eventMatch[1], 10);
      const html = await renderEventHtml(eventId, baseHtml);
      if (html) {
        return res
          .status(200)
          .set("Content-Type", "text/html")
          // 5 min CDN cache, revalidate on each request from origin
          .set("Cache-Control", "public, max-age=300, stale-while-revalidate=60")
          .end(html);
      }
      // Event not found — fall through to default (React will show 404)
    }

    // All other routes — inject default site meta
    const html = renderDefaultHtml(baseHtml);
    return res
      .status(200)
      .set("Content-Type", "text/html")
      .end(html);
  });
}
