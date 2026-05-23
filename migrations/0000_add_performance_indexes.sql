CREATE TABLE "curator_picks" (
	"id" serial PRIMARY KEY NOT NULL,
	"curator_id" integer NOT NULL,
	"curator_name" text NOT NULL,
	"curator_avatar_url" text,
	"curator_specialty" text DEFAULT 'Events' NOT NULL,
	"week_of" timestamp with time zone NOT NULL,
	"intro" text NOT NULL,
	"event_ids" integer[] NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizer_id" integer NOT NULL,
	"group_id" integer,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text DEFAULT 'social' NOT NULL,
	"category2" text,
	"date" timestamp with time zone NOT NULL,
	"venue_address" text NOT NULL,
	"venue_city" text NOT NULL,
	"location_name" text,
	"lat" real,
	"lng" real,
	"image_url" text,
	"published" boolean DEFAULT true NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"recurrence" text,
	"recurrence_day" integer,
	"recurrence_until" timestamp with time zone,
	"parent_event_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_url" text,
	"embedding" vector(768)
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"owner_user_id" integer NOT NULL,
	"category" text DEFAULT 'social' NOT NULL,
	"image_url" text,
	"banner_url" text,
	"visibility" text DEFAULT 'public' NOT NULL,
	"membership_type" text DEFAULT 'open' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "order_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"ticket_type_id" integer NOT NULL,
	"quantity" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"attendee_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"status" text NOT NULL,
	"total_amount" integer NOT NULL,
	"attendee_name" text NOT NULL,
	"attendee_email" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rsvps" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"status" text NOT NULL,
	"source" text DEFAULT 'telegram',
	"source_chat_id" integer,
	"source_chat_title" text,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "spark_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"spark_id" integer NOT NULL,
	"responder_id" integer NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sparks" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer NOT NULL,
	"sender_display_name" text,
	"sender_avatar_url" text,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"activity" text NOT NULL,
	"location" text NOT NULL,
	"meet_time" timestamp with time zone NOT NULL,
	"filter_interests" text[],
	"filter_languages" text[],
	"filter_metro_line" text,
	"max_respondents" integer DEFAULT 5 NOT NULL,
	"lat" real,
	"lng" real,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"quantity" integer NOT NULL,
	"max_per_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_tickets" ADD CONSTRAINT "order_tickets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_tickets" ADD CONSTRAINT "order_tickets_ticket_type_id_ticket_types_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spark_responses" ADD CONSTRAINT "spark_responses_spark_id_sparks_id_fk" FOREIGN KEY ("spark_id") REFERENCES "public"."sparks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_published_date_idx" ON "events" USING btree ("published","date");--> statement-breakpoint
CREATE INDEX "events_category_idx" ON "events" USING btree ("category");--> statement-breakpoint
CREATE INDEX "events_venue_city_idx" ON "events" USING btree ("venue_city");--> statement-breakpoint
CREATE INDEX "events_organizer_idx" ON "events" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "events_group_idx" ON "events" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "events_date_idx" ON "events" USING btree ("date");--> statement-breakpoint
CREATE INDEX "group_members_group_idx" ON "group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_members_user_idx" ON "group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "groups_owner_idx" ON "groups" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "groups_status_idx" ON "groups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_tickets_order_idx" ON "order_tickets" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_tickets_ticket_type_idx" ON "order_tickets" USING btree ("ticket_type_id");--> statement-breakpoint
CREATE INDEX "orders_attendee_idx" ON "orders" USING btree ("attendee_id");--> statement-breakpoint
CREATE INDEX "orders_event_status_idx" ON "orders" USING btree ("event_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "rsvps_event_user" ON "rsvps" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "rsvps_user_idx" ON "rsvps" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rsvps_event_status_idx" ON "rsvps" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "spark_responses_spark_idx" ON "spark_responses" USING btree ("spark_id");--> statement-breakpoint
CREATE INDEX "spark_responses_responder_idx" ON "spark_responses" USING btree ("responder_id");--> statement-breakpoint
CREATE INDEX "sparks_sender_idx" ON "sparks" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "sparks_status_idx" ON "sparks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sparks_expires_at_idx" ON "sparks" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ticket_types_event_idx" ON "ticket_types" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");