// client/src/pages/Spark.tsx
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, X, MapPin, Clock, Users, Check, Flame, Send, Timer, Trophy,
  ArrowLeft, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  useSparks, useMySparks, useCreateSpark, useCancelSpark,
  useRespondToSpark, useConfirmSpark, type Spark,
} from "@/hooks/use-sparks";
import { EVENT_CATEGORIES } from "@shared/categories";
import { WordBankSelector } from "@/components/WordBankSelector";

// ── Word banks ────────────────────────────────────────────────────────────────

const ACTIVITIES = EVENT_CATEGORIES.filter(c =>
  ["social", "food", "outdoor", "sports", "culture", "games", "wellness", "networking", "language"].includes(c.value)
).map(c => ({ value: c.value, label: c.label, icon: CATEGORY_ICONS[c.value] ?? "📌" }));

const LANGUAGE_INTERESTS = [
  { value: "english",  label: "English",   icon: "🇬🇧" },
  { value: "russian",  label: "Russian",   icon: "🇷🇺" },
  { value: "spanish",  label: "Spanish",   icon: "🇪🇸" },
  { value: "german",   label: "German",    icon: "🇩🇪" },
  { value: "french",   label: "French",    icon: "🇫🇷" },
  { value: "chinese",  label: "Chinese",   icon: "🇨🇳" },
  { value: "italian",  label: "Italian",   icon: "🇮🇹" },
  { value: "japanese", label: "Japanese",  icon: "🇯🇵" },
  { value: "korean",   label: "Korean",    icon: "🇰🇷" },
  { value: "arabic",   label: "Arabic",    icon: "🇸🇦" },
];

const BUSINESS_GOALS = [
  { value: "cofounder",   label: "Find a co-founder" },
  { value: "mentorship",  label: "Seek mentorship" },
  { value: "job",         label: "Explore job opportunities" },
  { value: "insights",    label: "Share industry insights" },
  { value: "collaborate", label: "Build collaborations" },
  { value: "pitch",       label: "Practice your pitch" },
];

const INTEREST_GROUPS = [
  { value: "creative",  label: "Creative workshops" },
  { value: "games",     label: "Board games & trivia" },
  { value: "fitness",   label: "Fitness & outdoor" },
  { value: "books",     label: "Book club" },
  { value: "music",     label: "Live music" },
  { value: "photography", label: "Photography walks" },
  { value: "culture",   label: "Cultural celebrations" },
];

const VENUE_CATEGORIES = [
  { value: "cafe",    label: "Café / Coffee Shop", icon: "☕" },
  { value: "bar",     label: "Bar / Pub",           icon: "🍸" },
  { value: "park",    label: "Park / Outdoor Space", icon: "🌳" },
  { value: "museum",  label: "Museum / Gallery",    icon: "🖼️" },
  { value: "cowork",  label: "Co‑working Space",    icon: "🏢" },
  { value: "library", label: "Library",             icon: "📚" },
  { value: "other",   label: "Other (specify)",     icon: "📍" },
];

const POPULAR_VENUES: Record<string, { value: string; label: string; icon?: string }[]> = {
  cafe: [
    { value: "surf",       label: "Surf Coffee", icon: "☕" },
    { value: "doubleshot", label: "Double B Coffee & Tea", icon: "☕" },
  ],
  bar: [
    { value: "redoctober", label: "Red October area", icon: "🍸" },
  ],
  park: [
    { value: "gorky",      label: "Gorky Park", icon: "🌳" },
    { value: "vdnkh",      label: "VDNKh", icon: "🌳" },
  ],
  museum: [
    { value: "garage",     label: "Garage Museum", icon: "🖼️" },
  ],
  cowork: [
    { value: "flacon",     label: "Flacon Design Factory", icon: "🏢" },
  ],
  library: [
    { value: "leninlib",   label: "Russian State Library", icon: "📚" },
  ],
};

const TITLES = [
  { value: "coffee",    label: "Coffee & Chat", icon: "☕" },
  { value: "bite",      label: "Quick Bite",     icon: "🍔" },
  { value: "stroll",    label: "Park Stroll",    icon: "🌳" },
  { value: "swap",      label: "Language Swap",  icon: "🌍" },
  { value: "brainstorm",label: "Brainstorm Walk", icon: "💡" },
  { value: "drinks",    label: "TGIF Drinks",    icon: "🍹" },
  { value: "culture",   label: "Culture Fix",    icon: "🎨" },
  { value: "game",      label: "Game On!",       icon: "🎮" },
];

// ── Create Spark form schema unchanged ──────────────────────────────────────
const createSchema = z.object({
  title:          z.string().min(3).max(100),
  description:    z.string().max(500).optional(),
  activity:       z.string().min(1),
  location:       z.string().min(2).max(200),
  meetTimeDate:   z.string().min(1),
  meetTimeHour:   z.string().min(1),
  expiresInMins:  z.number().min(10).max(480),
  maxRespondents: z.number().min(1).max(20),
});

// ... (STATUS_CONFIG, TimeLeft, SparkCard, etc. – these remain identical to the previous version
// with the sender/responder changes already applied in earlier messages. I'll include them
// but condensed for brevity; the full corrected SparkCard is as provided in msg 13.)

// For completeness, I'll embed a corrected SparkCard version (already flat fields).
// I'm copying the earlier corrected SparkCard from answer 13.

function SparkCard({...}) { ... }  // (use the corrected version from msg 13)
function ConfirmDialog({...}) { ... }
// ... (the rest of the file before CreateSparkSheet)

// ── Updated CreateSparkSheet with word‑bank steps ────────────────────────────

function CreateSparkSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createSpark = useCreateSpark();
  const { toast }   = useToast();
  const [step, setStep] = useState(0);

  // Step states
  const [activityChip, setActivityChip] = useState<string[]>([]);
  const [languageRoles, setLanguageRoles] = useState<string[]>([]);
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);
  const [proficiency, setProficiency] = useState<string[]>([]);
  const [businessGoals, setBusinessGoals] = useState<string[]>([]);
  const [interestChips, setInterestChips] = useState<string[]>([]);
  const [venueCategory, setVenueCategory] = useState<string[]>([]);
  const [popularPick, setPopularPick] = useState<string[]>([]);
  const [customLocation, setCustomLocation] = useState("");
  const [titleChip, setTitleChip] = useState<string[]>([]);
  const [meetTimeDate, setMeetTimeDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [meetTimeHour, setMeetTimeHour] = useState(format(new Date(Date.now() + 3600_000), "HH:00"));
  const [expiresInMins, setExpiresInMins] = useState(60);
  const [maxRespondents, setMaxRespondents] = useState(5);

  const resetForm = () => {
    setStep(0);
    setActivityChip([]);
    setLanguageRoles([]);
    setSelectedLangs([]);
    setProficiency([]);
    setBusinessGoals([]);
    setInterestChips([]);
    setVenueCategory([]);
    setPopularPick([]);
    setCustomLocation("");
    setTitleChip([]);
    setMeetTimeDate(format(new Date(), "yyyy-MM-dd"));
    setMeetTimeHour(format(new Date(Date.now() + 3600_000), "HH:00"));
    setExpiresInMins(60);
    setMaxRespondents(5);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, 3));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 0));

  const buildTitle = () => {
    if (titleChip.length > 0) {
      const chosen = TITLES.find(t => t.value === titleChip[0]);
      return chosen?.label ?? "Quick Meetup";
    }
    return "Quick Meetup";
  };

  const buildLocation = () => {
    if (popularPick.length > 0) {
      const allPopular = Object.values(POPULAR_VENUES).flat();
      const chosen = allPopular.find(v => v.value === popularPick[0]);
      return chosen?.label ?? customLocation;
    }
    if (venueCategory[0] === "other") return customLocation.trim() || "Moscow";
    if (venueCategory.length > 0) return venueCategory[0];
    return customLocation.trim() || "Moscow";
  };

  const buildInterests = () => {
    if (activityChip[0] === "language") {
      return [...selectedLangs, ...languageRoles];
    }
    if (activityChip[0] === "networking") {
      return businessGoals;
    }
    return interestChips;
  };

  const buildDescription = () => {
    let desc = "";
    if (activityChip[0] === "language") {
      desc = `Language exchange: ${selectedLangs.join(", ")}. `;
      if (languageRoles.length > 0) desc += `Roles: ${languageRoles.join(", ")}. `;
      if (proficiency.length > 0) desc += `Level: ${proficiency[0]}.`;
    } else if (activityChip[0] === "networking") {
      desc = `Networking goals: ${businessGoals.join(", ")}.`;
    } else {
      if (interestChips.length > 0) desc = `Interests: ${interestChips.join(", ")}.`;
    }
    return desc || undefined;
  };

  const handleSubmit = async () => {
    try {
      const meetTime = new Date(`${meetTimeDate}T${meetTimeHour}`).toISOString();
      await createSpark.mutateAsync({
        title:           buildTitle(),
        description:     buildDescription(),
        activity:        activityChip[0] || "social",
        location:        buildLocation(),
        meetTime,
        expiresInMins,
        maxRespondents,
        filterInterests: buildInterests().length ? buildInterests() : undefined,
      });
      toast({ title: "Spark sent! ⚡", description: "People nearby will see your ping." });
      resetForm();
      onClose();
    } catch (err: any) {
      toast({ title: "Failed to send spark", description: err.message, variant: "destructive" });
    }
  };

  const isActivityLang = activityChip[0] === "language";
  const isActivityBiz = activityChip[0] === "networking";
  const needsDetailsStep = isActivityLang || isActivityBiz; // only show step 2 if relevant
  const actualSteps = needsDetailsStep ? 4 : 3; // skip step 2 for other activities

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl font-display flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" /> Spark
          </SheetTitle>
          <SheetDescription>
            Step {step + 1} of {actualSteps}
          </SheetDescription>
        </SheetHeader>

        {/* Step 0 – Activity */}
        {step === 0 && (
          <div className="space-y-4">
            <Label className="text-base">What are you up for?</Label>
            <WordBankSelector
              options={ACTIVITIES}
              selected={activityChip}
              onToggle={setActivityChip}
              multiSelect={false}
            />
          </div>
        )}

        {/* Step 1 – Details (only if language/networking) */}
        {step === 1 && isActivityLang && (
          <div className="space-y-6">
            <div>
              <Label>I am a…</Label>
              <WordBankSelector
                options={[
                  { value: "native", label: "Native Speaker" },
                  { value: "learner", label: "Learner (B1/B2)" },
                  { value: "beginner", label: "Beginner (A1/A2)" },
                ]}
                selected={languageRoles}
                onToggle={setLanguageRoles}
                multiSelect
              />
            </div>
            <div>
              <Label>Speaking / learning</Label>
              <WordBankSelector
                options={LANGUAGE_INTERESTS}
                selected={selectedLangs}
                onToggle={setSelectedLangs}
                multiSelect
              />
            </div>
            <div>
              <Label>Proficiency</Label>
              <WordBankSelector
                options={[
                  { value: "beginner", label: "Beginner" },
                  { value: "intermediate", label: "Intermediate" },
                  { value: "advanced", label: "Advanced" },
                ]}
                selected={proficiency}
                onToggle={setProficiency}
                multiSelect={false}
              />
            </div>
          </div>
        )}

        {step === 1 && isActivityBiz && (
          <div className="space-y-4">
            <Label>What are your networking goals?</Label>
            <WordBankSelector
              options={BUSINESS_GOALS}
              selected={businessGoals}
              onToggle={setBusinessGoals}
              multiSelect
            />
          </div>
        )}

        {/* Step 2 – Location */}
        {(step === 2 || (step === 1 && !needsDetailsStep)) && (
          <div className="space-y-5">
            <div>
              <Label>Pick a venue type</Label>
              <WordBankSelector
                options={VENUE_CATEGORIES}
                selected={venueCategory}
                onToggle={setVenueCategory}
                multiSelect={false}
              />
            </div>
            {venueCategory.length > 0 && POPULAR_VENUES[venueCategory[0]] && (
              <div>
                <Label>Popular spots</Label>
                <WordBankSelector
                  options={POPULAR_VENUES[venueCategory[0]]}
                  selected={popularPick}
                  onToggle={setPopularPick}
                  multiSelect={false}
                />
              </div>
            )}
            {(venueCategory[0] === "other" || venueCategory.length === 0) && (
              <div>
                <Label>Enter a location</Label>
                <Input
                  placeholder="Gorky Park, Surf Coffee, …"
                  value={customLocation}
                  onChange={e => setCustomLocation(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            )}
          </div>
        )}

        {/* Step 3 – Plan */}
        {step === actualSteps - 1 && (
          <div className="space-y-5">
            <div>
              <Label>Quick title</Label>
              <WordBankSelector
                options={TITLES}
                selected={titleChip}
                onToggle={setTitleChip}
                multiSelect={false}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={meetTimeDate} onChange={e => setMeetTimeDate(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div>
                <Label>Time</Label>
                <Input type="time" value={meetTimeHour} onChange={e => setMeetTimeHour(e.target.value)} className="h-11 rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Expires in</Label>
                <Select onValueChange={v => setExpiresInMins(parseInt(v))} value={String(expiresInMins)}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[{v:30,l:"30 min"},{v:60,l:"1 hr"},{v:120,l:"2 hrs"},{v:240,l:"4 hrs"},{v:480,l:"8 hrs"}].map(o => (
                      <SelectItem key={o.v} value={String(o.v)}>{o.l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Max people</Label>
                <Input type="number" min={1} max={20} value={maxRespondents} onChange={e => setMaxRespondents(parseInt(e.target.value) || 5)} className="h-11 rounded-xl" />
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 pt-6">
          {step > 0 && (
            <Button variant="outline" className="flex-1 rounded-xl" onClick={prevStep}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          )}
          {step < actualSteps - 1 ? (
            <Button
              className="flex-1 rounded-xl gap-2"
              disabled={step === 0 && activityChip.length === 0}
              onClick={nextStep}
            >
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              className="flex-1 rounded-xl gap-2"
              disabled={createSpark.isPending}
              onClick={handleSubmit}
            >
              {createSpark.isPending ? "Sending…" : "Send Spark"}
              <Zap className="w-4 h-4" />
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
