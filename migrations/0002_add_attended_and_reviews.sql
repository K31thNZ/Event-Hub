-- 0002: Add attended flag to rsvps + event_reviews table
-- attended: set by the organiser to confirm the user actually showed up
-- event_reviews: ratings + comments left by confirmed attendees (or rsvp'd users)

ALTER TABLE "rsvps"
  ADD COLUMN IF NOT EXISTS "attended" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "event_reviews" (
  "id"          serial PRIMARY KEY,
  "event_id"    integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "user_id"     integer NOT NULL,                     -- meh-auth integer user id
  "rating"      integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  "comment"     text,
  "display_name" text,                               -- denormalised at write time
  "avatar_url"  text,                               -- denormalised at write time
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "event_reviews_event_user_unique" UNIQUE ("event_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "event_reviews_event_idx" ON "event_reviews" ("event_id");
CREATE INDEX IF NOT EXISTS "event_reviews_user_idx"  ON "event_reviews" ("user_id");
