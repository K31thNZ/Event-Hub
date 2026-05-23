import { sql } from "drizzle-orm";
import {
  jsonb, pgTable, text, serial, integer, boolean, timestamp, varchar, real,
  uniqueIndex, index, customType,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
export * from "./models/auth";

// ── Custom vector type (pgvector) ─────────────────────────────────────────
const vector = customType<{
  data: number[] | null;
  driverData: string | null;
}>({
  dataType() {
    return "vector(768)";
  },
});

// ── NOTE ──────────────────────────────────────────────────────────────────
// There is NO local users table. User records live in meh-auth.
// All "userId" / "organizerId" / "attendeeId" / "ownerUserId" / "curatorId"
// columns store the meh-auth integer user ID as a plain integer column —
// no FK constraint to a local users table.
// ─────────────────────────────────────────────────────────────────────────

// ── Groups (must be defined before events) ────────────────────────────────
export const groups = pgTable("groups", {
  id:             serial("id").primaryKey(),
  slug:           text("slug").notNull().unique(),
  name:           text("name").notNull(),
  description:    text("description").notNull().default(""),
  ownerUserId:    integer("owner_user_id").notNull(),   // meh-auth user id, no FK
  category:       text("category").notNull().default("social"),
  imageUrl:       text("image_url"),
  bannerUrl:      text("banner_url"),
  visibility:     text("visibility").notNull().default("public"),
  membershipType: text("membership_type").notNull().default("open"),
  status:         text("status").notNull().default("active"),
  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  ownerIdx:   index("groups_owner_idx").on(table.ownerUserId),
  statusIdx:  index("groups_status_idx").on(table.status),
}));

// ── Events ────────────────────────────────────────────────────────────────
export const events = pgTable("events", {
  id:           serial("id").primaryKey(),
  organizerId:  integer("organizer_id").notNull(),   // meh-auth user id, no FK
  groupId:      integer("group_id").references(() => groups.id, { onDelete: "set null" }),
  title:        text("title").notNull(),
  description:  text("description").notNull(),
  category:     text("category").notNull().default("social"),
  category2:    text("category2"),
  date:         timestamp("date", { withTimezone: true }).notNull(),
  venueAddress: text("venue_address").notNull(),
  venueCity:    text("venue_city").notNull(),
  locationName: text("location_name"),
  lat:          real("lat"),
  lng:          real("lng"),
  imageUrl:     text("image_url"),
  published:    boolean("published").default(true).notNull(),
  isPrivate:    boolean("is_private").default(false).notNull(),
  recurrence:      text("recurrence"),
  recurrenceDay:   integer("recurrence_day"),
  recurrenceUntil: timestamp("recurrence_until", { withTimezone: true }),
  parentEventId:   integer("parent_event_id"),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  sourceUrl:    text("source_url"),
  // 🌟 AI embeddings for vector search
  embedding:    vector("embedding"),
}, (table) => ({
  // Core listing queries — published + date ordering used on every page load
  publishedDateIdx:   index("events_published_date_idx").on(table.published, table.date),
  // Category filter (very common on Home page)
  categoryIdx:        index("events_category_idx").on(table.category),
  // City filter
  cityIdx:            index("events_venue_city_idx").on(table.venueCity),
  // Organiser dashboard: "my events"
  organizerIdx:       index("events_organizer_idx").on(table.organizerId),
  // Group event listing
  groupIdx:           index("events_group_idx").on(table.groupId),
  // Live map / upcoming queries ordered by date
  dateIdx:            index("events_date_idx").on(table.date),
}));

// ── Ticket types ──────────────────────────────────────────────────────────
export const ticketTypes = pgTable("ticket_types", {
  id:          serial("id").primaryKey(),
  eventId:     integer("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  name:        text("name").notNull(),
  price:       integer("price").notNull(),
  quantity:    integer("quantity").notNull(),
  maxPerOrder: integer("max_per_order").notNull(),
}, (table) => ({
  eventIdx: index("ticket_types_event_idx").on(table.eventId),
}));

// ── Orders ────────────────────────────────────────────────────────────────
export const orders = pgTable("orders", {
  id:            serial("id").primaryKey(),
  attendeeId:    integer("attendee_id").notNull(),   // meh-auth user id, no FK
  eventId:       integer("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  status:        text("status").notNull(),
  totalAmount:   integer("total_amount").notNull(),
  attendeeName:  text("attendee_name").notNull(),
  attendeeEmail: text("attendee_email").notNull(),
  notes:         text("notes"),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Attendee order history
  attendeeIdx:      index("orders_attendee_idx").on(table.attendeeId),
  // Event ticket-buyers query
  eventStatusIdx:   index("orders_event_status_idx").on(table.eventId, table.status),
}));

export const orderTickets = pgTable("order_tickets", {
  id:           serial("id").primaryKey(),
  orderId:      integer("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  ticketTypeId: integer("ticket_type_id").references(() => ticketTypes.id, { onDelete: "cascade" }).notNull(),
  quantity:     integer("quantity").notNull(),
}, (table) => ({
  orderIdx:      index("order_tickets_order_idx").on(table.orderId),
  ticketTypeIdx: index("order_tickets_ticket_type_idx").on(table.ticketTypeId),
}));

// ── Curator picks ─────────────────────────────────────────────────────────
export const curatorPicks = pgTable("curator_picks", {
  id:               serial("id").primaryKey(),
  curatorId:        integer("curator_id").notNull(),   // meh-auth user id, no FK
  curatorName:      text("curator_name").notNull(),
  curatorAvatarUrl: text("curator_avatar_url"),
  curatorSpecialty: text("curator_specialty").notNull().default("Events"),
  weekOf:           timestamp("week_of", { withTimezone: true }).notNull(),
  intro:            text("intro").notNull(),
  eventIds:         integer("event_ids").array().notNull(),
  published:        boolean("published").default(false).notNull(),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Group members ─────────────────────────────────────────────────────────
export const groupMembers = pgTable("group_members", {
  id:          serial("id").primaryKey(),
  groupId:     integer("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  userId:      integer("user_id").notNull(),   // meh-auth user id, no FK
  role:        text("role").notNull().default("member"),
  status:      text("status").notNull().default("active"),
  displayName: text("display_name"),
  avatarUrl:   text("avatar_url"),
  joinedAt:    timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Group member roster
  groupIdx:  index("group_members_group_idx").on(table.groupId),
  // User's group memberships
  userIdx:   index("group_members_user_idx").on(table.userId),
}));

// ── RSVPs ─────────────────────────────────────────────────────────────────
export const rsvps = pgTable("rsvps", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull(),   // meh-auth user id, no FK
  eventId:   integer("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  status:    text("status").notNull(),
  source:    text("source").default("telegram"),
  sourceChatId:    integer("source_chat_id"),
  sourceChatTitle: text("source_chat_title"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  // Unique RSVP per (event, user) — also serves as the primary lookup index
  uniq:     uniqueIndex("rsvps_event_user").on(table.eventId, table.userId),
  // User's RSVP history
  userIdx:  index("rsvps_user_idx").on(table.userId),
  // rsvp-summaries batch query: GROUP BY event_id, status
  eventStatusIdx: index("rsvps_event_status_idx").on(table.eventId, table.status),
}));

// ── Relations ─────────────────────────────────────────────────────────────
export const eventsRelations = relations(events, ({ one, many }) => ({
  group:       one(groups, { fields: [events.groupId],     references: [groups.id] }),
  ticketTypes: many(ticketTypes),
  orders:      many(orders),
  rsvps:       many(rsvps),
}));

export const ticketTypesRelations = relations(ticketTypes, ({ one }) => ({
  event: one(events, { fields: [ticketTypes.eventId], references: [events.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  event:    one(events, { fields: [orders.eventId], references: [events.id] }),
  tickets:  many(orderTickets),
}));

export const orderTicketsRelations = relations(orderTickets, ({ one }) => ({
  order:      one(orders,      { fields: [orderTickets.orderId],      references: [orders.id] }),
  ticketType: one(ticketTypes, { fields: [orderTickets.ticketTypeId], references: [ticketTypes.id] }),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
  events:  many(events),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
}));

export const rsvpsRelations = relations(rsvps, ({ one }) => ({
  event: one(events, { fields: [rsvps.eventId], references: [events.id] }),
}));

// ═══════════════════════════════════════════════════════════════════════════
// SPARKS — Stores sender info directly, no FK to users
// ═══════════════════════════════════════════════════════════════════════════

export const sparks = pgTable("sparks", {
  id:           serial("id").primaryKey(),
  senderId:     integer("sender_id").notNull(),   // meh-auth user id, no FK

  senderDisplayName: text("sender_display_name"),
  senderAvatarUrl:   text("sender_avatar_url"),

  title:        text("title").notNull(),
  description:  text("description").notNull().default(""),
  activity:     text("activity").notNull(),
  location:     text("location").notNull(),
  meetTime:     timestamp("meet_time", { withTimezone: true }).notNull(),

  filterInterests:   text("filter_interests").array(),
  filterLanguages:   text("filter_languages").array(),
  filterMetroLine:   text("filter_metro_line"),
  maxRespondents:    integer("max_respondents").notNull().default(5),

  lat:          real("lat"),
  lng:          real("lng"),

  status:       text("status").notNull().default("pending"),
  expiresAt:    timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  senderIdx:    index("sparks_sender_idx").on(table.senderId),
  statusIdx:    index("sparks_status_idx").on(table.status),
  expiresAtIdx: index("sparks_expires_at_idx").on(table.expiresAt),
}));

export const sparkResponses = pgTable("spark_responses", {
  id:          serial("id").primaryKey(),
  sparkId:     integer("spark_id").notNull().references(() => sparks.id, { onDelete: "cascade" }),
  responderId: integer("responder_id").notNull(),   // meh-auth user id, no FK
  message:     text("message"),
  status:      text("status").notNull().default("pending"),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  sparkIdx:     index("spark_responses_spark_idx").on(table.sparkId),
  responderIdx: index("spark_responses_responder_idx").on(table.responderId),
}));

export const sparksRelations = relations(sparks, ({ many }) => ({
  responses: many(sparkResponses),
}));

export const sparkResponsesRelations = relations(sparkResponses, ({ one }) => ({
  spark: one(sparks, { fields: [sparkResponses.sparkId], references: [sparks.id] }),
}));

// ── Zod insert schemas ────────────────────────────────────────────────────
export const insertEventSchema = createInsertSchema(events, {
  organizerId: z.number(),
  date: z.coerce.date(),
}).omit({ id: true, createdAt: true }).extend({
  ticketTypes: z.array(z.object({
    name: z.string(),
    price: z.number(),
    quantity: z.number(),
    maxPerOrder: z.number(),
  })).optional(),
});

export const insertOrderSchema = createInsertSchema(orders, {
  attendeeId: z.number(),
  eventId: z.number(),
  totalAmount: z.number(),
  status: z.string().default("pending"),
}).omit({ id: true, createdAt: true });

export const insertOrderTicketSchema = createInsertSchema(orderTickets, {
  orderId: z.number(),
  ticketTypeId: z.number(),
}).omit({ id: true });

export const insertCuratorPicksSchema = createInsertSchema(curatorPicks, {
  curatorId: z.number(),
  weekOf: z.coerce.date(),
  eventIds: z.array(z.number()),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertGroupSchema = createInsertSchema(groups, {
  ownerUserId: z.number(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertGroupMemberSchema = createInsertSchema(groupMembers, {
  groupId: z.number(),
  userId: z.number(),
}).omit({ id: true, joinedAt: true });

export const insertRsvpSchema = createInsertSchema(rsvps, {
  userId:  z.number(),
  eventId: z.number(),
  status:  z.enum(["going", "maybe", "no"]),
}).omit({ id: true, updatedAt: true });

// ── Types ─────────────────────────────────────────────────────────────────
export type Event        = typeof events.$inferSelect;
export type TicketType   = typeof ticketTypes.$inferSelect;
export type Order        = typeof orders.$inferSelect;
export type OrderTicket  = typeof orderTickets.$inferSelect;
export type CuratorPick  = typeof curatorPicks.$inferSelect;
export type Group        = typeof groups.$inferSelect;
export type GroupMember  = typeof groupMembers.$inferSelect;
export type Spark        = typeof sparks.$inferSelect;
export type SparkResponse = typeof sparkResponses.$inferSelect;

export type EventWithTickets    = Event & { ticketTypes: TicketType[] };
export type CuratorPickWithEvents = CuratorPick & { events: EventWithTickets[] };
export type OrderWithDetails    = Order & {
  event: Event;
  tickets: (OrderTicket & { ticketType: TicketType })[];
};
export type GroupWithMeta = Group & {
  memberCount: number;
  currentUserRole: "owner" | "moderator" | "member" | null;
  currentUserStatus: string | null;
};
export type GroupWithDetails = Group & {
  members: GroupMember[];
  events: EventWithTickets[];
  memberCount: number;
  currentUserRole: "owner" | "moderator" | "member" | null;
};

// ── Request types ─────────────────────────────────────────────────────────
export type CreateEventRequest = {
  organizerId?: number;
  groupId?: number | null;
  title: string;
  description: string;
  category: string;
  category2?: string | null;
  date: Date | string;
  venueAddress: string;
  venueCity: string;
  locationName?: string | null;
  lat?: number | null;
  lng?: number | null;
  imageUrl?: string | null;
  published?: boolean;
  isPrivate?: boolean;
  recurrence?: "weekly" | "biweekly" | "monthly" | null;
  recurrenceUntil?: Date | string | null;
  ticketTypes: { name: string; price: number; quantity: number; maxPerOrder: number }[];
};

export type UpdateEventRequest = Partial<Omit<CreateEventRequest, "organizerId">>;

export type CreateOrderRequest = {
  attendeeId?: number;
  eventId: number;
  attendeeName: string;
  attendeeEmail: string;
  notes?: string | null;
  tickets: { ticketTypeId: number; quantity: number }[];
};

export type CreateGroupRequest = {
  name: string;
  slug: string;
  description?: string;
  category: string;
  imageUrl?: string | null;
  bannerUrl?: string | null;
  visibility?: "public" | "private";
  membershipType?: "open" | "invite_only";
};
