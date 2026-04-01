import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Bell, Calendar, Check, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { EVENT_CATEGORIES, getCategoryLabel } from "@shared/categories";

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "https://meh-auth.onrender.com";

const CATEGORY_ICONS: Record<string, string> = {
  networking: "🔗", tech: "💻", culture: "🎨", food: "🍔",
  sports: "⚽", music: "🎵", language: "🌍", outdoor: "🏕️",
  games: "🎮", business: "💼", wellness: "🧘", family: "👨‍👩‍👧",
  social: "🤝", volunteering: "🙌", other: "📌",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 8); // 08:00–23:00

type Slot = { day: number; hour: number };

export default function Profile() {
  const { user, isLoading } = useAuth();
  const [interests, setInterests] = useState<string[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [dragMode, setDragMode] = useState<"add" | "remove">("add");

  // Telegram linking state
  const [telegramIdInput, setTelegramIdInput] = useState("");
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramSaved, setTelegramSaved] = useState(false);
  const [telegramError, setTelegramError] = useState("");

  // Load current interests and slots from meh-auth
  useEffect(() => {
    if (!user) return;

    // Interests come from the user object
    setInterests(user.interests ?? []);

    // Load availability slots
    fetch(`${AUTH_URL}/api/availability`, { credentials: "include" })
      .then(r => r.json())
      .then((data: Slot[]) => setSlots(data))
      .catch(() => {});
  }, [user]);

  const toggleInterest = (value: string) => {
    setInterests(prev =>
      prev.includes(value) ? prev.filter(i => i !== value) : [...prev, value]
    );
  };

  const isSlotActive = (day: number, hour: number) =>
    slots.some(s => s.day === day && s.hour === hour);

  const handleSlotMouseDown = (day: number, hour: number) => {
    setIsMouseDown(true);
    const active = isSlotActive(day, hour);
    setDragMode(active ? "remove" : "add");
    toggleSlot(day, hour, active ? "remove" : "add");
  };

  const handleSlotMouseEnter = (day: number, hour: number) => {
    if (!isMouseDown) return;
    toggleSlot(day, hour, dragMode);
  };

  const toggleSlot = (day: number, hour: number, mode: "add" | "remove") => {
    setSlots(prev => {
      const exists = prev.some(s => s.day === day && s.hour === hour);
      if (mode === "add" && !exists) return [...prev, { day, hour }];
      if (mode === "remove" && exists) return prev.filter(s => !(s.day === day && s.hour === hour));
      return prev;
    });
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await Promise.all([
        fetch(`${AUTH_URL}/api/user/interests`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ interests }),
        }),
        fetch(`${AUTH_URL}/api/availability`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ slots }),
        }),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setSaving(false);
    }
  };

  const saveTelegramId = async () => {
    const id = telegramIdInput.trim();
    if (!id) return;
    if (!/^\d+$/.test(id)) {
      setTelegramError("Telegram IDs are numbers only — check you copied it correctly.");
      return;
    }
    setTelegramError("");
    setTelegramSaving(true);
    try {
      const res = await fetch(`${AUTH_URL}/api/user/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ telegramId: id }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTelegramSaved(true);
      setTelegramIdInput("");
      setTimeout(() => setTelegramSaved(false), 3000);
    } catch (err) {
      setTelegramError("Failed to save. Please try again.");
    } finally {
      setTelegramSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading profile…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Sign in to view your profile.</p>
        <Button onClick={() => window.location.href = `${AUTH_URL}/login?returnTo=${window.location.href}`}>
          Sign In
        </Button>
      </div>
    );
  }

  const initials = (user.displayName ?? user.username ?? "U").substring(0, 2).toUpperCase();
  const telegramLinked = !!user.telegramId;

  return (
    <div
      className="min-h-screen bg-muted/20 py-12 px-4 sm:px-6 lg:px-8"
      onMouseUp={() => setIsMouseDown(false)}
      onMouseLeave={() => setIsMouseDown(false)}
    >
      <div className="max-w-3xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

          {/* ── Identity card ───────────────────────────────────────────── */}
          <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
            <div className="bg-primary/5 px-8 py-4 border-b border-border/50 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold font-display">Your Profile</h2>
            </div>
            <CardContent className="p-8 flex items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.avatarUrl ?? ""} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{user.displayName ?? user.username}</h1>
                {user.email && <p className="text-muted-foreground text-sm">{user.email}</p>}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {user.isExpatMember && <Badge variant="secondary">ExpatEvents</Badge>}
                  {user.isGamesMember && <Badge variant="secondary">Games in English</Badge>}
                  {user.role === "admin" && <Badge>Admin</Badge>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Telegram connection ─────────────────────────────────────── */}
          <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
            <div className="bg-primary/5 px-8 py-4 border-b border-border/50 flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold font-display">Telegram Notifications</h2>
            </div>
            <CardContent className="p-8">
              {telegramLinked ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <span style={{ fontSize: 20 }}>✈️</span>
                  </div>
                  <div>
                    <p className="font-medium">Telegram connected</p>
                    <p className="text-sm text-muted-foreground">You'll receive event notifications via the ExpatEvents bot</p>
                  </div>
                  <Badge className="ml-auto shrink-0" variant="secondary">Connected</Badge>
                </div>
              ) : (
                <div className="space-y-5">
                  <p className="text-sm text-muted-foreground">
                    Connect your Telegram account to get personalised event notifications and availability alerts straight to your phone.
                  </p>

                  <ol className="space-y-3 text-sm">
                    <li className="flex gap-3">
                      <span className="flex-none w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs">1</span>
                      <span>
                        Open the{" "}
                        <a
                          href="https://t.me/ExpatEventsMoscowBot"
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline underline-offset-2 inline-flex items-center gap-1"
                        >
                          ExpatEvents Telegram bot <ExternalLink className="w-3 h-3" />
                        </a>
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-none w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs">2</span>
                      <span>Send <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/start</code> — the bot will reply with your Telegram ID</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-none w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs">3</span>
                      <span>Copy that number and paste it below</span>
                    </li>
                  </ol>

                  <div className="flex gap-2 items-start">
                    <Input
                      data-testid="input-telegram-id"
                      type="text"
                      inputMode="numeric"
                      placeholder="Paste your Telegram ID here…"
                      value={telegramIdInput}
                      onChange={e => { setTelegramIdInput(e.target.value); setTelegramError(""); }}
                      className="flex-1"
                      onKeyDown={e => { if (e.key === "Enter") saveTelegramId(); }}
                    />
                    <Button
                      data-testid="button-connect-telegram"
                      onClick={saveTelegramId}
                      disabled={telegramSaving || !telegramIdInput.trim()}
                      className="shrink-0 gap-2"
                    >
                      {telegramSaved ? <><Check className="w-4 h-4" /> Linked!</> : telegramSaving ? "Saving…" : "Connect"}
                    </Button>
                  </div>

                  {telegramError && (
                    <p className="text-sm text-destructive">{telegramError}</p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    If you signed in with Telegram directly, your account links automatically — no need to do this.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Interests ───────────────────────────────────────────────── */}
          <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
            <div className="bg-primary/5 px-8 py-4 border-b border-border/50">
              <h2 className="text-xl font-bold font-display">Your Interests</h2>
              <p className="text-sm text-muted-foreground mt-1">Select the categories you want to receive notifications for</p>
            </div>
            <CardContent className="p-8">
              <div className="flex flex-wrap gap-3">
                {EVENT_CATEGORIES.map(cat => {
                  const active = interests.includes(cat.value);
                  return (
                    <button
                      key={cat.value}
                      data-testid={`button-interest-${cat.value}`}
                      onClick={() => toggleInterest(cat.value)}
                      className={`
                        flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all
                        ${active
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                        }
                      `}
                    >
                      <span style={{ fontSize: 16 }}>{CATEGORY_ICONS[cat.value]}</span>
                      {cat.label}
                    </button>
                  );
                })}
              </div>
              {interests.length === 0 && (
                <p className="text-sm text-muted-foreground mt-4">Select at least one interest to receive targeted notifications.</p>
              )}
            </CardContent>
          </Card>

          {/* ── Availability grid ────────────────────────────────────────── */}
          <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
            <div className="bg-primary/5 px-8 py-4 border-b border-border/50 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <h2 className="text-xl font-bold font-display">Weekly Availability</h2>
                <p className="text-sm text-muted-foreground">Click or drag to mark when you're free. Organisers use this to plan events.</p>
              </div>
            </div>
            <CardContent className="p-6 overflow-x-auto">
              <div className="min-w-[520px]">
                {/* Day headers */}
                <div className="grid grid-cols-8 gap-1 mb-1">
                  <div className="text-xs text-muted-foreground text-right pr-2 py-1"></div>
                  {DAYS.map(d => (
                    <div key={d} className="text-xs font-medium text-center text-muted-foreground py-1">{d}</div>
                  ))}
                </div>

                {/* Hour rows */}
                {HOURS.map(hour => (
                  <div key={hour} className="grid grid-cols-8 gap-1 mb-1">
                    <div className="text-xs text-muted-foreground text-right pr-2 flex items-center justify-end">
                      {String(hour).padStart(2, "0")}:00
                    </div>
                    {DAYS.map((_, day) => {
                      const active = isSlotActive(day, hour);
                      return (
                        <div
                          key={day}
                          data-testid={`slot-${day}-${hour}`}
                          onMouseDown={() => handleSlotMouseDown(day, hour)}
                          onMouseEnter={() => handleSlotMouseEnter(day, hour)}
                          className={`
                            h-7 rounded cursor-pointer select-none transition-colors
                            ${active
                              ? "bg-primary/80 hover:bg-primary"
                              : "bg-muted hover:bg-primary/20 border border-border"
                            }
                          `}
                        />
                      );
                    })}
                  </div>
                ))}

                <p className="text-xs text-muted-foreground mt-3">
                  {slots.length} slot{slots.length !== 1 ? "s" : ""} selected
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ── Save button ──────────────────────────────────────────────── */}
          <Button
            data-testid="button-save-profile"
            onClick={saveAll}
            disabled={saving}
            className="w-full h-14 text-lg rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
          >
            {saving ? "Saving…" : saved ? "✓ Saved!" : "Save Profile"}
          </Button>

        </motion.div>
      </div>
    </div>
  );
}
