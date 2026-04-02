import { useState } from "react";
import { useMyEvents, useUpdateEvent, useDeleteEvent, useEvents } from "@/hooks/use-events";
import { useMyOrders } from "@/hooks/use-orders";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { EVENT_CATEGORIES, EVENT_CATEGORY_VALUES } from "@shared/categories";
import { type EventWithTickets } from "@shared/schema";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Ticket, CalendarDays, PlusCircle, Pencil, Trash2, Plus, Eye, EyeOff, ShieldCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Edit form schema ────────────────────────────────────────────────────────
const editEventSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description is too short"),
  category: z.enum(EVENT_CATEGORY_VALUES as [string, ...string[]]),
  date: z.string().min(1, "Date is required"),
  venueAddress: z.string().min(3, "Address is required"),
  venueCity: z.string().min(2, "City is required"),
  imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  published: z.boolean(),
  ticketTypes: z.array(z.object({
    name: z.string().min(1, "Name required"),
    price: z.coerce.number().min(0),
    quantity: z.coerce.number().min(1),
    maxPerOrder: z.coerce.number().min(1),
  })).min(1, "At least one ticket type required"),
});

type EditFormValues = z.infer<typeof editEventSchema>;

// ── Edit Sheet ─────────────────────────────────────────────────────────────
function EditEventSheet({
  event,
  open,
  onClose,
}: {
  event: EventWithTickets | null;
  open: boolean;
  onClose: () => void;
}) {
  const updateEvent = useUpdateEvent();
  const { toast } = useToast();

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editEventSchema),
    values: event ? {
      title: event.title,
      description: event.description,
      category: event.category,
      date: format(new Date(event.date), "yyyy-MM-dd'T'HH:mm"),
      venueAddress: event.venueAddress,
      venueCity: event.venueCity,
      imageUrl: event.imageUrl ?? "",
      published: event.published,
      ticketTypes: event.ticketTypes.map(t => ({
        name: t.name,
        price: t.price,
        quantity: t.quantity,
        maxPerOrder: t.maxPerOrder,
      })),
    } : undefined,
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "ticketTypes" });

  const onSubmit = async (data: EditFormValues) => {
    if (!event) return;
    try {
      await updateEvent.mutateAsync({ id: event.id, data });
      toast({ title: "Event updated", description: `"${data.title}" has been saved.` });
      onClose();
    } catch (err: any) {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl font-display">Edit Event</SheetTitle>
          <SheetDescription>Make changes and save to update the event.</SheetDescription>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input {...form.register("title")} className="h-11 rounded-xl" />
            {form.formState.errors.title && <p className="text-destructive text-xs">{form.formState.errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea {...form.register("description")} className="rounded-xl min-h-[100px]" />
            {form.formState.errors.description && <p className="text-destructive text-xs">{form.formState.errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Controller control={form.control} name="category" render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800">
                    {EVENT_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1.5">
              <Label>Date & Time</Label>
              <Input {...form.register("date")} type="datetime-local" className="h-11 rounded-xl" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Venue Address</Label>
              <Input {...form.register("venueAddress")} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input {...form.register("venueCity")} className="h-11 rounded-xl" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Cover Image URL</Label>
            <Input {...form.register("imageUrl")} className="h-11 rounded-xl" placeholder="https://…" />
          </div>

          <div className="space-y-1.5">
            <Label>Visibility</Label>
            <Controller control={form.control} name="published" render={({ field }) => (
              <div className="flex gap-2">
                <Button type="button" variant={field.value ? "default" : "outline"} size="sm"
                  onClick={() => field.onChange(true)} className="rounded-full gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Published
                </Button>
                <Button type="button" variant={!field.value ? "default" : "outline"} size="sm"
                  onClick={() => field.onChange(false)} className="rounded-full gap-1.5">
                  <EyeOff className="w-3.5 h-3.5" /> Draft
                </Button>
              </div>
            )} />
          </div>

          {/* Ticket types */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label>Ticket Types</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ name: "", price: 0, quantity: 50, maxPerOrder: 4 })}
                className="rounded-full text-xs gap-1">
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
            {fields.map((field, index) => (
              <div key={field.id} className="bg-muted/40 rounded-xl p-4 grid grid-cols-4 gap-3 items-end relative">
                {fields.length > 1 && (
                  <button type="button" onClick={() => remove(index)}
                    className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <div className="col-span-4 space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input {...form.register(`ticketTypes.${index}.name`)} className="h-9 rounded-lg" placeholder="General Admission" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Price (₽)</Label>
                  <Input type="number" {...form.register(`ticketTypes.${index}.price`)} className="h-9 rounded-lg" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quantity</Label>
                  <Input type="number" {...form.register(`ticketTypes.${index}.quantity`)} className="h-9 rounded-lg" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Max per order</Label>
                  <Input type="number" {...form.register(`ticketTypes.${index}.maxPerOrder`)} className="h-9 rounded-lg" />
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateEvent.isPending} className="flex-1 rounded-xl">
              {updateEvent.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ── Event row for management table ────────────────────────────────────────
function EventRow({
  event,
  onEdit,
  onDelete,
}: {
  event: EventWithTickets;
  onEdit: (e: EventWithTickets) => void;
  onDelete: (e: EventWithTickets) => void;
}) {
  return (
    <div data-testid={`row-event-${event.id}`}
      className="flex items-center gap-4 bg-card border border-border rounded-2xl px-5 py-4 hover:shadow-md transition-shadow">
      {event.imageUrl && (
        <img src={event.imageUrl} alt={event.title}
          className="hidden sm:block w-16 h-16 rounded-xl object-cover shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold truncate">{event.title}</h3>
          <Badge variant={event.published ? "default" : "secondary"} className="text-xs shrink-0">
            {event.published ? "Published" : "Draft"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          {format(new Date(event.date), "MMM d, yyyy • h:mm a")} · {event.venueCity}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {event.ticketTypes.length} ticket type{event.ticketTypes.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={() => onEdit(event)}
          data-testid={`button-edit-event-${event.id}`} className="rounded-lg gap-1.5">
          <Pencil className="w-3.5 h-3.5" /> Edit
        </Button>
        <Button variant="outline" size="sm" onClick={() => onDelete(event)}
          data-testid={`button-delete-event-${event.id}`}
          className="rounded-lg gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </Button>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const { data: myEvents, isLoading: loadingEvents } = useMyEvents();
  const { data: allEvents, isLoading: loadingAllEvents } = useEvents();
  const { data: myOrders, isLoading: loadingOrders } = useMyOrders();
  const deleteEvent = useDeleteEvent();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  const [editingEvent, setEditingEvent] = useState<EventWithTickets | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<EventWithTickets | null>(null);

  const handleDelete = async () => {
    if (!deletingEvent) return;
    try {
      await deleteEvent.mutateAsync(deletingEvent.id);
      toast({ title: "Event deleted", description: `"${deletingEvent.title}" has been removed.` });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeletingEvent(null);
    }
  };

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-display font-bold text-foreground mb-1">My Dashboard</h1>
            <p className="text-muted-foreground">Manage your tickets and hosted events.</p>
          </div>
          {isAdmin && (
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm rounded-full">
              <ShieldCheck className="w-4 h-4" /> Admin
            </Badge>
          )}
        </div>

        <Tabs defaultValue="tickets" className="w-full">
          <TabsList className="mb-8 p-1 bg-muted/50 rounded-xl flex flex-wrap gap-1 h-auto">
            <TabsTrigger value="tickets" className="rounded-lg px-5 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Ticket className="w-4 h-4 mr-2" /> My Tickets
            </TabsTrigger>
            <TabsTrigger value="events" className="rounded-lg px-5 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <CalendarDays className="w-4 h-4 mr-2" /> My Events
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admin" className="rounded-lg px-5 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <ShieldCheck className="w-4 h-4 mr-2" /> All Events
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── My Tickets ──────────────────────────────────────────────── */}
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myOrders?.map(order => (
                  <div key={order.id} data-testid={`card-order-${order.id}`}
                    className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div className="inline-flex px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-bold uppercase tracking-wider">Confirmed</div>
                      <span className="font-mono text-muted-foreground text-sm">#{order.id}</span>
                    </div>
                    <h3 className="font-display font-bold text-xl mb-1 line-clamp-1">{order.event.title}</h3>
                    <p className="text-muted-foreground text-sm mb-6">{format(new Date(order.event.date), "MMM d, yyyy • h:mm a")}</p>
                    <div className="mt-auto pt-4 border-t border-border flex justify-between items-center">
                      <span className="font-bold">{order.totalAmount} ₽</span>
                      <Button asChild variant="secondary" size="sm" className="rounded-lg">
                        <Link href={`/orders/${order.id}`}>View Ticket</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── My Events (hosting) ──────────────────────────────────────── */}
          <TabsContent value="events">
            <div className="mb-5 flex justify-end">
              <Button asChild className="rounded-full shadow-lg shadow-primary/20">
                <Link href="/create-event"><PlusCircle className="w-4 h-4 mr-2" /> Host New Event</Link>
              </Button>
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
              <div className="space-y-3">
                {myEvents?.map(event => (
                  <EventRow key={event.id} event={event}
                    onEdit={setEditingEvent} onDelete={setDeletingEvent} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Admin: All Events ───────────────────────────────────────── */}
          {isAdmin && (
            <TabsContent value="admin">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-muted-foreground text-sm">
                  {allEvents?.length ?? 0} event{allEvents?.length !== 1 ? "s" : ""} total
                </p>
                <Button asChild className="rounded-full shadow-lg shadow-primary/20">
                  <Link href="/create-event"><PlusCircle className="w-4 h-4 mr-2" /> Create Event</Link>
                </Button>
              </div>
              {loadingAllEvents ? (
                <div className="text-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" /></div>
              ) : allEvents?.length === 0 ? (
                <div className="text-center py-24 glass rounded-3xl border-dashed">
                  <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-bold mb-2">No events yet</h3>
                </div>
              ) : (
                <div className="space-y-3">
                  {allEvents?.map(event => (
                    <EventRow key={event.id} event={event}
                      onEdit={setEditingEvent} onDelete={setDeletingEvent} />
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* ── Edit Sheet ──────────────────────────────────────────────────── */}
      <EditEventSheet
        event={editingEvent}
        open={!!editingEvent}
        onClose={() => setEditingEvent(null)}
      />

      {/* ── Delete Confirmation ─────────────────────────────────────────── */}
      <AlertDialog open={!!deletingEvent} onOpenChange={v => { if (!v) setDeletingEvent(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deletingEvent?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the event and all its ticket types. Orders placed by attendees will not be refunded automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteEvent.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteEvent.isPending ? "Deleting…" : "Delete Event"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
