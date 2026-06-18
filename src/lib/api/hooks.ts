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
  ApiUser,
  BillingFolio,
  BillingFolioDetail,
  BillingInvoice,
  BillingTransaction,
  CloseDayResponse,
  CreateReservationInput,
  CreateRoomInput,
  DashboardData,
  DashboardStats,
  Guest,
  HousekeepingTask,
  NightAuditChecklistItem,
  NightAuditReport,
  NightAuditRevenueItem,
  Reservation,
  Room,
  RoomStatus,
  Session,
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

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export function useBillingFolios(params?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: ["billing", "folios", params ?? {}] as const,
    queryFn: () =>
      apiFetch<BillingFolio[] | null>("/api/billing/folios", { query: params }).then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}

export function useBillingFolioDetail(id: string | null) {
  return useQuery({
    queryKey: ["billing", "folios", id] as const,
    queryFn: () => apiFetch<BillingFolioDetail>(`/api/billing/folios/${id}`),
    enabled: isAuthenticated() && !!id,
  });
}

export function useAddFolioCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      folioId,
      ...body
    }: {
      folioId: string;
      description: string;
      charge_type: string;
      amount: number;
      tax_amount: number;
    }) => apiFetch(`/api/billing/folios/${folioId}/charges`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing"] }),
  });
}

export function useRecordFolioPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      folioId,
      ...body
    }: {
      folioId: string;
      amount: number;
      payment_method: string;
      notes?: string;
    }) => apiFetch(`/api/billing/folios/${folioId}/payments`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing"] }),
  });
}

export function useBillingInvoices() {
  return useQuery({
    queryKey: ["billing", "invoices"] as const,
    queryFn: () =>
      apiFetch<BillingInvoice[] | null>("/api/billing/invoices").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}

export function useBillingTransactions() {
  return useQuery({
    queryKey: ["billing", "transactions"] as const,
    queryFn: () =>
      apiFetch<BillingTransaction[] | null>("/api/billing/transactions").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}

export function useGenerateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { folio_id: string; notes?: string }) =>
      apiFetch("/api/billing/invoices", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing", "invoices"] }),
  });
}

export function useEmailInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/billing/invoices/${id}/email`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing", "invoices"] }),
  });
}

// ---------------------------------------------------------------------------
// Night Audit
// ---------------------------------------------------------------------------

export function useNightAuditChecklist() {
  return useQuery({
    queryKey: ["night-audit", "checklist"] as const,
    queryFn: () => apiFetch<NightAuditChecklistItem[]>("/api/night-audit/checklist"),
    enabled: isAuthenticated(),
  });
}

export function useNightAuditRevenue() {
  return useQuery({
    queryKey: ["night-audit", "revenue"] as const,
    queryFn: () =>
      apiFetch<NightAuditRevenueItem[] | null>("/api/night-audit/revenue-audit").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}

export function useNightAuditReports() {
  return useQuery({
    queryKey: ["night-audit", "reports"] as const,
    queryFn: () =>
      apiFetch<NightAuditReport[] | null>("/api/night-audit/reports").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}

export function useCloseDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<CloseDayResponse>("/api/night-audit/close-day", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["night-audit"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function useApiUsers() {
  return useQuery({
    queryKey: ["users"] as const,
    queryFn: () => apiFetch<ApiUser[] | null>("/api/users").then((u) => u ?? []),
    enabled: isAuthenticated(),
  });
}

export function useCreateApiUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      email: string;
      password: string;
      full_name: string;
      role: string;
    }) => {
      const { role, ...signUpData } = input;
      const result = await apiFetch<Session>("/api/auth/sign-up", {
        method: "POST",
        body: signUpData,
        auth: false,
      });
      const userId = result?.user?.id;
      if (userId && role) {
        await apiFetch(`/api/users/${userId}/roles`, { method: "POST", body: { role } });
      }
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useAddUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiFetch(`/api/users/${userId}/roles`, { method: "POST", body: { role } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useRemoveUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiFetch(`/api/users/${userId}/roles/${role}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
