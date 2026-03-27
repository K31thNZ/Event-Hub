import { useEvents } from "@/hooks/use-events";
import { EventCard } from "@/components/events/EventCard";
import { Input } from "@/components/ui/input";
import { Search, MapPin, CalendarHeart } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";

export default function Home() {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");

  const { data: events, isLoading } = useEvents({ 
    search: search || undefined, 
    city: city !== "all" ? city : undefined,
    category: category !== "all" ? category : undefined
  });

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        {/* landing page hero atmospheric gathering */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=2069&auto=format&fit=crop" 
            alt="Hero Background" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/40" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-medium text-sm mb-6 border border-primary/20">
              <CalendarHeart className="w-4 h-4" />
              <span>Connect. Explore. Experience.</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-display font-bold text-foreground leading-[1.1] mb-6">
              Find your next <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">unforgettable</span> event.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed max-w-xl">
              The premier platform for expats in Russia to discover local gatherings, professional networking, and vibrant cultural experiences.
            </p>

            {/* Search Bar */}
            <div className="glass p-2 rounded-2xl md:rounded-full flex flex-col md:flex-row gap-2 max-w-3xl">
              <div className="relative flex-1 flex items-center">
                <Search className="w-5 h-5 absolute left-4 text-muted-foreground" />
                <Input 
                  placeholder="Search events..." 
                  className="w-full pl-12 h-12 bg-transparent border-none focus-visible:ring-0 text-base rounded-full"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="h-px w-full md:h-10 md:w-px bg-border my-auto hidden md:block" />
              <div className="relative md:w-48 flex items-center">
                <MapPin className="w-5 h-5 absolute left-4 text-muted-foreground z-10" />
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger className="w-full pl-12 h-12 bg-transparent border-none focus:ring-0 text-base shadow-none">
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800">
                    <SelectItem value="all">All Locations</SelectItem>
                    <SelectItem value="Moscow">Moscow</SelectItem>
                    <SelectItem value="Dubai">Dubai</SelectItem>
                    <SelectItem value="London">London</SelectItem>
                    <SelectItem value="New York">New York</SelectItem>
                    <SelectItem value="Singapore">Singapore</SelectItem>
                    <SelectItem value="Sydney">Sydney</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="h-px w-full md:h-10 md:w-px bg-border my-auto hidden md:block" />
              <div className="relative md:w-48 flex items-center">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full px-4 h-12 bg-transparent border-none focus:ring-0 text-base shadow-none">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Category</SelectItem>
                    <SelectItem value="Nightlife">Nightlife</SelectItem>
                    <SelectItem value="Networking">Networking</SelectItem>
                    <SelectItem value="Culture">Culture</SelectItem>
                    <SelectItem value="Food & Drink">Food & Drink</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Events Listing */}
      <section className="py-20 bg-background flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Upcoming Events</h2>
              <p className="text-muted-foreground">Discover what's happening around you.</p>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-96 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : events?.length === 0 ? (
            <div className="text-center py-32 glass rounded-3xl">
              <CalendarHeart className="w-16 h-16 mx-auto text-muted-foreground mb-6 opacity-50" />
              <h3 className="text-2xl font-display font-bold mb-2">No events found</h3>
              <p className="text-muted-foreground">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {events?.map((event, i) => (
                <EventCard key={event.id} event={event} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
