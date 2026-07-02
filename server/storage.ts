import { db } from "./db";
import {
  events, ticketTypes, orders, orderTickets,
  type Event, type TicketType, type Order, type OrderTicket,
  type EventWithTickets, type OrderWithDetails,
  type CreateEventRequest, type UpdateEventRequest, type CreateOrderRequest,
} from "@shared/schema";
// NOTE: No local "users" table in the Event-Hub DB — users live in meh-auth.
// The User type here is only used for the IStorage interface signature.
import type { User } from "@shared/models/auth";
import { eq, desc, and, gte, ilike, or, sql } from "drizzle-orm";

// ── Internal notification helper ──────────────────────────────────────────
async function notifyNewEvent(event: EventWithTickets): Promise<void> {
  const authUrl = process.env.AUTH_SERVICE_URL ?? "https://auth.expatevents.org";
  const secret  = process.env.SERVICE_SECRET;

  if (!secret) {
    console.warn("[notify] SERVICE_SECRET not set — notifications will fire without auth (dev mode)");
  }

  try {
    const res = await fetch(`${authUrl}/api/notify/event`, {
      method:  "POST",
      headers: {
        "Content-Type":     "application/json",
        "x-service-secret": secret ?? "",
      },
      body: JSON.stringify({
        id:           event.id,
        title:        event.title,
        category:     event.category,
        date:         event.date,
        venueCity:    event.venueCity,
        venueAddress: event.venueAddress,
        locationName: event.locationName ?? undefined,
        description:  event.description,
        imageUrl:     event.imageUrl ?? undefined,
        organizerId:  event.organizerId ?? undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[notify] meh-auth returned ${res.status}: ${body}`);
      return;
    }

    const { sent, inApp } = await res.json();
    console.log(`[notify] Event ${event.id} "${event.title}": ${sent} Telegram, ${inApp} in-app`);
  } catch (err: any) {
    console.error("[notify] Failed to reach meh-auth:", err.message);
  }
}

// ── Storage interface ─────────────────────────────────────────────────────
// All userId / organizerId / attendeeId parameters are numbers (meh-auth integer IDs).
export interface IStorage {
  getEvents(params?: { search?: string; category?: string; city?: string; includePast?: boolean; limit?: number; offset?: number }): Promise<EventWithTickets[]>;
  getEvent(id: number): Promise<EventWithTickets | undefined>;
  getEventsByOrganizer(organizerId: number): Promise<EventWithTickets[]>;
  createEvent(organizerId: number, eventData: CreateEventRequest): Promise<EventWithTickets>;
  updateEvent(id: number, eventData: UpdateEventRequest): Promise<EventWithTickets>;
  deleteEvent(id: number): Promise<void>;
  getOrdersByAttendee(attendeeId: number): Promise<OrderWithDetails[]>;
  getOrder(id: number): Promise<OrderWithDetails | undefined>;
  createOrder(attendeeId: number, orderData: CreateOrderRequest): Promise<OrderWithDetails>;
}

export class DatabaseStorage implements IStorage {

  async deleteEvent(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      const eventOrders = await tx.select().from(orders).where(eq(orders.eventId, id));
      for (const order of eventOrders) {
        await tx.delete(orderTickets).where(eq(orderTickets.orderId, order.id));
      }
      await tx.delete(orders).where(eq(orders.eventId, id));
      await tx.delete(ticketTypes).where(eq(ticketTypes.eventId, id));
      await tx.delete(events).where(eq(events.id, id));
    });
  }

  // ── getEvents — filters pushed down to Postgres, no JS-level scan ──────────
  // Params:
  //   search      — full-text ILIKE on title + description
  //   category    — exact match
  //   city        — ILIKE on venueCity
  //   includePast — if false (default), only events with date >= NOW() are returned
  //   limit       — page size (default 100, max 500)
  //   offset      — pagination offset (default 0)
  async getEvents(params?: {
    search?:      string;
    category?:    string;
    city?:        string;
    includePast?: boolean;
    limit?:       number;
    offset?:      number;
  }): Promise<EventWithTickets[]> {
    const conditions: any[] = [
      // Always filter to published events only
      eq(events.published, true),
    ];

    // By default, exclude past events — keeps the payload small and
    // prevents the list growing forever as old events accumulate.
    if (!params?.includePast) {
      conditions.push(gte(events.date, new Date()));
    }

    if (params?.category) {
      conditions.push(eq(events.category, params.category));
    }

    if (params?.city) {
      conditions.push(ilike(events.venueCity, `%${params.city}%`));
    }

    if (params?.search) {
      const term = `%${params.search}%`;
      conditions.push(
        or(
          ilike(events.title,       term),
          ilike(events.description, term),
        )!
      );
    }

    const limit  = Math.min(params?.limit  ?? 100, 500);
    const offset = params?.offset ?? 0;

    return await db.query.events.findMany({
      where:   and(...conditions),
      with:    { ticketTypes: true },
      orderBy: [desc(events.date)],    // upcoming-first is more useful than creation-first
      limit,
      offset,
    });
  }

  async getEvent(id: number): Promise<EventWithTickets | undefined> {
    return await db.query.events.findFirst({
      where: eq(events.id, id),
      with:  { ticketTypes: true },
    });
  }

  async getEventsByOrganizer(organizerId: number): Promise<EventWithTickets[]> {
    return await db.query.events.findMany({
      where:   eq(events.organizerId, organizerId),
      with:    { ticketTypes: true },
      orderBy: [desc(events.createdAt)],
    });
  }

  async createEvent(organizerId: number, eventData: CreateEventRequest): Promise<EventWithTickets> {
    const createdEvent = await db.transaction(async (tx) => {
      const [newEvent] = await tx.insert(events).values({
        organizerId,
        title:        eventData.title,
        description:  eventData.description,
        category:     eventData.category,
        category2:    eventData.category2 ?? null,
        groupId:      eventData.groupId ?? null,
        date:         new Date(eventData.date),
        venueAddress: eventData.venueAddress,
        venueCity:    eventData.venueCity,
        locationName: eventData.locationName ?? null,
        lat:          eventData.lat ?? null,
        lng:          eventData.lng ?? null,
        imageUrl:     eventData.imageUrl ?? null,
        published:    eventData.published ?? true,
        isPrivate:    eventData.isPrivate ?? false,
        recurrence:       eventData.recurrence ?? null,
        recurrenceUntil:  eventData.recurrenceUntil ? new Date(eventData.recurrenceUntil as string) : null,
        parentEventId:    null,
      }).returning();

      if (eventData.ticketTypes?.length) {
        await tx.insert(ticketTypes).values(
          eventData.ticketTypes.map(t => ({ ...t, eventId: newEvent.id }))
        );
      }

      const full = await tx.query.events.findFirst({
        where: eq(events.id, newEvent.id),
        with:  { ticketTypes: true },
      });
      return full!;
    });

    if (createdEvent.published && !createdEvent.isPrivate && !createdEvent.parentEventId) {
      notifyNewEvent(createdEvent).catch(() => {});
    }

    return createdEvent;
  }

  async updateEvent(id: number, eventData: UpdateEventRequest): Promise<EventWithTickets> {
    return await db.transaction(async (tx) => {
      const updates: Record<string, any> = {};
      if (eventData.title        !== undefined) updates.title        = eventData.title;
      if (eventData.description  !== undefined) updates.description  = eventData.description;
      if (eventData.category     !== undefined) updates.category     = eventData.category;
      if (eventData.category2    !== undefined) updates.category2    = eventData.category2;
      if (eventData.date         !== undefined) updates.date         = new Date(eventData.date as string);
      if (eventData.venueAddress !== undefined) updates.venueAddress = eventData.venueAddress;
      if (eventData.venueCity    !== undefined) updates.venueCity    = eventData.venueCity;
      if (eventData.locationName !== undefined) updates.locationName = eventData.locationName;
      if (eventData.lat          !== undefined) updates.lat          = eventData.lat;
      if (eventData.lng          !== undefined) updates.lng          = eventData.lng;
      if (eventData.imageUrl     !== undefined) updates.imageUrl     = eventData.imageUrl;
      if (eventData.published    !== undefined) updates.published    = eventData.published;
      if (eventData.isPrivate    !== undefined) updates.isPrivate    = eventData.isPrivate;
      if (eventData.recurrence   !== undefined) updates.recurrence   = eventData.recurrence;
      if (eventData.recurrenceUntil !== undefined) {
        updates.recurrenceUntil = eventData.recurrenceUntil
          ? new Date(eventData.recurrenceUntil as string)
          : null;
      }

      if (Object.keys(updates).length) {
        await tx.update(events).set(updates).where(eq(events.id, id));
      }

      if (eventData.ticketTypes !== undefined) {
        await tx.delete(ticketTypes).where(eq(ticketTypes.eventId, id));
        if (eventData.ticketTypes.length) {
          await tx.insert(ticketTypes).values(
            eventData.ticketTypes.map(t => ({ ...t, eventId: id }))
          );
        }
      }

      const updated = await tx.query.events.findFirst({
        where: eq(events.id, id),
        with:  { ticketTypes: true },
      });
      return updated!;
    });
  }

  async getOrdersByAttendee(attendeeId: number): Promise<OrderWithDetails[]> {
    return await db.query.orders.findMany({
      where:   eq(orders.attendeeId, attendeeId),
      with:    { event: true, tickets: { with: { ticketType: true } } },
      orderBy: [desc(orders.createdAt)],
    });
  }

  async getOrder(id: number): Promise<OrderWithDetails | undefined> {
    return await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with:  { event: true, tickets: { with: { ticketType: true } } },
    });
  }

  async createOrder(attendeeId: number, orderData: CreateOrderRequest): Promise<OrderWithDetails> {
    return await db.transaction(async (tx) => {
      let totalAmount = 0;
      for (const t of orderData.tickets) {
        const [ticketType] = await tx.select().from(ticketTypes).where(eq(ticketTypes.id, t.ticketTypeId));
        if (!ticketType) throw new Error(`Ticket type ${t.ticketTypeId} not found`);
        if (t.quantity > ticketType.maxPerOrder) throw new Error(`Cannot order more than ${ticketType.maxPerOrder} tickets`);
        totalAmount += ticketType.price * t.quantity;
      }

      const [newOrder] = await tx.insert(orders).values({
        attendeeId,
        eventId:       orderData.eventId,
        status:        "confirmed",
        totalAmount,
        attendeeName:  orderData.attendeeName,
        attendeeEmail: orderData.attendeeEmail,
        notes:         orderData.notes ?? null,
      }).returning();

      if (orderData.tickets.length) {
        await tx.insert(orderTickets).values(
          orderData.tickets.map(t => ({
            orderId:      newOrder.id,
            ticketTypeId: t.ticketTypeId,
            quantity:     t.quantity,
          }))
        );
      }

      const full = await tx.query.orders.findFirst({
        where: eq(orders.id, newOrder.id),
        with:  { event: true, tickets: { with: { ticketType: true } } },
      });
      return full!;
    });
  }
}

export const storage = new DatabaseStorage();
