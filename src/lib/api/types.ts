// TypeScript mirrors of the Hotel Harmony Go API (golangserver) JSON shapes.
// Field names are snake_case to match the Go `json:"..."` tags exactly — do not
// rename them or deserialization will silently produce `undefined`.

export interface SessionUser {
  id: string;
  hotel_id?: string;
  email: string;
  platform_admin: boolean;
  user_metadata: Record<string, unknown>;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: SessionUser | null;
}

export type RoomStatus = "available" | "occupied" | "cleaning" | "maintenance";

export interface Room {
  id: string;
  hotel_id: string;
  room_number: string;
  room_type: string;
  floor: number;
  capacity: number;
  price_per_night: number;
  status: RoomStatus;
  amenities: string[];
  created_at: string;
  updated_at: string;
}

// Reservation status is derived server-side in reservation_handler.go::deriveReservationStatus.
export type ReservationStatus = "checked_out" | "in_house" | "pending_checkin" | "upcoming";

// Shape returned by GET /api/reservations (a flattened map, not the raw GuestStay).
export interface Reservation {
  id: string;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  check_in_date: string;
  check_out_date: string;
  actual_check_in: string;
  actual_check_out: string;
  room_number: string;
  room_type: string;
  total_amount: number | null;
  nights: number;
  status: ReservationStatus;
  source: string | null;
  created_at: string;
}

export interface DashboardStats {
  occupancy_rate: number;
  rooms_available: number;
  rooms_occupied: number;
  active_orders: number;
  pending_complaints: number;
  revenue_today: number;
  low_stock_items: number;
  staff_clocked_in: number;
  guests_checking_in_today: number;
  guests_checking_out_today: number;
}

export interface ChartRevenuePoint {
  date: string;
  room: number;
  fnb: number;
  other: number;
}

export interface ChartOccupancyPoint {
  date: string;
  occupied: number;
  available: number;
  rate: number;
}

export interface DeptRevenueItem {
  department: string;
  current: number;
  previous: number;
}

export interface GuestStayItem {
  guest_name: string;
  room: string;
  status: string;
}

export interface PendingPaymentItem {
  guest_name: string;
  amount: number;
  due_date: string;
  status: string;
}

export interface ActivityItem {
  action: string;
  user: string;
  details: string;
  created_at: string;
}

export interface DashboardChartData {
  revenue_trend: ChartRevenuePoint[];
  occupancy_trend: ChartOccupancyPoint[];
  department_revenue: DeptRevenueItem[];
  arrivals_today: GuestStayItem[];
  departures_today: GuestStayItem[];
  pending_payments: PendingPaymentItem[];
  recent_activity: ActivityItem[];
}

export interface DashboardData {
  stats: DashboardStats;
  charts: DashboardChartData;
}

// GET /api/crm/guests -> guestSummaryResponse[]
export interface Guest {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  vip_status: string;
  total_stays: number;
  loyalty_points: number;
}

// GET /api/housekeeping/tasks -> taskResponse[]
export interface HousekeepingTask {
  id: string;
  room_id: string;
  assigned_to: string | null;
  task_type: string;
  priority: string;
  status: string;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  room?: { room_number: string; room_type: string; floor: number };
  assigned_staff?: { full_name: string };
}

export interface CreateReservationInput {
  guest_name: string;
  guest_email?: string;
  guest_phone?: string;
  room_id: string;
  check_in_date: string; // YYYY-MM-DD
  check_out_date: string; // YYYY-MM-DD
  source?: string;
  notes?: string;
}

export interface CreateRoomInput {
  room_number: string;
  room_type: string;
  floor: number;
  capacity: number;
  price_per_night: number;
  status?: RoomStatus;
  amenities?: string[];
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export interface BillingFolio {
  id: string;
  booking_id: string;
  guest_id: string;
  status: string;
  currency: string;
  guest_name: string;
  room_id?: string;
  room_number: string;
  total_charges: number;
  total_paid: number;
  balance: number;
  created_at: string;
  closed_at?: string;
}

export interface BillingCharge {
  id: string;
  folio_id: string;
  description: string;
  charge_type?: string;
  amount: number;
  tax_amount: number;
  posted_at: string;
}

export interface BillingPaymentItem {
  id: string;
  payment_number: string;
  amount: number;
  method: string;
  status: string;
  notes?: string;
  created_at: string;
}

export interface BillingFolioDetail extends BillingFolio {
  total_tax: number;
  charges: BillingCharge[];
  payments: BillingPaymentItem[];
}

export interface BillingInvoice {
  id: string;
  folio_id: string;
  invoice_number: string;
  status: string;
  subtotal: number;
  tax_total: number;
  total: number;
  currency: string;
  notes?: string;
  guest_name: string;
  created_at: string;
  sent_at?: string;
  paid_at?: string;
}

export interface BillingTransaction {
  id: string;
  payment_number: string;
  amount: number;
  payment_method: string;
  status: string;
  notes?: string;
  guest_name: string;
  room_number: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Night Audit
// ---------------------------------------------------------------------------

export interface NightAuditChecklistItem {
  task: string;
  completed: boolean;
}

export interface NightAuditRevenueItem {
  category: string;
  expected: number;
  actual: number;
  difference: number;
}

export interface NightAuditReport {
  id: string;
  audit_date: string;
  status: string;
  closed_by?: string;
  created_at: string;
}

export interface CloseDayResponse {
  report_id: string;
  audit_date: string;
  status: string;
  summary: {
    total_revenue: number;
    total_tax: number;
    occupied_rooms: number;
    check_outs: number;
    arrivals: number;
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface ApiUser {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  roles: string[];
  joined_at: string;
}
