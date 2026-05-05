// client/src/pages/LiveMap.tsx
import { useState, useRef, useCallback, useEffect } from "react";
import { useEvents } from "@/hooks/use-events";
import { type EventWithTickets } from "@shared/schema";
import { format } from "date-fns";
import { Link } from "wouter";
import { MapPin, ArrowLeft, Ticket, Filter, X, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { EVENT_CATEGORIES } from "@shared/categories";

// ── Yandex Maps 3.0 loader ───────────────────────────────────────────────────
// ymaps3 is injected as a global by the script tag. We must wait for its
// internal `ready` promise — window.ymaps3 does NOT exist until after that
// promise resolves, so we cannot call window.ymaps3 inside onload directly.

declare global {
  interface Window { ymaps3: any; }
}

let _loaderPromise: Promise<void> | null = null;

function loadYandexMaps(apiKey: string): Promise<void> {
  if (_loaderPromise) return _loaderPromise;

  _loaderPromise = new Promise<void>((resolve, reject) => {
    // Yandex 3.0 script sets up window.ymaps3 and exposes a `ready` promise
    // only after DOMContentLoaded has fired internally — so we must poll or
    // listen for the script to finish bootstrapping via ymaps3.ready.
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/3.0/?apikey=${apiKey}&lang=en_US`;
    script.async = true;

    script.onload = () => {
      // At this point the script tag has loaded but ymaps3 may not yet be
      // initialised. We wait for ymaps3.ready which is always a Promise in v3.
      const waitForYmaps = () => {
        if (window.ymaps3?.ready) {
          Promise.resolve(window.ymaps3.ready).then(resolve).catch(reject);
        } else {
          // Poll every 50 ms until ymaps3.ready is available
          setTimeout(waitForYmaps, 50);
        }
      };
      waitForYmaps();
    };

    script.onerror = () => reject(new Error("Failed to load Yandex Maps script"));
    document.head.appendChild(script);
  });

  return _loaderPromise;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isHappeningNow(date: string | Date): boolean {
  const diff = (new Date(date).getTime() - Date.now()) / 60000;
  return diff <= 0 && diff >= -120;
}

function isStartingSoon(date: string | Date): boolean {
  const diff = (new Date(date).getTime() - Date.now()) / 60000;
  return diff > 0 && diff <= 90;
}

function getMinPrice(event: EventWithTickets): string {
  if (!event.ticketTypes.length) return "Free";
  const min = Math.min(...event.ticketTypes.map(t => t.price));
  return min === 0 ? "Free" : `${min} ₽`;
}

const CATEGORY_COLOR: Record<string, string> = {
  social:     "#e53935",
  culture:    "#8e24aa",
  education:  "#1e88e5",
  language:   "#00897b",
  sports:     "#fb8c00",
  networking: "#d81b60",
  music:      "#7b1fa2",
  food:       "#f4511e",
  wellness:   "#00acc1",
  tech:       "#039be5",
  outdoor:    "#43a047",
  other:      "#757575",
};

function catColor(category?: string | null) {
  return CATEGORY_COLOR[category ?? "other"] ?? CATEGORY_COLOR.other;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LiveMap() {
  const mapDivRef   = useRef<HTMLDivElement>(null);
  const mapRef      = useRef<any>(null);
  const markersRef  = useRef<any[]>([]);

  const [selected,   setSelected]   = useState<EventWithTickets | null>(null);
  const [category,   setCategory]   = useState("all");
  const [showFilter, setShowFilter] = useState(false);
  const [mapReady,   setMapReady]   = useState(false);
  const [mapError,   setMapError]   = useState<string | null>(null);

  const { data: allEvents, isLoading } = useEvents({});

  const mappable = (allEvents ?? []).filter(
    e => e.published && (e as any).lat != null && (e as any).lng != null
  );
  const onlineEvents = (allEvents ?? []).filter(
    e => e.published && new Date(e.date) >= new Date() && (e as any).lat == null
  );
  const filtered = mappable.filter(
    e => category === "all" || e.category === category
  );

  const nowCount  = mappable.filter(e => isHappeningNow(e.date)).length;
  const soonCount = mappable.filter(e => isStartingSoon(e.date)).length;
  const usedCats  = [...new Set(mappable.map(e => e.category).filter(Boolean))];

  // ── Boot map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const apiKey = (import.meta as any).env?.VITE_YANDEX_MAPS_API_KEY;
    if (!apiKey) {
      setMapError("Yandex Maps API key not set. Add VITE_YANDEX_MAPS_API_KEY to your .env file.");
      return;
    }

    loadYandexMaps(apiKey)
      .then(() => {
        if (!mapDivRef.current) return;
        const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapControls, YMapZoomControl } = window.ymaps3;

        const map = new YMap(mapDivRef.current, {
          location: { center: [37.6173, 55.7558], zoom: 11 },
        });

        map.addChild(new YMapDefaultSchemeLayer({}));
        map.addChild(new YMapDefaultFeaturesLayer({}));

        const controls = new YMapControls({ position: "right" });
        controls.addChild(new YMapZoomControl({}));
        map.addChild(controls);

        mapRef.current = map;
        setMapReady(true);
      })
      .catch(err => {
        console.error(err);
        setMapError("Could not load Yandex Maps. Check your API key and network.");
      });

    return () => {
      mapRef.current?.destroy?.();
      mapRef.current = null;
      _loaderPromise = null;
    };
  }, []);

  // ── Sync markers ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const { YMapMarker } = window.ymaps3;

    // Remove old markers
    markersRef.current.forEach(m => mapRef.current.removeChild(m));
    markersRef.current = [];

    // Add new markers
    filtered.forEach(event => {
      const lat = (event as any).lat as number;
      const lng = (event as any).lng as number;
      const color = catColor(event.category);
      const now  = isHappeningNow(event.date);
      const soon = isStartingSoon(event.date);

      // Build DOM element for the marker
      const el = document.createElement("div");
      el.style.cssText = "position:relative;cursor:pointer;user-select:none;";
      el.innerHTML = `
        ${now ? `<span style="position:absolute;inset:-6px;border-radius:50%;background:${color}35;animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></span>` : ""}
        <div style="
          width:36px;height:36px;
          background:${color};
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          border:2.5px solid white;
          box-shadow:0 2px 8px rgba(0,0,0,0.35);
          display:flex;align-items:center;justify-content:center;
        ">
          <span style="transform:rotate(45deg);font-size:15px;">
            ${EVENT_CATEGORIES.find(c => c.value === event.category)?.icon ?? "✨"}
          </span>
        </div>
        ${now || soon ? `
          <div style="
            position:absolute;top:-8px;right:-10px;
            background:${now ? "#22c55e" : "#f59e0b"};
            color:white;font-size:9px;font-weight:700;
            padding:1px 5px;border-radius:20px;
            white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.2);
          ">${now ? "LIVE" : "SOON"}</div>
        ` : ""}
      `;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelected(event);
        mapRef.current?.setLocation?.({ center: [lng, lat], zoom: 15, duration: 600 });
      });

      const marker = new YMapMarker({ coordinates: [lng, lat], draggable: false }, el);
      mapRef.current.addChild(marker);
      markersRef.current.push(marker);
    });
  }, [mapReady, filtered]);

  // ── Ping keyframe (inject once) ───────────────────────────────────────────
  useEffect(() => {
    const id = "ymap-ping-style";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id;
      s.textContent = `@keyframes ping{75%,100%{transform:scale(2);opacity:0}}`;
      document.head.appendChild(s);
    }
  }, []);

  return (
    <div className="h-[calc(100vh-4rem)] w-full flex flex-col overflow-hidden relative bg-background">

      {/* ── Top bar ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-4 py-3 glass border-b border-border/60">
        <Button asChild variant="ghost" size="icon" className="rounded-full shrink-0 -ml-1">
          <Link href="/"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-base">Live Map</h1>
            {nowCount > 0 && (
              <span className="flex items-center gap-1 bg-green-500/15 text-green-600 dark:text-green-400 text-xs px-2 py-0.5 rounded-full border border-green-500/30 font-semibold">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                {nowCount} live
              </span>
            )}
            {soonCount > 0 && (
              <span className="text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30 font-semibold">
                {soonCount} soon
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isLoading ? "Loading…" : `${filtered.length} event${filtered.length !== 1 ? "s" : ""} on the map`}
          </p>
        </div>

        <Button
          variant={showFilter ? "default" : "outline"}
          size="sm"
          className="rounded-full gap-1.5 shrink-0"
          onClick={() => setShowFilter(v => !v)}
        >
          <Filter className="w-3.5 h-3.5" />
          {category !== "all" ? EVENT_CATEGORIES.find(c => c.value === category)?.label : "Filter"}
        </Button>
      </div>

      {/* ── Filter dropdown ── */}
      <AnimatePresence>
        {showFilter && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute top-[3.75rem] left-0 right-0 z-20 px-4 pt-2 pb-3 glass border-b border-border/60 flex flex-wrap gap-2"
          >
            {[{ value: "all", label: "All", icon: "🗺️" }, ...EVENT_CATEGORIES.filter(c => usedCats.includes(c.value))].map(cat => (
              <button
                key={cat.value}
                onClick={() => { setCategory(cat.value); setShowFilter(false); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  category === cat.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                <span>{cat.icon}</span> {cat.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Map area ── */}
      <div className="flex-1 relative">
        <div ref={mapDivRef} className="absolute inset-0" />

        {/* Loading */}
        {(!mapReady || isLoading) && !mapError && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Loading map…</p>
            </div>
          </div>
        )}

        {/* Error */}
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="glass rounded-2xl px-6 py-6 text-center mx-8 border border-border/60 shadow-xl max-w-sm">
              <div className="text-4xl mb-3">🗺️</div>
              <p className="font-semibold text-foreground mb-1">Map unavailable</p>
              <p className="text-muted-foreground text-sm">{mapError}</p>
            </div>
          </div>
        )}

        {/* No geocoded events */}
        {mapReady && !isLoading && filtered.length === 0 && !mapError && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="glass rounded-2xl px-6 py-5 text-center mx-8 border border-border/60 shadow-xl">
              <div className="text-4xl mb-2">🗓️</div>
              <p className="font-semibold text-foreground">No events on the map</p>
              <p className="text-muted-foreground text-sm mt-1">
                {category !== "all" ? "Try a different category." : "Events need location data to appear here."}
              </p>
            </div>
          </div>
        )}

        {/* Online events pill */}
        {mapReady && !isLoading && onlineEvents.length > 0 && !selected && (
          <Link href="/">
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 glass border border-border/60 text-sm font-medium px-4 py-2 rounded-full shadow-lg hover:border-primary/40 transition-all cursor-pointer whitespace-nowrap">
              <Wifi className="w-4 h-4 text-primary" />
              {onlineEvents.length} online event{onlineEvents.length !== 1 ? "s" : ""} — browse all
            </div>
          </Link>
        )}

        {/* ── Event detail panel ── */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 36 }}
              className="absolute bottom-0 left-0 right-0 z-30 bg-card border-t border-border rounded-t-3xl shadow-2xl"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
              <div className="px-5 pb-7 pt-2 relative">
                <button
                  onClick={() => setSelected(null)}
                  className="absolute top-2 right-4 w-7 h-7 rounded-full flex items-center justify-center bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Badge variant="secondary" className="capitalize gap-1 text-xs">
                    <span>{EVENT_CATEGORIES.find(c => c.value === selected.category)?.icon}</span>
                    {selected.category}
                  </Badge>
                  {isHappeningNow(selected.date) && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      Happening now
                    </span>
                  )}
                  {!isHappeningNow(selected.date) && isStartingSoon(selected.date) && (
                    <span className="text-xs font-semibold text-amber-500">⏳ Starting soon</span>
                  )}
                </div>

                <h2 className="text-xl font-display font-bold text-foreground leading-tight mb-1 pr-8">
                  {selected.title}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3">
                  <span>🕐 {format(new Date(selected.date), "EEE d MMM · h:mm a")}</span>
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {selected.venueAddress}, {selected.venueCity}
                  </span>
                </div>
                {selected.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2">
                    {selected.description}
                  </p>
                )}
                <div className="flex gap-3 items-center">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Ticket className="w-4 h-4 text-primary" />
                    <span className="font-bold text-foreground">{getMinPrice(selected)}</span>
                  </div>
                  <Button asChild className="flex-1 rounded-xl shadow-lg shadow-primary/20">
                    <Link href={`/events/${selected.id}`}>View Event</Link>
                  </Button>
                  {(selected as any).lat && (selected as any).lng && (
                    <Button
                      variant="outline" size="icon" className="rounded-xl shrink-0"
                      onClick={() => window.open(`https://maps.google.com/?q=${(selected as any).lat},${(selected as any).lng}`, "_blank")}
                    >
                      <MapPin className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
