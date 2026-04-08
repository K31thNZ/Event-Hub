import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Settings, Users, Shield, CheckCircle, XCircle, ShieldPlus, ShieldMinus, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EVENT_CATEGORIES } from "@shared/categories";
import type { GroupWithDetails } from "@shared/schema";

export default function GroupManage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: group, isLoading } = useQuery<GroupWithDetails>({
    queryKey: [`/api/groups/${slug}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState("");
  const [membershipType, setMembershipType] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [settingsInit, setSettingsInit] = useState(false);

  if (group && !settingsInit) {
    setName(group.name);
    setDescription(group.description);
    setCategory(group.category);
    setVisibility(group.visibility);
    setMembershipType(group.membershipType);
    setImageUrl(group.imageUrl ?? "");
    setBannerUrl(group.bannerUrl ?? "");
    setSettingsInit(true);
  }

  const saveSettings = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/groups/${group?.id}`, {
      name, description, category, visibility, membershipType,
      imageUrl: imageUrl || null, bannerUrl: bannerUrl || null,
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${slug}`] });
      toast({ title: "Settings saved" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const approveMember = useMutation({
    mutationFn: (userId: number) => apiRequest("PATCH", `/api/groups/${group?.id}/members/${userId}`, { status: "active" }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/groups/${slug}`] }); toast({ title: "Member approved" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const banMember = useMutation({
    mutationFn: (userId: number) => apiRequest("PATCH", `/api/groups/${group?.id}/members/${userId}`, { status: "banned" }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/groups/${slug}`] }); toast({ title: "Member removed" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const promoteMod = useMutation({
    mutationFn: (userId: number) => apiRequest("POST", `/api/groups/${group?.id}/moderators`, { userId }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/groups/${slug}`] }); toast({ title: "Moderator added" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const demoteMod = useMutation({
    mutationFn: (userId: number) => apiRequest("DELETE", `/api/groups/${group?.id}/moderators/${userId}`).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/groups/${slug}`] }); toast({ title: "Moderator removed" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );

  if (!group || (group.currentUserRole !== "owner" && group.currentUserRole !== "moderator")) {
    return <div className="text-center py-32"><h2 className="text-3xl font-display font-bold">Access denied</h2></div>;
  }

  const isOwner = group.currentUserRole === "owner";
  const activeMembers = group.members.filter(m => m.status === "active" && m.role !== "owner");
  const pendingMembers = group.members.filter(m => m.status === "pending");
  const moderators = group.members.filter(m => m.role === "moderator" && m.status === "active");
  const regularMembers = activeMembers.filter(m => m.role === "member");

  return (
    <div className="min-h-screen bg-background py-12 pb-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-4">
          <Button asChild variant="ghost" size="sm" className="rounded-full gap-1.5">
            <Link href={`/groups/${slug}`}><ArrowLeft className="w-4 h-4" /> Back to group</Link>
          </Button>
        </div>
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold">Manage: {group.name}</h1>
          <p className="text-muted-foreground mt-1">
            {isOwner ? "Owner" : "Moderator"} · {group.memberCount} member{group.memberCount !== 1 ? "s" : ""}
          </p>
        </div>

        <Tabs defaultValue="members" className="w-full">
          <TabsList className="mb-6 p-1 bg-muted/50 rounded-xl h-auto flex flex-wrap gap-1">
            <TabsTrigger value="members" className="rounded-lg px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Users className="w-4 h-4 mr-2" /> Members
            </TabsTrigger>
            {isOwner && (
              <TabsTrigger value="moderators" className="rounded-lg px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Shield className="w-4 h-4 mr-2" /> Moderators
              </TabsTrigger>
            )}
            {isOwner && (
              <TabsTrigger value="settings" className="rounded-lg px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Settings className="w-4 h-4 mr-2" /> Settings
              </TabsTrigger>
            )}
          </TabsList>

          {/* Members tab */}
          <TabsContent value="members" className="space-y-6">
            {pendingMembers.length > 0 && (
              <Card className="rounded-2xl border-amber-200 dark:border-amber-900/50">
                <div className="bg-amber-50 dark:bg-amber-900/20 px-5 py-3 border-b border-amber-200 dark:border-amber-900/50 rounded-t-2xl">
                  <h3 className="font-semibold text-sm text-amber-800 dark:text-amber-300">Pending requests ({pendingMembers.length})</h3>
                </div>
                <CardContent className="p-4 space-y-2">
                  {pendingMembers.map(m => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                      <Avatar className="h-9 w-9"><AvatarFallback>{(m.displayName ?? "U").substring(0,2).toUpperCase()}</AvatarFallback></Avatar>
                      <p className="flex-1 font-medium text-sm">{m.displayName ?? "Unknown"}</p>
                      <Button size="sm" variant="outline" className="rounded-lg gap-1 text-green-700 border-green-300 hover:bg-green-50" onClick={() => approveMember.mutate(m.userId)}>
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-lg gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => banMember.mutate(m.userId)}>
                        <XCircle className="w-3.5 h-3.5" /> Decline
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="rounded-2xl">
              <div className="px-5 py-3 border-b rounded-t-2xl">
                <h3 className="font-semibold text-sm">Active members ({regularMembers.length})</h3>
              </div>
              <CardContent className="p-4 space-y-2">
                {regularMembers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No regular members yet.</p>}
                {regularMembers.map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors">
                    <Avatar className="h-9 w-9"><AvatarImage src={m.avatarUrl ?? ""} /><AvatarFallback>{(m.displayName ?? "U").substring(0,2).toUpperCase()}</AvatarFallback></Avatar>
                    <p className="flex-1 font-medium text-sm">{m.displayName ?? "Unknown"}</p>
                    {isOwner && moderators.length < 5 && (
                      <Button size="sm" variant="ghost" className="rounded-lg gap-1 text-xs" onClick={() => promoteMod.mutate(m.userId)}>
                        <ShieldPlus className="w-3.5 h-3.5" /> Make mod
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="rounded-lg gap-1 text-xs text-destructive" onClick={() => banMember.mutate(m.userId)}>
                      <XCircle className="w-3.5 h-3.5" /> Remove
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Moderators tab */}
          {isOwner && (
            <TabsContent value="moderators">
              <Card className="rounded-2xl">
                <div className="px-5 py-3 border-b rounded-t-2xl flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Moderators ({moderators.length}/5)</h3>
                </div>
                <CardContent className="p-4 space-y-2">
                  {moderators.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No moderators yet. Promote active members from the Members tab.
                    </p>
                  )}
                  {moderators.map(m => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors">
                      <Avatar className="h-9 w-9"><AvatarImage src={m.avatarUrl ?? ""} /><AvatarFallback>{(m.displayName ?? "U").substring(0,2).toUpperCase()}</AvatarFallback></Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{m.displayName ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">Moderator</p>
                      </div>
                      <Button size="sm" variant="ghost" className="rounded-lg gap-1 text-xs text-muted-foreground" onClick={() => demoteMod.mutate(m.userId)}>
                        <ShieldMinus className="w-3.5 h-3.5" /> Remove mod
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground text-center mt-4">
                Group ownership can be transferred to a premium member by contacting{" "}
                <a href="mailto:hello@expatevents.org" className="text-primary underline">support</a>.
              </p>
            </TabsContent>
          )}

          {/* Settings tab */}
          {isOwner && (
            <TabsContent value="settings">
              <Card className="rounded-2xl overflow-hidden">
                <div className="bg-primary/5 px-6 py-4 border-b border-border/50">
                  <h3 className="font-bold font-display">Group settings</h3>
                </div>
                <CardContent className="p-6 space-y-5">
                  <div className="space-y-2"><Label>Group name</Label><Input value={name} onChange={e => setName(e.target.value)} className="h-11 rounded-xl" /></div>
                  <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} className="rounded-xl resize-none" rows={3} /></div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>{EVENT_CATEGORIES.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Membership type</Label>
                    <Select value={membershipType} onValueChange={setMembershipType}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open — anyone can join</SelectItem>
                        <SelectItem value="invite_only">Invite only — owner approves</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Logo URL</Label><Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="h-11 rounded-xl" placeholder="https://…" /></div>
                  <div className="space-y-2"><Label>Banner URL</Label><Input value={bannerUrl} onChange={e => setBannerUrl(e.target.value)} className="h-11 rounded-xl" placeholder="https://…" /></div>
                  <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending} className="w-full rounded-xl">
                    {saveSettings.isPending ? "Saving…" : "Save settings"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-2xl mt-4 border-destructive/20">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-destructive mb-2">Transfer or delete group</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    To transfer ownership to another premium member, contact{" "}
                    <a href="mailto:hello@expatevents.org" className="text-primary underline">hello@expatevents.org</a>.
                    Ownership transfers require both parties to confirm.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
