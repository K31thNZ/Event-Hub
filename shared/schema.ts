import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, serial, integer, boolean, timestamp, varchar, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
export * from "./models/auth";
import { users } from "./models/auth";

// ── Groups (must be defined before events) ────────────────────────────────
export const groups = pgTable("groups", {
  id:             serial("id").primaryKey(),
  slug:           text("slug").notNull().unique(),
  name:           text("name").notNull(),
  description:    text("description").notNull().default(""),
  ownerUserId:    varchar("owner_user_id").notNull().references(() => users.id),
  category:       text("category").notNull().default("social"),
  imageUrl:       text("image_url"),
  bannerUrl:      text("banner_url"),
  visibility:     text("visibility").notNull().default("public"),
  membershipType: text("membership_type").notNull().default("open"),
  status:         text("status").notNull().default("active"),
  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Events ────────────────────────────────────────────────────────────────
export const events = pgTable("events", {
  id:           serial("id").primaryKey(),
  organizerId:  varchar("organizer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  groupId:      integer("group_id").references(() => groups.id, { onDelete: "set null" }),
  title:        text("title").notNull(),
  description:  text("description").notNull(),
  category:     text("category").notNull().default("social"),
  category2:    text("category2"),
  date:         timestamp("date", { withTimezone: true }).notNull(),
  venueAddress: text("venue_address").notNull(),
  venueCity:    text("venue_city").notNull(),
  locationName: text("location_name"),       // 🌟 venue / place name (optional)
  lat:          real("lat"),                 // 🌍 latitude (nullable)
  lng:          real("lng"),                 // 🌍 longitude (nullable)
  imageUrl:     text("image_url"),
  published:    boolean("published").default(true).notNull(),
  isPrivate:    boolean("is_private").default(false).notNull(),
  recurrence:      text("recurrence"),
  recurrenceDay:   integer("recurrence_day"),
  recurrenceUntil: timestamp("recurrence_until", { withTimezone: true }),
  parentEventId:   integer("parent_event_id"),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Ticket types ──────────────────────────────────────────────────────────
export const ticketTypes = pgTable("ticket_types", {
  id:          serial("id").primaryKey(),
  eventId:     integer("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  name:        text("name").notNull(),
  price:       integer("price").notNull(),
  quantity:    integer("quantity").notNull(),
  maxPerOrder: integer("max_per_order").notNull(),
});

// ── Orders ────────────────────────────────────────────────────────────────
export const orders = pgTable("orders", {
  id:            serial("id").primaryKey(),
  attendeeId:    varchar("attendee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventId:       integer("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  status:        text("status").notNull(),
  totalAmount:   integer("total_amount").notNull(),
  attendeeName:  text("attendee_name").notNull(),
  attendeeEmail: text("attendee_email").notNull(),
  notes:         text("notes"),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orderTickets = pgTable("order_tickets", {
  id:           serial("id").primaryKey(),
  orderId:      integer("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  ticketTypeId: integer("ticket_type_id").references(() => ticketTypes.id, { onDelete: "cascade" }).notNull(),
  quantity:     integer("quantity").notNull(),
});

// ── Curator picks ─────────────────────────────────────────────────────────
export const curatorPicks = pgTable("curator_picks", {
  id:               serial("id").primaryKey(),
  curatorId:        varchar("curator_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
  userId:      varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role:        text("role").notNull().default("member"),
  status:      text("status").notNull().default("active"),
  displayName: text("display_name"),
  avatarUrl:   text("avatar_url"),
  joinedAt:    timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Relations (original tables) ───────────────────────────────────────────
export const eventsRelations = relations(events, ({ one, many }) => ({
  organizer:   one(users,  { fields: [events.organizerId], references: [users.id] }),
  group:       one(groups, { fields: [events.groupId],     references: [groups.id] }),
  ticketTypes: many(ticketTypes),
  orders:      many(orders),
}));

export const ticketTypesRelations = relations(ticketTypes, ({ one }) => ({
  event: one(events, { fields: [ticketTypes.eventId], references: [events.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  attendee: one(users,  { fields: [orders.attendeeId], references: [users.id] }),
  event:    one(events, { fields: [orders.eventId],    references: [events.id] }),
  tickets:  many(orderTickets),
}));

export const orderTicketsRelations = relations(orderTickets, ({ one }) => ({
  order:      one(orders,      { fields: [orderTickets.orderId],      references: [orders.id] }),
  ticketType: one(ticketTypes, { fields: [orderTickets.ticketTypeId], references: [ticketTypes.id] }),
}));

export const curatorPicksRelations = relations(curatorPicks, ({ one }) => ({
  curator: one(users, { fields: [curatorPicks.curatorId], references: [users.id] }),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  owner:   one(users, { fields: [groups.ownerUserId], references: [users.id] }),
  members: many(groupMembers),
  events:  many(events),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  user:  one(users,  { fields: [groupMembers.userId],  references: [users.id] }),
}));

// ═══════════════════════════════════════════════════════════════════════════
// SPARKS — No FK to users; stores sender info directly
// ═══════════════════════════════════════════════════════════════════════════

export const sparks = pgTable("sparks", {
  id:           serial("id").primaryKey(),
  senderId:     varchar("sender_id").notNull(),

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

  status:       text("status").notNull().default("pending"),
  expiresAt:    timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sparkResponses = pgTable("spark_responses", {
  id:          serial("id").primaryKey(),
  sparkId:     integer("spark_id").notNull().references(() => sparks.id, { onDelete: "cascade" }),
  responderId: varchar("responder_id").notNull(),
  status:      text("status").notNull().default("pending"),
  message:     text("message"),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sparksRelations = relations(sparks, ({ many }) => ({
  responses: many(sparkResponses),
}));

export const sparkResponsesRelations = relations(sparkResponses, ({ one }) => ({
  spark: one(sparks, { fields: [sparkResponses.sparkId], references: [sparks.id] }),
}));

// ── Inferred types ─────────────────────────────────────────────────────────
export type Spark              = typeof sparks.$inferSelect;
export type SparkResponse      = typeof sparkResponses.$inferSelect;

export type SparkWithResponses = Spark & {
  responses: (SparkResponse & { responder?: { id: string; displayName?: string | null; avatarUrl?: string | null } })[];
  responseCount: number;
  myResponse?: SparkResponse | null;
};

// ── Insert schemas ────────────────────────────────────────────────────────
export const insertEventSchema = createInsertSchema(events, {
  organizerId: z.string(),
  date: z.coerce.date(),
}).omit({ id: true, createdAt: true });

export const insertTicketTypeSchema = createInsertSchema(ticketTypes, {
  eventId: z.number(),
}).omit({ id: true });

export const insertOrderSchema = createInsertSchema(orders, {
  attendeeId: z.string(),
  eventId: z.number(),
  totalAmount: z.number(),
  status: z.string().default("pending"),
}).omit({ id: true, createdAt: true });

export const insertOrderTicketSchema = createInsertSchema(orderTickets, {
  orderId: z.number(),
  ticketTypeId: z.number(),
}).omit({ id: true });

export const insertCuratorPicksSchema = createInsertSchema(curatorPicks, {
  curatorId: z.string(),
  weekOf: z.coerce.date(),
  eventIds: z.array(z.number()),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertGroupSchema = createInsertSchema(groups, {
  ownerUserId: z.string(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertGroupMemberSchema = createInsertSchema(groupMembers, {
  groupId: z.number(),
  userId: z.string(),
}).omit({ id: true, joinedAt: true });

// ── Types ─────────────────────────────────────────────────────────────────
export type Event        = typeof events.$inferSelect;
export type TicketType   = typeof ticketTypes.$inferSelect;
export type Order        = typeof orders.$inferSelect;
export type OrderTicket  = typeof orderTickets.$inferSelect;
export type CuratorPick  = typeof curatorPicks.$inferSelect;
export type Group        = typeof groups.$inferSelect;
export type GroupMember  = typeof groupMembers.$inferSelect;

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
  organizerId: string;
  groupId?: number | null;
  title: string;
  description: string;
  category: string;
  category2?: string | null;
  date: Date | string;
  venueAddress: string;
  venueCity: string;
  locationName?: string | null;   // 🌟 optional venue / place name
  lat?: number | null;            // 🌍 optional latitude
  lng?: number | null;            // 🌍 optional longitude
  imageUrl?: string | null;
  published?: boolean;
  isPrivate?: boolean;
  recurrence?: "weekly" | "biweekly" | "monthly" | null;
  recurrenceUntil?: Date | string | null;
  ticketTypes: { name: string; price: number; quantity: number; maxPerOrder: number }[];
};

export type UpdateEventRequest = Partial<Omit<CreateEventRequest, "organizerId">>;

export type CreateOrderRequest = {
  attendeeId: string;
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
