import { db } from "./db";
import { 
  events, ticketTypes, orders, orderTickets,
  users,  // ✅ import users table
  type Event, type TicketType, type Order, type OrderTicket,
  type EventWithTickets, type OrderWithDetails,
  type CreateEventRequest, type UpdateEventRequest, type CreateOrderRequest,
  type User
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(userId: number): Promise<User | undefined>;  // ✅ added

  // Events
  getEvents(params?: { search?: string, category?: string, city?: string }): Promise<EventWithTickets[]>;
  getEvent(id: number): Promise<EventWithTickets | undefined>;
  getEventsByOrganizer(organizerId: string): Promise<EventWithTickets[]>;
  createEvent(organizerId: string, eventData: CreateEventRequest): Promise<EventWithTickets>;
  updateEvent(id: number, eventData: UpdateEventRequest): Promise<EventWithTickets>;
  deleteEvent(id: number): Promise<void>;

  // Orders
  getOrdersByAttendee(attendeeId: string): Promise<OrderWithDetails[]>;
  getOrder(id: number): Promise<OrderWithDetails | undefined>;
  createOrder(attendeeId: string, orderData: CreateOrderRequest): Promise<OrderWithDetails>;
}

export class DatabaseStorage implements IStorage {
  // ✅ Implement getUser
  async getUser(userId: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user;
  }

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

  async getEvents(params?: { search?: string, category?: string, city?: string }): Promise<EventWithTickets[]> {
    const results = await db.query.events.findMany({
      with: { ticketTypes: true },
      orderBy: [desc(events.createdAt)],
    });
    return results.filter(e => {
      let matches = true;
      if (params?.search) {
        const s = params.search.toLowerCase();
        matches = matches && (e.title.toLowerCase().includes(s) || e.description.toLowerCase().includes(s));
      }
      if (params?.category) matches = matches && e.category === params.category;
      if (params?.city) matches = matches && e.venueCity.toLowerCase().includes(params.city.toLowerCase());
      return matches;
    });
  }

  async getEvent(id: number): Promise<EventWithTickets | undefined> {
    return await db.query.events.findFirst({
      where: eq(events.id, id),
      with: { ticketTypes: true }
    });
  }

  async getEventsByOrganizer(organizerId: string): Promise<EventWithTickets[]> {
    return await db.query.events.findMany({
      where: eq(events.organizerId, organizerId),
      with: { ticketTypes: true },
      orderBy: [desc(events.createdAt)],
    });
  }

  async createEvent(organizerId: string, eventData: CreateEventRequest): Promise<EventWithTickets> {
    return await db.transaction(async (tx) => {
      const [newEvent] = await tx.insert(events).values({
        organizerId,
        title: eventData.title,
        description: eventData.description,
        category: eventData.category,
        date: new Date(eventData.date),
        venueAddress: eventData.venueAddress,
        venueCity: eventData.venueCity,
        imageUrl: eventData.imageUrl,
        published: eventData.published,
      }).returning();

      if (eventData.ticketTypes?.length) {
        await tx.insert(ticketTypes).values(
          eventData.ticketTypes.map(t => ({ ...t, eventId: newEvent.id }))
        );
      }

      const createdEvent = await tx.query.events.findFirst({
        where: eq(events.id, newEvent.id),
        with: { ticketTypes: true }
      });
      return createdEvent!;
    });
  }

  async updateEvent(id: number, eventData: UpdateEventRequest): Promise<EventWithTickets> {
    return await db.transaction(async (tx) => {
      const updates: Record<string, any> = {};
      if (eventData.title !== undefined) updates.title = eventData.title;
      if (eventData.description !== undefined) updates.description = eventData.description;
      if (eventData.category !== undefined) updates.category = eventData.category;
      if (eventData.category2 !== undefined) updates.category2 = eventData.category2;
      if (eventData.date !== undefined) updates.date = new Date(eventData.date as string);
      if (eventData.venueAddress !== undefined) updates.venueAddress = eventData.venueAddress;
      if (eventData.venueCity !== undefined) updates.venueCity = eventData.venueCity;
      if (eventData.imageUrl !== undefined) updates.imageUrl = eventData.imageUrl;
      if (eventData.published !== undefined) updates.published = eventData.published;

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
        with: { ticketTypes: true },
      });
      return updated!;
    });
  }

  async getOrdersByAttendee(attendeeId: string): Promise<OrderWithDetails[]> {
    return await db.query.orders.findMany({
      where: eq(orders.attendeeId, attendeeId),
      with: { event: true, tickets: { with: { ticketType: true } } },
      orderBy: [desc(orders.createdAt)],
    });
  }

  async getOrder(id: number): Promise<OrderWithDetails | undefined> {
    return await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { event: true, tickets: { with: { ticketType: true } } }
    });
  }

  async createOrder(attendeeId: string, orderData: CreateOrderRequest): Promise<OrderWithDetails> {
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
        eventId: orderData.eventId,
        status: "completed",
        totalAmount,
        attendeeName: orderData.attendeeName,
        attendeeEmail: orderData.attendeeEmail,
        notes: orderData.notes,
      }).returning();

      await tx.insert(orderTickets).values(
        orderData.tickets.map(t => ({ orderId: newOrder.id, ticketTypeId: t.ticketTypeId, quantity: t.quantity }))
      );

      const createdOrder = await tx.query.orders.findFirst({
        where: eq(orders.id, newOrder.id),
        with: { event: true, tickets: { with: { ticketType: true } } }
      });
      return createdOrder!;
    });
  }
}

export const storage = new DatabaseStorage();
