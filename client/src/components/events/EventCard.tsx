import { Link } from "wouter";
import { type EventWithTickets } from "@shared/schema";
import { format } from "date-fns";
import { MapPin, Ticket, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export function EventCard({ event, index = 0 }: { event: EventWithTickets, index?: number }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", buildUrl(api.events.delete.path, { id: event.id }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Success", description: "Event deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete event",
        variant: "destructive" 
      });
    }
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this event?")) {
      deleteMutation.mutate();
    }
  };

  const minPrice = event.ticketTypes.length 
    ? Math.min(...event.ticketTypes.map(t => t.price)) 
    : 0;

  const fallbackImage = "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=800&auto=format&fit=crop";

  return (
    <Link href={`/events/${event.id}`}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.1 }}
        className="group relative h-full flex flex-col overflow-hidden rounded-2xl bg-card border border-border/60 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
      >
        <div className="aspect-[4/3] w-full overflow-hidden relative">
          <img 
            src={event.imageUrl || fallbackImage} 
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
          
          {/* Date Badge */}
          <div className="absolute top-4 left-4 bg-background/95 backdrop-blur-md px-3 py-2 rounded-xl text-center shadow-lg border border-white/10">
            <div className="text-primary font-display font-bold text-xl leading-none">{format(new Date(event.date), 'dd')}</div>
            <div className="text-xs uppercase font-bold tracking-wider text-muted-foreground mt-1">{format(new Date(event.date), 'MMM')}</div>
          </div>

          {/* Category Pill */}
          <div className="absolute top-4 right-4 flex gap-2">
            {(user?.isAdmin || (user && event.organizerId === user.id)) && (
              <Button
                size="icon"
                variant="destructive"
                className="h-8 w-8 rounded-full shadow-lg"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <div className="bg-black/40 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20">
              {event.category}
            </div>
          </div>
        </div>

        <div className="p-6 flex-1 flex flex-col">
          <h3 className="font-display font-bold text-xl text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
            {event.title}
          </h3>
          
          <div className="flex items-center text-muted-foreground text-sm mb-4">
            <MapPin className="w-4 h-4 mr-1 flex-shrink-0" />
            <span className="truncate">{event.venueCity} • {event.venueAddress}</span>
          </div>

          <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Ticket className="w-4 h-4 text-primary" />
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground block text-xs">Starting from</span>
                <span className="font-bold text-foreground">{minPrice > 0 ? `${minPrice} ₽` : 'Free'}</span>
              </div>
            </div>
            
            <div className="bg-foreground text-background px-4 py-2 rounded-full text-sm font-semibold opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
              Get Tickets
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
