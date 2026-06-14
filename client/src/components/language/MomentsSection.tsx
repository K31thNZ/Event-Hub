// client/src/components/language/MomentsSection.tsx
//
// Task 11 (Spec Batch 3): "Moments" feed — a lightweight 48h practice sentence
// wall rendered at the top of the Language Exchange page.
//
// Features:
//   • "Write a moment" sheet — auth-gated, 140-char textarea + language selector.
//   • Up to 5 recent non-expired moments shown.
//   • Like button (toggle, auth-gated).
//   • Inline correction form (auth-gated) — submits { original, suggestion, explanation }.
//   • Shows how many corrections a post already has.
//   • All mutations invalidate the moments query so the feed updates immediately.

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Heart, MessageSquare, PenLine, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { LANGUAGES } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "https://auth.expatevents.org";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Correction {
  correctorId:  number;
  original:     string;
  suggestion:   string;
  explanation?: string;
  at:           string;
}

interface Moment {
  id:          number;
  text:        string;
  language:    string;
  likes:       number[];
  corrections: Correction[];
  expiresAt:   string;
  createdAt:   string;
  userId:      number;
  displayName: string | null;
  avatarUrl:   string | null;
  native:      string | null;
  learning:    { code: string; proficiency: string }[] | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLangFlag(code: string) {
  return LANGUAGES.find(l => l.code === code)?.flag ?? "🌐";
}
function getLangLabel(code: string) {
  return LANGUAGES.find(l => l.code === code)?.label ?? code.toUpperCase();
}
function getInitials(name: string | null) {
  return (name ?? "?").substring(0, 2).toUpperCase();
}

// ── Correction inline form ────────────────────────────────────────────────────

function CorrectionForm({ postId, onDone }: { postId: number; onDone: () => void }) {
  const [original,    setOriginal]    = useState("");
  const [suggestion,  setSuggestion]  = useState("");
  const [explanation, setExplanation] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const correctMutation = useMutation({
    mutationFn: () =>
      fetch(`${AUTH_URL}/api/language-exchange/moments/${postId}/correct`, {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ original: original.trim(), suggestion: suggestion.trim(), explanation: explanation.trim() || undefined }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moments"] });
      toast({ title: "Correction sent ✓" });
      onDone();
    },
    onError: () => toast({ title: "Failed to send correction", variant: "destructive" }),
  });

  return (
    <div className="mt-2 space-y-2 bg-muted/40 rounded-xl p-3 text-sm">
      <p className="text-xs font-medium text-muted-foreground">Suggest a correction</p>
      <Textarea
        value={original}
        onChange={e => setOriginal(e.target.value)}
        placeholder="Quote the part you're correcting…"
        className="rounded-lg min-h-[44px] resize-none text-xs"
        maxLength={200}
      />
      <Textarea
        value={suggestion}
        onChange={e => setSuggestion(e.target.value)}
        placeholder="Your suggested phrasing…"
        className="rounded-lg min-h-[44px] resize-none text-xs"
        maxLength={200}
      />
      <Textarea
        value={explanation}
        onChange={e => setExplanation(e.target.value)}
        placeholder="Explanation (optional)…"
        className="rounded-lg min-h-[44px] resize-none text-xs"
        maxLength={300}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          className="rounded-lg h-7 text-xs"
          disabled={!original.trim() || !suggestion.trim() || correctMutation.isPending}
          onClick={() => correctMutation.mutate()}
        >
          Send
        </Button>
        <Button size="sm" variant="ghost" className="rounded-lg h-7 text-xs" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Moment card ───────────────────────────────────────────────────────────────

function MomentCard({ moment, meId }: { moment: Moment; meId?: number }) {
  const [showCorrect, setShowCorrect] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const liked  = meId != null && moment.likes.includes(meId);
  const ttlPct = Math.max(0, Math.min(100,
    ((new Date(moment.expiresAt).getTime() - Date.now()) / (48 * 60 * 60 * 1000)) * 100
  ));

  const likeMutation = useMutation({
    mutationFn: () =>
      fetch(`${AUTH_URL}/api/language-exchange/moments/${moment.id}/like`, {
        method: "POST", credentials: "include",
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["moments"] }),
    onError:   () => toast({ title: "Could not like post", variant: "destructive" }),
  });

  return (
    <div className="flex gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      {/* Avatar */}
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={moment.avatarUrl ?? ""} />
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
          {getInitials(moment.displayName)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">{moment.displayName ?? "Member"}</span>
          {moment.native && (
            <span className="text-[11px] text-muted-foreground">
              {getLangFlag(moment.native)} → {getLangFlag(moment.language)}
            </span>
          )}
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto shrink-0">
            {getLangLabel(moment.language)}
          </Badge>
        </div>

        {/* Post text */}
        <p className="text-sm leading-relaxed break-words">{moment.text}</p>

        {/* Corrections summary */}
        {moment.corrections.length > 0 && (
          <div className="space-y-1.5 mt-1">
            {moment.corrections.map((c, i) => (
              <div key={i} className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs">
                <span className="line-through text-muted-foreground">{c.original}</span>
                <span className="text-emerald-700 font-medium"> → {c.suggestion}</span>
                {c.explanation && <p className="text-muted-foreground mt-0.5 italic">{c.explanation}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Inline correction form */}
        {showCorrect && <CorrectionForm postId={moment.id} onDone={() => setShowCorrect(false)} />}

        {/* Footer row */}
        <div className="flex items-center gap-3 pt-0.5">
          <button
            onClick={() => meId != null ? likeMutation.mutate() : void 0}
            disabled={likeMutation.isPending}
            className={[
              "flex items-center gap-1 text-xs transition-colors",
              liked ? "text-rose-500" : "text-muted-foreground hover:text-rose-400",
              meId == null ? "cursor-default opacity-60" : "cursor-pointer",
            ].join(" ")}
            title={meId == null ? "Sign in to like" : undefined}
          >
            <Heart className={["w-3.5 h-3.5", liked ? "fill-rose-500" : ""].join(" ")} />
            {moment.likes.length > 0 && <span>{moment.likes.length}</span>}
          </button>

          {meId != null && (
            <button
              onClick={() => setShowCorrect(v => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{showCorrect ? "Cancel" : "Correct"}</span>
            </button>
          )}

          {/* TTL bar */}
          <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
            <Clock className="w-3 h-3" />
            <span>{formatDistanceToNow(new Date(moment.createdAt), { addSuffix: true })}</span>
            <div className="w-10 h-1 rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full bg-primary/40 rounded-full"
                style={{ width: `${ttlPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Write-a-moment sheet ──────────────────────────────────────────────────────

function WriteMomentSheet({ onPosted }: { onPosted: () => void }) {
  const [open,     setOpen]     = useState(false);
  const [text,     setText]     = useState("");
  const [language, setLanguage] = useState(LANGUAGES[0]?.code ?? "en");
  const { toast } = useToast();

  const postMutation = useMutation({
    mutationFn: () =>
      fetch(`${AUTH_URL}/api/language-exchange/moments`, {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ text: text.trim(), language }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
        return r.json();
      }),
    onSuccess: () => {
      toast({ title: "Moment posted! It lives for 48 hours 🌱" });
      setText("");
      setOpen(false);
      onPosted();
    },
    onError: (e: any) =>
      toast({ title: "Failed to post", description: e.message, variant: "destructive" }),
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl h-8 text-xs">
          <PenLine className="w-3.5 h-3.5" /> Write a moment
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl max-w-lg mx-auto">
        <SheetHeader>
          <SheetTitle className="text-base">Share a practice sentence</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Textarea
              value={text}
              onChange={e => setText(e.target.value.slice(0, 140))}
              placeholder="Write a sentence in your target language — others can correct it…"
              className="rounded-xl resize-none min-h-[80px] text-sm"
              maxLength={140}
            />
            <div className="flex justify-end mt-1">
              <span className={`text-xs ${text.length > 120 ? "text-amber-500" : "text-muted-foreground"}`}>
                {text.length}/140
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Language you're practising</p>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="rounded-xl h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(l => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.flag} {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full rounded-xl"
            disabled={text.trim().length === 0 || postMutation.isPending}
            onClick={() => postMutation.mutate()}
          >
            {postMutation.isPending ? "Posting…" : "Post Moment"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main exported component ───────────────────────────────────────────────────

export default function MomentsSection() {
  const { user: me } = useAuth();
  const qc = useQueryClient();

  const { data: moments = [], isLoading } = useQuery<Moment[]>({
    queryKey: ["moments"],
    queryFn: () =>
      fetch(`${AUTH_URL}/api/language-exchange/moments?limit=5`, { credentials: "include" })
        .then(r => r.json()),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (isLoading) return null; // No skeleton — section is supplementary

  if (moments.length === 0 && !me) return null; // Nothing to show to logged-out users

  return (
    <section className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <span>✍️</span> Practice Moments
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            48-hour practice sentences — read, like, or correct
          </p>
        </div>
        {me && (
          <WriteMomentSheet onPosted={() => qc.invalidateQueries({ queryKey: ["moments"] })} />
        )}
      </div>

      {/* Empty state (authenticated) */}
      {moments.length === 0 && me && (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-5 py-7 text-center space-y-2">
          <p className="text-sm text-muted-foreground">No moments yet — be the first to post a practice sentence!</p>
        </div>
      )}

      {/* Moment cards */}
      <div className="space-y-3">
        {moments.map(m => (
          <MomentCard key={m.id} moment={m} meId={me?.id} />
        ))}
      </div>
    </section>
  );
}
