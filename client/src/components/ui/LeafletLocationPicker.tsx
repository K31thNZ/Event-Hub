import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

// No static CSS import – we load it dynamically

interface Props {
  address?: string | null;
  city?: string | null;
  onLocationPicked: (address: string, city: string) => void;
}

// ... reverseGeocode and forwardGeocode functions (same as before) ...

export function LeafletLocationPicker({ address, city, onLocationPicked }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
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

      // Fix marker icons
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

      map.on("click", async (e: L.LeafletMouseEvent) => {
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

  // Forward geocode effect (same as before) ...

  return ( ... );
}
