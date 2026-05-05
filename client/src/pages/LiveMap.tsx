// client/src/pages/LiveMap.tsx
import { useState, useRef, useCallback } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
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

// ── Helpers ──────────────────────────────────────────────────────────────────

// Free raster tiles — no API key required
const MAP_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};
const DEFAULT_CENTER = { longitude: 37.6173, latitude: 55.7558, zoom: 11 };

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

// Map each category value to a brand-adjacent colour (using CSS vars isn't
// possible inside SVG/canvas, so we use fixed palette tokens)
const CATEGORY_DOT: Record<string, string> = {
  social:      "hsl(0 72% 51%)",   // primary-ish red
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

// ── Marker ────────────────────────────────────────────────────────────────────

function EventMarker({
  event,
  selected,
  onClick,
}: {
  event: EventWithTickets;
  selected: boolean;
  onClick: () => void;
}) {
  const color = dotColor(event.category);
  const now   = isHappeningNow(event.date);
  const soon  = isStartingSoon(event.date);

  return (
    <Marker
      longitude={(event as any).lng ?? (event as any).longitude ?? 0}
      latitude={(event as any).lat ?? (event as any).latitude ?? 0}
      anchor="bottom"
      onClick={e => { e.originalEvent.stopPropagation(); onClick(); }}
    >
      <div className="relative cursor-pointer select-none" style={{ transform: selected ? "scale(1.25)" : "scale(1)", transition: "transform 0.2s" }}>
        {/* Pulse ring for live events */}
        {now && (
          <span
            className="absolute inset-[-6px] rounded-full animate-ping"
            style={{ background: `${color}35`, animationDuration: "1.8s" }}
          />
        )}
        {/* Pin shape */}
        <div
          className="relative w-9 h-9 border-[2.5px] border-white shadow-lg flex items-center justify-center"
          style={{
            background: color,
            borderRadius: "50% 50% 50% 0",
            transform: "rotate(-45deg)",
            boxShadow: selected ? `0 0 0 3px ${color}60, 0 4px 16px ${color}50` : `0 2px 8px rgba(0,0,0,0.4)`,
          }}
        >
          <span style={{ transform: "rotate(45deg)", fontSize: "15px" }}>
            {EVENT_CATEGORIES.find(c => c.value === event.category)?.icon ?? "✨"}
          </span>
        </div>
        {/* Badge */}
        {(now || soon) && (
          <div
            className="absolute -top-2 -right-2 px-1.5 py-px rounded-full text-[9px] font-bold text-white whitespace-nowrap shadow"
            style={{ background: now ? "#22c55e" : "#f59e0b" }}
          >
            {now ? "LIVE" : "SOON"}
          </div>
        )}
      </div>
    </Marker>
  );
}

// ── Event detail panel ────────────────────────────────────────────────────────

function EventPanel({ event, onClose }: { event: EventWithTickets; onClose: () => void }) {
  const minPrice = getMinPrice(event);
  const now  = isHappeningNow(event.date);
  const soon = isStartingSoon(event.date);
  const color = dotColor(event.category);

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 36 }}
      className="absolute bottom-0 left-0 right-0 z-30 bg-card border-t border-border rounded-t-3xl shadow-2xl"
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full bg-border" />
      </div>

      <div className="px-5 pb-7 pt-2 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-4 w-7 h-7 rounded-full flex items-center justify-center bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Status + category */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Badge variant="secondary" className="capitalize gap-1 text-xs">
            <span>{EVENT_CATEGORIES.find(c => c.value === event.category)?.icon}</span>
            {event.category}
          </Badge>
          {now && (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Happening now
            </span>
          )}
          {!now && soon && (
            <span className="text-xs font-semibold text-amber-500">⏳ Starting soon</span>
          )}
        </div>

        {/* Title */}
        <h2 className="text-xl font-display font-bold text-foreground leading-tight mb-1 pr-8">
          {event.title}
        </h2>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <span>🕐</span>
            {format(new Date(event.date), "EEE d MMM · h:mm a")}
          </span>
          <span className="flex items-center gap-1 truncate">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {event.venueAddress}, {event.venueCity}
          </span>
        </div>

        {event.description && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2">
            {event.description}
          </p>
        )}

        {/* Price + CTA */}
        <div className="flex gap-3 items-center mt-1">
          <div className="flex items-center gap-1.5 text-sm">
            <Ticket className="w-4 h-4 text-primary" />
            <span className="font-bold text-foreground">{minPrice}</span>
          </div>
          <Button asChild className="flex-1 rounded-xl shadow-lg shadow-primary/20">
            <Link href={`/events/${event.id}`}>View Event</Link>
          </Button>
          {(event as any).lat && (event as any).lng && (
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl shrink-0"
              onClick={() => window.open(`https://maps.google.com/?q=${(event as any).lat},${(event as any).lng}`, "_blank")}
            >
              <MapPin className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LiveMap() {
  const mapRef  = useRef<any>(null);
  const [selected, setSelected]   = useState<EventWithTickets | null>(null);
  const [category, setCategory]   = useState("all");
  const [showFilter, setShowFilter] = useState(false);

  const { data: allEvents, isLoading } = useEvents({ published: true });

  // Only show events that have lat/lng coords
  const mappableEvents = (allEvents ?? []).filter(
    e => (e as any).lat != null && (e as any).lng != null && e.published
  );

  // Online events: published, upcoming, no coords
  const onlineEvents = (allEvents ?? []).filter(
    e => e.published && new Date(e.date) >= new Date() && !(e as any).lat
  );

  // Category filter
  const filtered = mappableEvents.filter(e =>
    category === "all" || e.category === category
  );

  const nowCount  = mappableEvents.filter(e => isHappeningNow(e.date)).length;
  const soonCount = mappableEvents.filter(e => isStartingSoon(e.date)).length;

  const handleMarkerClick = useCallback((event: EventWithTickets) => {
    setSelected(event);
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [(event as any).lng, (event as any).lat],
        zoom: 15,
        duration: 600,
      });
    }
  }, []);

  const usedCategories = [...new Set(mappableEvents.map(e => e.category).filter(Boolean))];

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

      {/* ── Map ── */}
      <div className="flex-1 relative">
        <Map
          ref={mapRef}
          initialViewState={DEFAULT_CENTER}
          mapStyle={MAP_STYLE}
          style={{ width: "100%", height: "100%" }}
          attributionControl={false}
          onClick={() => setSelected(null)}
        >
          <NavigationControl position="bottom-right" />
          {filtered.map(event => (
            <EventMarker
              key={event.id}
              event={event}
              selected={selected?.id === event.id}
              onClick={() => handleMarkerClick(event)}
            />
          ))}
        </Map>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Loading events…</p>
            </div>
          </div>
        )}

        {/* No geocoded events */}
        {!isLoading && filtered.length === 0 && (
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
        {!isLoading && onlineEvents.length > 0 && !selected && (
          <Link href="/">
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 glass border border-border/60 text-sm font-medium px-4 py-2 rounded-full shadow-lg hover:border-primary/40 transition-all cursor-pointer">
              <Wifi className="w-4 h-4 text-primary" />
              <span>{onlineEvents.length} online event{onlineEvents.length !== 1 ? "s" : ""} — browse all</span>
            </div>
          </Link>
        )}

        {/* Event panel */}
        <AnimatePresence>
          {selected && (
            <EventPanel event={selected} onClose={() => setSelected(null)} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
