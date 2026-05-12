// client/src/pages/Spark.tsx
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, X, MapPin, Clock, Users, Check, Flame, Send, Timer, Trophy,
  ArrowLeft, ArrowRight, Search, Star, Plus, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  useSparks,
  useMySparks,
  useCreateSpark,
  useCancelSpark,
  useRespondToSpark,
  useConfirmSpark,
  type Spark,
} from "@/hooks/use-sparks";
import { EVENT_CATEGORIES } from "@shared/categories";
import { WordBankSelector } from "@/components/WordBankSelector";
import { loadYandexMaps } from "@/utils/yandex-maps";

declare global {
  interface Window {
    ymaps: any;
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const YANDEX_MAPS_API_KEY = import.meta.env.VITE_YANDEX_MAPS_API_KEY as string;
const YANDEX_SEARCH_API_KEY = import.meta.env
  .VITE_YANDEX_SEARCH_API_KEY as string;

const EXPIRE_OPTIONS = [
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 240, label: "4 hours" },
  { value: 480, label: "8 hours" },
];

// ── Activity & Goal configuration ────────────────────────────────────────────
// Each activity has an icon, label, and a list of sub‑goals that appear after selection.

type ActivityConfig = {
  label: string;
  icon: string;
  goals: { value: string; label: string }[];
};

const ACTIVITIES_CONFIG: Record<string, ActivityConfig> = {
  coffee: {
    label: "Coffee & Chat",
    icon: "☕",
    goals: [
      { value: "friendly_chat", label: "Friendly chat" },
      { value: "deep_convo", label: "Deep conversation" },
      { value: "networking", label: "Casual networking" },
      { value: "language_practice", label: "Language practice" },
      { value: "first_meet", label: "First meet / icebreaker" },
    ],
  },
  drinks: {
    label: "Drinks out",
    icon: "🍹",
    goals: [
      { value: "tgif", label: "TGIF unwind" },
      { value: "cocktails", label: "Cocktails & chat" },
      { value: "wine", label: "Wine tasting" },
      { value: "pub_quiz", label: "Pub quiz" },
      { value: "afterwork", label: "After‑work social" },
    ],
  },
  food: {
    label: "Food & dining",
    icon: "🍽️",
    goals: [
      { value: "brunch", label: "Brunch" },
      { value: "dinner", label: "Dinner" },
      { value: "lunch_break", label: "Quick lunch" },
      { value: "street_food", label: "Street food crawl" },
      { value: "potluck", label: "Potluck / picnic" },
      { value: "cooking", label: "Cook together" },
    ],
  },
  outdoor: {
    label: "Outdoor & parks",
    icon: "🌳",
    goals: [
      { value: "walk", label: "Leisure walk" },
      { value: "hiking", label: "Hiking / trail" },
      { value: "park_sports", label: "Park games / frisbee" },
      { value: "cycling", label: "Cycling" },
      { value: "photowalk", label: "Photography walk" },
      { value: "picnic", label: "Picnic" },
    ],
  },
  culture: {
    label: "Museums & culture",
    icon: "🏛️",
    goals: [
      { value: "museum", label: "Museum visit" },
      { value: "gallery", label: "Art gallery" },
      { value: "exhibition", label: "Temporary exhibition" },
      { value: "architecture", label: "Architecture tour" },
      { value: "history", label: "History walk" },
    ],
  },
  music: {
    label: "Live music & gigs",
    icon: "🎵",
    goals: [
      { value: "live_band", label: "Live band" },
      { value: "open_mic", label: "Open mic" },
      { value: "karaoke", label: "Karaoke" },
      { value: "dj_set", label: "DJ set" },
      { value: "jam_session", label: "Jam session" },
    ],
  },
  games: {
    label: "Games & trivia",
    icon: "🎲",
    goals: [
      { value: "board_games", label: "Board games" },
      { value: "card_games", label: "Card games" },
      { value: "video_games", label: "Video gaming" },
      { value: "trivia", label: "Trivia / quiz" },
      { value: "escape_room", label: "Escape room" },
      { value: "rpg", label: "TTRPG / D&D" },
    ],
  },
  sports: {
    label: "Sports & fitness",
    icon: "⚽",
    goals: [
      { value: "football", label: "Football" },
      { value: "basketball", label: "Basketball" },
      { value: "volleyball", label: "Volleyball" },
      { value: "yoga", label: "Yoga" },
      { value: "running", label: "Running group" },
      { value: "gym", label: "Gym workout" },
      { value: "climbing", label: "Rock climbing" },
    ],
  },
  wellness: {
    label: "Wellness & self‑care",
    icon: "🧘",
    goals: [
      { value: "meditation", label: "Meditation" },
      { value: "yoga_wellness", label: "Yoga" },
      { value: "breathwork", label: "Breathwork" },
      { value: "spa", label: "Spa / sauna" },
      { value: "mental_health", label: "Mental health chat" },
    ],
  },
  networking: {
    label: "Networking & biz",
    icon: "💼",
    goals: [
      { value: "cofounder", label: "Find a co‑founder" },
      { value: "mentorship", label: "Seek mentorship" },
      { value: "job", label: "Explore job opportunities" },
      { value: "insights", label: "Share industry insights" },
      { value: "collaborate", label: "Build collaborations" },
      { value: "pitch", label: "Practice your pitch" },
    ],
  },
  language: {
    label: "Language exchange",
    icon: "🌍",
    goals: [
      { value: "eng_ru", label: "English–Russian" },
      { value: "spanish", label: "Spanish" },
      { value: "german", label: "German" },
      { value: "french", label: "French" },
      { value: "chinese", label: "Chinese" },
      { value: "italian", label: "Italian" },
      { value: "japanese", label: "Japanese" },
      { value: "korean", label: "Korean" },
      { value: "arabic", label: "Arabic" },
    ],
  },
  volunteering: {
    label: "Volunteering",
    icon: "🙌",
    goals: [
      { value: "cleanup", label: "Community cleanup" },
      { value: "teaching", label: "Teaching / mentoring" },
      { value: "charity", label: "Charity work" },
      { value: "animal", label: "Animal shelter" },
    ],
  },
  creative: {
    label: "Creative & DIY",
    icon: "🎨",
    goals: [
      { value: "painting", label: "Painting / drawing" },
      { value: "crafts", label: "Crafts workshop" },
      { value: "photography", label: "Photography walk" },
      { value: "writing", label: "Writing circle" },
      { value: "pottery", label: "Pottery" },
    ],
  },
  movies: {
    label: "Movies & film",
    icon: "🎬",
    goals: [
      { value: "cinema", label: "Cinema night" },
      { value: "movie_night", label: "Home movie night" },
      { value: "film_discussion", label: "Film discussion" },
    ],
  },
  bookclub: {
    label: "Book club",
    icon: "📚",
    goals: [
      { value: "fiction", label: "Fiction" },
      { value: "nonfiction", label: "Non‑fiction" },
      { value: "sci_fi", label: "Sci‑fi / fantasy" },
      { value: "poetry", label: "Poetry" },
    ],
  },
  dance: {
    label: "Dancing",
    icon: "💃",
    goals: [
      { value: "salsa", label: "Salsa" },
      { value: "bachata", label: "Bachata" },
      { value: "swing", label: "Swing" },
      { value: "tango", label: "Tango" },
      { value: "club_dance", label: "Club dancing" },
    ],
  },
  shopping: {
    label: "Shopping & markets",
    icon: "🛍️",
    goals: [
      { value: "flea_market", label: "Flea market" },
      { value: "vintage", label: "Vintage shops" },
      { value: "mall", label: "Mall crawl" },
      { value: "farmers_market", label: "Farmers market" },
    ],
  },
};

// The activity keys used for the “vibe” chips
const ACTIVITY_CHIPS = Object.entries(ACTIVITIES_CONFIG).map(
  ([value, config]) => ({
    value,
    label: config.label,
    icon: config.icon,
  })
);

// Quick‑title presets (unchanged)
const TITLES = [
  { value: "coffee", label: "Coffee & Chat", icon: "☕" },
  { value: "bite", label: "Quick Bite", icon: "🍔" },
  { value: "stroll", label: "Park Stroll", icon: "🌳" },
  { value: "swap", label: "Language Swap", icon: "🌍" },
  { value: "brainstorm", label: "Brainstorm Walk", icon: "💡" },
  { value: "drinks", label: "TGIF Drinks", icon: "🍹" },
  { value: "culture", label: "Culture Fix", icon: "🎨" },
  { value: "game", label: "Game On!", icon: "🎲" },
];

// Status badge config (unchanged)
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Open",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  },
  active: {
    label: "Active",
    className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  },
  expired: {
    label: "Expired",
    className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200",
  },
};

// ── Reverse geocode helper ────────────────────────────────────────────────────

async function reverseGeocode(
  coords: number[]
): Promise<{ address: string; city: string }> {
  try {
    let result = await window.ymaps.geocode(coords, {
      kind: "house",
      results: 1,
    });
    let geo = result.geoObjects.get(0);
    if (!geo) {
      result = await window.ymaps.geocode(coords);
      geo = result.geoObjects.get(0);
    }
    return {
      address: geo?.getAddressLine() ?? "",
      city: geo?.getLocalities()?.[0] ?? "",
    };
  } catch {
    return { address: "", city: "" };
  }
}

// ── Timer countdown ───────────────────────────────────────────────────────────

function TimeLeft({ expiresAt }: { expiresAt: string }) {
  const expired = isPast(new Date(expiresAt));
  if (expired)
    return <span className="text-xs text-muted-foreground">Expired</span>;
  return (
    <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
      <Timer className="w-3 h-3" />
      {formatDistanceToNow(new Date(expiresAt), { addSuffix: false })} left
    </span>
  );
}

// ── Spark card (unchanged, added feedback trigger) ────────────────────────────

function SparkCard({
  spark,
  currentUserId,
  onRespond,
  onCancel,
  onConfirm,
  onLeaveFeedback,
}: {
  spark: Spark;
  currentUserId: string;
  onRespond: (spark: Spark, status: "accepted" | "declined") => void;
  onCancel: (spark: Spark) => void;
  onConfirm: (spark: Spark) => void;
  onLeaveFeedback: (spark: Spark) => void;
}) {
  const isMine = spark.senderId === currentUserId;
  const accepted = spark.responses.filter((r) => r.status === "accepted");
  const isFull = accepted.length >= spark.maxRespondents;
  const isClosedStatus = ["expired", "cancelled", "confirmed"].includes(
    spark.status
  );
  const statusCfg = STATUS_CONFIG[spark.status] ?? STATUS_CONFIG.pending;
  const catIcon =
    ACTIVITIES_CONFIG[spark.activity]?.icon ?? spark.activity ?? "📌";

  // Show feedback button when the meetup is confirmed and the time has passed
  const canLeaveFeedback =
    spark.status === "confirmed" && isPast(new Date(spark.meetTime));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={`bg-card border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow ${
        isClosedStatus ? "opacity-60" : ""
      } ${
        isMine ? "border-primary/30 ring-1 ring-primary/10" : "border-border"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={spark.senderAvatarUrl ?? ""} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {(spark.senderDisplayName ?? "?")
                .substring(0, 2)
                .toUpperCase()}
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
          <Badge
            className={`text-xs px-2 py-0.5 rounded-full border-0 font-medium ${statusCfg.className}`}
          >
            {statusCfg.label}
          </Badge>
          {isMine && !isClosedStatus && (
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

      {/* Title + description */}
      <div className="flex items-start gap-2 mb-3">
        <span className="text-2xl leading-none mt-0.5">{catIcon}</span>
        <div>
          <h3 className="font-bold text-base leading-snug">{spark.title}</h3>
          {spark.description && (
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-3">
              {spark.description}
            </p>
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

      {/* Respondent avatars */}
      {accepted.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4">
          <div className="flex -space-x-2">
            {accepted.slice(0, 5).map((r) => (
              <Avatar key={r.id} className="h-6 w-6 ring-2 ring-background">
                <AvatarImage src={""} />
                <AvatarFallback className="text-[10px] bg-gray-300 text-gray-600">
                  ?
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          {accepted.length > 5 && (
            <span className="text-xs text-muted-foreground">
              +{accepted.length - 5} more
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
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
          {!isMine &&
            !isClosedStatus &&
            (spark.myResponse?.status === "accepted" ? (
              <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium">
                <Check className="w-3.5 h-3.5" /> You're in!
                <button
                  onClick={() => onRespond(spark, "declined")}
                  className="text-muted-foreground hover:text-destructive text-xs underline ml-1"
                >
                  Undo
                </button>
              </div>
            ) : spark.myResponse?.status === "declined" ? (
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
            ))}
          {spark.status === "confirmed" && (
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Meet confirmed
            </span>
          )}
          {/* New: Leave feedback after meetup */}
          {canLeaveFeedback && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full h-8 px-3 text-xs gap-1.5"
              onClick={() => onLeaveFeedback(spark)}
            >
              <Star className="w-3.5 h-3.5" /> Rate meetup
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Confirm respondents dialog (unchanged) ────────────────────────────────────

function ConfirmDialog({
  spark,
  open,
  onClose,
}: {
  spark: Spark | null;
  open: boolean;
  onClose: () => void;
}) {
  const confirmSpark = useConfirmSpark();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);

  const accepted =
    spark?.responses.filter((r) => r.status === "accepted") ?? [];
  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleConfirm = async () => {
    if (!spark || selected.length === 0) return;
    try {
      await confirmSpark.mutateAsync({
        sparkId: spark.id,
        responderIds: selected,
      });
      toast({
        title: "Spark confirmed! 🎉",
        description: `${selected.length} people confirmed for your meetup.`,
      });
      onClose();
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm your group</AlertDialogTitle>
          <AlertDialogDescription>
            Select who's joining you for "{spark?.title}". Others will be
            notified they missed out.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 max-h-64 overflow-y-auto py-2">
          {accepted.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No accepted responses yet.
            </p>
          )}
          {accepted.map((r) => (
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
                <AvatarFallback className="text-xs bg-gray-300 text-gray-600">
                  ?
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 font-medium text-sm">Member</span>
              {r.message && (
                <span className="text-xs text-muted-foreground italic truncate max-w-[100px]">
                  "{r.message}"
                </span>
              )}
              {selected.includes(r.responderId) && (
                <Check className="w-4 h-4 text-primary shrink-0" />
              )}
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
              : `Confirm ${
                  selected.length > 0 ? `(${selected.length})` : ""
                }`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Feedback Modal (new) ──────────────────────────────────────────────────────

function FeedbackModal({
  spark,
  open,
  onClose,
}: {
  spark: Spark | null;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [makeRegular, setMakeRegular] = useState(false);

  const handleSubmit = async () => {
    // In real life you would POST to your API
    toast({
      title: "Feedback sent! 💌",
      description: `You rated this meetup ${rating}/5. ${
        makeRegular
          ? "We'll let the organiser know you'd like it to become a regular event."
          : ""
      }`,
    });
    // Reset and close
    setRating(0);
    setFeedback("");
    setMakeRegular(false);
    onClose();
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>How was your meetup?</AlertDialogTitle>
          <AlertDialogDescription>
            "{spark?.title}" is over — leave a quick rating and let us know if
            you'd like it to become a regular thing.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          {/* Star rating */}
          <div>
            <Label className="mb-2 block">Overall rating</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="text-2xl focus:outline-none"
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= rating
                        ? "text-amber-400 fill-amber-400"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Quick feedback */}
          <div>
            <Label className="mb-2 block">A few words (optional)</Label>
            <Textarea
              placeholder="What went well? What could be improved?"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="rounded-xl min-h-[80px]"
              maxLength={300}
            />
          </div>

          {/* Make regular */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="makeRegular"
              checked={makeRegular}
              onChange={(e) => setMakeRegular(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="makeRegular" className="text-sm cursor-pointer">
              I’d like this to become a regular event
            </Label>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Skip</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmit}
            disabled={rating === 0}
            className="gap-2"
          >
            <Star className="w-4 h-4" /> Submit
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Map location picker (unchanged) ───────────────────────────────────────────

interface SparkMapPickerProps {
  lat: number | null;
  lng: number | null;
  onLocationSelect: (lat: number, lng: number, address: string) => void;
}

function SparkMapPicker({ lat, lng, onLocationSelect }: SparkMapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [apiLoaded, setApiLoaded] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadYandexMaps(YANDEX_MAPS_API_KEY)
      .then(() => setApiLoaded(true))
      .catch((err) => console.error("Yandex Maps load error:", err));
  }, []);

  useEffect(() => {
    if (!apiLoaded || !mapRef.current || mapInstance) return;
    const center = [lat ?? 55.7558, lng ?? 37.6173];
    const newMap = new window.ymaps.Map(mapRef.current, {
      center,
      zoom: lat && lng ? 16 : 13,
      controls: ["zoomControl"],
    });
    setMapInstance(newMap);

    const newMarker = new window.ymaps.Placemark(center, {}, {
      draggable: true,
      preset: "islands#violetIcon",
    });
    newMap.geoObjects.add(newMarker);
    setMarker(newMarker);

    newMap.events.add("click", async (e: any) => {
      const coords = e.get("coords");
      newMarker.geometry.setCoordinates(coords);
      const { address } = await reverseGeocode(coords);
      onLocationSelect(coords[0], coords[1], address);
    });

    newMarker.events.add("dragend", async () => {
      const coords = newMarker.geometry.getCoordinates();
      const { address } = await reverseGeocode(coords);
      onLocationSelect(coords[0], coords[1], address);
    });
  }, [apiLoaded]);

  useEffect(() => {
    if (marker && lat && lng) {
      marker.geometry.setCoordinates([lat, lng]);
      mapInstance?.setCenter([lat, lng], 16, { duration: 300 });
    }
  }, [lat, lng, marker, mapInstance]);

  const performSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setResultsOpen(false);
        return;
      }
      setSearchLoading(true);
      setSearchError(null);
      try {
        const center = mapInstance?.getCenter() ?? [55.7558, 37.6173];
        const url = `https://search-maps.yandex.ru/v1/?text=${encodeURIComponent(
          q
        )}&type=biz&ll=${center[1]},${center[0]}&spn=0.1,0.1&lang=en_RU&apikey=${YANDEX_SEARCH_API_KEY}&results=5`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`${resp.status}`);
        const data = await resp.json();
        setResults(
          (data.features ?? []).map((f: any) => ({
            name:
              f.properties?.name ||
              f.properties?.CompanyMetaData?.name ||
              "Place",
            address:
              f.properties?.description ||
              f.properties?.CompanyMetaData?.address ||
              "",
            coords: f.geometry?.coordinates,
          }))
        );
        setResultsOpen(true);
      } catch (err: any) {
        setSearchError("Search failed");
        setResults([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [mapInstance]
  );

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => performSearch(query), 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, performSearch]);

  const handleSelectResult = async (r: any) => {
    const [lngC, latC] = r.coords;
    marker?.geometry.setCoordinates([latC, lngC]);
    mapInstance?.setCenter([latC, lngC], 16, { duration: 300 });
    const fullAddress = r.name + (r.address ? `, ${r.address}` : "");
    onLocationSelect(latC, lngC, fullAddress);
    setQuery("");
    setResults([]);
    setResultsOpen(false);
  };

  if (!apiLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted rounded-2xl">
        <div className="text-center">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Loading map…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">
      <div className="absolute top-2 left-2 right-2 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search café, bar, park…"
            className="w-full h-9 pl-8 pr-9 bg-white/95 backdrop-blur border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow"
          />
          {searchLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}
        </div>

        {resultsOpen && results.length > 0 && (
          <div className="mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden max-h-40 overflow-y-auto">
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => handleSelectResult(r)}
                className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors border-b border-border/20 last:border-none"
              >
                <p className="text-xs font-medium">{r.name}</p>
                {r.address && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    {r.address}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
        {resultsOpen &&
          results.length === 0 &&
          query.trim() &&
          !searchLoading && (
            <div className="mt-1 bg-white border border-border rounded-xl p-2 text-xs text-muted-foreground text-center shadow">
              No places found
            </div>
          )}
        {searchError && (
          <div className="mt-1 bg-red-50 border border-red-200 rounded-xl p-2 text-[10px] text-red-700">
            {searchError}
          </div>
        )}
      </div>

      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}

// ── CreateSparkSheet (modified) ──────────────────────────────────────────────

function CreateSparkSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const createSpark = useCreateSpark();
  const { toast } = useToast();

  // Now only 4 logical steps: 0=Activity+Goals, 1=Description, 2=Location, 3=Plan
  const [step, setStep] = useState(0);
  const TOTAL_STEPS = 4;

  // Step 0: activity + goals
  const [activityChip, setActivityChip] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  // Derived goals for the currently selected activity
  const currentActivityKey = activityChip[0] ?? "";
  const goalsOptions = currentActivityKey
    ? ACTIVITIES_CONFIG[currentActivityKey]?.goals ?? []
    : [];

  // Step 1: description
  const [description, setDescription] = useState("");

  // Step 2: location
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState("");

  // Step 3: plan
  const [titleChip, setTitleChip] = useState<string[]>([]);
  const [meetTimeDate, setMeetTimeDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [meetTimeHour, setMeetTimeHour] = useState(
    format(new Date(Date.now() + 3_600_000), "HH:00")
  );
  const [expiresInMins, setExpiresInMins] = useState(60);
  const [maxRespondents, setMaxRespondents] = useState(5);

  const resetForm = () => {
    setStep(0);
    setActivityChip([]);
    setSelectedGoals([]);
    setDescription("");
    setLat(null);
    setLng(null);
    setLocationLabel("");
    setTitleChip([]);
    setMeetTimeDate(format(new Date(), "yyyy-MM-dd"));
    setMeetTimeHour(format(new Date(Date.now() + 3_600_000), "HH:00"));
    setExpiresInMins(60);
    setMaxRespondents(5);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };
  const nextStep = () => setStep((p) => Math.min(p + 1, TOTAL_STEPS - 1));
  const prevStep = () => setStep((p) => Math.max(p - 1, 0));

  const canNext = useMemo(() => {
    if (step === 0) return activityChip.length > 0;
    if (step === 1) return description.trim().length >= 10;
    if (step === 2) return lat !== null && lng !== null;
    return true;
  }, [step, activityChip, description, lat, lng]);

  const buildTitle = () => {
    if (titleChip.length > 0)
      return (
        TITLES.find((t) => t.value === titleChip[0])?.label ?? "Quick Meetup"
      );
    return (
      ACTIVITIES_CONFIG[currentActivityKey]?.label ?? "Quick Meetup"
    );
  };

  const handleSubmit = async () => {
    try {
      const meetTime = new Date(
        `${meetTimeDate}T${meetTimeHour}`
      ).toISOString();
      await createSpark.mutateAsync({
        title: buildTitle(),
        description: description.trim() || undefined,
        activity: currentActivityKey || "social",
        location: locationLabel || "Moscow",
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        meetTime,
        expiresInMins,
        maxRespondents,
        filterInterests:
          selectedGoals.length > 0 ? selectedGoals : undefined,
      });
      toast({
        title: "Spark sent! ⚡",
        description: "People nearby will see your ping.",
      });
      resetForm();
      onClose();
    } catch (err: any) {
      toast({
        title: "Failed to send spark",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const STEP_LABELS = ["Vibe", "About", "Location", "Plan"];

  // Logic to clear goals when activity changes
  useEffect(() => {
    setSelectedGoals([]);
  }, [currentActivityKey]);

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col overflow-hidden p-0"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/60 shrink-0">
          <SheetTitle className="text-2xl font-display flex items-center gap-2 mb-1">
            <Zap className="w-6 h-6 text-primary" /> New Spark
          </SheetTitle>

          <div className="flex items-center gap-2 mt-3">
            {STEP_LABELS.map((label, i) => (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div
                  className={`h-1 w-full rounded-full transition-all duration-300 ${
                    i < step
                      ? "bg-primary"
                      : i === step
                      ? "bg-primary/60"
                      : "bg-border"
                  }`}
                />
                <span
                  className={`text-[10px] font-medium transition-colors ${
                    i === step
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.18 }}
            >
              {/* Step 0: Activity + Goals */}
              {step === 0 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="font-semibold text-lg mb-1">
                      What are you up for?
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Pick a vibe, then choose a goal.
                    </p>
                  </div>

                  {/* Activity chips (single select) */}
                  <WordBankSelector
                    options={ACTIVITY_CHIPS.map((c) => ({
                      value: c.value,
                      label: c.label,
                      icon: c.icon,
                    }))}
                    selected={activityChip}
                    onToggle={setActivityChip}
                    multiSelect={false}
                  />

                  {/* Goals – horizontal scrolling chips, shown only after activity selected */}
                  {currentActivityKey && goalsOptions.length > 0 && (
                    <div className="pt-2 animate-in fade-in-0 duration-200">
                      <Label className="mb-2 block text-sm font-medium">
                        What's the goal?{" "}
                        <span className="text-muted-foreground font-normal">
                          (optional)
                        </span>
                      </Label>
                      <div className="overflow-x-auto -mx-1 pb-1">
                        <div className="flex gap-2 px-1 min-w-min">
                          {goalsOptions.map((goal) => (
                            <button
                              key={goal.value}
                              onClick={() =>
                                setSelectedGoals((prev) =>
                                  prev.includes(goal.value)
                                    ? prev.filter((g) => g !== goal.value)
                                    : [...prev, goal.value]
                                )
                              }
                              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-all whitespace-nowrap ${
                                selectedGoals.includes(goal.value)
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border text-muted-foreground hover:border-primary/40"
                              }`}
                            >
                              {goal.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {selectedGoals.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {selectedGoals.length} selected
                        </p>
                      )}
                    </div>
                  )}

                  {/* If no goals available, just a note */}
                  {currentActivityKey && goalsOptions.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      No extra goals for this activity.
                    </p>
                  )}
                </div>
              )}

              {/* Step 1: Description */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-1">
                      Tell people about it
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Write a short noticeboard message. What's the purpose,
                      the vibe, who should join?
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Textarea
                      placeholder="e.g. Looking for someone to grab coffee and practice Russian conversation. Native speakers welcome! I'm B2 level, friendly and punctual. Let's meet at a place nearby for 45–60 min."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="rounded-xl min-h-[160px] text-sm resize-none"
                      maxLength={500}
                    />
                    <div className="flex justify-between items-center">
                      <p
                        className={`text-xs ${
                          description.trim().length < 10
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {description.trim().length < 10
                          ? `${
                              10 - description.trim().length
                            } more characters needed`
                          : "Looks good ✓"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {description.length}/500
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Location */}
              {step === 2 && (
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-lg mb-1">
                      Where's the meetup?
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Search for a venue or tap the map to pin your spot.
                    </p>
                  </div>
                  <div className="h-72 rounded-2xl overflow-hidden border border-border">
                    <SparkMapPicker
                      lat={lat}
                      lng={lng}
                      onLocationSelect={(la, ln, addr) => {
                        setLat(la);
                        setLng(ln);
                        setLocationLabel(addr);
                      }}
                    />
                  </div>
                  {locationLabel ? (
                    <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5">
                      <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground leading-snug">
                          {locationLabel}
                        </p>
                        {lat && lng && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {lat.toFixed(5)}, {lng.toFixed(5)}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center">
                      Tap anywhere on the map or search above to set a
                      location.
                    </p>
                  )}
                </div>
              )}

              {/* Step 3: Plan */}
              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="font-semibold text-lg mb-1">
                      Final details
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      When, how long, how many?
                    </p>
                  </div>

                  <div>
                    <Label className="mb-2 block">Quick title</Label>
                    <WordBankSelector
                      options={TITLES}
                      selected={titleChip}
                      onToggle={setTitleChip}
                      multiSelect={false}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={meetTimeDate}
                        onChange={(e) => setMeetTimeDate(e.target.value)}
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Time</Label>
                      <Input
                        type="time"
                        value={meetTimeHour}
                        onChange={(e) => setMeetTimeHour(e.target.value)}
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Ping expires in</Label>
                      <Select
                        onValueChange={(v) =>
                          setExpiresInMins(parseInt(v))
                        }
                        value={String(expiresInMins)}
                      >
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPIRE_OPTIONS.map((o) => (
                            <SelectItem
                              key={o.value}
                              value={String(o.value)}
                            >
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Max people</Label>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={maxRespondents}
                        onChange={(e) =>
                          setMaxRespondents(
                            parseInt(e.target.value) || 5
                          )
                        }
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Summary card */}
                  <div className="bg-muted/40 rounded-2xl p-4 space-y-2 text-sm border border-border/60">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {ACTIVITIES_CONFIG[currentActivityKey]?.icon ?? "📌"}
                      </span>
                      <span className="font-semibold">
                        {buildTitle()}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs line-clamp-2">
                      {description}
                    </p>
                    {locationLabel && (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0" />{" "}
                        {locationLabel}
                      </p>
                    )}
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3 shrink-0" />{" "}
                      {meetTimeDate} at {meetTimeHour}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="w-3 h-3 shrink-0" /> Up to{" "}
                      {maxRespondents} people
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer nav */}
        <div className="px-6 py-4 border-t border-border/60 shrink-0 flex gap-3">
          {step > 0 && (
            <Button
              variant="outline"
              className="flex-1 rounded-xl h-11"
              onClick={prevStep}
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          )}
          {step < TOTAL_STEPS - 1 ? (
            <Button
              className="flex-1 rounded-xl h-11 gap-2"
              disabled={!canNext}
              onClick={nextStep}
            >
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              className="flex-1 rounded-xl h-11 gap-2"
              disabled={createSpark.isPending || !canNext}
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

// ── Main SparkPage ────────────────────────────────────────────────────────────

export default function SparkPage() {
  const { user } = useAuth();
  const { data: sparks, isLoading } = useSparks();
  const { data: mySparks } = useMySparks();
  const cancelSpark = useCancelSpark();
  const respondToSpark = useRespondToSpark();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Spark | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Spark | null>(null);
  const [feedbackTarget, setFeedbackTarget] = useState<Spark | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const currentUserId = String(user?.id ?? "");

  const filteredSparks = useMemo(() => {
    if (!sparks) return [];
    if (activeFilter === "all") return sparks;
    return sparks.filter((s) => s.activity === activeFilter);
  }, [sparks, activeFilter]);

  const handleRespond = async (
    spark: Spark,
    status: "accepted" | "declined"
  ) => {
    try {
      await respondToSpark.mutateAsync({ sparkId: spark.id, status });
      if (status === "accepted") {
        toast({
          title: "You're in! ⚡",
          description: `See you at ${spark.location}.`,
        });
      }
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelSpark.mutateAsync(cancelTarget.id);
      toast({ title: "Spark cancelled" });
    } catch (err: any) {
      toast({
        title: "Failed to cancel",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setCancelTarget(null);
    }
  };

  const activeSentCount =
    mySparks?.filter((s) => ["pending", "active"].includes(s.status)).length ??
    0;

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
                <p className="text-sm text-muted-foreground">
                  Impromptu meetups, right now
                </p>
              </div>
            </div>
            <p className="text-muted-foreground text-sm max-w-sm">
              Post a noticeboard ping — tell people why and where. They accept,
              you confirm — no planning needed.
            </p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="rounded-full shadow-lg shadow-primary/20 gap-2 shrink-0"
          >
            <Zap className="w-4 h-4" /> Spark
          </Button>
        </div>

        {/* Activity filter chips – now uses the ACTIVITIES_CONFIG keys */}
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
          {Object.entries(ACTIVITIES_CONFIG).map(([key, config]) => (
            <button
              key={key}
              onClick={() =>
                setActiveFilter(activeFilter === key ? "all" : key)
              }
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border whitespace-nowrap transition-all shrink-0 ${
                activeFilter === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              <span>{config.icon}</span> {config.label}
            </button>
          ))}
        </div>

        <Tabs defaultValue="feed">
          <TabsList className="mb-6 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger
              value="feed"
              className="rounded-lg px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Flame className="w-4 h-4 mr-2" /> Live Feed
              {filteredSparks.length > 0 && (
                <span className="ml-2 bg-primary/15 text-primary text-xs rounded-full px-1.5 py-0.5 font-semibold">
                  {filteredSparks.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="mine"
              className="rounded-lg px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
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
              <div className="text-center py-24 bg-card border border-dashed border-border rounded-3xl">
                <Zap className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">
                  No sparks right now
                </h3>
                <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
                  Be the first — post a noticeboard ping and see who's free.
                </p>
                <Button
                  onClick={() => setCreateOpen(true)}
                  className="rounded-full gap-2"
                >
                  <Zap className="w-4 h-4" /> Send the first Spark
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {filteredSparks.map((spark) => (
                    <SparkCard
                      key={spark.id}
                      spark={spark}
                      currentUserId={currentUserId}
                      onRespond={handleRespond}
                      onCancel={setCancelTarget}
                      onConfirm={setConfirmTarget}
                      onLeaveFeedback={setFeedbackTarget}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          <TabsContent value="mine">
            {!mySparks || mySparks.length === 0 ? (
              <div className="text-center py-24 bg-card border border-dashed border-border rounded-3xl">
                <Send className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">
                  No sparks sent yet
                </h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Create your first impromptu meetup ping.
                </p>
                <Button
                  onClick={() => setCreateOpen(true)}
                  className="rounded-full gap-2"
                >
                  <Zap className="w-4 h-4" /> Send a Spark
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {mySparks.map((spark) => (
                    <SparkCard
                      key={spark.id}
                      spark={spark}
                      currentUserId={currentUserId}
                      onRespond={handleRespond}
                      onCancel={setCancelTarget}
                      onConfirm={setConfirmTarget}
                      onLeaveFeedback={setFeedbackTarget}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <CreateSparkSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <ConfirmDialog
        spark={confirmTarget}
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
      />

      <FeedbackModal
        spark={feedbackTarget}
        open={!!feedbackTarget}
        onClose={() => setFeedbackTarget(null)}
      />

      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(v) => {
          if (!v) setCancelTarget(null);
        }}
      >
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
