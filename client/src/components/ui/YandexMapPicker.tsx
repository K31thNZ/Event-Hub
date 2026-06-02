// client/src/components/ui/YandexMapPicker.tsx
// Shared Yandex Maps pin-picker used in CreateEvent AND the Dashboard edit sheet.
// Drop-in replacement for MapLibreLocationPicker — same onLocationPicked API.

import { useEffect, useRef, useState, useCallback } from "react";
import { loadYandexMaps } from "@/utils/yandex-maps";

const YANDEX_API_KEY = import.meta.env.VITE_YANDEX_MAPS_API_KEY as string;

// ── Reverse geocode via ymaps.geocode ─────────────────────────────────────────
async function reverseGeocode(coords: [number, number]): Promise<{ address: string; city: string }> {
  try {
    let result = await window.ymaps.geocode(coords, { kind: "house", results: 1 });
    let geo = result.geoObjects.get(0);
    if (!geo) {
      result = await window.ymaps.geocode(coords);
      geo = result.geoObjects.get(0);
    }
    return {
      address: geo?.getAddressLine() ?? "",
      city:    geo?.getLocalities?.()?.[0] ?? "",
    };
  } catch {
    return { address: "", city: "" };
  }
}

// ── Public interface ──────────────────────────────────────────────────────────
export interface PickedLocation {
  address:      string;
  city:         string;
  lat:          number;
  lng:          number;
  locationName?: string;   // populated when user picks a named business
}

export interface YandexMapPickerProps {
  /** Pre-existing lat/lng — map centres on these if provided */
  lat?: number | null;
  lng?: number | null;
  /** Pre-existing address / city (used for search placeholder) */
  address?: string | null;
  city?:    string | null;
  /** Fired every time the user moves the pin or selects a business */
  onLocationPicked: (loc: PickedLocation) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function YandexMapPicker({ lat, lng, address, city, onLocationPicked }: YandexMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<any>(null);
  const markerRef       = useRef<any>(null);
  const [apiLoaded, setApiLoaded] = useState(false);

  // Business search
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load Yandex Maps API ──────────────────────────────────────────────────
  useEffect(() => {
    loadYandexMaps(YANDEX_API_KEY)
      .then(() => setApiLoaded(true))
      .catch(err => console.error("[YandexMapPicker] API load error:", err));
  }, []);

  // ── Init map once API is ready ────────────────────────────────────────────
  useEffect(() => {
    if (!apiLoaded || !mapContainerRef.current || mapRef.current) return;

    const center: [number, number] = lat && lng ? [lat, lng] : [55.7558, 37.6173];
    const zoom = lat && lng ? 16 : 12;

    const map = new window.ymaps.Map(mapContainerRef.current, {
      center,
      zoom,
      controls: ["zoomControl", "typeSelector"],
    });
    mapRef.current = map;

    const marker = new window.ymaps.Placemark(center, {}, {
      draggable: true,
      preset: "islands#redIcon",
    });
    map.geoObjects.add(marker);
    markerRef.current = marker;

    // Click on map → move pin + reverse geocode
    map.events.add("click", async (e: any) => {
      const coords: [number, number] = e.get("coords");
      marker.geometry.setCoordinates(coords);
      const geo = await reverseGeocode(coords);
      onLocationPicked({ lat: coords[0], lng: coords[1], address: geo.address, city: geo.city });
    });

    // Drag end → reverse geocode new position
    marker.events.add("dragend", async () => {
      const coords: [number, number] = markerRef.current.geometry.getCoordinates();
      const geo = await reverseGeocode(coords);
      onLocationPicked({ lat: coords[0], lng: coords[1], address: geo.address, city: geo.city });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiLoaded]);

  // ── Sync marker when external lat/lng change ──────────────────────────────
  useEffect(() => {
    if (markerRef.current && lat && lng) {
      markerRef.current.geometry.setCoordinates([lat, lng]);
      mapRef.current?.setCenter([lat, lng], 16, { duration: 300 });
    }
  }, [lat, lng]);

  // ── Business search ───────────────────────────────────────────────────────
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setSearchResults([]); setSearchOpen(false); return; }
    setSearchLoading(true);
    try {
      const center = mapRef.current?.getCenter() ?? [55.7558, 37.6173];
      const url = [
        "https://search-maps.yandex.ru/v1/",
        `?text=${encodeURIComponent(query)}`,
        `&type=biz`,
        `&ll=${center[1]},${center[0]}`,
        `&spn=0.1,0.1`,
        `&lang=en_RU`,
        `&apikey=${YANDEX_API_KEY}`,
        `&results=5`,
      ].join("");
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Search failed: ${resp.status}`);
      const data = await resp.json();
      setSearchResults(
        (data.features ?? []).map((f: any) => ({
          name:    f.properties?.name || f.properties?.CompanyMetaData?.name || "Business",
          address: f.properties?.description || f.properties?.CompanyMetaData?.address || "",
          coords:  f.geometry?.coordinates, // [lng, lat]
        }))
      );
      setSearchOpen(true);
    } catch (err) {
      console.error("[YandexMapPicker] search error:", err);
      setSearchResults([]);
      setSearchOpen(false);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => performSearch(searchQuery), 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery, performSearch]);

  const handleSelectResult = async (result: any) => {
    const [lngCoord, latCoord] = result.coords;
    markerRef.current?.geometry.setCoordinates([latCoord, lngCoord]);
    mapRef.current?.setCenter([latCoord, lngCoord], 16, { duration: 300 });

    // Try to extract city from address string, fall back to reverse geocode
    let resolvedCity = city ?? "";
    if (result.address) {
      const parts = result.address.split(",");
      const seg = parts.find((p: string) => p.trim().length > 2 && !/\d/.test(p.trim()));
      resolvedCity = seg?.trim() ?? "";
    }
    if (!resolvedCity) {
      const geo = await reverseGeocode([latCoord, lngCoord]);
      resolvedCity = geo.city;
    }

    onLocationPicked({
      lat:          latCoord,
      lng:          lngCoord,
      address:      result.address || result.name,
      city:         resolvedCity,
      locationName: result.name,
    });

    setSearchQuery("");
    setSearchResults([]);
    setSearchOpen(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (!apiLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted rounded-xl">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading map…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      {/* Search bar */}
      <div className="absolute top-3 left-3 right-3 z-10">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search for a venue or business…"
            className="w-full h-10 px-4 pr-10 bg-white/95 backdrop-blur border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow"
          />
          {searchLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}
        </div>

        {searchOpen && !searchLoading && searchResults.length > 0 && (
          <div className="mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
            {searchResults.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectResult(r)}
                className="w-full text-left px-4 py-2.5 hover:bg-muted/60 transition-colors border-b border-border/20 last:border-none"
              >
                <p className="text-sm font-medium">{r.name}</p>
                {r.address && <p className="text-xs text-muted-foreground truncate">{r.address}</p>}
              </button>
            ))}
          </div>
        )}

        {searchOpen && !searchLoading && searchResults.length === 0 && searchQuery.trim() && (
          <div className="mt-1 bg-white border border-border rounded-xl p-3 text-sm text-muted-foreground text-center shadow">
            No venues found
          </div>
        )}
      </div>

      <p className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 text-xs bg-black/50 text-white rounded-full px-3 py-1 pointer-events-none">
        Click map or drag pin to set location
      </p>

      {/* Map container */}
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
