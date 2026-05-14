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

// ... (existing constants AUTH_URL, ROLES, ROLE_BADGE remain unchanged)

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

export default Dashboard;
