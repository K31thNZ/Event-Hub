// client/src/pages/GroupManage.tsx
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useState } from "react";
import { EVENT_CATEGORIES } from "@shared/categories";
import type { GroupWithDetails } from "@shared/schema";

const editGroupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  bannerUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  visibility: z.enum(["public", "private"]),
  membershipType: z.enum(["open", "invite_only"]),
});
type EditGroupForm = z.infer<typeof editGroupSchema>;

export default function GroupManage() {
  const { slug } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showDelete, setShowDelete] = useState(false);

  const { data: group, isLoading } = useQuery<GroupWithDetails>({
    queryKey: [`/api/groups/${slug}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const form = useForm<EditGroupForm>({
    resolver: zodResolver(editGroupSchema),
    values: group ? {
      name: group.name,
      description: group.description ?? "",
      category: group.category,
      imageUrl: group.imageUrl ?? "",
      bannerUrl: group.bannerUrl ?? "",
      visibility: group.visibility as "public" | "private",
      membershipType: group.membershipType as "open" | "invite_only",
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (data: EditGroupForm) =>
      apiRequest("PATCH", `/api/groups/${group!.id}`, {
        ...data,
        imageUrl: data.imageUrl || null,
        bannerUrl: data.bannerUrl || null,
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${slug}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/my"] });
      toast({ title: "Group updated" });
      setLocation(`/groups/${slug}`);
    },
    onError: (err: any) => toast({ title: "Failed to update", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/groups/${group!.id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/my"] });
      toast({ title: "Group deleted" });
      setLocation("/groups");
    },
    onError: (err: any) => toast({ title: "Failed to delete", description: err.message, variant: "destructive" }),
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
  if (role !== "owner" && role !== "moderator") {
    return (
      <div className="text-center py-32">
        <h2 className="text-3xl font-display font-bold">Access denied</h2>
        <p className="text-muted-foreground mt-2">Only the owner and moderators can manage this group.</p>
        <Button asChild variant="outline" className="mt-6 rounded-full">
          <Link href={`/groups/${slug}`}>Back to group</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <Link href={`/groups/${slug}`} className="inline-flex items-center text-muted-foreground hover:text-primary mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to {group.name}
        </Link>

        <h1 className="text-3xl font-display font-bold mb-8">Manage Group</h1>

        <form onSubmit={form.handleSubmit(d => updateMutation.mutate(d))} className="space-y-6 bg-card border border-border rounded-3xl p-8">
          <div className="space-y-1.5">
            <Label>Group Name</Label>
            <Input {...form.register("name")} className="h-12 rounded-xl" />
            {form.formState.errors.name && <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea {...form.register("description")} className="rounded-xl min-h-[100px]" placeholder="Tell people what this group is about…" />
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <Controller control={form.control} name="category" render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-900">
                  {EVENT_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )} />
          </div>

          <div className="space-y-1.5">
            <Label>Avatar Image URL <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
            <Input {...form.register("imageUrl")} className="h-12 rounded-xl" placeholder="https://…" />
            {form.formState.errors.imageUrl && <p className="text-destructive text-sm">{form.formState.errors.imageUrl.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Banner Image URL <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
            <Input {...form.register("bannerUrl")} className="h-12 rounded-xl" placeholder="https://…" />
            {form.formState.errors.bannerUrl && <p className="text-destructive text-sm">{form.formState.errors.bannerUrl.message}</p>}
          </div>

          {/* Visibility & membership — owner only */}
          {role === "owner" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
              <div className="space-y-1.5">
                <Label>Visibility</Label>
                <Controller control={form.control} name="visibility" render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white dark:bg-zinc-900">
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label>Membership</Label>
                <Controller control={form.control} name="membershipType" render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white dark:bg-zinc-900">
                      <SelectItem value="open">Open (anyone can join)</SelectItem>
                      <SelectItem value="invite_only">Invite only</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={updateMutation.isPending} className="flex-1 h-12 rounded-xl gap-2">
              <Save className="w-4 h-4" />
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>

        {/* Danger zone — owner only */}
        {role === "owner" && (
          <div className="mt-8 border border-destructive/30 rounded-3xl p-6 space-y-3">
            <h3 className="font-semibold text-destructive">Danger Zone</h3>
            <p className="text-sm text-muted-foreground">Deleting the group is permanent. All members will be removed and group events will be unlinked.</p>
            <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 rounded-xl gap-2"
              onClick={() => setShowDelete(true)}>
              <Trash2 className="w-4 h-4" /> Delete Group
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{group.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. The group will be suspended and all members removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? "Deleting…" : "Delete Group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
