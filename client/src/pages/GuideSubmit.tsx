// GuideSubmit.tsx — Community guide submission form
// Logged-in users fill out title, pillar, category, summary, and body.
// Submitted guides are saved as is_published=FALSE pending admin review.

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Send, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const PILLARS = ["arrive", "live", "work", "explore", "connect"] as const;

const CATEGORIES: Record<string, string[]> = {
  arrive:  ["Essential Reading", "Transport", "Legal", "Finance", "Housing", "Connectivity", "Other"],
  live:    ["Daily Life", "Healthcare", "Housing", "Neighbourhoods", "Other"],
  work:    ["Employment", "Legal", "Finance", "Remote Work", "Self-Employment", "Other"],
  explore: ["Transport", "Food & Drink", "Outdoors", "Culture", "Travel", "Other"],
  connect: ["Safety", "Community", "Language", "Social", "Other"],
};

export default function GuideSubmit() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title:    "",
    pillar:   "",
    category: "",
    summary:  "",
    body:     "",
    sources:  "",
  });

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value, ...(field === "pillar" ? { category: "" } : {}) }));

  const valid =
    form.title.trim().length >= 5 &&
    form.pillar &&
    form.category &&
    form.summary.trim().length >= 20 &&
    form.body.trim().length >= 100;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    try {
      const res = await fetch("/api/guides/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Submission failed");
      }
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
          <CheckCircle className="w-14 h-14 text-primary mx-auto mb-5" />
          <h1 className="font-display text-2xl font-bold text-foreground mb-3">Guide submitted!</h1>
          <p className="text-muted-foreground mb-8">
            Thanks — our team will review it and publish it to the knowledge base. We'll let you know once it's live.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/guides">
              <Button variant="outline">← Back to guides</Button>
            </Link>
            <Button onClick={() => { setSubmitted(false); setForm({ title: "", pillar: "", category: "", summary: "", body: "", sources: "" }); }}>
              Submit another
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Back bar */}
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <Link href="/guides">
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to guides
            </button>
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">Submit a guide</h1>
          <p className="text-muted-foreground mb-8">
            Share your local knowledge with the expat community. All submissions are reviewed before publishing — usually within a few days.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
              <Input
                id="title"
                placeholder="e.g. How to open a bank account as a foreigner"
                value={form.title}
                onChange={e => set("title", e.target.value)}
                maxLength={120}
              />
              <p className="text-xs text-muted-foreground">{form.title.length}/120</p>
            </div>

            {/* Pillar + Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Pillar <span className="text-destructive">*</span></Label>
                <Select value={form.pillar} onValueChange={v => set("pillar", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose pillar" />
                  </SelectTrigger>
                  <SelectContent>
                    {PILLARS.map(p => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Category <span className="text-destructive">*</span></Label>
                <Select value={form.category} onValueChange={v => set("category", v)} disabled={!form.pillar}>
                  <SelectTrigger>
                    <SelectValue placeholder={form.pillar ? "Choose category" : "Pick a pillar first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(CATEGORIES[form.pillar] ?? []).map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-1.5">
              <Label htmlFor="summary">
                One-line summary <span className="text-destructive">*</span>
              </Label>
              <Input
                id="summary"
                placeholder="A short description shown on the guides list page"
                value={form.summary}
                onChange={e => set("summary", e.target.value)}
                maxLength={250}
              />
              <p className="text-xs text-muted-foreground">{form.summary.length}/250 · minimum 20 characters</p>
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <Label htmlFor="body">
                Guide content <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="body"
                placeholder="Write your guide here. Plain text is fine — our team will format it before publishing. Minimum 100 characters."
                value={form.body}
                onChange={e => set("body", e.target.value)}
                rows={14}
                className="resize-y font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">{form.body.trim().length} chars · minimum 100</p>
            </div>

            {/* Sources */}
            <div className="space-y-1.5">
              <Label htmlFor="sources">Sources / references <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="sources"
                placeholder="e.g. expat.ru forum, personal experience, novika.info"
                value={form.sources}
                onChange={e => set("sources", e.target.value)}
                maxLength={300}
              />
            </div>

            {/* Info note */}
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Your submission will be reviewed by our editorial team before it appears on the site.
              We may lightly edit for formatting and clarity. Community guides are credited to "Community Contributor" by default — contact us if you'd like a different attribution.
            </div>

            <Button type="submit" disabled={!valid || loading} className="w-full gap-2">
              <Send className="w-4 h-4" />
              {loading ? "Submitting…" : "Submit for review"}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
