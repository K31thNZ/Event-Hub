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
import { Trash2, Plus, CalendarPlus, AlertCircle, RefreshCw, Users, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EVENT_CATEGORIES, EVENT_CATEGORY_VALUES } from "@shared/categories";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { LeafletLocationPicker } from "@/components/ui/LeafletLocationPicker";

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "https://auth.expatevents.org";

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

const createEventSchema = z.object({
  title:           z.string().min(3, "Title must be at least 3 characters"),
  description:     z.string().min(10, "Provide a better description"),
  category:        z.enum(EVENT_CATEGORY_VALUES as [string, ...string[]], { required_error: "Please select a category" }),
  category2:       z.string().optional().nullable(),
  date:            z.coerce.date({ required_error: "Valid date is required" }),
  venueAddress:    z.string().min(3, "Address is required"),
  venueCity:       z.string().min(2, "City is required"),
  imageUrl:        z.string().optional().nullable(),
  ticketTypes:     z.array(z.object({
    name:        z.string().min(1, "Name required"),
    price:       z.coerce.number().min(0, "Price >= 0"),
    quantity:    z.coerce.number().min(1, "Quantity > 0"),
    maxPerOrder: z.coerce.number().min(1, "Max > 0"),
  })).min(1, "Add at least one ticket type"),
  groupId:         z.number().optional().nullable(),
  isPrivate:       z.boolean().optional().default(false),
  recurrence:      z.enum(["weekly", "biweekly", "monthly"]).optional().nullable(),
  recurrenceUntil: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof createEventSchema>;

// ── Step definitions ──────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Basics",   description: "Title, category & date"  },
  { id: 2, label: "Details",  description: "Description & recurrence" },
  { id: 3, label: "Location", description: "Venue & cover image"      },
  { id: 4, label: "Tickets",  description: "Ticket types & pricing"   },
  { id: 5, label: "Review",   description: "Confirm & publish"        },
];

// Fields validated per step (so Next button validates only current step)
const STEP_FIELDS: Record<number, (keyof FormValues)[]> = {
  1: ["title", "category", "date"],
  2: ["description"],
  3: ["venueAddress", "venueCity"],
  4: ["ticketTypes"],
  5: [],
};

export default function CreateEvent({ groupSlug }: { groupSlug?: string } = {}) {
  const [, setLocation] = useLocation();
  const params          = useParams<{ groupId?: string }>();
  const createEvent     = useCreateEvent();
  const { user, isLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [direction,   setDirection]   = useState(1); // 1 = forward, -1 = back
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: myGroups } = useQuery<any[]>({
    queryKey:  ["/api/groups/my"],
    queryFn:   getQueryFn({ on401: "returnNull" }),
    enabled:   !!user,
  });

  const eligibleGroups = (myGroups ?? []).filter(
    g => g.currentUserRole === "owner" || g.currentUserRole === "moderator"
  );

  const { register, control, handleSubmit, formState: { errors }, setValue, watch, trigger } =
    useForm<FormValues>({
      resolver:      zodResolver(createEventSchema),
      defaultValues: {
        ticketTypes: [{ name: "General Admission", price: 0, quantity: 100, maxPerOrder: 5 }],
        isPrivate:   false,
        groupId:     null,
      },
      mode: "onChange",
    });

  useEffect(() => {
    if (groupSlug && myGroups) {
      const group = myGroups.find((g: any) => g.slug === groupSlug);
      if (group) setValue("groupId", group.id);
    } else if (params.groupId) {
      const n = parseInt(params.groupId, 10);
      if (!isNaN(n)) setValue("groupId", n);
    }
  }, [groupSlug, myGroups, params.groupId, setValue]);

  const { fields, append, remove } = useFieldArray({ control, name: "ticketTypes" });

  const watchedCategory = useWatch({ control, name: "category" });
  const watchedGroupId  = watch("groupId");
  const watchedImageUrl = watch("imageUrl");
  const allValues       = watch();

  useEffect(() => {
    if (watchedCategory && !watchedImageUrl) {
      const def = CATEGORY_DEFAULT_IMAGES[watchedCategory];
      if (def) setValue("imageUrl", def);
    }
  }, [watchedCategory]);

  // ── Navigation ────────────────────────────────────────────────────────
  const goNext = async () => {
    const fields = STEP_FIELDS[currentStep];
    const valid  = fields.length === 0 || await trigger(fields as any);
    if (!valid) return;
    setDirection(1);
    setCurrentStep(s => Math.min(s + 1, STEPS.length));
  };

  const goBack = () => {
    setDirection(-1);
    setCurrentStep(s => Math.max(s - 1, 1));
  };

  const onSubmit = async (data: FormValues) => {
    setSubmitError(null);
    if (!user) {
      window.location.href = `${AUTH_URL}/login?returnTo=${encodeURIComponent(window.location.href)}`;
      return;
    }
    try {
      await createEvent.mutateAsync({
        ...data,
        published:       true,
        groupId:         data.groupId ?? null,
        isPrivate:       data.isPrivate ?? false,
        recurrence:      data.recurrence ?? null,
        recurrenceUntil: data.recurrenceUntil ?? null,
      } as any);
      setLocation("/dashboard");
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("401") || msg.includes("authenticated")) {
        setSubmitError("You need to be signed in to create an event.");
      } else if (msg.includes("403")) {
        setSubmitError("You don't have permission to create events.");
      } else {
        setSubmitError(msg || "Something went wrong publishing the event. Please try again.");
      }
    }
  };

  if (!isLoading && !user) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center gap-6 px-4">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/10">
          <CalendarPlus className="w-8 h-8" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-display font-bold mb-2">Host an Event</h1>
          <p className="text-muted-foreground">You need to be signed in to create an event.</p>
        </div>
        <Button
          onClick={() => (window.location.href = `${AUTH_URL}/login?returnTo=${encodeURIComponent(window.location.href)}`)}
          className="rounded-full px-8 h-12 shadow-lg shadow-primary/20"
        >
          Sign In to Continue
        </Button>
      </div>
    );
  }

  const slideVariants = {
    enter:   (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
    center:  { x: 0, opacity: 1 },
    exit:    (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="mb-10 text-center">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/10">
              <CalendarPlus className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-display font-bold mb-2">Host an Event</h1>
            <p className="text-muted-foreground">Fill in the details to publish your event to the community.</p>
          </div>

          {/* ── Stepper ─────────────────────────────────────────────── */}
          <div className="mb-10">
            <div className="flex items-center justify-between relative">
              {/* Progress line behind steps */}
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-border -z-0" />
              <div
                className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-500 -z-0"
                style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
              />

              {STEPS.map(step => {
                const isCompleted = step.id < currentStep;
                const isCurrent   = step.id === currentStep;
                return (
                  <div key={step.id} className="flex flex-col items-center gap-2 z-10">
                    <button
                      type="button"
                      onClick={() => {
                        if (step.id < currentStep) {
                          setDirection(-1);
                          setCurrentStep(step.id);
                        }
                      }}
                      disabled={step.id > currentStep}
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                        transition-all duration-300 border-2
                        ${isCompleted
                          ? "bg-primary border-primary text-white cursor-pointer hover:bg-primary/90"
                          : isCurrent
                            ? "bg-white border-primary text-primary shadow-lg shadow-primary/20"
                            : "bg-white border-border text-muted-foreground cursor-not-allowed"
                        }
                      `}
                    >
                      {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                    </button>
                    <div className="text-center hidden sm:block">
                      <p className={`text-xs font-semibold ${isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Current step label on mobile */}
            <div className="mt-4 text-center sm:hidden">
              <p className="text-sm font-semibold text-primary">
                Step {currentStep}: {STEPS[currentStep - 1].label}
              </p>
              <p className="text-xs text-muted-foreground">{STEPS[currentStep - 1].description}</p>
            </div>
          </div>

          {/* ── Step content ─────────────────────────────────────────── */}
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="relative overflow-hidden">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={currentStep}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >

                  {/* ── Step 1: Basics ────────────────────────────────── */}
                  {currentStep === 1 && (
                    <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
                      <div className="bg-primary/5 px-8 py-4 border-b border-border/50">
                        <h2 className="text-xl font-bold font-display">Basic Information</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">Give your event a title, category and date</p>
                      </div>
                      <CardContent className="p-8 space-y-6">
                        <div className="space-y-2">
                          <Label>Event Title</Label>
                          <Input
                            {...register("title")}
                            className="h-12 rounded-xl text-lg"
                            placeholder="Tallinn Summer Tech Mixer"
                          />
                          {errors.title && <p className="text-destructive text-sm">{errors.title.message}</p>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label>Category</Label>
                            <Controller
                              control={control}
                              name="category"
                              render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger className="h-12 rounded-xl">
                                    <SelectValue placeholder="Select a category…" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white dark:bg-gray-800">
                                    {EVENT_CATEGORIES.map(cat => (
                                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                            {errors.category && <p className="text-destructive text-sm">{errors.category.message}</p>}
                          </div>

                          <div className="space-y-2">
                            <Label>Date & Time</Label>
                            <Input {...register("date")} type="datetime-local" className="h-12 rounded-xl" />
                            {errors.date && <p className="text-destructive text-sm">{errors.date.message}</p>}
                          </div>
                        </div>

                        {watchedCategory && (
                          <div className="space-y-2">
                            <Label>Second Category <span className="text-muted-foreground font-normal">(optional)</span></Label>
                            <Controller
                              control={control}
                              name="category2"
                              render={({ field }) => (
                                <Select
                                  onValueChange={v => field.onChange(v === "__none__" ? null : v)}
                                  value={field.value ?? "__none__"}
                                >
                                  <SelectTrigger className="h-12 rounded-xl">
                                    <SelectValue placeholder="None" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white dark:bg-gray-800">
                                    <SelectItem value="__none__">— None —</SelectItem>
                                    {EVENT_CATEGORIES.filter(c => c.value !== watchedCategory).map(cat => (
                                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                        )}

                        {/* Group association */}
                        {eligibleGroups.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-border">
                            <Label className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-primary" />
                              Link to a Group <span className="text-muted-foreground font-normal">(optional)</span>
                            </Label>
                            <Controller
                              control={control}
                              name="groupId"
                              render={({ field }) => (
                                <Select
                                  onValueChange={v => field.onChange(v === "__none__" ? null : parseInt(v))}
                                  value={field.value != null ? String(field.value) : "__none__"}
                                >
                                  <SelectTrigger className="h-12 rounded-xl">
                                    <SelectValue placeholder="No group (public event)" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white dark:bg-gray-800">
                                    <SelectItem value="__none__">— No group (public event) —</SelectItem>
                                    {eligibleGroups.map(g => (
                                      <SelectItem key={g.id} value={String(g.id)}>
                                        {g.name}{g.currentUserRole === "owner" ? " (owner)" : " (moderator)"}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                        )}

                        {watchedGroupId && (
                          <div className="flex items-center justify-between pt-2 border-t border-border">
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

                  {/* ── Step 2: Details ───────────────────────────────── */}
                  {currentStep === 2 && (
                    <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
                      <div className="bg-primary/5 px-8 py-4 border-b border-border/50">
                        <h2 className="text-xl font-bold font-display">Event Details</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">Describe your event and set recurrence</p>
                      </div>
                      <CardContent className="p-8 space-y-6">
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea
                            {...register("description")}
                            className="rounded-xl min-h-[160px]"
                            placeholder="Tell people what to expect — format, agenda, vibe, what to bring…"
                          />
                          {errors.description && <p className="text-destructive text-sm">{errors.description.message}</p>}
                        </div>

                        <div className="space-y-3 pt-2 border-t border-border">
                          <p className="font-medium text-sm flex items-center gap-1.5">
                            <RefreshCw className="w-4 h-4 text-primary" /> Recurring event
                            <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                          </p>
                          <div className="flex flex-wrap gap-3">
                            {[
                              { value: "weekly",   label: "Weekly",      desc: "Same day every week"  },
                              { value: "biweekly", label: "Fortnightly", desc: "Every 2 weeks"        },
                              { value: "monthly",  label: "Monthly",     desc: "Same date each month" },
                            ].map(opt => (
                              <Controller key={opt.value} control={control} name="recurrence" render={({ field }) => (
                                <button
                                  type="button"
                                  onClick={() => field.onChange(field.value === opt.value ? null : opt.value)}
                                  className={`flex flex-col items-start px-4 py-3 rounded-xl border-2 transition-all text-left w-36 ${
                                    field.value === opt.value
                                      ? "border-primary bg-primary/5"
                                      : "border-border hover:border-primary/40"
                                  }`}
                                >
                                  <span className="font-semibold text-sm">{opt.label}</span>
                                  <span className="text-xs text-muted-foreground mt-0.5">{opt.desc}</span>
                                </button>
                              )} />
                            ))}
                          </div>
                          <div className="space-y-1 max-w-xs">
                            <Label>Repeat until <span className="text-muted-foreground font-normal text-xs">(optional — max 12 instances)</span></Label>
                            <Input {...register("recurrenceUntil")} type="date" className="h-11 rounded-xl" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* ── Step 3: Location & Media ──────────────────────── */}
                  {currentStep === 3 && (
                    <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
                      <div className="bg-primary/5 px-8 py-4 border-b border-border/50">
                        <h2 className="text-xl font-bold font-display">Location & Media</h2>
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

                        <LeafletLocationPicker
                          address={watch("venueAddress")}
                          city={watch("venueCity")}
                          onLocationPicked={(address, city) => {
                            setValue("venueAddress", address);
                            setValue("venueCity", city);
                          }}
                        />

                        <Controller
                          control={control}
                          name="imageUrl"
                          render={({ field }) => (
                            <ImageUpload
                              value={field.value}
                              onChange={field.onChange}
                              label="Cover Image"
                              hint="Upload a photo or use the default for your chosen category. Max 2MB."
                              aspectRatio="wide"
                            />
                          )}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* ── Step 4: Tickets ───────────────────────────────── */}
                  {currentStep === 4 && (
                    <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
                      <div className="bg-primary/5 px-8 py-4 border-b border-border/50 flex justify-between items-center">
                        <div>
                          <h2 className="text-xl font-bold font-display">Tickets</h2>
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
                      <CardContent className="p-8 space-y-6 bg-muted/10">
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
                              <Input {...register(`ticketTypes.${index}.name`)} placeholder="VIP Access" className="h-11 rounded-xl" />
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

                  {/* ── Step 5: Review ────────────────────────────────── */}
                  {currentStep === 5 && (
                    <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
                      <div className="bg-primary/5 px-8 py-4 border-b border-border/50">
                        <h2 className="text-xl font-bold font-display">Review & Publish</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">Check everything looks right before publishing</p>
                      </div>
                      <CardContent className="p-8 space-y-6">

                        {/* Cover image preview */}
                        {allValues.imageUrl && (
                          <div className="rounded-2xl overflow-hidden aspect-video w-full">
                            <img src={allValues.imageUrl} alt="Cover" className="w-full h-full object-cover" />
                          </div>
                        )}

                        {/* Summary rows */}
                        <div className="space-y-4">
                          {[
                            { label: "Title",    value: allValues.title },
                            { label: "Category", value: EVENT_CATEGORIES.find(c => c.value === allValues.category)?.label },
                            {
                              label: "Date",
                              value: allValues.date
                                ? new Date(allValues.date).toLocaleDateString("en-GB", {
                                    weekday: "long", day: "numeric", month: "long",
                                    year: "numeric", hour: "2-digit", minute: "2-digit",
                                  })
                                : null,
                            },
                            { label: "Location", value: allValues.venueAddress && allValues.venueCity ? `${allValues.venueAddress}, ${allValues.venueCity}` : null },
                            { label: "Recurrence", value: allValues.recurrence ?? "One-time event" },
                          ].map(row => row.value ? (
                            <div key={row.label} className="flex gap-4 py-3 border-b border-border/50 last:border-0">
                              <span className="text-sm text-muted-foreground w-24 shrink-0">{row.label}</span>
                              <span className="text-sm font-medium">{row.value}</span>
                            </div>
                          ) : null)}
                        </div>

                        {/* Description preview */}
                        {allValues.description && (
                          <div className="rounded-xl bg-muted/40 p-4">
                            <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">Description</p>
                            <p className="text-sm leading-relaxed line-clamp-4">{allValues.description}</p>
                          </div>
                        )}

                        {/* Tickets summary */}
                        {allValues.ticketTypes?.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Tickets</p>
                            <div className="space-y-2">
                              {allValues.ticketTypes.map((t, i) => (
                                <div key={i} className="flex justify-between items-center rounded-xl bg-muted/30 px-4 py-2.5 text-sm">
                                  <span className="font-medium">{t.name || "Unnamed"}</span>
                                  <span className="text-muted-foreground">
                                    {t.price === 0 ? "Free" : `€${t.price}`} · {t.quantity} available
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

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
            <div className="flex gap-4 mt-8">
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={goBack}
                  className="flex-1 h-14 rounded-2xl text-base"
                >
                  <ChevronLeft className="w-5 h-5 mr-1" /> Back
                </Button>
              )}

              {currentStep < STEPS.length ? (
                <Button
                  type="button"
                  onClick={goNext}
                  className="flex-1 h-14 text-base rounded-2xl shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
                >
                  Next <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={createEvent.isPending || isLoading}
                  className="flex-1 h-14 text-lg rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-1 transition-all"
                >
                  {createEvent.isPending ? "Publishing…" : "Publish Event"}
                </Button>
              )}
            </div>

            {/* Step counter */}
            <p className="text-center text-xs text-muted-foreground mt-4">
              Step {currentStep} of {STEPS.length}
            </p>
          </form>

        </motion.div>
      </div>
    </div>
  );
}
