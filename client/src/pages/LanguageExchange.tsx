// client/src/pages/LanguageExchange.tsx
// Replaced mock data with live API data from meh-auth GET /api/language-exchange/users.
// City filter now derived dynamically from actual user data.
// "Connect" button wires to Telegram DM or falls back to copy username.
// AgeRangeSlider deduplicated — same implementation kept locally (shared component
// extraction tracked as a follow-up).

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Languages, Users, User, CalendarDays, MapPin, Filter, X, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LANGUAGES, EVENT_CATEGORIES } from "@/lib/constants";
import LanguageUserCard from "@/components/language/LanguageUserCard";
import MomentsSection  from "@/components/language/MomentsSection";   // Task 11
import { useAuth } from "@/hooks/use-auth";

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "https://auth.expatevents.org";

// ── Types ─────────────────────────────────────────────────────────────────────

type AgeGroup    = "18-25" | "26-35" | "36-45" | "46+";
type MeetingType = "1on1" | "small_group" | "social";
type ProficiencyLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface LearningLanguage { code: string; proficiency: ProficiencyLevel; }
export interface LanguageUser {
  id:            string | number;
  full_name:     string;
  avatar_url:    string;
  city:          string;
  age_group:     AgeGroup | string;
  native:        string[];
  learning:      LearningLanguage[];
  interests:     string[];
  meeting_types: MeetingType[] | string[];
  bio:           string;
  telegram_username?: string | null;
  language_story?:   string | null;
  last_seen_at?:     string | null;   // Task 4 – sorting + stale badge
  is_event_regular?: boolean;
}

interface Filters {
  language:     string;
  city:         string;
  ageMin:       number;   // index 0–3 into AGE_GROUPS
  ageMax:       number;
  interest:     string;
  meeting_type: MeetingType | "all";
}

interface ApiResponse {
  data:   LanguageUser[];
  total:  number;
  limit:  number;
  offset: number;
}

// ── Age group constants ───────────────────────────────────────────────────────

const AGE_GROUPS: { value: AgeGroup; label: string; short: string }[] = [
  { value: "18-25", label: "18 – 25", short: "18" },
  { value: "26-35", label: "26 – 35", short: "26" },
  { value: "36-45", label: "36 – 45", short: "36" },
  { value: "46+",   label: "46 +",    short: "46+" },
];

// ── Meeting types ─────────────────────────────────────────────────────────────

const MEETING_TYPES: { value: MeetingType; label: string; icon: React.ElementType }[] = [
  { value: "1on1",        label: "1 on 1",      icon: User },
  { value: "small_group", label: "Small Group",  icon: Users },
  { value: "social",      label: "Social Event", icon: CalendarDays },
];

const INTEREST_CATEGORIES = EVENT_CATEGORIES.filter(c => c.value !== "language");

// ── Dual-handle discrete age range slider ────────────────────────────────────

interface AgeRangeSliderProps {
  minIdx: number;
  maxIdx: number;
  onChange: (minIdx: number, maxIdx: number) => void;
}

function AgeRangeSlider({ minIdx, maxIdx, onChange }: AgeRangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"min" | "max" | null>(null);
  const STOPS    = AGE_GROUPS.length - 1; // 3

  const xToIdx = useCallback((clientX: number): number => {
    if (!trackRef.current) return 0;
    const { left, width } = trackRef.current.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(1, (clientX - left) / width)) * STOPS);
  }, [STOPS]);

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

  const minPct      = (minIdx / STOPS) * 100;
  const maxPct      = (maxIdx / STOPS) * 100;
  const isFullRange = minIdx === 0 && maxIdx === STOPS;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Age range</span>
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full transition-all ${
          isFullRange ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
        }`}>
          {isFullRange ? "Any age" : `${AGE_GROUPS[minIdx].label} – ${AGE_GROUPS[maxIdx].label}`}
        </span>
      </div>
      <div
        ref={trackRef}
        className="relative h-6 flex items-center select-none"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-border" />
        <div
          className="absolute h-1.5 rounded-full bg-primary transition-all"
          style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
        />
        {AGE_GROUPS.map((_, i) => (
          <div key={i} className="absolute w-1 h-1 rounded-full bg-border -translate-x-0.5"
            style={{ left: `${(i / STOPS) * 100}%` }} />
        ))}
        <div
          className={`absolute w-5 h-5 rounded-full border-2 border-primary bg-background shadow-md cursor-grab active:cursor-grabbing -translate-x-1/2 transition-transform hover:scale-110 z-10 ${minIdx === maxIdx ? "z-20" : ""}`}
          style={{ left: `${minPct}%` }}
          onPointerDown={onPointerDown("min")}
        />
        <div
          className="absolute w-5 h-5 rounded-full border-2 border-primary bg-background shadow-md cursor-grab active:cursor-grabbing -translate-x-1/2 transition-transform hover:scale-110 z-10"
          style={{ left: `${maxPct}%` }}
          onPointerDown={onPointerDown("max")}
        />
      </div>
      <div className="relative h-4">
        {AGE_GROUPS.map((g, i) => (
          <span
            key={i}
            className={`absolute text-[10px] -translate-x-1/2 font-medium transition-colors ${
              i >= minIdx && i <= maxIdx ? "text-primary" : "text-muted-foreground"
            }`}
            style={{ left: `${(i / STOPS) * 100}%` }}
          >
            {g.short}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LanguageExchange() {
  const [filters, setFilters] = useState<Filters>({
    language:     "all",
    city:         "all",
    ageMin:       0,
    ageMax:       3,
    interest:     "all",
    meeting_type: "all",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const setFilter = <K extends keyof Filters>(key: K, val: Filters[K]) =>
    setFilters(f => ({ ...f, [key]: val }));

  const clearFilters = () =>
    setFilters({ language: "all", city: "all", ageMin: 0, ageMax: 3, interest: "all", meeting_type: "all" });

  // ── Live data fetch ─────────────────────────────────────────────────────────
  const { data: apiData, isLoading, isError, refetch } = useQuery<ApiResponse>({
    queryKey: ["language-exchange-users"],
    queryFn: async () => {
      const res = await fetch(`${AUTH_URL}/api/language-exchange/users?limit=200`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load partners");
      return res.json() as Promise<ApiResponse>;
    },
    staleTime: 1000 * 60 * 5, // 5 min cache
  });

  const { user: currentUser } = useAuth();
  const allUsers: LanguageUser[] = apiData?.data ?? [];

  // ── Dynamic city list from actual data ────────────────────────────────────
  const cities = useMemo(() => {
    const set = new Set<string>();
    allUsers.forEach(u => { if (u.city) set.add(u.city); });
    return [...set].sort();
  }, [allUsers]);

  // ── Client-side filtering ─────────────────────────────────────────────────
  // The API does server-side filtering too, but we pass all 200 records and
  // filter client-side for instant UX without a new network request per filter change.
  const filtered = useMemo<LanguageUser[]>(() => allUsers.filter(u => {
    if (filters.language !== "all") {
      const allLangs = [...u.native, ...u.learning.map(l => l.code)];
      if (!allLangs.includes(filters.language)) return false;
    }
    if (filters.city !== "all" && u.city !== filters.city) return false;

    const userAgeIdx = AGE_GROUPS.findIndex(a => a.value === u.age_group);
    if (userAgeIdx >= 0 && (userAgeIdx < filters.ageMin || userAgeIdx > filters.ageMax)) return false;

    if (filters.interest !== "all" && !u.interests.includes(filters.interest)) return false;
    if (filters.meeting_type !== "all" && !u.meeting_types.includes(filters.meeting_type)) return false;
    return true;
  }), [allUsers, filters]);

  // Task 4: Sort — mutual language overlap first, then by last_seen_at descending.
  // A user has mutual overlap if: I speak what they learn OR they speak what I learn.
  const sorted = [...filtered].sort((a, b) => {
    const myNative   = currentUser?.nativeLanguage ? [currentUser.nativeLanguage] : [];
    const myLearning = (currentUser?.learningLanguages ?? []).map((l: any) => l.code);
    const overlap = (u: LanguageUser) =>
      myNative.some(c  => u.learning.map(l => l.code).includes(c)) ||
      u.native.some(c  => myLearning.includes(c));
    const aOverlap = overlap(a) ? 1 : 0;
    const bOverlap = overlap(b) ? 1 : 0;
    if (bOverlap !== aOverlap) return bOverlap - aOverlap;
    // Then by last_seen_at descending (most recent first)
    const aTime = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
    const bTime = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
    return bTime - aTime;
  });

  const activeCount =
    (filters.language     !== "all" ? 1 : 0) +
    (filters.city         !== "all" ? 1 : 0) +
    (filters.ageMin !== 0 || filters.ageMax !== 3 ? 1 : 0) +
    (filters.interest     !== "all" ? 1 : 0) +
    (filters.meeting_type !== "all" ? 1 : 0);

  const isFullAgeRange = filters.ageMin === 0 && filters.ageMax === 3;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Languages className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">Language Exchange</h1>
        </div>
        <p className="text-muted-foreground">
          Find your perfect language partner — filter by language, city, age group, interests and meeting style.
        </p>
      </div>

      {/* Meeting-type quick filters + filter toggle */}
      <div className="flex flex-wrap gap-2 mb-6">
        {MEETING_TYPES.map(mt => {
          const Icon   = mt.icon;
          const active = filters.meeting_type === mt.value;
          return (
            <button
              key={mt.value}
              onClick={() => setFilter("meeting_type", active ? "all" : mt.value)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {mt.label}
            </button>
          );
        })}
        <button
          onClick={() => setFiltersOpen(o => !o)}
          className={`ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
            filtersOpen || activeCount > 0
              ? "bg-primary/10 border-primary text-primary"
              : "bg-background border-border text-muted-foreground hover:border-primary/40"
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Expanded filter panel */}
      <AnimatePresence>
        {filtersOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-6 p-4 sm:p-5 bg-muted/40 rounded-2xl border border-border space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* Language */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Language</p>
                  <Select value={filters.language} onValueChange={v => setFilter("language", v)}>
                    <SelectTrigger className="h-9 bg-background text-sm"><SelectValue placeholder="Any" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any language</SelectItem>
                      {LANGUAGES.map(l => (
                        <SelectItem key={l.code} value={l.code}>{l.flag} {l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* City — derived from live data */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">City</p>
                  <Select value={filters.city} onValueChange={v => setFilter("city", v)}>
                    <SelectTrigger className="h-9 bg-background text-sm"><SelectValue placeholder="Any" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any city</SelectItem>
                      {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* Interest */}
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Interest</p>
                  <Select value={filters.interest} onValueChange={v => setFilter("interest", v)}>
                    <SelectTrigger className="h-9 bg-background text-sm"><SelectValue placeholder="Any" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any interest</SelectItem>
                      {INTEREST_CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Age range slider */}
              <div className="px-1">
                <AgeRangeSlider
                  minIdx={filters.ageMin}
                  maxIdx={filters.ageMax}
                  onChange={(min, max) => setFilters(f => ({ ...f, ageMin: min, ageMax: max }))}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active filter chips */}
      {activeCount > 0 && (
        <div className="flex flex-wrap gap-2 mb-5 items-center">
          <span className="text-xs text-muted-foreground">Active filters:</span>
          {filters.language !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {LANGUAGES.find(l => l.code === filters.language)?.flag}{" "}
              {LANGUAGES.find(l => l.code === filters.language)?.label}
              <button onClick={() => setFilter("language", "all")}><X className="w-3 h-3" /></button>
            </Badge>
          )}
          {filters.city !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1">
              <MapPin className="w-3 h-3" />{filters.city}
              <button onClick={() => setFilter("city", "all")}><X className="w-3 h-3" /></button>
            </Badge>
          )}
          {!isFullAgeRange && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {AGE_GROUPS[filters.ageMin].label} – {AGE_GROUPS[filters.ageMax].label}
              <button onClick={() => setFilters(f => ({ ...f, ageMin: 0, ageMax: 3 }))}><X className="w-3 h-3" /></button>
            </Badge>
          )}
          {filters.interest !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {EVENT_CATEGORIES.find(c => c.value === filters.interest)?.icon}{" "}
              {EVENT_CATEGORIES.find(c => c.value === filters.interest)?.label}
              <button onClick={() => setFilter("interest", "all")}><X className="w-3 h-3" /></button>
            </Badge>
          )}
          {filters.meeting_type !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {MEETING_TYPES.find(m => m.value === filters.meeting_type)?.label}
              <button onClick={() => setFilter("meeting_type", "all")}><X className="w-3 h-3" /></button>
            </Badge>
          )}
          <button onClick={clearFilters} className="text-xs text-destructive hover:underline ml-1">
            Clear all
          </button>
        </div>
      )}

      {/* Moments feed (Task 11) — shown above the partner grid */}
      <div className="mb-8">
        <MomentsSection />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div className="text-center py-16">
          <Languages className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Couldn't load partners right now.</p>
          <Button variant="outline" className="rounded-full gap-2" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" /> Try again
          </Button>
        </div>
      )}

      {/* Results */}
      {!isLoading && !isError && (
        <>
          {/* Results count */}
          <p className="text-sm text-muted-foreground mb-4">
            {filtered.length} partner{filtered.length !== 1 ? "s" : ""} found
            {allUsers.length > 0 && filters.language === "all" && filters.city === "all" &&
              filters.interest === "all" && filters.meeting_type === "all" &&
              filters.ageMin === 0 && filters.ageMax === 3 &&
              <span className="ml-1 text-muted-foreground/60">· {allUsers.length} members total</span>
            }
          </p>

          {/* Empty state */}
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Languages className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
              {allUsers.length === 0 ? (
                <>
                  <p className="text-muted-foreground font-medium">No members have set up their language profile yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">Be the first — update your profile to appear here.</p>
                  <Button variant="outline" className="mt-4 rounded-full" onClick={() => window.location.href = "/profile"}>
                    Complete my profile
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground">No partners match your filters.</p>
                  <Button variant="outline" className="mt-4 rounded-full" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {sorted.map((u, i) => (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.3) }}
                  >
                    <LanguageUserCard person={u} currentUser={currentUser} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  );
}
