import { useEffect, useState, useCallback } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Button } from "@/components/ui/button";
import { Navigation, Loader2, MapPin } from "lucide-react";

// Free, no‑API‑key tile source (OpenStreetMap)
const MAP_STYLE = "https://tiles.stadiamaps.com/styles/osm_bright.json";

interface MapLibreLocationPickerProps {
  address?: string | null;
  city?: string | null;
  onLocationPicked: (address: string, city: string) => void;
}

export function MapLibreLocationPicker({ address, city, onLocationPicked }: MapLibreLocationPickerProps) {
  const [viewState, setViewState] = useState({
    longitude: 37.6176,  // Moscow center
    latitude: 55.7558,
    zoom: 12,
  });
  const [marker, setMarker] = useState<{ longitude: number; latitude: number } | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Reverse geocode: when user clicks the map
  const onMapClick = useCallback(async (event: any) => {
    if (!isPicking) return;
    const { lng, lat } = event.lngLat;
    setMarker({ longitude: lng, latitude: lat });
    setIsGeocoding(true);

    try {
      const response = await fetch("/api/reverse-geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
      if (response.ok) {
        const { address: fullAddress, city: locationCity } = await response.json();
        onLocationPicked(fullAddress, locationCity);
      } else {
        console.error("Reverse geocoding failed");
      }
    } catch (error) {
      console.error("Geocoding error:", error);
    } finally {
      setIsGeocoding(false);
      setIsPicking(false);
    }
  }, [isPicking, onLocationPicked]);

  // Forward geocode: when address/city props change
  useEffect(() => {
    if (!address && !city) return;
    const query = [address, city].filter(Boolean).join(", ");
    if (query.length < 5) return;

    const fetchCoordinates = async () => {
      setIsGeocoding(true);
      try {
        const response = await fetch("/api/forward-geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        if (response.ok) {
          const { latitude, longitude } = await response.json();
          setViewState(prev => ({ ...prev, latitude, longitude }));
          setMarker({ longitude, latitude });
        }
      } catch (error) {
        console.error("Forward geocoding error:", error);
      } finally {
        setIsGeocoding(false);
      }
    };
    fetchCoordinates();
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
      <div className="rounded-2xl overflow-hidden border border-border">
        <Map
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          onClick={onMapClick}
          mapStyle={MAP_STYLE}
          style={{ width: "100%", height: "300px" }}
        >
          <NavigationControl position="top-right" />
          {marker && <Marker longitude={marker.longitude} latitude={marker.latitude} color="red" />}
        </Map>
      </div>
    </div>
  );
}
