// client/src/pages/LiveMap.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import Map, { Marker, NavigationControl, Popup } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

// ---- Types ----
interface Event {
  id: string | number;
  title: string;
  description?: string;
  category?: string;
  local_time: string;
  venue_address: string;
  lat?: number;
  lng?: number;
  source_url?: string;
}

interface OnlineEvent {
  id: string | number;
  title: string;
  category?: string;
  local_time: string;
  source_url?: string;
}

// ---- Constants ----
const MOSCOW_CENTER: [number, number] = [55.7558, 37.6173];

const CATEGORY_COLORS: Record<string, { bg: string; label: string }> = {
  social:    { bg: "#f97316", label: "Social"    },
  culture:   { bg: "#8b5cf6", label: "Culture"   },
  education: { bg: "#3b82f6", label: "Education" },
  language:  { bg: "#10b981", label: "Language"  },
  sport:     { bg: "#ef4444", label: "Sport"     },
  other:     { bg: "#6b7280", label: "Other"     },
};

const CATEGORY_EMOJI: Record<string, string> = {
  social:    "🗣️",
  culture:   "🎭",
  education: "📚",
  language:  "💬",
  sport:     "⚽",
  other:     "✨",
};

// ---- Helper functions ----
function formatTime(isoString?: string): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
}

function isHappeningNow(isoString?: string): boolean {
  if (!isoString) return false;
  const start = new Date(isoString);
  const now = new Date();
  const diff = (start.getTime() - now.getTime()) / 60000; // minutes
  return diff <= 0 && diff >= -120; // started within last 2 hours
}

function isUpcoming(isoString?: string): boolean {
  if (!isoString) return false;
  const start = new Date(isoString);
  const now = new Date();
  const diff = (start.getTime() - now.getTime()) / 60000;
  return diff > 0 && diff <= 90; // starts within 90 min
}

// ---- Custom Marker Component ----
const CustomMarker = ({ event, onClick }: { event: Event; onClick: () => void }) => {
  const cat = event.category ?? "other";
  const color = CATEGORY_COLORS[cat]?.bg ?? "#f97316";
  const emoji = CATEGORY_EMOJI[cat] ?? "✨";
  const happening = isHappeningNow(event.local_time);
  const upcoming = isUpcoming(event.local_time);

  return (
    <Marker
      longitude={event.lng!}
      latitude={event.lat!}
      anchor="bottom"
      onClick={onClick}
    >
      <div className="relative cursor-pointer group">
        {/* Pulse animation (only for happening now) */}
        {happening && (
          <div
            className="absolute inset-[-8px] rounded-full animate-ping"
            style={{ background: `${color}40`, animationDuration: "1.5s" }}
          />
        )}
        {/* Main marker */}
        <div
          className="relative w-10 h-10 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
          style={{
            background: color,
            transform: "rotate(-45deg)",
            borderRadius: "50% 50% 50% 0",
          }}
        >
          <span className="transform rotate-45 text-lg">{emoji}</span>
        </div>
        {/* Badge (NOW / SOON) */}
        {(happening || upcoming) && (
          <div
            className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white whitespace-nowrap"
            style={{ background: happening ? "#22c55e" : "#f59e0b" }}
          >
            {happening ? "NOW" : "SOON"}
          </div>
        )}
      </div>
    </Marker>
  );
};

// ---- Main Component ----
export default function LiveMap() {
  const mapRef = useRef<any>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [onlineEvents, setOnlineEvents] = useState<OnlineEvent[]>([]);
  const [selected, setSelected] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateLabel, setDateLabel] = useState("");
  const [filter, setFilter] = useState("all");
  const [showOnline, setShowOnline] = useState(false);

  // Fetch events from local backend
  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true);
        const res = await fetch("/api/live-map-events");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setEvents(data.events || []);
        setOnlineEvents(data.online_events || []);
        setDateLabel(data.date || "");
      } catch (e) {
        console.error(e);
        setError("Could not load today's events.");
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, []);

  // Filter categories
  const categories = [...new Set(events.map((e) => e.category).filter(Boolean))];
  const nowCount = events.filter((e) => isHappeningNow(e.local_time)).length;
  const soonCount = events.filter((e) => isUpcoming(e.local_time)).length;

  // Filtered events for markers
  const filteredEvents = events.filter((e) => {
    if (!e.lat || !e.lng) return false;
    if (filter === "all") return true;
    if (filter === "now") return isHappeningNow(e.local_time);
    if (filter === "soon") return isUpcoming(e.local_time);
    return e.category === filter;
  });

  const handleMarkerClick = useCallback((event: Event) => {
    setSelected(event);
    // Fly to marker
    if (mapRef.current && event.lat && event.lng) {
      mapRef.current.flyTo({ center: [event.lng, event.lat], zoom: 15, duration: 700 });
    }
  }, []);

  // Map style – dark CartoDB style (or any free style)
  const MAP_STYLE = "https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json"; // free, no API key
  // Alternative: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"

  return (
    <div className="h-screen w-full bg-gray-950 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex items-center gap-3 z-20 flex-shrink-0">
        <a href="/" className="text-gray-400 hover:text-white text-lg transition-colors">
          ←
        </a>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-white text-base">🗺️ Live Map</h1>
            {nowCount > 0 && (
              <span className="flex items-center gap-1 bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full border border-green-500/30">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                {nowCount} live now
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate">{dateLabel || "Today in Moscow"}</p>
        </div>
        <div className="text-xs text-gray-500">
          {loading ? "..." : `${events.length + onlineEvents.length} events`}
        </div>
      </header>

      {/* Filter bar */}
      <div className="bg-gray-900/90 border-b border-gray-800 px-3 py-2 flex gap-2 overflow-x-auto scrollbar-hide z-20 flex-shrink-0">
        {[
          { key: "all", label: "🗺 All" },
          { key: "now", label: `🟢 Now${nowCount > 0 ? ` (${nowCount})` : ""}` },
          { key: "soon", label: `⏳ Soon${soonCount > 0 ? ` (${soonCount})` : ""}` },
          ...categories.map((c) => ({
            key: c,
            label: `${CATEGORY_EMOJI[c] || "✨"} ${CATEGORY_COLORS[c]?.label || c}`,
          })),
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
              filter === key
                ? "bg-orange-500 border-orange-500 text-white"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Map */}
      <div className="flex-1 relative overflow-hidden">
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: MOSCOW_CENTER[1],
            latitude: MOSCOW_CENTER[0],
            zoom: 12,
          }}
          mapStyle={MAP_STYLE}
          style={{ width: "100%", height: "100%" }}
          attributionControl={false}
        >
          <NavigationControl position="bottom-right" />
          {filteredEvents.map((event) => (
            <CustomMarker
              key={event.id}
              event={event}
              onClick={() => handleMarkerClick(event)}
            />
          ))}
        </Map>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-gray-950 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Loading today's map…</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="absolute inset-0 bg-gray-950 flex items-center justify-center z-10">
            <div className="text-center px-6">
              <div className="text-4xl mb-3">😕</div>
              <p className="text-gray-300 font-medium">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* No events overlay */}
        {!loading && !error && events.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="bg-gray-900/90 backdrop-blur rounded-2xl px-6 py-5 text-center mx-6">
              <div className="text-4xl mb-2">🗓️</div>
              <p className="text-gray-200 font-semibold">No events on the map today</p>
              <p className="text-gray-400 text-sm mt-1">Check the online events below ↓</p>
            </div>
          </div>
        )}

        {/* Online events toggle button */}
        {!loading && onlineEvents.length > 0 && (
          <button
            onClick={() => setShowOnline(!showOnline)}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-gray-900/95 backdrop-blur border border-gray-700 text-gray-200 text-sm font-medium px-4 py-2 rounded-full shadow-lg hover:border-orange-500 transition-all"
          >
            <span className="text-base">💻</span>
            {onlineEvents.length} online event{onlineEvents.length !== 1 ? "s" : ""} today
            <span className={`transition-transform ${showOnline ? "rotate-180" : ""}`}>↑</span>
          </button>
        )}
      </div>

      {/* Online events drawer */}
      {showOnline && (
        <div className="bg-gray-900 border-t border-gray-800 max-h-56 overflow-y-auto z-20 flex-shrink-0">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              💻 Online Events Today
            </h3>
            <button onClick={() => setShowOnline(false)} className="text-gray-500 hover:text-white text-lg leading-none">
              ×
            </button>
          </div>
          <div className="divide-y divide-gray-800">
            {onlineEvents.map((e) => {
              const cat = e.category ?? "other";
              const color = CATEGORY_COLORS[cat]?.bg ?? "#6b7280";
              return (
                <div key={e.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{e.title}</p>
                    <p className="text-xs text-gray-400">{formatTime(e.local_time)} · Online</p>
                  </div>
                  {e.source_url && (
                    <a
                      href={e.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-orange-400 hover:text-orange-300 flex-shrink-0"
                    >
                      Details →
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Event detail panel */}
      {selected && (
        <div className="absolute bottom-0 left-0 right-0 z-30 bg-gray-900 border-t border-gray-700 rounded-t-2xl shadow-2xl">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-600 rounded-full" />
          </div>

          <div className="px-5 pb-6 pt-2">
            <button
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-all text-sm"
            >
              ×
            </button>

            {/* Category badge */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                style={{ background: CATEGORY_COLORS[selected.category ?? "other"]?.bg ?? "#6b7280" }}
              >
                {CATEGORY_EMOJI[selected.category ?? "other"]} {CATEGORY_COLORS[selected.category ?? "other"]?.label ?? selected.category}
              </span>
              {isHappeningNow(selected.local_time) && (
                <span className="flex items-center gap-1 text-xs text-green-400 font-semibold">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  Happening now
                </span>
              )}
              {isUpcoming(selected.local_time) && !isHappeningNow(selected.local_time) && (
                <span className="text-xs text-amber-400 font-semibold">⏳ Starting soon</span>
              )}
            </div>

            <h2 className="text-lg font-bold text-white leading-tight mb-1 pr-8">{selected.title}</h2>

            <div className="flex items-center gap-3 text-sm text-gray-400 mb-3">
              <span>🕐 {formatTime(selected.local_time)}</span>
              <span className="text-gray-600">·</span>
              <span className="truncate">📍 {selected.venue_address}</span>
            </div>

            {selected.description && (
              <p className="text-sm text-gray-300 leading-relaxed mb-4 line-clamp-3">{selected.description}</p>
            )}

            <div className="flex gap-3">
              {selected.source_url && (
                <a
                  href={selected.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold py-2.5 rounded-xl text-center transition-colors"
                >
                  View Details
                </a>
              )}
              <button
                onClick={() => {
                  if (selected.lat && selected.lng) {
                    window.open(`https://maps.google.com/?q=${selected.lat},${selected.lng}`, "_blank");
                  }
                }}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-xl text-center transition-colors border border-gray-700"
              >
                🗺 Open in Maps
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
