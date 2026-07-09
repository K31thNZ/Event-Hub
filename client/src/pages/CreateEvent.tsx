import { useState, useEffect, useRef, useCallback } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useCreateEvent } from "@/hooks/use-events";
import { useAuth } from "@/hooks/use-auth";
import { localToUtc } from "@/lib/date-utils";
import { useLocation, useParams } from "wouter";
import { getQueryFn } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Trash2, Plus, CalendarPlus, AlertCircle,
  ArrowLeft, ArrowRight, Check, UsersRound, Upload, X, MapPin
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EVENT_CATEGORIES, EVENT_CATEGORY_VALUES } from "@shared/categories";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Yandex Maps API key ───────────────────────────────────────────────────
const YANDEX_API_KEY = import.meta.env.VITE_YANDEX_MAPS_API_KEY as string;

// ── Shared Yandex Maps loader (singleton) ─────────────────────────────────
let _yandexScriptPromise: Promise<void> | null = null;

function loadYandexMaps(apiKey: string): Promise<void> {
  if (window.ymaps?.ready) return window.ymaps.ready();
  if (_yandexScriptPromise) return _yandexScriptPromise;
  _yandexScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=en_US`;
    script.async = true;
    script.onload = () => window.ymaps.ready(resolve);
    script.onerror = () => {
      _yandexScriptPromise = null;
      reject(new Error("Failed to load Yandex Maps script"));
    };
    document.head.appendChild(script);
  });
  return _yandexScriptPromise;
}

// ── Reverse geocode helper ───────────────────────────────────────────────
async function reverseGeocode(coords: number[]): Promise<{ address: string; city: string }> {
  try {
    let result = await window.ymaps.geocode(coords, { kind: "house", results: 1 });
    let geo = result.geoObjects.get(0);
    if (!geo) {
      result = await window.ymaps.geocode(coords);
      geo = result.geoObjects.get(0);
    }
    return {
      address: geo?.getAddressLine() ?? "",
      city:    geo?.getLocalities()?.[0] ?? "",
    };
  } catch {
    return { address: "", city: "" };
  }
}

// ── Default images ────────────────────────────────────────────────────────
const CATEGORY_DEFAULT_IMAGES: Record<string, string> = {
  networking:   "https://images.expatevents.org/defaults/category-networking.jpg",
  tech:         "https://images.expatevents.org/defaults/category-tech.jpg",
  culture:      "https://images.expatevents.org/defaults/category-culture.jpg",
  food:         "https://images.expatevents.org/defaults/category-food.jpg",
  sports:       "https://images.expatevents.org/defaults/category-sports.jpg",
  music:        "https://images.expatevents.org/defaults/category-music.jpg",
  language:     "https://images.expatevents.org/defaults/category-language.jpg",
  outdoor:      "https://images.expatevents.org/defaults/category-outdoor.jpg",
  games:        "https://images.expatevents.org/defaults/category-games.jpg",
  business:     "https://images.expatevents.org/defaults/category-business.jpg",
  wellness:     "https://images.expatevents.org/defaults/category-wellness.jpg",
  family:       "https://images.expatevents.org/defaults/category-family.jpg",
  social:       "https://images.expatevents.org/defaults/category-social.jpg",
  volunteering: "https://images.expatevents.org/defaults/category-volunteering.jpg",
  other:        "https://images.expatevents.org/defaults/category-other.jpg",
};

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "https://auth.expatevents.org";

// ── Moscow → UTC helper (UTC+3, no DST) ──────────────────────────────────
function moscowToUtc(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  const localDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  return new Date(localDate.getTime() - 3 * 60 * 60 * 1000);
}

// ── Zod schema ────────────────────────────────────────────────────────────
const createEventSchema = z.object({
  title:           z.string().min(3, "Title must be at least 3 characters"),
  description:     z.string().min(10, "Description must be at least 10 characters"),
  category:        z.enum(EVENT_CATEGORY_VALUES as [string, ...string[]], {
    required_error: "Please select a category",
  }),
  category2:       z.string().optional().nullable(),
  dateStr:         z.string().min(1, "Date is required"),
  time:            z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Select a valid time"),
  venueAddress:    z.string().min(3, "Address is required"),
  venueCity:       z.string().min(2, "City is required"),
  locationName:    z.string().optional().nullable(),   // 🌟 new field
  imageUrl:        z.string().optional().nullable(),
  recurrence:      z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
  recurrenceUntil: z.string().nullable().optional(),
  lat:             z.number().optional().nullable(),
  lng:             z.number().optional().nullable(),
  ticketTypes:     z.array(z.object({
    name:        z.string().min(1, "Name required"),
    price:       z.coerce.number().min(0, "Price must be 0 or more"),
    quantity:    z.coerce.number().min(1, "Quantity must be at least 1"),
    maxPerOrder: z.coerce.number().min(1, "Max per order must be at least 1"),
  })).min(1, "Add at least one ticket type"),
  groupId:   z.number().optional().nullable(),
  isPrivate: z.boolean().default(false),
});

type FormValues = z.infer<typeof createEventSchema>;

const STEP_FIELDS: Record<number, (keyof FormValues)[]> = {
  0: ["title", "description", "category"],
  1: ["dateStr", "time", "recurrence", "recurrenceUntil"],
  2: ["venueAddress", "venueCity", "locationName"],
  3: ["ticketTypes"],
  4: [],
};

const STEPS = [
  { label: "Details"     },
  { label: "Date & Time" },
  { label: "Location"    },
  { label: "Tickets"     },
  { label: "Preview"     },
];

const TIME_SLOTS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4).toString().padStart(2, "0");
  const m = ((i % 4) * 15).toString().padStart(2, "0");
  return `${h}:${m}`;
});

// ── Image upload helper ───────────────────────────────────────────────────
async function uploadEventImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", "events");
  const res = await fetch("/api/upload/event-image", {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Upload failed");
  }
  const data = await res.json();
  return data.url;
}

// ─────────────────────────────────────────────────────────────────────────
// YandexMapPicker (updated to pass location name)
// ─────────────────────────────────────────────────────────────────────────
interface YandexMapPickerProps {
  lat: number | null;
  lng: number | null;
  onLocationSelect: (lat: number, lng: number, address: string, city: string, name?: string) => void;
}

function YandexMapPicker({ lat, lng, onLocationSelect }: YandexMapPickerProps) {
  const mapRef    = useRef<HTMLDivElement>(null);
  const [map,     setMap]     = useState<any>(null);
  const [marker,  setMarker]  = useState<any>(null);
  const [apiLoaded, setApiLoaded] = useState(false);

  // Business search state
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError,   setSearchError]   = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load API (singleton) ────────────────────────────────────────────────
  useEffect(() => {
    loadYandexMaps(YANDEX_API_KEY)
      .then(() => setApiLoaded(true))
      .catch(err => console.error("Yandex Maps load error:", err));
  }, []);

  // ── Init map (once after API is ready) ──────────────────────────────────
  useEffect(() => {
    if (!apiLoaded || !mapRef.current || map) return;

    const center = [lat ?? 55.7558, lng ?? 37.6173];
    const zoom   = lat && lng ? 16 : 12;

    const newMap = new window.ymaps.Map(mapRef.current, {
      center,
      zoom,
      controls: ["zoomControl", "typeSelector"],
    });
    setMap(newMap);

    const newMarker = new window.ymaps.Placemark(center, {}, {
      draggable: true,
      preset: "islands#redIcon",
    });
    newMap.geoObjects.add(newMarker);
    setMarker(newMarker);

    // Click → move marker + reverse geocode (no name)
    newMap.events.add("click", async (e: any) => {
      const coords = e.get("coords");
      newMarker.geometry.setCoordinates(coords);
      const { address, city } = await reverseGeocode(coords);
      onLocationSelect(coords[0], coords[1], address, city);
    });

    // Drag end → reverse geocode new position (no name)
    newMarker.events.add("dragend", async () => {
      const coords = newMarker.geometry.getCoordinates();
      const { address, city } = await reverseGeocode(coords);
      onLocationSelect(coords[0], coords[1], address, city);
    });

  }, [apiLoaded]); // intentional: lat/lng handled separately

  // Sync marker when lat/lng change externally
  useEffect(() => {
    if (marker && lat && lng) {
      marker.geometry.setCoordinates([lat, lng]);
      map?.setCenter([lat, lng], 16, { duration: 300 });
    }
  }, [lat, lng, marker, map]);

  // ── Business search (Yandex Organization Search API) ────────────────────
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    try {
      const center = map?.getCenter() ?? [55.7558, 37.6173];
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
          name:    f.properties?.name
                || f.properties?.CompanyMetaData?.name
                || "Business",
          address: f.properties?.description
                || f.properties?.CompanyMetaData?.address
                || "",
          coords: f.geometry?.coordinates, // [lng, lat]
        }))
      );
      setSearchOpen(true);
    } catch (err: any) {
      console.error("Yandex biz search error:", err);
      setSearchError(err.message || "Search failed");
      setSearchResults([]);
      setSearchOpen(false);
    } finally {
      setSearchLoading(false);
    }
  }, [map]);

  // Debounce search input
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => performSearch(searchQuery), 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery, performSearch]);

  // ── Select a search result ───────────────────────────────────────────────
  const handleSelectResult = async (result: any) => {
    const [lngCoord, latCoord] = result.coords;
    marker?.geometry.setCoordinates([latCoord, lngCoord]);
    map?.setCenter([latCoord, lngCoord], 16, { duration: 300 });

    let city = "";
    if (result.address) {
      const parts = result.address.split(",");
      const segment = parts.find((p: string) =>
        p.trim().length > 2 && !/\d/.test(p.trim())
      );
      city = segment?.trim() ?? "";
    }
    if (!city) {
      const geo = await reverseGeocode([latCoord, lngCoord]);
      city = geo.city;
    }

    const fullAddress = result.name + (result.address ? `, ${result.address}` : "");
    // Pass the business name as the location name
    onLocationSelect(latCoord, lngCoord, fullAddress, city, result.name);

    setSearchQuery("");
    setSearchResults([]);
    setSearchOpen(false);
  };

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
      <div className="absolute top-3 left-3 right-14 z-10">
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
            No businesses found
          </div>
        )}

        {searchError && (
          <div className="mt-1 bg-red-50 border border-red-200 rounded-xl p-2 text-xs text-red-700">
            {searchError}
          </div>
        )}
      </div>

      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// CreateEvent (main component)
// ─────────────────────────────────────────────────────────────────────────
export default function CreateEvent({ groupSlug }: { groupSlug?: string } = {}) {
  const [, setLocation] = useLocation();
  const params          = useParams<{ groupId?: string }>();
  const createEvent     = useCreateEvent();
  const { user, isLoading: authLoading } = useAuth();

  const [step,           setStep]           = useState(0);
  const [direction,      setDirection]      = useState(1);
  const [submitError,    setSubmitError]    = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<{ id: number; title: string } | null>(null);
  const [uploading,      setUploading]      = useState(false);
  const [uploadError,    setUploadError]    = useState<string | null>(null);
  const [mapModalOpen,   setMapModalOpen]   = useState(false);
  const [tempMarkerCoords, setTempMarkerCoords] = useState<{ lat: number; lng: number } | null>(null);

  const { data: myGroups } = useQuery<any[]>({
    queryKey: ["/api/groups/my"],
    queryFn:  getQueryFn({ on401: "returnNull" }),
    enabled:  !!user,
  });
  const eligibleGroups = (myGroups ?? []).filter(
    g => g.currentUserRole === "owner" || g.currentUserRole === "moderator"
  );

  const {
    register, control, handleSubmit, setValue, watch, trigger,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      ticketTypes: [{ name: "General Admission", price: 0, quantity: 100, maxPerOrder: 5 }],
      isPrivate:   false,
      time:        "18:00",
      recurrence:  "none",
      recurrenceUntil: null,
      lat: null,
      lng: null,
      locationName: null,   // 🌟 new default
    },
    mode: "onTouched",
  });

  const watchedCategory    = watch("category");
  const watchedImageUrl    = watch("imageUrl");
  const watchedGroupId     = watch("groupId");
  const watchedRecurrence  = watch("recurrence");
  const watchedDateStr     = watch("dateStr");
  const watchedTime        = watch("time");
  const watchedLat         = watch("lat");
  const watchedLng         = watch("lng");
  const watchedLocationName = watch("locationName");
  const allValues          = watch();

  // Auto-fill cover image on category select
  useEffect(() => {
    if (watchedCategory && !watchedImageUrl) {
      const def = CATEGORY_DEFAULT_IMAGES[watchedCategory];
      if (def) setValue("imageUrl", def);
    }
  }, [watchedCategory]);

  // Pre-select group from URL params or slug
  useEffect(() => {
    if (groupSlug && myGroups) {
      const g = myGroups.find((g: any) => g.slug === groupSlug);
      if (g) setValue("groupId", g.id);
    } else if (params.groupId) {
      const n = parseInt(params.groupId, 10);
      if (!isNaN(n)) setValue("groupId", n);
    }
  }, [groupSlug, myGroups, params.groupId]);

  const { fields, append, remove } = useFieldArray({ control, name: "ticketTypes" });

  // Image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setUploadError("Image must be under 5 MB"); return; }
    setUploadError(null);
    setUploading(true);
    try {
      const url = await uploadEventImage(file);
      setValue("imageUrl", url);
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };
  const removeImage = () => setValue("imageUrl", null);

  // Map location handler – now receives optional name
  const handleLocationSelect = (lat: number, lng: number, address: string, city: string, name?: string) => {
    setTempMarkerCoords({ lat, lng });
    setValue("venueAddress", address);
    setValue("venueCity",    city);
    setValue("lat", lat);
    setValue("lng", lng);
    if (name) {
      setValue("locationName", name);
    }
  };

  const handleConfirmLocation = () => setMapModalOpen(false);

  // Step navigation
  const navigate = async (target: number) => {
    if (target > step) {
      const valid = await trigger(STEP_FIELDS[step] as any);
      if (!valid) return;
    }
    setSubmitError(null);
    setDirection(target > step ? 1 : -1);
    setStep(target);
  };
  const nextStep = () => navigate(step + 1);
  const prevStep = () => navigate(step - 1);

  // Form submit
  const onSubmit = async (data: FormValues) => {
    if (!user) return;
    setSubmitError(null);
    try {
      const utcDate = localToUtc(data.dateStr, data.time, user?.city ?? data.venueCity ?? "Moscow");
      const result  = await createEvent.mutateAsync({
        ...data,
        date:            utcDate,
        published:       true,
        groupId:         data.groupId ?? null,
        recurrence:      data.recurrence !== "none" ? data.recurrence : null,
        recurrenceUntil: data.recurrenceUntil ? new Date(data.recurrenceUntil) : null,
        // locationName already spread from data
      } as any);
      setPublishSuccess({ id: result.id, title: result.title });
      setTimeout(() => setLocation(`/events/${result.id}`), 2000);
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("401") || msg.includes("authenticated")) {
        setSubmitError("You need to be signed in to create an event.");
      } else if (msg.includes("403")) {
        setSubmitError("You don't have permission to create events.");
      } else {
        setSubmitError(msg || "Failed to publish event. Please try again.");
      }
    }
  };

  // ── Loading / auth guards ────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center gap-6 px-4">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/10">
          <CalendarPlus className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold">Host an Event</h1>
        <p className="text-muted-foreground">You need to be signed in.</p>
        <Button onClick={() =>
          window.location.href = `${AUTH_URL}/login?returnTo=${encodeURIComponent(window.location.href)}`
        }>
          Sign In
        </Button>
      </div>
    );
  }
  if (publishSuccess) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center gap-6 px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-xl"
        >
          <Check className="w-10 h-10" />
        </motion.div>
        <h1 className="text-3xl font-bold">Event Published!</h1>
        <p className="text-muted-foreground">"{publishSuccess.title}" is now live.</p>
        <p className="text-sm text-muted-foreground">Redirecting to event page…</p>
        <Button onClick={() => setLocation(`/events/${publishSuccess.id}`)}>
          View Event Now
        </Button>
      </div>
    );
  }

  const progressPct    = (step / (STEPS.length - 1)) * 100;
  const slideVariants  = {
    enter:  (d: number) => ({ x: d > 0 ?  48 : -48, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (d: number) => ({ x: d > 0 ? -48 :  48, opacity: 0 }),
  };

  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-10 text-center">
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/10">
            <CalendarPlus className="w-7 h-7" />
          </div>
          <h1 className="text-4xl font-display font-bold mb-2">Host an Event</h1>
          <p className="text-muted-foreground">Fill in the details to publish your event to the community.</p>
        </div>

        {/* Stepper */}
        <div className="mb-10 px-2">
          <div className="relative mb-2">
            <div className="absolute top-[18px] left-0 right-0 h-0.5 bg-border" />
            <motion.div
              className="absolute top-[18px] left-0 h-0.5 bg-primary"
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
            />
            <div className="relative flex justify-between">
              {STEPS.map((s, i) => {
                const done    = i < step;
                const current = i === step;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { if (done) navigate(i); }}
                    disabled={!done && !current}
                    className={`flex flex-col items-center gap-1.5
                      ${done    ? "cursor-pointer"       : ""}
                      ${current ? "cursor-default"       : ""}
                      ${!done && !current ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 bg-background
                      ${done    ? "bg-primary border-primary text-white hover:bg-primary/90"              : ""}
                      ${current ? "border-primary text-primary shadow-md shadow-primary/20 scale-110"    : ""}
                      ${!done && !current ? "border-border text-muted-foreground"                        : ""}`}
                    >
                      {done ? <Check className="w-4 h-4" /> : i + 1}
                    </div>
                    <span className={`text-xs font-medium hidden sm:block
                      ${current         ? "text-primary"          : ""}
                      ${done            ? "text-foreground"        : ""}
                      ${!done && !current ? "text-muted-foreground" : ""}`}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="sm:hidden text-center text-sm font-semibold text-primary mt-3">
            Step {step + 1} of {STEPS.length} — {STEPS[step].label}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: "easeInOut" }}
              >

                {/* ── Step 0: Details ── */}
                {step === 0 && (
                  <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
                    <div className="bg-primary/5 px-8 py-4 border-b border-border/50">
                      <h2 className="text-xl font-bold">Event Details</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">Give your event a name, category and description</p>
                    </div>
                    <CardContent className="p-8 space-y-6">
                      <div className="space-y-2">
                        <Label>Event Title</Label>
                        <Input {...register("title")} className="h-12 rounded-xl text-lg" placeholder="Moscow Summer Tech Mixer" />
                        {errors.title && <p className="text-destructive text-sm">{errors.title.message}</p>}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Category</Label>
                          <Controller control={control} name="category" render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select a category…" /></SelectTrigger>
                              <SelectContent className="bg-white dark:bg-zinc-900">
                                {EVENT_CATEGORIES.map(cat => (
                                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )} />
                          {errors.category && <p className="text-destructive text-sm">{errors.category.message}</p>}
                        </div>

                        {watchedCategory && (
                          <div className="space-y-2">
                            <Label>Second Category <span className="font-normal text-muted-foreground">(optional)</span></Label>
                            <Controller control={control} name="category2" render={({ field }) => (
                              <Select
                                onValueChange={v => field.onChange(v === "__none__" ? null : v)}
                                value={field.value ?? "__none__"}
                              >
                                <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="None" /></SelectTrigger>
                                <SelectContent className="bg-white dark:bg-zinc-900">
                                  <SelectItem value="__none__">— None —</SelectItem>
                                  {EVENT_CATEGORIES.filter(c => c.value !== watchedCategory).map(c => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )} />
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          {...register("description")}
                          className="rounded-xl min-h-[130px]"
                          placeholder="Tell people what to expect — format, agenda, vibe, what to bring…"
                        />
                        {errors.description && <p className="text-destructive text-sm">{errors.description.message}</p>}
                      </div>

                      {eligibleGroups.length > 0 && (
                        <div className="pt-4 border-t space-y-2">
                          <Label className="flex items-center gap-2">
                            <UsersRound className="w-4 h-4 text-primary" />
                            Link to a Group <span className="font-normal text-muted-foreground">(optional)</span>
                          </Label>
                          <Controller control={control} name="groupId" render={({ field }) => (
                            <Select
                              onValueChange={v => field.onChange(v === "__none__" ? null : parseInt(v))}
                              value={field.value != null ? String(field.value) : "__none__"}
                            >
                              <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="No group (public event)" /></SelectTrigger>
                              <SelectContent className="bg-white dark:bg-zinc-900">
                                <SelectItem value="__none__">— No group (public event) —</SelectItem>
                                {eligibleGroups.map(g => (
                                  <SelectItem key={g.id} value={String(g.id)}>
                                    {g.name} {g.currentUserRole === "owner" ? "(owner)" : "(moderator)"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )} />
                        </div>
                      )}

                      {watchedGroupId && (
                        <div className="flex justify-between items-center pt-4 border-t">
                          <div>
                            <p className="font-medium text-sm">Private event</p>
                            <p className="text-xs text-muted-foreground">Only group members can see this event</p>
                          </div>
                          <Controller control={control} name="isPrivate" render={({ field }) => (
                            <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                          )} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ── Step 1: Date & Time ── */}
                {step === 1 && (
                  <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
                    <div className="bg-primary/5 px-8 py-4 border-b border-border/50">
                      <h2 className="text-xl font-bold">Date & Time</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">When does your event take place?</p>
                    </div>
                    <CardContent className="p-8 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Date</Label>
                          <Input type="date" {...register("dateStr")} className="h-12 rounded-xl" />
                          {errors.dateStr && <p className="text-destructive text-sm">{errors.dateStr.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Time</Label>
                          <Controller control={control} name="time" render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                              <SelectContent className="max-h-64 bg-white dark:bg-zinc-900">
                                {TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )} />
                          {errors.time && <p className="text-destructive text-sm">{errors.time.message}</p>}
                        </div>
                      </div>

                      <div className="border-t border-border/50 pt-4 mt-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label>Repeat</Label>
                            <Controller control={control} name="recurrence" render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Does not repeat" /></SelectTrigger>
                                <SelectContent className="bg-white dark:bg-zinc-900">
                                  <SelectItem value="none">Does not repeat</SelectItem>
                                  <SelectItem value="daily">Daily</SelectItem>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                </SelectContent>
                              </Select>
                            )} />
                          </div>
                          {watchedRecurrence !== "none" && (
                            <div className="space-y-2">
                              <Label>Repeat until</Label>
                              <Input type="date" {...register("recurrenceUntil")} className="h-12 rounded-xl" />
                              <p className="text-xs text-muted-foreground">Optional – last occurrence date</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {watchedDateStr && watchedTime && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-2xl px-5 py-4"
                        >
                          <span className="text-2xl">📅</span>
                          <div>
                            <p className="font-semibold text-sm">
                              {new Date(watchedDateStr).toLocaleDateString("en-GB", {
                                weekday: "long", day: "numeric", month: "long", year: "numeric",
                              })}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Starts at {watchedTime}
                              {watchedRecurrence !== "none" && ` · repeats ${watchedRecurrence}`}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ── Step 2: Location & Media ── */}
                {step === 2 && (
                  <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
                    <div className="bg-primary/5 px-8 py-4 border-b border-border/50">
                      <h2 className="text-xl font-bold">Location & Media</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">Where is your event and how should it look?</p>
                    </div>
                    <CardContent className="p-8 space-y-6">
                      {/* 🌟 New: Venue Name */}
                      <div className="space-y-2">
                        <Label>Venue / Place Name <span className="font-normal text-muted-foreground">(optional)</span></Label>
                        <Input
                          {...register("locationName")}
                          placeholder="e.g. Surf Coffee, Gorky Park"
                          className="h-12 rounded-xl"
                        />
                        {errors.locationName && <p className="text-destructive text-sm">{errors.locationName.message}</p>}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Venue Address</Label>
                          <Input {...register("venueAddress")} className="h-12 rounded-xl" placeholder="Ulitsa Arbat, 1" />
                          {errors.venueAddress && <p className="text-destructive text-sm">{errors.venueAddress.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>City</Label>
                          <Input {...register("venueCity")} className="h-12 rounded-xl" placeholder="Moscow" />
                          {errors.venueCity && <p className="text-destructive text-sm">{errors.venueCity.message}</p>}
                        </div>
                      </div>

                      {/* Map picker button */}
                      <div className="flex items-center justify-between">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setMapModalOpen(true)}
                          className="gap-2"
                        >
                          <MapPin className="w-4 h-4" />
                          {tempMarkerCoords ? "Adjust on Map" : "Select on Map"}
                        </Button>
                        {watchedLat && watchedLng && (
                          <p className="text-xs text-muted-foreground">
                            📍 {watchedLat.toFixed(5)}, {watchedLng.toFixed(5)}
                          </p>
                        )}
                      </div>

                      {/* Cover image upload */}
                      <div className="space-y-3">
                        <Label>Cover Image</Label>
                        {watchedImageUrl ? (
                          <div className="relative rounded-xl overflow-hidden border border-border aspect-video w-full bg-muted">
                            <img src={watchedImageUrl} alt="Cover" className="w-full h-full object-cover" loading="lazy" />
                            <button
                              type="button"
                              onClick={removeImage}
                              className="absolute top-3 right-3 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center w-full h-48 rounded-xl border-2 border-dashed border-border bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors group">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              {uploading ? (
                                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-3" />
                              ) : (
                                <>
                                  <Upload className="w-10 h-10 text-muted-foreground mb-3 group-hover:text-primary transition-colors" />
                                  <p className="text-sm text-muted-foreground">
                                    <span className="font-semibold">Click to upload</span> or drag and drop
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP, GIF up to 5 MB</p>
                                </>
                              )}
                            </div>
                            <input
                              type="file"
                              className="hidden"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              onChange={handleImageUpload}
                              disabled={uploading}
                            />
                          </label>
                        )}
                        {uploadError && <p className="text-destructive text-sm">{uploadError}</p>}
                        <p className="text-xs text-muted-foreground">
                          Upload a photo or use the default for your chosen category.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ── Step 3: Tickets ── */}
                {step === 3 && (
                  <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
                    <div className="bg-primary/5 px-8 py-4 border-b border-border/50 flex justify-between items-center">
                      <div>
                        <h2 className="text-xl font-bold">Tickets</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">Set up ticket types and pricing</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => append({ name: "", price: 0, quantity: 50, maxPerOrder: 4 })}
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add Ticket
                      </Button>
                    </div>
                    <CardContent className="p-8 space-y-4 bg-muted/10">
                      {fields.map((field, idx) => (
                        <div
                          key={field.id}
                          className="relative bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-end"
                        >
                          {fields.length > 1 && (
                            <button
                              type="button"
                              onClick={() => remove(idx)}
                              className="absolute top-4 right-4 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                          <div className="flex-1 w-full space-y-2">
                            <Label>Ticket Name</Label>
                            <Input {...register(`ticketTypes.${idx}.name`)} placeholder="General Admission" className="h-11 rounded-xl" />
                            {errors.ticketTypes?.[idx]?.name && (
                              <p className="text-destructive text-xs">{errors.ticketTypes[idx].name?.message}</p>
                            )}
                          </div>
                          <div className="w-full md:w-28 space-y-2">
                            <Label>Price (₽)</Label>
                            <Input type="number" {...register(`ticketTypes.${idx}.price`)} className="h-11 rounded-xl" />
                          </div>
                          <div className="w-full md:w-28 space-y-2">
                            <Label>Total Qty</Label>
                            <Input type="number" {...register(`ticketTypes.${idx}.quantity`)} className="h-11 rounded-xl" />
                          </div>
                          <div className="w-full md:w-28 space-y-2">
                            <Label>Max / Order</Label>
                            <Input type="number" {...register(`ticketTypes.${idx}.maxPerOrder`)} className="h-11 rounded-xl" />
                          </div>
                        </div>
                      ))}
                      {errors.ticketTypes?.message && (
                        <p className="text-destructive text-sm">{errors.ticketTypes.message}</p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ── Step 4: Preview & Publish ── */}
                {step === 4 && (
                  <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
                    <div className="bg-primary/5 px-8 py-4 border-b border-border/50">
                      <h2 className="text-xl font-bold">Preview & Publish</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">Check everything looks right before going live</p>
                    </div>
                    <CardContent className="p-8 space-y-6">
                      {allValues.imageUrl && (
                        <div className="rounded-2xl overflow-hidden aspect-video w-full">
                          <img src={allValues.imageUrl} alt="Cover" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      )}

                      <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
                        {[
                          { icon: "📌", label: "Title",     value: allValues.title },
                          { icon: "🏷",  label: "Category",  value: EVENT_CATEGORIES.find(c => c.value === allValues.category)?.label },
                          {
                            icon: "📅", label: "Date & Time",
                            value: allValues.dateStr && allValues.time
                              ? `${new Date(allValues.dateStr).toLocaleDateString("en-GB", {
                                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                                })} at ${allValues.time}${allValues.recurrence !== "none" ? ` · repeats ${allValues.recurrence}` : ""}`
                              : null,
                          },
                          {
                            icon: "📍", label: "Location",
                            value: [
                              allValues.locationName,
                              allValues.venueAddress,
                              allValues.venueCity,
                            ].filter(Boolean).join(", ") || null,
                          },
                        ].filter(r => r.value).map(row => (
                          <div key={row.label} className="flex items-start gap-3 px-5 py-3.5 bg-card">
                            <span className="text-base mt-0.5">{row.icon}</span>
                            <span className="text-xs text-muted-foreground w-20 shrink-0 pt-0.5">{row.label}</span>
                            <span className="text-sm font-medium">{row.value}</span>
                          </div>
                        ))}
                      </div>

                      {allValues.description && (
                        <div className="rounded-2xl bg-muted/40 p-5">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">Description</p>
                          <p className="text-sm leading-relaxed line-clamp-5">{allValues.description}</p>
                        </div>
                      )}

                      {(allValues.ticketTypes?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">Tickets</p>
                          <div className="space-y-2">
                            {allValues.ticketTypes.map((t, i) => (
                              <div key={i} className="flex justify-between items-center bg-muted/30 rounded-xl px-4 py-3 text-sm">
                                <span className="font-medium">{t.name || "Unnamed"}</span>
                                <span className="text-muted-foreground">
                                  {t.price === 0 ? "Free" : `${t.price} ₽`} · {t.quantity} available
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                        ExpatEvents provides the infrastructure to organise activities. The voluntary organisers do not
                        represent ExpatEvents as vicarious agents. In the case of gross negligence by the organisers,
                        ExpatEvents therefore does not accept any legal responsibility for resulting damages. Neither
                        ExpatEvents nor the event organisers assume liability for any loss of or damage to personal
                        property, nor shall they be held responsible in the event of financial, physical, or emotional
                        damage.
                      </div>

                      {submitError && (
                        <div className="flex items-start gap-3 p-4 rounded-2xl bg-destructive/10 border border-destructive/20">
                          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                          <p className="text-destructive text-sm">{submitError}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <Button type="button" variant="outline" onClick={prevStep} className="flex-1 h-12 rounded-2xl">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={nextStep} className="flex-1 h-12 rounded-2xl shadow-lg shadow-primary/20">
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={createEvent.isPending}
                className="flex-1 h-12 text-base rounded-2xl shadow-xl shadow-primary/20"
              >
                {createEvent.isPending ? "Publishing…" : "Publish Event"}
              </Button>
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            Step {step + 1} of {STEPS.length}
          </p>
        </form>
      </div>

      {/* ── Yandex Map Modal ── */}
      <Dialog open={mapModalOpen} onOpenChange={setMapModalOpen}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Event Location</DialogTitle>
          </DialogHeader>
          <div className="flex-1 relative min-h-[300px] rounded-lg overflow-hidden">
            <YandexMapPicker
              lat={watchedLat ?? null}
              lng={watchedLng ?? null}
              onLocationSelect={handleLocationSelect}
            />
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setMapModalOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmLocation} disabled={!tempMarkerCoords}>
              Use this location
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
