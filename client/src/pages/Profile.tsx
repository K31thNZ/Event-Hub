import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Bell, Calendar, Camera, Pencil, Check, X } from "lucide-react";
import { motion } from "framer-motion";
import { EVENT_CATEGORIES } from "@shared/categories";
import { TelegramConnect } from "@/components/TelegramConnect";

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "https://auth.expatevents.org";

// ── Cloudinary unsigned upload ─────────────────────────────────────────────
// Set these in your .env / Render environment variables:
//   VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
//   VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
//
// To set up: cloudinary.com → Settings → Upload → Upload presets → Add unsigned preset
const CLOUDINARY_CLOUD   = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? "";
const CLOUDINARY_PRESET  = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? "";

async function uploadImageToCloudinary(file: File): Promise<string> {
  if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) {
    throw new Error("Cloudinary not configured — set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET");
  }
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_PRESET);
  form.append("folder", "expatevents/avatars");

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Image upload failed");
  const data = await res.json();
  return data.secure_url as string;
}

const CATEGORY_ICONS: Record<string, string> = {
  networking: "🔗", tech: "💻", culture: "🎨", food: "🍔",
  sports: "⚽", music: "🎵", language: "🌍", outdoor: "🏕️",
  games: "🎮", business: "💼", wellness: "🧘", family: "👨‍👩‍👧",
  social: "🤝", volunteering: "🙌", other: "📌",
};

const DAYS  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 8);

type Slot = { day: number; hour: number };

export default function Profile() {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();

  const [interests,    setInterests]    = useState<string[]>([]);
  const [slots,        setSlots]        = useState<Slot[]>([]);
  const [displayName,  setDisplayName]  = useState("");
  const [avatarUrl,    setAvatarUrl]    = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile,   setAvatarFile]   = useState<File | null>(null);

  const [editingName,  setEditingName]  = useState(false);
  const [nameInput,    setNameInput]    = useState("");

  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError,  setAvatarError]  = useState<string | null>(null);

  const [isMouseDown,  setIsMouseDown]  = useState(false);
  const [dragMode,     setDragMode]     = useState<"add" | "remove">("add");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setInterests(user.interests ?? []);
    setDisplayName(user.displayName ?? user.username ?? "");
    setNameInput(user.displayName ?? user.username ?? "");
    setAvatarUrl(user.avatarUrl ?? "");

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

  // ── Avatar file selection ──────────────────────────────────────────────
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Image must be under 5 MB");
      return;
    }
    setAvatarError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const cancelAvatarChange = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Save all ───────────────────────────────────────────────────────────
  const saveAll = async () => {
    setSaving(true);
    try {
      let finalAvatarUrl = avatarUrl;

      // Upload new avatar if one was selected
      if (avatarFile) {
        setUploadingAvatar(true);
        try {
          finalAvatarUrl = await uploadImageToCloudinary(avatarFile);
          setAvatarUrl(finalAvatarUrl);
          setAvatarPreview(null);
          setAvatarFile(null);
        } catch (err: any) {
          setAvatarError(err.message ?? "Upload failed");
          setSaving(false);
          setUploadingAvatar(false);
          return;
        }
        setUploadingAvatar(false);
      }

      await Promise.all([
        // Save interests
        fetch(`${AUTH_URL}/api/user/interests`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ interests }),
        }),
        // Save availability
        fetch(`${AUTH_URL}/api/availability`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ slots }),
        }),
        // Save profile (displayName + avatarUrl)
        fetch(`${AUTH_URL}/api/user/profile`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            displayName: displayName.trim() || undefined,
            avatarUrl: finalAvatarUrl || undefined,
          }),
        }),
      ]);

      // Refresh cached user so Navbar and other components update immediately
      queryClient.invalidateQueries({ queryKey: ["auth-user"] });

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setSaving(false);
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

  const initials = (displayName || user.username || "U").substring(0, 2).toUpperCase();
  const currentAvatar = avatarPreview ?? avatarUrl;

  return (
    <div
      className="min-h-screen bg-muted/20 py-12 px-4 sm:px-6 lg:px-8"
      onMouseUp={() => setIsMouseDown(false)}
      onMouseLeave={() => setIsMouseDown(false)}
    >
      <div className="max-w-3xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">

          {/* ── Identity ─────────────────────────────────────────────────── */}
          <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
            <div className="bg-primary/5 px-8 py-4 border-b border-border/50 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold font-display">Your Profile</h2>
            </div>
            <CardContent className="p-8">
              <div className="flex items-start gap-6 flex-wrap sm:flex-nowrap">

                {/* Avatar with upload button */}
                <div className="relative shrink-0">
                  <Avatar className="h-24 w-24 ring-2 ring-border">
                    <AvatarImage src={currentAvatar} />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl">{initials}</AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                    title="Change photo"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>

                <div className="flex-1 min-w-0 space-y-3">
                  {/* Editable display name */}
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        className="h-10 rounded-xl text-lg font-bold max-w-xs"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === "Enter") { setDisplayName(nameInput); setEditingName(false); }
                          if (e.key === "Escape") { setNameInput(displayName); setEditingName(false); }
                        }}
                      />
                      <button onClick={() => { setDisplayName(nameInput); setEditingName(false); }}
                        className="text-primary hover:text-primary/80">
                        <Check className="w-5 h-5" />
                      </button>
                      <button onClick={() => { setNameInput(displayName); setEditingName(false); }}
                        className="text-muted-foreground hover:text-foreground">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold truncate">{displayName || user.username}</h1>
                      <button onClick={() => setEditingName(true)}
                        className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                        title="Edit name">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {user.email && <p className="text-muted-foreground text-sm">{user.email}</p>}

                  <div className="flex gap-2 flex-wrap">
                    {user.isExpatMember && <Badge variant="secondary">ExpatEvents</Badge>}
                    {user.isGamesMember && <Badge variant="secondary">Games in English</Badge>}
                    {user.role === "admin" && <Badge>Admin</Badge>}
                  </div>

                  {/* Avatar preview actions */}
                  {avatarPreview && (
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-sm text-muted-foreground">New photo selected — save to apply</span>
                      <button onClick={cancelAvatarChange}
                        className="text-xs text-destructive hover:underline">Cancel</button>
                    </div>
                  )}
                  {avatarError && (
                    <p className="text-sm text-destructive">{avatarError}</p>
                  )}
                  {!CLOUDINARY_CLOUD && (
                    <p className="text-xs text-muted-foreground">
                      Image upload requires <code>VITE_CLOUDINARY_CLOUD_NAME</code> and{" "}
                      <code>VITE_CLOUDINARY_UPLOAD_PRESET</code> environment variables.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Telegram ─────────────────────────────────────────────────── */}
          <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
            <div className="bg-primary/5 px-8 py-4 border-b border-border/50 flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold font-display">Telegram Notifications</h2>
            </div>
            <CardContent className="p-8">
              <TelegramConnect
                connected={!!user.telegramId}
                onUnlinked={() => queryClient.invalidateQueries({ queryKey: ["auth-user"] })}
              />
            </CardContent>
          </Card>

          {/* ── Interests ────────────────────────────────────────────────── */}
          <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
            <div className="bg-primary/5 px-8 py-4 border-b border-border/50">
              <h2 className="text-xl font-bold font-display">Your Interests</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Select the categories you want to receive notifications for
              </p>
            </div>
            <CardContent className="p-8">
              <div className="flex flex-wrap gap-3">
                {EVENT_CATEGORIES.map(cat => {
                  const active = interests.includes(cat.value);
                  return (
                    <button
                      key={cat.value}
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
                <p className="text-sm text-muted-foreground mt-4">
                  Select at least one interest to receive targeted notifications.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── Availability grid ─────────────────────────────────────────── */}
          <Card className="rounded-3xl border-border/60 shadow-lg overflow-hidden">
            <div className="bg-primary/5 px-8 py-4 border-b border-border/50 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <h2 className="text-xl font-bold font-display">Weekly Availability</h2>
                <p className="text-sm text-muted-foreground">
                  Click or drag to mark when you're free. Organisers use this to plan events.
                </p>
              </div>
            </div>
            <CardContent className="p-6 overflow-x-auto">
              <div className="min-w-[520px]">
                <div className="grid grid-cols-8 gap-1 mb-1">
                  <div />
                  {DAYS.map(d => (
                    <div key={d} className="text-xs font-medium text-center text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
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

          {/* ── Save ─────────────────────────────────────────────────────── */}
          <Button
            onClick={saveAll}
            disabled={saving || uploadingAvatar}
            className="w-full h-14 text-lg rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
          >
            {uploadingAvatar ? "Uploading photo…" : saving ? "Saving…" : saved ? "✓ Saved!" : "Save Profile"}
          </Button>

        </motion.div>
      </div>
    </div>
  );
}
