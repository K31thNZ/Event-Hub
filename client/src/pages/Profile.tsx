// client/src/pages/Profile.tsx
// Redesigned profile page — inspired by research across Meetup, Hinge, Tandem, InterNations.
//
// Key improvements vs. old version:
//  • Hero banner + large avatar — identity-first (Meetup / Hinge pattern)
//  • Profile completeness bar — Bumble/LinkedIn pattern to nudge completion
//  • Bio text area — every social/dating/language app surfaces this prominently
//  • City field — surfaced and persisted (was missing entirely)
//  • Meeting-type preferences — visible selection, saved to match-profile
//  • Age preferences saved correctly (schema fix tracked separately)
//  • CATEGORY_ICONS removed — icons pulled from shared/categories instead
//  • Public card preview — users see exactly how they appear in Language Exchange
//  • All sections use a sticky-header tab pattern; single Save at the bottom

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  User, Bell, Calendar, Camera, Pencil, Check, X,
  Languages, MapPin, Plus, Trash2, Eye, Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EVENT_CATEGORIES } from "@shared/categories";
import { TelegramConnect } from "@/components/TelegramConnect";
import { isTelegramMiniApp } from "@/hooks/use-telegram-miniapp-auth";
import { LANGUAGES } from "@/lib/constants";

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "https://auth.expatevents.org";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProficiencyLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export interface LanguageEntry { code: string; proficiency: ProficiencyLevel; }

const PROFICIENCY_LEVELS: { value: ProficiencyLevel; label: string }[] = [
  { value: "A1", label: "A1 – Beginner"     },
  { value: "A2", label: "A2 – Elementary"   },
  { value: "B1", label: "B1 – Intermediate" },
  { value: "B2", label: "B2 – Upper-inter." },
  { value: "C1", label: "C1 – Advanced"     },
  { value: "C2", label: "C2 – Mastery"      },
];

const PROFICIENCY_COLORS: Record<ProficiencyLevel, string> = {
  A1: "bg-slate-100 text-slate-700",
  A2: "bg-blue-100 text-blue-700",
  B1: "bg-emerald-100 text-emerald-700",
  B2: "bg-teal-100 text-teal-700",
  C1: "bg-violet-100 text-violet-700",
  C2: "bg-amber-100 text-amber-700",
};

// ── Age group definitions ─────────────────────────────────────────────────────

export const AGE_GROUPS: { value: string; label: string; short: string }[] = [
  { value: "18-25", label: "18 – 25", short: "18" },
  { value: "26-35", label: "26 – 35", short: "26" },
  { value: "36-45", label: "36 – 45", short: "36" },
  { value: "46+",   label: "46 +",    short: "46+" },
];
const AGE_STOPS = AGE_GROUPS.length - 1; // 3

// ── Meeting types ─────────────────────────────────────────────────────────────

const MEETING_TYPES = [
  { value: "1on1",        label: "1 on 1",      emoji: "👤" },
  { value: "small_group", label: "Small Group",  emoji: "👥" },
  { value: "social",      label: "Social Event", emoji: "🎉" },
];

// ── Moscow Metro data ─────────────────────────────────────────────────────────

export const METRO_LINES: { line: string; color: string; stations: string[] }[] = [
  { line: "1 — Sokolnicheskaya (Red)", color: "#EF3340", stations: ["Bulvar Rokossovskogo","Shchёlkovskaya","Pervomayskaya","Izmaylovskaya","Partizanskaya","Semyonovskaya","Elektrozavodskaya","Baumanskaya","Komsomolskaya","Krasnye Vorota","Chistye Prudy","Lubyanka","Okhotny Ryad","Biblioteka imeni Lenina","Kropotkinskaya","Park Kultury","Frunzenskaya","Sportivnaya","Vorobyovy Gory","Universitet","Prospekt Vernadskogo","Yugo-Zapadnaya","Troparyovo","Rumyantsevo","Salaryevo"] },
  { line: "2 — Zamoskvoretskaya (Green)", color: "#4DAA4B", stations: ["Khimki","Ховrino","Belorusskaya","Mayakovskaya","Tverskaya","Teatralnaya","Novokuznetskaya","Paveletskaya","Avtozavodskaya","Technopark","Kolomenskaya","Kashirskaya","Kantemirovskaya","Tsaritsyno","Orekhovo","Domodedovskaya","Krasnogvardeyskaya","Alma-Atinskaya"] },
  { line: "3 — Arbatsko-Pokrovskaya (Dark Blue)", color: "#0952A5", stations: ["Shchyolkovskaya","Cherkizovskaya (Arbatsko)","Preobrazhenskaya Ploshchad","Sokolniki","Krasnoselskaya","Komsomolskaya (Arbatsko)","Kurskaya","Ploshchad Revolyutsii","Arbatskaya","Smolenskaya","Kiyevskaya","Park Pobedy","Kuntsevskaya","Molodёzhnaya","Krylatskoye","Strogino","Shodnya","Mitino","Volok Lamskoe"] },
  { line: "4 — Filyovskaya (Light Blue)", color: "#17A9E1", stations: ["Aleksandrovsky Sad","Arbatskaya (Filyovskaya)","Smolenskaya (Filyovskaya)","Kiyevskaya (Filyovskaya)","Studencheskaya","Kutuzovskaya","Fili","Bagrationovskaya","Filyovsk Park","Kuntsevskaya (Filyovskaya)","Pionerskaya","Slavyansky Bulvar"] },
  { line: "5 — Koltsevaya (Brown/Circle)", color: "#8E5C2B", stations: ["Park Kultury (Circle)","Oktyabrskaya (Circle)","Dobryninskaya","Paveletskaya (Circle)","Taganskaya (Circle)","Kurskaya (Circle)","Komsomolskaya (Circle)","Prospekt Mira (Circle)","Novoslobodskaya","Belorusskaya (Circle)","Krasnopresnenskaya","Kiyevskaya (Circle)"] },
  { line: "6 — Kaluzhsko-Rizhskaya (Orange)", color: "#F5891F", stations: ["Medvedkovo","Babushkinskaya","Sviblovo","Botanichesky Sad","VDNKh","Alekseyevskaya","Rizhskaya","Prospekt Mira","Sukharevskaya","Turgenevskaya","Kitay-Gorod","Tretyakovskaya","Oktyabrskaya","Leninsky Prospekt","Akademicheskaya","Profsoyuznaya","Novye Cheremushki","Kaluzhskaya","Belyayevo","Konkovo","Tyoply Stan","Yasenevo","Bittsevsky Park"] },
  { line: "7 — Tagansko-Krasnopresnenskaya (Purple)", color: "#8B2F8B", stations: ["Planernaya","Sходня","Tushinskaya","Spasatel'naya","Strogino (Taganka)","Myakinino","Volokolamskaya","Tushino","Shchukino","Oktyabrskoye Pole","Polezhayevskaya","Begovaya","Ulitsa 1905 Goda","Krasnopresnenskaya (Taganka)","Barrikadnaya","Pushkinskaya","Kuznetsky Most","Kitay-Gorod (Taganka)","Taganskaya","Proletarskaya","Volgogradsky Prospekt","Tekstilshchiki","Pechatniki","Kuzminki","Ryazansky Prospekt","Vykhino","Zhulebino","Kotelniky"] },
  { line: "8 — Serpukhovsko-Timiryazevskaya (Grey)", color: "#8E8E8E", stations: ["Bulvar Dmitriya Donskogo","Annino","Ulitsa Akademika Yangelya","Prazhskaya","Chertanovskaya","Yuzhnaya","Nagornaya","Nakhimovsky Prospekt","Sebastopolskaya","Nagatinskaya","Tul'skaya","Serpukhovskaya","Polyanka","Borovitskaya","Okhotny Ryad (Serpukhovskaya)","Chekhovskaya","Tsvetnoy Bulvar","Mendeleyevskaya","Savyolovskaya","Dmitrovskaya","Timiryazevskaya","Petrovsko-Razumovskaya","Vladykino","Otradnoye","Bibirevo","Altufyevo"] },
  { line: "9 — Lyublinsko-Dmitrovskaya (Yellow-Green)", color: "#BAC938", stations: ["Zябликово","Shipilovo","Domodedovskaya (Lyublinsko)","Krasnogvardeyskaya (Lyublinsko)","Борисово","Shcherbinka","Pechatniki (Lyublinsko)","Volzhskaya","Lyublino","Bratislavskaya","Maryino","Dubrovskoye","Krestyanskaya Zastava","Proletarskaya (Lyublinsko)","Rimskaya","Trubная","Sretensky Bulvar","Chkalovskaya"] },
  { line: "10 — Nekrasovskaya (Pink)", color: "#E6878A", stations: ["Kosino","Ulitsa Dmitrievskogo","Lermontovsky Prospekt","Zhulebino (Nekrasovskaya)","Lyubertsy Fields","Nekrasovka"] },
  { line: "BKL — Big Circle Line", color: "#82C0CC", stations: ["Savyolovskaya (BKL)","Delovoy Tsentr","Shelepikha","Khoroshyovo","Mnyovniki","Streshnevo","Kuntsevskaya (BKL)","Davydkovo","Аминьевская","Michurinsky Prospekt","Prospekt Vernadskogo (BKL)","Novatorskaya","Vorontsovskaya","Kakhovskaya","Varshavskaya","Kashirskaya (BKL)","Nagatinskaya Zaton","Pechatniki (BKL)","Tekstilshchiki (BKL)","Avtozavodskaya (BKL)","Лефортово","Sokolniki (BKL)","Rижская"] },
  { line: "МЦД / Overground", color: "#6DB8D4", stations: ["Vnukovo","Aeroport (МЦД)","Khimki (МЦД)","Tushino (МЦД)"] },
];

const ALL_STATIONS = METRO_LINES.flatMap(l =>
  l.stations.map(s => ({ station: s, line: l.line, color: l.color }))
);

// ── Availability grid ─────────────────────────────────────────────────────────
const DAYS  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 8);
type Slot   = { day: number; hour: number };

// ── Avatar upload ─────────────────────────────────────────────────────────────
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
    throw new Error((error as { error?: string }).error || "Upload failed");
  }
  return ((await res.json()) as { url: string }).url;
}

// ── Completeness score ────────────────────────────────────────────────────────
interface ProfileData {
  displayName: string;
  avatarUrl: string;
  bio: string;
  city: string;
  nativeLanguage: string;
  learningLanguages: LanguageEntry[];
  interests: string[];
  meetingTypes: string[];
  myAgeGroup: string;
  metroStation: string;
  slots: Slot[];
}

function computeCompleteness(d: ProfileData): { score: number; missing: string[] } {
  const checks: Array<{ label: string; ok: boolean }> = [
    { label: "Display name",          ok: d.displayName.trim().length > 0 },
    { label: "Profile photo",         ok: d.avatarUrl.length > 0 },
    { label: "Bio",                   ok: d.bio.trim().length >= 20 },
    { label: "City",                  ok: d.city.trim().length > 0 },
    { label: "Native language",       ok: d.nativeLanguage.length > 0 },
    { label: "Learning language",     ok: d.learningLanguages.length > 0 },
    { label: "Interests (3+)",        ok: d.interests.length >= 3 },
    { label: "Meeting style",         ok: d.meetingTypes.length > 0 },
    { label: "Age group",             ok: d.myAgeGroup.length > 0 },
    { label: "Availability",          ok: d.slots.length > 0 },
  ];
  const done    = checks.filter(c => c.ok).length;
  const missing = checks.filter(c => !c.ok).map(c => c.label);
  return { score: Math.round((done / checks.length) * 100), missing };
}

// ── Dual-handle discrete age range slider ────────────────────────────────────
interface AgeRangeSliderProps {
  minIdx: number;
  maxIdx: number;
  onChange: (min: number, max: number) => void;
  label?: string;
}

function AgeRangeSlider({ minIdx, maxIdx, onChange, label }: AgeRangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"min" | "max" | null>(null);

  const xToIdx = (clientX: number): number => {
    if (!trackRef.current) return 0;
    const { left, width } = trackRef.current.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(1, (clientX - left) / width)) * AGE_STOPS);
  };

  const onPointerDown = (handle: "min" | "max") => (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = handle;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const idx = xToIdx(e.clientX);
    if (dragging.current === "min") onChange(Math.min(idx, maxIdx), maxIdx);
    else                             onChange(minIdx, Math.max(idx, minIdx));
  };
  const onPointerUp = () => { dragging.current = null; };

  const minPct   = (minIdx / AGE_STOPS) * 100;
  const maxPct   = (maxIdx / AGE_STOPS) * 100;
  const isAnyAge = minIdx === 0 && maxIdx === AGE_STOPS;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
        <span className={`ml-auto text-xs font-semibold px-2.5 py-0.5 rounded-full transition-all ${
          isAnyAge ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
        }`}>
          {isAnyAge ? "Any age" : `${AGE_GROUPS[minIdx].label} – ${AGE_GROUPS[maxIdx].label}`}
        </span>
      </div>
      <div
        ref={trackRef}
        className="relative h-7 flex items-center select-none px-2.5"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div className="absolute inset-x-2.5 h-1.5 rounded-full bg-border" />
        <div
          className="absolute h-1.5 rounded-full bg-primary transition-all duration-75"
          style={{
            left:  `calc(${minPct}% * (100% - 20px) / 100% + 10px)`,
            right: `calc(${100 - maxPct}% * (100% - 20px) / 100% + 10px)`,
          }}
        />
        {AGE_GROUPS.map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-border/60"
            style={{ left: `calc(${(i / AGE_STOPS) * 100}% * (100% - 20px) / 100% + 9px)` }}
          />
        ))}
        <div
          className="absolute w-5 h-5 rounded-full border-2 border-primary bg-background shadow-md cursor-grab active:cursor-grabbing z-10 hover:scale-110 transition-transform"
          style={{ left: `calc(${minPct}% * (100% - 20px) / 100%)` }}
          onPointerDown={onPointerDown("min")}
        />
        <div
          className="absolute w-5 h-5 rounded-full border-2 border-primary bg-background shadow-md cursor-grab active:cursor-grabbing z-10 hover:scale-110 transition-transform"
          style={{ left: `calc(${maxPct}% * (100% - 20px) / 100%)` }}
          onPointerDown={onPointerDown("max")}
        />
      </div>
      <div className="relative h-4 px-2.5">
        {AGE_GROUPS.map((g, i) => (
          <span
            key={i}
            className={`absolute text-[10px] font-medium -translate-x-1/2 transition-colors ${
              i >= minIdx && i <= maxIdx ? "text-primary" : "text-muted-foreground"
            }`}
            style={{ left: `calc(${(i / AGE_STOPS) * 100}% * (100% - 20px) / 100% + 10px)` }}
          >
            {g.short}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Single-handle "my age group" pin ─────────────────────────────────────────
interface AgeGroupPinProps {
  value: string;
  onChange: (val: string) => void;
}

function AgeGroupPin({ value, onChange }: AgeGroupPinProps) {
  const trackRef   = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const currentIdx = AGE_GROUPS.findIndex(a => a.value === value);
  const pinIdx     = currentIdx >= 0 ? currentIdx : -1;

  const xToIdx = useCallback((clientX: number): number => {
    if (!trackRef.current) return 0;
    const { left, width } = trackRef.current.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(1, (clientX - left) / width)) * AGE_STOPS);
  }, []);

  const commit = (clientX: number) => onChange(AGE_GROUPS[xToIdx(clientX)].value);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = true;
    commit(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => { if (isDragging.current) commit(e.clientX); };
  const onPointerUp   = () => { isDragging.current = false; };

  const pinPct = pinIdx >= 0 ? (pinIdx / AGE_STOPS) * 100 : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">My age group</span>
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full transition-all ${
          pinIdx >= 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}>
          {pinIdx >= 0 ? AGE_GROUPS[pinIdx].label : "Not set"}
        </span>
      </div>
      <div
        ref={trackRef}
        className="relative h-7 flex items-center select-none px-2.5"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div className="absolute inset-x-2.5 h-1.5 rounded-full bg-border cursor-pointer" />
        {AGE_GROUPS.map((g, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(g.value)}
            className="absolute w-4 h-4 rounded-full -translate-x-1/2 flex items-center justify-center group"
            style={{ left: `calc(${(i / AGE_STOPS) * 100}% * (100% - 20px) / 100% + 10px)` }}
          >
            <span className={`w-2.5 h-2.5 rounded-full transition-all ${
              i === pinIdx ? "bg-primary scale-0" : "bg-border group-hover:bg-primary/40"
            }`} />
          </button>
        ))}
        {pinPct !== null && (
          <div
            className="absolute w-6 h-6 rounded-full border-2 border-primary bg-primary/10 shadow-md cursor-grab active:cursor-grabbing z-10 flex items-center justify-center hover:scale-110 transition-transform pointer-events-none"
            style={{ left: `calc(${pinPct}% * (100% - 20px) / 100%)` }}
          >
            <span className="w-2 h-2 rounded-full bg-primary" />
          </div>
        )}
      </div>
      <div className="relative h-4 px-2.5">
        {AGE_GROUPS.map((g, i) => (
          <span
            key={i}
            className={`absolute text-[10px] font-medium -translate-x-1/2 transition-colors ${
              i === pinIdx ? "text-primary" : "text-muted-foreground"
            }`}
            style={{ left: `calc(${(i / AGE_STOPS) * 100}% * (100% - 20px) / 100% + 10px)` }}
          >
            {g.short}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Public preview card (mini version of LanguageUserCard) ───────────────────
interface PreviewCardProps {
  displayName: string;
  avatarUrl: string;
  bio: string;
  city: string;
  ageGroup: string;
  native: string[];
  learning: LanguageEntry[];
  interests: string[];
  meetingTypes: string[];
}

function PublicPreviewCard(p: PreviewCardProps) {
  const hasContent = p.native.length > 0 || p.learning.length > 0 || p.bio;
  if (!hasContent) return null;

  return (
    <Card className="rounded-2xl border-primary/30 border-2 shadow-lg overflow-hidden">
      <div className="bg-primary/5 px-4 py-2.5 border-b border-border/50 flex items-center gap-2">
        <Eye className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-primary">How others see you</span>
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-11 w-11 shrink-0">
            <AvatarImage src={p.avatarUrl} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
              {(p.displayName || "?").substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{p.displayName || "Your name"}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 flex-wrap">
              {p.city && <><MapPin className="w-3 h-3 shrink-0" /><span>{p.city}</span><span className="mx-0.5">·</span></>}
              {p.ageGroup && <span>{p.ageGroup}</span>}
            </div>
          </div>
        </div>
        {p.bio && <p className="text-xs text-muted-foreground line-clamp-2">{p.bio}</p>}
        {p.native.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {p.native.map(code => {
              const lang = LANGUAGES.find(l => l.code === code);
              return (
                <span key={code} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {lang?.flag} {lang?.label}
                </span>
              );
            })}
            {p.learning.map(({ code, proficiency }) => {
              const lang = LANGUAGES.find(l => l.code === code);
              return (
                <span key={code} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border text-xs font-medium">
                  {lang?.flag} {lang?.label}
                  <span className={`ml-0.5 px-1 rounded text-[10px] font-bold ${PROFICIENCY_COLORS[proficiency] ?? ""}`}>
                    {proficiency}
                  </span>
                </span>
              );
            })}
          </div>
        )}
        {p.meetingTypes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {p.meetingTypes.map(t => {
              const mt = MEETING_TYPES.find(m => m.value === t);
              return <Badge key={t} variant="secondary" className="text-xs rounded-full">{mt?.emoji} {mt?.label}</Badge>;
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Section heading component ─────────────────────────────────────────────────
function SectionHeading({ icon: Icon, title, subtitle }: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-muted/30 px-5 py-3 sm:px-8 sm:py-4 border-b border-border/50 flex items-start gap-3">
      <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary mt-0.5 shrink-0" />
      <div>
        <h2 className="text-base sm:text-lg font-bold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Main Profile component ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export default function Profile() {
  const { user, isLoading } = useAuth();
  const queryClient         = useQueryClient();

  // ── State ──────────────────────────────────────────────────────────────────
  const [displayName,   setDisplayName]   = useState("");
  const [avatarUrl,     setAvatarUrl]     = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile,    setAvatarFile]    = useState<File | null>(null);
  const [avatarError,   setAvatarError]   = useState<string | null>(null);
  const [editingName,   setEditingName]   = useState(false);
  const [nameInput,     setNameInput]     = useState("");
  const [bio,           setBio]           = useState("");
  const [city,          setCity]          = useState("");
  const [languageStory, setLanguageStory] = useState("");  // Task 6

  const [interests,        setInterests]        = useState<string[]>([]);
  const [meetingTypes,     setMeetingTypes]      = useState<string[]>([]);
  const [nativeLanguage,   setNativeLanguage]    = useState<string>("");
  const [learningLanguages,setLearningLanguages] = useState<LanguageEntry[]>([]);

  const [myAgeGroup,      setMyAgeGroup]      = useState<string>("");
  const [preferredAgeMin, setPreferredAgeMin] = useState<number>(0);
  const [preferredAgeMax, setPreferredAgeMax] = useState<number>(3);

  const [metroStation,        setMetroStation]        = useState<string>("");
  const [stationSearch,       setStationSearch]       = useState<string>("");
  const [stationDropdownOpen, setStationDropdownOpen] = useState(false);

  const [slots,       setSlots]       = useState<Slot[]>([]);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [dragMode,    setDragMode]    = useState<"add" | "remove">("add");

  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showPreview,     setShowPreview]     = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const stationRef   = useRef<HTMLDivElement>(null);

  // ── Load data ──────────────────────────────────────────────────────────────
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
      .then((data: {
        nativeLanguage?:    string;
        learningLanguages?: LanguageEntry[];
        metroStation?:      string;
        myAgeGroup?:        string;
        preferredAgeMin?:   number;
        preferredAgeMax?:   number;
        bio?:               string;
        city?:              string;
        meetingTypes?:      string[];
        languageStory?:     string;     // Task 6
      }) => {
        if (data.nativeLanguage)              setNativeLanguage(data.nativeLanguage);
        if (data.learningLanguages)           setLearningLanguages(data.learningLanguages);
        if (data.metroStation)                setMetroStation(data.metroStation);
        if (data.myAgeGroup)                  setMyAgeGroup(data.myAgeGroup);
        if (data.preferredAgeMin != null)     setPreferredAgeMin(data.preferredAgeMin);
        if (data.preferredAgeMax != null)     setPreferredAgeMax(data.preferredAgeMax);
        if (data.bio)                         setBio(data.bio);
        if (data.city)                        setCity(data.city);
        if (data.meetingTypes)                setMeetingTypes(data.meetingTypes);
        if (data.languageStory)               setLanguageStory(data.languageStory);  // Task 6
      })
      .catch(() => {});
  }, [user]);

  // Close station dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (stationRef.current && !stationRef.current.contains(e.target as Node))
        setStationDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Completeness ───────────────────────────────────────────────────────────
  const profileData: ProfileData = {
    displayName,
    avatarUrl: avatarPreview ?? avatarUrl,
    bio,
    city,
    nativeLanguage,
    learningLanguages,
    interests,
    meetingTypes,
    myAgeGroup,
    metroStation,
    slots,
  };
  const { score: completeness, missing } = computeCompleteness(profileData);

  // ── Interest toggle ────────────────────────────────────────────────────────
  const toggleInterest = (value: string) =>
    setInterests(prev => prev.includes(value) ? prev.filter(i => i !== value) : [...prev, value]);

  const toggleMeetingType = (value: string) =>
    setMeetingTypes(prev => prev.includes(value) ? prev.filter(i => i !== value) : [...prev, value]);

  // ── Availability grid ──────────────────────────────────────────────────────
  const isSlotActive = (day: number, hour: number) =>
    slots.some(s => s.day === day && s.hour === hour);

  const handleSlotMouseDown = (day: number, hour: number) => {
    setIsMouseDown(true);
    const active = isSlotActive(day, hour);
    setDragMode(active ? "remove" : "add");
    setSlots(prev =>
      active ? prev.filter(s => !(s.day === day && s.hour === hour))
             : [...prev, { day, hour }]
    );
  };

  const handleSlotMouseEnter = (day: number, hour: number) => {
    if (!isMouseDown) return;
    setSlots(prev => {
      if (dragMode === "add") {
        if (prev.some(s => s.day === day && s.hour === hour)) return prev;
        return [...prev, { day, hour }];
      } else {
        return prev.filter(s => !(s.day === day && s.hour === hour));
      }
    });
  };

  // ── Learning languages helpers ─────────────────────────────────────────────
  const addLearningLanguage = () => {
    if (learningLanguages.length >= 3) return;
    const used = new Set([nativeLanguage, ...learningLanguages.map(l => l.code)]);
    const next  = LANGUAGES.find(l => !used.has(l.code));
    if (!next) return;
    setLearningLanguages(prev => [...prev, { code: next.code, proficiency: "A1" }]);
  };

  const updateLearningLanguage = (idx: number, field: "code" | "proficiency", val: string) =>
    setLearningLanguages(prev => prev.map((e, i) =>
      i === idx ? { ...e, [field]: val } : e
    ));

  const removeLearningLanguage = (idx: number) =>
    setLearningLanguages(prev => prev.filter((_, i) => i !== idx));

  // ── Metro station ──────────────────────────────────────────────────────────
  const filteredStations = stationSearch.trim().length > 0
    ? ALL_STATIONS.filter(s =>
        s.station.toLowerCase().includes(stationSearch.toLowerCase())
      ).slice(0, 12)
    : [];

  // ── Avatar ────────────────────────────────────────────────────────────────
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setAvatarError("Image must be under 5 MB"); return; }
    setAvatarError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const cancelAvatarChange = () => {
    setAvatarFile(null); setAvatarPreview(null); setAvatarError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Save ──────────────────────────────────────────────────────────────────
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
        } catch (err: unknown) {
          setAvatarError((err as Error).message ?? "Upload failed");
          setSaving(false); setUploadingAvatar(false);
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
            avatarUrl:   finalAvatarUrl || undefined,
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
            myAgeGroup:        myAgeGroup        || undefined,
            preferredAgeMin,
            preferredAgeMax,
            bio:               bio.trim()          || undefined,
            city:              city.trim()          || undefined,
            meetingTypes:      meetingTypes.length ? meetingTypes : undefined,
            languageStory:     languageStory.trim().slice(0, 140) || undefined,  // Task 6
          }),
        }),
      ]);

      queryClient.invalidateQueries({ queryKey: ["auth-user"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      console.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  // ── Guards ────────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading profile…</div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground">Sign in to view your profile.</p>
      <Button onClick={() => window.location.href = `${AUTH_URL}/login?returnTo=${window.location.href}`}>
        Sign In
      </Button>
    </div>
  );

  const initials      = (displayName || user.username || "U").substring(0, 2).toUpperCase();
  const currentAvatar = avatarPreview ?? avatarUrl;
  const nativeLang    = LANGUAGES.find(l => l.code === nativeLanguage);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-muted/20 pb-12"
      onMouseUp={() => setIsMouseDown(false)}
      onMouseLeave={() => setIsMouseDown(false)}
    >
      {/* ── Hero banner ── */}
      <div className="relative h-32 sm:h-44 bg-gradient-to-br from-primary/30 via-primary/10 to-background">
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6">

        {/* ── Identity row (overlaps banner) ── */}
        <div className="-mt-14 sm:-mt-16 mb-6 flex items-end gap-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            <Avatar className="h-24 w-24 sm:h-28 sm:w-28 ring-4 ring-background shadow-xl">
              <AvatarImage src={currentAvatar} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl sm:text-3xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
              title="Change photo"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden" onChange={handleAvatarChange} />
          </div>

          {/* Name + badges */}
          <div className="flex-1 min-w-0 pb-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  className="h-9 rounded-xl text-base font-bold max-w-xs"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === "Enter")  { setDisplayName(nameInput); setEditingName(false); }
                    if (e.key === "Escape") { setNameInput(displayName); setEditingName(false); }
                  }}
                />
                <button onClick={() => { setDisplayName(nameInput); setEditingName(false); }} className="text-primary">
                  <Check className="w-5 h-5" />
                </button>
                <button onClick={() => { setNameInput(displayName); setEditingName(false); }} className="text-muted-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold truncate drop-shadow-sm">{displayName || user.username}</h1>
                <button onClick={() => setEditingName(true)} className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
            {user.email && <p className="text-xs text-muted-foreground break-all mt-0.5">{user.email}</p>}
            <div className="flex gap-1.5 flex-wrap mt-1">
              {user.isExpatMember  && <Badge variant="secondary" className="text-xs">ExpatEvents</Badge>}
              {user.isGamesMember  && <Badge variant="secondary" className="text-xs">Games in English</Badge>}
              {user.role === "admin" && <Badge className="text-xs">Admin</Badge>}
            </div>
          </div>
        </div>

        {/* Avatar feedback */}
        {(avatarPreview || avatarError) && (
          <div className="mb-4 px-4 py-2.5 bg-muted/60 rounded-xl flex items-center gap-3 text-sm">
            {avatarPreview && <>
              <span className="text-muted-foreground flex-1">New photo selected — save to apply</span>
              <button onClick={cancelAvatarChange} className="text-destructive text-xs hover:underline shrink-0">Cancel</button>
            </>}
            {avatarError && <span className="text-destructive">{avatarError}</span>}
          </div>
        )}

        {/* ── Completeness bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-background rounded-2xl border border-border/60 shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Profile completeness</span>
            <span className={`text-sm font-bold ${completeness >= 80 ? "text-emerald-600" : completeness >= 50 ? "text-amber-500" : "text-muted-foreground"}`}>
              {completeness}%
            </span>
          </div>
          <Progress value={completeness} className="h-2" />
          {missing.length > 0 && completeness < 100 && (
            <p className="text-xs text-muted-foreground mt-2">
              Still missing: {missing.slice(0, 3).join(" · ")}{missing.length > 3 ? ` +${missing.length - 3} more` : ""}
            </p>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

          {/* ── Bio & Location ── */}
          <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
            <SectionHeading icon={User} title="About You" subtitle="This is the first thing people read on your language exchange card" />
            <CardContent className="p-5 sm:p-6 space-y-4">
              {/* Task 7 — Bio empty nudge */}
              {bio.trim().length < 20 && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  <span className="shrink-0">✏️</span>
                  <span>Add a bio — partners are 3× more likely to respond when they can read about you.</span>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Bio</Label>
                <Textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell people a bit about yourself — where you're from, what you do, what you enjoy talking about…"
                  className="rounded-xl min-h-[88px] resize-none text-sm"
                  maxLength={280}
                />
                <div className="flex justify-end">
                  <span className={`text-xs ${bio.length > 240 ? "text-amber-500" : "text-muted-foreground"}`}>
                    {bio.length}/280
                  </span>
                </div>
              </div>

              {/* Task 6 — Language Story field */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  🌱 Language Story
                  <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  value={languageStory}
                  onChange={e => setLanguageStory(e.target.value.slice(0, 140))}
                  placeholder="How did you start learning your target language? (up to 140 chars)"
                  className="rounded-xl min-h-[64px] resize-none text-sm"
                  maxLength={140}
                />
                <div className="flex items-center justify-between">
                  {languageStory.trim().length === 0
                    ? <span className="text-xs text-muted-foreground/70 italic">Add your language story →</span>
                    : <span />}
                  <span className={`text-xs ${languageStory.length > 120 ? "text-amber-500" : "text-muted-foreground"}`}>
                    {languageStory.length}/140
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> City
                  </Label>
                  <Input
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="e.g. Moscow, Dubai, London…"
                    className="rounded-xl h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5" ref={stationRef}>
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <span className="text-muted-foreground text-xs font-bold">М</span> Moscow Metro
                  </Label>
                  <div className="relative">
                    <Input
                      value={metroStation ? metroStation : stationSearch}
                      onChange={e => {
                        if (metroStation) { setMetroStation(""); setStationSearch(e.target.value); }
                        else setStationSearch(e.target.value);
                        setStationDropdownOpen(true);
                      }}
                      onFocus={() => setStationDropdownOpen(true)}
                      placeholder="Search station…"
                      className="rounded-xl h-9 text-sm pr-8"
                    />
                    {metroStation && (
                      <button
                        type="button"
                        onClick={() => { setMetroStation(""); setStationSearch(""); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {/* Line badge */}
                    {metroStation && (() => {
                      const s = ALL_STATIONS.find(x => x.station === metroStation);
                      return s ? (
                        <span className="absolute left-2 -bottom-5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ background: s.color }}>
                          {s.line.split("—")[0].trim()}
                        </span>
                      ) : null;
                    })()}
                    {stationDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-border bg-background shadow-xl">
                        {stationSearch.trim().length > 0 ? (
                          filteredStations.length > 0
                            ? filteredStations.map(({ station, line, color }) => (
                              <button
                                key={station + line}
                                type="button"
                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/60 flex items-center gap-3 transition-colors"
                                onMouseDown={() => { setMetroStation(station); setStationSearch(""); setStationDropdownOpen(false); }}
                              >
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                                <span className="flex-1 font-medium">{station}</span>
                                <span className="text-xs text-muted-foreground truncate max-w-[120px]">{line}</span>
                              </button>
                            ))
                            : <p className="px-4 py-3 text-sm text-muted-foreground">No stations found</p>
                        ) : (
                          METRO_LINES.map(lineGroup => (
                            <div key={lineGroup.line}>
                              <div className="px-4 py-1.5 text-xs font-semibold sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border/30 flex items-center gap-2" style={{ color: lineGroup.color }}>
                                <span className="w-2 h-2 rounded-full" style={{ background: lineGroup.color }} />
                                {lineGroup.line}
                              </div>
                              {lineGroup.stations.map(station => (
                                <button
                                  key={station}
                                  type="button"
                                  className={`w-full text-left px-4 py-2 text-sm hover:bg-muted/60 flex items-center gap-3 transition-colors ${metroStation === station ? "bg-primary/10 text-primary font-medium" : ""}`}
                                  onMouseDown={() => { setMetroStation(station); setStationSearch(""); setStationDropdownOpen(false); }}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0 opacity-60" style={{ background: lineGroup.color }} />
                                  {station}
                                </button>
                              ))}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Languages ── */}
          <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
            <SectionHeading icon={Languages} title="Languages" subtitle="Native speakers and learners are matched together" />
            <CardContent className="p-5 sm:p-6 space-y-5">

              {/* Native */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Native language</Label>
                <div className="relative">
                  <select
                    value={nativeLanguage}
                    onChange={e => {
                      const val = e.target.value;
                      setNativeLanguage(val);
                      setLearningLanguages(prev => prev.filter(l => l.code !== val));
                    }}
                    className="w-full h-9 rounded-xl border border-border bg-background px-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">— Select your native language —</option>
                    {LANGUAGES.map(l => (
                      <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">▾</div>
                </div>
                {nativeLang && (
                  <p className="text-xs text-muted-foreground pl-1">
                    You appear as a native <strong>{nativeLang.label}</strong> speaker to learners
                  </p>
                )}
              </div>

              <div className="border-t border-border/40" />

              {/* Learning */}
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
                      <Plus className="w-3.5 h-3.5" /> Add language
                    </button>
                  )}
                </div>
                {!nativeLanguage && (
                  <p className="text-sm text-muted-foreground italic">Select your native language first</p>
                )}
                {learningLanguages.length === 0 && nativeLanguage && (
                  <p className="text-sm text-muted-foreground italic">No languages added yet</p>
                )}
                <div className="space-y-2.5">
                  {learningLanguages.map((entry, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 rounded-xl border border-border/60 bg-muted/20"
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
                            <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
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
                      <span className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 ${PROFICIENCY_COLORS[entry.proficiency]}`}>
                        {entry.proficiency}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLearningLanguage(idx)}
                        className="self-end sm:self-center p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Meeting style & Age ── */}
          <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
            <SectionHeading icon={Users} title="Meeting Style & Age" subtitle="Helps us suggest the right partners and events" />
            <CardContent className="p-5 sm:p-6 space-y-6">

              {/* Meeting style toggle chips */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">How do you like to meet?</Label>
                <div className="flex flex-wrap gap-2">
                  {MEETING_TYPES.map(mt => {
                    const active = meetingTypes.includes(mt.value);
                    return (
                      <button
                        key={mt.value}
                        type="button"
                        onClick={() => toggleMeetingType(mt.value)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        <span>{mt.emoji}</span> {mt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-border/40" />

              {/* Age sliders */}
              <AgeGroupPin value={myAgeGroup} onChange={setMyAgeGroup} />
              {myAgeGroup && (
                <p className="text-xs text-muted-foreground -mt-3 pl-1">
                  You're in the <strong>{AGE_GROUPS.find(a => a.value === myAgeGroup)?.label}</strong> group
                </p>
              )}
              <AgeRangeSlider
                label="Preferred partner age range"
                minIdx={preferredAgeMin}
                maxIdx={preferredAgeMax}
                onChange={(min, max) => { setPreferredAgeMin(min); setPreferredAgeMax(max); }}
              />
            </CardContent>
          </Card>

          {/* ── Interests ── */}
          <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
            <SectionHeading
              icon={Bell}
              title="Interests"
              subtitle="Choose topics — you'll get notified about matching events"
            />
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-wrap gap-2">
                {EVENT_CATEGORIES.map(cat => {
                  const active = interests.includes(cat.value);
                  return (
                    <button
                      key={cat.value}
                      onClick={() => toggleInterest(cat.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs sm:text-sm font-medium transition-all ${
                        active
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                      }`}
                    >
                      <span style={{ fontSize: 13 }}>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
                {/* Language exchange as a special interest */}
                <button
                  onClick={() => toggleInterest("language_exchange")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs sm:text-sm font-medium transition-all ${
                    interests.includes("language_exchange")
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                  }`}
                >
                  <span style={{ fontSize: 13 }}>🗣️</span>
                  <span>Language Exchange</span>
                </button>
              </div>
              {interests.length === 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  Select at least one interest to receive targeted notifications.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── Availability ── */}
          <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
            <SectionHeading icon={Calendar} title="Weekly Availability" subtitle="Click or drag to mark when you're free to meet" />
            <CardContent className="p-4 sm:p-6 overflow-x-auto">
              {/* Task 7 — availability nudge */}
              {slots.length === 0 && (
                <div className="flex items-start gap-2 rounded-xl bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-800 mb-3">
                  <span className="shrink-0">⏰</span>
                  <span>Set your availability to get more relevant sparks — partners can see when you're free before reaching out.</span>
                </div>
              )}
              <div className="min-w-[520px]">
                <div className="grid grid-cols-8 gap-1 mb-1">
                  <div />
                  {DAYS.map(d => (
                    <div key={d} className="text-xs font-medium text-center text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
                {HOURS.map(hour => (
                  <div key={hour} className="grid grid-cols-8 gap-1 mb-0.5">
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
                          className={`h-6 rounded cursor-pointer select-none transition-colors ${
                            active
                              ? "bg-primary/80 hover:bg-primary"
                              : "bg-muted hover:bg-primary/20 border border-border"
                          }`}
                        />
                      );
                    })}
                  </div>
                ))}
                <p className="text-xs text-muted-foreground mt-2">
                  {slots.length} slot{slots.length !== 1 ? "s" : ""} selected
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ── Telegram ── */}
          {!isTelegramMiniApp() && (
            <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
              <SectionHeading icon={Bell} title="Telegram Notifications" subtitle="Get event alerts and RSVP updates directly in Telegram" />
              <CardContent className="p-5 sm:p-6">
                <TelegramConnect
                  connected={!!user.telegramId}
                  onUnlinked={() => queryClient.invalidateQueries({ queryKey: ["auth-user"] })}
                />
              </CardContent>
            </Card>
          )}

          {/* ── Public preview toggle ── */}
          <button
            type="button"
            onClick={() => setShowPreview(o => !o)}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <Eye className="w-4 h-4" />
            {showPreview ? "Hide preview" : "Preview my Language Exchange card"}
          </button>

          <AnimatePresence>
            {showPreview && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <PublicPreviewCard
                  displayName={displayName}
                  avatarUrl={currentAvatar}
                  bio={bio}
                  city={city}
                  ageGroup={myAgeGroup}
                  native={nativeLanguage ? [nativeLanguage] : []}
                  learning={learningLanguages}
                  interests={interests}
                  meetingTypes={meetingTypes}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Save ── */}
          <Button
            onClick={saveAll}
            disabled={saving || uploadingAvatar}
            className="w-full h-12 sm:h-14 text-base font-semibold rounded-2xl shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
          >
            {uploadingAvatar ? "Uploading photo…" : saving ? "Saving…" : saved ? "✓ Saved!" : "Save Profile"}
          </Button>

        </motion.div>
      </div>
    </div>
  );
}
