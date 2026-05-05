import { useState, useRef, useCallback, useEffect } from "react";
import { useEvents } from "@/hooks/use-events";
import { type EventWithTickets } from "@shared/schema";
import { format } from "date-fns";
import { Link } from "wouter";
import { MapPin, ArrowLeft, Ticket, Filter, X, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { EVENT_CATEGORIES } from "@shared/categories";

// ── Yandex Maps script loading ──────────────────────────────────────────────
declare global {
  interface Window {
    ymaps: any;
  }
}

let yandexScriptPromise: Promise<void> | null = null;

function loadYandexMaps(apiKey: string): Promise<void> {
  if (window.ymaps?.ready) {
    return window.ymaps.ready();
  }
  if (yandexScriptPromise) return yandexScriptPromise;

  yandexScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/3.0/?apikey=${apiKey}&lang=en_US`;
    script.async = true;
    script.onload = () => {
      window.ymaps.ready(resolve);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return yandexScriptPromise;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function isHappeningNow(date: string | Date): boolean {
  const d = new Date(date);
  const now = new Date();
  const diff = (d.getTime() - now.getTime()) / 60000;
  return diff <= 0 && diff >= -120;
}

function isStartingSoon(date: string | Date): boolean {
  const diff = (new Date(date).getTime() - new Date().getTime()) / 60000;
  return diff > 0 && diff <= 90;
}

function getMinPrice(event: EventWithTickets): string {
  if (!event.ticketTypes.length) return "Free";
  const min = Math.min(...event.ticketTypes.map(t => t.price));
  return min === 0 ? "Free" : `${min} ₽`;
}

const CATEGORY_DOT: Record<string, string> = {
  social:      "hsl(0 72% 51%)",
  culture:     "hsl(270 60% 55%)",
  education:   "hsl(213 94% 55%)",
  language:    "hsl(158 64% 44%)",
  sports:      "hsl(34 100% 50%)",
  networking:  "hsl(340 80% 55%)",
  music:       "hsl(290 70% 55%)",
  food:        "hsl(25 90% 50%)",
  wellness:    "hsl(175 60% 45%)",
  tech:        "hsl(200 80% 50%)",
  outdoor:     "hsl(85 65% 42%)",
  other:       "hsl(220 15% 55%)",
};

function dotColor(category?: string | null): string {
  return CATEGORY_DOT[category ?? "other"] ?? CATEGORY_DOT.other;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LiveMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [selected, setSelected] = useState<EventWithTickets | null>(null);
  const [category, setCategory] = useState("all");
  const [showFilter, setShowFilter] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  const { data: allEvents, isLoading } = useEvents({ published: true });

  const mappableEvents = (allEvents ?? []).filter(
    e => (e as any).lat != null && (e as any).lng != null && e.published
  );
  const onlineEvents = (allEvents ?? []).filter(
    e => e.published && new Date(e.date) >= new Date() && !(e as any).lat
  );

  const filtered = mappableEvents.filter(e =>
    category === "all" || e.category === category
  );

  const nowCount  = mappableEvents.filter(e => isHappeningNow(e.date)).length;
  const soonCount = mappableEvents.filter(e => isStartingSoon(e.date)).length;

  // Initialize Yandex Map
  useEffect(() => {
    const apiKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY;
    if (!apiKey) {
      console.error("Yandex Maps API key missing. Add VITE_YANDEX_MAPS_API_KEY to .env");
      return;
    }

    loadYandexMaps(apiKey).then(() => {
      if (!mapContainerRef.current) return;

      const defaultCenter = [55.7558, 37.6173]; // Moscow
      const mapInstance = new window.ymaps.Map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 11,
        controls: ["zoomControl", "typeSelector", "fullscreenControl"],
      });
      mapRef.current = mapInstance;

      // Add geolocation button
      const geolocationControl = new window.ymaps.control.GeolocationControl({
        options: { float: "right" },
      });
      mapInstance.controls.add(geolocationControl);

      setMapLoaded(true);
    }).catch(err => console.error("Failed to load Yandex Maps:", err));

    return () => {
      if (mapRef.current) {
        mapRef.current.destroy();
      }
    };
  }, []);

  // Add/remove markers when filtered events change
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    // Clear existing placemarks (keep only controls)
    const map = mapRef.current;
    map.geoObjects.each((obj: any) => {
      if (obj.properties?.get("isEventMarker")) {
        map.geoObjects.remove(obj);
      }
    });

    // Add markers for each filtered event
    filtered.forEach(event => {
      const lat = (event as any).lat;
      const lng = (event as any).lng;
      if (!lat || !lng) return;

      const color = dotColor(event.category);
      const now = isHappeningNow(event.date);
      const soon = isStartingSoon(event.date);

      // Create a custom HTML marker
      const markerContent = document.createElement("div");
      markerContent.className = "relative cursor-pointer select-none";
      markerContent.innerHTML = `
        <div style="position: relative;">
          ${now ? `<span style="position: absolute; inset: -6px; border-radius: 50%; background: ${color}35; animation: pulse 1.8s infinite;"></span>` : ""}
          <div style="
            width: 36px; height: 36px;
            background: ${color};
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2.5px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="transform: rotate(45deg); font-size: 15px;">
              ${EVENT_CATEGORIES.find(c => c.value === event.category)?.icon ?? "✨"}
            </span>
          </div>
          ${(now || soon) ? `
            <div style="
              position: absolute; top: -8px; right: -8px;
              background: ${now ? "#22c55e" : "#f59e0b"};
              color: white;
              font-size: 9px; font-weight: bold;
              padding: 1px 6px;
              border-radius: 20px;
              white-space: nowrap;
              box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            ">
              ${now ? "LIVE" : "SOON"}
            </div>
          ` : ""}
        </div>
      `;

      const placemark = new window.ymaps.Placemark(
        [lat, lng],
        { id: event.id, isEventMarker: true },
        {
          iconLayout: "default#imageWithContent",
          iconImageSize: [36, 36],
          iconImageOffset: [-18, -18],
          content: markerContent,
        }
      );

      placemark.events.add("click", () => {
        setSelected(event);
        map.setCenter([lat, lng], 15, { duration: 600 });
      });

      map.geoObjects.add(placemark);
    });
  }, [mapLoaded, filtered]);

  const handleMarkerClick = useCallback((event: EventWithTickets) => {
    setSelected(event);
    if (mapRef.current) {
      mapRef.current.setCenter([(event as any).lat, (event as any).lng], 15, { duration: 600 });
    }
  }, []);

  const usedCategories = [...new Set(mappableEvents.map(e => e.category).filter(Boolean))];

  return (
    <div className="h-[calc(100vh-4rem)] w-full flex flex-col overflow-hidden relative bg-background">

      {/* Top bar (unchanged) */}
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

      {/* Filter dropdown (unchanged) */}
      <AnimatePresence>
        {showFilter && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute top-[3.75rem] left-0 right-0 z-20 px-4 pt-2 pb-3 glass border-b border-border/60 flex flex-wrap gap-2"
          >
            {[{ value: "all", label: "All", icon: "🗺️" }, ...EVENT_CATEGORIES.filter(c => usedCategories.includes(c.value))].map(cat => (
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

      {/* Yandex Map container */}
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
              <p className="font-semibold text-foreground">No events on the map</p>
              <p className="text-muted-foreground text-sm mt-1">
                {category !== "all" ? "Try a different category." : "Events need location data to appear here."}
              </p>
            </div>
          </div>
        )}

        {/* Online events pill (unchanged) */}
        {mapLoaded && !isLoading && onlineEvents.length > 0 && !selected && (
          <Link href="/">
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 glass border border-border/60 text-sm font-medium px-4 py-2 rounded-full shadow-lg hover:border-primary/40 transition-all cursor-pointer">
              <Wifi className="w-4 h-4 text-primary" />
              <span>{onlineEvents.length} online event{onlineEvents.length !== 1 ? "s" : ""} — browse all</span>
            </div>
          </Link>
        )}

        {/* Event panel (unchanged) */}
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
