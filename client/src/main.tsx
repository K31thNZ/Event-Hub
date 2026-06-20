// ── Sentry — must be the very first import ─────────────────────────────────
import "./lib/sentry";

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// ── Register Service Worker for Yandex map tile caching ─────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => console.log("SW registered for map tiles"))
      .catch((err) => console.warn("SW registration failed", err));
  });
}
