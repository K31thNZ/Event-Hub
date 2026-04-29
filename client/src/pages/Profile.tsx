import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Bell, Calendar, Camera, Pencil, Check, X, Languages, MapPin, Plus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { EVENT_CATEGORIES } from "@shared/categories";
import { TelegramConnect } from "@/components/TelegramConnect";
import { isTelegramMiniApp } from "@/hooks/use-telegram-miniapp-auth";

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "https://auth.expatevents.org";

// ── Server‑mediated avatar upload  ─────
async function uploadAvatar(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload/avatar", {
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

// ── Helper: category icons ───────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, string> = {
  networking: "🔗", tech: "💻", culture: "🎨", food: "🍔",
  sports: "⚽", music: "🎵", language: "🌍", outdoor: "🏕️",
  games: "🎮", business: "💼", wellness: "🧘", family: "👨‍👩‍👧",
  social: "🤝", volunteering: "🙌", other: "📌",
};

// ── Language data ─────────────────────────────────────────────────────────────
const PROFICIENCY_LEVELS = [
  { value: "A1", label: "A1 — Beginner" },
  { value: "A2", label: "A2 — Elementary" },
  { value: "B1", label: "B1 — Intermediate" },
  { value: "B2", label: "B2 — Upper-intermediate" },
  { value: "C1", label: "C1 — Advanced" },
  { value: "C2", label: "C2 — Mastery" },
] as const;

export type ProficiencyLevel = (typeof PROFICIENCY_LEVELS)[number]["value"];

export interface LanguageEntry {
  code: string;
  proficiency: ProficiencyLevel;
}

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ru", label: "Russian", flag: "🇷🇺" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
  { code: "pt", label: "Portuguese", flag: "🇵🇹" },
  { code: "nl", label: "Dutch", flag: "🇳🇱" },
  { code: "pl", label: "Polish", flag: "🇵🇱" },
  { code: "sv", label: "Swedish", flag: "🇸🇪" },
  { code: "no", label: "Norwegian", flag: "🇳🇴" },
  { code: "da", label: "Danish", flag: "🇩🇰" },
  { code: "fi", label: "Finnish", flag: "🇫🇮" },
  { code: "cs", label: "Czech", flag: "🇨🇿" },
  { code: "sk", label: "Slovak", flag: "🇸🇰" },
  { code: "hu", label: "Hungarian", flag: "🇭🇺" },
  { code: "ro", label: "Romanian", flag: "🇷🇴" },
  { code: "uk", label: "Ukrainian", flag: "🇺🇦" },
  { code: "ar", label: "Arabic", flag: "🇸🇦" },
  { code: "zh", label: "Chinese (Mandarin)", flag: "🇨🇳" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "ko", label: "Korean", flag: "🇰🇷" },
  { code: "hi", label: "Hindi", flag: "🇮🇳" },
  { code: "fa", label: "Persian (Farsi)", flag: "🇮🇷" },
  { code: "tr", label: "Turkish", flag: "🇹🇷" },
  { code: "he", label: "Hebrew", flag: "🇮🇱" },
  { code: "el", label: "Greek", flag: "🇬🇷" },
  { code: "id", label: "Indonesian", flag: "🇮🇩" },
  { code: "th", label: "Thai", flag: "🇹🇭" },
  { code: "vi", label: "Vietnamese", flag: "🇻🇳" },
];

// ── Moscow Metro stations grouped by line ─────────────────────────────────────
export const METRO_LINES: { line: string; color: string; stations: string[] }[] = [
  {
    line: "1 — Sokolnicheskaya (Red)",
    color: "#EF3340",
    stations: [
      "Bulvar Rokossovskogo", "Shchёlkovskaya", "Pervomayskaya", "Izmaylovskaya",
      "Partizanskaya", "Semyonovskaya", "Elektrozavodskaya", "Baumanskaya",
      "Komsomolskaya", "Krasnye Vorota", "Chistye Prudy", "Lubyanka",
      "Okhotny Ryad", "Biblioteka imeni Lenina", "Kropotkinskaya",
      "Park Kultury", "Frunzenskaya", "Sportivnaya", "Vorobyovy Gory",
      "Universitet", "Prospekt Vernadskogo", "Yugo-Zapadnaya",
      "Troparyovo", "Rumyantsevo", "Salaryevo",
    ],
  },
  {
    line: "2 — Zamoskvoretskaya (Green)",
    color: "#4DAA4B",
    stations: [
      "Khimki", "Ховrino", "Belorusskaya", "Mayakovskaya", "Tverskaya",
      "Teatralnaya", "Novokuznetskaya", "Paveletskaya", "Avtozavodskaya",
      "Technopark", "Kolomenskaya", "Kashirskaya", "Kantemirovskaya",
      "Tsaritsyno", "Orekhovo", "Domodedovskaya", "Krasnogvardeyskaya",
      "Alma-Atinskaya",
    ],
  },
  {
    line: "3 — Arbatsko-Pokrovskaya (Dark Blue)",
    color: "#0952A5",
    stations: [
      "Shchyolkovskaya", "Cherkizovskaya (Arbatsko)", "Preobrazhenskaya Ploshchad",
      "Sokolniki", "Krasnoselskaya", "Komsomolskaya (Arbatsko)", "Kurskaya",
      "Ploshchad Revolyutsii", "Arbatskaya", "Smolenskaya", "Kiyevskaya",
      "Park Pobedy", "Kuntsevskaya", "Molodёzhnaya", "Krylatskoye",
      "Strogino", "Shodnya", "Mitino", "Volok Lamskoe",
    ],
  },
  {
    line: "4 — Filyovskaya (Light Blue)",
    color: "#17A9E1",
    stations: [
      "Aleksandrovsky Sad", "Arbatskaya (Filyovskaya)", "Smolenskaya (Filyovskaya)",
      "Kiyevskaya (Filyovskaya)", "Studencheskaya", "Kutuzovskaya",
      "Fili", "Bagrationovskaya", "Filyovsk Park", "Kuntsevskaya (Filyovskaya)",
      "Pionerskaya", "Slavyansky Bulvar",
    ],
  },
  {
    line: "5 — Koltsevaya (Brown/Circle)",
    color: "#8E5C2B",
    stations: [
      "Park Kultury (Circle)", "Oktyabrskaya (Circle)", "Dobryninskaya",
      "Paveletskaya (Circle)", "Taganskaya (Circle)", "Kurskaya (Circle)",
      "Komsomolskaya (Circle)", "Prospekt Mira (Circle)", "Novoslobodskaya",
      "Belorusskaya (Circle)", "Krasnopresnenskaya", "Kiyevskaya (Circle)",
    ],
  },
  {
    line: "6 — Kaluzhsko-Rizhskaya (Orange)",
    color: "#F5891F",
    stations: [
      "Medvedkovo", "Babushkinskaya", "Sviblovo", "Botanichesky Sad",
      "VDNKh", "Alekseyevskaya", "Rizhskaya", "Prospekt Mira",
      "Sukharevskaya", "Turgenevskaya", "Kitay-Gorod", "Tretyakovskaya",
      "Oktyabrskaya", "Leninsky Prospekt", "Akademicheskaya", "Profsoyuznaya",
      "Novye Cheremushki", "Kaluzhskaya", "Belyayevo", "Konkovo",
      "Tyoply Stan", "Yasenevo", "Bittsevsky Park",
    ],
  },
  {
    line: "7 — Tagansko-Krasnopresnenskaya (Purple)",
    color: "#8B2F8B",
    stations: [
      "Planernaya", "Sходня", "Tushinskaya", "Spasatel'naya", "Strogino (Taganka)",
      "Myakinino", "Volokolamskaya", "Tushino", "Shchukino",
      "Oktyabrskoye Pole", "Polezhayevskaya", "Begovaya",
      "Ulitsa 1905 Goda", "Krasnopresnenskaya (Taganka)", "Barrikadnaya",
      "Pushkinskaya", "Kuznetsky Most", "Kitay-Gorod (Taganka)",
      "Taganskaya", "Proletarskaya", "Volgogradsky Prospekt",
      "Tekstilshchiki", "Pechatniki", "Kuzminki", "Ryazansky Prospekt",
      "Vykhino", "Zhulebino", "Kotelniky",
    ],
  },
  {
    line: "8 — Kaluzhsko-Serpukhovskaya (Grey)",
    color: "#8E8E8E",
    stations: [
      "Bulvar Dmitriya Donskogo", "Annino", "Ulitsa Akademika Yangelya",
      "Prazhskaya", "Chertanovskaya", "Yuzhnaya", "Nagornaya",
      "Nakhimovsky Prospekt", "Sebastopolskaya", "Nagatinskaya",
      "Tul'skaya", "Serpukhovskaya", "Polyanka", "Borovitskaya",
      "Okhotny Ryad (Serpukhovskaya)", "Chekhovskaya", "Tsvetnoy Bulvar",
      "Mendeleyevskaya", "Savyolovskaya", "Dmitrovskaya",
      "Timiryazevskaya", "Petrovsko-Razumovskaya", "Vladykino",
      "Otradnoye", "Bibirevo", "Altufyevo",
    ],
  },
  {
    line: "9 — Lyublinsko-Dmitrovskaya (Yellow-Green)",
    color: "#BAC938",
    stations: [
      "Zябликово", "Shipilovo", "Domodedovskaya (Lyublinsko)", "Krasnogvardeyskaya (Lyublinsko)",
      "Борисово", "Shcherbinka", "Pechatniki (Lyublinsko)", "Volzhskaya",
      "Lyublino", "Bratislavskaya", "Maryino", "Zяblikово",
      "Dubrovskoye", "Krestyanskaya Zastava", "Proletarskaya (Lyublinsko)",
      "Rimskaya", "Крестьянская застава", "Trubная", "Sretensky Bulvar",
      "Chkalovskaya", "Kozhukhovo",
    ],
  },
  {
    line: "10 — Nekrasovskaya (Pink)",
    color: "#E6878A",
    stations: [
      "Kosino", "Ulitsa Dmitrievskogo", "Lermontovsky Prospekt",
      "Zhulebino (Nekrasovskaya)", "Lyubertsy Fields", "Nekrasovka",
      "Lavochkina", "Yunona", "Minsk",
    ],
  },
  {
    line: "BKL — Big Circle Line",
    color: "#82C0CC",
    stations: [
      "Savyolovskaya (BKL)", "Delovoy Tsentr", "Shelepikha",
      "Khoroshyovo", "Mnyovniki", "Streshnevo",
      "Zyuzino", "Oktyabrskoye Pole (BKL)", "Shelepikhа",
      "Kuntsevskaya (BKL)", "Davydkovo", "Аминьевская",
      "Michurinsky Prospekt", "Prospekt Vernadskogo (BKL)",
      "Novatorskaya", "Vorontsovskaya", "Zyablikovo (BKL)",
      "Kakhovskaya", "Varshavskaya", "Kashirskaya (BKL)",
      "Nagatinskaya Zaton", "Pechatniki (BKL)", "Tekstilshchiki (BKL)",
      "Avtozavodskaya (BKL)", "Лефортово", "Sokolniki (BKL)",
      "Rижская", "Maryin Grove", "Shelepikha (BKL)",
    ],
  },
  {
    line: "МЦД / Overground",
    color: "#6DB8D4",
    stations: [
      "Vnukovo", "Aeroport (МЦД)", "Airport Sheremetyevo",
      "Khimki (МЦД)", "Ленинградская", "Tushino (МЦД)",
    ],
  },
];

const ALL_STATIONS = METRO_LINES.flatMap(l => l.stations.map(s => ({ station: s, line: l.line, color: l.color })));

// ── Availability grid constants ───────────────────────────────────────────────
const DAYS  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 8);
type Slot = { day: number; hour: number };

// ── Main component ─────────────────────────────────────────────────────────────
export default function Profile() {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();

  const [interests,    setInterests]    = useState<string[]>([]);
  const [slots,        setSlots]        = useState<Slot[]>([]);
  const [displayName,  setDisplayName]  = useState("");
  const [avatarUrl,    setAvatarUrl]    = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile,   setAvatarFile]   = useState<File | null>(null);

  const [editingName,  setEditingName]  = useState(false);
  const [nameInput,    setNameInput]    = useState("");

  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError,  setAvatarError]  = useState<string | null>(null);

  const [isMouseDown,  setIsMouseDown]  = useState(false);
  const [dragMode,     setDragMode]     = useState<"add" | "remove">("add");

  // Language state
  const [nativeLanguage,    setNativeLanguage]    = useState<string>("");
  const [learningLanguages, setLearningLanguages] = useState<LanguageEntry[]>([]);

  // Location state
  const [metroStation, setMetroStation] = useState<string>("");
  const [stationSearch, setStationSearch] = useState<string>("");
  const [stationDropdownOpen, setStationDropdownOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const stationRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (stationRef.current && !stationRef.current.contains(e.target as Node)) {
        setStationDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    setInterests(user.interests ?? []);
    setDisplayName(user.displayName ?? user.username ?? "");
    setNameInput(user.displayName ?? user.username ?? "");
    setAvatarUrl(user.avatarUrl ?? "");

    fetch(`${AUTH_URL}/api/availability`, { credentials: "include" })
      .then(r => r.json())
      .then((data: Slot[]) => setSlots(data))
      .catch(() => {});

    fetch(`${AUTH_URL}/api/user/match-profile`, { credentials: "include" })
      .then(r => r.json())
      .then((data: { nativeLanguage?: string; learningLanguages?: LanguageEntry[]; metroStation?: string }) => {
        if (data.nativeLanguage)    setNativeLanguage(data.nativeLanguage);
        if (data.learningLanguages) setLearningLanguages(data.learningLanguages);
        if (data.metroStation)      setMetroStation(data.metroStation);
      })
      .catch(() => {});
  }, [user]);

  const toggleInterest = (value: string) => {
    setInterests(prev =>
      prev.includes(value) ? prev.filter(i => i !== value) : [...prev, value]
    );
  };

  const isSlotActive = (day: number, hour: number) =>
    slots.some(s => s.day === day && s.hour === hour);

  const handleSlotMouseDown = (day: number, hour: number) => {
    setIsMouseDown(true);
    const active = isSlotActive(day, hour);
    setDragMode(active ? "remove" : "add");
    toggleSlot(day, hour, active ? "remove" : "add");
  };

  const handleSlotMouseEnter = (day: number, hour: number) => {
    if (!isMouseDown) return;
    toggleSlot(day, hour, dragMode);
  };

  const toggleSlot = (day: number, hour: number, mode: "add" | "remove") => {
    setSlots(prev => {
      const exists = prev.some(s => s.day === day && s.hour === hour);
      if (mode === "add"    && !exists) return [...prev, { day, hour }];
      if (mode === "remove" && exists)  return prev.filter(s => !(s.day === day && s.hour === hour));
      return prev;
    });
  };

  const addLearningLanguage = () => {
    if (learningLanguages.length >= 3) return;
    const used = new Set([nativeLanguage, ...learningLanguages.map(l => l.code)]);
    const next = LANGUAGES.find(l => !used.has(l.code));
    if (!next) return;
    setLearningLanguages(prev => [...prev, { code: next.code, proficiency: "A1" }]);
  };

  const removeLearningLanguage = (index: number) => {
    setLearningLanguages(prev => prev.filter((_, i) => i !== index));
  };

  const updateLearningLanguage = (index: number, field: keyof LanguageEntry, value: string) => {
    setLearningLanguages(prev =>
      prev.map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry
      )
    );
  };

  const filteredStations = stationSearch.trim().length > 0
    ? ALL_STATIONS.filter(s => s.station.toLowerCase().includes(stationSearch.toLowerCase())).slice(0, 12)
    : [];

  const stationsByLine = METRO_LINES.map(line => ({
    ...line,
    stations: line.stations,
  }));

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setAvatarError("Image must be under 5 MB"); return; }
    setAvatarError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const cancelAvatarChange = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      let finalAvatarUrl = avatarUrl;
      if (avatarFile) {
        setUploadingAvatar(true);
        try {
          finalAvatarUrl = await uploadAvatar(avatarFile);
          setAvatarUrl(finalAvatarUrl);
          setAvatarPreview(null);
          setAvatarFile(null);
        } catch (err: any) {
          console.error("Avatar upload error:", err);
          setAvatarError(err.message ?? "Upload failed");
          setSaving(false);
          setUploadingAvatar(false);
          return;
        }
        setUploadingAvatar(false);
      }

      await Promise.all([
        fetch(`${AUTH_URL}/api/user/interests`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ interests }),
        }),
        fetch(`${AUTH_URL}/api/availability`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ slots }),
        }),
        fetch(`${AUTH_URL}/api/user/profile`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            displayName: displayName.trim() || undefined,
            avatarUrl: finalAvatarUrl || undefined,
          }),
        }),
        fetch(`${AUTH_URL}/api/user/match-profile`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            nativeLanguage:    nativeLanguage    || undefined,
            learningLanguages: learningLanguages.length ? learningLanguages : undefined,
            metroStation:      metroStation      || undefined,
          }),
        }),
      ]);

      queryClient.invalidateQueries({ queryKey: ["auth-user"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading profile…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Sign in to view your profile.</p>
        <Button onClick={() => window.location.href = `${AUTH_URL}/login?returnTo=${window.location.href}`}>
          Sign In
        </Button>
      </div>
    );
  }

  const initials = (displayName || user.username || "U").substring(0, 2).toUpperCase();
  const currentAvatar = avatarPreview ?? avatarUrl;
  const nativeLang = LANGUAGES.find(l => l.code === nativeLanguage);

  return (
    <div
      className="min-h-screen bg-muted/20 py-8 px-4 sm:py-12 sm:px-6 lg:px-8"
      onMouseUp={() => setIsMouseDown(false)}
      onMouseLeave={() => setIsMouseDown(false)}
    >
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 sm:space-y-8">

          {/* Identity Card */}
          <Card className="rounded-2xl sm:rounded-3xl border-border/60 shadow-lg overflow-hidden">
            <div className="bg-primary/5 px-5 py-3 sm:px-8 sm:py-4 border-b border-border/50 flex items-center gap-2">
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <h2 className="text-lg sm:text-xl font-bold font-display">Your Profile</h2>
            </div>
            <CardContent className="p-5 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start gap-5 sm:gap-6">
                <div className="relative shrink-0">
                  <Avatar className="h-20 w-20 sm:h-24 sm:w-24 ring-2 ring-border">
                    <AvatarImage src={currentAvatar} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl sm:text-2xl">{initials}</AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                    title="Change photo"
                  >
                    <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        className="h-9 sm:h-10 rounded-xl text-base sm:text-lg font-bold max-w-xs"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === "Enter")  { setDisplayName(nameInput); setEditingName(false); }
                          if (e.key === "Escape") { setNameInput(displayName); setEditingName(false); }
                        }}
                      />
                      <button onClick={() => { setDisplayName(nameInput); setEditingName(false); }}
                        className="text-primary hover:text-primary/80">
                        <Check className="w-5 h-5" />
                      </button>
                      <button onClick={() => { setNameInput(displayName); setEditingName(false); }}
                        className="text-muted-foreground hover:text-foreground">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl sm:text-2xl font-bold truncate">{displayName || user.username}</h1>
                      <button onClick={() => setEditingName(true)}
                        className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                        title="Edit name">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {user.email && <p className="text-muted-foreground text-xs sm:text-sm break-all">{user.email}</p>}
                  <div className="flex gap-2 flex-wrap">
                    {user.isExpatMember && <Badge variant="secondary">ExpatEvents</Badge>}
                    {user.isGamesMember && <Badge variant="secondary">Games in English</Badge>}
                    {user.role === "admin" && <Badge>Admin</Badge>}
                  </div>
                  {avatarPreview && (
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-xs sm:text-sm text-muted-foreground">New photo selected — save to apply</span>
                      <button onClick={cancelAvatarChange} className="text-xs text-destructive hover:underline">Cancel</button>
                    </div>
                  )}
                  {avatarError && <p className="text-xs sm:text-sm text-destructive">{avatarError}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Telegram Card */}
          {!isTelegramMiniApp() && (
            <Card className="rounded-2xl sm:rounded-3xl border-border/60 shadow-lg overflow-hidden">
              <div className="bg-primary/5 px-5 py-3 sm:px-8 sm:py-4 border-b border-border/50 flex items-center gap-2">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <h2 className="text-lg sm:text-xl font-bold font-display">Telegram Notifications</h2>
              </div>
              <CardContent className="p-5 sm:p-8">
                <TelegramConnect
                  connected={!!user.telegramId}
                  onUnlinked={() => queryClient.invalidateQueries({ queryKey: ["auth-user"] })}
                />
              </CardContent>
            </Card>
          )}

          {/* Languages Card */}
          <Card className="rounded-2xl sm:rounded-3xl border-border/60 shadow-lg overflow-hidden">
            <div className="bg-primary/5 px-5 py-3 sm:px-8 sm:py-4 border-b border-border/50 flex items-center gap-2">
              <Languages className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-display">Languages</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Used to match you with language exchange partners
                </p>
              </div>
            </div>
            <CardContent className="p-5 sm:p-8 space-y-5 sm:space-y-6">
              {/* Native language */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Native language</Label>
                <div className="relative">
                  <select
                    value={nativeLanguage}
                    onChange={e => {
                      const val = e.target.value;
                      setNativeLanguage(val);
                      setLearningLanguages(prev => prev.filter(l => l.code !== val));
                    }}
                    className="w-full h-9 sm:h-10 rounded-xl border border-border bg-background px-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">— Select your native language —</option>
                    {LANGUAGES.map(l => (
                      <option key={l.code} value={l.code}>
                        {l.flag} {l.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">▾</div>
                </div>
                {nativeLang && (
                  <p className="text-xs text-muted-foreground pl-1">
                    You will appear as a native {nativeLang.label} speaker to learners
                  </p>
                )}
              </div>
              <div className="border-t border-border/50" />
              {/* Languages to learn */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Languages I want to practise</Label>
                  {learningLanguages.length < 3 && (
                    <button
                      type="button"
                      onClick={addLearningLanguage}
                      disabled={!nativeLanguage}
                      className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add language
                    </button>
                  )}
                </div>
                {!nativeLanguage && <p className="text-sm text-muted-foreground italic">Select your native language first</p>}
                {learningLanguages.length === 0 && nativeLanguage && (
                  <p className="text-sm text-muted-foreground italic">No languages added yet — click "Add language" above</p>
                )}
                <div className="space-y-3">
                  {learningLanguages.map((entry, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 rounded-xl border border-border/60 bg-muted/30"
                    >
                      <div className="relative flex-1 min-w-0">
                        <select
                          value={entry.code}
                          onChange={e => updateLearningLanguage(idx, "code", e.target.value)}
                          className="w-full h-9 rounded-lg border border-border bg-background px-3 pr-7 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          {LANGUAGES.filter(l =>
                            l.code === entry.code ||
                            (l.code !== nativeLanguage && !learningLanguages.some((e, i) => i !== idx && e.code === l.code))
                          ).map(l => (
                            <option key={l.code} value={l.code}>
                              {l.flag} {l.label}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">▾</div>
                      </div>
                      <div className="relative w-full sm:w-44 shrink-0">
                        <select
                          value={entry.proficiency}
                          onChange={e => updateLearningLanguage(idx, "proficiency", e.target.value as ProficiencyLevel)}
                          className="w-full h-9 rounded-lg border border-border bg-background px-3 pr-7 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          {PROFICIENCY_LEVELS.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">▾</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLearningLanguage(idx)}
                        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
                {learningLanguages.length > 0 && (
                  <p className="text-xs text-muted-foreground pl-1">
                    You'll be matched with native speakers of{" "}
                    {learningLanguages.map(l => LANGUAGES.find(x => x.code === l.code)?.label).filter(Boolean).join(", ")}{" "}
                    who want to learn {nativeLang?.label ?? "your language"}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Location Card */}
          <Card className="rounded-2xl sm:rounded-3xl border-border/60 shadow-lg overflow-hidden">
            <div className="bg-primary/5 px-5 py-3 sm:px-8 sm:py-4 border-b border-border/50 flex items-center gap-2">
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-display">Your Location</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Used to suggest nearby meetup spots
                </p>
              </div>
            </div>
            <CardContent className="p-5 sm:p-8 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Closest Moscow metro station</Label>
                <div className="relative" ref={stationRef}>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type to search stations…"
                      value={stationSearch || metroStation}
                      onFocus={() => { setStationSearch(""); setStationDropdownOpen(true); }}
                      onChange={e => { setStationSearch(e.target.value); setStationDropdownOpen(true); }}
                      className="w-full h-9 sm:h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    {metroStation && !stationDropdownOpen && (
                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                        {(() => {
                          const s = ALL_STATIONS.find(x => x.station === metroStation);
                          return s ? (
                            <span
                              className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                              style={{ background: s.color }}
                            >
                              {s.line.split("—")[0].trim()}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>
                  {stationDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-border bg-background shadow-xl">
                      {stationSearch.trim().length > 0 ? (
                        filteredStations.length > 0 ? (
                          filteredStations.map(({ station, line, color }) => (
                            <button
                              key={station + line}
                              type="button"
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/60 flex items-center gap-3 transition-colors"
                              onMouseDown={() => {
                                setMetroStation(station);
                                setStationSearch("");
                                setStationDropdownOpen(false);
                              }}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ background: color }}
                              />
                              <span className="flex-1 font-medium">{station}</span>
                              <span className="text-xs text-muted-foreground truncate max-w-[160px]">{line}</span>
                            </button>
                          ))
                        ) : (
                          <p className="px-4 py-3 text-sm text-muted-foreground">No stations found</p>
                        )
                      ) : (
                        stationsByLine.map(lineGroup => (
                          <div key={lineGroup.line}>
                            <div
                              className="px-4 py-1.5 text-xs font-semibold sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border/30 flex items-center gap-2"
                              style={{ color: lineGroup.color }}
                            >
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ background: lineGroup.color }}
                              />
                              {lineGroup.line}
                            </div>
                            {lineGroup.stations.map(station => (
                              <button
                                key={station}
                                type="button"
                                className={`
                                  w-full text-left px-4 py-2 text-sm hover:bg-muted/60 flex items-center gap-3 transition-colors
                                  ${metroStation === station ? "bg-primary/10 text-primary font-medium" : ""}
                                `}
                                onMouseDown={() => {
                                  setMetroStation(station);
                                  setStationSearch("");
                                  setStationDropdownOpen(false);
                                }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0 opacity-60"
                                  style={{ background: lineGroup.color }}
                                />
                                {station}
                              </button>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {metroStation && (
                  <div className="flex items-center gap-2 pt-1">
                    {(() => {
                      const s = ALL_STATIONS.find(x => x.station === metroStation);
                      return (
                        <>
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: s?.color ?? "#888" }}
                          />
                          <span className="text-sm font-medium">{metroStation}</span>
                          {s && <span className="text-xs text-muted-foreground">· {s.line}</span>}
                          <button
                            type="button"
                            onClick={() => { setMetroStation(""); setStationSearch(""); }}
                            className="ml-auto text-xs text-muted-foreground hover:text-destructive transition-colors"
                          >
                            Clear
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Interests Card – FULL LABELS restored */}
          <Card className="rounded-2xl sm:rounded-3xl border-border/60 shadow-lg overflow-hidden">
            <div className="bg-primary/5 px-5 py-3 sm:px-8 sm:py-4 border-b border-border/50">
              <h2 className="text-lg sm:text-xl font-bold font-display">Your Interests</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Select categories for notifications
              </p>
            </div>
            <CardContent className="p-5 sm:p-8">
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {EVENT_CATEGORIES.map(cat => {
                  const active = interests.includes(cat.value);
                  return (
                    <button
                      key={cat.value}
                      onClick={() => toggleInterest(cat.value)}
                      className={`
                        flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border text-xs sm:text-sm font-medium transition-all
                        ${active
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                        }
                      `}
                    >
                      <span style={{ fontSize: 14 }}>{CATEGORY_ICONS[cat.value]}</span>
                      {/* FULL label – no truncation */}
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
                <button
                  onClick={() => toggleInterest("language_exchange")}
                  className={`
                    flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border text-xs sm:text-sm font-medium transition-all
                    ${interests.includes("language_exchange")
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                    }
                  `}
                >
                  <span style={{ fontSize: 14 }}>🗣️</span>
                  <span>Language Exchange</span>
                </button>
              </div>
              {interests.length === 0 && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-4">
                  Select at least one interest to receive targeted notifications.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Availability grid */}
          <Card className="rounded-2xl sm:rounded-3xl border-border/60 shadow-lg overflow-hidden">
            <div className="bg-primary/5 px-5 py-3 sm:px-8 sm:py-4 border-b border-border/50 flex items-center gap-2">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-display">Weekly Availability</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Click or drag to mark when you're free
                </p>
              </div>
            </div>
            <CardContent className="p-5 sm:p-6 overflow-x-auto">
              <div className="min-w-[520px]">
                <div className="grid grid-cols-8 gap-1 mb-1">
                  <div />
                  {DAYS.map(d => <div key={d} className="text-xs font-medium text-center text-muted-foreground py-1">{d}</div>)}
                </div>
                {HOURS.map(hour => (
                  <div key={hour} className="grid grid-cols-8 gap-1 mb-1">
                    <div className="text-xs text-muted-foreground text-right pr-2 flex items-center justify-end">
                      {String(hour).padStart(2, "0")}:00
                    </div>
                    {DAYS.map((_, day) => {
                      const active = isSlotActive(day, hour);
                      return (
                        <div
                          key={day}
                          onMouseDown={() => handleSlotMouseDown(day, hour)}
                          onMouseEnter={() => handleSlotMouseEnter(day, hour)}
                          className={`h-6 sm:h-7 rounded cursor-pointer select-none transition-colors ${active ? "bg-primary/80 hover:bg-primary" : "bg-muted hover:bg-primary/20 border border-border"}`}
                        />
                      );
                    })}
                  </div>
                ))}
                <p className="text-xs text-muted-foreground mt-3">
                  {slots.length} slot{slots.length !== 1 ? "s" : ""} selected
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Save button */}
          <Button
            onClick={saveAll}
            disabled={saving || uploadingAvatar}
            className="w-full h-12 sm:h-14 text-base sm:text-lg rounded-xl sm:rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
          >
            {uploadingAvatar ? "Uploading photo…" : saving ? "Saving…" : saved ? "✓ Saved!" : "Save Profile"}
          </Button>

        </motion.div>
      </div>
    </div>
  );
}

// ── Proficiency level colour helper ──────────────────────────────────────────
function proficiencyColor(level: ProficiencyLevel): { bg: string; text: string } {
  switch (level) {
    case "A1": return { bg: "#f1f5f9", text: "#475569" };
    case "A2": return { bg: "#dbeafe", text: "#1d4ed8" };
    case "B1": return { bg: "#dcfce7", text: "#15803d" };
    case "B2": return { bg: "#fef9c3", text: "#a16207" };
    case "C1": return { bg: "#fce7f3", text: "#be185d" };
    case "C2": return { bg: "#ede9fe", text: "#7c3aed" };
  }
}
