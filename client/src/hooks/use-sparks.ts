// client/src/hooks/use-sparks.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface SparkSender {
  id: string;
  displayName?: string | null;
  avatarUrl?:   string | null;
}

export interface SparkResponseItem {
  id:          number;
  sparkId:     number;
  responderId: string;
  status:      "pending" | "accepted" | "declined" | "confirmed";
  message?:    string | null;
  createdAt:   string;
  responder?:  SparkSender;
}

export interface Spark {
  id:              number;
  senderId:        string;
  title:           string;
  description:     string;
  activity:        string;
  location:        string;
  meetTime:        string;
  expiresAt:       string;
  maxRespondents:  number;
  filterInterests: string[] | null;
  filterLanguages: string[] | null;
  filterMetroLine: string | null;
  status:          "pending" | "active" | "expired" | "cancelled" | "confirmed";
  createdAt:       string;
  sender?:         SparkSender;
  responses:       SparkResponseItem[];
  responseCount:   number;
  myResponse?:     SparkResponseItem | null;
}

// Feed of all active sparks
export function useSparks() {
  return useQuery<Spark[]>({
    queryKey: ["/api/sparks"],
    queryFn:  async () => {
      const res = await apiRequest("GET", "/api/sparks");
      return res.json();
    },
    refetchInterval: 30_000, // poll every 30s for near-realtime feel
  });
}

// Current user's sent sparks
export function useMySparks() {
  return useQuery<Spark[]>({
    queryKey: ["/api/sparks/mine"],
    queryFn:  async () => {
      const res = await apiRequest("GET", "/api/sparks/mine");
      return res.json();
    },
  });
}

// Send a new spark
export function useCreateSpark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      title:           string;
      description?:    string;
      activity:        string;
      location:        string;
      meetTime:        string;
      expiresInMins:   number;
      maxRespondents:  number;
      filterInterests?: string[];
      filterLanguages?: string[];
      filterMetroLine?: string | null;
    }) => {
      const res = await apiRequest("POST", "/api/sparks", data);
      return res.json() as Promise<Spark>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sparks"] });
      qc.invalidateQueries({ queryKey: ["/api/sparks/mine"] });
    },
  });
}

// Cancel a spark
export function useCancelSpark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sparkId: number) => {
      const res = await apiRequest("DELETE", `/api/sparks/${sparkId}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sparks"] });
      qc.invalidateQueries({ queryKey: ["/api/sparks/mine"] });
    },
  });
}

// Accept or decline a spark
export function useRespondToSpark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sparkId, status, message }: {
      sparkId: number;
      status:  "accepted" | "declined";
      message?: string;
    }) => {
      const res = await apiRequest("POST", `/api/sparks/${sparkId}/respond`, { status, message });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sparks"] });
      qc.invalidateQueries({ queryKey: ["/api/sparks/mine"] });
    },
  });
}

// Confirm specific respondents
export function useConfirmSpark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sparkId, responderIds }: { sparkId: number; responderIds: string[] }) => {
      const res = await apiRequest("POST", `/api/sparks/${sparkId}/confirm`, { responderIds });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sparks"] });
      qc.invalidateQueries({ queryKey: ["/api/sparks/mine"] });
    },
  });
}
