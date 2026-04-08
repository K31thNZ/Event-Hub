// client/src/pages/CreateGroup.tsx
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Globe, Lock, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { EVENT_CATEGORIES } from "@shared/categories";

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "https://auth.expatevents.org";
const PREMIUM_ROLES = ["premium", "host", "curator", "admin"];

export function CreateGroup() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("social");
  const [visibility, setVisibility] = useState("public");
  const [membershipType, setMembershipType] = useState("open");
  const [imageUrl, setImageUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

  const autoSlug = (n: string) => n.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40);

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugManual) setSlug(autoSlug(v));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !slug.trim()) { setError("Name and URL slug are required"); return; }
    if (!/^[a-z0-9-]+$/.test(slug)) { setError("Slug may only contain lowercase letters, numbers, and hyphens"); return; }

    setSaving(true);
    try {
      const res = await apiRequest("POST", "/api/groups", {
        name, slug, description, category, visibility, membershipType,
        imageUrl: imageUrl || null, bannerUrl: bannerUrl || null,
      });
      const group = await res.json();
      setLocation(`/groups/${group.slug}`);
    } catch (err: any) {
      setError(err.message ?? "Failed to create group");
    } finally {
      setSaving(false);
    }
  };

  if (!isLoading && user && !PREMIUM_ROLES.includes(user.role ?? "")) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
        <Users className="w-16 h-16 text-muted-foreground opacity-40" />
        <div className="text-center">
          <h1 className="text-3xl font-display font-bold mb-2">Premium required</h1>
          <p className="text-muted-foreground max-w-sm">Groups are available to premium members. Upgrade your membership to create a group.</p>
        </div>
        <Button asChild className="rounded-full"><a href="/profile">View membership options</a></Button>
      </div>
    );
  }

  if (!isLoading && !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
        <h1 className="text-3xl font-display font-bold">Sign in to create a group</h1>
        <Button onClick={() => window.location.href = `${AUTH_URL}/login?returnTo=${encodeURIComponent(window.location.href)}`} className="rounded-full px-8">Sign In</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-10 text-center">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/10">
              <Users className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-display font-bold mb-3">Create a Group</h1>
            <p className="text-muted-foreground">Build a community around your events and interests.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
              <div className="bg-primary/5 px-8 py-4 border-b border-border/50">
                <h2 className="text-xl font-bold font-display">Group details</h2>
              </div>
              <CardContent className="p-8 space-y-5">
                <div className="space-y-2">
                  <Label>Group name</Label>
                  <Input value={name} onChange={e => handleNameChange(e.target.value)} className="h-12 rounded-xl" placeholder="Moscow Tech Meetup" />
                </div>
                <div className="space-y-2">
                  <Label>URL slug <span className="text-muted-foreground font-normal text-xs">— expatevents.org/groups/<strong>{slug || "your-group"}</strong></span></Label>
                  <Input
                    value={slug}
                    onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSlugManual(true); }}
                    className="h-12 rounded-xl font-mono text-sm"
                    placeholder="moscow-tech-meetup"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} className="rounded-xl resize-none" rows={3} placeholder="What is your group about?" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EVENT_CATEGORIES.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
              <div className="bg-primary/5 px-8 py-4 border-b border-border/50">
                <h2 className="text-xl font-bold font-display">Membership settings</h2>
              </div>
              <CardContent className="p-8 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setMembershipType("open")}
                    className={`p-4 rounded-2xl border-2 text-left transition-colors ${membershipType === "open" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                    <Globe className="w-5 h-5 mb-2 text-primary" />
                    <p className="font-semibold text-sm">Open</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Anyone can join</p>
                  </button>
                  <button type="button" onClick={() => setMembershipType("invite_only")}
                    className={`p-4 rounded-2xl border-2 text-left transition-colors ${membershipType === "invite_only" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                    <Lock className="w-5 h-5 mb-2 text-primary" />
                    <p className="font-semibold text-sm">Invite only</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Owner approves members</p>
                  </button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
              <div className="bg-primary/5 px-8 py-4 border-b border-border/50">
                <h2 className="text-xl font-bold font-display">Branding (optional)</h2>
              </div>
              <CardContent className="p-8 space-y-4">
                <div className="space-y-2">
                  <Label>Group logo URL</Label>
                  <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="h-11 rounded-xl" placeholder="https://…" />
                </div>
                <div className="space-y-2">
                  <Label>Banner image URL</Label>
                  <Input value={bannerUrl} onChange={e => setBannerUrl(e.target.value)} className="h-11 rounded-xl" placeholder="https://…" />
                </div>
              </CardContent>
            </Card>

            {error && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}

            <Button type="submit" disabled={saving} className="w-full h-14 text-lg rounded-2xl shadow-xl shadow-primary/20">
              {saving ? "Creating group…" : "Create Group"}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

export default CreateGroup;
