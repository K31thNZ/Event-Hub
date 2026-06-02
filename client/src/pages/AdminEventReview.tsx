// client/src/pages/AdminEventReview.tsx
//
// Full admin event review UI — designed for the publish/reject workflow.
// Backend endpoints used (all in admin-routes.ts):
//   GET    /api/admin/events          — all events (published + draft)
//   PATCH  /api/admin/events/:id      — update any field incl. published
//   DELETE /api/admin/events/:id      — hard delete
//
// New endpoint needed in admin-routes.ts (add below existing routes):
//   PATCH  /api/admin/events/:id/publish   → { published: true }
//   PATCH  /api/admin/events/:id/unpublish → { published: false }
//   These are just convenience wrappers — the existing PATCH handles them fine,
//   so they can be called directly via PATCH /api/admin/events/:id with { published: true/false }.

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import { formatEventDate, formatEventTime, formatEventDateTime } from "@/lib/date-utils";
import { motion, AnimatePresence } from "framer-motion";
import { EVENT_CATEGORIES, EVENT_CATEGORY_VALUES } from "@shared/categories";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2, XCircle, Pencil, Trash2, Eye, EyeOff, ExternalLink,
  Search, Filter, RefreshCw, ChevronLeft, MapPin, Calendar, Tag,
  Layers, Globe, ShieldAlert, LayoutList, LayoutGrid, Check, X,
  Clock, Sparkles, ArrowUpDown, Plus, Minus, Lock, Unlock, Repeat,
} from "lucide-react";
import { MapLibreLocationPicker } from "@/components/ui/MapLibreLocationPicker";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TicketType {
  id: number;
  name: string;
  price: number;
  quantity: number;
  maxPerOrder: number;
}

interface AdminEvent {
  id: number;
  title: string;
  description: string;
  category: string;
  category2?: string | null;
  date: string;
  venueAddress: string;
  venueCity: string;
  locationName?: string | null;   // 🌟 added
  lat?: number | null;
  lng?: number | null;
  imageUrl?: string | null;
  published: boolean;
  isPrivate: boolean;
  recurrence?: string | null;
  sourceUrl?: string | null;
  organizerId: string;
  createdAt: string;
  ticketTypes: TicketType[];
}

// ── Edit sheet schema ─────────────────────────────────────────────────────────
const ticketSchema = z.object({
  id:           z.number().optional(),
  name:         z.string().min(1, "Required"),
  price:        z.number().min(0),
  quantity:     z.number().min(1),
  maxPerOrder:  z.number().min(1),
});

const editSchema = z.object({
  title:        z.string().min(3, "Min 3 chars"),
  description:  z.string().min(10, "Min 10 chars"),
  category:     z.enum(EVENT_CATEGORY_VALUES as [string, ...string[]]),
  category2:    z.string().optional().nullable(),
  date:         z.string().min(1),
  venueAddress: z.string().min(2),
  venueCity:    z.string().min(2),
  locationName: z.string().optional().nullable(),
  lat:          z.number().optional().nullable(),
  lng:          z.number().optional().nullable(),
  imageUrl:     z.string().optional().nullable(),
  sourceUrl:    z.string().optional().nullable(),
  isPrivate:    z.boolean(),
  recurrence:   z.string().optional().nullable(),
  published:    z.boolean(),
  ticketTypes:  z.array(ticketSchema).optional(),
});
type EditValues = z.infer<typeof editSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────
const CATEGORY_MAP = Object.fromEntries(EVENT_CATEGORIES.map(c => [c.value, c.label]));

function statusBadge(event: AdminEvent) {
  if (event.published) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        <CheckCircle2 className="w-3 h-3" /> Published
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
      <Clock className="w-3 h-3" /> Draft
    </span>
  );
}

// ── Edit Sheet ────────────────────────────────────────────────────────────────
function EditSheet({
  event, open, onClose, onSaved,
}: {
  event: AdminEvent | null;
  open:  boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    values: event ? {
      title:        event.title,
      description:  event.description,
      category:     event.category,
      category2:    event.category2 ?? null,
      date:         format(new Date(event.date), "yyyy-MM-dd'T'HH:mm"),
      venueAddress: event.venueAddress,
      venueCity:    event.venueCity,
      locationName: event.locationName ?? null,
      lat:          event.lat ?? null,
      lng:          event.lng ?? null,
      imageUrl:     event.imageUrl ?? "",
      sourceUrl:    event.sourceUrl ?? "",
      isPrivate:    event.isPrivate,
      recurrence:   event.recurrence ?? null,
      published:    event.published,
      ticketTypes:  event.ticketTypes?.map(t => ({
        id:          t.id,
        name:        t.name,
        price:       t.price,
        quantity:    t.quantity,
        maxPerOrder: t.maxPerOrder,
      })) ?? [],
    } : undefined,
  });

  const { fields: ticketFields, append: appendTicket, remove: removeTicket } =
    (form as any).useFieldArray
      ? (form as any).useFieldArray({ name: "ticketTypes" })
      : { fields: form.watch("ticketTypes") ?? [], append: () => {}, remove: () => {} };

  const watchedCategory = form.watch("category");
  const watchedImage    = form.watch("imageUrl");
  const watchedLat      = form.watch("lat");
  const watchedLng      = form.watch("lng");
  const watchedAddress  = form.watch("venueAddress");
  const watchedCity     = form.watch("venueCity");
  const watchedTickets  = form.watch("ticketTypes") ?? [];

  const onSubmit = async (data: EditValues) => {
    if (!event) return;
    try {
      await apiRequest("PATCH", `/api/admin/events/${event.id}`, data);
      toast({ title: "Event saved ✓" });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    }
  };

  // Add / remove ticket rows managed via form array watch
  const handleAddTicket = () => {
    const cur = form.getValues("ticketTypes") ?? [];
    form.setValue("ticketTypes", [...cur, { name: "", price: 0, quantity: 50, maxPerOrder: 4 }]);
  };
  const handleRemoveTicket = (idx: number) => {
    const cur = form.getValues("ticketTypes") ?? [];
    form.setValue("ticketTypes", cur.filter((_, i) => i !== idx));
  };

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-5">
          <SheetTitle className="text-xl font-bold flex items-center gap-2">
            <Pencil className="w-5 h-5 text-primary" /> Edit Event
          </SheetTitle>
          <SheetDescription>
            ID #{event?.id} · All changes save on submit.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pb-10">

          {/* ── Cover image preview ── */}
          {watchedImage && (
            <div className="rounded-xl overflow-hidden aspect-video bg-muted border border-border">
              <img src={watchedImage} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          {/* ── Title ── */}
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input {...form.register("title")} className="h-11 rounded-xl" />
            {form.formState.errors.title && <p className="text-destructive text-xs">{form.formState.errors.title.message}</p>}
          </div>

          {/* ── Description ── */}
          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Textarea {...form.register("description")} className="rounded-xl min-h-[120px]" />
            {form.formState.errors.description && <p className="text-destructive text-xs">{form.formState.errors.description.message}</p>}
          </div>

          {/* ── Categories ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Controller control={form.control} name="category" render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-900">
                    {EVENT_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1.5">
              <Label>Second Category <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Controller control={form.control} name="category2" render={({ field }) => (
                <Select onValueChange={v => field.onChange(v === "__none__" ? null : v)} value={field.value ?? "__none__"}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-900">
                    <SelectItem value="__none__">— None —</SelectItem>
                    {EVENT_CATEGORIES.filter(c => c.value !== watchedCategory).map(c =>
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>

          {/* ── Date & Time ── */}
          <div className="space-y-1.5">
            <Label>Date & Time *</Label>
            <Input {...form.register("date")} type="datetime-local" className="h-11 rounded-xl" />
          </div>

          {/* ── Venue fields ── */}
          <div className="space-y-1.5">
            <Label>Venue / Place Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input {...form.register("locationName")} className="h-11 rounded-xl" placeholder="e.g. Surf Coffee, Gorky Park" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Address *</Label>
              <Input {...form.register("venueAddress")} className="h-11 rounded-xl" />
              {form.formState.errors.venueAddress && <p className="text-destructive text-xs">{form.formState.errors.venueAddress.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>City *</Label>
              <Input {...form.register("venueCity")} className="h-11 rounded-xl" />
              {form.formState.errors.venueCity && <p className="text-destructive text-xs">{form.formState.errors.venueCity.message}</p>}
            </div>
          </div>

          {/* ── Map pin ── */}
          <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-primary" /> Coordinates
              </p>
              {(watchedLat || watchedLng) && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-destructive underline"
                  onClick={() => { form.setValue("lat", null); form.setValue("lng", null); }}
                >
                  Clear pin
                </button>
              )}
            </div>

            {/* Manual lat/lng override */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Latitude</Label>
                <Input
                  {...form.register("lat", { setValueAs: v => v === "" || v === null ? null : parseFloat(v) })}
                  className="h-9 rounded-lg font-mono text-xs"
                  placeholder="55.7558"
                  step="0.00001"
                  type="number"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Longitude</Label>
                <Input
                  {...form.register("lng", { setValueAs: v => v === "" || v === null ? null : parseFloat(v) })}
                  className="h-9 rounded-lg font-mono text-xs"
                  placeholder="37.6176"
                  step="0.00001"
                  type="number"
                />
              </div>
            </div>

            {/* Interactive map */}
            <MapLibreLocationPicker
              address={watchedAddress}
              city={watchedCity}
              lat={watchedLat ?? undefined}
              lng={watchedLng ?? undefined}
              onLocationPicked={({ address, city, lat, lng }) => {
                form.setValue("venueAddress", address, { shouldDirty: true });
                form.setValue("venueCity",    city,    { shouldDirty: true });
                form.setValue("lat",          lat,     { shouldDirty: true });
                form.setValue("lng",          lng,     { shouldDirty: true });
              }}
            />
          </div>

          {/* ── Cover image URL ── */}
          <div className="space-y-1.5">
            <Label>Cover Image URL</Label>
            <Input {...form.register("imageUrl")} className="h-11 rounded-xl font-mono text-xs" placeholder="https://…" />
          </div>

          {/* ── Source URL ── */}
          <div className="space-y-1.5">
            <Label>Source URL <span className="text-muted-foreground text-xs">(original post / event page)</span></Label>
            <Input {...form.register("sourceUrl")} className="h-11 rounded-xl font-mono text-xs" placeholder="https://…" />
          </div>

          {/* ── Recurrence ── */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Repeat className="w-3.5 h-3.5" /> Recurrence <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Controller control={form.control} name="recurrence" render={({ field }) => (
              <Select onValueChange={v => field.onChange(v === "__none__" ? null : v)} value={field.value ?? "__none__"}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="One-off event" /></SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-900">
                  <SelectItem value="__none__">— One-off —</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>

          {/* ── Visibility & Status ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Controller control={form.control} name="isPrivate" render={({ field }) => (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => field.onChange(false)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${!field.value ? "bg-sky-600 text-white border-sky-600" : "border-border text-muted-foreground hover:border-sky-400"}`}
                  >
                    <Unlock className="w-3.5 h-3.5" /> Public
                  </button>
                  <button
                    type="button"
                    onClick={() => field.onChange(true)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${field.value ? "bg-zinc-700 text-white border-zinc-700" : "border-border text-muted-foreground hover:border-zinc-400"}`}
                  >
                    <Lock className="w-3.5 h-3.5" /> Private
                  </button>
                </div>
              )} />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Controller control={form.control} name="published" render={({ field }) => (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => field.onChange(true)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${field.value ? "bg-emerald-600 text-white border-emerald-600" : "border-border text-muted-foreground hover:border-emerald-400"}`}
                  >
                    <Eye className="w-3.5 h-3.5" /> Published
                  </button>
                  <button
                    type="button"
                    onClick={() => field.onChange(false)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${!field.value ? "bg-amber-500 text-white border-amber-500" : "border-border text-muted-foreground hover:border-amber-400"}`}
                  >
                    <EyeOff className="w-3.5 h-3.5" /> Draft
                  </button>
                </div>
              )} />
            </div>
          </div>

          {/* ── Ticket types ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Ticket Types
                <span className="text-muted-foreground text-xs font-normal">({watchedTickets.length})</span>
              </Label>
              <Button type="button" size="sm" variant="outline" className="h-8 rounded-xl gap-1.5 text-xs" onClick={handleAddTicket}>
                <Plus className="w-3.5 h-3.5" /> Add Ticket
              </Button>
            </div>

            {watchedTickets.length === 0 && (
              <p className="text-xs text-muted-foreground bg-muted rounded-xl px-4 py-3">
                No ticket types — this is a free event. Add a ticket type to start selling.
              </p>
            )}

            {watchedTickets.map((ticket, idx) => (
              <div key={idx} className="rounded-xl border border-border bg-background p-4 space-y-3 relative">
                <button
                  type="button"
                  onClick={() => handleRemoveTicket(idx)}
                  className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <div className="space-y-1.5">
                  <Label className="text-xs">Ticket Name</Label>
                  <Input
                    {...form.register(`ticketTypes.${idx}.name`)}
                    className="h-9 rounded-lg text-sm"
                    placeholder="General Admission"
                  />
                  {(form.formState.errors.ticketTypes as any)?.[idx]?.name && (
                    <p className="text-destructive text-xs">{(form.formState.errors.ticketTypes as any)[idx].name.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Price (₽)</Label>
                    <Input
                      {...form.register(`ticketTypes.${idx}.price`, { valueAsNumber: true })}
                      className="h-9 rounded-lg text-sm"
                      type="number"
                      min={0}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Total Qty</Label>
                    <Input
                      {...form.register(`ticketTypes.${idx}.quantity`, { valueAsNumber: true })}
                      className="h-9 rounded-lg text-sm"
                      type="number"
                      min={1}
                      placeholder="50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max / Order</Label>
                    <Input
                      {...form.register(`ticketTypes.${idx}.maxPerOrder`, { valueAsNumber: true })}
                      className="h-9 rounded-lg text-sm"
                      type="number"
                      min={1}
                      placeholder="4"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Submit ── */}
          <div className="flex gap-3 pt-4 border-t border-border sticky bottom-0 bg-background py-4 -mx-6 px-6">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting} className="flex-1 rounded-xl">
              {form.formState.isSubmitting ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}


// ── Event Detail Panel (slide-in preview) ─────────────────────────────────────
function EventDetailPanel({
  event, onClose, onPublish, onUnpublish, onEdit, onDelete,
}: {
  event: AdminEvent | null;
  onClose: () => void;
  onPublish: (e: AdminEvent) => void;
  onUnpublish: (e: AdminEvent) => void;
  onEdit: (e: AdminEvent) => void;
  onDelete: (e: AdminEvent) => void;
}) {
  if (!event) return null;
  const eventDate = new Date(event.date);

  return (
    <motion.div
      key={event.id}
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">Event Preview</h3>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Cover */}
        {event.imageUrl ? (
          <div className="aspect-video w-full overflow-hidden bg-muted">
            <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="aspect-video w-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
            <span className="text-5xl opacity-30">📍</span>
          </div>
        )}

        <div className="p-6 space-y-5">
          {/* Status + ID */}
          <div className="flex items-center justify-between gap-3">
            {statusBadge(event)}
            <span className="text-xs text-muted-foreground font-mono">#{event.id}</span>
          </div>

          {/* Title */}
          <div>
            <h2 className="text-xl font-bold leading-snug">{event.title}</h2>
            {event.recurrence && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Repeats {event.recurrence}
              </p>
            )}
          </div>

          {/* Meta grid */}
          <div className="space-y-2.5 text-sm">
            <div className="flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <span>{format(eventDate, "EEEE, d MMMM yyyy")} at {format(eventDate, "HH:mm")}</span>
            </div>
            {event.locationName && (
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <span className="font-medium">{event.locationName}</span>
              </div>
            )}
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <span>{event.venueAddress}{event.venueCity && event.venueCity !== event.venueAddress ? `, ${event.venueCity}` : ""}</span>
            </div>
            {event.lat && event.lng && (
              <div className="flex items-start gap-2.5 text-xs text-muted-foreground font-mono">
                <Globe className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{event.lat.toFixed(5)}, {event.lng.toFixed(5)}</span>
              </div>
            )}
            <div className="flex items-start gap-2.5">
              <Tag className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-xs capitalize">{CATEGORY_MAP[event.category] ?? event.category}</Badge>
                {event.category2 && <Badge variant="outline" className="text-xs capitalize">{CATEGORY_MAP[event.category2] ?? event.category2}</Badge>}
              </div>
            </div>
            {event.sourceUrl && (
              <div className="flex items-start gap-2.5">
                <ExternalLink className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline text-xs truncate max-w-[220px]">
                  {event.sourceUrl}
                </a>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="bg-muted/40 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">Description</p>
            <p className="text-sm leading-relaxed whitespace-pre-line">{event.description}</p>
          </div>

          {/* Tickets */}
          {event.ticketTypes.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">Tickets</p>
              <div className="space-y-1.5">
                {event.ticketTypes.map(t => (
                  <div key={t.id} className="flex justify-between items-center bg-muted/30 rounded-lg px-3 py-2 text-sm">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-muted-foreground text-xs">{t.price === 0 ? "Free" : `€${t.price}`} · {t.quantity} seats</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Created */}
          <p className="text-xs text-muted-foreground">
            Created {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Action footer */}
      <div className="shrink-0 border-t border-border p-4 space-y-2 bg-background">
        {/* Primary publish / unpublish */}
        {!event.published ? (
          <Button
            onClick={() => onPublish(event)}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            <CheckCircle2 className="w-4 h-4" /> Publish Event
          </Button>
        ) : (
          <Button
            onClick={() => onUnpublish(event)}
            variant="outline"
            className="w-full rounded-xl gap-2 text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
          >
            <EyeOff className="w-4 h-4" /> Unpublish
          </Button>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onEdit(event)} className="flex-1 rounded-xl gap-2">
            <Pencil className="w-4 h-4" /> Edit
          </Button>
          <Button variant="outline" onClick={() => onDelete(event)}
            className="flex-1 rounded-xl gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
            <Trash2 className="w-4 h-4" /> Delete
          </Button>
        </div>
        {event.sourceUrl && (
          <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="block w-full">
            <Button variant="ghost" className="w-full rounded-xl gap-2 text-muted-foreground text-xs">
              <ExternalLink className="w-3.5 h-3.5" /> View Source
            </Button>
          </a>
        )}
      </div>
    </motion.div>
  );
}

// ── Event Row (list view) ─────────────────────────────────────────────────────
function EventRow({
  event, selected, onClick, onQuickPublish, onQuickDelete,
}: {
  event: AdminEvent;
  selected: boolean;
  onClick: () => void;
  onQuickPublish: (e: AdminEvent, publish: boolean) => void;
  onQuickDelete: (e: AdminEvent) => void;
}) {
  const eventDate = new Date(event.date);
  const isPast = eventDate < new Date();

  return (
    <div
      onClick={onClick}
      className={`
        group flex items-center gap-4 px-4 py-3.5 rounded-2xl border cursor-pointer transition-all
        ${selected
          ? "bg-primary/5 border-primary/30 shadow-sm"
          : "bg-card border-border hover:border-primary/20 hover:shadow-sm"
        }
      `}
    >
      {/* Thumbnail */}
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted shrink-0 border border-border">
        {event.imageUrl ? (
          <img src={event.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground/30 text-2xl">
            📍
          </div>
        )}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <p className={`font-semibold text-sm truncate ${isPast && !event.published ? "text-muted-foreground" : ""}`}>
            {event.title}
          </p>
          {event.sourceUrl && (
            <span title="Scraped event">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {format(eventDate, "d MMM, HH:mm")}
            {isPast && <span className="text-destructive/60 ml-1">(past)</span>}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {event.locationName || event.venueCity}
          </span>
          <Badge variant="outline" className="text-xs capitalize py-0 px-1.5">
            {CATEGORY_MAP[event.category] ?? event.category}
          </Badge>
        </div>
      </div>

      {/* Status + quick actions */}
      <div className="flex items-center gap-2 shrink-0">
        {statusBadge(event)}

        {/* Quick publish/unpublish */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!event.published ? (
            <button
              title="Publish"
              onClick={e => { e.stopPropagation(); onQuickPublish(event, true); }}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 transition-colors"
            >
              <Check className="w-4 h-4" />
            </button>
          ) : (
            <button
              title="Unpublish"
              onClick={e => { e.stopPropagation(); onQuickPublish(event, false); }}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 transition-colors"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            title="Delete"
            onClick={e => { e.stopPropagation(); onQuickDelete(event); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Event Card (grid view) ────────────────────────────────────────────────────
function EventCard({
  event, selected, onClick, onQuickPublish, onQuickDelete,
}: {
  event: AdminEvent;
  selected: boolean;
  onClick: () => void;
  onQuickPublish: (e: AdminEvent, publish: boolean) => void;
  onQuickDelete: (e: AdminEvent) => void;
}) {
  const eventDate = new Date(event.date);
  const isPast = eventDate < new Date();

  return (
    <div
      onClick={onClick}
      className={`
        group relative flex flex-col rounded-2xl border overflow-hidden cursor-pointer transition-all
        ${selected ? "ring-2 ring-primary border-primary/30 shadow-lg" : "border-border bg-card hover:shadow-md hover:border-primary/20"}
      `}
    >
      {/* Cover */}
      <div className="aspect-video bg-muted overflow-hidden relative">
        {event.imageUrl ? (
          <img src={event.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-muted-foreground/20">📍</div>
        )}
        {/* Status pill overlay */}
        <div className="absolute top-2 left-2">{statusBadge(event)}</div>
        {/* Scraped indicator */}
        {event.sourceUrl && (
          <div className="absolute top-2 right-2 bg-amber-500/90 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Scraped
          </div>
        )}
        {/* Quick actions overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          {!event.published ? (
            <button
              title="Publish"
              onClick={e => { e.stopPropagation(); onQuickPublish(event, true); }}
              className="bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-700 transition-colors shadow-lg"
            >
              <Check className="w-3.5 h-3.5" /> Publish
            </button>
          ) : (
            <button
              title="Unpublish"
              onClick={e => { e.stopPropagation(); onQuickPublish(event, false); }}
              className="bg-amber-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-amber-600 transition-colors shadow-lg"
            >
              <EyeOff className="w-3.5 h-3.5" /> Unpublish
            </button>
          )}
          <button
            title="Delete"
            onClick={e => { e.stopPropagation(); onQuickDelete(event); }}
            className="bg-destructive text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-destructive/80 transition-colors shadow-lg"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 space-y-2">
        <p className={`font-semibold text-sm leading-snug line-clamp-2 ${isPast && !event.published ? "text-muted-foreground" : ""}`}>
          {event.title}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {format(eventDate, "d MMM")}
            {isPast && <span className="text-destructive/60 ml-1">past</span>}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {event.locationName || event.venueCity}
          </span>
        </div>
        <Badge variant="outline" className="text-xs capitalize">
          {CATEGORY_MAP[event.category] ?? event.category}
        </Badge>
      </div>
    </div>
  );
}

// ── Bulk action bar ───────────────────────────────────────────────────────────
function BulkBar({
  selectedIds, total, onPublishAll, onClearSelection,
}: {
  selectedIds: Set<number>;
  total: number;
  onPublishAll: () => void;
  onClearSelection: () => void;
}) {
  const count = selectedIds.size;
  if (count === 0) return null;
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-background border border-border rounded-2xl shadow-2xl px-5 py-3"
    >
      <span className="text-sm font-semibold">{count} selected</span>
      <Button
        size="sm"
        onClick={onPublishAll}
        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
      >
        <CheckCircle2 className="w-4 h-4" /> Publish All
      </Button>
      <button onClick={onClearSelection} className="text-muted-foreground hover:text-foreground transition-colors ml-1">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
type ViewMode   = "list" | "grid";
type FilterMode = "all" | "draft" | "published" | "scraped" | "past";
type SortMode   = "date_asc" | "date_desc" | "created_desc" | "title_asc";

export default function AdminEventReview() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Guard
  if (user && (user as any).role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <ShieldAlert className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">Admin Only</h2>
          <p className="text-muted-foreground text-sm">You don't have permission to view this page.</p>
          <Link href="/dashboard"><Button variant="outline">Back to Dashboard</Button></Link>
        </div>
      </div>
    );
  }

  // State
  const [search,       setSearch]       = useState("");
  const [filter,       setFilter]       = useState<FilterMode>("all");
  const [sort,         setSort]         = useState<SortMode>("created_desc");
  const [viewMode,     setViewMode]     = useState<ViewMode>("list");
  const [selectedEvent, setSelectedEvent] = useState<AdminEvent | null>(null);
  const [editingEvent,  setEditingEvent]  = useState<AdminEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<AdminEvent | null>(null);
  const [bulkSelected,  setBulkSelected]  = useState<Set<number>>(new Set());
  const [bulkMode,      setBulkMode]      = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Fetch
  const { data: allEvents = [], refetch, isFetching } = useQuery<AdminEvent[]>({
    queryKey: ["/api/admin/events"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/events");
      return res.json();
    },
  });

  // Stats
  const stats = useMemo(() => ({
    total:     allEvents.length,
    drafts:    allEvents.filter(e => !e.published).length,
    published: allEvents.filter(e => e.published).length,
    scraped:   allEvents.filter(e => !!e.sourceUrl).length,
    past:      allEvents.filter(e => new Date(e.date) < new Date()).length,
  }), [allEvents]);

  // Filter + sort
  const filtered = useMemo(() => {
    let arr = [...allEvents];
    const q = search.toLowerCase();
    if (q) arr = arr.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.venueAddress.toLowerCase().includes(q) ||
      e.venueCity.toLowerCase().includes(q) ||
      (e.locationName?.toLowerCase().includes(q)) ||   // search location name too
      e.description.toLowerCase().includes(q)
    );
    if (filter === "draft")     arr = arr.filter(e => !e.published);
    if (filter === "published") arr = arr.filter(e => e.published);
    if (filter === "scraped")   arr = arr.filter(e => !!e.sourceUrl);
    if (filter === "past")      arr = arr.filter(e => new Date(e.date) < new Date());
    if (categoryFilter !== "all") arr = arr.filter(e => e.category === categoryFilter || e.category2 === categoryFilter);
    if (sort === "date_asc")      arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (sort === "date_desc")     arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (sort === "created_desc")  arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sort === "title_asc")     arr.sort((a, b) => a.title.localeCompare(b.title));
    return arr;
  }, [allEvents, search, filter, sort, categoryFilter]);

  // Actions
  const setPublished = async (event: AdminEvent, publish: boolean) => {
    try {
      await apiRequest("PATCH", `/api/admin/events/${event.id}`, { published: publish });
      toast({
        title: publish ? "Published ✓" : "Unpublished",
        description: `"${event.title}"`,
      });
      refetch();
      // Update selected panel if it's the same event
      if (selectedEvent?.id === event.id) {
        setSelectedEvent({ ...selectedEvent, published: publish });
      }
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deletingEvent) return;
    try {
      await apiRequest("DELETE", `/api/admin/events/${deletingEvent.id}`);
      toast({ title: "Deleted", description: `"${deletingEvent.title}" removed.` });
      refetch();
      if (selectedEvent?.id === deletingEvent.id) setSelectedEvent(null);
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally { setDeletingEvent(null); }
  };

  const handleBulkPublish = async () => {
    const ids = Array.from(bulkSelected);
    let success = 0;
    for (const id of ids) {
      try {
        await apiRequest("PATCH", `/api/admin/events/${id}`, { published: true });
        success++;
      } catch {}
    }
    toast({ title: `Published ${success}/${ids.length} events` });
    setBulkSelected(new Set());
    setBulkMode(false);
    refetch();
  };

  const toggleBulk = (id: number) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleRowClick = (event: AdminEvent) => {
    if (bulkMode) { toggleBulk(event.id); return; }
    setSelectedEvent(prev => prev?.id === event.id ? null : event);
  };

  const panelOpen = !!selectedEvent && !bulkMode;

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link href="/dashboard">
            <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
              <ChevronLeft className="w-4 h-4" /> Dashboard
            </button>
          </Link>
          <div className="h-4 w-px bg-border" />
          <h1 className="font-bold text-sm flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary" /> Event Review
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className={`p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground ${isFetching ? "animate-spin" : ""}`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total",     value: stats.total,     color: "text-foreground",     bg: "bg-card" },
            { label: "Drafts",    value: stats.drafts,    color: "text-amber-600",      bg: "bg-amber-50 dark:bg-amber-950/30" },
            { label: "Published", value: stats.published, color: "text-emerald-600",    bg: "bg-emerald-50 dark:bg-emerald-950/30" },
            { label: "Scraped",   value: stats.scraped,   color: "text-violet-600",     bg: "bg-violet-50 dark:bg-violet-950/30" },
            { label: "Past",      value: stats.past,      color: "text-muted-foreground", bg: "bg-card" },
          ].map(s => (
            <button
              key={s.label}
              onClick={() => setFilter(s.label.toLowerCase() as FilterMode)}
              className={`${s.bg} rounded-2xl border border-border px-4 py-3 text-left transition-all hover:shadow-md ${filter === s.label.toLowerCase() ? "ring-2 ring-primary" : ""}`}
            >
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">{s.label}</p>
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-xl"
              placeholder="Search events…"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 h-10 rounded-xl">
              <Tag className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-zinc-900">
              <SelectItem value="all">All categories</SelectItem>
              {EVENT_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sort} onValueChange={v => setSort(v as SortMode)}>
            <SelectTrigger className="w-44 h-10 rounded-xl">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-zinc-900">
              <SelectItem value="created_desc">Newest first</SelectItem>
              <SelectItem value="date_asc">Date ↑</SelectItem>
              <SelectItem value="date_desc">Date ↓</SelectItem>
              <SelectItem value="title_asc">Title A–Z</SelectItem>
            </SelectContent>
          </Select>

          {/* View toggle */}
          <div className="flex items-center bg-muted rounded-xl p-1 gap-1">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Bulk mode toggle */}
          <Button
            variant={bulkMode ? "default" : "outline"}
            size="sm"
            onClick={() => { setBulkMode(!bulkMode); setBulkSelected(new Set()); setSelectedEvent(null); }}
            className="rounded-xl gap-1.5 h-10"
          >
            <Layers className="w-4 h-4" />
            {bulkMode ? "Exit Bulk" : "Bulk Select"}
          </Button>

          {/* Result count */}
          <span className="text-sm text-muted-foreground ml-auto hidden sm:block">
            {filtered.length} event{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Main content: list + detail panel */}
        <div className={`flex gap-6 ${panelOpen ? "items-start" : ""}`}>
          {/* Event list / grid */}
          <div className={`flex-1 min-w-0 transition-all ${panelOpen ? "max-w-[60%]" : ""}`}>
            {filtered.length === 0 ? (
              <div className="text-center py-24 text-muted-foreground">
                <p className="text-lg font-medium">No events found</p>
                <p className="text-sm mt-1">Try adjusting your filters</p>
              </div>
            ) : viewMode === "list" ? (
              <div className="space-y-2">
                {filtered.map(event => (
                  <div key={event.id} className="flex items-center gap-2">
                    {bulkMode && (
                      <button
                        onClick={() => toggleBulk(event.id)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${bulkSelected.has(event.id) ? "bg-primary border-primary text-white" : "border-border"}`}
                      >
                        {bulkSelected.has(event.id) && <Check className="w-3 h-3" />}
                      </button>
                    )}
                    <div className="flex-1">
                      <EventRow
                        event={event}
                        selected={selectedEvent?.id === event.id}
                        onClick={() => handleRowClick(event)}
                        onQuickPublish={setPublished}
                        onQuickDelete={setDeletingEvent}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(event => (
                  <div key={event.id} className="relative">
                    {bulkMode && (
                      <button
                        onClick={e => { e.stopPropagation(); toggleBulk(event.id); }}
                        className={`absolute top-2 left-2 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shadow ${bulkSelected.has(event.id) ? "bg-primary border-primary text-white" : "bg-background border-border"}`}
                      >
                        {bulkSelected.has(event.id) && <Check className="w-3 h-3" />}
                      </button>
                    )}
                    <EventCard
                      event={event}
                      selected={selectedEvent?.id === event.id}
                      onClick={() => handleRowClick(event)}
                      onQuickPublish={setPublished}
                      onQuickDelete={setDeletingEvent}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detail panel */}
          <AnimatePresence>
            {panelOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 380, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="shrink-0 bg-background border border-border rounded-3xl overflow-hidden shadow-xl sticky top-20 max-h-[calc(100vh-6rem)] flex flex-col"
                style={{ width: 380 }}
              >
                <EventDetailPanel
                  event={selectedEvent}
                  onClose={() => setSelectedEvent(null)}
                  onPublish={e => setPublished(e, true)}
                  onUnpublish={e => setPublished(e, false)}
                  onEdit={e => { setEditingEvent(e); }}
                  onDelete={setDeletingEvent}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Edit sheet */}
      <EditSheet
        event={editingEvent}
        open={!!editingEvent}
        onClose={() => setEditingEvent(null)}
        onSaved={() => { refetch(); setSelectedEvent(null); }}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deletingEvent} onOpenChange={v => { if (!v) setDeletingEvent(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deletingEvent?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the event, all its ticket types, and any orders. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk action bar */}
      <AnimatePresence>
        <BulkBar
          selectedIds={bulkSelected}
          total={filtered.length}
          onPublishAll={handleBulkPublish}
          onClearSelection={() => { setBulkSelected(new Set()); setBulkMode(false); }}
        />
      </AnimatePresence>
    </div>
  );
}
