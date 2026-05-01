// client/src/pages/Spark.tsx
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Plus, X, MapPin, Clock, Users, Filter, ChevronDown,
  Check, MessageSquare, Flame, Send, Timer, Trophy, AlertCircle,
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

// ── Create Spark form schema ───────────────────────────────────────────────────

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

// ── Spark card ────────────────────────────────────────────────────────────────

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
            <AvatarImage src={spark.sender?.avatarUrl ?? ""} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {(spark.sender?.displayName ?? "?").substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">
              {isMine ? "You" : spark.sender?.displayName ?? "Someone"}
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

      {/* Respondent avatars */}
      {accepted.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4">
          <div className="flex -space-x-2">
            {accepted.slice(0, 5).map(r => (
              <Avatar key={r.id} className="h-6 w-6 ring-2 ring-background">
                <AvatarImage src={r.responder?.avatarUrl ?? ""} />
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                  {(r.responder?.displayName ?? "?").substring(0, 1).toUpperCase()}
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
          {/* Sender: confirm button */}
          {isMine && spark.status === "active" && accepted.length > 0 && (
            <Button
              size="sm"
              className="rounded-full h-8 px-3 text-xs gap-1.5"
              onClick={() => onConfirm(spark)}
            >
              <Trophy className="w-3.5 h-3.5" /> Confirm group
            </Button>
          )}

          {/* Responder: accept/decline */}
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

          {/* Confirmed state */}
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

// ── Confirm respondents dialog ─────────────────────────────────────────────────

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
                <AvatarImage src={r.responder?.avatarUrl ?? ""} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {(r.responder?.displayName ?? "?").substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 font-medium text-sm">{r.responder?.displayName ?? "Member"}</span>
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

// ── Create Spark sheet ─────────────────────────────────────────────────────────

function CreateSparkSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createSpark = useCreateSpark();
  const { toast }   = useToast();

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      expiresInMins:  60,
      maxRespondents: 5,
      meetTimeDate:   format(new Date(), "yyyy-MM-dd"),
      meetTimeHour:   format(new Date(Date.now() + 3600_000), "HH:00"),
    },
  });

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const toggleInterest = (v: string) =>
    setSelectedInterests(prev => prev.includes(v) ? prev.filter(x => x !== v) : prev.length < 5 ? [...prev, v] : prev);

  const onSubmit = async (data: CreateForm) => {
    try {
      const meetTime = new Date(`${data.meetTimeDate}T${data.meetTimeHour}`).toISOString();
      await createSpark.mutateAsync({
        title:           data.title,
        description:     data.description,
        activity:        data.activity,
        location:        data.location,
        meetTime,
        expiresInMins:   data.expiresInMins,
        maxRespondents:  data.maxRespondents,
        filterInterests: selectedInterests.length ? selectedInterests : undefined,
      });
      toast({ title: "Spark sent! ⚡", description: "People nearby will see your ping." });
      reset();
      setSelectedInterests([]);
      onClose();
    } catch (err: any) {
      toast({ title: "Failed to send spark", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl font-display flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" /> Send a Spark
          </SheetTitle>
          <SheetDescription>
            Ping nearby members for an impromptu meetup. It expires automatically.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label>What's the plan? <span className="text-destructive">*</span></Label>
            <Input
              {...register("title")}
              placeholder="Coffee in 20 min? Walk in Gorky Park?"
              className="h-11 rounded-xl"
            />
            {errors.title && <p className="text-destructive text-xs">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>More details <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
            <Textarea
              {...register("description")}
              placeholder="Any extra info — where to meet exactly, what to bring…"
              className="rounded-xl resize-none"
              rows={2}
            />
          </div>

          {/* Activity category */}
          <div className="space-y-1.5">
            <Label>Activity type <span className="text-destructive">*</span></Label>
            <Controller control={control} name="activity" render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                {ACTIVITY_CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => field.onChange(cat.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${
                      field.value === cat.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    <span>{CATEGORY_ICONS[cat.value] ?? "📌"}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
            )} />
            {errors.activity && <p className="text-destructive text-xs">{errors.activity.message}</p>}
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label>Location <span className="text-destructive">*</span></Label>
            <Input
              {...register("location")}
              placeholder="Gorky Park entrance / Kiyevskaya station / etc."
              className="h-11 rounded-xl"
            />
            {errors.location && <p className="text-destructive text-xs">{errors.location.message}</p>}
          </div>

          {/* Meet time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date <span className="text-destructive">*</span></Label>
              <Input {...register("meetTimeDate")} type="date" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Time <span className="text-destructive">*</span></Label>
              <Input {...register("meetTimeHour")} type="time" className="h-11 rounded-xl" />
            </div>
          </div>

          {/* Expires in + max respondents */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ping expires in</Label>
              <Controller control={control} name="expiresInMins" render={({ field }) => (
                <Select onValueChange={v => field.onChange(parseInt(v))} value={String(field.value)}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-900">
                    {EXPIRE_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1.5">
              <Label>Max people</Label>
              <Input
                type="number"
                min={1} max={20}
                {...register("maxRespondents", { valueAsNumber: true })}
                className="h-11 rounded-xl"
              />
            </div>
          </div>

          {/* Interest filters */}
          <div className="space-y-2">
            <Label>
              Filter by interests{" "}
              <span className="text-muted-foreground text-xs font-normal">(optional, max 5 — leave empty to reach everyone)</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_CATEGORIES.map(cat => {
                const active = selectedInterests.includes(cat.value);
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => toggleInterest(cat.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all ${
                      active
                        ? "bg-primary/10 border-primary text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    <span>{CATEGORY_ICONS[cat.value] ?? "📌"}</span>
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createSpark.isPending} className="flex-1 rounded-xl gap-2">
              <Zap className="w-4 h-4" />
              {createSpark.isPending ? "Sending…" : "Send Spark"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

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
