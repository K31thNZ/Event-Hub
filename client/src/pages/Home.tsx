// client/src/pages/Home.tsx
import { useEvents } from "@/hooks/use-events";
import { useAuth } from "@/hooks/use-auth";
import { EventCard } from "@/components/events/EventCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MapPin, CalendarHeart, Sparkles, X, ArrowRight, History, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { EVENT_CATEGORIES } from "@shared/categories";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

const PAGE_SIZE = 50;
const BANNER_DISMISSED_KEY = "expat_interests_banner_dismissed";

function useShowPersonalisationBanner(user: any): [boolean, () => void] {
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(BANNER_DISMISSED_KEY) === "1"; } catch { return false; }
  });

  const dismiss = () => {
    try { sessionStorage.setItem(BANNER_DISMISSED_KEY, "1"); } catch {}
    setDismissed(true);
  };

  const hasNoInterests = !user?.interests || user.interests.length === 0;
  const show = !!user && hasNoInterests && !dismissed;

  return [show, dismiss];
}

// ── RSVP counts lookup ────────────────────────────────────────────────────────
function useRsvpCounts(eventIds: number[]) {
  return useQuery({
    queryKey: ["rsvp-summaries", eventIds],
    queryFn: async () => {
      if (eventIds.length === 0) return {};
      const res = await fetch("/api/events/rsvp-summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds }),
      });
      if (!res.ok) return {};
      return await res.json() as Record<number, { going: number; maybe: number; no: number }>;
    },
    enabled: eventIds.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// ── Paginated event grid ──────────────────────────────────────────────────────
interface PaginatedEventsProps {
  events: any[];
  rsvpCounts?: Record<number, { going: number; maybe: number; no: number }>;
  className?: string;
}

function PaginatedEventGrid({ events, rsvpCounts, className = "" }: PaginatedEventsProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset to first page whenever the events list changes (filter/search)
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [events]);

  const visible   = events.slice(0, visibleCount);
  const remaining = events.length - visibleCount;
  const hasMore   = remaining > 0;
  const nextBatch = Math.min(remaining, PAGE_SIZE);

  const showMoreRef = useRef<HTMLDivElement>(null);

  const handleShowMore = () => {
    const prevCount = visibleCount;
    setVisibleCount(c => c + PAGE_SIZE);
    // Scroll to first newly visible card after render
    setTimeout(() => {
      const grid = showMoreRef.current?.previousElementSibling;
      if (grid) {
        const cards = grid.querySelectorAll(":scope > *");
        const firstNew = cards[prevCount];
        if (firstNew) {
          firstNew.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    }, 50);
  };

  return (
    <div className={className}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {visible.map((event, i) => (
          <EventCard
            key={event.id}
            event={event}
            index={i}
            rsvpCounts={rsvpCounts?.[event.id]}
          />
        ))}
      </div>

      {/* Counter + show more */}
      <div ref={showMoreRef}>
        <p className="text-center text-sm text-muted-foreground mt-8">
          Showing {visible.length} of {events.length} event{events.length !== 1 ? "s" : ""}
        </p>

        {hasMore && (
          <div className="flex justify-center mt-4">
            <Button
              variant="outline"
              size="lg"
              onClick={handleShowMore}
              className="rounded-full gap-2 min-w-[220px]"
            >
              <ChevronDown className="w-4 h-4" />
              Show {nextBatch} more event{nextBatch !== 1 ? "s" : ""}
              <span className="text-muted-foreground text-xs font-normal">
                ({remaining} remaining)
              </span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const { user } = useAuth();
  const [showBanner, dismissBanner] = useShowPersonalisationBanner(user);

  const [location] = useLocation();
  const [showWelcomeOverlay, setShowWelcomeOverlay] = useState(false);
  const upcomingRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    const justLoggedIn = params.get('justLoggedIn') === 'true';

    if (justLoggedIn && upcomingRef.current) {
      setShowWelcomeOverlay(true);
      setTimeout(() => {
        upcomingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
      const timer = setTimeout(() => setShowWelcomeOverlay(false), 5000);
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      return () => clearTimeout(timer);
    }
  }, [location]);

  const { data: events, isLoading } = useEvents({
    search: search || undefined,
    city: city !== "all" ? city : undefined,
    category: category !== "all" ? category : undefined,
    includePast: true,
    limit: 200,
  });

  const now = new Date();
  const upcomingEvents = (events || [])
    .filter(event => new Date(event.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pastEvents = (events || [])
    .filter(event => new Date(event.date) < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const allVisibleIds = [...upcomingEvents, ...pastEvents].map(e => e.id);
  const { data: rsvpCounts } = useRsvpCounts(allVisibleIds);

  return (
    <div className="flex flex-col min-h-screen">

      {/* Personalisation nudge */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            key="interests-banner"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="sticky top-16 z-40 overflow-hidden"
          >
            <div className="bg-primary text-primary-foreground px-4 py-3">
              <div className="max-w-7xl mx-auto flex items-center gap-3">
                <Sparkles className="w-4 h-4 shrink-0 opacity-90" />
                <p className="flex-1 text-sm font-medium">
                  <span className="font-semibold">Make it personal —</span>{" "}
                  <span className="opacity-90">
                    set your interests and get notified when matching events are posted.
                  </span>
                </p>
                <Button
                  asChild
                  size="sm"
                  variant="secondary"
                  className="shrink-0 rounded-full text-xs h-7 px-3 gap-1 font-semibold"
                  onClick={dismissBanner}
                >
                  <Link href="/profile">
                    Set interests
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </Button>
                <button
                  onClick={dismissBanner}
                  aria-label="Dismiss"
                  className="shrink-0 opacity-70 hover:opacity-100 transition-opacity ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <AnimatePresence>
          {showWelcomeOverlay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-20 bg-black/70 backdrop-blur-sm flex items-center justify-center"
            >
              <div className="text-center text-white p-6 max-w-md">
                <h2 className="text-3xl font-display font-bold mb-2">Welcome back! 🎉</h2>
                <p className="text-lg opacity-90">Check out the latest events below.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute inset-0 z-0">
          <img
            src="https://pub-bbcea9b00e1042e59b8ffab29ad09276.r2.dev/hero.avif"
            alt="Hero Background"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/40" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-medium text-sm mb-6 border border-primary/20">
              <CalendarHeart className="w-4 h-4" />
              <span>Connect. Explore. Experience.</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-display font-bold text-foreground leading-[1.1] mb-6">
              Find your next <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                unforgettable
              </span>{" "}
              event
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed max-w-xl">
              The premier platform for expats to discover local gatherings, professional
              networking, and vibrant cultural experiences.
            </p>

            {/* Search bar */}
            <div className="glass p-2 rounded-2xl md:rounded-full flex flex-col md:flex-row gap-2 max-w-3xl">
              <div className="relative flex-1 flex items-center">
                <Search className="w-5 h-5 absolute left-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  className="w-full pl-12 h-12 bg-transparent border-none focus-visible:ring-0 text-base rounded-full"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="h-px w-full md:h-10 md:w-px bg-border my-auto hidden md:block" />
              <div className="relative md:w-48 flex items-center">
                <MapPin className="w-5 h-5 absolute left-4 text-muted-foreground z-10" />
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger className="w-full pl-12 h-12 bg-transparent border-none focus:ring-0 text-base shadow-none">
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-900">
                    <SelectItem value="all">All Locations</SelectItem>
                    <SelectItem value="Moscow">Moscow</SelectItem>
                    <SelectItem value="Dubai">Dubai</SelectItem>
                    <SelectItem value="London">London</SelectItem>
                    <SelectItem value="New York">New York</SelectItem>
                    <SelectItem value="Singapore">Singapore</SelectItem>
                    <SelectItem value="Sydney">Sydney</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="h-px w-full md:h-10 md:w-px bg-border my-auto hidden md:block" />
              <div className="relative md:w-48 flex items-center">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full px-4 h-12 bg-transparent border-none focus:ring-0 text-base shadow-none">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-900">
                    <SelectItem value="all">All Categories</SelectItem>
                    {EVENT_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Events listing */}
      <section
        id="upcoming-events"
        ref={upcomingRef}
        className="py-20 bg-background flex-1 scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-96 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Upcoming Events */}
              {upcomingEvents.length > 0 && (
                <div className="mb-16">
                  <div className="flex items-end justify-between mb-12">
                    <div>
                      <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Upcoming Events</h2>
                      <p className="text-muted-foreground">Discover what's happening around you.</p>
                    </div>
                  </div>
                  <PaginatedEventGrid
                    events={upcomingEvents}
                    rsvpCounts={rsvpCounts}
                  />
                </div>
              )}

              {/* Past Events */}
              {pastEvents.length > 0 && (
                <div>
                  <div className="flex items-end justify-between mb-12">
                    <div>
                      <h2 className="text-3xl md:text-4xl font-display font-bold mb-4 flex items-center gap-2">
                        <History className="w-8 h-8 text-muted-foreground" />
                        Past Events
                      </h2>
                      <p className="text-muted-foreground">Events that have already taken place.</p>
                    </div>
                  </div>
                  <PaginatedEventGrid
                    events={pastEvents}
                    rsvpCounts={rsvpCounts}
                    className="opacity-80"
                  />
                </div>
              )}

              {upcomingEvents.length === 0 && pastEvents.length === 0 && (
                <div className="text-center py-32 glass rounded-3xl">
                  <CalendarHeart className="w-16 h-16 mx-auto text-muted-foreground mb-6 opacity-50" />
                  <h3 className="text-2xl font-display font-bold mb-2">No events found</h3>
                  <p className="text-muted-foreground">Try adjusting your search or filters.</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
