import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type OrderWithDetails } from "@shared/schema";
import { z } from "zod";

export function useCreateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.orders.create.input>) => {
      const res = await fetch(api.orders.create.path, {
        method: api.orders.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create order");
      }
      return res.json() as Promise<OrderWithDetails>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.orders.myOrders.path] });
    },
  });
}

export function useMyOrders() {
  return useQuery({
    queryKey: [api.orders.myOrders.path],
    queryFn: async () => {
      const res = await fetch(api.orders.myOrders.path, { credentials: "include" });
      if (res.status === 401) return []; // Not logged in
      if (!res.ok) throw new Error("Failed to fetch your orders");
      const data = await res.json();
      return data as OrderWithDetails[];
    },
  });
}

export function useOrder(id: number) {
  return useQuery({
    queryKey: [api.orders.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.orders.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch order");
      const data = await res.json();
      return data as OrderWithDetails;
    },
    enabled: !!id && !isNaN(id),
  });
}
