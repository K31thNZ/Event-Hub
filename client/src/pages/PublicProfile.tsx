// client/src/pages/PublicProfile.tsx
// Read-only public profile page for any user — /profile/:userId
// Shows: avatar, name, city, age group, bio, languages, interests,
//        meeting style, events organised, and a "Connect" CTA.

import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin, Languages, CalendarDays, Users, Zap,
  Crown, Star, ExternalLink, ArrowLeft,
} from "lucide-react";
import { LANGUAGES } from "@/lib/constants";
import { EVENT_CATEGORIES } from "@shared/categories";
import { format, isPast } from "date-fns";
import { useState } from "react";
import LanguageUserCard, { type LanguageUser } from "@/components/language/LanguageUserCard";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PublicUser {
  id: number;
  displayName: string | null;
  avatarUrl: string | null;
  city: string | null;
  bio: string | null;
  ageGroup: string | null;
  native: string[];
  learning: { code: string; proficiency: string }[];
  interests: string[];
  meetingTypes: string[];
  telegramUsername: string | null;
  isExpatMember: boolean;
  isGamesMember: boolean;
  language_story: string | null;   // Task 6
  is_event_regular?: boolean;       // Task 12
}

interface EventItem {
  id: number;
  title: string;
  category: string;
  date: string;
  venueCity: string;
  imageUrl: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROFICIENCY_COLORS: Record<string, string> = {
  A1: "bg-slate-100 text-slate-700",
  A2: "bg-blue-100 text-blue-700",
  B1: "bg-emerald-100 text-emerald-700",
  B2: "bg-teal-100 text-teal-700",
  C1: "bg-violet-100 text-violet-700",
  C2: "bg-amber-100 text-amber-700",
};

const MEETING_TYPE_LABELS: Record<string, string> = {
  "1on1":       "1 on 1",
  small_group:  "Small Group",
  social:       "Social Event",
};

function getLangFlag(code: string) {
  return LANGUAGES.find(l => l.code === code)?.flag ?? "🌐";
}
function getLangLabel(code: string) {
  return LANGUAGES.find(l => l.code === code)?.label ?? code.toUpperCase();
}
function getCategoryIcon(cat: string) {
  return EVENT_CATEGORIES.find(c => c.value === cat)?.icon ?? "📅";
}

// ── Skeleton loading ──────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 pb-16">
      <div className="relative h-32 sm:h-44 bg-muted/40 rounded-b-2xl" />
      <div className="-mt-14 mb-6 flex items-end gap-4 px-4">
        <Skeleton className="h-24 w-24 rounded-full shrink-0" />
        <div className="flex-1 pb-1 space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="space-y-4 px-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    </div>
  );
}

// ── Availability heat-map helpers (Task 8) ──────────────────────────────────

const AVAIL_DAY_LABELS  = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const AVAIL_HOUR_LABELS = ["00", "03", "06", "09", "12", "15", "18", "21"];

function AvailHeatMap({ slots, name }: { slots: { day: number; hour: number }[]; name: string }) {
  if (slots.length === 0) return null;

  const slotSet = new Set(slots.map(s => `${s.day}-${s.hour}`));

  // Collapse 24 hours into 8 blocks of 3 hours each
  function isCellActive(day: number, blockStart: number) {
    return [0, 1, 2].some(offset => slotSet.has(`${day}-${blockStart + offset}`));
  }

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">
        {name} is usually free:
      </p>
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `auto repeat(7, 1fr)` }}
      >
        {/* Day header row */}
        <div />
        {AVAIL_DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[9px] text-muted-foreground font-medium">{d}</div>
        ))}

        {/* One row per 3-hour block */}
        {AVAIL_HOUR_LABELS.map((label, hi) => (
          <>
            <div key={`lbl-${hi}`} className="text-[9px] text-muted-foreground pr-1 flex items-center">{label}</div>
            {[0, 1, 2, 3, 4, 5, 6].map(day => (
              <div
                key={`${day}-${hi}`}
                className={[
                  "h-3 rounded-sm transition-colors",
                  isCellActive(day, hi * 3) ? "bg-primary/70" : "bg-muted/40",
                ].join(" ")}
              />
            ))}
          </>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PublicProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { user: me } = useAuth();
  const [sparkOpen, setSparkOpen] = useState(false);

  const numericId = parseInt(userId ?? "", 10);
  const isOwnProfile = me?.id === numericId;

  // Fetch public profile
  const { data: profile, isLoading: profileLoading, isError } = useQuery<PublicUser>({
    queryKey: ["/api/users", numericId, "public"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${numericId}/public`);
      if (!res.ok) throw new Error("Profile not found");
      return res.json();
    },
    enabled: !isNaN(numericId),
    retry: false,
  });

  // Fetch events organised by this user
  const { data: organizedEvents = [] } = useQuery<EventItem[]>({
    queryKey: ["/api/users", numericId, "events"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${numericId}/events`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !isNaN(numericId),
  });

  // Task 8 — fetch this user's availability slots from meh-auth
  const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "";
  const { data: availData } = useQuery<{ slots: { day: number; hour: number }[] }>({
    queryKey: ["public-avail", numericId],
    queryFn: () =>
      fetch(`${AUTH_URL}/api/language-exchange/users/${numericId}/availability`)
        .then(r => (r.ok ? r.json() : { slots: [] })),
    enabled: !isNaN(numericId),
    staleTime: 1000 * 60 * 10,
  });
  const availSlots = availData?.slots ?? [];

  if (isNaN(numericId)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Invalid profile link.</p>
      </div>
    );
  }

  if (profileLoading) return <ProfileSkeleton />;

  if (isError || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground text-lg">This profile doesn't exist or is private.</p>
        <Link href="/language-exchange">
          <Button variant="outline" className="gap-2 rounded-xl">
            <ArrowLeft className="w-4 h-4" /> Back to Language Exchange
          </Button>
        </Link>
      </div>
    );
  }

  const displayName   = profile.displayName ?? "Member";
  const initials      = displayName.substring(0, 2).toUpperCase();
  const upcomingEvents = organizedEvents.filter(e => !isPast(new Date(e.date)));
  const pastEvents     = organizedEvents.filter(e => isPast(new Date(e.date)));

  // Build a LanguageUser shape to pass to LanguageUserCard (reuses existing component)
  const asLanguageUser: LanguageUser = {
    id:               profile.id,
    full_name:        displayName,
    avatar_url:       profile.avatarUrl ?? "",
    city:             profile.city ?? "",
    age_group:        profile.ageGroup ?? "",
    native:           profile.native,
    learning:         profile.learning,
    interests:        profile.interests,
    meeting_types:    profile.meetingTypes,
    bio:              profile.bio ?? "",
    telegram_username: profile.telegramUsername,
  };

  return (
    <div className="min-h-screen bg-muted/10 pb-16">

      {/* ── Hero banner ── */}
      <div className="relative h-36 sm:h-48 bg-gradient-to-br from-primary/25 via-primary/10 to-background">
        <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
        {/* Back button */}
        <Link href="/language-exchange">
          <button className="absolute top-4 left-4 inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white bg-black/20 hover:bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full transition-all">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        </Link>
        {/* Own profile edit shortcut */}
        {isOwnProfile && (
          <Link href="/profile">
            <button className="absolute top-4 right-4 inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white bg-black/20 hover:bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full transition-all">
              Edit profile →
            </button>
          </Link>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6">

        {/* ── Identity row (overlaps banner) ── */}
        <div className="-mt-16 sm:-mt-20 mb-6 flex items-end gap-4">
          <Avatar className="h-28 w-28 sm:h-32 sm:w-32 ring-4 ring-background shadow-xl shrink-0">
            <AvatarImage src={profile.avatarUrl ?? ""} />
            <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 pb-1">
            <h1 className="text-2xl sm:text-3xl font-bold truncate drop-shadow-sm">{displayName}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
              {profile.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />{profile.city}
                </span>
              )}
              {profile.ageGroup && <span className="opacity-60">· {profile.ageGroup}</span>}
            </div>
            <div className="flex gap-1.5 flex-wrap mt-1.5">
              {profile.isExpatMember && <Badge variant="secondary" className="text-xs">ExpatEvents</Badge>}
              {profile.isGamesMember && <Badge variant="secondary" className="text-xs">Games in English</Badge>}
              {profile.is_event_regular && (
                <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 border-green-200">✅ Event Regular</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5">

          {/* ── Bio + Language Story (Task 6) ── */}
          {(profile.bio || profile.language_story) && (
            <Card className="rounded-2xl border-border/60 shadow-sm">
              <CardContent className="p-5 space-y-3">
                {profile.bio && (
                  <p className="text-sm leading-relaxed text-foreground/90">{profile.bio}</p>
                )}
                {profile.language_story && (
                  <p className="text-xs italic text-muted-foreground/80 flex items-start gap-1.5 leading-relaxed border-t border-border/50 pt-3">
                    <span className="shrink-0 mt-0.5">🌱</span>
                    <span>&ldquo;{profile.language_story}&rdquo;</span>
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Languages ── */}
          {(profile.native.length > 0 || profile.learning.length > 0) && (
            <Card className="rounded-2xl border-border/60 shadow-sm">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Languages className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">Languages</span>
                </div>
                {profile.native.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Speaks natively</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.native.map(code => (
                        <span key={code} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                          {getLangFlag(code)} {getLangLabel(code)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {profile.learning.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Learning</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.learning.map(({ code, proficiency }) => (
                        <span key={code} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border text-sm font-medium">
                          {getLangFlag(code)} {getLangLabel(code)}
                          <span className={`px-1.5 py-0 rounded-full text-[10px] font-bold ${PROFICIENCY_COLORS[proficiency] ?? "bg-muted text-muted-foreground"}`}>
                            {proficiency}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Interests + Meeting style (side by side on md+) ── */}
          {(profile.interests.length > 0 || profile.meetingTypes.length > 0) && (
            <div className="grid sm:grid-cols-2 gap-4">
              {profile.interests.length > 0 && (
                <Card className="rounded-2xl border-border/60 shadow-sm">
                  <CardContent className="p-5">
                    <p className="font-semibold text-sm mb-3">Interests</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.interests.map(interest => {
                        const cat = EVENT_CATEGORIES.find(c => c.value === interest);
                        return (
                          <Badge key={interest} variant="secondary" className="text-xs rounded-full gap-1">
                            {cat?.icon} {cat?.label ?? interest}
                          </Badge>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
              {profile.meetingTypes.length > 0 && (
                <Card className="rounded-2xl border-border/60 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-primary" />
                      <p className="font-semibold text-sm">Meeting Style</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {profile.meetingTypes.map(t => (
                        <div key={t} className="flex items-center gap-2 text-sm">
                          {t === "1on1" && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                          {t === "small_group" && <Users className="w-3.5 h-3.5 text-primary shrink-0" />}
                          {t === "social" && <span className="text-base leading-none">🎉</span>}
                          <span>{MEETING_TYPE_LABELS[t] ?? t}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ── Availability heat-map (Task 8) ── */}
          {availSlots.length > 0 && (
            <Card className="rounded-2xl border-border/60 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-base">📅</span>
                  <span className="font-semibold text-sm">Availability</span>
                </div>
                <AvailHeatMap
                  slots={availSlots}
                  name={displayName.split(" ")[0]}
                />
              </CardContent>
            </Card>
          )}

          {/* ── Connect CTA (not shown on own profile) ── */}
          {!isOwnProfile && me && (
            <LanguageUserCard person={asLanguageUser} />
          )}
          {!isOwnProfile && !me && (
            <Card className="rounded-2xl border-primary/30 border bg-primary/5 shadow-sm">
              <CardContent className="p-5 flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-sm">Want to connect with {displayName}?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Sign in to send a Spark or suggest an event together.</p>
                </div>
                <Button className="rounded-xl gap-2 shrink-0" asChild>
                  <a href={`/sign-in?returnTo=/profile/${numericId}`}>
                    <Zap className="w-4 h-4" /> Sign in to connect
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ── Events organised ── */}
          {organizedEvents.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-base">Events by {displayName}</h2>
              </div>

              {upcomingEvents.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Upcoming</p>
                  <div className="space-y-2">
                    {upcomingEvents.map(event => (
                      <EventRow key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              )}

              {pastEvents.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2 mt-4">Past</p>
                  <div className="space-y-2">
                    {pastEvents.slice(0, 4).map(event => (
                      <EventRow key={event.id} event={event} past />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── EventRow sub-component ────────────────────────────────────────────────────

function EventRow({ event, past = false }: { event: EventItem; past?: boolean }) {
  return (
    <Link href={`/events/${event.id}`}>
      <Card className={`rounded-xl border-border/60 shadow-sm hover:shadow-md transition-all cursor-pointer ${past ? "opacity-60 hover:opacity-80" : ""}`}>
        <CardContent className="p-3 flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center">
            {event.imageUrl
              ? <img src={event.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
              : <span className="text-xl">{getCategoryIcon(event.category)}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{event.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(event.date), "EEE, d MMM yyyy")}
              {event.venueCity && ` · ${event.venueCity}`}
            </p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}
