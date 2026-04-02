import { sql } from "drizzle-orm";
import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
export * from "./models/auth";
import { users } from "./models/auth";

// Add isAdmin to users table indirectly by extending the model or just adding it here
// Since models/auth.ts is managed by integration, we should ideally modify it there
// but we can also just use the users table here if we want to add columns.
// However, the integration instructions say "DO NOT modify the auth module files unless absolutely necessary".
// But adding a column is necessary for this feature.

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  organizerId: varchar("organizer_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().default("social"),
  date: timestamp("date").notNull(),
  venueAddress: text("venue_address").notNull(),
  venueCity: text("venue_city").notNull(),
  imageUrl: text("image_url"),
  published: boolean("published").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ticketTypes = pgTable("ticket_types", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id).notNull(),
  name: text("name").notNull(),
  price: integer("price").notNull(), // price in rubles
  quantity: integer("quantity").notNull(),
  maxPerOrder: integer("max_per_order").notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  attendeeId: varchar("attendee_id").notNull(),
  eventId: integer("event_id").references(() => events.id).notNull(),
  status: text("status").notNull(), // 'completed', etc.
  totalAmount: integer("total_amount").notNull(),
  attendeeName: text("attendee_name").notNull(),
  attendeeEmail: text("attendee_email").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orderTickets = pgTable("order_tickets", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  ticketTypeId: integer("ticket_type_id").references(() => ticketTypes.id).notNull(),
  quantity: integer("quantity").notNull(),
});

// Relations
export const eventsRelations = relations(events, ({ one, many }) => ({
  organizer: one(users, {
    fields: [events.organizerId],
    references: [users.id],
  }),
  ticketTypes: many(ticketTypes),
  orders: many(orders),
}));

export const ticketTypesRelations = relations(ticketTypes, ({ one }) => ({
  event: one(events, {
    fields: [ticketTypes.eventId],
    references: [events.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  attendee: one(users, {
    fields: [orders.attendeeId],
    references: [users.id],
  }),
  event: one(events, {
    fields: [orders.eventId],
    references: [events.id],
  }),
  tickets: many(orderTickets),
}));

export const orderTicketsRelations = relations(orderTickets, ({ one }) => ({
  order: one(orders, {
    fields: [orderTickets.orderId],
    references: [orders.id],
  }),
  ticketType: one(ticketTypes, {
    fields: [orderTickets.ticketTypeId],
    references: [ticketTypes.id],
  }),
}));

export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true, organizerId: true });
export const insertTicketTypeSchema = createInsertSchema(ticketTypes).omit({ id: true, eventId: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, attendeeId: true, eventId: true, status: true, totalAmount: true });
export const insertOrderTicketSchema = createInsertSchema(orderTickets).omit({ id: true, orderId: true });

export type Event = typeof events.$inferSelect;
export type TicketType = typeof ticketTypes.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderTicket = typeof orderTickets.$inferSelect;

export type EventWithTickets = Event & { ticketTypes: TicketType[] };
export type OrderWithDetails = Order & { 
  event: Event, 
  tickets: (OrderTicket & { ticketType: TicketType })[] 
};

export type CreateEventRequest = {
  title: string;
  description: string;
  category: string;
  date: Date | string;
  venueAddress: string;
  venueCity: string;
  imageUrl?: string | null;
  published?: boolean;
  ticketTypes: { name: string; price: number; quantity: number; maxPerOrder: number }[];
};

export type UpdateEventRequest = Partial<CreateEventRequest>;

export type CreateOrderRequest = {
  eventId: number;
  attendeeName: string;
  attendeeEmail: string;
  notes?: string | null;
  tickets: { ticketTypeId: number; quantity: number }[];
};
