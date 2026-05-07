// client/src/pages/Spark.tsx
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, X, MapPin, Clock, Users, Check, Flame, Send, Timer,
  ChevronRight, Coffee, MessageCircle, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  useSparks, useMySparks, useCreateSpark, useCancelSpark,
  useRespondToSpark, useConfirmSpark, type Spark,
} from "@/hooks/use-sparks";

// ── Types ─────────────────────────────────────────────────────────────────────

type ActivityKey =
  | "coffee" | "food" | "drinks" | "walk" | "sport"
  | "language" | "culture" | "study" | "networking" | "other";

// ── Activity definitions ──────────────────────────────────────────────────────

const ACTIVITIES: {
  key: ActivityKey;
  label: string;
  emoji: string;
  hint: string;
  defaultTitle: string;
}[] = [
  { key: "coffee",      label: "Coffee & Chat",    emoji: "☕", hint: "A relaxed chat over coffee or tea",         defaultTitle: "Coffee & Chat"    },
  { key: "food",        label: "Grab a Bite",       emoji: "🍔", hint: "Lunch, dinner, or a quick snack together",  defaultTitle: "Grab a Bite"      },
  { key: "drinks",      label: "Evening Drinks",    emoji: "🍻", hint: "After-work drinks or a night out",          defaultTitle: "Evening Drinks"   },
  { key: "walk",        label: "Park / Stroll",     emoji: "🌳", hint: "A walk in a park or around the city",       defaultTitle: "Park Stroll"      },
  { key: "sport",       label: "Sport / Fitness",   emoji: "⚽", hint: "Workout, running, football, yoga…",         defaultTitle: "Let's Move"       },
  { key: "language",    label: "Language Exchange", emoji: "🗣️", hint: "Practise speaking a language together",     defaultTitle: "Language Swap"    },
  { key: "culture",     label: "Culture & Art",     emoji: "🎨", hint: "Museum, gallery, exhibition visit",         defaultTitle: "Culture Fix"      },
  { key: "study",       label: "Study / Co-work",   emoji: "📚", hint: "Work or study together in a café",          defaultTitle: "Co-working Sesh"  },
  { key: "networking",  label: "Networking",        emoji: "🤝", hint: "Professionals connecting over shared goals",defaultTitle: "Quick Catch-up"   },
  { key: "other",       label: "Something Else",    emoji: "✨", hint: "Describe your idea in a few words",         defaultTitle: "Quick Meetup"     },
];

// Extra detail options per activity
const LANGUAGE_OPTIONS = [
  { value: "english",  label: "English",  flag: "🇬🇧" },
  { value: "russian",  label: "Russian",  flag: "🇷🇺" },
  { value: "spanish",  label: "Spanish",  flag: "🇪🇸" },
  { value: "german",   label: "German",   flag: "🇩🇪" },
  { value: "french",   label: "French",   flag: "🇫🇷" },
  { value: "italian",  label: "Italian",  flag: "🇮🇹" },
  { value: "chinese",  label: "Chinese",  flag: "🇨🇳" },
  { value: "japanese", label: "Japanese", flag: "🇯🇵" },
  { value: "korean",   label: "Korean",   flag: "🇰🇷" },
  { value: "arabic",   label: "Arabic",   flag: "🇸🇦" },
];

const LEVEL_OPTIONS = [
  { value: "native",       label: "Native / Fluent" },
  { value: "advanced",     label: "Advanced (C1/C2)" },
  { value: "intermediate", label: "Intermediate (B1/B2)" },
  { value: "beginner",     label: "Beginner (A1/A2)" },
];

const NETWORKING_GOALS = [
  { value: "cofounder",   label: "Find a co-founder",          emoji: "🚀" },
  { value: "mentorship",  label: "Mentorship",                  emoji: "🎓" },
  { value: "job",         label: "Job opportunities",           emoji: "💼" },
  { value: "insights",    label: "Industry insights",           emoji: "💡" },
  { value: "collaborate", label: "Collaborations",              emoji: "🔗" },
];

const VENUE_TYPES = [
  { value: "cafe",    label: "Café",         emoji: "☕" },
  { value: "bar",     label: "Bar / Pub",    emoji: "🍸" },
  { value: "park",    label: "Park",         emoji: "🌳" },
  { value: "museum",  label: "Museum",       emoji: "🖼️" },
  { value: "cowork",  label: "Co-working",   emoji: "🏢" },
  { value: "other",   label: "Other",        emoji: "📍" },
];

const EXPIRE_OPTIONS = [
  { value: 30,  label: "30 min" },
  { value: 60,  label: "1 hr"   },
  { value: 120, label: "2 hrs"  },
  { value: 240, label: "4 hrs"  },
  { value: 480, label: "8 hrs"  },
];

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending:   { label: "Open",      className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  active:    { label: "Active",    className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200" },
  confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" },
  expired:   { label: "Expired",   className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200" },
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function TimeLeft({ expiresAt }: { expiresAt: string }) {
  if (isPast(new Date(expiresAt)))
    return <span className="text-xs text-muted-foreground">Expired</span>;
  return (
    <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
      <Timer className="w-3 h-3" />
      {formatDistanceToNow(new Date(expiresAt))} left
    </span>
  );
}

function ChipButton({
  selected, onClick, children,
}: { selected?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
        selected
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-card border-border text-foreground hover:border-primary/40 hover:bg-muted/40"
      }`}
    >
      {children}
    </button>
  );
}

// ── Spark Card ────────────────────────────────────────────────────────────────

function SparkCard({
  spark, currentUserId, onRespond, onCancel, onConfirm,
}: {
  spark: Spark;
  currentUserId: string;
  onRespond: (spark: Spark, status: "accepted" | "declined") => void;
  onCancel:  (spark: Spark) => void;
  onConfirm: (spark: Spark) => void;
}) {
  const isMine   = spark.senderId === currentUserId;
  const myRes    = spark.myResponse;
  const accepted = spark.responses.filter(r => r.status === "accepted");
  const isFull   = accepted.length >= spark.maxRespondents;
  const isClosed = ["expired", "cancelled", "confirmed"].includes(spark.status);
  const statusCfg = STATUS_CONFIG[spark.status] ?? STATUS_CONFIG.pending;

  const activity = ACTIVITIES.find(a => a.key === (spark.activity as ActivityKey));
  const emoji = activity?.emoji ?? "✨";

  // Parse a brief "why" from filterInterests or description
  const contextLines: string[] = [];
  if (spark.filterInterests?.length) {
    contextLines.push(spark.filterInterests.map(i => {
      const lang = LANGUAGE_OPTIONS.find(l => l.value === i);
      if (lang) return `${lang.flag} ${lang.label}`;
      const goal = NETWORKING_GOALS.find(g => g.value === i);
      if (goal) return `${goal.emoji} ${goal.label}`;
      return i;
    }).join(" · "));
  }
  if (spark.description && !contextLines.length) contextLines.push(spark.description);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`bg-card border rounded-2xl p-4 shadow-sm transition-shadow ${
        isClosed ? "opacity-55" : "hover:shadow-md"
      } ${isMine ? "border-primary/30 ring-1 ring-primary/10" : "border-border"}`}
    >
      {/* Row 1 – avatar + title + status */}
      <div className="flex items-start gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl shrink-0">
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-sm leading-tight truncate">{spark.title}</p>
            <Badge className={`text-xs px-2 py-0.5 rounded-full border-0 font-medium shrink-0 ${statusCfg.className}`}>
              {statusCfg.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Avatar className="h-4 w-4">
              <AvatarImage src={spark.senderAvatarUrl ?? ""} />
              <AvatarFallback className="text-[8px]">
                {(spark.senderDisplayName ?? "?").substring(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">
              {isMine ? "You" : spark.senderDisplayName ?? "Someone"}
            </span>
            {isMine && !isClosed && (
              <button
                onClick={() => onCancel(spark)}
                className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Context (why / languages / goals) */}
      {contextLines.length > 0 && (
        <p className="text-xs text-muted-foreground mb-2 leading-relaxed pl-[52px]">
          {contextLines[0]}
        </p>
      )}

      {/* Row 2 – meta */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3 pl-[52px]">
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3 shrink-0" /> {spark.location}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3 shrink-0" /> {format(new Date(spark.meetTime), "EEE d MMM · HH:mm")}
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3 shrink-0" /> {accepted.length}/{spark.maxRespondents} going
        </span>
        <TimeLeft expiresAt={spark.expiresAt} />
      </div>

      {/* Row 3 – CTA */}
      {!isClosed && !isMine && (
        <div className="flex gap-2 pl-[52px]">
          {myRes?.status === "accepted" ? (
            <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-semibold">
              <Check className="w-3.5 h-3.5" /> You're in!
            </span>
          ) : myRes?.status === "declined" ? (
            <span className="text-xs text-muted-foreground">You declined</span>
          ) : (
            <>
              <Button
                size="sm"
                className="rounded-xl h-8 px-4 text-xs"
                disabled={isFull}
                onClick={() => onRespond(spark, "accepted")}
              >
                {isFull ? "Full" : "Join ⚡"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-xl h-8 px-3 text-xs text-muted-foreground"
                onClick={() => onRespond(spark, "declined")}
              >
                Pass
              </Button>
            </>
          )}
        </div>
      )}

      {/* Sender confirm button */}
      {!isClosed && isMine && accepted.length > 0 && (
        <div className="flex items-center gap-3 pl-[52px]">
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl h-8 px-4 text-xs"
            onClick={() => onConfirm(spark)}
          >
            <Check className="w-3.5 h-3.5 mr-1" /> Confirm people ({accepted.length})
          </Button>
        </div>
      )}
    </motion.div>
  );
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  spark, open, onClose,
}: { spark: Spark | null; open: boolean; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const confirmSpark = useConfirmSpark();
  const { toast } = useToast();

  if (!spark) return null;
  const accepted = spark.responses.filter(r => r.status === "accepted");

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleConfirm = async () => {
    try {
      await confirmSpark.mutateAsync({ sparkId: spark.id, responderIds: selected });
      toast({ title: "Meetup confirmed! 🎉" });
      onClose();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Who's coming?</AlertDialogTitle>
          <AlertDialogDescription>
            Select the people you want to meet. They'll be notified.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto py-1">
          {accepted.map(r => (
            <button
              key={r.responderId}
              onClick={() => toggle(r.responderId)}
              className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${
                selected.includes(r.responderId)
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30"
              }`}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">?</AvatarFallback>
              </Avatar>
              <span className="flex-1 text-sm font-medium">Member</span>
              {r.message && (
                <span className="text-xs text-muted-foreground italic truncate max-w-[100px]">
                  "{r.message}"
                </span>
              )}
              {selected.includes(r.responderId) && <Check className="w-4 h-4 text-primary shrink-0" />}
            </button>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={selected.length === 0 || confirmSpark.isPending}
            onClick={handleConfirm}
          >
            {confirmSpark.isPending
              ? "Confirming…"
              : `Confirm${selected.length > 0 ? ` (${selected.length})` : ""}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Create Spark Sheet — redesigned ──────────────────────────────────────────

const TOTAL_STEPS = 4;

function stepTitle(step: number, activity: ActivityKey | null): string {
  switch (step) {
    case 0: return "What's the vibe?";
    case 1: return activity === "language"
        ? "Language details"
        : activity === "networking"
        ? "Your goals"
        : "A bit more detail";
    case 2: return "Where & when?";
    case 3: return "Almost done";
    default: return "";
  }
}

function stepDesc(step: number, activity: ActivityKey | null): string {
  switch (step) {
    case 0: return "Pick one activity — this tells people exactly what you're after.";
    case 1: return activity === "language"
        ? "Help others know whether this is for them."
        : activity === "networking"
        ? "What kind of connection are you looking for?"
        : "Add any extra context (optional).";
    case 2: return "Where do you want to meet and when?";
    case 3: return "Finalise the details and send your spark.";
    default: return "";
  }
}

function CreateSparkSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createSpark = useCreateSpark();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [activity,     setActivity]     = useState<ActivityKey | null>(null);
  const [languages,    setLanguages]    = useState<string[]>([]);
  const [myLevel,      setMyLevel]      = useState<string>("");
  const [networkGoals, setNetworkGoals] = useState<string[]>([]);
  const [freeNote,     setFreeNote]     = useState("");    // for "other" step-1
  const [venueType,    setVenueType]    = useState<string>("");
  const [locationText, setLocationText] = useState("");
  const [dateStr,      setDateStr]      = useState(format(new Date(), "yyyy-MM-dd"));
  const [timeStr,      setTimeStr]      = useState(format(new Date(Date.now() + 3_600_000), "HH:00"));
  const [expiresInMins,setExpires]      = useState(60);
  const [maxPeople,    setMaxPeople]    = useState(5);

  const resetAll = () => {
    setStep(0);
    setActivity(null);
    setLanguages([]);
    setMyLevel("");
    setNetworkGoals([]);
    setFreeNote("");
    setVenueType("");
    setLocationText("");
    setDateStr(format(new Date(), "yyyy-MM-dd"));
    setTimeStr(format(new Date(Date.now() + 3_600_000), "HH:00"));
    setExpires(60);
    setMaxPeople(5);
  };

  const handleClose = () => { resetAll(); onClose(); };

  // Step 1 is skipped for activities that don't need extra context
  const needsDetailStep = activity === "language" || activity === "networking";
  const skip1 = !needsDetailStep;

  const goNext = () => {
    if (step === 0 && skip1) { setStep(2); return; }
    setStep(s => s + 1);
  };
  const goBack = () => {
    if (step === 2 && skip1) { setStep(0); return; }
    setStep(s => s - 1);
  };

  // Derived values
  const actDef = ACTIVITIES.find(a => a.key === activity);

  const buildTitle = () => actDef?.defaultTitle ?? "Quick Meetup";

  const buildDescription = () => {
    if (activity === "language") {
      const langNames = languages.map(l => LANGUAGE_OPTIONS.find(o => o.value === l)?.label ?? l);
      const levelName = LEVEL_OPTIONS.find(o => o.value === myLevel)?.label ?? myLevel;
      return `Language exchange: ${langNames.join(" + ")}. Level: ${levelName}.`;
    }
    if (activity === "networking") {
      const goalNames = networkGoals.map(g => NETWORKING_GOALS.find(o => o.value === g)?.label ?? g);
      return `Networking: ${goalNames.join(", ")}.`;
    }
    return freeNote.trim() || undefined;
  };

  const buildInterests = () => {
    if (activity === "language") return languages;
    if (activity === "networking") return networkGoals;
    return [];
  };

  const buildLocation = () => {
    if (locationText.trim()) return locationText.trim();
    const vt = VENUE_TYPES.find(v => v.value === venueType);
    return vt ? `${vt.emoji} ${vt.label} in Moscow` : "Moscow";
  };

  const canProceed = (): boolean => {
    if (step === 0) return !!activity;
    if (step === 1) {
      if (activity === "language") return languages.length > 0;
      if (activity === "networking") return networkGoals.length > 0;
    }
    if (step === 2) return !!locationText.trim() || !!venueType;
    return true;
  };

  const handleSubmit = async () => {
    try {
      const meetTime = new Date(`${dateStr}T${timeStr}`).toISOString();
      await createSpark.mutateAsync({
        title:           buildTitle(),
        description:     buildDescription(),
        activity:        activity ?? "social",
        location:        buildLocation(),
        meetTime,
        expiresInMins,
        maxRespondents:  maxPeople,
        filterInterests: buildInterests().length ? buildInterests() : undefined,
      });
      toast({ title: "Spark sent! ⚡", description: "Nearby members will see your ping." });
      handleClose();
    } catch (err: any) {
      toast({ title: "Failed to send spark", description: err.message, variant: "destructive" });
    }
  };

  const effectiveStep = step; // visual step indicator
  const visibleSteps  = skip1 ? [0, 2, 3] : [0, 1, 2, 3];
  const visualIndex   = visibleSteps.indexOf(step);
  const visualTotal   = visibleSteps.length;

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[92vh] overflow-y-auto pb-safe">
        <SheetHeader className="mb-1 pt-2">
          {/* Dot progress */}
          <div className="flex justify-center gap-1.5 mb-4">
            {visibleSteps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === visualIndex
                    ? "w-6 bg-primary"
                    : i < visualIndex
                    ? "w-3 bg-primary/40"
                    : "w-3 bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>
          <SheetTitle className="text-xl font-display text-center">
            {stepTitle(step, activity)}
          </SheetTitle>
          <p className="text-sm text-muted-foreground text-center mt-0.5">
            {stepDesc(step, activity)}
          </p>
        </SheetHeader>

        <div className="mt-5 space-y-4 px-1">

          {/* ── Step 0: Activity ── */}
          {step === 0 && (
            <div className="grid grid-cols-2 gap-2.5">
              {ACTIVITIES.map(a => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setActivity(a.key)}
                  className={`flex flex-col items-start gap-1 p-3.5 rounded-2xl border text-left transition-all ${
                    activity === a.key
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-primary/30 hover:bg-muted/30"
                  }`}
                >
                  <span className="text-2xl">{a.emoji}</span>
                  <span className="font-semibold text-sm leading-tight">{a.label}</span>
                  <span className="text-xs text-muted-foreground leading-snug">{a.hint}</span>
                </button>
              ))}
            </div>
          )}

          {/* ── Step 1: Language details ── */}
          {step === 1 && activity === "language" && (
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-semibold mb-2 block">Languages involved</Label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGE_OPTIONS.map(l => (
                    <ChipButton
                      key={l.value}
                      selected={languages.includes(l.value)}
                      onClick={() =>
                        setLanguages(prev =>
                          prev.includes(l.value)
                            ? prev.filter(x => x !== l.value)
                            : [...prev, l.value]
                        )
                      }
                    >
                      {l.flag} {l.label}
                    </ChipButton>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold mb-2 block">My level</Label>
                <div className="flex flex-wrap gap-2">
                  {LEVEL_OPTIONS.map(l => (
                    <ChipButton
                      key={l.value}
                      selected={myLevel === l.value}
                      onClick={() => setMyLevel(l.value)}
                    >
                      {l.label}
                    </ChipButton>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 1: Networking goals ── */}
          {step === 1 && activity === "networking" && (
            <div>
              <Label className="text-sm font-semibold mb-2 block">What are you looking for?</Label>
              <div className="flex flex-wrap gap-2">
                {NETWORKING_GOALS.map(g => (
                  <ChipButton
                    key={g.value}
                    selected={networkGoals.includes(g.value)}
                    onClick={() =>
                      setNetworkGoals(prev =>
                        prev.includes(g.value)
                          ? prev.filter(x => x !== g.value)
                          : [...prev, g.value]
                      )
                    }
                  >
                    {g.emoji} {g.label}
                  </ChipButton>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 1: Other activity free note ── */}
          {step === 1 && activity && !["language", "networking"].includes(activity) && (
            <div>
              <Label className="text-sm font-semibold mb-2 block">Add a short note (optional)</Label>
              <textarea
                placeholder={`What specifically are you looking for? e.g. "${actDef?.hint}"`}
                value={freeNote}
                onChange={e => setFreeNote(e.target.value)}
                rows={3}
                maxLength={200}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
          )}

          {/* ── Step 2: Where & when ── */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Venue type */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Type of venue</Label>
                <div className="flex flex-wrap gap-2">
                  {VENUE_TYPES.map(v => (
                    <ChipButton
                      key={v.value}
                      selected={venueType === v.value}
                      onClick={() => setVenueType(venueType === v.value ? "" : v.value)}
                    >
                      {v.emoji} {v.label}
                    </ChipButton>
                  ))}
                </div>
              </div>

              {/* Location text */}
              <div>
                <Label className="text-sm font-semibold mb-1.5 block">
                  Specific location <span className="text-muted-foreground font-normal">(area, café, park…)</span>
                </Label>
                <Input
                  placeholder="e.g. Gorky Park, Surf Coffee Tverskaya, Flacon…"
                  value={locationText}
                  onChange={e => setLocationText(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>

              {/* Date & time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold mb-1.5 block">Date</Label>
                  <Input
                    type="date"
                    value={dateStr}
                    onChange={e => setDateStr(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold mb-1.5 block">Time</Label>
                  <Input
                    type="time"
                    value={timeStr}
                    onChange={e => setTimeStr(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Finalise ── */}
          {step === 3 && (
            <div className="space-y-5">

              {/* Summary card */}
              <div className="bg-muted/40 border border-border rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{actDef?.emoji}</span>
                  <span className="font-bold text-base">{buildTitle()}</span>
                </div>
                {buildDescription() && (
                  <p className="text-xs text-muted-foreground">{buildDescription()}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {buildLocation()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {dateStr} at {timeStr}
                  </span>
                </div>
              </div>

              {/* Expires & max people */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Spark expires in</Label>
                  <div className="flex flex-wrap gap-2">
                    {EXPIRE_OPTIONS.map(o => (
                      <ChipButton
                        key={o.value}
                        selected={expiresInMins === o.value}
                        onClick={() => setExpires(o.value)}
                      >
                        {o.label}
                      </ChipButton>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Max people</Label>
                  <div className="flex flex-wrap gap-2">
                    {[2, 3, 5, 8].map(n => (
                      <ChipButton
                        key={n}
                        selected={maxPeople === n}
                        onClick={() => setMaxPeople(n)}
                      >
                        {n}
                      </ChipButton>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex gap-3 mt-8 pb-4">
          {step > 0 && (
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-2xl"
              onClick={goBack}
            >
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button
              className="flex-1 h-12 rounded-2xl gap-2"
              disabled={!canProceed()}
              onClick={goNext}
            >
              Continue <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              className="flex-1 h-12 rounded-2xl gap-2 shadow-lg shadow-primary/20"
              disabled={createSpark.isPending}
              onClick={handleSubmit}
            >
              {createSpark.isPending ? "Sending…" : "Send Spark ⚡"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SparkPage() {
  const { user, isLoading: authLoading } = useAuth();
  const currentUserId = user ? String((user as any).id) : "";

  const { data: sparks, isLoading }        = useSparks();
  const { data: mySparks }                 = useMySparks();
  const respondToSpark                     = useRespondToSpark();
  const cancelSpark                        = useCancelSpark();
  const { toast }                          = useToast();

  const [createOpen,    setCreateOpen]    = useState(false);
  const [cancelTarget,  setCancelTarget]  = useState<Spark | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Spark | null>(null);
  const [activeFilter,  setActiveFilter]  = useState<ActivityKey | "all">("all");

  const filteredSparks = (sparks ?? []).filter(
    s => activeFilter === "all" || s.activity === activeFilter
  );

  const handleRespond = async (spark: Spark, status: "accepted" | "declined") => {
    try {
      await respondToSpark.mutateAsync({ sparkId: spark.id, status });
      if (status === "accepted") {
        toast({ title: "You're in! ⚡", description: `See you at ${spark.location}.` });
      }
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelSpark.mutateAsync(cancelTarget.id);
      toast({ title: "Spark cancelled" });
    } catch (err: any) {
      toast({ title: "Failed to cancel", description: err.message, variant: "destructive" });
    } finally {
      setCancelTarget(null);
    }
  };

  const activeSentCount = mySparks?.filter(s =>
    ["pending", "active"].includes(s.status)
  ).length ?? 0;

  // Group by activity for filter bar — only show activities with live sparks
  const activeActivities = [
    ...new Set((sparks ?? []).map(s => s.activity as ActivityKey)),
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">

        {/* Hero */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-11 h-11 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="font-display text-3xl font-bold leading-tight">Spark</h1>
                  <p className="text-sm text-muted-foreground">Spontaneous meetups, right now</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                Send a ping — tell people what you're up for, where, and when.
                They join, you confirm. No planning needed.
              </p>
            </div>
            <Button
              onClick={() => setCreateOpen(true)}
              className="rounded-full shadow-lg shadow-primary/20 gap-2 shrink-0 h-10"
            >
              <Zap className="w-4 h-4" /> New Spark
            </Button>
          </div>
        </div>

        {/* How it works — only if no sparks yet */}
        {!isLoading && (sparks ?? []).length === 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { icon: <Zap className="w-5 h-5 text-primary" />, label: "Send a spark", sub: "Pick activity, place & time" },
              { icon: <MessageCircle className="w-5 h-5 text-primary" />, label: "Others respond", sub: "Nearby members can join" },
              { icon: <Check className="w-5 h-5 text-primary" />, label: "You confirm", sub: "Pick who you want to meet" },
            ].map((s, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-3 text-center">
                <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-2">
                  {s.icon}
                </div>
                <p className="font-semibold text-xs">{s.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Activity filter */}
        {activeActivities.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-none">
            <button
              onClick={() => setActiveFilter("all")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border whitespace-nowrap transition-all shrink-0 ${
                activeFilter === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              <Flame className="w-3.5 h-3.5" /> All
            </button>
            {activeActivities.map(key => {
              const a = ACTIVITIES.find(x => x.key === key);
              if (!a) return null;
              return (
                <button
                  key={key}
                  onClick={() => setActiveFilter(activeFilter === key ? "all" : key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border whitespace-nowrap transition-all shrink-0 ${
                    activeFilter === key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <span>{a.emoji}</span> {a.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="feed">
          <TabsList className="mb-5 p-1 bg-muted/50 rounded-xl w-full">
            <TabsTrigger value="feed" className="flex-1 rounded-lg py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Flame className="w-4 h-4 mr-2" /> Live Feed
              {filteredSparks.length > 0 && (
                <span className="ml-2 bg-primary/15 text-primary text-xs rounded-full px-1.5 py-0.5 font-semibold">
                  {filteredSparks.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="mine" className="flex-1 rounded-lg py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Send className="w-4 h-4 mr-2" /> My Sparks
              {activeSentCount > 0 && (
                <span className="ml-2 bg-amber-100 text-amber-700 text-xs rounded-full px-1.5 py-0.5 font-semibold">
                  {activeSentCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feed">
            {isLoading ? (
              <div className="text-center py-20">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
              </div>
            ) : filteredSparks.length === 0 ? (
              <div className="text-center py-20 bg-card border border-dashed border-border rounded-3xl">
                <Zap className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No sparks right now</h3>
                <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
                  Be the first — send a ping and see who's free.
                </p>
                <Button onClick={() => setCreateOpen(true)} className="rounded-full gap-2">
                  <Zap className="w-4 h-4" /> Send the first Spark
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {filteredSparks.map(spark => (
                    <SparkCard
                      key={spark.id}
                      spark={spark}
                      currentUserId={currentUserId}
                      onRespond={handleRespond}
                      onCancel={setCancelTarget}
                      onConfirm={setConfirmTarget}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          <TabsContent value="mine">
            {!mySparks || mySparks.length === 0 ? (
              <div className="text-center py-20 bg-card border border-dashed border-border rounded-3xl">
                <Send className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No sparks sent yet</h3>
                <p className="text-muted-foreground text-sm mb-6">Create your first meetup ping.</p>
                <Button onClick={() => setCreateOpen(true)} className="rounded-full gap-2">
                  <Zap className="w-4 h-4" /> Send a Spark
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {mySparks.map(spark => (
                    <SparkCard
                      key={spark.id}
                      spark={spark}
                      currentUserId={currentUserId}
                      onRespond={handleRespond}
                      onCancel={setCancelTarget}
                      onConfirm={setConfirmTarget}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Sheets & Dialogs */}
      <CreateSparkSheet open={createOpen} onClose={() => setCreateOpen(false)} />

      <ConfirmDialog
        spark={confirmTarget}
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={v => { if (!v) setCancelTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this spark?</AlertDialogTitle>
            <AlertDialogDescription>
              "{cancelTarget?.title}" will be removed from the feed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelSpark.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelSpark.isPending ? "Cancelling…" : "Cancel Spark"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
