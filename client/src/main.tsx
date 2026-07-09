// ── Sentry — must be the very first import ─────────────────────────────────
import "./lib/sentry";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

function bootstrap() {
  const rootEl = document.getElementById("root")!;

  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>
  );

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

bootstrap();
