import { useMyEvents } from "@/hooks/use-events";
import { useMyOrders } from "@/hooks/use-orders";
import { EventCard } from "@/components/events/EventCard";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ticket, CalendarDays, PlusCircle } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: myEvents, isLoading: loadingEvents } = useMyEvents();
  const { data: myOrders, isLoading: loadingOrders } = useMyOrders();

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="text-4xl font-display font-bold text-foreground mb-2">My Dashboard</h1>
          <p className="text-muted-foreground text-lg">Manage your tickets and hosted events.</p>
        </div>

        <Tabs defaultValue="tickets" className="w-full">
          <TabsList className="mb-8 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger value="tickets" className="rounded-lg px-6 py-2.5 text-base data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Ticket className="w-4 h-4 mr-2" /> My Tickets
            </TabsTrigger>
            <TabsTrigger value="events" className="rounded-lg px-6 py-2.5 text-base data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <CalendarDays className="w-4 h-4 mr-2" /> Events I'm Hosting
            </TabsTrigger>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myOrders?.map(order => (
                  <div key={order.id} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div className="inline-flex px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-bold uppercase tracking-wider">Confirmed</div>
                      <span className="font-mono text-muted-foreground text-sm">#{order.id}</span>
                    </div>
                    <h3 className="font-display font-bold text-xl mb-1 line-clamp-1">{order.event.title}</h3>
                    <p className="text-muted-foreground text-sm mb-6">{format(new Date(order.event.date), 'MMM d, yyyy • h:mm a')}</p>
                    
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

          <TabsContent value="events">
            <div className="mb-6 flex justify-end">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {myEvents?.map((event, i) => (
                  <EventCard key={event.id} event={event} index={i} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
