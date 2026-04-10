import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Users, Lock, Globe, Calendar, MapPin, Settings, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import type { GroupWithDetails } from "@shared/schema";

const RECURRENCE_LABELS: Record<string, string> = {
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

export default function GroupProfile() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: group, isLoading } = useQuery<GroupWithDetails>({
    queryKey: [`/api/groups/${slug}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const joinMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/groups/${group?.id}/join`).then(r => r.json()),
    onSuccess: (data) => {
      // Invalidate so the server re-fetches with the user's session and returns
      // the updated currentUserRole / currentUserStatus, hiding the join button.
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${slug}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/my"] });
      toast({
        title: data.status === "pending" ? "Request sent" : "Joined!",
        description: data.status === "pending"
          ? "The group owner will review your request."
          : `Welcome to ${group?.name}!`,
      });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const leaveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/groups/${group?.id}/leave`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${slug}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/my"] });
      toast({ title: "Left group" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );

  if (!group) return (
    <div className="text-center py-32">
      <h2 className="text-3xl font-display font-bold">Group not found</h2>
    </div>
  );

  const role = group.currentUserRole;
  const memberStatus = (group as any).currentUserStatus; // "active" | "pending" | "invited" | null
  const isActiveMember = !!role && memberStatus === "active";
  const isPending = memberStatus === "pending";
  const isOwnerOrMod = role === "owner" || role === "moderator";

  // Show join button only when: logged in, not already a member (active or pending)
  const canJoin = user && !isActiveMember && !isPending;

  // Separate recurring base events from instances, only upcoming
  const baseEvents = group.events.filter(e => !e.parentEventId && new Date(e.date) >= new Date());
  const upcomingEvents = baseEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="min-h-screen bg-background pb-24">

      {/* Banner */}
      <div className="w-full h-56 md:h-72 relative bg-gradient-to-br from-primary/20 to-accent/20">
        {group.bannerUrl && (
          <img src={group.bannerUrl} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
        <div className="flex flex-col lg:flex-row gap-10">

          {/* Main */}
          <div className="flex-1 space-y-8">

            {/* Identity */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="glass rounded-3xl p-8">
              <div className="flex items-start gap-5">
                <div className="w-20 h-20 rounded-2xl border-4 border-card bg-card overflow-hidden shadow-xl shrink-0">
                  {group.imageUrl ? (
                    <img src={group.imageUrl} alt={group.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                      <span className="font-display font-bold text-primary text-3xl">
                        {group.name.substring(0, 1).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h1 className="text-3xl md:text-4xl font-display font-bold">{group.name}</h1>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="capitalize">{group.category}</Badge>
                        {group.membershipType === "invite_only" ? (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Lock className="w-3 h-3" /> Invite only
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Globe className="w-3 h-3" /> Open group
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" /> {group.memberCount} member{group.memberCount !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                    {isOwnerOrMod && (
                      <Button asChild variant="outline" size="sm" className="rounded-full gap-1.5">
                        {/* Links to GroupManage page */}
                        <Link href={`/groups/${slug}/manage`}>
                          <Settings className="w-3.5 h-3.5" /> Manage
                        </Link>
                      </Button>
                    )}
                  </div>
                  {group.description && (
                    <p className="text-muted-foreground mt-4 leading-relaxed">{group.description}</p>
                  )}
                </div>
              </div>

              {/* Join / Leave / Role */}
              <div className="mt-6 pt-6 border-t border-border flex items-center gap-3 flex-wrap">
                {isActiveMember ? (
                  <>
                    <Badge className="capitalize gap-1">
                      {role === "owner" && "★ "}
                      {role}
                    </Badge>
                    {role !== "owner" && (
                      <Button variant="outline" size="sm" className="rounded-full text-xs text-muted-foreground"
                        onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending}>
                        Leave group
                      </Button>
                    )}
                  </>
                ) : isPending ? (
                  // Request sent — pending approval, don't show join button again
                  <Badge variant="secondary" className="rounded-full px-4 py-1.5">
                    Request pending approval
                  </Badge>
                ) : canJoin ? (
                  <Button onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}
                    className="rounded-full px-6 gap-2 shadow-lg shadow-primary/20">
                    {group.membershipType === "invite_only" ? "Request to join" : "Join group"}
                  </Button>
                ) : !user ? (
                  <Button asChild className="rounded-full px-6">
                    <Link href="/login">Sign in to join</Link>
                  </Button>
                ) : null}
              </div>
            </motion.div>

            {/* Upcoming events */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-2xl font-display font-bold">Upcoming Events</h2>
                {isOwnerOrMod && (
                  <Button asChild size="sm" className="rounded-full gap-1.5">
                    <Link href={`/groups/${slug}/create-event`}>
                      <Calendar className="w-3.5 h-3.5" /> Add Event
                    </Link>
                  </Button>
                )}
              </div>

              {upcomingEvents.length === 0 ? (
                <div className="text-center py-16 glass rounded-3xl">
                  <Calendar className="w-12 h-12 mx-auto text-muted-foreground opacity-40 mb-3" />
                  <p className="text-muted-foreground">No upcoming events yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingEvents.map(event => (
                    <Link key={event.id} href={`/events/${event.id}`}>
                      <div className="group bg-card border border-border rounded-2xl p-5 flex gap-4 hover:shadow-lg hover:shadow-primary/5 transition-all hover:-translate-y-0.5 cursor-pointer">
                        {event.imageUrl && (
                          <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0">
                            <img src={event.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              {event.recurrence && (
                                <div className="flex items-center gap-1 text-xs text-primary mb-1">
                                  <RefreshCw className="w-3 h-3" />
                                  {RECURRENCE_LABELS[event.recurrence]}
                                </div>
                              )}
                              {event.isPrivate && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                  <Lock className="w-3 h-3" /> Members only
                                </div>
                              )}
                              <h3 className="font-semibold group-hover:text-primary transition-colors">{event.title}</h3>
                            </div>
                            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-0.5" />
                          </div>
                          <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-primary/70" />
                              {format(new Date(event.date), "EEE, MMM d · h:mm a")}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-primary/70" />
                              {event.venueCity}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar — Members */}
          <div className="w-full lg:w-72 shrink-0">
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="sticky top-28 bg-card border border-border rounded-3xl p-6">
              <h3 className="font-display font-bold text-lg mb-4">
                Members <span className="text-muted-foreground font-normal text-base">({group.memberCount})</span>
              </h3>
              <div className="space-y-3">
                {group.members
                  .sort((a, b) => {
                    const order = { owner: 0, moderator: 1, member: 2 };
                    return (order[a.role as keyof typeof order] ?? 2) - (order[b.role as keyof typeof order] ?? 2);
                  })
                  .slice(0, 10)
                  .map(member => (
                    <div key={member.id} className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={member.avatarUrl ?? ""} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {(member.displayName ?? "U").substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{member.displayName ?? "Member"}</p>
                        {member.role !== "member" && (
                          <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                        )}
                      </div>
                    </div>
                  ))}
                {group.memberCount > 10 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    +{group.memberCount - 10} more members
                  </p>
                )}
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </div>
  );
}
