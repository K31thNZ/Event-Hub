// Guides.tsx — Moscow Expat Knowledge Base
// Displays community knowledge base guides stored in the Base44 Guide entity.
// Fetches from /api/guides (Express route added in routes.ts).
// Logged-in users can submit community tips via /guides/submit.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { BookOpen, MapPin, Briefcase, Compass, Users, Heart, Search, ChevronRight, Sparkles, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

interface Guide {
  id: string;
  title: string;
  slug: string;
  pillar: "arrive" | "live" | "work" | "explore" | "connect";
  category: string;
  summary: string;
  author_label: string;
  is_community: boolean;
  pinned: boolean;
  view_count: number;
  created_date: string;
}

const PILLARS = [
  { id: "all",     label: "All Guides",  Icon: BookOpen,  color: "text-primary",    bg: "bg-primary/10" },
  { id: "arrive",  label: "Arrive",      Icon: MapPin,    color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-950/40" },
  { id: "live",    label: "Live",        Icon: Heart,     color: "text-green-600",  bg: "bg-green-50 dark:bg-green-950/40" },
  { id: "work",    label: "Work",        Icon: Briefcase, color: "text-amber-600",  bg: "bg-amber-50 dark:bg-amber-950/40" },
  { id: "explore", label: "Explore",     Icon: Compass,   color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/40" },
  { id: "connect", label: "Connect",     Icon: Users,     color: "text-rose-600",   bg: "bg-rose-50 dark:bg-rose-950/40" },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function Guides() {
  const { user } = useAuth();
  const [activePillar, setActivePillar] = useState("all");
  const [search, setSearch] = useState("");

  const { data: guides = [], isLoading } = useQuery<Guide[]>({
    queryKey: ["guides"],
    queryFn: async () => {
      const res = await fetch("/api/guides");
      if (!res.ok) throw new Error("Failed to fetch guides");
      return res.json();
    },
  });

  const filtered = guides.filter(g => {
    const matchPillar = activePillar === "all" || g.pillar === activePillar;
    const q = search.toLowerCase();
    const matchSearch = !q || g.title.toLowerCase().includes(q) || g.summary.toLowerCase().includes(q) || g.category.toLowerCase().includes(q);
    return matchPillar && matchSearch;
  });

  const pinned = filtered.filter(g => g.pinned);
  const rest   = filtered.filter(g => !g.pinned);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-br from-foreground via-foreground/90 to-foreground/80 text-background py-14 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 bg-primary/20 text-primary border border-primary/30 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              <BookOpen className="w-3.5 h-3.5" />
              Moscow Expat Knowledge Base
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-background mb-3">
              Living in Moscow
            </h1>
            <p className="text-background/70 text-lg max-w-xl mx-auto">
              Practical, resident-written guides for expats — visas, healthcare, transport, daily life, and more.
            </p>
          </motion.div>
          <div className="mt-8 max-w-md mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-background/50" />
            <Input
              placeholder="Search guides…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-background/10 border-background/20 text-background placeholder:text-background/50 focus:bg-background/20"
            />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Pillar tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {PILLARS.map(({ id, label, Icon }) => {
            const active = activePillar === id;
            return (
              <button
                key={id}
                onClick={() => setActivePillar(id)}
                className={[
                  "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all",
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                ].join(" ")}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Pinned */}
        {pinned.length > 0 && (
          <div className="mb-8">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">📌 Essential Reads</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {pinned.map((g, i) => <GuideCard key={g.id} guide={g} index={i} featured />)}
            </div>
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : rest.length === 0 && pinned.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No guides found</p>
            <p className="text-sm mt-1">Try a different pillar or search term</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rest.map((g, i) => <GuideCard key={g.id} guide={g} index={i} />)}
          </div>
        )}

        {/* Community CTA */}
        <div className="mt-12 rounded-2xl bg-primary/5 border border-primary/20 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-display font-bold text-foreground text-lg">Share Your Knowledge</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Living in Moscow? Post a tip, recommendation, or practical advice for the community.
            </p>
          </div>
          {user ? (
            <Link href="/guides/submit">
              <button className="shrink-0 bg-primary text-primary-foreground px-5 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
                Write a guide <ChevronRight className="w-4 h-4" />
              </button>
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground italic shrink-0">Sign in to contribute</p>
          )}
        </div>
      </div>
    </div>
  );
}

function GuideCard({ guide, index, featured = false }: { guide: Guide; index: number; featured?: boolean }) {
  const p = PILLARS.find(x => x.id === guide.pillar) ?? PILLARS[0];
  const { Icon } = p;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.04 }}>
      <Link href={`/guides/${guide.slug}`}>
        <div className={[
          "group bg-card border border-border rounded-2xl p-5 h-full flex flex-col cursor-pointer",
          "hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200",
          featured ? "ring-1 ring-primary/20" : "",
        ].join(" ")}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className={["w-9 h-9 rounded-xl flex items-center justify-center shrink-0", p.bg].join(" ")}>
              <Icon className={["w-4 h-4", p.color].join(" ")} />
            </div>
            <div className="flex gap-1.5 flex-wrap justify-end">
              {guide.is_community && <Badge variant="secondary" className="text-xs">Community</Badge>}
              <Badge variant="outline" className="text-xs">{guide.category}</Badge>
            </div>
          </div>
          <h3 className="font-display font-bold text-foreground text-base leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
            {guide.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 flex-1">{guide.summary}</p>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
            <span>{guide.author_label}</span>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(guide.created_date)}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
