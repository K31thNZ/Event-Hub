// client/src/components/language/LanguageUserCard.tsx
//
// Connection flow — two CTAs shown based on meeting-type compatibility:
//
//   "Suggest an Event"  — visible when BOTH profiles share at least one
//                         compatible meeting type (small_group or social).
//                         1on1 is a premium-only meeting type; the button is
//                         shown but locked behind a premium badge for free users.
//
//   "Send a Spark"      — always visible; unchanged behaviour.
//
// Meeting-type compatibility rules:
//   small_group / social  → available to all users when BOTH have that type set
//   1on1                  → requires the current user to have role "premium"
//                           (or "admin"); shown as a locked pill to free users

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  MapPin, Languages, Zap, Plus, X, Check, Loader2,
  CalendarDays, Lock, Crown, ExternalLink,
} from "lucide-react";
import { LANGUAGES } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format, isPast } from "date-fns";

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "https://auth.expatevents.org";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LearningLanguage {
  code:        string;
  proficiency: string;
}

export interface LanguageUser {
  id:               string | number;
  full_name:        string;
  avatar_url:       string;
  city:             string;
  age_group:        string;
  native:           string[];
  learning:         LearningLanguage[];
  interests:        string[];
  meeting_types:    string[];
  bio:              string;
  telegram_username?: string | null;
}

interface LanguageUserCardProps {
  person: LanguageUser;
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

// Meeting types that map naturally to event categories
const MEETING_TYPE_CATEGORIES: Record<string, string[]> = {
  "1on1":       ["language", "coffee", "social"],
  small_group:  ["language", "games", "culture", "social", "sports", "wellness"],
  social:       ["language", "games", "culture", "social", "music", "food", "sports"],
};

function getLangFlag(code: string): string {
  return LANGUAGES.find(l => l.code === code)?.flag ?? "🌐";
}

function getLangLabel(code: string): string {
  return LANGUAGES.find(l => l.code === code)?.label ?? code.toUpperCase();
}

function isPremiumUser(role?: string): boolean {
  return role === "premium" || role === "admin";
}

// ── Time slot builder (unchanged) ────────────────────────────────────────────

function buildTimeOptions(): { iso: string; label: string }[] {
  const options: { iso: string; label: string }[] = [];
  const now   = new Date();
  const hours = [10, 14, 18, 20];

  for (let d = 0; d < 4; d++) {
    const date = new Date(now);
    date.setDate(now.getDate() + d);

    for (const h of hours) {
      const slot = new Date(date);
      slot.setHours(h, 0, 0, 0);
      if (slot <= now) continue;

      const dayLabel =
        d === 0 ? "Today" :
        d === 1 ? "Tomorrow" :
        slot.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

      options.push({
        iso:   slot.toISOString(),
        label: `${dayLabel} ${h.toString().padStart(2, "0")}:00`,
      });
    }
  }
  return options.slice(0, 12);
}

// ── Compatibility helpers ─────────────────────────────────────────────────────

/**
 * Returns the meeting types that BOTH the current user and the partner have set,
 * excluding "1on1" for non-premium users.
 */
function getSharedMeetingTypes(
  myTypes: string[],
  theirTypes: string[],
  isPremium: boolean,
): string[] {
  const shared = myTypes.filter(t => theirTypes.includes(t));
  return shared.filter(t => t !== "1on1" || isPremium);
}

/**
 * Returns event categories relevant to the shared meeting types.
 */
function relevantCategories(sharedTypes: string[]): string[] {
  const cats = new Set<string>();
  for (const t of sharedTypes) {
    for (const c of (MEETING_TYPE_CATEGORIES[t] ?? [])) cats.add(c);
  }
  return [...cats];
}

// ── SuggestEventDialog ────────────────────────────────────────────────────────

interface SuggestEventDialogProps {
  person:        LanguageUser;
  sharedTypes:   string[];          // already-validated meeting types both parties share
  open:          boolean;
  onClose:       () => void;
}

interface EventItem {
  id:           number;
  title:        string;
  category:     string;
  category2?:   string | null;
  date:         string;
  venueCity:    string;
  locationName: string | null;
  imageUrl:     string | null;
}

function SuggestEventDialog({ person, sharedTypes, open, onClose }: SuggestEventDialogProps) {
  const { toast }                       = useToast();
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [sending,  setSending]          = useState(false);
  const [sent,     setSent]             = useState(false);

  const cats = relevantCategories(sharedTypes);

  // Fetch upcoming events — no category filter on server (it doesn't support it well for
  // this use-case), so we filter client-side to the relevant categories.
  const { data: allEvents = [], isLoading } = useQuery<EventItem[]>({
    queryKey: ["/api/events"],
    enabled:  open,
    select: (events: any[]) =>
      events
        .filter(e => {
          if (isPast(new Date(e.date))) return false;
          return cats.length === 0 ||
            cats.includes(e.category) ||
            (e.category2 && cats.includes(e.category2));
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 6),
  });

  const handleSend = async () => {
    if (!selectedEvent) return;
    setSending(true);
    try {
      // Re-use the existing language-exchange spark endpoint, appending event context.
      // The Telegram message will include a link to the event.
      const res = await fetch(`${AUTH_URL}/api/language-exchange/spark`, {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId:    Number(person.id),
          availableTimes: [],
          suggestedEvent: {
            id:    selectedEvent.id,
            title: selectedEvent.title,
            date:  selectedEvent.date,
            city:  selectedEvent.venueCity,
            url:   `https://expatevents.org/events/${selectedEvent.id}`,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to send suggestion");

      setSent(true);
      toast({
        title: "📅 Event suggested!",
        description: `${person.full_name} has been sent a Telegram message about "${selectedEvent.title}".`,
      });
    } catch (err: any) {
      toast({ title: "Couldn't send suggestion", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (!sending) {
      setSent(false);
      setSelectedEvent(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="w-5 h-5 text-primary" />
            Suggest an event to {person.full_name}
          </DialogTitle>
          <DialogDescription>
            {sent
              ? "Done! They've been sent a Telegram message with the event details."
              : `Pick an upcoming event that matches your shared interest — ${sharedTypes.map(t => MEETING_TYPE_LABELS[t] ?? t).join(" / ")} style.`}
          </DialogDescription>
        </DialogHeader>

        {!sent ? (
          <>
            {/* Partner mini-card */}
            <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-3">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={person.avatar_url} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {person.full_name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{person.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {person.native.map(getLangFlag).join("")}
                  {person.learning.length > 0 && ` → ${person.learning.map(l => getLangFlag(l.code)).join("")}`}
                </p>
              </div>
              {person.telegram_username
                ? <Badge variant="secondary" className="text-xs shrink-0">✈️ Telegram</Badge>
                : <Badge variant="outline" className="text-xs shrink-0 text-muted-foreground">No Telegram</Badge>
              }
            </div>

            {/* Event list */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : allEvents.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No upcoming events found matching your shared meeting style.
                <br />
                <a href="/" className="text-primary hover:underline text-xs mt-1 inline-block">
                  Browse all events →
                </a>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {allEvents.map(event => {
                  const isSelected = selectedEvent?.id === event.id;
                  return (
                    <button
                      key={event.id}
                      onClick={() => setSelectedEvent(isSelected ? null : event)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all
                        ${isSelected
                          ? "bg-primary/5 border-primary ring-1 ring-primary/30"
                          : "bg-background border-border hover:border-primary/30 hover:bg-muted/30"
                        }`}
                    >
                      {/* Event image or category placeholder */}
                      <div className="h-12 w-12 rounded-lg overflow-hidden shrink-0 bg-muted flex items-center justify-center">
                        {event.imageUrl
                          ? <img src={event.imageUrl} alt="" className="w-full h-full object-cover" />
                          : <CalendarDays className="w-5 h-5 text-muted-foreground" />
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate leading-tight">{event.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(event.date), "EEE, d MMM · HH:mm")}
                          {event.venueCity && ` · ${event.venueCity}`}
                        </p>
                        <Badge variant="outline" className="text-[10px] mt-1 py-0 h-4 rounded-full">
                          {event.category}
                        </Badge>
                      </div>

                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                        ${isSelected ? "bg-primary border-primary" : "border-border"}`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <DialogFooter className="gap-2 pt-1">
              <Button variant="outline" onClick={handleClose} disabled={sending} className="rounded-xl">
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending || !selectedEvent}
                className="rounded-xl gap-2 flex-1"
              >
                {sending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                  : <><CalendarDays className="w-4 h-4" /> Suggest this event</>
                }
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* Success state */
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <CalendarDays className="w-7 h-7 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm">{selectedEvent?.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedEvent && format(new Date(selectedEvent.date), "EEEE, d MMMM · HH:mm")}
              </p>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {person.telegram_username
                ? <>You can also reach them directly on Telegram:{" "}
                    <a href={`https://t.me/${person.telegram_username}`} target="_blank" rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium">
                      @{person.telegram_username}
                    </a>
                  </>
                : "They'll see the suggestion next time they log in."
              }
            </p>
            <Button variant="outline" className="rounded-xl gap-2" asChild>
              <a href={`/events/${selectedEvent?.id}`}>
                <ExternalLink className="w-4 h-4" /> View event
              </a>
            </Button>
            <Button className="rounded-xl w-full" onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── SparkDialog (unchanged logic, minor polish) ────────────────────────────────

interface SparkDialogProps {
  person:  LanguageUser;
  open:    boolean;
  onClose: () => void;
}

function SparkDialog({ person, open, onClose }: SparkDialogProps) {
  const { toast }                       = useToast();
  const [selected,  setSelected]        = useState<string[]>([]);
  const [sending,   setSending]         = useState(false);
  const [sent,      setSent]            = useState(false);

  const timeOptions = buildTimeOptions();

  const toggle = (iso: string) => {
    setSelected(prev =>
      prev.includes(iso)
        ? prev.filter(t => t !== iso)
        : prev.length >= 3 ? [...prev.slice(1), iso] : [...prev, iso]
    );
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await fetch(`${AUTH_URL}/api/language-exchange/spark`, {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId:    Number(person.id),
          availableTimes: selected,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to send spark");

      setSent(true);

      const bothOnTg     = json.senderHasTelegram && json.recipientHasTelegram;
      const recipientOnTg = json.recipientHasTelegram;

      toast({
        title: "⚡ Spark sent!",
        description: bothOnTg
          ? `You and ${person.full_name} both got a Telegram message with each other's profile.`
          : recipientOnTg
            ? `${person.full_name} got a Telegram message. Connect your Telegram to get notified when they reply.`
            : `${person.full_name} hasn't connected Telegram yet — they'll see your spark on next login.`,
      });
    } catch (err: any) {
      toast({ title: "Failed to send spark", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (!sending) { setSent(false); setSelected([]); onClose(); }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Zap className="w-5 h-5 text-amber-500" />
            Send a Spark to {person.full_name}
          </DialogTitle>
          <DialogDescription>
            {sent
              ? "Your spark has been sent! They'll receive a message with your profile."
              : "Pick up to 3 times that work for you. They'll get a Telegram message with your profile card and suggested slots."}
          </DialogDescription>
        </DialogHeader>

        {!sent ? (
          <>
            {/* Partner mini-card */}
            <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-3 my-1">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={person.avatar_url} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {person.full_name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{person.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[person.city, person.native.map(getLangFlag).join("")].filter(Boolean).join(" · ")}
                </p>
              </div>
              {person.telegram_username
                ? <Badge variant="secondary" className="text-xs shrink-0">✈️ On Telegram</Badge>
                : <Badge variant="outline" className="text-xs shrink-0 text-muted-foreground">No Telegram</Badge>
              }
            </div>

            {/* Time slot selector */}
            <div>
              <p className="text-sm font-medium mb-2 text-muted-foreground">
                Suggest convenient times <span className="text-xs">(optional — pick up to 3)</span>
              </p>
              <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                {timeOptions.map(opt => {
                  const isOn = selected.includes(opt.iso);
                  return (
                    <button
                      key={opt.iso}
                      onClick={() => toggle(opt.iso)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left
                        ${isOn
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                    >
                      {isOn ? <Check className="w-3 h-3 shrink-0" /> : <Plus className="w-3 h-3 shrink-0 opacity-40" />}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {selected.length > 0 && (
                <p className="text-xs text-primary mt-1.5 font-medium">
                  {selected.length} time{selected.length > 1 ? "s" : ""} selected
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-2 pt-1">
              <Button variant="outline" onClick={handleClose} disabled={sending} className="rounded-xl">Cancel</Button>
              <Button onClick={handleSend} disabled={sending} className="rounded-xl gap-2 flex-1">
                {sending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                  : <><Zap className="w-4 h-4" /> Send Spark</>
                }
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
              <Zap className="w-7 h-7 text-amber-500" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {person.telegram_username
                ? <>You can also message them on Telegram:{" "}
                    <a href={`https://t.me/${person.telegram_username}`} target="_blank" rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium">
                      @{person.telegram_username}
                    </a>
                  </>
                : "They'll see your spark next time they log in."
              }
            </p>
            <Button className="rounded-xl w-full" onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Premium upsell dialog ─────────────────────────────────────────────────────

function PremiumUpsellDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm rounded-2xl text-center">
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
            <Crown className="w-7 h-7 text-amber-500" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-xl">Premium feature</DialogTitle>
            <DialogDescription className="text-sm">
              1-on-1 language exchange is a <strong>Premium</strong> feature.
              Upgrade to suggest private meetups directly with language partners.
            </DialogDescription>
          </DialogHeader>
          <ul className="text-sm text-left space-y-1.5 w-full">
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> 1-on-1 event & Spark suggestions</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Priority in partner search results</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Advanced availability filters</li>
          </ul>
          <Button className="w-full rounded-xl gap-2 bg-amber-500 hover:bg-amber-600 text-white">
            <Crown className="w-4 h-4" /> Upgrade to Premium
          </Button>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:underline">
            Maybe later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── LanguageUserCard ──────────────────────────────────────────────────────────

export default function LanguageUserCard({ person }: LanguageUserCardProps) {
  const { user }                              = useAuth();
  const [sparkOpen,         setSparkOpen]     = useState(false);
  const [suggestEventOpen,  setSuggestEventOpen] = useState(false);
  const [premiumUpsellOpen, setPremiumUpsellOpen] = useState(false);

  const myMeetingTypes  = (user as any)?.meetingTypes ?? [];
  const isPremium       = isPremiumUser((user as any)?.role);

  // Shared meeting types between current user and this partner.
  // 1on1 is included in the list regardless of premium status so we can
  // detect it — we gate the action separately.
  const allShared = myMeetingTypes.filter((t: string) => person.meeting_types.includes(t));

  // Types the current user can actually act on (1on1 requires premium)
  const actionableShared = allShared.filter((t: string) => t !== "1on1" || isPremium);

  // Does the partner also have 1on1, even if user can't act on it yet?
  const has1on1Locked = allShared.includes("1on1") && !isPremium;

  // "Suggest an Event" is shown if there's at least one actionable shared type
  // OR the 1on1 locked scenario (so we can show the locked button)
  const showSuggestEvent = actionableShared.length > 0 || has1on1Locked;

  // If the only shared type is 1on1 and user is not premium → locked
  const suggestEventLocked = actionableShared.length === 0 && has1on1Locked;

  const handleSuggestEventClick = () => {
    if (suggestEventLocked) {
      setPremiumUpsellOpen(true);
    } else {
      setSuggestEventOpen(true);
    }
  };

  return (
    <>
      <Card className="rounded-2xl border-border/60 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
        <CardContent className="p-5 flex flex-col gap-3 h-full">

          {/* ── Header row ── */}
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12 shrink-0 ring-2 ring-background shadow">
              <AvatarImage src={person.avatar_url} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {person.full_name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base truncate leading-tight">{person.full_name}</p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                {person.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{person.city}
                  </span>
                )}
                {person.age_group && (
                  <span className="opacity-60">· {person.age_group}</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Bio ── */}
          {person.bio && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {person.bio}
            </p>
          )}

          {/* ── Native languages ── */}
          {person.native.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide flex items-center gap-1">
                <Languages className="w-3 h-3" /> Native
              </p>
              <div className="flex flex-wrap gap-1.5">
                {person.native.map(code => (
                  <span key={code}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {getLangFlag(code)} {getLangLabel(code)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Learning languages ── */}
          {person.learning.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Learning</p>
              <div className="flex flex-wrap gap-1.5">
                {person.learning.map(({ code, proficiency }) => (
                  <span key={code}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border text-xs font-medium">
                    {getLangFlag(code)} {getLangLabel(code)}
                    <span className={`ml-1 px-1.5 py-0 rounded-full text-[10px] font-bold ${PROFICIENCY_COLORS[proficiency] ?? "bg-muted text-muted-foreground"}`}>
                      {proficiency}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Interests ── */}
          {person.interests.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Interests</p>
              <div className="flex flex-wrap gap-1.5">
                {person.interests.slice(0, 5).map(interest => (
                  <span key={interest}
                    className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground text-xs">
                    #{interest}
                  </span>
                ))}
                {person.interests.length > 5 && (
                  <span className="text-xs text-muted-foreground self-center">+{person.interests.length - 5}</span>
                )}
              </div>
            </div>
          )}

          {/* ── Meeting style ── */}
          {person.meeting_types.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Meeting Style</p>
              <div className="flex flex-wrap gap-1.5">
                {person.meeting_types.map(type => (
                  <Badge key={type} variant="secondary" className="text-xs rounded-full">
                    {type === "1on1" && <Crown className="w-2.5 h-2.5 mr-1 text-amber-500" />}
                    {MEETING_TYPE_LABELS[type] ?? type}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* ── CTA buttons ── */}
          <div className="flex flex-col gap-2 mt-1">

            {/* Suggest an Event — only shown when meeting types are compatible */}
            {showSuggestEvent && (
              <Button
                size="sm"
                variant="outline"
                className={`w-full rounded-xl gap-2 ${
                  suggestEventLocked
                    ? "border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:border-amber-300"
                    : "border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/60"
                }`}
                onClick={handleSuggestEventClick}
              >
                {suggestEventLocked
                  ? <><Lock className="w-3.5 h-3.5" /> Suggest an Event <Crown className="w-3.5 h-3.5 text-amber-500" /></>
                  : <><CalendarDays className="w-3.5 h-3.5" /> Suggest an Event</>
                }
              </Button>
            )}

            {/* Send a Spark */}
            <Button
              size="sm"
              className="w-full rounded-xl gap-2 bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => setSparkOpen(true)}
            >
              <Zap className="w-4 h-4" />
              Send a Spark
            </Button>
          </div>

          {/* Telegram hint */}
          <p className="text-[10px] text-center text-muted-foreground -mt-1">
            {person.telegram_username
              ? "On Telegram — they'll be notified instantly"
              : "They'll be notified next time they log in"}
          </p>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <SparkDialog
        person={person}
        open={sparkOpen}
        onClose={() => setSparkOpen(false)}
      />

      {suggestEventOpen && (
        <SuggestEventDialog
          person={person}
          sharedTypes={actionableShared}
          open={suggestEventOpen}
          onClose={() => setSuggestEventOpen(false)}
        />
      )}

      <PremiumUpsellDialog
        open={premiumUpsellOpen}
        onClose={() => setPremiumUpsellOpen(false)}
      />
    </>
  );
}
