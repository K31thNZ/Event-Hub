-- The rsvps.user_id column references meh-auth user IDs (external service).
-- There is no local "users" table in Event-Hub, so the FK is invalid and must be dropped.
-- This migration is safe to run multiple times (IF EXISTS guard).
ALTER TABLE "rsvps" DROP CONSTRAINT IF EXISTS "rsvps_user_id_fkey";
