// server/sentry.ts
// Initialise Sentry for the Node/Express backend.
//
// SENTRY_DSN must be set in the Render environment variables.
// If it's missing (e.g. local dev without a DSN), Sentry is a no-op —
// nothing throws, the app starts normally.
//
// Import this file at the very top of server/index.ts (before any other
// imports) so that Sentry instruments the HTTP framework from the start.

import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    // Capture 100% of transactions in production — dial down if volume is high
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    // Attach basic request info (URL, method, headers — no body)
    sendDefaultPii: false,
  });
  console.log("[Sentry] Initialised — backend error tracking active");
} else {
  console.warn("[Sentry] SENTRY_DSN not set — error tracking disabled");
}

export { Sentry };
