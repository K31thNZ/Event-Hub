// ── Sentry — must be imported before any other modules ─────────────────────
import "./sentry";
import * as Sentry from "@sentry/node";

import { scheduleReminders } from "./reminder-scheduler";
import express, { type Request, Response, NextFunction } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";
import cors from "cors";
import helmet from "helmet";
import { registerRoutes, fetchGuides } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ── Trust Render's reverse proxy ──────────────────────────────────────────
app.set("trust proxy", 1);

// ── Security headers (helmet) ─────────────────────────────────────────────
// Sets X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security,
// Referrer-Policy, and a sensible Content-Security-Policy.
// CSP is configured to allow:
//  - Our own origin for scripts/styles
//  - Cloudinary + Unsplash for images (event cover photos)
//  - Yandex Maps JS & tiles
//  - meh-auth for the auth iframe/redirect flow
//  - inline styles (needed by Radix UI / shadcn components)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:     ["'self'"],
        scriptSrc:      [
          "'self'",
          "'unsafe-inline'",
          // Yandex Maps 2.1 entry point
          "api-maps.yandex.ru",
          // Yandex Maps dynamically loads its full bundle from yastatic.net
          "yastatic.net",
          // Yandex analytics/counter
          "mc.yandex.ru",
        ],
        styleSrc:       ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "yastatic.net"],
        fontSrc:        ["'self'", "fonts.gstatic.com", "yastatic.net"],
        imgSrc:         [
          "'self'", "data:", "blob:",
          "res.cloudinary.com",
          "images.unsplash.com",
          "avatars.githubusercontent.com",
          "*.tile.openstreetmap.org",
          "core.telegram.org",
          // Yandex Maps tile servers and sprite assets
          "*.maps.yandex.net",
          "vec01.maps.yandex.net",
          "yastatic.net",
          "avatars.yandex.net",
          "*.r2.dev",
          // Imported/scraped event sources + user-pasted image URLs
          "media.kudago.com",
          "base44.app",
          "media.base44.com",
          "dynamic-media-cdn.tripadvisor.com",
          "assets.in-cdn.net",
          "www.mixerseater.com",
          "us.images.westend61.de",
          "lh3.googleusercontent.com",
          "i.postimg.cc",
        ],
        connectSrc:     [
          "'self'",
          process.env.AUTH_SERVICE_URL ?? "https://auth.expatevents.org",
          // Yandex Maps API + geocoding + tiles + search
          "api-maps.yandex.ru",
          "geocode-maps.yandex.ru",
          "search-maps.yandex.ru",
          "mc.yandex.ru",
          "yastatic.net",
          "*.maps.yandex.net",
        ],
        workerSrc:      ["'self'", "blob:", "yastatic.net"],
        frameSrc:       ["'self'", process.env.AUTH_SERVICE_URL ?? "https://auth.expatevents.org"],
        objectSrc:      ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    // crossOriginEmbedderPolicy breaks Yandex Maps iframe — disable it
    crossOriginEmbedderPolicy: false,
  })
);

// ── CORS — allow meh-auth and the frontend to call this API ───────────────
app.use(cors({
  origin: [
    process.env.AUTH_SERVICE_URL ?? "https://meh-auth.onrender.com",
    process.env.APP_URL ?? "https://event-hub-frontend.onrender.com",
    "http://localhost:5173",
    "http://localhost:5000",
  ],
  credentials: true,
}));

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

// ── Drop stale FK constraints on startup (idempotent) ────────────────────
// rsvps.user_id references meh-auth IDs — no local users table exists.
async function dropStaleConstraints() {
  try {
    await db.execute(
      sql`ALTER TABLE rsvps DROP CONSTRAINT IF EXISTS rsvps_user_id_fkey`
    );
    console.log("[startup] rsvps_user_id_fkey dropped (or did not exist)");
  } catch (e: any) {
    console.warn("[startup] Could not drop stale FK:", e?.message);
  }
}

(async () => {
  await dropStaleConstraints();
  await registerRoutes(httpServer, app);

  // Sentry must capture the error BEFORE the generic handler swallows it
  if (process.env.SENTRY_DSN) app.use(Sentry.expressErrorHandler() as unknown as express.ErrorRequestHandler);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });

  // Keep-alive ping — must be registered BEFORE serveStatic
  app.get("/ping", (_req, res) => res.send("OK"));

  // Static file serving / Vite dev server — always last
  if (process.env.NODE_ENV === "production") {
    serveStatic(app, fetchGuides);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      scheduleReminders();
    },
  );
})();
