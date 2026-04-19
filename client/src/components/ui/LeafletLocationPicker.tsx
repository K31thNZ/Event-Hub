import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  address?: string | null;
  city?: string | null;
  onLocationPicked: (address: string, city: string) => void;
}

// ── Geocoding helpers ─────────────────────────────────────────────────────
async function reverseGeocode(lat: number, lng: number): Promise<{ address: string; city: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
      { headers: { "User-Agent": "ExpatEvents/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address ?? {};
    const road = a.road ?? a.pedestrian ?? a.footway ?? "";
    const houseNo = a.house_number ?? "";
    const address = [road, houseNo].filter(Boolean).join(", ") || (data.display_name ?? "").split(",")[0] ?? "";
    const city = a.city ?? a.town ?? a.village ?? a.county ?? "";
    return { address, city };
  } catch {
    return null;
  }
}

async function forwardGeocode(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=en`,
      { headers: { "User-Agent": "ExpatEvents/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data[0]) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export function LeafletLocationPicker({ address, city, onLocationPicked }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null); // L.Map
  const markerRef = useRef<any>(null);     // L.Marker
  const [isPicking, setIsPicking] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const isPickingRef = useRef(isPicking);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    isPickingRef.current = isPicking;
  }, [isPicking]);

  // Load Leaflet CSS dynamically (client‑only)
  useEffect(() => {
    import("leaflet/dist/leaflet.css");
  }, []);

  // Dynamically load Leaflet JS and initialise map
  useEffect(() => {
    if (mapLoaded || !mapRef.current) return;

    const loadLeaflet = async () => {
      const L = (await import("leaflet")).default;

      // Fix marker icons (CDN icons – no build issues)
      const iconUrl = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png";
      const iconRetinaUrl = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png";
      const shadowUrl = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png";
      const defaultIcon = L.icon({
        iconUrl,
        iconRetinaUrl,
        shadowUrl,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      L.Marker.prototype.options.icon = defaultIcon;

      const map = L.map(mapRef.current!).setView([55.7558, 37.6176], 14);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CartoDB',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      leafletMapRef.current = map;

      map.on("click", async (e: any) => {
        if (!isPickingRef.current) return;
        const { lat, lng } = e.latlng;
        if (markerRef.current) markerRef.current.remove();
        const marker = L.marker([lat, lng]).addTo(map);
        markerRef.current = marker;
        setIsGeocoding(true);
        const result = await reverseGeocode(lat, lng);
        setIsGeocoding(false);
        if (result) onLocationPicked(result.address, result.city);
        setIsPicking(false);
      });

      setMapLoaded(true);
    };

    loadLeaflet();
  }, [mapLoaded, onLocationPicked]);

  // Forward geocode when address/city changes
  useEffect(() => {
    if (!leafletMapRef.current) return;
    const query = [address, city].filter(Boolean).join(", ");
    if (!query || query.length < 5) return;

    const timer = setTimeout(async () => {
      const coords = await forwardGeocode(query);
      if (coords && leafletMapRef.current) {
        leafletMapRef.current.setView([coords.lat, coords.lng], 14);
        if (markerRef.current) markerRef.current.remove();
        const L = (await import("leaflet")).default;
        const marker = L.marker([coords.lat, coords.lng]).addTo(leafletMapRef.current);
        markerRef.current = marker;
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [address, city]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-primary" />
          Map Location
        </label>
        <Button
          type="button"
          size="sm"
          variant={isPicking ? "default" : "outline"}
          className={`rounded-full gap-1.5 text-xs h-8 ${isPicking ? "animate-pulse" : ""}`}
          onClick={() => setIsPicking(v => !v)}
          disabled={isGeocoding}
        >
          {isGeocoding ? (
            <><Loader2 className="w-3 h-3 animate-spin" /> Finding address…</>
          ) : isPicking ? (
            <><MapPin className="w-3 h-3" /> Click map to place pin</>
          ) : (
            <><Navigation className="w-3 h-3" /> Drop pin</>
          )}
        </Button>
      </div>
      <div
        ref={mapRef}
        className="rounded-2xl overflow-hidden border border-border bg-muted"
        style={{ height: 300, zIndex: 1 }}
      />
    </div>
  );
}
