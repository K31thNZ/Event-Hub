// client/src/pages/Picks.tsx
// AI‑powered event recommendations (vector search).
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Link } from "wouter";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Sparkles, Calendar, MapPin, ArrowRight, Bot, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EventWithTickets } from "@shared/schema";

const ROLE_COLORS: Record<string, string> = {
  networking: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  tech:       "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  culture:    "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200",
  food:       "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  sports:     "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  music:      "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
};

function categoryColor(cat: string) {
  return ROLE_COLORS[cat] ?? "bg-muted text-muted-foreground";
}

export default function Picks() {
  const { data: events, isLoading } = useQuery<EventWithTickets[]>({
    queryKey: ["/api/events/recommendations"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Bot className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-display font-bold mb-2">For You</h1>
          <p className="text-muted-foreground max-w-sm">
            We don't have enough data yet to suggest events. Explore all events and RSVP to a few — your personalised picks will appear here.
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/">Browse all events</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* ── Hero header ─────────────────────────────────────────────── */}
      <div className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/8" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-semibold text-sm mb-6 border border-primary/20">
              <Sparkles className="w-4 h-4" />
              AI‑Powered Picks
            </div>
            <h1 className="text-5xl md:text-6xl font-display font-bold mb-4 leading-tight">
              Recommended for You
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Events matched to your taste using semantic understanding — not just tags.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* ── Recommended event cards ────────────────────────────────── */}
        {events.map((event, i) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 + i * 0.07 }}
          >
            <Link href={`/events/${event.id}`}>
              <div className="group bg-card border border-border rounded-3xl overflow-hidden hover:shadow-xl hover:shadow-primary/5 transition-all hover:-translate-y-0.5 cursor-pointer flex flex-col md:flex-row">
                {/* Similarity badge – small number showing match strength */}
                {(event as any).similarity != null && (
                  <div className="hidden md:flex w-16 shrink-0 bg-primary/5 items-center justify-center border-r border-border">
                    <span className="font-display font-bold text-sm text-primary/60">
                      {Math.round((event as any).similarity * 100)}%
                    </span>
                  </div>
                )}

                {/* Cover image */}
                {event.imageUrl && (
                  <div className="w-full md:w-48 h-44 md:h-auto shrink-0 overflow-hidden">
                    <img
                      src={event.imageUrl}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                )}

                {/* Details */}
                <div className="flex-1 p-6 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${categoryColor(event.category)}`}>
                        {event.category}
                      </span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-0.5" />
                    </div>
                    <h3 className="font-display font-bold text-xl mb-1 group-hover:text-primary transition-colors">
                      {event.title}
                    </h3>
                    <p className="text-muted-foreground text-sm line-clamp-2">{event.description}</p>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-primary/70" />
                      {format(new Date(event.date), "EEE, MMM d · h:mm a")}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-primary/70" />
                      {event.venueAddress}, {event.venueCity}
                    </span>
                  </div>

                  {/* Ticket price range */}
                  {event.ticketTypes.length > 0 && (
                    <div className="flex items-center gap-2">
                      {Math.min(...event.ticketTypes.map(t => t.price)) === 0 ? (
                        <Badge variant="secondary" className="rounded-full text-xs">Free entry</Badge>
                      ) : (
                        <Badge variant="secondary" className="rounded-full text-xs">
                          From {Math.min(...event.ticketTypes.map(t => t.price))} ₽
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* ── Footer CTA ───────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 mt-10 border-t border-border text-center">
        <p className="text-muted-foreground mb-4">Looking for something specific? Browse everything happening this week.</p>
        <Button asChild className="rounded-full px-8 shadow-lg shadow-primary/20">
          <Link href="/">View all events <ArrowRight className="w-4 h-4 ml-2" /></Link>
        </Button>
      </div>
    </div>
  );
}
