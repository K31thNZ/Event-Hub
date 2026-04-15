import { useParams, Link } from "wouter";
import { useEvent } from "@/hooks/use-events";
import { useAuth } from "@/hooks/use-auth";
import { useCreateOrder } from "@/hooks/use-orders";
import { format } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, Ticket, AlertCircle, Check, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "https://auth.expatevents.org";

export default function EventDetails() {
  const { id } = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const { data: event, isLoading: eventLoading } = useEvent(Number(id));
  const createOrder = useCreateOrder();
  const { toast } = useToast();

  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [attendeeName, setAttendeeName] = useState("");
  const [attendeeEmail, setAttendeeEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (authLoading || eventLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-2xl font-display font-bold">Event not found</h2>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    );
  }

  const selectedTicket = event.ticketTypes.find(t => t.id === selectedTicketId);
  const totalPrice = selectedTicket ? selectedTicket.price * quantity : 0;

  const handlePurchase = async () => {
    if (!user) {
      window.location.href = `${AUTH_URL}/login?returnTo=${encodeURIComponent(window.location.href)}`;
      return;
    }
    if (!selectedTicketId) {
      toast({ title: "Select a ticket type", variant: "destructive" });
      return;
    }
    if (!attendeeName.trim() || !attendeeEmail.trim()) {
      toast({ title: "Please provide your name and email", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      await createOrder.mutateAsync({
        eventId: event.id,
        ticketTypeId: selectedTicketId,
        quantity,
        attendeeName: attendeeName.trim(),
        attendeeEmail: attendeeEmail.trim(),
      });
      toast({ title: "Order placed! Redirecting..." });
      // Redirect to orders page after short delay
      setTimeout(() => {
        window.location.href = "/dashboard?tab=tickets";
      }, 1500);
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEventFull = event.ticketTypes.every(t => t.quantity === 0);
  const isPrivateForGroup = event.isPrivate && !event.group?.currentUserRole;

  if (isPrivateForGroup) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Lock className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-2xl font-display font-bold">Private event</h2>
        <p className="text-muted-foreground">This event is only visible to members of the group.</p>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          {/* Hero image & title */}
          {event.imageUrl && (
            <div className="rounded-3xl overflow-hidden shadow-xl">
              <img src={event.imageUrl} alt={event.title} className="w-full h-80 object-cover" />
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-10">
            {/* Main content */}
            <div className="flex-1 space-y-6">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Badge variant="secondary" className="capitalize">{event.category}</Badge>
                  {event.category2 && <Badge variant="outline" className="capitalize">{event.category2}</Badge>}
                  {event.isPrivate && <Badge variant="secondary"><Lock className="w-3 h-3 mr-1" /> Members only</Badge>}
                </div>
                <h1 className="text-4xl md:text-5xl font-display font-bold">{event.title}</h1>
              </div>

              <div className="space-y-4 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <span>{format(new Date(event.date), "EEEE, MMMM d, yyyy • h:mm a")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  <span>{event.venueAddress}, {event.venueCity}</span>
                  {event.yandexMapLink && (
                    <a href={event.yandexMapLink} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm">Open map</a>
                  )}
                </div>
                {event.group && (
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    <Link href={`/groups/${event.group.slug}`} className="text-primary hover:underline">Hosted by {event.group.name}</Link>
                  </div>
                )}
              </div>

              <div className="prose dark:prose-invert max-w-none">
                <p className="whitespace-pre-wrap">{event.description}</p>
              </div>
            </div>

            {/* Ticket purchase sidebar */}
            <div className="lg:w-96">
              <Card className="rounded-3xl shadow-lg sticky top-24">
                <CardContent className="p-6 space-y-5">
                  <h2 className="text-2xl font-display font-bold">Tickets</h2>

                  {isEventFull ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Ticket className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>Sold out</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {event.ticketTypes.map(ticket => (
                          <label
                            key={ticket.id}
                            className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                              selectedTicketId === ticket.id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="radio"
                                name="ticketType"
                                value={ticket.id}
                                checked={selectedTicketId === ticket.id}
                                onChange={() => setSelectedTicketId(ticket.id)}
                                className="text-primary"
                              />
                              <div>
                                <p className="font-semibold">{ticket.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {ticket.price === 0 ? "Free" : `${ticket.price} ₽`}
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline">{ticket.quantity} left</Badge>
                          </label>
                        ))}
                      </div>

                      {selectedTicket && (
                        <div className="space-y-4 pt-2">
                          <div>
                            <label className="text-sm font-medium">Quantity</label>
                            <input
                              type="number"
                              min={1}
                              max={Math.min(selectedTicket.quantity, selectedTicket.maxPerOrder)}
                              value={quantity}
                              onChange={e => setQuantity(Math.min(selectedTicket.maxPerOrder, Math.max(1, parseInt(e.target.value) || 1)))}
                              className="w-full mt-1 px-3 py-2 border rounded-lg"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Max {selectedTicket.maxPerOrder} per order</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Your name</label>
                            <input
                              type="text"
                              value={attendeeName}
                              onChange={e => setAttendeeName(e.target.value)}
                              className="w-full mt-1 px-3 py-2 border rounded-lg"
                              placeholder="Full name"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Email</label>
                            <input
                              type="email"
                              value={attendeeEmail}
                              onChange={e => setAttendeeEmail(e.target.value)}
                              className="w-full mt-1 px-3 py-2 border rounded-lg"
                              placeholder="your@email.com"
                            />
                          </div>
                          <div className="pt-4 border-t">
                            <div className="flex justify-between font-semibold mb-4">
                              <span>Total</span>
                              <span>{totalPrice} ₽</span>
                            </div>
                            <Button
                              onClick={handlePurchase}
                              disabled={isSubmitting || createOrder.isPending}
                              className="w-full rounded-xl"
                            >
                              {isSubmitting ? "Processing..." : "Get Tickets"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
