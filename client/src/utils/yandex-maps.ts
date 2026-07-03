// client/src/utils/yandex-maps.ts
let yandexScriptPromise: Promise<void> | null = null;

export function loadYandexMaps(apiKey: string): Promise<void> {
  // Fail fast with a clear message if the env var is missing
  if (!apiKey) {
    return Promise.reject(
      new Error(
        "Yandex Maps API key is missing. " +
        "Set VITE_YANDEX_MAPS_API_KEY in your environment variables."
      )
    );
  }

  // Already initialised — return immediately
  if (window.ymaps?.ready) {
    return window.ymaps.ready();
  }

  // Re-use in-flight promise, but only if it hasn't been rejected
  if (yandexScriptPromise) return yandexScriptPromise;

  yandexScriptPromise = new Promise<void>((resolve, reject) => {
    // Guard: script may have been injected by a previous (failed) attempt
    const selector = "script[src*=\"api-maps.yandex.ru\"]";
    const existing = document.querySelector(selector);

    if (existing) {
      // Script tag exists — poll until ymaps is ready
      const poll = setInterval(() => {
        if (window.ymaps?.ready) {
          clearInterval(poll);
          window.ymaps.ready(resolve);
        }
      }, 100);
      setTimeout(() => {
        clearInterval(poll);
        reject(new Error("Yandex Maps timed out waiting for existing script tag."));
      }, 10_000);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://api-maps.yandex.ru/2.1/?apikey=" + apiKey + "&lang=en_RU";
    script.async = true;

    script.onload = () => {
      if (window.ymaps?.ready) {
        window.ymaps.ready(resolve);
      } else {
        reject(new Error("Yandex Maps script loaded but ymaps is not available."));
      }
    };

    // onerror receives a DOM ErrorEvent — convert to a proper Error
    script.onerror = () => {
      yandexScriptPromise = null; // Allow retry on next call
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
      reject(
        new Error(
          "Failed to load Yandex Maps script. " +
          "Check that VITE_YANDEX_MAPS_API_KEY is valid and the domain is " +
          "authorised in the Yandex Developer Console."
        )
      );
    };

    document.head.appendChild(script);
  });

  return yandexScriptPromise;
}
