import { useEffect, useState, useCallback } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Button } from "@/components/ui/button";
import { Navigation, Loader2, MapPin, LocateFixed } from "lucide-react";

// Free, no‑API‑key tile source (OpenStreetMap via Stadia)
const MAP_STYLE = "https://tiles.stadiamaps.com/styles/osm_bright.json";

interface PickedLocation {
  address: string;
  city:    string;
  lat:     number;
  lng:     number;
}

interface MapLibreLocationPickerProps {
  /** Initial address shown on the map */
  address?: string | null;
  /** Initial city used for forward-geocoding if no coordinates given */
  city?: string | null;
  /** Existing coordinates — if supplied the map flies straight to them */
  lat?: number | null;
  lng?: number | null;
  /** Called every time the user drops a pin; receives full geocoded location */
  onLocationPicked: (loc: PickedLocation) => void;
}

export function MapLibreLocationPicker({
  address, city, lat, lng, onLocationPicked,
}: MapLibreLocationPickerProps) {
  const [viewState, setViewState] = useState({
    longitude: lng ?? 37.6176,   // default: Moscow center
    latitude:  lat ?? 55.7558,
    zoom:      lat && lng ? 15 : 12,
  });
  const [marker, setMarker] = useState<{ longitude: number; latitude: number } | null>(
    lat && lng ? { longitude: lng, latitude: lat } : null
  );
  const [isPicking,   setIsPicking]   = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // ── When existing coordinates are passed, fly to them ─────────────────────
  useEffect(() => {
    if (lat && lng) {
      setViewState(prev => ({ ...prev, latitude: lat, longitude: lng, zoom: 15 }));
      setMarker({ longitude: lng, latitude: lat });
    }
  }, [lat, lng]);

  // ── Reverse geocode when user clicks in pick mode ──────────────────────────
  const onMapClick = useCallback(async (event: any) => {
    if (!isPicking) return;
    const { lng: clickLng, lat: clickLat } = event.lngLat;
    setMarker({ longitude: clickLng, latitude: clickLat });
    setIsGeocoding(true);

    try {
      const response = await fetch("/api/reverse-geocode", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ lat: clickLat, lng: clickLng }),
      });
      if (response.ok) {
        const { address: fullAddress, city: locationCity } = await response.json();
        onLocationPicked({
          address: fullAddress,
          city:    locationCity,
          lat:     clickLat,
          lng:     clickLng,
        });
      } else {
        // Reverse geocode failed — still emit coordinates with raw values
        onLocationPicked({
          address: address ?? "",
          city:    city ?? "",
          lat:     clickLat,
          lng:     clickLng,
        });
      }
    } catch {
      onLocationPicked({
        address: address ?? "",
        city:    city ?? "",
        lat:     clickLat,
        lng:     clickLng,
      });
    } finally {
      setIsGeocoding(false);
      setIsPicking(false);
    }
  }, [isPicking, onLocationPicked, address, city]);

  // ── Forward geocode when address/city text changes (no coords yet) ─────────
  useEffect(() => {
    if (lat && lng) return;           // already have coords — don't override
    if (!address && !city) return;
    const query = [address, city].filter(Boolean).join(", ");
    if (query.length < 5) return;

    let cancelled = false;
    const run = async () => {
      setIsGeocoding(true);
      try {
        const response = await fetch("/api/forward-geocode", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ query }),
        });
        if (!cancelled && response.ok) {
          const { latitude: fLat, longitude: fLng } = await response.json();
          setViewState(prev => ({ ...prev, latitude: fLat, longitude: fLng, zoom: 14 }));
          setMarker({ longitude: fLng, latitude: fLat });
        }
      } catch { /* silent */ } finally {
        if (!cancelled) setIsGeocoding(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [address, city]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-primary" />
          Map pin
          {marker && (
            <span className="text-xs text-muted-foreground font-mono">
              ({marker.latitude.toFixed(5)}, {marker.longitude.toFixed(5)})
            </span>
          )}
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
            <><Loader2 className="w-3 h-3 animate-spin" /> Geocoding…</>
          ) : isPicking ? (
            <><MapPin className="w-3 h-3" /> Click map to pin</>
          ) : (
            <><LocateFixed className="w-3 h-3" /> Drop pin</>
          )}
        </Button>
      </div>

      {isPicking && (
        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-1.5">
          Click anywhere on the map to set the event pin. Address fields will update automatically.
        </p>
      )}

      <div className={`rounded-2xl overflow-hidden border transition-all ${isPicking ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
        <Map
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          onClick={onMapClick}
          mapStyle={MAP_STYLE}
          style={{ width: "100%", height: "260px" }}
          cursor={isPicking ? "crosshair" : "grab"}
        >
          <NavigationControl position="top-right" />
          {marker && (
            <Marker
              longitude={marker.longitude}
              latitude={marker.latitude}
              color="#e11d48"
            />
          )}
        </Map>
      </div>
    </div>
  );
}
