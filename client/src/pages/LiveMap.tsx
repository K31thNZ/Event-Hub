import { useState, useRef, useEffect, useCallback } from "react";
import { useEvents } from "@/hooks/use-events";
import { type EventWithTickets } from "@shared/schema";
import { format, addHours } from "date-fns";
import { Link } from "wouter";
import { MapPin, ArrowLeft, Ticket, Filter, X, Wifi, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { EVENT_CATEGORIES } from "@shared/categories";
import { loadYandexMaps } from "@/utils/yandex-maps";

declare global {
  interface Window { ymaps: any; }
}

let yandexScriptPromise: Promise<void> | null = null;

function loadYandexMaps(apiKey: string): Promise<void> {
  if (window.ymaps?.ready) return window.ymaps.ready();
  if (yandexScriptPromise) return yandexScriptPromise;
  yandexScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=en_US`;
    script.async = true;
    script.onload = () => window.ymaps.ready(resolve);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return yandexScriptPromise;
}

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

const CATEGORY_DOT: Record<string, string> = {
  social:     "hsl(0 72% 51%)",
  culture:    "hsl(270 60% 55%)",
  education:  "hsl(213 94% 55%)",
  language:   "hsl(158 64% 44%)",
  sports:     "hsl(34 100% 50%)",
  networking: "hsl(340 80% 55%)",
  music:      "hsl(290 70% 55%)",
  food:       "hsl(25 90% 50%)",
  wellness:   "hsl(175 60% 45%)",
  tech:       "hsl(200 80% 50%)",
  outdoor:    "hsl(85 65% 42%)",
  other:      "hsl(220 15% 55%)",
};

function dotColor(category?: string | null): string {
  return CATEGORY_DOT[category ?? "other"] ?? CATEGORY_DOT.other;
}

const TRANSPARENT_GIF =
  "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

// How many hours to step forward/back with the arrows
const WINDOW_STEP_HOURS = 6;

export default function LiveMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<any>(null);
  const markersRef      = useRef<any[]>([]);          // ← track markers separately

  const [selected,    setSelected]    = useState<EventWithTickets | null>(null);
  const [category,    setCategory]    = useState("all");
  const [showFilter,  setShowFilter]  = useState(false);
  const [showLegend,  setShowLegend]  = useState(false);
  const [mapLoaded,   setMapLoaded]   = useState(false);

  // windowStart: the beginning of the 24-hour window; always >= now
  const [windowStart, setWindowStart] = useState<Date>(() => new Date());

  const windowEnd = addHours(windowStart, 24);

  const shiftWindow = useCallback((direction: "back" | "forward") => {
    setWindowStart(prev => {
      const now  = new Date();
      const next = addHours(prev, direction === "forward" ? WINDOW_STEP_HOURS : -WINDOW_STEP_HOURS);
      // Floor at now — can't look into the past
      return next < now ? now : next;
    });
  }, []);

  const { data: allEvents, isLoading } = useEvents({ published: true });

  const now = new Date();

  // Events with valid coordinates
  const mappableEvents = (allEvents ?? []).filter(
    e => (e as any).lat != null && (e as any).lng != null && e.published
  );

  // Within the 24-hour window
  const windowedEvents = mappableEvents.filter(e => {
    const d = new Date(e.date);
    return d >= windowStart && d < windowEnd;
  });

  // Online events for the pill
  const onlineEvents = (allEvents ?? []).filter(
    e => e.published && new Date(e.date) >= now && e.venueAddress?.toLowerCase() === "online"
  );

  // Apply category filter on top of window
  const filtered = windowedEvents.filter(
    e => category === "all" || e.category === category
  );

  const nowCount  = mappableEvents.filter(e => isHappeningNow(e.date)).length;
  const soonCount = mappableEvents.filter(e => isStartingSoon(e.date)).length;

  // Categories present in the windowed (not just filtered) set, for legend + filter
  const usedCategories = [...new Set(windowedEvents.map(e => e.category).filter(Boolean))] as string[];

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const apiKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY;
    if (!apiKey) {
      console.error("Yandex Maps API key missing. Add VITE_YANDEX_MAPS_API_KEY to .env");
      return;
    }
    loadYandexMaps(apiKey)
      .then(() => {
        if (!mapContainerRef.current || mapRef.current) return;
        const mapInstance = new window.ymaps.Map(mapContainerRef.current, {
          center: [55.7558, 37.6173],
          zoom: 11,
          controls: ["zoomControl", "typeSelector", "fullscreenControl"],
        });
        mapRef.current = mapInstance;
        mapInstance.controls.add(
          new window.ymaps.control.GeolocationControl({ options: { float: "right" } })
        );
        setMapLoaded(true);
      })
      .catch(err => console.error("Failed to load Yandex Maps:", err));

    return () => {
      if (mapRef.current) { mapRef.current.destroy(); mapRef.current = null; }
    };
  }, []);

  // ── Update markers whenever filter/window/map changes ───────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    // Safe removal: operate on snapshot, not live iteration
    markersRef.current.forEach(pm => map.geoObjects.remove(pm));
    markersRef.current = [];

    filtered.forEach(event => {
      // ── Coordinate swap guard ──────────────────────────────────────────────
      // Yandex expects [lat, lng]. If lng is clearly a latitude-range value
      // (−90 to 90) and lat is clearly a longitude-range value (outside ±90),
      // they were stored swapped — correct it silently.
      let lat = Number((event as any).lat);
      let lng = Number((event as any).lng);
      if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
        [lat, lng] = [lng, lat];
      }
      if (!lat || !lng) return;

      const color = dotColor(event.category);
      const live  = isHappeningNow(event.date);
      const soon  = isStartingSoon(event.date);
      const icon  = EVENT_CATEGORIES.find(c => c.value === event.category)?.icon ?? "✨";

      const markerHtml = `
        <div style="position:relative;width:40px;height:40px;">
          ${live ? `<div style="position:absolute;inset:-6px;border-radius:50%;background:${color}35;animation:ymap-pulse 1.8s infinite;"></div>` : ""}
          <div style="
            width:36px;height:36px;background:${color};
            border-radius:50% 50% 50% 0;transform:rotate(-45deg);
            border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);
            display:flex;align-items:center;justify-content:center;cursor:pointer;
          ">
            <span style="transform:rotate(45deg);font-size:15px;">${icon}</span>
          </div>
          ${(live || soon) ? `
            <div style="
              position:absolute;top:-8px;right:-8px;
              background:${live ? "#22c55e" : "#f59e0b"};color:white;
              font-size:9px;font-weight:bold;padding:1px 6px;
              border-radius:20px;white-space:nowrap;
              box-shadow:0 1px 3px rgba(0,0,0,.2);pointer-events:none;
            ">${live ? "LIVE" : "SOON"}</div>
          ` : ""}
        </div>`;

      const placemark = new window.ymaps.Placemark(
        [lat, lng],
        { isEventMarker: true, eventId: event.id, iconContent: markerHtml },
        {
          iconLayout: "default#imageWithContent",
          iconImageHref: TRANSPARENT_GIF,
          iconImageSize: [40, 40],
          iconImageOffset: [-20, -20],
          iconContentOffset: [-20, -20],
          hideIconOnBalloonOpen: false,
        }
      );

      placemark.events.add("click", () => {
        setSelected(event);
        map.setCenter([lat, lng], 15, { duration: 300 });
      });

      map.geoObjects.add(placemark);
      markersRef.current.push(placemark);
    });
  }, [mapLoaded, filtered]);

  // ── Window label for header ─────────────────────────────────────────────────
  const isCurrentWindow = windowStart <= new Date(Date.now() + 60_000); // within ~1 min of now
  const windowLabel = isCurrentWindow
    ? "Next 24 hours"
    : `${format(windowStart, "EEE d MMM · HH:mm")} → ${format(windowEnd, "HH:mm")}`;

  return (
    <div className="h-[calc(100vh-4rem)] w-full flex flex-col overflow-hidden relative bg-background">
      <style>{`
        @keyframes ymap-pulse {
          0%   { transform: scale(1);   opacity: .4; }
          100% { transform: scale(1.5); opacity: 0;  }
        }
      `}</style>

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
            {isLoading
              ? "Loading…"
              : `${filtered.length} event${filtered.length !== 1 ? "s" : ""} · ${windowLabel}`}
          </p>
        </div>

        {/* ← window arrows + filter → */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full w-8 h-8"
            disabled={isCurrentWindow}
            onClick={() => shiftWindow("back")}
            title="Earlier"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full w-8 h-8"
            onClick={() => shiftWindow("forward")}
            title="Later"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          <Button
            variant={showFilter ? "default" : "outline"}
            size="sm"
            className="rounded-full gap-1.5 ml-1"
            onClick={() => setShowFilter(v => !v)}
          >
            <Filter className="w-3.5 h-3.5" />
            {category !== "all" ? EVENT_CATEGORIES.find(c => c.value === category)?.label : "Filter"}
          </Button>
        </div>
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
            {[{ value: "all", label: "All", icon: "🗺️" },
              ...EVENT_CATEGORIES.filter(c => usedCategories.includes(c.value))
            ].map(cat => (
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

      {/* ── Map ── */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="absolute inset-0" style={{ width: "100%", height: "100%" }} />

        {/* Loading overlay */}
        {(!mapLoaded || isLoading) && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Loading map…</p>
            </div>
          </div>
        )}

        {/* No events */}
        {mapLoaded && !isLoading && filtered.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="glass rounded-2xl px-6 py-5 text-center mx-8 border border-border/60 shadow-xl">
              <div className="text-4xl mb-2">🗓️</div>
              <p className="font-semibold text-foreground">No events in this window</p>
              <p className="text-muted-foreground text-sm mt-1">
                {category !== "all"
                  ? "Try a different category or shift the time window."
                  : "Use the arrows to browse a different 24-hour window."}
              </p>
            </div>
          </div>
        )}

        {/* ── Legend toggle ── */}
        {mapLoaded && !isLoading && usedCategories.length > 0 && !selected && (
          <div className="absolute bottom-[4.5rem] left-4 z-20">
            <AnimatePresence>
              {showLegend && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  className="mb-2 glass border border-border/60 rounded-2xl px-3 py-2.5 shadow-xl min-w-[160px]"
                >
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                    Categories
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {usedCategories.map(cat => {
                      const meta = EVENT_CATEGORIES.find(c => c.value === cat);
                      return (
                        <div key={cat} className="flex items-center gap-2 px-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: dotColor(cat) }}
                          />
                          <span className="text-xs text-foreground capitalize">{meta?.icon} {meta?.label ?? cat}</span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Status indicators */}
                  <div className="border-t border-border/40 mt-2 pt-2 flex flex-col gap-1.5 px-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0 animate-pulse" />
                      <span className="text-xs text-foreground">Happening now</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                      <span className="text-xs text-foreground">Starting soon</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <button
              onClick={() => setShowLegend(v => !v)}
              className={`flex items-center gap-1.5 glass border text-xs font-medium px-3 py-1.5 rounded-full shadow-lg transition-all ${
                showLegend ? "border-primary/50 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/30"
              }`}
            >
              <span className="flex gap-0.5">
                {usedCategories.slice(0, 4).map(cat => (
                  <span key={cat} className="w-2 h-2 rounded-full" style={{ background: dotColor(cat) }} />
                ))}
              </span>
              Legend
            </button>
          </div>
        )}

        {/* Online events pill */}
        {mapLoaded && !isLoading && onlineEvents.length > 0 && !selected && (
          <Link href="/">
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 glass border border-border/60 text-sm font-medium px-4 py-2 rounded-full shadow-lg hover:border-primary/40 transition-all cursor-pointer">
              <Wifi className="w-4 h-4 text-primary" />
              <span>{onlineEvents.length} online event{onlineEvents.length !== 1 ? "s" : ""} — browse all</span>
            </div>
          </Link>
        )}

        {/* ── Event panel ── */}
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
                  <span className="flex items-center gap-1">
                    <span>🕐</span>
                    {format(new Date(selected.date), "EEE d MMM · h:mm a")}
                  </span>
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
                <div className="flex gap-3 items-center mt-1">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Ticket className="w-4 h-4 text-primary" />
                    <span className="font-bold text-foreground">{getMinPrice(selected)}</span>
                  </div>
                  <Button asChild className="flex-1 rounded-xl shadow-lg shadow-primary/20">
                    <Link href={`/events/${selected.id}`}>View Event</Link>
                  </Button>
                  {(selected as any).lat && (selected as any).lng && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-xl shrink-0"
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
