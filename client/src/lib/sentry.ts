// client/src/lib/sentry.ts
// Initialise Sentry for the React frontend.
//
// VITE_SENTRY_DSN must be set in Render (or .env.local for dev).
// If missing, Sentry is a no-op.
//
// Import this at the very top of client/src/main.tsx (before React is loaded).

import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,                // "production" | "development"
    // Capture all errors; sample 10% of performance transactions
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    // Replay 10% of sessions, 100% of sessions with an error
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Mask all text + block all media by default (GDPR-safe)
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Don't send errors from browser extensions or localhost
    denyUrls: [
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
    ],
    beforeSend(event) {
      // Strip any accidental PII from breadcrumbs
      const values = event.breadcrumbs?.values;
      if (Array.isArray(values)) {
        (event.breadcrumbs as any).values = values.map((b: Sentry.Breadcrumb) => ({
          ...b,
          message: b.message?.replace(/email=[\w@.]+/gi, "email=[redacted]"),
        }));
      }
      return event;
    },
  });
}

export { Sentry };
