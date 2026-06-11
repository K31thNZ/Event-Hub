// client/src/components/events/AttendeesAndReviews.tsx
//
// Shown on the EventDetails page, below the main content.
//
// Two sections:
//  1. Attendees — shows RSVP'd + attended avatars.
//               Organiser gets a toggle to mark each person as attended.
//  2. Reviews   — star rating + comment form for RSVP'd users,
//               read-only display for everyone.

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Star, CheckCheck, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { User } from "@/hooks/use-auth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AttendeeItem {
  userId:      number;
  status:      string;
  attended:    boolean;
  displayName: string;
  avatarUrl:   string | null;
  profileLink: string | null;
}

interface AttendeesData {
  going:         AttendeeItem[];
  maybe:         AttendeeItem[];
  attendedCount: number;
}

interface ReviewItem {
  id:          number;
  userId:      number;
  rating:      number;
  comment:     string | null;
  displayName: string | null;
  avatarUrl:   string | null;
  createdAt:   string;
}

interface ReviewsData {
  reviews:   ReviewItem[];
  avgRating: number | null;
  count:     number;
}

interface EventLike {
  id:          number;
  organizerId: number;
  date:        Date | string;
}

interface Props {
  event:           EventLike;
  currentUser:     User | null;
  isAuthenticated: boolean;
  myRsvpStatus:    string | null;
}

// ── Star picker ───────────────────────────────────────────────────────────────

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`w-7 h-7 transition-colors ${
              n <= (hover || value)
                ? "fill-amber-400 text-amber-400"
                : "fill-none text-border"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ── StarDisplay (read-only) ────────────────────────────────────────────────────

function StarDisplay({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`${cls} ${n <= rating ? "fill-amber-400 text-amber-400" : "fill-none text-border"}`}
        />
      ))}
    </div>
  );
}

// ── Attendee avatar strip ─────────────────────────────────────────────────────

function AvatarStrip({
  items,
  label,
  isOrganizer,
  eventId,
}: {
  items:       AttendeeItem[];
  label:       string;
  isOrganizer: boolean;
  eventId:     number;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const toggleMutation = useMutation({
    mutationFn: async ({ userId, attended }: { userId: number; attended: boolean }) => {
      const res = await fetch(`/api/events/${eventId}/attendees/${userId}/attended`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ attended }),
      });
      if (!res.ok) throw new Error("Failed to update");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendees", eventId] }),
    onError: () => toast({ title: "Could not update attendance", variant: "destructive" }),
  });

  const visible = expanded ? items : items.slice(0, 12);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <Badge variant="secondary" className="text-xs">{items.length}</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {visible.map(a => (
          <div key={a.userId} className="relative group">
            {a.profileLink ? (
              <Link href={a.profileLink}>
                <Avatar className={`h-10 w-10 cursor-pointer ring-2 transition-all ${
                  a.attended ? "ring-emerald-400" : "ring-border hover:ring-primary"
                }`}>
                  <AvatarImage src={a.avatarUrl ?? ""} />
                  <AvatarFallback className="bg-muted text-xs font-semibold">
                    {(a.displayName ?? "?").substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
            ) : (
              <Avatar className={`h-10 w-10 ring-2 ${a.attended ? "ring-emerald-400" : "ring-border"}`}>
                <AvatarImage src={a.avatarUrl ?? ""} />
                <AvatarFallback className="bg-muted text-xs font-semibold">
                  {(a.displayName ?? "?").substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}

            {/* Attended tick */}
            {a.attended && (
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                <CheckCheck className="w-2.5 h-2.5 text-white" />
              </span>
            )}

            {/* Organiser: click to toggle attended */}
            {isOrganizer && (
              <button
                title={a.attended ? "Mark as not attended" : "Mark as attended"}
                onClick={() => toggleMutation.mutate({ userId: a.userId, attended: !a.attended })}
                disabled={toggleMutation.isPending}
                className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 bg-black/40 flex items-center justify-center transition-opacity"
              >
                <CheckCheck className={`w-4 h-4 ${a.attended ? "text-emerald-300" : "text-white"}`} />
              </button>
            )}

            {/* Name tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-xs rounded-md shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {a.displayName}
            </div>
          </div>
        ))}

        {/* Show more */}
        {items.length > 12 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="h-10 px-3 rounded-full border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center gap-1"
          >
            {expanded
              ? <><ChevronUp className="w-3 h-3" /> Less</>
              : <><ChevronDown className="w-3 h-3" /> +{items.length - 12} more</>
            }
          </button>
        )}
      </div>
    </div>
  );
}

// ── Review form ───────────────────────────────────────────────────────────────

function ReviewForm({
  eventId,
  existingReview,
}: {
  eventId:       number;
  existingReview?: ReviewItem;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [rating,  setRating]  = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [open,    setOpen]    = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/events/${eventId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as any).error ?? "Failed to submit");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews", eventId] });
      toast({ title: "✅ Review saved!", description: "Thanks for sharing your experience." });
      setOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Couldn't save review", description: err.message, variant: "destructive" });
    },
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 px-4 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
      >
        <Star className="w-4 h-4" />
        {existingReview ? "Edit your review" : "Leave a review"}
      </button>
    );
  }

  return (
    <Card className="rounded-2xl border-primary/30 border bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <p className="font-semibold text-sm">
          {existingReview ? "Update your review" : "How was the event?"}
        </p>
        <StarPicker value={rating} onChange={setRating} />
        <Textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Tell others what you thought — what worked, what was great, any tips…"
          className="rounded-xl resize-none text-sm min-h-[72px]"
          maxLength={400}
        />
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="rounded-xl gap-1.5"
            disabled={rating === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
            {existingReview ? "Update" : "Submit"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Review card ───────────────────────────────────────────────────────────────

function ReviewCard({ review }: { review: ReviewItem }) {
  return (
    <div className="flex gap-3 py-3 border-b border-border/50 last:border-0">
      <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border">
        <AvatarImage src={review.avatarUrl ?? ""} />
        <AvatarFallback className="text-xs bg-muted font-semibold">
          {(review.displayName ?? "?").substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{review.displayName ?? "Member"}</span>
          <StarDisplay rating={review.rating} />
          <span className="text-xs text-muted-foreground ml-auto">
            {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
          </span>
        </div>
        {review.comment && (
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{review.comment}</p>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function AttendeesAndReviews({ event, currentUser, isAuthenticated, myRsvpStatus }: Props) {
  const isOrganizer = currentUser?.id === event.organizerId;
  const isPastEvent = new Date(event.date) < new Date();
  const canReview   = isAuthenticated && myRsvpStatus != null && isPastEvent;

  const { data: attendeesData, isLoading: attendeesLoading } = useQuery<AttendeesData>({
    queryKey: ["attendees", event.id],
    queryFn: async () => {
      const res = await fetch(`/api/events/${event.id}/attendees`, { credentials: "include" });
      if (!res.ok) return { going: [], maybe: [], attendedCount: 0 };
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery<ReviewsData>({
    queryKey: ["reviews", event.id],
    queryFn: async () => {
      const res = await fetch(`/api/events/${event.id}/reviews`);
      if (!res.ok) return { reviews: [], avgRating: null, count: 0 };
      return res.json();
    },
    staleTime: 60_000,
  });

  const totalRsvps = (attendeesData?.going?.length ?? 0) + (attendeesData?.maybe?.length ?? 0);

  // Nothing to show for unpublished/empty events with no history
  if (!attendeesLoading && totalRsvps === 0 && !reviewsData?.count) return null;

  const myExistingReview = reviewsData?.reviews.find(r => r.userId === currentUser?.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Tabs defaultValue="attendees">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <TabsList className="rounded-xl">
            <TabsTrigger value="attendees" className="gap-1.5 rounded-lg">
              <Users className="w-3.5 h-3.5" />
              Attendees
              {totalRsvps > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{totalRsvps}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reviews" className="gap-1.5 rounded-lg">
              <Star className="w-3.5 h-3.5" />
              Reviews
              {(reviewsData?.count ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{reviewsData!.count}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Average rating pill */}
          {reviewsData?.avgRating && (
            <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              {reviewsData.avgRating} / 5
              <span className="text-muted-foreground font-normal text-xs">({reviewsData.count})</span>
            </div>
          )}
        </div>

        {/* ── Attendees tab ── */}
        <TabsContent value="attendees">
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="p-5 space-y-5">
              {attendeesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Organiser helper text */}
                  {isOrganizer && totalRsvps > 0 && (
                    <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-xl border border-primary/20">
                      <CheckCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <p className="text-xs text-primary">
                        <strong>Organiser view:</strong> hover over an avatar and click the checkmark to confirm someone attended. Confirmed attendees get a green ring and can leave a review.
                      </p>
                    </div>
                  )}

                  {/* Attended confirmed strip */}
                  {isPastEvent && attendeesData && (attendeesData.going.some(a => a.attended) || attendeesData.maybe.some(a => a.attended)) && (
                    <AvatarStrip
                      items={[...attendeesData.going, ...attendeesData.maybe].filter(a => a.attended)}
                      label="✅ Confirmed attended"
                      isOrganizer={isOrganizer}
                      eventId={event.id}
                    />
                  )}

                  {/* Going */}
                  {attendeesData && attendeesData.going.length > 0 && (
                    <AvatarStrip
                      items={attendeesData.going}
                      label="Going"
                      isOrganizer={isOrganizer}
                      eventId={event.id}
                    />
                  )}

                  {/* Maybe */}
                  {attendeesData && attendeesData.maybe.length > 0 && (
                    <AvatarStrip
                      items={attendeesData.maybe}
                      label="Interested"
                      isOrganizer={isOrganizer}
                      eventId={event.id}
                    />
                  )}

                  {totalRsvps === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No RSVPs yet — be the first!</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Reviews tab ── */}
        <TabsContent value="reviews">
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="p-5 space-y-4">

              {/* Write/edit review — only past event + RSVPd users */}
              {canReview && (
                <ReviewForm eventId={event.id} existingReview={myExistingReview} />
              )}
              {!isAuthenticated && isPastEvent && (
                <p className="text-xs text-center text-muted-foreground py-2">
                  <a href="/sign-in" className="text-primary hover:underline">Sign in</a> and RSVP to leave a review.
                </p>
              )}
              {isAuthenticated && !myRsvpStatus && isPastEvent && (
                <p className="text-xs text-center text-muted-foreground py-2">
                  You need to have RSVPd to this event to leave a review.
                </p>
              )}
              {!isPastEvent && (
                <p className="text-xs text-center text-muted-foreground py-2">
                  Reviews can be left once the event has taken place.
                </p>
              )}

              {reviewsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (reviewsData?.reviews.length ?? 0) > 0 ? (
                <div>
                  {reviewsData!.reviews.map(review => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No reviews yet.</p>
                  {canReview && <p className="text-xs mt-1">Be the first to share your experience.</p>}
                </div>
              )}

            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
