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
import { Trash2, Plus, CalendarPlus, AlertCircle, RefreshCw, Users } from "lucide-react";
import { motion } from "framer-motion";
import { EVENT_CATEGORIES, EVENT_CATEGORY_VALUES } from "@shared/categories";
import { ImageUpload } from "@/components/ui/ImageUpload";

// ── Category default images ───────────────────────────────────────────────
// Curated Unsplash photos (high resolution) that match each event category.
// Used to pre-fill the cover image when a category is selected.
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
  category: z.enum(EVENT_CATEGORY_VALUES as [string, ...string[]], {
    required_error: "Please select a category",
  }),
  category2: z.string().optional().nullable(),
  date: z.coerce.date({ required_error: "Valid date is required" }),
  venueAddress: z.string().min(3, "Address is required"),
  venueCity: z.string().min(2, "City is required"),
  imageUrl: z.string().optional().nullable(),
  ticketTypes: z
    .array(
      z.object({
        name: z.string().min(1, "Name required"),
        price: z.coerce.number().min(0, "Price >= 0"),
        quantity: z.coerce.number().min(1, "Quantity > 0"),
        maxPerOrder: z.coerce.number().min(1, "Max > 0"),
      })
    )
    .min(1, "Add at least one ticket type"),
  groupId: z.number().optional().nullable(),
  isPrivate: z.boolean().optional().default(false),
  recurrence: z.enum(["weekly", "biweekly", "monthly"]).optional().nullable(),
  recurrenceUntil: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof createEventSchema>;

export default function CreateEvent({ groupSlug }: { groupSlug?: string } = {}) {
  const [, setLocation] = useLocation();
  const params = useParams<{ groupId?: string }>();
  const createEvent = useCreateEvent();
  const { user, isLoading } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showRecurrence, setShowRecurrence] = useState(false);

  // Fetch groups the current user is a member of (owner or moderator)
  const { data: myGroups } = useQuery<any[]>({
    queryKey: ["/api/groups/my"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  });

  // Only show groups where user can post events (owner or moderator)
  const eligibleGroups = (myGroups ?? []).filter(
    g => g.currentUserRole === "owner" || g.currentUserRole === "moderator"
  );

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      ticketTypes: [
        { name: "General Admission", price: 0, quantity: 100, maxPerOrder: 5 },
      ],
      isPrivate: false,
      groupId: null,
    },
  });

  // When arriving via /groups/:slug/create-event, resolve slug → numeric group id
  useEffect(() => {
    if (groupSlug && myGroups) {
      const group = myGroups.find((g: any) => g.slug === groupSlug);
      if (group) setValue("groupId", group.id);
    } else if (params.groupId) {
      const numericId = parseInt(params.groupId, 10);
      if (!isNaN(numericId)) setValue("groupId", numericId);
    }
  }, [groupSlug, myGroups, params.groupId, setValue]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "ticketTypes",
  });

  const watchedCategory = useWatch({ control, name: "category" });
  const watchedGroupId = watch("groupId");
  const watchedImageUrl = watch("imageUrl");

  // Auto-fill default image when category changes and no image is set yet
  useEffect(() => {
    if (watchedCategory && !watchedImageUrl) {
      const defaultImg = CATEGORY_DEFAULT_IMAGES[watchedCategory];
      if (defaultImg) setValue("imageUrl", defaultImg);
    }
  }, [watchedCategory, watchedImageUrl, setValue]);

  const onSubmit = async (data: FormValues) => {
    setSubmitError(null);
    if (!user) {
      window.location.href = `${AUTH_URL}/login?returnTo=${encodeURIComponent(window.location.href)}`;
      return;
    }

    try {
      await createEvent.mutateAsync({
        ...data,
        published: true,
        groupId: data.groupId ?? null,
        isPrivate: data.isPrivate ?? false,
        recurrence: showRecurrence ? data.recurrence : null,
        recurrenceUntil: showRecurrence ? data.recurrenceUntil : null,
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
          onClick={() =>
            (window.location.href = `${AUTH_URL}/login?returnTo=${encodeURIComponent(window.location.href)}`)
          }
          className="rounded-full px-8 h-12 shadow-lg shadow-primary/20"
        >
          Sign In to Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-10 text-center">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/10">
              <CalendarPlus className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-display font-bold mb-4">Host an Event</h1>
            <p className="text-muted-foreground text-lg">
              Fill in the details to publish your event to the community.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Basic Information */}
            <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
              <div className="bg-primary/5 px-8 py-4 border-b border-border/50">
                <h2 className="text-xl font-bold font-display">Basic Information</h2>
              </div>
              <CardContent className="p-8 space-y-6">
                {/* ... rest of your form stays exactly the same ... */}
                {/* (I kept everything from here down unchanged) */}
