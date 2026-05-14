// client/src/pages/Dashboard.tsx
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMyEvents, useUpdateEvent, useDeleteEvent, useEvents } from "@/hooks/use-events";
import { MyGroupsTab } from "@/components/groups/MyGroupsTab";
import { useMyOrders } from "@/hooks/use-orders";
import { useAuth } from "@/hooks/use-auth";
import { Link, useSearch } from "wouter";
import { useForm, useFieldArray, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { EVENT_CATEGORIES, EVENT_CATEGORY_VALUES } from "@shared/categories";
import { type EventWithTickets } from "@shared/schema";
import { format, startOfWeek } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Ticket, CalendarDays, PlusCircle, Pencil, Trash2, Plus, Eye, EyeOff,
  ShieldCheck, Sparkles, UsersRound, KeyRound, Search, ChevronDown, Check,
  Archive, Users, CalendarCheck, LayoutGrid, RefreshCw, Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { useSparks } from "@/hooks/use-sparks";
import type { Spark } from "@/hooks/use-sparks";

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "https://auth.expatevents.org";

const ROLES = ["free", "premium", "host", "curator", "admin"] as const;
type Role = typeof ROLES[number];

const ROLE_BADGE: Record<Role, { label: string; className: string }> = {
  free:    { label: "Free",    className: "bg-gray-100   text-gray-700   dark:bg-gray-800    dark:text-gray-300" },
  premium: { label: "Premium", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200" },
  host:    { label: "Host",    className: "bg-teal-100   text-teal-800   dark:bg-teal-900/40  dark:text-teal-200" },
  curator: { label: "Curator", className: "bg-amber-100  text-amber-800  dark:bg-amber-900/40 dark:text-amber-200" },
  admin:   { label: "Admin",   className: "bg-red-100    text-red-800    dark:bg-red-900/40   dark:text-red-200" },
};

// ── Edit event sheet ──────────────────────────────────────────────────────────

const editEventSchema = z.object({
  title:        z.string().min(3),
  description:  z.string().min(10),
  category:     z.enum(EVENT_CATEGORY_VALUES as [string, ...string[]]),
  category2:    z.string().optional().nullable(),
  date:         z.string().min(1),
  venueAddress: z.string().min(3),
  venueCity:    z.string().min(2),
  imageUrl:     z.string().url().optional().or(z.literal("")),
  published:    z.boolean(),
  ticketTypes:  z.array(z.object({
    name: z.string().min(1), price: z.coerce.number().min(0),
    quantity: z.coerce.number().min(1), maxPerOrder: z.coerce.number().min(1),
  })).min(1),
});
type EditFormValues = z.infer<typeof editEventSchema>;

function EditEventSheet({ event, open, onClose, adminMode = false }: {
  event: EventWithTickets | null; open: boolean; onClose: () => void; adminMode?: boolean;
}) {
  const updateEvent = useUpdateEvent();
  const { toast } = useToast();
  const form = useForm<EditFormValues>({
    resolver: zodResolver(editEventSchema),
    values: event ? {
      title: event.title, description: event.description, category: event.category,
      category2: event.category2 ?? null,
      date: format(new Date(event.date), "yyyy-MM-dd'T'HH:mm"),
      venueAddress: event.venueAddress, venueCity: event.venueCity,
      imageUrl: event.imageUrl ?? "", published: event.published,
      ticketTypes: event.ticketTypes.map(t => ({
        name: t.name, price: t.price, quantity: t.quantity, maxPerOrder: t.maxPerOrder,
      })),
    } : undefined,
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "ticketTypes" });
  const watchedCategory = useWatch({ control: form.control, name: "category" });

  const onSubmit = async (data: EditFormValues) => {
    if (!event) return;
    try {
      if (adminMode) {
        await apiRequest("PATCH", `/api/admin/events/${event.id}`, data);
        qc.invalidateQueries({ queryKey: ["/api/events"] });
      } else {
        await updateEvent.mutateAsync({ id: event.id, data });
      }
      toast({ title: "Event updated" });
      onClose();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl font-display">{adminMode ? "Edit Event (Admin)" : "Edit Event"}</SheetTitle>
          <SheetDescription>Make changes and save to update the event.</SheetDescription>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5"><Label>Title</Label><Input {...form.register("title")} className="h-11 rounded-xl" /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea {...form.register("description")} className="rounded-xl min-h-[100px]" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Controller control={form.control} name="category" render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-900">
                    {EVENT_CATEGORIES.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1.5"><Label>Date & Time</Label><Input {...form.register("date")} type="datetime-local" className="h-11 rounded-xl" /></div>
          </div>
          {watchedCategory && (
            <div className="space-y-1.5">
              <Label>Second Category <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Controller control={form.control} name="category2" render={({ field }) => (
                <Select onValueChange={v => field.onChange(v === "__none__" ? null : v)} value={field.value ?? "__none__"}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-900">
                    <SelectItem value="__none__">— None —</SelectItem>
                    {EVENT_CATEGORIES.filter(c => c.value !== watchedCategory).map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Venue Address</Label><Input {...form.register("venueAddress")} className="h-11 rounded-xl" /></div>
            <div className="space-y-1.5"><Label>City</Label><Input {...form.register("venueCity")} className="h-11 rounded-xl" /></div>
          </div>
          <div className="space-y-1.5"><Label>Cover Image URL</Label><Input {...form.register("imageUrl")} className="h-11 rounded-xl" placeholder="https://…" /></div>
          <div className="space-y-1.5">
            <Label>Visibility</Label>
            <Controller control={form.control} name="published" render={({ field }) => (
              <div className="flex gap-2">
                <Button type="button" variant={field.value ? "default" : "outline"} size="sm" onClick={() => field.onChange(true)} className="rounded-full gap-1.5"><Eye className="w-3.5 h-3.5" /> Published</Button>
                <Button type="button" variant={!field.value ? "default" : "outline"} size="sm" onClick={() => field.onChange(false)} className="rounded-full gap-1.5"><EyeOff className="w-3.5 h-3.5" /> Draft</Button>
              </div>
            )} />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label>Ticket Types</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ name: "", price: 0, quantity: 50, maxPerOrder: 4 })} className="rounded-full text-xs gap-1">
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
            {fields.map((field, idx) => (
              <div key={field.id} className="bg-muted/40 rounded-xl p-4 grid grid-cols-4 gap-3 items-end relative">
                {fields.length > 1 && (
                  <button type="button" onClick={() => remove(idx)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <div className="col-span-4 space-y-1"><Label className="text-xs">Name</Label><Input {...form.register(`ticketTypes.${idx}.name`)} className="h-9 rounded-lg" /></div>
                <div className="space-y-1"><Label className="text-xs">Price (₽)</Label><Input type="number" {...form.register(`ticketTypes.${idx}.price`)} className="h-9 rounded-lg" /></div>
                <div className="space-y-1"><Label className="text-xs">Quantity</Label><Input type="number" {...form.register(`ticketTypes.${idx}.quantity`)} className="h-9 rounded-lg" /></div>
                <div className="col-span-2 space-y-1"><Label className="text-xs">Max per order</Label><Input type="number" {...form.register(`ticketTypes.${idx}.maxPerOrder`)} className="h-9 rounded-lg" /></div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={updateEvent.isPending} className="flex-1 rounded-xl">
              {updateEvent.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ── Event row ─────────────────────────────────────────────────────────────────

function EventRow({ event, onEdit, onDelete }: { event: EventWithTickets; onEdit: (e: EventWithTickets) => void; onDelete: (e: EventWithTickets) => void }) {
  return (
    <div className="flex items-center gap-4 bg-card border border-border rounded-2xl px-5 py-4 hover:shadow-md transition-shadow">
      {event.imageUrl && <img src={event.imageUrl} alt={event.title} className="hidden sm:block w-16 h-16 rounded-xl object-cover shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold truncate">{event.title}</h3>
          <Badge variant={event.published ? "default" : "secondary"} className="text-xs shrink-0">{event.published ? "Published" : "Draft"}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{format(new Date(event.date), "MMM d, yyyy · h:mm a")} · {event.venueCity}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={() => onEdit(event)} className="rounded-lg gap-1.5"><Pencil className="w-3.5 h-3.5" /> Edit</Button>
        <Button variant="outline" size="sm" onClick={() => onDelete(event)} className="rounded-lg gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5" /> Delete</Button>
      </div>
    </div>
  );
}

// ── Curator tab ───────────────────────────────────────────────────────────────

function CuratorTab() {
  const { toast } = useToast();
  const { data: events } = useEvents();
  const { data: myPicks, refetch } = useQuery({
    queryKey: ["/api/curator/picks"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/curator/picks"); return res.json(); },
  });

  const [editingPick, setEditingPick] = useState<any | null>(null);
  const [intro, setIntro]             = useState("");
  const [specialty, setSpecialty]     = useState("");
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);
  const [weekOf, setWeekOf] = useState(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [eventSearch, setEventSearch] = useState("");

  const isEditing = !!editingPick;

  useEffect(() => {
    if (editingPick) {
      setIntro(editingPick.intro ?? "");
      setSpecialty(editingPick.curatorSpecialty ?? "");
      setSelectedEventIds(editingPick.eventIds ?? []);
      setWeekOf(format(new Date(editingPick.weekOf), "yyyy-MM-dd"));
    }
  }, [editingPick]);

  const resetForm = () => {
    setEditingPick(null); setIntro(""); setSpecialty(""); setSelectedEventIds([]);
    setWeekOf(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  };

  const savePick = async (publish = false) => {
    if (!intro.trim()) { toast({ title: "Intro is required", variant: "destructive" }); return; }
    if (selectedEventIds.length === 0) { toast({ title: "Select at least one event", variant: "destructive" }); return; }
    try {
      const body = { intro, curatorSpecialty: specialty || "Events", eventIds: selectedEventIds, weekOf, published: publish };
      if (isEditing) {
        await apiRequest("PATCH", `/api/curator/picks/${editingPick.id}`, body);
      } else {
        await apiRequest("POST", "/api/curator/picks", body);
      }
      toast({ title: publish ? "Published!" : "Saved as draft" });
      resetForm();
      refetch();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const deletePick = async (id: number) => {
    await apiRequest("DELETE", `/api/curator/picks/${id}`);
    refetch();
  };

  const toggleEvent = (id: number) =>
    setSelectedEventIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 6 ? [...prev, id] : prev);

  const filteredEvents = events?.filter(e =>
    e.title.toLowerCase().includes(eventSearch.toLowerCase()) ||
    e.venueCity.toLowerCase().includes(eventSearch.toLowerCase())
  ) ?? [];

  return (
    <div className="space-y-8">
      <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <h3 className="font-display font-bold text-lg">{isEditing ? "Edit picks edition" : "New picks edition"}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Week of</Label>
            <Input type="date" value={weekOf} onChange={e => setWeekOf(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Your specialty</Label>
            <Input value={specialty} onChange={e => setSpecialty(e.target.value)} className="h-11 rounded-xl" placeholder="e.g. Networking, Tech, Culture…" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Your intro <span className="text-muted-foreground text-xs font-normal">(max 300 chars)</span></Label>
          <Textarea value={intro} onChange={e => setIntro(e.target.value.slice(0, 300))} className="rounded-xl resize-none" rows={3} placeholder="Tell readers why you picked these events this week…" />
          <p className="text-xs text-muted-foreground text-right">{intro.length}/300</p>
        </div>
        <div className="space-y-2">
          <Label>Pick events <span className="text-muted-foreground text-xs font-normal">({selectedEventIds.length}/6 selected)</span></Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input value={eventSearch} onChange={e => setEventSearch(e.target.value)} className="pl-9 h-10 rounded-xl" placeholder="Search events…" />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1.5 rounded-xl border border-border p-2">
            {filteredEvents.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No events found</p>}
            {filteredEvents.map(event => {
              const selected = selectedEventIds.includes(event.id);
              return (
                <button key={event.id} type="button" onClick={() => toggleEvent(event.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${selected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"}`}>
                  {event.imageUrl && <img src={event.imageUrl} className="w-10 h-10 rounded-lg object-cover shrink-0" alt="" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(event.date), "MMM d")} · {event.venueCity}</p>
                  </div>
                  {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-3">
          {isEditing && <Button variant="outline" className="rounded-xl" onClick={resetForm}>Cancel</Button>}
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => savePick(false)}>Save draft</Button>
          <Button className="flex-1 rounded-xl" onClick={() => savePick(true)}>
            <Sparkles className="w-4 h-4 mr-2" /> Publish
          </Button>
        </div>
      </div>

      {myPicks?.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">My editions</h3>
          {myPicks.map((pick: any) => (
            <div key={pick.id} className="flex items-center gap-4 bg-card border border-border rounded-2xl px-5 py-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">Week of {format(new Date(pick.weekOf), "MMM d, yyyy")}</p>
                  <Badge variant={pick.published ? "default" : "secondary"} className="text-xs">{pick.published ? "Published" : "Draft"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{pick.eventIds.length} events · {pick.curatorSpecialty}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-lg gap-1.5" onClick={() => setEditingPick(pick)}><Pencil className="w-3.5 h-3.5" /> Edit</Button>
                <Button variant="outline" size="sm" className="rounded-lg gap-1.5 text-destructive border-destructive/30" onClick={() => deletePick(pick.id)}><Trash2 className="w-3.5 h-3.5" /> Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Change Password tab ───────────────────────────────────────────────────────

function ChangePasswordTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isOAuthOnly   = (user?.googleId || user?.yandexId) && !user?.email;
  const hasNoPassword = !user?.hasPassword;

  const changeSchema = z.object({
    currentPassword: z.string().min(1, "Current password required"),
    newPassword:     z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  }).refine(d => d.newPassword === d.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });

  const setSchema = z.object({
    newPassword:     z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  }).refine(d => d.newPassword === d.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(hasNoPassword ? setSchema : changeSchema),
  });

  const onSubmit = async (data: any) => {
    try {
      const endpoint = hasNoPassword ? "/api/auth/set-password" : "/api/auth/change-password";
      const body = hasNoPassword
        ? { newPassword: data.newPassword }
        : { currentPassword: data.currentPassword, newPassword: data.newPassword };
      const res = await fetch(`${AUTH_URL}${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Failed"); }
      toast({ title: hasNoPassword ? "Password set successfully!" : "Password updated successfully" });
      reset();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isOAuthOnly) {
    return (
      <div className="text-center py-16 space-y-3">
        <KeyRound className="w-10 h-10 mx-auto text-muted-foreground opacity-50" />
        <p className="font-medium">Password not available</p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Your account uses Google or Yandex sign-in without an email address.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm space-y-5">
      {hasNoPassword && (
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Set a password</p>
          You signed in with a magic code or social login. You can optionally add a password.
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {!hasNoPassword && (
          <div className="space-y-1.5">
            <Label>Current password</Label>
            <Input {...register("currentPassword")} type="password" className="h-11 rounded-xl" autoComplete="current-password" />
            {errors.currentPassword && <p className="text-destructive text-xs">{errors.currentPassword.message as string}</p>}
          </div>
        )}
        <div className="space-y-1.5">
          <Label>New password</Label>
          <Input {...register("newPassword")} type="password" className="h-11 rounded-xl" autoComplete="new-password" />
          {errors.newPassword && <p className="text-destructive text-xs">{errors.newPassword.message as string}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Confirm new password</Label>
          <Input {...register("confirmPassword")} type="password" className="h-11 rounded-xl" autoComplete="new-password" />
          {errors.confirmPassword && <p className="text-destructive text-xs">{errors.confirmPassword.message as string}</p>}
        </div>
        <Button type="submit" disabled={isSubmitting} className="w-full rounded-xl">
          <KeyRound className="w-4 h-4 mr-2" />
          {isSubmitting ? (hasNoPassword ? "Setting…" : "Updating…") : (hasNoPassword ? "Set password" : "Update password")}
        </Button>
      </form>
    </div>
  );
}

// ── Admin Panel (updated with Sparks) ─────────────────────────────────────────

function AdminPanel() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<"users" | "events" | "groups" | "sparks">("users");
  const [search, setSearch] = useState("");

  const { data: usersData, refetch: refetchUsers } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/admin/users"); return res.json(); },
    enabled: activeSection === "users",
  });

  const updateRole = async (userId: number | string, role: Role) => {
    try {
      await apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
      toast({ title: "Role updated" });
      refetchUsers();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const { data: allEvents, refetch: refetchEvents } = useQuery({
    queryKey: ["/api/events"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/events"); return res.json(); },
    enabled: activeSection === "events",
  });
  const [editingEvent,  setEditingEvent]  = useState<EventWithTickets | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<EventWithTickets | null>(null);

  const handleDeleteEvent = async () => {
    if (!deletingEvent) return;
    try {
      await apiRequest("DELETE", `/api/admin/events/${deletingEvent.id}`);
      toast({ title: "Event deleted", description: `"${deletingEvent.title}" has been removed.` });
      refetchEvents();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally { setDeletingEvent(null); }
  };

  const { data: allGroups, refetch: refetchGroups } = useQuery({
    queryKey: ["/api/groups"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/groups"); return res.json(); },
    enabled: activeSection === "groups",
  });
  const [editingGroup,  setEditingGroup]  = useState<any | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<any | null>(null);
  const [groupEditName, setGroupEditName] = useState("");
  const [groupEditDesc, setGroupEditDesc] = useState("");

  const handleSaveGroup = async () => {
    if (!editingGroup) return;
    try {
      await apiRequest("PATCH", `/api/admin/groups/${editingGroup.id}`, { name: groupEditName, description: groupEditDesc });
      toast({ title: "Group updated" });
      setEditingGroup(null);
      refetchGroups();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteGroup = async () => {
    if (!deletingGroup) return;
    try {
      await apiRequest("DELETE", `/api/admin/groups/${deletingGroup.id}`);
      toast({ title: "Group deleted", description: `"${deletingGroup.name}" has been removed.` });
      refetchGroups();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally { setDeletingGroup(null); }
  };

  // ── Sparks admin ──────────────────────────────────────────────────────────
  const { data: adminSparks, refetch: refetchSparks } = useQuery<Spark[]>({
    queryKey: ["/api/admin/sparks"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/admin/sparks"); return res.json(); },
    enabled: activeSection === "sparks",
  });
  const [editingSpark,  setEditingSpark]  = useState<Spark | null>(null);
  const [deletingSpark, setDeletingSpark] = useState<Spark | null>(null);

  const handleDeleteSpark = async () => {
    if (!deletingSpark) return;
    try {
      await apiRequest("DELETE", `/api/admin/sparks/${deletingSpark.id}`);
      toast({ title: "Spark deleted", description: `"${deletingSpark.title}" removed.` });
      refetchSparks();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally { setDeletingSpark(null); }
  };

  const q = search.toLowerCase();
  const filteredUsers  = (usersData  ?? []).filter((u: any) => u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.displayName?.toLowerCase().includes(q));
  const filteredEvents = (allEvents  ?? []).filter((e: any) => e.title?.toLowerCase().includes(q) || e.venueCity?.toLowerCase().includes(q));
  const filteredGroups = (allGroups  ?? []).filter((g: any) => g.name?.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q));
  const filteredSparks = (adminSparks ?? []).filter((s: Spark) => s.title?.toLowerCase().includes(q) || s.activity?.toLowerCase().includes(q) || s.location?.toLowerCase().includes(q));
  const sectionCounts  = {
    users: usersData?.length ?? "—",
    events: allEvents?.length ?? "—",
    groups: allGroups?.length ?? "—",
    sparks: adminSparks?.length ?? "—"
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        {(["users", "events", "groups", "sparks"] as const).map(section => {
          const Icon = {
            users: Users,
            events: CalendarCheck,
            groups: LayoutGrid,
            sparks: Zap,
          }[section];
          return (
            <button key={section} onClick={() => { setActiveSection(section); setSearch(""); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${activeSection === section ? "bg-primary text-primary-foreground border-primary shadow-sm" : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"}`}>
              <Icon className="w-4 h-4" />
              <span className="capitalize">{section}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeSection === section ? "bg-white/20" : "bg-muted"}`}>{sectionCounts[section]}</span>
            </button>
          );
        })}
        <button onClick={() => {
          if (activeSection === "users") refetchUsers();
          if (activeSection === "events") refetchEvents();
          if (activeSection === "groups") refetchGroups();
          if (activeSection === "sparks") refetchSparks();
        }}
          className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl" placeholder={`Search ${activeSection}…`} />
      </div>

      {activeSection === "users" && (
        <div className="space-y-2">
          {filteredUsers.length === 0 && <div className="text-center py-16 text-muted-foreground">No users found</div>}
          {filteredUsers.map((u: any) => {
            const badge = ROLE_BADGE[u.role as Role] ?? ROLE_BADGE.free;
            return (
              <div key={u.id} className="flex items-center gap-4 bg-card border border-border rounded-2xl px-5 py-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={u.avatarUrl ?? ""} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">{(u.displayName ?? u.username ?? "U").substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{u.displayName ?? u.username}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email} · ID {u.id}</p>
                </div>
                <Select value={u.role ?? "free"} onValueChange={v => updateRole(u.id, v as Role)}>
                  <SelectTrigger className={`w-32 h-8 rounded-full text-xs font-semibold border-0 ${badge.className}`}><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-900">
                    {ROLES.map(r => <SelectItem key={r} value={r} className="text-sm capitalize">{ROLE_BADGE[r].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      )}

      {activeSection === "events" && (
        <>
          <div className="space-y-2">
            {filteredEvents.length === 0 && <div className="text-center py-16 text-muted-foreground">No events found</div>}
            {filteredEvents.map((event: any) => <EventRow key={event.id} event={event} onEdit={setEditingEvent} onDelete={setDeletingEvent} />)}
          </div>
          <EditEventSheet event={editingEvent} open={!!editingEvent} onClose={() => setEditingEvent(null)} adminMode />
          <AlertDialog open={!!deletingEvent} onOpenChange={v => { if (!v) setDeletingEvent(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{deletingEvent?.title}"?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently remove the event and all its ticket types and orders.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteEvent} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Event</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {activeSection === "groups" && (
        <>
          <div className="space-y-2">
            {filteredGroups.length === 0 && <div className="text-center py-16 text-muted-foreground">No groups found</div>}
            {filteredGroups.map((group: any) => (
              <div key={group.id} className="flex items-center gap-4 bg-card border border-border rounded-2xl px-5 py-4 hover:shadow-md transition-shadow">
                {group.imageUrl && <img src={group.imageUrl} alt={group.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{group.name}</h3>
                    <Badge variant="secondary" className="text-xs shrink-0 capitalize">{group.category}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">{group.memberCount ?? 0} members · {group.slug}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" className="rounded-lg gap-1.5" onClick={() => { setEditingGroup(group); setGroupEditName(group.name); setGroupEditDesc(group.description ?? ""); }}>
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-lg gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setDeletingGroup(group)}>
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Sheet open={!!editingGroup} onOpenChange={v => { if (!v) setEditingGroup(null); }}>
            <SheetContent side="right" className="w-full sm:max-w-lg">
              <SheetHeader className="mb-6">
                <SheetTitle className="text-2xl font-display">Edit Group</SheetTitle>
                <SheetDescription>Update group name and description.</SheetDescription>
              </SheetHeader>
              <div className="space-y-5">
                <div className="space-y-1.5"><Label>Name</Label><Input value={groupEditName} onChange={e => setGroupEditName(e.target.value)} className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5"><Label>Description</Label><Textarea value={groupEditDesc} onChange={e => setGroupEditDesc(e.target.value)} className="rounded-xl min-h-[100px]" /></div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setEditingGroup(null)}>Cancel</Button>
                  <Button className="flex-1 rounded-xl" onClick={handleSaveGroup}>Save Changes</Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <AlertDialog open={!!deletingGroup} onOpenChange={v => { if (!v) setDeletingGroup(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{deletingGroup?.name}"?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently remove the group and all its memberships.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Group</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {/* ── Sparks Tab ─────────────────────────────────────────────────────── */}
      {activeSection === "sparks" && (
        <>
          <div className="space-y-2">
            {filteredSparks.length === 0 && <div className="text-center py-16 text-muted-foreground">No sparks found</div>}
            {filteredSparks.map((spark: Spark) => (
              <div key={spark.id} className="flex items-center gap-4 bg-card border border-border rounded-2xl px-5 py-4 hover:shadow-md transition-shadow">
                <Zap className="w-8 h-8 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{spark.title}</h3>
                    <Badge variant="outline" className="text-xs capitalize">{spark.activity}</Badge>
                    <Badge variant="secondary" className="text-xs">{spark.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {spark.location} · {format(new Date(spark.meetTime), "MMM d, h:mm a")} · {spark.maxRespondents} max
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" className="rounded-lg gap-1.5" onClick={() => setEditingSpark(spark)}>
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-lg gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setDeletingSpark(spark)}>
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <SparkEditSheet spark={editingSpark} open={!!editingSpark} onClose={() => setEditingSpark(null)} />
          <AlertDialog open={!!deletingSpark} onOpenChange={v => { if (!v) setDeletingSpark(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{deletingSpark?.title}"?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently remove the spark and its responses.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteSpark} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Spark</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

// ── Spark Edit Sheet (Admin) ──────────────────────────────────────────────────

const editSparkSchema = z.object({
  title:          z.string().min(3),
  description:    z.string().max(500).optional(),
  activity:       z.string().min(1),
  location:       z.string().min(2),
  meetTime:       z.string().datetime(),
  maxRespondents: z.number().int().min(1).max(20),
  status:         z.enum(["pending", "active", "cancelled", "confirmed"]),
});
type EditSparkForm = z.infer<typeof editSparkSchema>;

function SparkEditSheet({ spark, open, onClose }: { spark: Spark | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm<EditSparkForm>({
    resolver: zodResolver(editSparkSchema),
    values: spark ? {
      title: spark.title,
      description: spark.description ?? "",
      activity: spark.activity,
      location: spark.location,
      meetTime: spark.meetTime,
      maxRespondents: spark.maxRespondents,
      status: spark.status,
    } : undefined,
  });

  const watchedActivity = form.watch("activity");

  const onSubmit = async (data: EditSparkForm) => {
    if (!spark) return;
    try {
      await apiRequest("PATCH", `/api/admin/sparks/${spark.id}`, data);
      toast({ title: "Spark updated" });
      qc.invalidateQueries({ queryKey: ["/api/admin/sparks"] });
      onClose();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl font-display">Edit Spark (Admin)</SheetTitle>
          <SheetDescription>Modify the spark details. Changes save immediately.</SheetDescription>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5"><Label>Title</Label><Input {...form.register("title")} className="h-11 rounded-xl" /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea {...form.register("description")} className="rounded-xl min-h-[80px]" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Activity</Label>
              <Controller control={form.control} name="activity" render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-900">
                    {EVENT_CATEGORIES.filter(c => ["social","food","outdoor","sports","culture","games","wellness","networking","language"].includes(c.value)).map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1.5"><Label>Max people</Label><Input type="number" {...form.register("maxRespondents", { valueAsNumber: true })} className="h-11 rounded-xl" /></div>
          </div>
          <div className="space-y-1.5"><Label>Location</Label><Input {...form.register("location")} className="h-11 rounded-xl" /></div>
          <div className="space-y-1.5"><Label>Meet Time</Label><Input {...form.register("meetTime")} type="datetime-local" className="h-11 rounded-xl" /></div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Controller control={form.control} name="status" render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-900">
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting} className="flex-1 rounded-xl">
              {form.formState.isSubmitting ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user }                             = useAuth();
  const { data: myEvents, isLoading: loadingEvents } = useMyEvents();
  const { data: myOrders, isLoading: loadingOrders } = useMyOrders();
  const deleteEvent                          = useDeleteEvent();
  const { toast }                            = useToast();
  const searchStr                            = useSearch();
  const params                               = new URLSearchParams(searchStr);
  const defaultTab                           = params.get("tab") ?? "tickets";

  const isAdmin   = user?.role === "admin";
  const isCurator = user?.role === "curator" || isAdmin;

  const [editingEvent,    setEditingEvent]    = useState<EventWithTickets | null>(null);
  const [deletingEvent,   setDeletingEvent]   = useState<EventWithTickets | null>(null);
  const [showPastTickets, setShowPastTickets] = useState(false);

  const handleDelete = async () => {
    if (!deletingEvent) return;
    try {
      await deleteEvent.mutateAsync(deletingEvent.id);
      toast({ title: "Event deleted", description: `"${deletingEvent.title}" has been removed.` });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally { setDeletingEvent(null); }
  };

  const now            = new Date();
  const upcomingOrders = myOrders?.filter(o => new Date(o.event.date) >= now) ?? [];
  const pastOrders     = myOrders?.filter(o => new Date(o.event.date) <  now) ?? [];

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-display font-bold text-foreground mb-1">My Dashboard</h1>
            <p className="text-muted-foreground">Manage your tickets, events, and account.</p>
          </div>
          {isAdmin && <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm rounded-full"><ShieldCheck className="w-4 h-4" /> Admin</Badge>}
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="mb-8 p-1 bg-muted/50 rounded-xl flex flex-wrap gap-1 h-auto">
            <TabsTrigger value="tickets"  className="rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"><Ticket       className="w-4 h-4 mr-2" /> My Tickets</TabsTrigger>
            <TabsTrigger value="events"   className="rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"><CalendarDays  className="w-4 h-4 mr-2" /> My Events</TabsTrigger>
            <TabsTrigger value="groups"   className="rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"><UsersRound    className="w-4 h-4 mr-2" /> My Groups</TabsTrigger>
            {isCurator && <TabsTrigger value="curator"  className="rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"><Sparkles     className="w-4 h-4 mr-2" /> Curator</TabsTrigger>}
            {isAdmin   && <TabsTrigger value="admin"    className="rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"><ShieldCheck  className="w-4 h-4 mr-2" /> Admin</TabsTrigger>}
            <TabsTrigger value="password" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"><KeyRound      className="w-4 h-4 mr-2" /> Password</TabsTrigger>
          </TabsList>

          <TabsContent value="tickets">
            {loadingOrders ? (
              <div className="text-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" /></div>
            ) : myOrders?.length === 0 ? (
              <div className="text-center py-24 glass rounded-3xl border-dashed">
                <Ticket className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold mb-2">No tickets yet</h3>
                <p className="text-muted-foreground mb-6">You haven't purchased any tickets.</p>
                <Button asChild variant="outline" className="rounded-full"><Link href="/">Browse Events</Link></Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {upcomingOrders.map(order => (
                    <div key={order.id} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                        <div className="inline-flex px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-bold uppercase tracking-wider">Confirmed</div>
                        <span className="font-mono text-muted-foreground text-sm">#{order.id}</span>
                      </div>
                      <h3 className="font-display font-bold text-xl mb-1 line-clamp-1">{order.event.title}</h3>
                      <p className="text-muted-foreground text-sm mb-6">{format(new Date(order.event.date), "MMM d, yyyy · h:mm a")}</p>
                      <div className="mt-auto pt-4 border-t border-border flex justify-between items-center">
                        <span className="font-bold">{order.totalAmount} ₽</span>
                        <Button asChild variant="secondary" size="sm" className="rounded-lg"><Link href={`/orders/${order.id}`}>View Ticket</Link></Button>
                      </div>
                    </div>
                  ))}
                </div>
                {pastOrders.length > 0 && (
                  <div className="pt-4 border-t border-border">
                    <button onClick={() => setShowPastTickets(v => !v)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors select-none">
                      <Archive className="w-4 h-4" /> Past tickets ({pastOrders.length})
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showPastTickets ? "rotate-180" : ""}`} />
                    </button>
                    {showPastTickets && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-5 opacity-70">
                        {pastOrders.map(order => (
                          <div key={order.id} className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                              <div className="inline-flex px-2 py-1 rounded bg-muted text-muted-foreground text-xs font-bold uppercase tracking-wider">Past</div>
                              <span className="font-mono text-muted-foreground text-sm">#{order.id}</span>
                            </div>
                            <h3 className="font-display font-bold text-xl mb-1 line-clamp-1 text-muted-foreground">{order.event.title}</h3>
                            <p className="text-muted-foreground text-sm mb-6">{format(new Date(order.event.date), "MMM d, yyyy · h:mm a")}</p>
                            <div className="mt-auto pt-4 border-t border-border flex justify-between items-center">
                              <span className="font-bold text-muted-foreground">{order.totalAmount} ₽</span>
                              <Button asChild variant="outline" size="sm" className="rounded-lg"><Link href={`/orders/${order.id}`}>View</Link></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="events">
            <div className="mb-5 flex justify-end">
              <Button asChild className="rounded-full shadow-lg shadow-primary/20"><Link href="/create-event"><PlusCircle className="w-4 h-4 mr-2" /> Host New Event</Link></Button>
            </div>
            {loadingEvents ? (
              <div className="text-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" /></div>
            ) : myEvents?.length === 0 ? (
              <div className="text-center py-24 glass rounded-3xl border-dashed">
                <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold mb-2">No hosted events</h3>
                <p className="text-muted-foreground mb-6">Create your first event to start gathering people.</p>
                <Button asChild className="rounded-full"><Link href="/create-event">Create Event</Link></Button>
              </div>
            ) : (
              <div className="space-y-3">{myEvents?.map(e => <EventRow key={e.id} event={e} onEdit={setEditingEvent} onDelete={setDeletingEvent} />)}</div>
            )}
          </TabsContent>

          <TabsContent value="groups"><MyGroupsTab /></TabsContent>
          {isCurator && <TabsContent value="curator"><CuratorTab /></TabsContent>}
          {isAdmin   && <TabsContent value="admin"><AdminPanel /></TabsContent>}
          <TabsContent value="password"><ChangePasswordTab /></TabsContent>
        </Tabs>
      </div>

      <EditEventSheet event={editingEvent} open={!!editingEvent} onClose={() => setEditingEvent(null)} />
      <AlertDialog open={!!deletingEvent} onOpenChange={v => { if (!v) setDeletingEvent(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deletingEvent?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the event and all its ticket types.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteEvent.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteEvent.isPending ? "Deleting…" : "Delete Event"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
