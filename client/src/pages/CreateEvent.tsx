import { useState, useEffect } from "react";
import { useForm, useFieldArray, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useCreateEvent } from "@/hooks/use-events";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useParams } from "wouter";
import { getQueryFn } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Trash2, Plus, CalendarPlus, AlertCircle,
  ArrowLeft, ArrowRight, Check, UsersRound,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EVENT_CATEGORIES, EVENT_CATEGORY_VALUES } from "@shared/categories";
import { ImageUpload } from "@/components/ui/ImageUpload";

const CATEGORY_DEFAULT_IMAGES: Record<string, string> = {
  networking:   "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200&auto=format&fit=crop",
  tech:         "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&auto=format&fit=crop",
  culture:      "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&auto=format&fit=crop",
  food:         "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&auto=format&fit=crop",
  sports:       "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1200&auto=format&fit=crop",
  music:        "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&auto=format&fit=crop",
  language:     "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=1200&auto=format&fit=crop",
  outdoor:      "https://images.unsplash.com/photo-1533692328991-08159ff19fca?w=1200&auto=format&fit=crop",
  games:        "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=1200&auto=format&fit=crop",
  business:     "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&auto=format&fit=crop",
  wellness:     "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&auto=format&fit=crop",
  family:       "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=1200&auto=format&fit=crop",
  social:       "https://images.unsplash.com/photo-1529543544282-ea669407fca3?w=1200&auto=format&fit=crop",
  volunteering: "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=1200&auto=format&fit=crop",
  other:        "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop",
};

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "https://auth.expatevents.org";

// ── Schema ────────────────────────────────────────────────────────────────
// date and time are separate strings in the form, merged into a Date on submit.
// This avoids z.coerce.date() quirks while the user is mid-wizard.
const createEventSchema = z.object({
  title:       z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  category:    z.enum(EVENT_CATEGORY_VALUES as [string, ...string[]], {
    required_error: "Please select a category",
  }),
  category2:    z.string().optional().nullable(),
  dateStr:      z.string().min(1, "Date is required"),
  time:         z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Select a valid time"),
  venueAddress: z.string().min(3, "Address is required"),
  venueCity:    z.string().min(2, "City is required"),
  imageUrl:     z.string().optional().nullable(),
  ticketTypes:  z.array(z.object({
    name:        z.string().min(1, "Name required"),
    price:       z.coerce.number().min(0, "Price must be 0 or more"),
    quantity:    z.coerce.number().min(1, "Quantity must be at least 1"),
    maxPerOrder: z.coerce.number().min(1, "Max per order must be at least 1"),
  })).min(1, "Add at least one ticket type"),
  groupId:   z.number().optional().nullable(),
  isPrivate: z.boolean().default(false),
});

type FormValues = z.infer<typeof createEventSchema>;

// Fields that must pass validation before the user can advance from each step
const STEP_FIELDS: Record<number, (keyof FormValues)[]> = {
  0: ["title", "description", "category"],
  1: ["dateStr", "time"],
  2: ["venueAddress", "venueCity"],
  3: ["ticketTypes"],
  4: [],
};

const STEPS = [
  { label: "Details"    },
  { label: "Date & Time"},
  { label: "Location"   },
  { label: "Tickets"    },
  { label: "Preview"    },
];

// 15-min time slots 00:00 – 23:45
const TIME_SLOTS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4).toString().padStart(2, "0");
  const m = ((i % 4) * 15).toString().padStart(2, "0");
  return `${h}:${m}`;
});

export default function CreateEvent({ groupSlug }: { groupSlug?: string } = {}) {
  const [, setLocation]      = useLocation();
  const params               = useParams<{ groupId?: string }>();
  const createEvent          = useCreateEvent();
  const { user, isLoading: authLoading } = useAuth();

  const [step,           setStep]          = useState(0);
  const [direction,      setDirection]     = useState(1);   // 1 = forward, -1 = back
  const [submitError,    setSubmitError]   = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<{ id: number; title: string } | null>(null);

  const { data: myGroups } = useQuery<any[]>({
    queryKey: ["/api/groups/my"],
    queryFn:  getQueryFn({ on401: "returnNull" }),
    enabled:  !!user,
  });

  const eligibleGroups = (myGroups ?? []).filter(
    g => g.currentUserRole === "owner" || g.currentUserRole === "moderator"
  );

  const {
    register, control, handleSubmit, setValue, watch, trigger,
    formState: { errors },
  } = useForm<FormValues>({
    resolver:      zodResolver(createEventSchema),
    defaultValues: {
      ticketTypes: [{ name: "General Admission", price: 0, quantity: 100, maxPerOrder: 5 }],
      isPrivate:   false,
      time:        "18:00",
    },
    mode: "onTouched",
  });

  const watchedCategory = watch("category");
  const watchedImageUrl = watch("imageUrl");
  const watchedGroupId  = watch("groupId");
  const watchedDateStr  = watch("dateStr");
  const watchedTime     = watch("time");
  const allValues       = watch();

  // Auto-fill cover image when category is chosen (only if not already set)
  useEffect(() => {
    if (watchedCategory && !watchedImageUrl) {
      const def = CATEGORY_DEFAULT_IMAGES[watchedCategory];
      if (def) setValue("imageUrl", def);
    }
  }, [watchedCategory]);

  // Pre-select group from URL param or slug prop
  useEffect(() => {
    if (groupSlug && myGroups) {
      const g = myGroups.find((g: any) => g.slug === groupSlug);
      if (g) setValue("groupId", g.id);
    } else if (params.groupId) {
      const n = parseInt(params.groupId, 10);
      if (!isNaN(n)) setValue("groupId", n);
    }
  }, [groupSlug, myGroups, params.groupId]);

  const { fields, append, remove } = useFieldArray({ control, name: "ticketTypes" });

  // ── Navigation ────────────────────────────────────────────────────────
  const navigate = async (target: number) => {
    if (target > step) {
      // Validate the current step's fields before advancing
      const valid = await trigger(STEP_FIELDS[step] as any);
      if (!valid) return;
    }
    setSubmitError(null);
    setDirection(target > step ? 1 : -1);
    setStep(target);
  };

  const nextStep = () => navigate(step + 1);
  const prevStep = () => navigate(step - 1);

  // ── Submit ────────────────────────────────────────────────────────────
  const onSubmit = async (data: FormValues) => {
    if (!user) return;
    setSubmitError(null);
    try {
      const [hours, minutes] = data.time.split(":").map(Number);
      const eventDate = new Date(data.dateStr);
      eventDate.setHours(hours, minutes, 0, 0);

      const result = await createEvent.mutateAsync({
        ...data,
        date:      eventDate,
        published: true,
        groupId:   data.groupId ?? null,
      } as any);

      setPublishSuccess({ id: result.id, title: result.title });
      setTimeout(() => setLocation(`/events/${result.id}`), 2000);
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("401") || msg.includes("authenticated")) {
        setSubmitError("You need to be signed in to create an event.");
      } else if (msg.includes("403")) {
        setSubmitError("You don't have permission to create events.");
      } else {
        setSubmitError(msg || "Failed to publish event. Please try again.");
      }
    }
  };

  // ── Loading / auth / success screens ─────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center gap-6 px-4">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/10">
          <CalendarPlus className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold">Host an Event</h1>
        <p className="text-muted-foreground">You need to be signed in.</p>
        <Button onClick={() =>
          (window.location.href = `${AUTH_URL}/login?returnTo=${encodeURIComponent(window.location.href)}`)
        }>
          Sign In
        </Button>
      </div>
    );
  }

  if (publishSuccess) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center gap-6 px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-xl"
        >
          <Check className="w-10 h-10" />
        </motion.div>
        <h1 className="text-3xl font-bold">Event Published!</h1>
        <p className="text-muted-foreground">"{publishSuccess.title}" is now live.</p>
        <p className="text-sm text-muted-foreground">Redirecting to event page…</p>
        <Button onClick={() => setLocation(`/events/${publishSuccess.id}`)}>
          View Event Now
        </Button>
      </div>
    );
  }

  const progressPct = (step / (STEPS.length - 1)) * 100;

  const slideVariants = {
    enter:  (d: number) => ({ x: d > 0 ? 48 : -48, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (d: number) => ({ x: d > 0 ? -48 : 48, opacity: 0 }),
  };

  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="mb-10 text-center">
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/10">
            <CalendarPlus className="w-7 h-7" />
          </div>
          <h1 className="text-4xl font-display font-bold mb-2">Host an Event</h1>
          <p className="text-muted-foreground">Fill in the details to publish your event to the community.</p>
        </div>

        {/* ── Stepper ─────────────────────────────────────────────────── */}
        <div className="mb-10 px-2">
          <div className="relative mb-2">
            {/* Static track */}
            <div className="absolute top-[18px] left-0 right-0 h-0.5 bg-border" />
            {/* Animated fill */}
            <motion.div
              className="absolute top-[18px] left-0 h-0.5 bg-primary"
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
            />

            <div className="relative flex justify-between">
              {STEPS.map((s, i) => {
                const done    = i < step;
                const current = i === step;
                return (
                  <button
                    key={i}
                    type="button"
                    // Completed steps are clickable; future steps are not
                    onClick={() => { if (done) navigate(i); }}
                    disabled={!done && !current}
                    className={[
                      "flex flex-col items-center gap-1.5",
                      done    ? "cursor-pointer"     : "",
                      current ? "cursor-default"     : "",
                      !done && !current ? "cursor-not-allowed opacity-50" : "",
                    ].join(" ")}
                  >
                    <div className={[
                      "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold",
                      "border-2 transition-all duration-300 bg-background",
                      done    ? "bg-primary border-primary text-white hover:bg-primary/90" : "",
                      current ? "border-primary text-primary shadow-md shadow-primary/20 scale-110" : "",
                      !done && !current ? "border-border text-muted-foreground" : "",
                    ].join(" ")}>
                      {done ? <Check className="w-4 h-4" /> : i + 1}
                    </div>
                    <span className={[
                      "text-xs font-medium hidden sm:block",
                      current ? "text-primary"          : "",
                      done    ? "text-foreground"        : "",
                      !done && !current ? "text-muted-foreground" : "",
                    ].join(" ")}>
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile: current step label */}
          <p className="sm:hidden text-center text-sm font-semibold text-primary mt-3">
            Step {step + 1} of {STEPS.length} — {STEPS[step].label}
          </p>
        </div>

        {/* ── Form ────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: "easeInOut" }}
              >

                {/* ── Step 0: Event Details ───────────────────────────── */}
                {step === 0 && (
                  <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
                    <div className="bg-primary/5 px-8 py-4 border-b border-border/50">
                      <h2 className="text-xl font-bold">Event Details</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">Give your event a name, category and description</p>
                    </div>
                    <CardContent className="p-8 space-y-6">

                      <div className="space-y-2">
                        <Label>Event Title</Label>
                        <Input
                          {...register("title")}
                          className="h-12 rounded-xl text-lg"
                          placeholder="Moscow Summer Tech Mixer"
                        />
                        {errors.title && <p className="text-destructive text-sm">{errors.title.message}</p>}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Category</Label>
                          <Controller control={control} name="category" render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="h-12 rounded-xl">
                                <SelectValue placeholder="Select a category…" />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-zinc-900">
                                {EVENT_CATEGORIES.map(cat => (
                                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )} />
                          {errors.category && <p className="text-destructive text-sm">{errors.category.message}</p>}
                        </div>

                        {watchedCategory && (
                          <div className="space-y-2">
                            <Label>Second Category <span className="font-normal text-muted-foreground">(optional)</span></Label>
                            <Controller control={control} name="category2" render={({ field }) => (
                              <Select
                                onValueChange={v => field.onChange(v === "__none__" ? null : v)}
                                value={field.value ?? "__none__"}
                              >
                                <SelectTrigger className="h-12 rounded-xl">
                                  <SelectValue placeholder="None" />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-zinc-900">
                                  <SelectItem value="__none__">— None —</SelectItem>
                                  {EVENT_CATEGORIES.filter(c => c.value !== watchedCategory).map(c => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )} />
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          {...register("description")}
                          className="rounded-xl min-h-[130px]"
                          placeholder="Tell people what to expect — format, agenda, vibe, what to bring…"
                        />
                        {errors.description && <p className="text-destructive text-sm">{errors.description.message}</p>}
                      </div>

                      {eligibleGroups.length > 0 && (
                        <div className="pt-4 border-t space-y-2">
                          <Label className="flex items-center gap-2">
                            <UsersRound className="w-4 h-4 text-primary" />
                            Link to a Group <span className="font-normal text-muted-foreground">(optional)</span>
                          </Label>
                          <Controller control={control} name="groupId" render={({ field }) => (
                            <Select
                              onValueChange={v => field.onChange(v === "__none__" ? null : parseInt(v))}
                              value={field.value != null ? String(field.value) : "__none__"}
                            >
                              <SelectTrigger className="h-12 rounded-xl">
                                <SelectValue placeholder="No group (public event)" />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-zinc-900">
                                <SelectItem value="__none__">— No group (public event) —</SelectItem>
                                {eligibleGroups.map(g => (
                                  <SelectItem key={g.id} value={String(g.id)}>
                                    {g.name} {g.currentUserRole === "owner" ? "(owner)" : "(moderator)"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )} />
                        </div>
                      )}

                      {watchedGroupId && (
                        <div className="flex justify-between items-center pt-4 border-t">
                          <div>
                            <p className="font-medium text-sm">Private event</p>
                            <p className="text-xs text-muted-foreground">Only group members can see this event</p>
                          </div>
                          <Controller control={control} name="isPrivate" render={({ field }) => (
                            <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                          )} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ── Step 1: Date & Time ─────────────────────────────── */}
                {step === 1 && (
                  <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
                    <div className="bg-primary/5 px-8 py-4 border-b border-border/50">
                      <h2 className="text-xl font-bold">Date & Time</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">When does your event take place?</p>
                    </div>
                    <CardContent className="p-8 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Date</Label>
                          <Input type="date" {...register("dateStr")} className="h-12 rounded-xl" />
                          {errors.dateStr && <p className="text-destructive text-sm">{errors.dateStr.message}</p>}
                        </div>

                        <div className="space-y-2">
                          <Label>Time</Label>
                          <Controller control={control} name="time" render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="h-12 rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-zinc-900 max-h-64">
                                {TIME_SLOTS.map(t => (
                                  <SelectItem key={t} value={t}>{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )} />
                          {errors.time && <p className="text-destructive text-sm">{errors.time.message}</p>}
                        </div>
                      </div>

                      {/* Live preview pill */}
                      {watchedDateStr && watchedTime && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-2xl px-5 py-4"
                        >
                          <span className="text-2xl">📅</span>
                          <div>
                            <p className="font-semibold text-sm">
                              {new Date(watchedDateStr).toLocaleDateString("en-GB", {
                                weekday: "long", day: "numeric", month: "long", year: "numeric",
                              })}
                            </p>
                            <p className="text-sm text-muted-foreground">Starts at {watchedTime}</p>
                          </div>
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ── Step 2: Location & Media ───────────────────────── */}
                {step === 2 && (
                  <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
                    <div className="bg-primary/5 px-8 py-4 border-b border-border/50">
                      <h2 className="text-xl font-bold">Location & Media</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">Where is your event and how should it look?</p>
                    </div>
                    <CardContent className="p-8 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Venue Address</Label>
                          <Input {...register("venueAddress")} className="h-12 rounded-xl" placeholder="Vabaduse väljak 1" />
                          {errors.venueAddress && <p className="text-destructive text-sm">{errors.venueAddress.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>City</Label>
                          <Input {...register("venueCity")} className="h-12 rounded-xl" placeholder="Tallinn" />
                          {errors.venueCity && <p className="text-destructive text-sm">{errors.venueCity.message}</p>}
                        </div>
                      </div>

                      <Controller
                        control={control}
                        name="imageUrl"
                        render={({ field }) => (
                          <ImageUpload
                            value={field.value}
                            onChange={field.onChange}
                            label="Cover Image"
                            hint="Upload a photo or use the default for your chosen category. Max 2 MB."
                            aspectRatio="wide"
                          />
                        )}
                      />
                    </CardContent>
                  </Card>
                )}

                {/* ── Step 3: Tickets ─────────────────────────────────── */}
                {step === 3 && (
                  <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
                    <div className="bg-primary/5 px-8 py-4 border-b border-border/50 flex justify-between items-center">
                      <div>
                        <h2 className="text-xl font-bold">Tickets</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">Set up ticket types and pricing</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => append({ name: "", price: 0, quantity: 50, maxPerOrder: 4 })}
                        className="rounded-full bg-white"
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add Ticket
                      </Button>
                    </div>
                    <CardContent className="p-8 space-y-4 bg-muted/10">
                      {fields.map((field, index) => (
                        <div
                          key={field.id}
                          className="relative bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-end"
                        >
                          {fields.length > 1 && (
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="absolute top-4 right-4 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                          <div className="flex-1 w-full space-y-2">
                            <Label>Ticket Name</Label>
                            <Input {...register(`ticketTypes.${index}.name`)} placeholder="General Admission" className="h-11 rounded-xl" />
                            {errors.ticketTypes?.[index]?.name && (
                              <p className="text-destructive text-xs">{errors.ticketTypes[index].name?.message}</p>
                            )}
                          </div>
                          <div className="w-full md:w-28 space-y-2">
                            <Label>Price (€)</Label>
                            <Input type="number" {...register(`ticketTypes.${index}.price`)} className="h-11 rounded-xl" />
                          </div>
                          <div className="w-full md:w-28 space-y-2">
                            <Label>Total Qty</Label>
                            <Input type="number" {...register(`ticketTypes.${index}.quantity`)} className="h-11 rounded-xl" />
                          </div>
                          <div className="w-full md:w-28 space-y-2">
                            <Label>Max / Order</Label>
                            <Input type="number" {...register(`ticketTypes.${index}.maxPerOrder`)} className="h-11 rounded-xl" />
                          </div>
                        </div>
                      ))}
                      {errors.ticketTypes?.message && (
                        <p className="text-destructive text-sm">{errors.ticketTypes.message}</p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ── Step 4: Preview & Publish ───────────────────────── */}
                {step === 4 && (
                  <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
                    <div className="bg-primary/5 px-8 py-4 border-b border-border/50">
                      <h2 className="text-xl font-bold">Preview & Publish</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">Check everything looks right before going live</p>
                    </div>
                    <CardContent className="p-8 space-y-6">

                      {/* Cover image */}
                      {allValues.imageUrl && (
                        <div className="rounded-2xl overflow-hidden aspect-video w-full">
                          <img src={allValues.imageUrl} alt="Cover" className="w-full h-full object-cover" />
                        </div>
                      )}

                      {/* Key details table */}
                      <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
                        {[
                          { icon: "📌", label: "Title",       value: allValues.title },
                          { icon: "🏷",  label: "Category",   value: EVENT_CATEGORIES.find(c => c.value === allValues.category)?.label },
                          {
                            icon: "📅", label: "Date & Time",
                            value: allValues.dateStr && allValues.time
                              ? `${new Date(allValues.dateStr).toLocaleDateString("en-GB", {
                                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                                })} at ${allValues.time}`
                              : null,
                          },
                          {
                            icon: "📍", label: "Location",
                            value: allValues.venueAddress && allValues.venueCity
                              ? `${allValues.venueAddress}, ${allValues.venueCity}`
                              : null,
                          },
                        ].filter(r => r.value).map(row => (
                          <div key={row.label} className="flex items-start gap-3 px-5 py-3.5 bg-card">
                            <span className="text-base mt-0.5">{row.icon}</span>
                            <span className="text-xs text-muted-foreground w-20 shrink-0 pt-0.5">{row.label}</span>
                            <span className="text-sm font-medium">{row.value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Description preview */}
                      {allValues.description && (
                        <div className="rounded-2xl bg-muted/40 p-5">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">Description</p>
                          <p className="text-sm leading-relaxed line-clamp-5">{allValues.description}</p>
                        </div>
                      )}

                      {/* Tickets summary */}
                      {(allValues.ticketTypes?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">Tickets</p>
                          <div className="space-y-2">
                            {allValues.ticketTypes.map((t, i) => (
                              <div key={i} className="flex justify-between items-center bg-muted/30 rounded-xl px-4 py-3 text-sm">
                                <span className="font-medium">{t.name || "Unnamed"}</span>
                                <span className="text-muted-foreground">
                                  {t.price === 0 ? "Free" : `€${t.price}`} · {t.quantity} available
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Liability notice */}
                      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                        ExpatEvents provides the infrastructure to organise activities. The voluntary organisers do not represent ExpatEvents as vicarious agents. In the case of gross negligence by the organisers, ExpatEvents therefore does not accept any legal responsibility for resulting damages. Neither ExpatEvents nor the event organisers assume liability for any loss of or damage to personal property, nor shall they be held responsible in the event of financial, physical, or emotional damage.
                      </div>

                      {submitError && (
                        <div className="flex items-start gap-3 p-4 rounded-2xl bg-destructive/10 border border-destructive/20">
                          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                          <p className="text-destructive text-sm">{submitError}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Navigation buttons ──────────────────────────────────── */}
          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                className="flex-1 h-12 rounded-2xl"
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            )}

            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={nextStep}
                className="flex-1 h-12 rounded-2xl shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
              >
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={createEvent.isPending}
                className="flex-1 h-12 text-base rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
              >
                {createEvent.isPending ? "Publishing…" : "Publish Event"}
              </Button>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Step {step + 1} of {STEPS.length}
          </p>
        </form>

      </div>
    </div>
  );
}
