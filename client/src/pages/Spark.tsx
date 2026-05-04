// client/src/pages/Spark.tsx
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, X, MapPin, Clock, Users, Check, Flame, Send, Timer, Trophy,
  ArrowLeft, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  useSparks, useMySparks, useCreateSpark, useCancelSpark,
  useRespondToSpark, useConfirmSpark, type Spark,
} from "@/hooks/use-sparks";
import { EVENT_CATEGORIES } from "@shared/categories";
import { WordBankSelector } from "@/components/WordBankSelector";

// ── Constants ─────────────────────────────────────────────────────────────────

const EXPIRE_OPTIONS = [
  { value: 30,  label: "30 minutes" },
  { value: 60,  label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 240, label: "4 hours" },
  { value: 480, label: "8 hours" },
];

const ACTIVITY_CATEGORIES = EVENT_CATEGORIES.filter(c =>
  ["social", "food", "outdoor", "sports", "culture", "games", "wellness", "networking", "language"].includes(c.value)
);

const CATEGORY_ICONS: Record<string, string> = {
  social: "🤝", food: "🍔", outdoor: "🏕️", sports: "⚽",
  culture: "🎨", games: "🎮", wellness: "🧘", networking: "🔗", language: "🌍",
};

// ── Word banks ────────────────────────────────────────────────────────────────

const ACTIVITIES = ACTIVITY_CATEGORIES.map(c => ({ value: c.value, label: c.label, icon: CATEGORY_ICONS[c.value] ?? "📌" }));

const LANGUAGE_INTERESTS = [
  { value: "english",  label: "English",   icon: "🇬🇧" },
  { value: "russian",  label: "Russian",   icon: "🇷🇺" },
  { value: "spanish",  label: "Spanish",   icon: "🇪🇸" },
  { value: "german",   label: "German",    icon: "🇩🇪" },
  { value: "french",   label: "French",    icon: "🇫🇷" },
  { value: "chinese",  label: "Chinese",   icon: "🇨🇳" },
  { value: "italian",  label: "Italian",   icon: "🇮🇹" },
  { value: "japanese", label: "Japanese",  icon: "🇯🇵" },
  { value: "korean",   label: "Korean",    icon: "🇰🇷" },
  { value: "arabic",   label: "Arabic",    icon: "🇸🇦" },
];

const BUSINESS_GOALS = [
  { value: "cofounder",   label: "Find a co-founder" },
  { value: "mentorship",  label: "Seek mentorship" },
  { value: "job",         label: "Explore job opportunities" },
  { value: "insights",    label: "Share industry insights" },
  { value: "collaborate", label: "Build collaborations" },
  { value: "pitch",       label: "Practice your pitch" },
];

const INTEREST_GROUPS = [
  { value: "creative",  label: "Creative workshops" },
  { value: "games",     label: "Board games & trivia" },
  { value: "fitness",   label: "Fitness & outdoor" },
  { value: "books",     label: "Book club" },
  { value: "music",     label: "Live music" },
  { value: "photography", label: "Photography walks" },
  { value: "culture",   label: "Cultural celebrations" },
];

const VENUE_CATEGORIES = [
  { value: "cafe",    label: "Café / Coffee Shop", icon: "☕" },
  { value: "bar",     label: "Bar / Pub",           icon: "🍸" },
  { value: "park",    label: "Park / Outdoor Space", icon: "🌳" },
  { value: "museum",  label: "Museum / Gallery",    icon: "🖼️" },
  { value: "cowork",  label: "Co‑working Space",    icon: "🏢" },
  { value: "library", label: "Library",             icon: "📚" },
  { value: "other",   label: "Other (specify)",     icon: "📍" },
];

const POPULAR_VENUES: Record<string, { value: string; label: string; icon?: string }[]> = {
  cafe: [
    { value: "surf",       label: "Surf Coffee", icon: "☕" },
    { value: "doubleshot", label: "Double B Coffee & Tea", icon: "☕" },
  ],
  bar: [
    { value: "redoctober", label: "Red October area", icon: "🍸" },
  ],
  park: [
    { value: "gorky",      label: "Gorky Park", icon: "🌳" },
    { value: "vdnkh",      label: "VDNKh", icon: "🌳" },
  ],
  museum: [
    { value: "garage",     label: "Garage Museum", icon: "🖼️" },
  ],
  cowork: [
    { value: "flacon",     label: "Flacon Design Factory", icon: "🏢" },
  ],
  library: [
    { value: "leninlib",   label: "Russian State Library", icon: "📚" },
  ],
};

const TITLES = [
  { value: "coffee",    label: "Coffee & Chat", icon: "☕" },
  { value: "bite",      label: "Quick Bite",     icon: "🍔" },
  { value: "stroll",    label: "Park Stroll",    icon: "🌳" },
  { value: "swap",      label: "Language Swap",  icon: "🌍" },
  { value: "brainstorm",label: "Brainstorm Walk", icon: "💡" },
  { value: "drinks",    label: "TGIF Drinks",    icon: "🍹" },
  { value: "culture",   label: "Culture Fix",    icon: "🎨" },
  { value: "game",      label: "Game On!",       icon: "🎮" },
];

// ── Create Spark form schema (still used for validation on submission) ────────

const createSchema = z.object({
  title:          z.string().min(3, "At least 3 characters").max(100),
  description:    z.string().max(500).optional(),
  activity:       z.string().min(1, "Pick an activity"),
  location:       z.string().min(2, "Enter a location").max(200),
  meetTimeDate:   z.string().min(1, "Pick a date"),
  meetTimeHour:   z.string().min(1, "Pick a time"),
  expiresInMins:  z.number().min(10).max(480),
  maxRespondents: z.number().min(1).max(20),
});
type CreateForm = z.infer<typeof createSchema>;

// ── Status badge config ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending:   { label: "Open",      className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  active:    { label: "Active",    className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200" },
  confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" },
  expired:   { label: "Expired",   className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200" },
};

// ── Timer countdown ───────────────────────────────────────────────────────────

function TimeLeft({ expiresAt }: { expiresAt: string }) {
  const expired = isPast(new Date(expiresAt));
  if (expired) return <span className="text-xs text-muted-foreground">Expired</span>;
  return (
    <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
      <Timer className="w-3 h-3" />
      {formatDistanceToNow(new Date(expiresAt), { addSuffix: false })} left
    </span>
  );
}

// ── Spark card (corrected with flat sender fields) ────────────────────────────

function SparkCard({
  spark,
  currentUserId,
  onRespond,
  onCancel,
  onConfirm,
}: {
  spark: Spark;
  currentUserId: string;
  onRespond: (spark: Spark, status: "accepted" | "declined") => void;
  onCancel:  (spark: Spark) => void;
  onConfirm: (spark: Spark) => void;
}) {
  const isMine     = spark.senderId === currentUserId;
  const myResponse = spark.myResponse;
  const accepted   = spark.responses.filter(r => r.status === "accepted");
  const isFull     = accepted.length >= spark.maxRespondents;
  const isExpiredOrClosed = ["expired", "cancelled", "confirmed"].includes(spark.status);
  const statusCfg  = STATUS_CONFIG[spark.status] ?? STATUS_CONFIG.pending;
  const catIcon    = CATEGORY_ICONS[spark.activity] ?? "📌";
  const catLabel   = ACTIVITY_CATEGORIES.find(c => c.value === spark.activity)?.label ?? spark.activity;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1,  y: 0 }}
      exit={{    opacity: 0,  scale: 0.96 }}
      className={`bg-card border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow ${
        isExpiredOrClosed ? "opacity-60" : ""
      } ${isMine ? "border-primary/30 ring-1 ring-primary/10" : "border-border"}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={spark.senderAvatarUrl ?? ""} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {(spark.senderDisplayName ?? "?").substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">
              {isMine ? "You" : spark.senderDisplayName ?? "Someone"}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(spark.createdAt), "h:mm a")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={`text-xs px-2 py-0.5 rounded-full border-0 font-medium ${statusCfg.className}`}>
            {statusCfg.label}
          </Badge>
          {isMine && !isExpiredOrClosed && (
            <button
              onClick={() => onCancel(spark)}
              className="text-muted-foreground hover:text-destructive transition-colors"
              title="Cancel spark"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="flex items-start gap-2 mb-3">
        <span className="text-2xl leading-none mt-0.5">{catIcon}</span>
        <div>
          <h3 className="font-bold text-base leading-snug">{spark.title}</h3>
          {spark.description && (
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{spark.description}</p>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-4">
        <span className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          {spark.location}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          {format(new Date(spark.meetTime), "MMM d · h:mm a")}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 shrink-0" />
          {accepted.length}/{spark.maxRespondents} going
        </span>
      </div>

      {/* Respondent avatars (anonymous for now) */}
      {accepted.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4">
          <div className="flex -space-x-2">
            {accepted.slice(0, 5).map(r => (
              <Avatar key={r.id} className="h-6 w-6 ring-2 ring-background">
                <AvatarImage src={""} />
                <AvatarFallback className="text-[10px] bg-gray-300 text-gray-600">
                  ?
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          {accepted.length > 5 && (
            <span className="text-xs text-muted-foreground">+{accepted.length - 5} more</span>
          )}
        </div>
      )}

      {/* Footer: expiry + actions */}
      <div className="flex items-center justify-between gap-3">
        <TimeLeft expiresAt={spark.expiresAt} />

        <div className="flex items-center gap-2">
          {isMine && spark.status === "active" && accepted.length > 0 && (
            <Button
              size="sm"
              className="rounded-full h-8 px-3 text-xs gap-1.5"
              onClick={() => onConfirm(spark)}
            >
              <Trophy className="w-3.5 h-3.5" /> Confirm group
            </Button>
          )}

          {!isMine && !isExpiredOrClosed && (
            myResponse?.status === "accepted" ? (
              <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium">
                <Check className="w-3.5 h-3.5" /> You're in!
                <button
                  onClick={() => onRespond(spark, "declined")}
                  className="text-muted-foreground hover:text-destructive text-xs underline ml-1"
                >
                  Undo
                </button>
              </div>
            ) : myResponse?.status === "declined" ? (
              <button
                onClick={() => onRespond(spark, "accepted")}
                className="text-xs text-muted-foreground hover:text-primary underline"
              >
                Change to accept
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isFull}
                  className="rounded-full h-8 px-3 text-xs gap-1.5 border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                  onClick={() => onRespond(spark, "accepted")}
                >
                  <Zap className="w-3.5 h-3.5" />
                  {isFull ? "Full" : "I'm in"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full h-8 px-3 text-xs text-muted-foreground"
                  onClick={() => onRespond(spark, "declined")}
                >
                  Pass
                </Button>
              </div>
            )
          )}

          {spark.status === "confirmed" && (
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Meet confirmed
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Confirm respondents dialog (with anonymous avatars) ───────────────────────

function ConfirmDialog({
  spark, open, onClose,
}: { spark: Spark | null; open: boolean; onClose: () => void }) {
  const confirmSpark = useConfirmSpark();
  const { toast }    = useToast();
  const [selected, setSelected] = useState<string[]>([]);

  const accepted = spark?.responses.filter(r => r.status === "accepted") ?? [];

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleConfirm = async () => {
    if (!spark || selected.length === 0) return;
    try {
      await confirmSpark.mutateAsync({ sparkId: spark.id, responderIds: selected });
      toast({ title: "Spark confirmed! 🎉", description: `${selected.length} people confirmed for your meetup.` });
      onClose();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm your group</AlertDialogTitle>
          <AlertDialogDescription>
            Select who's joining you for "{spark?.title}". Others will be notified they missed out.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 max-h-64 overflow-y-auto py-2">
          {accepted.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No accepted responses yet.</p>
          )}
          {accepted.map(r => (
            <button
              key={r.id}
              onClick={() => toggle(r.responderId)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                selected.includes(r.responderId)
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-muted/40 hover:bg-muted"
              }`}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={""} />
                <AvatarFallback className="text-xs bg-gray-300 text-gray-600">
                  ?
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 font-medium text-sm">Member</span>
              {r.message && <span className="text-xs text-muted-foreground italic truncate max-w-[100px]">"{r.message}"</span>}
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
            {confirmSpark.isPending ? "Confirming…" : `Confirm ${selected.length > 0 ? `(${selected.length})` : ""}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Updated CreateSparkSheet with word‑bank steps ─────────────────────────────

function CreateSparkSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createSpark = useCreateSpark();
  const { toast }   = useToast();
  const [step, setStep] = useState(0);

  // Step states
  const [activityChip, setActivityChip] = useState<string[]>([]);
  const [languageRoles, setLanguageRoles] = useState<string[]>([]);
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);
  const [proficiency, setProficiency] = useState<string[]>([]);
  const [businessGoals, setBusinessGoals] = useState<string[]>([]);
  const [interestChips, setInterestChips] = useState<string[]>([]);
  const [venueCategory, setVenueCategory] = useState<string[]>([]);
  const [popularPick, setPopularPick] = useState<string[]>([]);
  const [customLocation, setCustomLocation] = useState("");
  const [titleChip, setTitleChip] = useState<string[]>([]);
  const [meetTimeDate, setMeetTimeDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [meetTimeHour, setMeetTimeHour] = useState(format(new Date(Date.now() + 3600_000), "HH:00"));
  const [expiresInMins, setExpiresInMins] = useState(60);
  const [maxRespondents, setMaxRespondents] = useState(5);

  const resetForm = () => {
    setStep(0);
    setActivityChip([]);
    setLanguageRoles([]);
    setSelectedLangs([]);
    setProficiency([]);
    setBusinessGoals([]);
    setInterestChips([]);
    setVenueCategory([]);
    setPopularPick([]);
    setCustomLocation("");
    setTitleChip([]);
    setMeetTimeDate(format(new Date(), "yyyy-MM-dd"));
    setMeetTimeHour(format(new Date(Date.now() + 3600_000), "HH:00"));
    setExpiresInMins(60);
    setMaxRespondents(5);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, 3));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 0));

  const buildTitle = () => {
    if (titleChip.length > 0) {
      const chosen = TITLES.find(t => t.value === titleChip[0]);
      return chosen?.label ?? "Quick Meetup";
    }
    return "Quick Meetup";
  };

  const buildLocation = () => {
    if (popularPick.length > 0) {
      const allPopular = Object.values(POPULAR_VENUES).flat();
      const chosen = allPopular.find(v => v.value === popularPick[0]);
      return chosen?.label ?? customLocation;
    }
    if (venueCategory[0] === "other") return customLocation.trim() || "Moscow";
    if (venueCategory.length > 0) return venueCategory[0];
    return customLocation.trim() || "Moscow";
  };

  const buildInterests = () => {
    if (activityChip[0] === "language") {
      return [...selectedLangs, ...languageRoles];
    }
    if (activityChip[0] === "networking") {
      return businessGoals;
    }
    return interestChips;
  };

  const buildDescription = () => {
    let desc = "";
    if (activityChip[0] === "language") {
      desc = `Language exchange: ${selectedLangs.join(", ")}. `;
      if (languageRoles.length > 0) desc += `Roles: ${languageRoles.join(", ")}. `;
      if (proficiency.length > 0) desc += `Level: ${proficiency[0]}.`;
    } else if (activityChip[0] === "networking") {
      desc = `Networking goals: ${businessGoals.join(", ")}.`;
    } else {
      if (interestChips.length > 0) desc = `Interests: ${interestChips.join(", ")}.`;
    }
    return desc || undefined;
  };

  const handleSubmit = async () => {
    try {
      const meetTime = new Date(`${meetTimeDate}T${meetTimeHour}`).toISOString();
      await createSpark.mutateAsync({
        title:           buildTitle(),
        description:     buildDescription(),
        activity:        activityChip[0] || "social",
        location:        buildLocation(),
        meetTime,
        expiresInMins,
        maxRespondents,
        filterInterests: buildInterests().length ? buildInterests() : undefined,
      });
      toast({ title: "Spark sent! ⚡", description: "People nearby will see your ping." });
      resetForm();
      onClose();
    } catch (err: any) {
      toast({ title: "Failed to send spark", description: err.message, variant: "destructive" });
    }
  };

  const isActivityLang = activityChip[0] === "language";
  const isActivityBiz = activityChip[0] === "networking";
  const needsDetailsStep = isActivityLang || isActivityBiz;
  const actualSteps = needsDetailsStep ? 4 : 3; // skip step 2 for other activities

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl font-display flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" /> Spark
          </SheetTitle>
          <SheetDescription>
            Step {step + 1} of {actualSteps}
          </SheetDescription>
        </SheetHeader>

        {/* Step 0 – Activity */}
        {step === 0 && (
          <div className="space-y-4">
            <Label className="text-base">What are you up for?</Label>
            <WordBankSelector
              options={ACTIVITIES}
              selected={activityChip}
              onToggle={setActivityChip}
              multiSelect={false}
            />
          </div>
        )}

        {/* Step 1 – Details (only if language/networking) */}
        {step === 1 && isActivityLang && (
          <div className="space-y-6">
            <div>
              <Label>I am a…</Label>
              <WordBankSelector
                options={[
                  { value: "native", label: "Native Speaker" },
                  { value: "learner", label: "Learner (B1/B2)" },
                  { value: "beginner", label: "Beginner (A1/A2)" },
                ]}
                selected={languageRoles}
                onToggle={setLanguageRoles}
                multiSelect
              />
            </div>
            <div>
              <Label>Speaking / learning</Label>
              <WordBankSelector
                options={LANGUAGE_INTERESTS}
                selected={selectedLangs}
                onToggle={setSelectedLangs}
                multiSelect
              />
            </div>
            <div>
              <Label>Proficiency</Label>
              <WordBankSelector
                options={[
                  { value: "beginner", label: "Beginner" },
                  { value: "intermediate", label: "Intermediate" },
                  { value: "advanced", label: "Advanced" },
                ]}
                selected={proficiency}
                onToggle={setProficiency}
                multiSelect={false}
              />
            </div>
          </div>
        )}

        {step === 1 && isActivityBiz && (
          <div className="space-y-4">
            <Label>What are your networking goals?</Label>
            <WordBankSelector
              options={BUSINESS_GOALS}
              selected={businessGoals}
              onToggle={setBusinessGoals}
              multiSelect
            />
          </div>
        )}

        {/* Step 2 – Location */}
        {(step === 2 || (step === 1 && !needsDetailsStep)) && (
          <div className="space-y-5">
            <div>
              <Label>Pick a venue type</Label>
              <WordBankSelector
                options={VENUE_CATEGORIES}
                selected={venueCategory}
                onToggle={setVenueCategory}
                multiSelect={false}
              />
            </div>
            {venueCategory.length > 0 && POPULAR_VENUES[venueCategory[0]] && (
              <div>
                <Label>Popular spots</Label>
                <WordBankSelector
                  options={POPULAR_VENUES[venueCategory[0]]}
                  selected={popularPick}
                  onToggle={setPopularPick}
                  multiSelect={false}
                />
              </div>
            )}
            {(venueCategory[0] === "other" || venueCategory.length === 0) && (
              <div>
                <Label>Enter a location</Label>
                <Input
                  placeholder="Gorky Park, Surf Coffee, …"
                  value={customLocation}
                  onChange={e => setCustomLocation(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            )}
          </div>
        )}

        {/* Step 3 – Plan */}
        {step === actualSteps - 1 && (
          <div className="space-y-5">
            <div>
              <Label>Quick title</Label>
              <WordBankSelector
                options={TITLES}
                selected={titleChip}
                onToggle={setTitleChip}
                multiSelect={false}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={meetTimeDate} onChange={e => setMeetTimeDate(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div>
                <Label>Time</Label>
                <Input type="time" value={meetTimeHour} onChange={e => setMeetTimeHour(e.target.value)} className="h-11 rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Expires in</Label>
                <Select onValueChange={v => setExpiresInMins(parseInt(v))} value={String(expiresInMins)}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPIRE_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Max people</Label>
                <Input type="number" min={1} max={20} value={maxRespondents} onChange={e => setMaxRespondents(parseInt(e.target.value) || 5)} className="h-11 rounded-xl" />
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 pt-6">
          {step > 0 && (
            <Button variant="outline" className="flex-1 rounded-xl" onClick={prevStep}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          )}
          {step < actualSteps - 1 ? (
            <Button
              className="flex-1 rounded-xl gap-2"
              disabled={step === 0 && activityChip.length === 0}
              onClick={nextStep}
            >
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              className="flex-1 rounded-xl gap-2"
              disabled={createSpark.isPending}
              onClick={handleSubmit}
            >
              {createSpark.isPending ? "Sending…" : "Send Spark"}
              <Zap className="w-4 h-4" />
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main page (unchanged except it still renders SparkCard etc.) ──────────────

export default function SparkPage() {
  const { user }                    = useAuth();
  const { data: sparks,   isLoading } = useSparks();
  const { data: mySparks }          = useMySparks();
  const cancelSpark                 = useCancelSpark();
  const respondToSpark              = useRespondToSpark();
  const { toast }                   = useToast();

  const [createOpen,    setCreateOpen]    = useState(false);
  const [cancelTarget,  setCancelTarget]  = useState<Spark | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Spark | null>(null);
  const [activeFilter,  setActiveFilter]  = useState<string>("all");

  const currentUserId = String(user?.id ?? "");

  const filteredSparks = useMemo(() => {
    if (!sparks) return [];
    if (activeFilter === "all") return sparks;
    return sparks.filter(s => s.activity === activeFilter);
  }, [sparks, activeFilter]);

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

  const activeSentCount = mySparks?.filter(s => ["pending", "active"].includes(s.status)).length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

        {/* Hero */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-3xl font-bold">Spark</h1>
                <p className="text-sm text-muted-foreground">Impromptu meetups, right now</p>
              </div>
            </div>
            <p className="text-muted-foreground text-sm max-w-sm">
              Send a ping to members nearby. They accept, you confirm — no planning needed.
            </p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="rounded-full shadow-lg shadow-primary/20 gap-2 shrink-0"
          >
            <Zap className="w-4 h-4" /> Spark
          </Button>
        </div>

        {/* Activity filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
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
          {ACTIVITY_CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setActiveFilter(activeFilter === cat.value ? "all" : cat.value)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border whitespace-nowrap transition-all shrink-0 ${
                activeFilter === cat.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              <span>{CATEGORY_ICONS[cat.value]}</span>
              {cat.label}
            </button>
          ))}
        </div>

        <Tabs defaultValue="feed">
          <TabsList className="mb-6 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger value="feed" className="rounded-lg px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Flame className="w-4 h-4 mr-2" /> Live Feed
              {filteredSparks.length > 0 && (
                <span className="ml-2 bg-primary/15 text-primary text-xs rounded-full px-1.5 py-0.5 font-semibold">
                  {filteredSparks.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="mine" className="rounded-lg px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Send className="w-4 h-4 mr-2" /> My Sparks
              {activeSentCount > 0 && (
                <span className="ml-2 bg-amber-100 text-amber-700 text-xs rounded-full px-1.5 py-0.5 font-semibold">
                  {activeSentCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Live feed */}
          <TabsContent value="feed">
            {isLoading ? (
              <div className="text-center py-20">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
              </div>
            ) : filteredSparks.length === 0 ? (
              <div className="text-center py-24 bg-card border border-dashed border-border rounded-3xl">
                <Zap className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No sparks right now</h3>
                <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
                  Be the first to send a ping — someone nearby might be free too.
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

          {/* My sparks */}
          <TabsContent value="mine">
            {!mySparks || mySparks.length === 0 ? (
              <div className="text-center py-24 bg-card border border-dashed border-border rounded-3xl">
                <Send className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No sparks sent yet</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Create your first impromptu meetup ping.
                </p>
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

      {/* Sheets & dialogs */}
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
              "{cancelTarget?.title}" will be removed from the feed. Anyone who accepted will no longer see it.
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
