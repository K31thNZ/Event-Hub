import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Users, Lock, Globe, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { EVENT_CATEGORIES } from "@shared/categories";
import type { GroupWithMeta } from "@shared/schema";

const PREMIUM_ROLES = ["premium", "host", "curator", "admin"];

export default function Groups() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const { data: groups = [], isLoading } = useQuery<GroupWithMeta[]>({
    queryKey: ["/api/groups"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const canCreateGroup = user && PREMIUM_ROLES.includes(user.role ?? "");

  const filtered = groups.filter(g => {
    const matchesSearch = !search ||
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all" || g.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-background pb-24">

      {/* Hero */}
      <div className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/8" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-medium text-sm mb-4 border border-primary/20">
                <Users className="w-4 h-4" /> Community Groups
              </div>
              <h1 className="text-5xl md:text-6xl font-display font-bold mb-3">Groups</h1>
              <p className="text-muted-foreground text-lg max-w-xl">
                Join a community around your interests, or start your own.
              </p>
            </div>
            {canCreateGroup ? (
              <Button asChild className="rounded-full px-6 gap-2 shadow-lg shadow-primary/20 shrink-0">
                <Link href="/groups/create">
                  <Plus className="w-4 h-4" /> Create a Group
                </Link>
              </Button>
            ) : user ? (
              <div className="text-sm text-muted-foreground bg-muted/50 border border-border rounded-2xl px-4 py-3 max-w-xs">
                Upgrade to <Link href="/profile" className="text-primary underline">Premium</Link> to create your own group.
              </div>
            ) : null}
          </motion.div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search groups…"
              className="pl-9 h-11 rounded-xl"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setCategory("all")}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                category === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              All
            </button>
            {EVENT_CATEGORIES.slice(0, 6).map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  category === cat.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-64 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-32 glass rounded-3xl">
            <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-40" />
            <h3 className="text-2xl font-display font-bold mb-2">No groups found</h3>
            <p className="text-muted-foreground">Try a different search or category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((group, i) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/groups/${group.slug}`}>
                  <div className="group bg-card border border-border rounded-3xl overflow-hidden hover:shadow-xl hover:shadow-primary/5 transition-all hover:-translate-y-0.5 cursor-pointer">
                    {/* Banner */}
                    <div className="h-28 bg-gradient-to-br from-primary/20 to-accent/20 relative overflow-hidden">
                      {group.bannerUrl && (
                        <img src={group.bannerUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      )}
                      {/* Avatar */}
                      <div className="absolute -bottom-6 left-5">
                        <div className="w-14 h-14 rounded-2xl border-4 border-card bg-card overflow-hidden shadow-lg">
                          {group.imageUrl ? (
                            <img src={group.imageUrl} alt={group.name} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                              <span className="font-display font-bold text-primary text-lg">
                                {group.name.substring(0, 1).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Membership type badge */}
                      <div className="absolute top-3 right-3">
                        {group.membershipType === "invite_only" ? (
                          <div className="flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                            <Lock className="w-3 h-3" /> Invite only
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 bg-black/30 text-white text-xs px-2 py-1 rounded-full">
                            <Globe className="w-3 h-3" /> Open
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-8 px-5 pb-5">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-display font-bold text-lg leading-tight group-hover:text-primary transition-colors">
                          {group.name}
                        </h3>
                        {group.currentUserRole && (
                          <Badge variant="secondary" className="text-xs shrink-0 capitalize">
                            {group.currentUserRole}
                          </Badge>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs mb-3 capitalize">{group.category}</Badge>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{group.description || "No description yet."}</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        {group.memberCount} member{group.memberCount !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
