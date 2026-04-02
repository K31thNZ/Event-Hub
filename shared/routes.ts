import { z } from 'zod';
import { type EventWithTickets, type OrderWithDetails } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  events: {
    list: {
      method: 'GET' as const,
      path: '/api/events' as const,
      input: z.object({ 
        search: z.string().optional(), 
        category: z.string().optional(), 
        city: z.string().optional() 
      }).optional(),
      responses: {
        200: z.array(z.custom<EventWithTickets>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/events/:id' as const,
      responses: {
        200: z.custom<EventWithTickets>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/events' as const,
      input: z.object({
        title: z.string().min(1, "Title is required"),
        description: z.string().min(1, "Description is required"),
        category: z.string().min(1, "Category is required"),
        category2: z.string().optional().nullable(),
        date: z.string().or(z.date()),
        venueAddress: z.string().min(1, "Venue Address is required"),
        venueCity: z.string().min(1, "City is required"),
        imageUrl: z.string().optional().nullable(),
        published: z.boolean().default(true),
        ticketTypes: z.array(z.object({
          name: z.string().min(1, "Name is required"),
          price: z.number().min(0, "Price must be >= 0"),
          quantity: z.number().min(1, "Quantity must be > 0"),
          maxPerOrder: z.number().min(1, "Max per order must be > 0")
        })).min(1, "At least one ticket type is required")
      }),
      responses: {
        201: z.custom<EventWithTickets>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      }
    },
    myEvents: {
      method: 'GET' as const,
      path: '/api/events/me' as const,
      responses: {
        200: z.array(z.custom<EventWithTickets>()),
        401: errorSchemas.unauthorized,
      }
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/events/:id' as const,
      input: z.object({
        title: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        category: z.string().min(1).optional(),
        category2: z.string().optional().nullable(),
        date: z.string().or(z.date()).optional(),
        venueAddress: z.string().min(1).optional(),
        venueCity: z.string().min(1).optional(),
        imageUrl: z.string().optional().nullable(),
        published: z.boolean().optional(),
        ticketTypes: z.array(z.object({
          name: z.string().min(1),
          price: z.number().min(0),
          quantity: z.number().min(1),
          maxPerOrder: z.number().min(1),
        })).optional(),
      }),
      responses: {
        200: z.custom<EventWithTickets>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
        403: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/events/:id' as const,
      responses: {
        200: z.object({ success: z.boolean() }),
        401: errorSchemas.unauthorized,
        403: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      }
    }
  },
  orders: {
    create: {
      method: 'POST' as const,
      path: '/api/orders' as const,
      input: z.object({
        eventId: z.number(),
        attendeeName: z.string().min(1, "Name is required"),
        attendeeEmail: z.string().email("Invalid email"),
        notes: z.string().optional().nullable(),
        tickets: z.array(z.object({
          ticketTypeId: z.number(),
          quantity: z.number().min(1)
        })).min(1)
      }),
      responses: {
        201: z.custom<OrderWithDetails>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      }
    },
    myOrders: {
      method: 'GET' as const,
      path: '/api/orders/me' as const,
      responses: {
        200: z.array(z.custom<OrderWithDetails>()),
        401: errorSchemas.unauthorized,
      }
    },
    get: {
      method: 'GET' as const,
      path: '/api/orders/:id' as const,
      responses: {
        200: z.custom<OrderWithDetails>(),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
