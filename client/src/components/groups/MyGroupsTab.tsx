import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Settings, Lock, Globe } from "lucide-react";
import type { GroupWithMeta } from "@shared/schema";

const PREMIUM_ROLES = ["premium", "host", "curator", "admin"];

export function MyGroupsTab() {
  const { user } = useAuth();
  const { data: myGroups = [], isLoading } = useQuery<GroupWithMeta[]>({
    queryKey: ["/api/groups/my"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/groups/my");
      return res.json();
    },
  });

  const canCreate = user && PREMIUM_ROLES.includes(user.role ?? "");
  const ownsGroup = myGroups.some(g => g.currentUserRole === "owner");

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {canCreate && !ownsGroup && (
          <Button asChild className="rounded-full shadow-lg shadow-primary/20">
            <Link href="/groups/create"><Plus className="w-4 h-4 mr-2" /> Create a Group</Link>
          </Button>
        )}
        {canCreate && ownsGroup && (
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/groups">Browse groups</Link>
          </Button>
        )}
        {!canCreate && (
          <p className="text-sm text-muted-foreground">
            <Link href="/profile" className="text-primary underline">Upgrade to Premium</Link> to create a group.
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
        </div>
      ) : myGroups.length === 0 ? (
        <div className="text-center py-24 glass rounded-3xl border-dashed">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold mb-2">No groups yet</h3>
          <p className="text-muted-foreground mb-6">
            {canCreate ? "Create a group to build your community." : "Join a group to connect with others."}
          </p>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/groups">Browse Groups</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {myGroups.map(group => (
            <div key={group.id} className="flex items-center gap-4 bg-card border border-border rounded-2xl px-5 py-4 hover:shadow-md transition-shadow">

              {/* Avatar — fixed 48×48, aspect-ratio locks the box so object-cover fills it */}
              <div className="shrink-0" style={{ width: 48, height: 48 }}>
                {group.imageUrl ? (
                  <img
                    src={group.imageUrl}
                    alt={group.name}
                    style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 12, display: "block" }}
                  />
                ) : (
                  <div
                    style={{ width: 48, height: 48, borderRadius: 12 }}
                    className="bg-primary/10 flex items-center justify-center"
                  >
                    <span className="font-display font-bold text-primary text-lg">
                      {group.name.substring(0, 1).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold truncate">{group.name}</h3>
                  <Badge variant="secondary" className="text-xs capitalize">{group.currentUserRole}</Badge>
                  {group.membershipType === "invite_only" ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock className="w-3 h-3" /> Invite only
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Globe className="w-3 h-3" /> Open
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {group.memberCount} member{group.memberCount !== 1 ? "s" : ""} · {group.category}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button asChild variant="outline" size="sm" className="rounded-lg">
                  <Link href={`/groups/${group.slug}`}>View</Link>
                </Button>
                {(group.currentUserRole === "owner" || group.currentUserRole === "moderator") && (
                  <Button asChild variant="outline" size="sm" className="rounded-lg gap-1.5">
                    <Link href={`/groups/${group.slug}/manage`}>
                      <Settings className="w-3.5 h-3.5" /> Manage
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
