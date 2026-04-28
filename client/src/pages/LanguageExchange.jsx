//LanguageExchange.jsx
import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Languages, Users, User, CalendarDays, MapPin, Filter, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LANGUAGES, PROFICIENCY_LEVELS, CITIES, EVENT_CATEGORIES } from "@/lib/constants";
import LanguageUserCard from "@/components/language/LanguageUserCard";

const AGE_GROUPS = [
  { value: "18-25", label: "18 – 25" },
  { value: "26-35", label: "26 – 35" },
  { value: "36-45", label: "36 – 45" },
  { value: "46+",   label: "46 +" },
];

const MEETING_TYPES = [
  { value: "1on1",        label: "1 on 1",      icon: User },
  { value: "small_group", label: "Small Group",  icon: Users },
  { value: "social",      label: "Social Event", icon: CalendarDays },
];

const INTEREST_CATEGORIES = EVENT_CATEGORIES.filter(c => c.value !== "language");

// Mock users – in a real app these would come from an entity/API
const MOCK_USERS = [
  { id: "1", full_name: "Anna K.", avatar_url: "https://i.pravatar.cc/150?img=47", city: "Moscow", age_group: "26-35", native: ["ru"], learning: [{ code: "en", proficiency: "B2" }, { code: "de", proficiency: "A2" }], interests: ["culture", "music", "wellness"], meeting_types: ["1on1", "small_group"], bio: "Love discussing books, films and culture." },
  { id: "2", full_name: "James T.", avatar_url: "https://i.pravatar.cc/150?img=11", city: "London", age_group: "26-35", native: ["en"], learning: [{ code: "ru", proficiency: "B1" }, { code: "es", proficiency: "A1" }], interests: ["tech", "outdoor", "games"], meeting_types: ["1on1", "social"], bio: "Software dev learning Russian for travel." },
  { id: "3", full_name: "Mei Lin", avatar_url: "https://i.pravatar.cc/150?img=32", city: "Singapore", age_group: "18-25", native: ["zh"], learning: [{ code: "en", proficiency: "C1" }, { code: "fr", proficiency: "B1" }], interests: ["food", "culture", "business"], meeting_types: ["small_group", "social"], bio: "Foodie and language nerd based in Singapore." },
  { id: "4", full_name: "Carlos M.", avatar_url: "https://i.pravatar.cc/150?img=15", city: "New York", age_group: "36-45", native: ["es", "pt"], learning: [{ code: "en", proficiency: "C2" }, { code: "ja", proficiency: "A2" }], interests: ["music", "sports", "networking"], meeting_types: ["1on1"], bio: "Musician open to tandem practice." },
  { id: "5", full_name: "Yuki S.", avatar_url: "https://i.pravatar.cc/150?img=44", city: "Dubai", age_group: "18-25", native: ["ja"], learning: [{ code: "en", proficiency: "B2" }, { code: "ar", proficiency: "A1" }], interests: ["wellness", "outdoor", "culture"], meeting_types: ["1on1", "small_group", "social"], bio: "Yoga teacher exploring Arabic and English." },
  { id: "6", full_name: "Fatima R.", avatar_url: "https://i.pravatar.cc/150?img=25", city: "Dubai", age_group: "26-35", native: ["ar"], learning: [{ code: "en", proficiency: "C1" }, { code: "fr", proficiency: "B2" }], interests: ["business", "networking", "family"], meeting_types: ["small_group", "social"], bio: "Finance professional and trilingual parent." },
  { id: "7", full_name: "Lucas B.", avatar_url: "https://i.pravatar.cc/150?img=52", city: "Sydney", age_group: "36-45", native: ["fr"], learning: [{ code: "en", proficiency: "C2" }, { code: "zh", proficiency: "A2" }], interests: ["food", "outdoor", "games"], meeting_types: ["social", "small_group"], bio: "Chef and avid hiker who loves to connect." },
  { id: "8", full_name: "Elena V.", avatar_url: "https://i.pravatar.cc/150?img=23", city: "Moscow", age_group: "46+", native: ["ru", "uk"], learning: [{ code: "en", proficiency: "B1" }, { code: "de", proficiency: "A2" }], interests: ["culture", "volunteering", "wellness"], meeting_types: ["1on1"], bio: "Retired teacher, loves classical music and art." },
  { id: "9", full_name: "Priya N.", avatar_url: "https://i.pravatar.cc/150?img=40", city: "Singapore", age_group: "26-35", native: ["hi", "en"], learning: [{ code: "ja", proficiency: "B1" }, { code: "de", proficiency: "A1" }], interests: ["tech", "business", "music"], meeting_types: ["1on1", "social"], bio: "Product manager by day, language learner by night." },
];

export default function LanguageExchange() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    language: "all",
    city: "all",
    age_group: "all",
    interest: "all",
    meeting_type: "all",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));

  const clearFilters = () => setFilters({ language: "all", city: "all", age_group: "all", interest: "all", meeting_type: "all" });

  const activeCount = Object.values(filters).filter(v => v !== "all").length;

  const filtered = useMemo(() => {
    return MOCK_USERS.filter(u => {
      if (filters.language !== "all") {
        const allLangs = [...u.native, ...u.learning.map(l => l.code)];
        if (!allLangs.includes(filters.language)) return false;
      }
      if (filters.city !== "all" && u.city !== filters.city) return false;
      if (filters.age_group !== "all" && u.age_group !== filters.age_group) return false;
      if (filters.interest !== "all" && !u.interests.includes(filters.interest)) return false;
      if (filters.meeting_type !== "all" && !u.meeting_types.includes(filters.meeting_type)) return false;
      return true;
    });
  }, [filters]);

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
        <p className="text-muted-foreground">Find your perfect language partner — filter by language, city, age group, interests and meeting style.</p>
      </div>

      {/* Meeting type quick filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {MEETING_TYPES.map(mt => {
          const Icon = mt.icon;
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

      {/* Expanded filters panel */}
      <AnimatePresence>
        {filtersOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 p-4 bg-muted/40 rounded-2xl border border-border">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Language</p>
                <Select value={filters.language} onValueChange={v => setFilter("language", v)}>
                  <SelectTrigger className="h-9 bg-background text-sm">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any language</SelectItem>
                    {LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.flag} {l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">City</p>
                <Select value={filters.city} onValueChange={v => setFilter("city", v)}>
                  <SelectTrigger className="h-9 bg-background text-sm">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any city</SelectItem>
                    {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Age Group</p>
                <Select value={filters.age_group} onValueChange={v => setFilter("age_group", v)}>
                  <SelectTrigger className="h-9 bg-background text-sm">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any age</SelectItem>
                    {AGE_GROUPS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Interest</p>
                <Select value={filters.interest} onValueChange={v => setFilter("interest", v)}>
                  <SelectTrigger className="h-9 bg-background text-sm">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any interest</SelectItem>
                    {INTEREST_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
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
              {LANGUAGES.find(l => l.code === filters.language)?.flag} {LANGUAGES.find(l => l.code === filters.language)?.label}
              <button onClick={() => setFilter("language", "all")}><X className="w-3 h-3" /></button>
            </Badge>
          )}
          {filters.city !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1">
              <MapPin className="w-3 h-3" />{filters.city}
              <button onClick={() => setFilter("city", "all")}><X className="w-3 h-3" /></button>
            </Badge>
          )}
          {filters.age_group !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {filters.age_group}
              <button onClick={() => setFilter("age_group", "all")}><X className="w-3 h-3" /></button>
            </Badge>
          )}
          {filters.interest !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {EVENT_CATEGORIES.find(c => c.value === filters.interest)?.icon} {EVENT_CATEGORIES.find(c => c.value === filters.interest)?.label}
              <button onClick={() => setFilter("interest", "all")}><X className="w-3 h-3" /></button>
            </Badge>
          )}
          {filters.meeting_type !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {MEETING_TYPES.find(m => m.value === filters.meeting_type)?.label}
              <button onClick={() => setFilter("meeting_type", "all")}><X className="w-3 h-3" /></button>
            </Badge>
          )}
          <button onClick={clearFilters} className="text-xs text-destructive hover:underline ml-1">Clear all</button>
        </div>
      )}

      {/* Results */}
      <p className="text-sm text-muted-foreground mb-4">{filtered.length} partner{filtered.length !== 1 ? "s" : ""} found</p>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Languages className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-muted-foreground">No partners match your filters. Try adjusting them.</p>
          <Button variant="outline" className="mt-4 rounded-full" onClick={clearFilters}>Clear Filters</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((u, i) => (
              <motion.div key={u.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.04 }}>
                <LanguageUserCard person={u} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
