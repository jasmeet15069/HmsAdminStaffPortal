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
  Asset,
  ChannelConnection,
  CompetitorRate,
  CreatePosOrderBody,
  CreateReservationInput,
  CreateRoomInput,
  CreateTenantBody,
  BillingFolio,
  BillingFolioDetail,
  BillingInvoice,
  BillingTransaction,
  CloseDayResponse,
  LiveMenuItem,
  MenuCategory,
  ConsolidatedReport,
  DashboardData,
  DashboardStats,
  GuestDetail,
  Campaign,
  Guest,
  HousekeepingTask,
  InventoryItem,
  LoyaltyMember,
  LoyaltyTier,
  MaintenanceScheduleItem,
  NightAuditChecklistItem,
  NightAuditReport,
  NightAuditRevenueItem,
  NightAuditTaxItem,
  PlatformPlan,
  PlatformTenant,
  PosOrderApi,
  PricingRule,
  Promotion,
  PurchaseOrder,
  Branch,
  RatePlan,
  Reservation,
  ReservationDetail,
  Room,
  RoomStatus,
  TenantModulesResponse,
  Vendor,
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

export function useUpdateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CreateRoomInput> }) =>
      apiFetch<Room>(`/api/rooms/${id}`, { method: "PATCH", body: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/rooms/${id}`, { method: "DELETE" }),
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
// Reports
// ---------------------------------------------------------------------------

export function useConsolidatedReport() {
  return useQuery({
    queryKey: ["reports", "consolidated"] as const,
    queryFn: () => apiFetch<ConsolidatedReport>("/api/reports/consolidated"),
    enabled: isAuthenticated(),
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
    mutationFn: (input: { email: string; password: string; full_name: string; role: string }) =>
      apiFetch("/api/users", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: { full_name?: string; phone?: string } }) =>
      apiFetch(`/api/users/${userId}`, { method: "PATCH", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useSetUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiFetch(`/api/users/${userId}/role`, { method: "PUT", body: { role } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/api/users/${userId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      apiFetch(`/api/users/${userId}/password`, { method: "POST", body: { password } }),
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

// ---------------------------------------------------------------------------
// Tenant modules (which portal modules are enabled for the current tenant).
// Used to mask nav + guard routes. Cached aggressively — flags change rarely.
// ---------------------------------------------------------------------------

export function useTenantModules() {
  return useQuery({
    queryKey: ["tenant", "modules"] as const,
    queryFn: () => apiFetch<TenantModulesResponse>("/api/tenant/modules"),
    enabled: isAuthenticated(),
    staleTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Platform / master-admin (cross-tenant; backend gates on platform_admin)
// ---------------------------------------------------------------------------

export function usePlatformTenants() {
  return useQuery({
    queryKey: ["platform", "tenants"] as const,
    queryFn: () => apiFetch<PlatformTenant[] | null>("/api/platform/tenants").then((t) => t ?? []),
    enabled: isAuthenticated(),
  });
}

export function usePlatformPlans() {
  return useQuery({
    queryKey: ["platform", "plans"] as const,
    queryFn: () => apiFetch<PlatformPlan[] | null>("/api/platform/plans").then((p) => p ?? []),
    enabled: isAuthenticated(),
    staleTime: 10 * 60_000,
  });
}

export function useCreatePlatformTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTenantBody) => apiFetch("/api/platform/tenants", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform", "tenants"] }),
  });
}

export function useUpdateTenantPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, plan_tier, is_active }: { id: string; plan_tier: string; is_active?: boolean }) =>
      apiFetch(`/api/platform/tenants/${id}/plan`, { method: "PUT", body: { plan_tier, is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform", "tenants"] }),
  });
}

export function usePlatformTenantModules(id: string | null) {
  return useQuery({
    queryKey: ["platform", "tenant-modules", id] as const,
    queryFn: () => apiFetch<TenantModulesResponse>(`/api/platform/tenants/${id}/modules`),
    enabled: !!id && isAuthenticated(),
  });
}

export function useUpdatePlatformTenantModules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, modules }: { id: string; modules: Record<string, boolean> }) =>
      apiFetch(`/api/platform/tenants/${id}/modules`, { method: "PUT", body: { modules } }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["platform", "tenant-modules", v.id] });
      qc.invalidateQueries({ queryKey: ["tenant", "modules"] });
    },
  });
}

// ---------------------------------------------------------------------------
// POS Orders (persisted; backend caches the list in Redis, 15s TTL)
// ---------------------------------------------------------------------------

export function usePosOrders() {
  return useQuery({
    queryKey: ["pos", "orders"] as const,
    queryFn: () => apiFetch<PosOrderApi[] | null>("/api/pos/orders").then((o) => o ?? []),
    enabled: isAuthenticated(),
    // Near-real-time for KDS / Live Orders without hammering the DB — the
    // backend serves cached reads between writes.
    refetchInterval: 15_000,
  });
}

export function useCreatePosOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePosOrderBody) =>
      apiFetch<PosOrderApi>("/api/pos/orders", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos", "orders"] }),
  });
}

export function useUpdatePosOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      apiFetch<PosOrderApi>(`/api/pos/orders/${id}`, { method: "PATCH", body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos", "orders"] }),
  });
}

export function useDeletePosOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/pos/orders/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos", "orders"] }),
  });
}

// ---------------------------------------------------------------------------
// Reservation detail & mutations
// ---------------------------------------------------------------------------

export function useReservationDetail(id: string | null) {
  return useQuery({
    queryKey: ["reservations", "detail", id] as const,
    queryFn: () => apiFetch<ReservationDetail>(`/api/reservations/${id}`),
    enabled: isAuthenticated() && !!id,
  });
}

export function useUpdateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { check_in_date?: string; check_out_date?: string; notes?: string; status?: string };
    }) => apiFetch(`/api/reservations/${id}`, { method: "PATCH", body: patch }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["reservations", "detail", v.id] });
    },
  });
}

export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/reservations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
    },
  });
}

// ---------------------------------------------------------------------------
// CRM — Guests
// ---------------------------------------------------------------------------

export function useGuestDetail(id: string | null) {
  return useQuery({
    queryKey: ["crm", "guests", id] as const,
    queryFn: () => apiFetch<GuestDetail>(`/api/crm/guests/${id}`),
    enabled: isAuthenticated() && !!id,
  });
}

export function useUpdateGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<GuestDetail> }) =>
      apiFetch(`/api/crm/guests/${id}`, { method: "PATCH", body: patch }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["crm", "guests"] });
      qc.invalidateQueries({ queryKey: ["crm", "guests", v.id] });
    },
  });
}

// ---------------------------------------------------------------------------
// CRM — Loyalty
// ---------------------------------------------------------------------------

export function useLoyaltyTiers() {
  return useQuery({
    queryKey: ["crm", "loyalty", "tiers"] as const,
    queryFn: () =>
      apiFetch<LoyaltyTier[] | null>("/api/crm/loyalty/tiers").then((t) => t ?? []),
    enabled: isAuthenticated(),
  });
}

// System Admin: API keys + integrations (/api/admin/*).
export function useAPIKeys() {
  return useQuery({
    queryKey: ["admin", "api-keys"] as const,
    queryFn: () => apiFetch<any[] | null>("/api/admin/api-keys").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}
export function useCreateAPIKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiFetch<{ id: string; key: string }>("/api/admin/api-keys", { method: "POST", body: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "api-keys"] }),
  });
}
export function useUpdateAPIKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => apiFetch(`/api/admin/api-keys/${id}`, { method: "PATCH", body: { is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "api-keys"] }),
  });
}
export function useDeleteAPIKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "api-keys"] }),
  });
}
export function useIntegrations() {
  return useQuery({
    queryKey: ["admin", "integrations"] as const,
    queryFn: () => apiFetch<any[] | null>("/api/admin/integrations").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}
export function useUpsertIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, body }: { provider: string; body: { category?: string; is_enabled?: boolean; config?: any } }) =>
      apiFetch(`/api/admin/integrations/${provider}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "integrations"] }),
  });
}
export function useTestIntegration() {
  return useMutation({
    mutationFn: (provider: string) => apiFetch<{ ok: boolean; message: string }>(`/api/admin/integrations/${provider}/test`, { method: "POST" }),
  });
}

// Restaurant floor tables (/api/pos/tables) + waitlist (/api/pos/waitlist).
export function useRestaurantTables() {
  return useQuery({
    queryKey: ["pos", "tables"] as const,
    queryFn: () => apiFetch<any[] | null>("/api/pos/tables").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}
export function useWaitlist() {
  return useQuery({
    queryKey: ["pos", "waitlist"] as const,
    queryFn: () => apiFetch<any[] | null>("/api/pos/waitlist").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}
export function useAddWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; party_size: number; section?: string; phone?: string; quoted_wait?: number }) =>
      apiFetch("/api/pos/waitlist", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos", "waitlist"] }),
  });
}
export function useUpdateWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { status?: string; section?: string } }) =>
      apiFetch(`/api/pos/waitlist/${id}`, { method: "PATCH", body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos", "waitlist"] }),
  });
}
export function useDeleteWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/pos/waitlist/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos", "waitlist"] }),
  });
}

export function useCampaigns() {
  return useQuery({
    queryKey: ["crm", "campaigns"] as const,
    queryFn: () => apiFetch<Campaign[] | null>("/api/crm/campaigns").then((c) => c ?? []),
    enabled: isAuthenticated(),
  });
}
export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Campaign>) => apiFetch("/api/crm/campaigns", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "campaigns"] }),
  });
}
export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Campaign> }) =>
      apiFetch(`/api/crm/campaigns/${id}`, { method: "PATCH", body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "campaigns"] }),
  });
}
export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/crm/campaigns/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "campaigns"] }),
  });
}

export function useCreateLoyaltyTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; min_points: number; multiplier: number; benefits?: Record<string, unknown> }) =>
      apiFetch("/api/crm/loyalty/tiers", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "loyalty", "tiers"] }),
  });
}

export function useUpdateLoyaltyTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<LoyaltyTier> }) =>
      apiFetch(`/api/crm/loyalty/tiers/${id}`, { method: "PUT", body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "loyalty", "tiers"] }),
  });
}

export function useLoyaltyMembers() {
  return useQuery({
    queryKey: ["crm", "loyalty", "members"] as const,
    queryFn: () =>
      apiFetch<LoyaltyMember[] | null>("/api/crm/loyalty/members").then((m) => m ?? []),
    enabled: isAuthenticated(),
  });
}

export function useAwardLoyaltyPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { guest_id: string; points: number; reference?: string; description?: string }) =>
      apiFetch("/api/crm/loyalty/points/award", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "loyalty", "members"] }),
  });
}

export function useRedeemLoyaltyPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { guest_id: string; points: number; reference?: string; description?: string }) =>
      apiFetch("/api/crm/loyalty/points/redeem", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "loyalty", "members"] }),
  });
}

// ---------------------------------------------------------------------------
// Housekeeping — create task
// ---------------------------------------------------------------------------

export function useCreateHousekeepingTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      room_id: string;
      task_type: string;
      priority: string;
      notes?: string;
      assigned_to?: string;
    }) => apiFetch("/api/housekeeping/tasks", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["housekeeping"] }),
  });
}

export function useCreateLostItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { item_name: string; description?: string; found_by?: string; room_id?: string }) =>
      apiFetch("/api/housekeeping/lost-items", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["housekeeping", "lost-items"] }),
  });
}

export function useUpdateLostItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      apiFetch(`/api/housekeeping/lost-items/${id}`, { method: "PATCH", body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["housekeeping", "lost-items"] }),
  });
}

export function useLostItems() {
  return useQuery({
    queryKey: ["housekeeping", "lost-items"] as const,
    queryFn: () =>
      apiFetch<unknown[] | null>("/api/housekeeping/lost-items").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}

export function useLinenInventory() {
  return useQuery({
    queryKey: ["housekeeping", "linen"] as const,
    queryFn: () =>
      apiFetch<unknown[] | null>("/api/housekeeping/linen").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}

// ---------------------------------------------------------------------------
// Revenue
// ---------------------------------------------------------------------------

export function usePricingRules() {
  return useQuery({
    queryKey: ["revenue", "pricing-rules"] as const,
    queryFn: () =>
      apiFetch<PricingRule[] | null>("/api/revenue/pricing-rules").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}

export function useCreatePricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<PricingRule>) =>
      apiFetch("/api/revenue/pricing-rules", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["revenue", "pricing-rules"] }),
  });
}

export function useUpdatePricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<PricingRule> }) =>
      apiFetch(`/api/revenue/pricing-rules/${id}`, { method: "PATCH", body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["revenue", "pricing-rules"] }),
  });
}

export function useDeletePricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/revenue/pricing-rules/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["revenue", "pricing-rules"] }),
  });
}

export function useCompetitorRates() {
  return useQuery({
    queryKey: ["revenue", "competitors"] as const,
    queryFn: () =>
      apiFetch<CompetitorRate[] | null>("/api/revenue/competitors").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}

export function useRevenueForecast() {
  return useQuery({
    queryKey: ["revenue", "forecast"] as const,
    queryFn: () => apiFetch<unknown[] | null>("/api/revenue/forecast").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}

// ---------------------------------------------------------------------------
// Procurement
// ---------------------------------------------------------------------------

export function useVendors() {
  return useQuery({
    queryKey: ["procurement", "vendors"] as const,
    queryFn: () => apiFetch<Vendor[] | null>("/api/procurement/vendors").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Vendor>) =>
      apiFetch("/api/procurement/vendors", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement", "vendors"] }),
  });
}

export function useUpdateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Vendor> }) =>
      apiFetch(`/api/procurement/vendors/${id}`, { method: "PATCH", body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement", "vendors"] }),
  });
}

export function usePurchaseOrders() {
  return useQuery({
    queryKey: ["procurement", "purchase-orders"] as const,
    queryFn: () =>
      apiFetch<PurchaseOrder[] | null>("/api/procurement/purchase-orders").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<PurchaseOrder>) =>
      apiFetch("/api/procurement/purchase-orders", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement", "purchase-orders"] }),
  });
}

export function useUpdatePOStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/api/procurement/purchase-orders/${id}/status`, { method: "PATCH", body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement", "purchase-orders"] }),
  });
}

// ---------------------------------------------------------------------------
// Channel Manager
// ---------------------------------------------------------------------------

export function useChannelConnections() {
  return useQuery({
    queryKey: ["channel", "connections"] as const,
    queryFn: () =>
      apiFetch<ChannelConnection[] | null>("/api/channel/connections").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}

export function useCreateChannelConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<ChannelConnection>) =>
      apiFetch("/api/channel/connections", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channel"] }),
  });
}

export function useUpdateChannelConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ChannelConnection> }) =>
      apiFetch(`/api/channel/connections/${id}`, { method: "PATCH", body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channel"] }),
  });
}

export function useDeleteChannelConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/channel/connections/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channel"] }),
  });
}

export function useChannelAnalytics() {
  return useQuery({
    queryKey: ["channel", "analytics"] as const,
    queryFn: () => apiFetch<unknown>("/api/channel/analytics"),
    enabled: isAuthenticated(),
  });
}

// ---------------------------------------------------------------------------
// Booking Engine / Promotions
// ---------------------------------------------------------------------------

export function usePromotions() {
  return useQuery({
    queryKey: ["booking", "promotions"] as const,
    queryFn: () =>
      apiFetch<Promotion[] | null>("/api/booking/promotions").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}

export function useCreatePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Promotion>) =>
      apiFetch("/api/booking/promotions", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["booking", "promotions"] }),
  });
}

export function useUpdatePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Promotion> }) =>
      apiFetch(`/api/booking/promotions/${id}`, { method: "PATCH", body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["booking", "promotions"] }),
  });
}

export function useRatePlans() {
  return useQuery({
    queryKey: ["booking", "rate-plans"] as const,
    queryFn: () =>
      apiFetch<RatePlan[] | null>("/api/booking/rate-plans").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}
export function useCreateRatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<RatePlan>) =>
      apiFetch("/api/booking/rate-plans", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["booking", "rate-plans"] }),
  });
}
export function useUpdateRatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<RatePlan> }) =>
      apiFetch(`/api/booking/rate-plans/${id}`, { method: "PATCH", body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["booking", "rate-plans"] }),
  });
}
export function useDeleteRatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/booking/rate-plans/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["booking", "rate-plans"] }),
  });
}
export function useDeletePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/booking/promotions/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["booking", "promotions"] }),
  });
}

export function useBookingAvailability(params?: { check_in?: string; check_out?: string; room_type?: string }) {
  const query = Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v)) as Record<string, string>;
  return useQuery({
    queryKey: ["booking", "availability", query] as const,
    queryFn: () => apiFetch<unknown>("/api/booking/availability", { query }),
    enabled: isAuthenticated() && !!(params?.check_in && params?.check_out),
  });
}

// ---------------------------------------------------------------------------
// Maintenance / Assets
// ---------------------------------------------------------------------------

export function useAssets() {
  return useQuery({
    queryKey: ["maintenance", "assets"] as const,
    queryFn: () => apiFetch<Asset[] | null>("/api/maintenance/assets").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Asset>) =>
      apiFetch("/api/maintenance/assets", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance", "assets"] }),
  });
}

export function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Asset> }) =>
      apiFetch(`/api/maintenance/assets/${id}`, { method: "PATCH", body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance", "assets"] }),
  });
}

export function useMaintenanceSchedule() {
  return useQuery({
    queryKey: ["maintenance", "schedule"] as const,
    queryFn: () =>
      apiFetch<MaintenanceScheduleItem[] | null>("/api/maintenance/schedule").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}

export function useCreateMaintenanceTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<MaintenanceScheduleItem>) =>
      apiFetch("/api/maintenance/schedule", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance", "schedule"] }),
  });
}

export function useCompleteMaintenanceTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/maintenance/schedule/${id}/complete`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance", "schedule"] }),
  });
}

// ---------------------------------------------------------------------------
// Night Audit extended
// ---------------------------------------------------------------------------

export function useNightAuditTax() {
  return useQuery({
    queryKey: ["night-audit", "tax"] as const,
    queryFn: () =>
      apiFetch<NightAuditTaxItem[] | null>("/api/night-audit/tax-audit").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export function useOccupancyReport(params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ["reports", "occupancy", params ?? {}] as const,
    queryFn: () => apiFetch<unknown>("/api/reports/occupancy", { query: params }),
    enabled: isAuthenticated(),
    staleTime: 60_000,
  });
}

export function useRevenueReport(params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ["reports", "revenue", params ?? {}] as const,
    queryFn: () => apiFetch<unknown>("/api/reports/revenue", { query: params }),
    enabled: isAuthenticated(),
    staleTime: 60_000,
  });
}

export function useComplaintsReport() {
  return useQuery({
    queryKey: ["reports", "complaints"] as const,
    queryFn: () => apiFetch<unknown>("/api/reports/complaints"),
    enabled: isAuthenticated(),
    staleTime: 60_000,
  });
}

export function useBookingsPaceReport() {
  return useQuery({
    queryKey: ["reports", "bookings-pace"] as const,
    queryFn: () => apiFetch<unknown>("/api/reports/bookings-pace"),
    enabled: isAuthenticated(),
    staleTime: 60_000,
  });
}

export function useStaffActivityReport() {
  return useQuery({
    queryKey: ["reports", "staff-activity"] as const,
    queryFn: () => apiFetch<unknown>("/api/reports/staff-activity"),
    enabled: isAuthenticated(),
    staleTime: 60_000,
  });
}

export function useAIUsageReport() {
  return useQuery({
    queryKey: ["reports", "ai-usage"] as const,
    queryFn: () => apiFetch<unknown>("/api/reports/ai-usage"),
    enabled: isAuthenticated(),
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export function useInventoryItems() {
  return useQuery({
    queryKey: ["inventory", "items"] as const,
    queryFn: () =>
      apiFetch<InventoryItem[] | null>("/api/tables/inventory_items").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}

// ---------------------------------------------------------------------------
// Properties / Branches
// ---------------------------------------------------------------------------

export function useProperties() {
  return useQuery({
    queryKey: ["properties"] as const,
    queryFn: () => apiFetch<unknown[] | null>("/api/tables/properties").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}

// Branches = real multi-property CRUD (/api/branches). Preferred over the compat
// useProperties read above: this is plan-limit gated and has a create endpoint.
export function useBranches(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["branches"] as const,
    queryFn: () => apiFetch<Branch[] | null>("/api/branches").then((d) => d ?? []),
    // Branches are hotel-admin only; callers pass enabled:false for non-admins so
    // we don't fire a request that would 403.
    enabled: isAuthenticated() && (opts?.enabled ?? true),
  });
}

export function useCreateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Branch>) =>
      apiFetch("/api/branches", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches"] }),
  });
}

export function useUpdateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Branch> }) =>
      apiFetch(`/api/branches/${id}`, { method: "PATCH", body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches"] }),
  });
}

export function useDeleteBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/branches/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches"] }),
  });
}

// ---------------------------------------------------------------------------
// Front-desk: walk-in creates a reservation via API
// ---------------------------------------------------------------------------

export function useCreateGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      full_name: string;
      email?: string;
      phone?: string;
      id_type?: string;
      id_number?: string;
    }) => apiFetch<GuestDetail>("/api/crm/guests", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "guests"] }),
  });
}

// ---------------------------------------------------------------------------
// Menu items (compat-handler backed — /api/tables/menu_items)
// ---------------------------------------------------------------------------

export function useMenuCategories() {
  return useQuery({
    queryKey: ["menu", "categories"] as const,
    queryFn: () =>
      apiFetch<MenuCategory[] | null>("/api/tables/menu_categories").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}

export function useMenuItems() {
  return useQuery({
    queryKey: ["menu", "items"] as const,
    queryFn: () =>
      apiFetch<LiveMenuItem[] | null>("/api/tables/menu_items").then((d) => d ?? []),
    enabled: isAuthenticated(),
  });
}

export function useCreateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      price: number;
      category_id?: string | null;
      description?: string | null;
      is_available?: boolean;
      preparation_time?: number;
    }) =>
      apiFetch<LiveMenuItem>("/api/tables/menu_items", {
        method: "POST",
        body: { values: body, single: true },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu", "items"] }),
  });
}

export function useUpdateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<{
        name: string;
        price: number;
        category_id: string | null;
        description: string | null;
        is_available: boolean;
        preparation_time: number;
      }>;
    }) =>
      apiFetch<LiveMenuItem[]>("/api/tables/menu_items", {
        method: "PATCH",
        body: { values: patch, filters: [{ column: "id", operator: "eq", value: id }] },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu", "items"] }),
  });
}

export function useDeleteMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<unknown>("/api/tables/menu_items", {
        method: "DELETE",
        body: { filters: [{ column: "id", operator: "eq", value: id }] },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu", "items"] }),
  });
}

export function useCreateMenuCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; display_order?: number }) =>
      apiFetch<MenuCategory[]>("/api/tables/menu_categories", {
        method: "POST",
        body: { values: body },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu", "categories"] }),
  });
}

// ---------------------------------------------------------------------------
// Inventory mutations (read hook already exists as useInventoryItems)
// ---------------------------------------------------------------------------

export function useCreateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      unit: string;
      current_stock?: number;
      min_stock?: number;
      cost_per_unit?: number | null;
      is_perishable?: boolean;
      expiry_date?: string | null;
      supplier?: string | null;
    }) =>
      apiFetch<InventoryItem[]>("/api/tables/inventory_items", {
        method: "POST",
        body: { values: body },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory", "items"] }),
  });
}

export function useUpdateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<{
        name: string;
        unit: string;
        current_stock: number;
        min_stock: number;
        cost_per_unit: number | null;
        is_perishable: boolean;
        expiry_date: string | null;
        supplier: string | null;
      }>;
    }) =>
      apiFetch<InventoryItem[]>("/api/tables/inventory_items", {
        method: "PATCH",
        body: { values: patch, filters: [{ column: "id", operator: "eq", value: id }] },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory", "items"] }),
  });
}

export function useDeleteInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<unknown>("/api/tables/inventory_items", {
        method: "DELETE",
        body: { filters: [{ column: "id", operator: "eq", value: id }] },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory", "items"] }),
  });
}

export function useHotelBranding() {
  return useQuery({
    queryKey: ["hotel", "branding"],
    queryFn: () => apiFetch<{ hotel_name: string; logo_url?: string; primary_color?: string }>("/api/hotel/branding"),
    enabled: isAuthenticated(),
    staleTime: 5 * 60_000,
  });
}
