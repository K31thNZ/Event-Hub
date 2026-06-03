// client/src/components/language/LanguageUserCard.tsx
// "Send a Spark" flow:
//   - Opens a modal to pick 1-3 suggested meeting times
//   - Calls POST /api/language-exchange/spark on meh-auth
//   - If both users have Telegram, they each get a bot message with the match's profile card
//   - Falls back gracefully if either side has no Telegram

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { MapPin, Languages, Zap, Plus, X, Check, Loader2 } from "lucide-react";
import { LANGUAGES } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "https://auth.expatevents.org";

interface LearningLanguage {
  code:        string;
  proficiency: string;
}

interface LanguageUser {
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

function getLangFlag(code: string): string {
  return LANGUAGES.find(l => l.code === code)?.flag ?? "🌐";
}

function getLangLabel(code: string): string {
  return LANGUAGES.find(l => l.code === code)?.label ?? code.toUpperCase();
}

// ── Time slot picker ──────────────────────────────────────────────────────────
// Generates a set of convenient upcoming time options (today + next 3 days,
// at 10:00, 14:00, 18:00, 20:00 in local time) for the user to tick.

function buildTimeOptions(): { iso: string; label: string }[] {
  const options: { iso: string; label: string }[] = [];
  const now = new Date();
  const hours = [10, 14, 18, 20];
  const dayNames = ["Today", "Tomorrow"];

  for (let d = 0; d < 4; d++) {
    const date = new Date(now);
    date.setDate(now.getDate() + d);

    for (const h of hours) {
      const slot = new Date(date);
      slot.setHours(h, 0, 0, 0);
      if (slot <= now) continue; // skip past slots

      const dayLabel =
        d === 0 ? "Today" :
        d === 1 ? "Tomorrow" :
        slot.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

      options.push({
        iso: slot.toISOString(),
        label: `${dayLabel} ${h.toString().padStart(2, "0")}:00`,
      });
    }
  }
  return options.slice(0, 12); // max 12 options
}

// ── Spark dialog ───────────────────────────────────────────────────────────────

interface SparkDialogProps {
  person:    LanguageUser;
  open:      boolean;
  onClose:   () => void;
}

function SparkDialog({ person, open, onClose }: SparkDialogProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);

  const timeOptions = buildTimeOptions();

  const toggle = (iso: string) => {
    setSelected(prev =>
      prev.includes(iso)
        ? prev.filter(t => t !== iso)
        : prev.length >= 3
          ? [...prev.slice(1), iso]   // slide window — keep max 3
          : [...prev, iso]
    );
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await fetch(`${AUTH_URL}/api/language-exchange/spark`, {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({
          recipientId:    Number(person.id),
          availableTimes: selected,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to send spark");

      setSent(true);

      const bothOnTg = json.senderHasTelegram && json.recipientHasTelegram;
      const recipientOnTg = json.recipientHasTelegram;

      toast({
        title: "⚡ Spark sent!",
        description: bothOnTg
          ? `You and ${person.full_name} both got a Telegram message with each other's profile.`
          : recipientOnTg
            ? `${person.full_name} got a Telegram message. Connect your own Telegram to get notified when they reply.`
            : `${person.full_name} hasn't connected Telegram yet — they'll see your spark next time they log in.`,
      });
    } catch (err: any) {
      toast({ title: "Failed to send spark", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (!sending) {
      setSent(false);
      setSelected([]);
      onClose();
    }
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
              : "Pick up to 3 times that work for you. They'll get a Telegram message with your profile card and your suggested slots."}
          </DialogDescription>
        </DialogHeader>

        {!sent ? (
          <>
            {/* Match profile mini-card */}
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
                      {isOn
                        ? <Check className="w-3 h-3 shrink-0" />
                        : <Plus className="w-3 h-3 shrink-0 opacity-40" />
                      }
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
              <Button variant="outline" onClick={handleClose} disabled={sending} className="rounded-xl">
                Cancel
              </Button>
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
                ? <>You can also message them directly on Telegram: <a href={`https://t.me/${person.telegram_username}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">@{person.telegram_username}</a></>
                : "They'll see your spark when they next visit the Language Exchange."}
            </p>
            <Button onClick={handleClose} className="rounded-xl w-full">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main card component ───────────────────────────────────────────────────────

export default function LanguageUserCard({ person }: LanguageUserCardProps) {
  const [sparkOpen, setSparkOpen] = useState(false);

  return (
    <>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-200 flex flex-col">
        <CardContent className="p-5 space-y-3.5 flex-1 flex flex-col">
          {/* Header: avatar + name + location */}
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage src={person.avatar_url} alt={person.full_name} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {person.full_name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{person.full_name}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 flex-wrap">
                {person.city && (
                  <>
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span>{person.city}</span>
                    {person.age_group && <span className="mx-0.5">·</span>}
                  </>
                )}
                {person.age_group && <span>{person.age_group}</span>}
              </div>
            </div>
            {/* Telegram indicator */}
            {person.telegram_username && (
              <span title="On Telegram" className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-1.5 py-0.5 shrink-0 font-medium">
                ✈️ TG
              </span>
            )}
          </div>

          {/* Bio */}
          {person.bio && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{person.bio}</p>
          )}

          {/* Native languages */}
          {person.native.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide flex items-center gap-1">
                <Languages className="w-3 h-3" /> Native
              </p>
              <div className="flex flex-wrap gap-1.5">
                {person.native.map(code => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
                  >
                    {getLangFlag(code)} {getLangLabel(code)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Learning languages */}
          {person.learning.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Learning</p>
              <div className="flex flex-wrap gap-1.5">
                {person.learning.map(({ code, proficiency }) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border text-xs font-medium"
                  >
                    {getLangFlag(code)} {getLangLabel(code)}
                    <span className={`ml-1 px-1.5 py-0 rounded-full text-[10px] font-bold ${PROFICIENCY_COLORS[proficiency] ?? "bg-muted text-muted-foreground"}`}>
                      {proficiency}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Interests */}
          {person.interests.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Interests</p>
              <div className="flex flex-wrap gap-1.5">
                {person.interests.slice(0, 5).map(interest => (
                  <span
                    key={interest}
                    className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground text-xs"
                  >
                    #{interest}
                  </span>
                ))}
                {person.interests.length > 5 && (
                  <span className="text-xs text-muted-foreground self-center">+{person.interests.length - 5}</span>
                )}
              </div>
            </div>
          )}

          {/* Meeting types */}
          {person.meeting_types.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Meeting Style</p>
              <div className="flex flex-wrap gap-1.5">
                {person.meeting_types.map(type => (
                  <Badge key={type} variant="secondary" className="text-xs rounded-full">
                    {MEETING_TYPE_LABELS[type] ?? type}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Send a Spark button */}
          <Button
            size="sm"
            className="w-full rounded-xl gap-2 mt-1 bg-amber-500 hover:bg-amber-600 text-white"
            onClick={() => setSparkOpen(true)}
          >
            <Zap className="w-4 h-4" />
            Send a Spark
          </Button>

          {/* Subtle telegram hint below */}
          <p className="text-[10px] text-center text-muted-foreground -mt-1">
            {person.telegram_username
              ? "They're on Telegram — they'll get notified instantly"
              : "They'll be notified next time they log in"}
          </p>
        </CardContent>
      </Card>

      <SparkDialog
        person={person}
        open={sparkOpen}
        onClose={() => setSparkOpen(false)}
      />
    </>
  );
}
