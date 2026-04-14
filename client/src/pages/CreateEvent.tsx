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
import { Trash2, Plus, CalendarPlus, AlertCircle, RefreshCw, Users, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EVENT_CATEGORIES, EVENT_CATEGORY_VALUES } from "@shared/categories";
import { ImageUpload } from "@/components/ui/ImageUpload";

// ── Category default images ───────────────────────────────────────────────
const CATEGORY_DEFAULT_IMAGES: Record<string, string> = {
  networking: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200&auto=format&fit=crop",
  tech: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&auto=format&fit=crop",
  culture: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&auto=format&fit=crop",
  food: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&auto=format&fit=crop",
  sports: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1200&auto=format&fit=crop",
  music: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&auto=format&fit=crop",
  language: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=1200&auto=format&fit=crop",
  outdoor: "https://images.unsplash.com/photo-1533692328991-08159ff19fca?w=1200&auto=format&fit=crop",
  games: "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=1200&auto=format&fit=crop",
  business: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&auto=format&fit=crop",
  wellness: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&auto=format&fit=crop",
  family: "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=1200&auto=format&fit=crop",
  social: "https://images.unsplash.com/photo-1529543544282-ea669407fca3?w=1200&auto=format&fit=crop",
  volunteering: "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=1200&auto=format&fit=crop",
  other: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop",
};

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "https://auth.expatevents.org";

const createEventSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Provide a better description"),
  category: z.enum(EVENT_CATEGORY_VALUES as [string, ...string[]]),
  category2: z.string().optional().nullable(),
  date: z.coerce.date({ required_error: "Valid date is required" }),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time"), // HH:mm
  venueAddress: z.string().min(3, "Address is required"),
  venueCity: z.string().min(2, "City is required"),
  yandexMapLink: z.string().url("Please enter a valid Yandex Maps link").optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  ticketTypes: z
    .array(
      z.object({
        name: z.string().min(1, "Name required"),
        price: z.coerce.number().min(0),
        quantity: z.coerce.number().min(1),
        maxPerOrder: z.coerce.number().min(1),
      })
    )
    .min(1, "Add at least one ticket type"),
  groupId: z.number().optional().nullable(),
  isPrivate: z.boolean().default(false),
  recurrence: z.enum(["weekly", "biweekly", "monthly"]).optional().nullable(),
  recurrenceUntil: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof createEventSchema>;

const STEPS = [
  "Event Details",
  "Date & Time",
  "Location",
  "Tickets",
  "Preview & Publish",
];

export default function CreateEvent({ groupSlug }: { groupSlug?: string } = {}) {
  const [, setLocation] = useLocation();
  const params = useParams<{ groupId?: string }>();
  const createEvent = useCreateEvent();
  const { user, isLoading } = useAuth();

  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showRecurrence, setShowRecurrence] = useState(false);

  const { data: myGroups } = useQuery<any[]>({
    queryKey: ["/api/groups/my"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  });

  const eligibleGroups = (myGroups ?? []).filter(
    (g) => g.currentUserRole === "owner" || g.currentUserRole === "moderator"
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      ticketTypes: [{ name: "General Admission", price: 0, quantity: 100, maxPerOrder: 5 }],
      isPrivate: false,
      groupId: null,
      time: "18:00",
    },
  });

  const { register, control, handleSubmit, setValue, watch, formState: { errors } } = form;

  const watchedCategory = watch("category");
  const watchedImageUrl = watch("imageUrl");
  const watchedDate = watch("date");
  const watchedTime = watch("time");

  // Auto-fill default image
  useEffect(() => {
    if (watchedCategory && !watchedImageUrl) {
      const defaultImg = CATEGORY_DEFAULT_IMAGES[watchedCategory as keyof typeof CATEGORY_DEFAULT_IMAGES];
      if (defaultImg) setValue("imageUrl", defaultImg);
    }
  }, [watchedCategory, watchedImageUrl, setValue]);

  // Group pre-selection
  useEffect(() => {
    if (groupSlug && myGroups) {
      const group = myGroups.find((g: any) => g.slug === groupSlug);
      if (group) setValue("groupId", group.id);
    } else if (params.groupId) {
      const numericId = parseInt(params.groupId, 10);
      if (!isNaN(numericId)) setValue("groupId", numericId);
    }
  }, [groupSlug, myGroups, params.groupId, setValue]);

  const { fields, append, remove } = useFieldArray({ control, name: "ticketTypes" });

  const onSubmit = async (data: FormValues) => {
    setSubmitError(null);
    if (!user) {
      window.location.href = `${AUTH_URL}/login?returnTo=${encodeURIComponent(window.location.href)}`;
      return;
    }

    try {
      const fullDateTime = new Date(data.date);
      const [hours, minutes] = data.time.split(":").map(Number);
      fullDateTime.setHours(hours, minutes);

      const payload = {
        ...data,
        date: fullDateTime,
        published: true,
        groupId: data.groupId ?? null,
        isPrivate: data.isPrivate ?? false,
        recurrence: showRecurrence ? data.recurrence : null,
        recurrenceUntil: showRecurrence ? data.recurrenceUntil : null,
      };

      const result = await createEvent.mutateAsync(payload as any);
      // Redirect to the newly created event (adjust route if needed)
      setLocation(`/events/${result.id || result._id}`);
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("401")) setSubmitError("You need to be signed in.");
      else if (msg.includes("403")) setSubmitError("You don't have permission.");
      else setSubmitError(msg || "Failed to create event. Please try again.");
    }
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  // Generate 15-minute time slots
  const timeSlots: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hourStr = h.toString().padStart(2, "0");
      const minStr = m.toString().padStart(2, "0");
      timeSlots.push(`${hourStr}:${minStr}`);
    }
  }

  if (!isLoading && !user) {
    // ... your existing not-logged-in screen ...
    return (/* your sign-in screen */);
  }

  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Progress Stepper */}
        <div className="mb-10">
          <div className="flex justify-between mb-4">
            {STEPS.map((label, index) => (
              <div key={index} className={`flex flex-col items-center ${index <= step ? "text-primary" : "text-muted-foreground"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${index < step ? "bg-primary border-primary text-white" : index === step ? "border-primary" : "border-muted"}`}>
                  {index < step ? <Check className="w-4 h-4" /> : index + 1}
                </div>
                <span className="text-xs mt-1 hidden sm:block">{label}</span>
              </div>
            ))}
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: "0%" }}
              animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
              <CalendarPlus className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-display font-bold">Host an Event</h1>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <AnimatePresence mode="wait">
              {/* Step 1: Event Details */}
              {step === 0 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  {/* Title, Description, Categories, Group, Private, Recurrence - copy from your old code */}
                  {/* ... (I kept the structure similar - paste your fields here) ... */}
                </motion.div>
              )}

              {/* Step 2: Date & Time */}
              {step === 1 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <Card>
                    <CardContent className="p-8 space-y-6">
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input type="date" {...register("date")} className="h-12" />
                      </div>
                      <div className="space-y-2">
                        <Label>Time (15-minute increments)</Label>
                        <Controller
                          control={control}
                          name="time"
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="h-12">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {timeSlots.map((t) => (
                                  <SelectItem key={t} value={t}>{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Step 3: Location */}
              {step === 2 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <Card>
                    <CardContent className="p-8 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Venue Address</Label>
                          <Input {...register("venueAddress")} placeholder="Tverskaya St, 1" />
                        </div>
                        <div className="space-y-2">
                          <Label>City</Label>
                          <Input {...register("venueCity")} placeholder="Moscow" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Yandex Maps Share Link (optional)</Label>
                        <Input {...register("yandexMapLink")} placeholder="https://yandex.ru/maps/... " />
                        <p className="text-xs text-muted-foreground">Paste the share link from Yandex Maps for easy directions.</p>
                      </div>
                      <Controller name="imageUrl" control={control} render={({ field }) => (
                        <ImageUpload value={field.value} onChange={field.onChange} label="Cover Image" aspectRatio="wide" />
                      )} />
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Step 4: Tickets */}
              {step === 3 && (
                <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  {/* Your existing Tickets card here */}
                </motion.div>
              )}

              {/* Step 5: Preview & Publish */}
              {step === 4 && (
                <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <Card>
                    <CardContent className="p-8">
                      <h2 className="text-2xl font-bold mb-6">Preview Your Event</h2>
                      {/* Simple event card preview using watched values */}
                      <div className="border rounded-2xl p-6 mb-8 bg-card">
                        <img src={watchedImageUrl} alt="" className="w-full h-48 object-cover rounded-xl mb-4" />
                        <h3 className="text-2xl font-semibold">{watch("title")}</h3>
                        <p className="text-muted-foreground mt-2 line-clamp-3">{watch("description")}</p>
                        <p className="mt-4 text-sm">📍 {watch("venueAddress")}, {watch("venueCity")}</p>
                        <p className="text-sm">🕒 {watch("date")?.toLocaleDateString()} at {watch("time")}</p>
                      </div>

                      {/* Legal Disclaimer */}
                      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-sm leading-relaxed mb-8">
                        <strong className="block mb-2">Important Legal Notice</strong>
                        ExpatEvents provides the infrastructure to organise activities. The voluntary organisers do not represent ExpatEvents as vicarious agents. In the case of gross negligence by the organisers, ExpatEvents therefore does not accept any legal responsibility for resulting damages. Neither ExpatEvents nor the event organisers assume liability for any loss of or damage to personal property, nor shall they be held responsible in the event of financial, physical, or emotional damage.
                      </div>

                      <Button
                        type="submit"
                        disabled={createEvent.isPending}
                        className="w-full h-14 text-lg"
                      >
                        {createEvent.isPending ? "Publishing..." : "Publish Event"}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              {step > 0 && (
                <Button type="button" variant="outline" onClick={prevStep} className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={nextStep} className="ml-auto flex items-center gap-2">
                  Next <ArrowRight className="w-4 h-4" />
                </Button>
              ) : null}
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
