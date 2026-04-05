import { useEvents } from "@/hooks/use-events";
import { useAuth } from "@/hooks/use-auth";
import { EventCard } from "@/components/events/EventCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MapPin, CalendarHeart, Sparkles, X, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { EVENT_CATEGORIES, EVENT_CATEGORY_VALUES } from "@shared/categories";
import { Link } from "wouter";

const BANNER_DISMISSED_KEY = "expat_interests_banner_dismissed";

// Show the banner only when:
//   - user is logged in
//   - user has no interests set
//   - user hasn't dismissed it this session
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

export default function Home() {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const { user } = useAuth();
  const [showBanner, dismissBanner] = useShowPersonalisationBanner(user);

  const { data: events, isLoading } = useEvents({
    search: search || undefined,
    city: city !== "all" ? city : undefined,
    category: category !== "all" ? category : undefined,
  });

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=2069&auto=format&fit=crop"
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
              event.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed max-w-xl">
              The premier platform for expats in Russia to discover local gatherings, professional
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
                  <SelectContent>
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
                  <SelectContent>
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

      {/* ── Events listing ────────────────────────────────────────────── */}
      <section className="py-20 bg-background flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Section heading */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-2">Upcoming Events</h2>
              <p className="text-muted-foreground">Discover what's happening around you.</p>
            </div>
          </div>

          {/* ── Personalisation nudge banner ─────────────────────────── */}
          <AnimatePresence>
            {showBanner && (
              <motion.div
                key="interests-banner"
                initial={{ opacity: 0, y: -24, scaleY: 0.92 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                exit={{ opacity: 0, y: -16, scaleY: 0.95 }}
                transition={{ type: "spring", stiffness: 340, damping: 28 }}
                className="mb-8 origin-top"
              >
                <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-primary/5 border border-primary/20 rounded-2xl px-5 py-4 shadow-sm shadow-primary/5">

                  {/* Icon */}
                  <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">
                      Make events personal
                    </p>
                    <p className="text-muted-foreground text-sm mt-0.5">
                      Tell us what you're into and we'll surface events that match — plus notify
                      you on Telegram the moment something new drops.
                    </p>
                  </div>

                  {/* CTA */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      asChild
                      size="sm"
                      className="rounded-full gap-1.5 shadow-md shadow-primary/15 whitespace-nowrap"
                      onClick={dismissBanner}
                    >
                      <Link href="/profile">
                        Set my interests
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </Button>
                  </div>

                  {/* Dismiss */}
                  <button
                    onClick={dismissBanner}
                    aria-label="Dismiss"
                    className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Event grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-96 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : events?.length === 0 ? (
            <div className="text-center py-32 glass rounded-3xl">
              <CalendarHeart className="w-16 h-16 mx-auto text-muted-foreground mb-6 opacity-50" />
              <h3 className="text-2xl font-display font-bold mb-2">No events found</h3>
              <p className="text-muted-foreground">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {events?.map((event, i) => (
                <EventCard key={event.id} event={event} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
