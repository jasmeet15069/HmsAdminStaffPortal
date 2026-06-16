// React Query hooks wrapping the Hotel Harmony API endpoints for the core
// modules: dashboard, rooms, reservations, guests (CRM) and housekeeping.
//
// Every read hook is gated by `enabled: isAuthenticated()` so that, when the
// user is not signed in (or the backend is unreachable), pages can fall back to
// the local demo store instead of spinning forever.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "./client";
import { isAuthenticated } from "./auth";
import type {
  CreateReservationInput,
  CreateRoomInput,
  DashboardData,
  DashboardStats,
  Guest,
  HousekeepingTask,
  Reservation,
  Room,
  RoomStatus,
} from "./types";

export const queryKeys = {
  dashboardStats: ["dashboard", "stats"] as const,
  dashboardData: ["dashboard", "data"] as const,
  rooms: (status?: string) => ["rooms", status ?? "all"] as const,
  reservations: (filters?: Record<string, string>) => ["reservations", filters ?? {}] as const,
  guests: ["crm", "guests"] as const,
  housekeepingTasks: ["housekeeping", "tasks"] as const,
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: () => apiFetch<DashboardStats>("/api/dashboard/stats"),
    enabled: isAuthenticated(),
    staleTime: 30_000,
  });
}

export function useDashboardData() {
  return useQuery({
    queryKey: queryKeys.dashboardData,
    queryFn: () => apiFetch<DashboardData>("/api/dashboard/data"),
    enabled: isAuthenticated(),
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export function useRooms(status?: RoomStatus) {
  return useQuery({
    queryKey: queryKeys.rooms(status),
    queryFn: () => apiFetch<Room[]>("/api/rooms", { query: { status } }),
    enabled: isAuthenticated(),
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoomInput) =>
      apiFetch<Room>("/api/rooms", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms"] }),
  });
}

export function useUpdateRoomStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RoomStatus }) =>
      apiFetch(`/api/rooms/${id}/status`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------

export function useReservations(filters?: {
  status?: string;
  search?: string;
  from?: string;
  to?: string;
}) {
  const query = Object.fromEntries(Object.entries(filters ?? {}).filter(([, v]) => v)) as Record<
    string,
    string
  >;
  return useQuery({
    queryKey: queryKeys.reservations(query),
    queryFn: () =>
      apiFetch<Reservation[] | null>("/api/reservations", { query }).then((r) => r ?? []),
    enabled: isAuthenticated(),
  });
}

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReservationInput) =>
      apiFetch("/api/reservations", { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/reservations/${id}/checkin`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/reservations/${id}/checkout`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ---------------------------------------------------------------------------
// CRM / Guests
// ---------------------------------------------------------------------------

export function useGuests() {
  return useQuery({
    queryKey: queryKeys.guests,
    queryFn: () => apiFetch<Guest[] | null>("/api/crm/guests").then((g) => g ?? []),
    enabled: isAuthenticated(),
  });
}

// ---------------------------------------------------------------------------
// Housekeeping
// ---------------------------------------------------------------------------

export function useHousekeepingTasks() {
  return useQuery({
    queryKey: queryKeys.housekeepingTasks,
    queryFn: () =>
      apiFetch<HousekeepingTask[] | null>("/api/housekeeping/tasks").then((t) => t ?? []),
    enabled: isAuthenticated(),
  });
}

export function useUpdateHousekeepingTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { status?: string; assigned_to?: string; priority?: string; notes?: string };
    }) => apiFetch(`/api/housekeeping/tasks/${id}`, { method: "PATCH", body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["housekeeping"] }),
  });
}
