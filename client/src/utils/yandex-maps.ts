// client/src/utils/yandex-maps.ts
let yandexScriptPromise: Promise<void> | null = null;

export function loadYandexMaps(apiKey: string): Promise<void> {
  if (window.ymaps?.ready) return window.ymaps.ready();
  if (yandexScriptPromise) return yandexScriptPromise;
  yandexScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=en_RU`;
    script.async = true;
    script.onload = () => window.ymaps.ready(resolve);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return yandexScriptPromise;
}
