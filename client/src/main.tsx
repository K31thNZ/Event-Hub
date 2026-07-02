// ── Sentry — must be the very first import ─────────────────────────────────
import "./lib/sentry";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { asyncWithLDProvider } from "launchdarkly-react-client-sdk";
import App from "./App";
import "./index.css";

// ── LaunchDarkly — feature flags ──────────────────────────────────────────
// Set VITE_LAUNCHDARKLY_CLIENT_SIDE_ID in your environment to enable.
// Without the key we render the app directly (flags return default values).
const clientSideID = import.meta.env.VITE_LAUNCHDARKLY_CLIENT_SIDE_ID?.trim();

async function bootstrap() {
  const rootEl = document.getElementById("root")!;

  if (clientSideID) {
    // Anonymous context on load — update to identified context after login
    const LDProvider = await asyncWithLDProvider({
      clientSideID,
      context: {
        kind: "user",
        key:  "anonymous",
        anonymous: true,
      },
      timeout: 5,
    });

    createRoot(rootEl).render(
      <StrictMode>
        <LDProvider>
          <App />
        </LDProvider>
      </StrictMode>
    );
  } else {
    // No LD key — render without provider (all flags return defaults)
    createRoot(rootEl).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  }

  // ── Service Worker for Yandex map tile caching ────────────────────────
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then(() => console.log("SW registered for map tiles"))
        .catch((err) => console.warn("SW registration failed", err));
    });
  }
}

void bootstrap();
