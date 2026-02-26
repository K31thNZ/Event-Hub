import { useParams, useLocation } from "wouter";
import { useEvent } from "@/hooks/use-events";
import { useCreateOrder } from "@/hooks/use-orders";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { Calendar, Clock, MapPin, Ticket, Plus, Minus, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";

const checkoutSchema = z.object({
  attendeeName: z.string().min(1, "Name is required"),
  attendeeEmail: z.string().email("Please enter a valid email"),
  notes: z.string().optional(),
});

export default function EventDetails() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { data: event, isLoading } = useEvent(Number(id));
  const { isAuthenticated } = useAuth();
  const createOrder = useCreateOrder();

  const [selectedTickets, setSelectedTickets] = useState<Record<number, number>>({});
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(checkoutSchema)
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!event) return <div className="text-center py-32"><h2 className="text-3xl font-display font-bold">Event not found</h2></div>;

  const fallbackImage = "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=2000&auto=format&fit=crop";

  const updateQuantity = (ticketId: number, delta: number, max: number) => {
    const current = selectedTickets[ticketId] || 0;
    const next = Math.max(0, Math.min(max, current + delta));
    setSelectedTickets(prev => ({ ...prev, [ticketId]: next }));
  };

  const totalAmount = Object.entries(selectedTickets).reduce((sum, [tId, qty]) => {
    const t = event.ticketTypes.find(x => x.id === Number(tId));
    return sum + ((t?.price || 0) * qty);
  }, 0);

  const totalQty = Object.values(selectedTickets).reduce((a, b) => a + b, 0);

  const onSubmitCheckout = async (data: any) => {
    const payload = {
      eventId: event.id,
      attendeeName: data.attendeeName,
      attendeeEmail: data.attendeeEmail,
      notes: data.notes,
      tickets: Object.entries(selectedTickets)
        .filter(([_, qty]) => qty > 0)
        .map(([tId, qty]) => ({ ticketTypeId: Number(tId), quantity: qty }))
    };

    try {
      const order = await createOrder.mutateAsync(payload);
      setIsCheckoutOpen(false);
      setLocation(`/orders/${order.id}`);
    } catch (e) {
      // Error handled by mutation
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Hero Banner */}
      <div className="w-full h-[40vh] md:h-[60vh] relative">
        <img 
          src={event.imageUrl || fallbackImage} 
          alt={event.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 relative z-10">
        <div className="flex flex-col lg:flex-row gap-12">
          
          {/* Main Content */}
          <div className="flex-1 space-y-10">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass p-8 md:p-12 rounded-3xl">
              <div className="inline-flex px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-sm tracking-wider uppercase mb-6">
                {event.category}
              </div>
              <h1 className="text-4xl md:text-6xl font-display font-bold text-foreground leading-tight mb-8">
                {event.title}
              </h1>
              
              <div className="flex flex-wrap gap-6 text-muted-foreground border-t border-b border-border py-6 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{format(new Date(event.date), 'EEEE, MMMM d, yyyy')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{format(new Date(event.date), 'h:mm a')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{event.venueAddress}</p>
                    <p className="text-sm">{event.venueCity}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-display font-bold mb-4">About this event</h3>
                <div className="prose prose-lg dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap">
                  {event.description}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Sidebar / Tickets */}
          <div className="w-full lg:w-[400px]">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="sticky top-28 bg-card border border-border shadow-2xl rounded-3xl p-6 md:p-8">
              <h3 className="text-2xl font-display font-bold mb-6 flex items-center gap-2">
                <Ticket className="w-6 h-6 text-primary" /> Select Tickets
              </h3>
              
              <div className="space-y-4 mb-8">
                {event.ticketTypes.map(ticket => {
                  const qty = selectedTickets[ticket.id] || 0;
                  return (
                    <div key={ticket.id} className="p-4 rounded-2xl border border-border bg-background flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-lg">{ticket.name}</p>
                          <p className="text-primary font-semibold">{ticket.price > 0 ? `${ticket.price} ₽` : 'Free'}</p>
                        </div>
                        <div className="flex items-center gap-3 bg-muted rounded-full p-1 border border-border/50">
                          <button 
                            className="w-8 h-8 rounded-full bg-background flex items-center justify-center shadow-sm hover:text-primary transition-colors disabled:opacity-50"
                            onClick={() => updateQuantity(ticket.id, -1, ticket.maxPerOrder)}
                            disabled={qty === 0}
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-4 text-center font-bold">{qty}</span>
                          <button 
                            className="w-8 h-8 rounded-full bg-background flex items-center justify-center shadow-sm hover:text-primary transition-colors disabled:opacity-50"
                            onClick={() => updateQuantity(ticket.id, 1, ticket.maxPerOrder)}
                            disabled={qty >= ticket.maxPerOrder}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground text-right">Max {ticket.maxPerOrder} per order</p>
                    </div>
                  );
                })}
              </div>

              <div className="pt-6 border-t border-dashed border-border mb-6">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-muted-foreground">Total ({totalQty} tickets)</span>
                  <span className="text-3xl font-bold">{totalAmount} ₽</span>
                </div>
              </div>

              {!isAuthenticated ? (
                <Button asChild className="w-full py-6 rounded-xl text-lg shadow-xl shadow-primary/20">
                  <a href="/api/login">Login to Purchase</a>
                </Button>
              ) : (
                <Button 
                  onClick={() => setIsCheckoutOpen(true)} 
                  disabled={totalQty === 0}
                  className="w-full py-6 rounded-xl text-lg shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all hover:-translate-y-0.5 group"
                >
                  Checkout <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      <Sheet open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto border-l-0 sm:rounded-l-3xl shadow-2xl">
          <SheetHeader className="mb-8">
            <SheetTitle className="font-display text-3xl">Secure Checkout</SheetTitle>
            <SheetDescription>Please provide your details to complete the order.</SheetDescription>
          </SheetHeader>
          
          <div className="bg-primary/5 rounded-2xl p-5 mb-8 border border-primary/10">
            <h4 className="font-semibold text-primary flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4" /> Order Summary
            </h4>
            <div className="space-y-2 text-sm font-medium">
              {Object.entries(selectedTickets).filter(([_, q]) => q > 0).map(([id, q]) => {
                const t = event.ticketTypes.find(x => x.id === Number(id));
                return (
                  <div key={id} className="flex justify-between">
                    <span>{q}x {t?.name}</span>
                    <span>{(t?.price || 0) * q} ₽</span>
                  </div>
                );
              })}
              <div className="pt-3 border-t border-primary/20 flex justify-between font-bold text-lg text-foreground">
                <span>Total</span>
                <span>{totalAmount} ₽</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmitCheckout)} className="space-y-5">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input {...register("attendeeName")} className="h-12 rounded-xl bg-background" placeholder="John Doe" />
              {errors.attendeeName?.message && <p className="text-destructive text-sm">{errors.attendeeName.message as string}</p>}
            </div>
            
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input {...register("attendeeEmail")} type="email" className="h-12 rounded-xl bg-background" placeholder="john@example.com" />
              {errors.attendeeEmail?.message && <p className="text-destructive text-sm">{errors.attendeeEmail.message as string}</p>}
            </div>

            <div className="space-y-2">
              <Label>Special Notes (Optional)</Label>
              <Textarea {...register("notes")} className="resize-none rounded-xl bg-background" rows={3} placeholder="Dietary requirements, accessibility needs..." />
            </div>

            <Button type="submit" disabled={createOrder.isPending} className="w-full h-14 rounded-xl text-lg shadow-xl shadow-primary/20 mt-8">
              {createOrder.isPending ? "Processing..." : `Pay ${totalAmount} ₽`}
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-4">
              This is a mock payment. No real charges will be made.
            </p>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
