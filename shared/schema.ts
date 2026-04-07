import { sql } from "drizzle-orm";
import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
export * from "./models/auth";
import { users } from "./models/auth";

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  organizerId: integer("organizer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().default("social"),
  category2: text("category2"),
  date: timestamp("date", { withTimezone: true }).notNull(),
  venueAddress: text("venue_address").notNull(),
  venueCity: text("venue_city").notNull(),
  imageUrl: text("image_url"),
  published: boolean("published").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ticketTypes = pgTable("ticket_types", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  quantity: integer("quantity").notNull(),
  maxPerOrder: integer("max_per_order").notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  attendeeId: integer("attendee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  status: text("status").notNull(),
  totalAmount: integer("total_amount").notNull(),
  attendeeName: text("attendee_name").notNull(),
  attendeeEmail: text("attendee_email").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orderTickets = pgTable("order_tickets", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  ticketTypeId: integer("ticket_type_id").references(() => ticketTypes.id, { onDelete: "cascade" }).notNull(),
  quantity: integer("quantity").notNull(),
});

export const curatorPicks = pgTable("curator_picks", {
  id: serial("id").primaryKey(),
  curatorId: integer("curator_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  curatorName: text("curator_name").notNull(),
  curatorAvatarUrl: text("curator_avatar_url"),
  curatorSpecialty: text("curator_specialty").notNull().default("Events"),
  weekOf: timestamp("week_of", { withTimezone: true }).notNull(),
  intro: text("intro").notNull(),
  eventIds: integer("event_ids").array().notNull(),
  published: boolean("published").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Relations (unchanged, just using the corrected table definitions)
export const eventsRelations = relations(events, ({ one, many }) => ({
  organizer: one(users, { fields: [events.organizerId], references: [users.id] }),
  ticketTypes: many(ticketTypes),
  orders: many(orders),
}));

export const ticketTypesRelations = relations(ticketTypes, ({ one }) => ({
  event: one(events, { fields: [ticketTypes.eventId], references: [events.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  attendee: one(users, { fields: [orders.attendeeId], references: [users.id] }),
  event: one(events, { fields: [orders.eventId], references: [events.id] }),
  tickets: many(orderTickets),
}));

export const orderTicketsRelations = relations(orderTickets, ({ one }) => ({
  order: one(orders, { fields: [orderTickets.orderId], references: [orders.id] }),
  ticketType: one(ticketTypes, { fields: [orderTickets.ticketTypeId], references: [ticketTypes.id] }),
}));

export const curatorPicksRelations = relations(curatorPicks, ({ one }) => ({
  curator: one(users, { fields: [curatorPicks.curatorId], references: [users.id] }),
}));

// Insert schemas (unchanged)
export const insertEventSchema = createInsertSchema(events, {
  organizerId: z.number(),
  date: z.coerce.date(),
}).omit({ id: true, createdAt: true });

export const insertTicketTypeSchema = createInsertSchema(ticketTypes, {
  eventId: z.number(),
}).omit({ id: true });

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

// Types
export type Event = typeof events.$inferSelect;
export type TicketType = typeof ticketTypes.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderTicket = typeof orderTickets.$inferSelect;
export type CuratorPick = typeof curatorPicks.$inferSelect;

export type EventWithTickets = Event & { ticketTypes: TicketType[] };
export type CuratorPickWithEvents = CuratorPick & { events: EventWithTickets[] };
export type OrderWithDetails = Order & {
  event: Event;
  tickets: (OrderTicket & { ticketType: TicketType })[];
};

export type CreateEventRequest = {
  organizerId: number;
  title: string;
  description: string;
  category: string;
  category2?: string | null;
  date: Date | string;
  venueAddress: string;
  venueCity: string;
  imageUrl?: string | null;
  published?: boolean;
  ticketTypes: { name: string; price: number; quantity: number; maxPerOrder: number }[];
};

export type UpdateEventRequest = Partial<Omit<CreateEventRequest, "organizerId">>;

export type CreateOrderRequest = {
  attendeeId: number;
  eventId: number;
  attendeeName: string;
  attendeeEmail: string;
  notes?: string | null;
  tickets: { ticketTypeId: number; quantity: number }[];
};
