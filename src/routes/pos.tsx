import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import type { POSOrder, Outlet, MenuItem, OrderChannel } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend,
} from "recharts";
import {
  Plus, Minus, Trash2, CreditCard, Search, ChefHat, Banknote,
  Smartphone, BedDouble, Clock, CheckCircle2, ReceiptText,
  UtensilsCrossed, Wine, Sparkles, ShoppingBag, X, Timer,
  AlertCircle, Printer, TrendingUp, LayoutGrid, Download,
  Truck, Building2, Package, Tag, Wallet, CalendarDays,
  MapPin, Phone, Bike, Star, Zap, Users, DollarSign,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { printHTML } from "@/lib/csv";

// ── Types ─────────────────────────────────────────────────────────────────────
type CartItem = { id: string; name: string; qty: number; price: number; note?: string };
type PayMethod = typeof PAY_METHODS[number]["id"];
type TableStatus = "available" | "occupied" | "reserved" | "cleaning";
type KitchenStation = "All" | "Tandoor" | "Grill" | "Fry" | "Pantry" | "Bar" | "Dessert";
type Promotion = { id: string; name: string; type: "happy_hour" | "bogo" | "flat" | "combo"; desc: string; discountPct: number; condition?: string };
type BanquetEvent = {
  id: string; name: string; date: string; time: string; hall: string;
  covers: number; contactName: string; phone: string; package: string;
  advance: number; total: number;
  status: "Tentative" | "Confirmed" | "In Progress" | "Completed" | "Cancelled";
};
type CashierShift = {
  id: string; cashierName: string; openedAt: string; openingFloat: number;
  closedAt?: string; closingCash?: number; cashSales: number; cardSales: number;
  upiSales: number; roomChargeSales: number; status: "Open" | "Closed";
};

// ── Static data ────────────────────────────────────────────────────────────────
const OUTLETS_LIST: Outlet[] = ["Restaurant", "Bar", "Room Service", "Spa"];

const OUTLET_TABLES: Record<Outlet, string[]> = {
  Restaurant:     ["T-01","T-02","T-03","T-04","T-05","T-06","T-07","T-08","T-09","T-10","T-11","T-12"],
  Bar:            ["B-01","B-02","B-03","B-04","B-05","B-06"],
  "Room Service": [],
  Spa:            ["S-01","S-02","S-03","S-04"],
};

const ALL_TABLES = [
  ...OUTLET_TABLES.Restaurant.map((t) => ({ id: t, outlet: "Restaurant" as Outlet, seats: 4 })),
  ...OUTLET_TABLES.Bar.map((t) => ({ id: t, outlet: "Bar" as Outlet, seats: 2 })),
  ...OUTLET_TABLES.Spa.map((t) => ({ id: t, outlet: "Spa" as Outlet, seats: 1 })),
];

const OUTLET_ICON: Record<Outlet, React.ReactNode> = {
  Restaurant:     <UtensilsCrossed className="size-3.5" />,
  Bar:            <Wine className="size-3.5" />,
  "Room Service": <BedDouble className="size-3.5" />,
  Spa:            <Sparkles className="size-3.5" />,
};

const PAY_METHODS = [
  { id: "Cash",        label: "Cash",        icon: Banknote },
  { id: "Card",        label: "Card",        icon: CreditCard },
  { id: "UPI",         label: "UPI",         icon: Smartphone },
  { id: "Room Charge", label: "Room Charge", icon: BedDouble },
] as const;

const PIE_COLORS = ["hsl(var(--chart-1))","hsl(var(--chart-2))","hsl(var(--chart-3))","hsl(var(--chart-4))"];

const CHANNELS: { id: OrderChannel; label: string; icon: React.ElementType }[] = [
  { id: "Dine-In",  label: "Dine-In",  icon: UtensilsCrossed },
  { id: "Takeaway", label: "Takeaway", icon: Package },
  { id: "Delivery", label: "Delivery", icon: Truck },
  { id: "Banquet",  label: "Banquet",  icon: Building2 },
];

const WAITERS = [
  { id: "w1", name: "Arjun Mehta" },
  { id: "w2", name: "Sona Patel" },
  { id: "w3", name: "Vikram Das" },
  { id: "w4", name: "Priya Rao" },
  { id: "w5", name: "Karan Singh" },
];

const RIDERS = [
  { id: "rd1", name: "Suresh Kumar",  phone: "9876500001", available: true },
  { id: "rd2", name: "Amit Yadav",    phone: "9876500002", available: false },
  { id: "rd3", name: "Ravi Sharma",   phone: "9876500003", available: true },
  { id: "rd4", name: "Dev Thakur",    phone: "9876500004", available: true },
];

const KITCHEN_STATIONS: KitchenStation[] = ["All", "Tandoor", "Grill", "Fry", "Pantry", "Bar", "Dessert"];

const CAT_TO_STATION: Record<string, KitchenStation> = {
  Starter: "Fry", Main: "Grill", Bread: "Tandoor",
  Salad: "Pantry", Snack: "Pantry", Beverage: "Pantry",
  Dessert: "Dessert", Breakfast: "Pantry",
  Cocktail: "Bar", Mocktail: "Bar", Beer: "Bar", Spirit: "Bar", Wine: "Bar",
  Massage: "Pantry", Facial: "Pantry", Nails: "Pantry", Package: "Pantry",
};

const PROMOTIONS: Promotion[] = [
  { id: "promo1", name: "Happy Hours",     type: "happy_hour", desc: "20% off Bar — 5 PM to 8 PM",      discountPct: 20, condition: "Bar outlet" },
  { id: "promo2", name: "BOGO Starters",   type: "bogo",       desc: "Buy 1 Get 1 on all Starters",     discountPct: 50, condition: "Starter items" },
  { id: "promo3", name: "Corporate 15%",   type: "flat",       desc: "15% off for corporate bookings",  discountPct: 15 },
  { id: "promo4", name: "Weekend Special", type: "flat",       desc: "10% weekend dining discount",     discountPct: 10, condition: "Sat & Sun" },
];

const BANQUET_HALLS = ["Grand Ballroom", "Crystal Hall", "Garden Terrace", "Conference Room"];

const INITIAL_TABLE_RES = [
  { id: "tr1", date: "2026-06-18", time: "19:30", table: "T-04", guests: 4, name: "Mr. Sharma",   phone: "9876543210", status: "Confirmed" },
  { id: "tr2", date: "2026-06-18", time: "20:00", table: "T-08", guests: 2, name: "Ms. Kapoor",   phone: "9123456789", status: "Confirmed" },
  { id: "tr3", date: "2026-06-19", time: "13:00", table: "T-02", guests: 6, name: "Singh Family", phone: "9988776655", status: "Pending" },
  { id: "tr4", date: "2026-06-19", time: "19:00", table: "T-06", guests: 4, name: "Mr. Verma",    phone: "9012345678", status: "Confirmed" },
];

const INITIAL_BANQUET_EVENTS: BanquetEvent[] = [
  { id: "be1", name: "Singh Wedding Reception", date: "2026-06-25", time: "18:00", hall: "Grand Ballroom", covers: 180, contactName: "Rajiv Singh",  phone: "9876501234", package: "Royal Banquet",     advance: 100000, total: 385000, status: "Confirmed" },
  { id: "be2", name: "TechCorp Annual Dinner",  date: "2026-06-28", time: "19:00", hall: "Crystal Hall",   covers:  60, contactName: "Ms. Mehta",    phone: "9812345678", package: "Corporate Package", advance:  50000, total:  95000, status: "Confirmed" },
  { id: "be3", name: "Birthday — Aryan K.",     date: "2026-06-22", time: "20:00", hall: "Garden Terrace", covers:  30, contactName: "Priya Kapoor", phone: "9988001122", package: "Birthday Special",  advance:  15000, total:  42000, status: "Tentative" },
  { id: "be4", name: "Gupta Family Reunion",    date: "2026-07-04", time: "13:00", hall: "Crystal Hall",   covers:  45, contactName: "Mr. Gupta",    phone: "9123456789", package: "Family Lunch",      advance:  20000, total:  68000, status: "Tentative" },
];

const INITIAL_CASHIER_SHIFTS: CashierShift[] = [
  { id: "sh1", cashierName: "Priya Rao", openedAt: "17 Jun 2026, 07:00 AM", openingFloat: 5000, closedAt: "17 Jun 2026, 11:00 PM", closingCash: 18500, cashSales: 14200, cardSales: 28600, upiSales: 12400, roomChargeSales: 8800, status: "Closed" },
];

const BLANK_BANQUET = { name: "", date: "", time: "", hall: "Grand Ballroom", covers: "50", contactName: "", phone: "", package: "", advance: "", total: "" };

const TABLE_STATUS_META: Record<TableStatus, { label: string; color: string; bg: string }> = {
  available: { label: "Available", color: "text-success",             bg: "bg-success/15 border-success/30 hover:border-success/60" },
  occupied:  { label: "Occupied",  color: "text-destructive",         bg: "bg-destructive/10 border-destructive/30 hover:border-destructive/50" },
  reserved:  { label: "Reserved",  color: "text-info",                bg: "bg-info/10 border-info/30 hover:border-info/50" },
  cleaning:  { label: "Cleaning",  color: "text-warning-foreground",  bg: "bg-warning/15 border-warning/30 hover:border-warning/50" },
};

const BANQUET_STATUS_META: Record<BanquetEvent["status"], { color: string }> = {
  Tentative:    { color: "bg-warning/20 text-warning-foreground border-warning/30" },
  Confirmed:    { color: "bg-success/15 text-success border-success/30" },
  "In Progress":{ color: "bg-info/15 text-info border-info/30" },
  Completed:    { color: "bg-muted text-muted-foreground border-border" },
  Cancelled:    { color: "bg-destructive/10 text-destructive border-destructive/30" },
};

// ── KOT Receipt modal ──────────────────────────────────────────────────────────
function KOTModal({ order, onClose }: { order: { outlet: string; table?: string; channel?: string; items: CartItem[] }; onClose: () => void }) {
  const printKOT = () => {
    const rows = order.items.map((i) => `<tr><td>${i.qty}×</td><td>${i.name}${i.note ? `<br/><small style="color:#64748b">↳ ${i.note}</small>` : ""}</td></tr>`).join("");
    printHTML(`KOT — ${order.outlet}`, `
      <div style="font-family:monospace">
        <div style="text-align:center;font-size:18px;font-weight:bold;margin-bottom:8px">${order.outlet.toUpperCase()}</div>
        <div style="text-align:center;color:#64748b;margin-bottom:12px">${order.channel ? `[${order.channel}] ` : ""}${order.table ?? "—"} · ${new Date().toLocaleTimeString()}</div>
        <hr/>
        <table style="width:100%;margin-top:8px">${rows}</table>
        <hr style="margin-top:12px"/>
        <div style="text-align:center;color:#94a3b8;font-size:11px;margin-top:8px">KOT — Hotel Harmony</div>
      </div>
    `);
  };
  return (
    <DialogContent className="max-w-xs">
      <DialogHeader><DialogTitle>Kitchen Order Ticket</DialogTitle></DialogHeader>
      <div className="font-mono text-sm space-y-1 p-4 bg-muted rounded-lg">
        <div className="text-center font-bold text-base">{order.outlet.toUpperCase()}</div>
        <div className="text-center text-muted-foreground text-xs">
          {order.channel && order.channel !== "Dine-In" && <span className="mr-1.5 font-medium text-primary">[{order.channel}]</span>}
          {order.table ?? "—"} · {new Date().toLocaleTimeString()}
        </div>
        <Separator className="my-2" />
        {order.items.length === 0 ? (
          <div className="text-center text-muted-foreground text-xs py-2">No items</div>
        ) : (
          order.items.map((i, idx) => (
            <div key={idx}>
              <div className="flex justify-between">
                <span>{i.qty}× {i.name}</span>
              </div>
              {i.note && <div className="text-muted-foreground text-xs pl-4">↳ {i.note}</div>}
            </div>
          ))
        )}
        <Separator className="my-2" />
        <div className="text-center text-xs text-muted-foreground">KOT — Hotel Harmony</div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 gap-1" onClick={printKOT}><Printer className="size-4" />Print</Button>
        <Button className="flex-1" onClick={onClose}>Close</Button>
      </div>
    </DialogContent>
  );
}

// ── Receipt modal ──────────────────────────────────────────────────────────────
function ReceiptModal({ order, onClose }: { order: POSOrder; onClose: () => void }) {
  const printReceipt = () => {
    const rows = order.items.map((i) => `<tr><td>${i.qty}× ${i.name}</td><td class="right">${fmtINR(i.qty * i.price)}</td></tr>`).join("");
    const tax = Math.round(order.total / 1.18 * 0.18);
    const base = order.total - tax;
    printHTML(`Receipt — ${order.outlet}`, `
      <div class="brand"><div><h1>Hotel Harmony</h1><div class="muted">GST: 27AABCA1234X1Z5</div></div><div style="text-align:right"><h1>RECEIPT</h1><div class="muted">${order.createdAt}</div></div></div>
      <div><strong>Outlet:</strong> ${order.outlet} &nbsp;&nbsp; <strong>${order.channel === "Delivery" ? "Deliver to" : "Table"}:</strong> ${order.deliveryAddress ?? order.table ?? "Room Svc"}</div>
      <table style="margin-top:12px"><tr><th>Item</th><th class="right">Amount</th></tr>${rows}</table>
      <div class="totals">
        <div class="row"><span>Subtotal</span><span>${fmtINR(base)}</span></div>
        <div class="row"><span>CGST 9%</span><span>${fmtINR(Math.round(tax / 2))}</span></div>
        <div class="row"><span>SGST 9%</span><span>${fmtINR(Math.round(tax / 2))}</span></div>
        <div class="grand row"><span>Total</span><span>${fmtINR(order.total)}</span></div>
      </div>
      <div style="clear:both;margin-top:40px;text-align:center;color:#94a3b8;font-size:11px">Thank you for dining with us!</div>
    `);
  };
  return (
    <DialogContent className="max-w-xs">
      <DialogHeader><DialogTitle>Bill — {order.outlet}</DialogTitle></DialogHeader>
      <div className="font-mono text-sm space-y-1">
        <div className="text-xs text-muted-foreground text-center mb-2">
          {order.channel === "Delivery" ? `Delivery → ${order.customerName}` : (order.table ?? "Room Service")}
        </div>
        {order.items.map((i) => (
          <div key={i.name} className="flex justify-between">
            <span>{i.qty}× {i.name}</span>
            <span>{fmtINR(i.qty * i.price)}</span>
          </div>
        ))}
        <Separator className="my-1" />
        <div className="flex justify-between text-muted-foreground text-xs">
          <span>CGST 9% + SGST 9%</span>
          <span>{fmtINR(Math.round(order.total / 1.18 * 0.18))}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Total</span><span>{fmtINR(order.total)}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 gap-1" onClick={printReceipt}><Printer className="size-4" />Print</Button>
        <Button className="flex-1" onClick={onClose}>Close</Button>
      </div>
    </DialogContent>
  );
}

export const Route = createFileRoute("/pos")({
  head: () => ({ meta: [{ title: "POS & Restaurant · MHMS" }] }),
  component: POS,
});

// ── Main POS Component ─────────────────────────────────────────────────────────
function POS() {
  const { orders, addOrder, updateOrder, rooms, menuItems: allMenuItems } = useMHMS();

  // ── Order state ──
  const [outlet, setOutlet] = useState<Outlet>("Restaurant");
  const [channel, setChannel] = useState<OrderChannel>("Dine-In");
  const [catFilter, setCatFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [table, setTable] = useState("T-01");
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountPct, setDiscountPct] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [payMethod, setPayMethod] = useState<PayMethod>("Cash");
  const [orderNotes, setOrderNotes] = useState("");
  const [waiter, setWaiter] = useState(WAITERS[0].id);

  // ── Channel-specific fields ──
  const [customerName, setCustomerName] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryRiderId, setDeliveryRiderId] = useState(RIDERS[0].id);
  const [banquetEventRef, setBanquetEventRef] = useState("be1");

  // ── UI dialogs ──
  const [kotModal, setKotModal] = useState(false);
  const [kotItems, setKotItems] = useState<CartItem[]>([]);
  const [kotContext, setKotContext] = useState<{ outlet: string; table?: string; channel?: string }>({ outlet: "Restaurant" });
  const [noteItemId, setNoteItemId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [receiptOrder, setReceiptOrder] = useState<POSOrder | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [splitMode, setSplitMode] = useState(false);
  const [split1, setSplit1] = useState("");
  const [split2, setSplit2] = useState("");
  const [payMethod2, setPayMethod2] = useState<PayMethod>("Card");
  const [voidId, setVoidId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  // ── Table management ──
  const [tableStatuses, setTableStatuses] = useState<Record<string, TableStatus>>(() => {
    const init: Record<string, TableStatus> = {};
    ALL_TABLES.forEach((t) => { init[t.id] = "available"; });
    init["T-03"] = "occupied"; init["T-07"] = "occupied"; init["T-05"] = "reserved";
    init["B-02"] = "occupied"; init["S-01"] = "occupied";
    return init;
  });
  const [tableCovers, setTableCovers] = useState<Record<string, number>>({});
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  // ── Reservations ──
  const [tableResOpen, setTableResOpen] = useState(false);
  const [tableReservations, setTableReservations] = useState(INITIAL_TABLE_RES);
  const [newTR, setNewTR] = useState({ date: "", time: "", table: "T-01", guests: "2", name: "", phone: "" });

  // ── Kitchen stations ──
  const [kdsStation, setKdsStation] = useState<KitchenStation>("All");

  // ── Promotions ──
  const [activePromoId, setActivePromoId] = useState<string | null>(null);

  // ── Delivery rider assignment ──
  const [riderAssignments, setRiderAssignments] = useState<Record<string, string>>({});

  // ── Banquet ──
  const [banquetEvents, setBanquetEvents] = useState<BanquetEvent[]>(INITIAL_BANQUET_EVENTS);
  const [banquetDialogOpen, setBanquetDialogOpen] = useState(false);
  const [newBanquet, setNewBanquet] = useState({ ...BLANK_BANQUET });

  // ── Cashier shift ──
  const [cashierShifts, setCashierShifts] = useState<CashierShift[]>(INITIAL_CASHIER_SHIFTS);
  const [shiftFloat, setShiftFloat] = useState("5000");
  const [shiftName, setShiftName] = useState("Admin");
  const [closingCash, setClosingCash] = useState("");

  // ── Derived ──
  const outletMenu = useMemo(() => allMenuItems.filter((m) => m.outlet === outlet && m.active), [allMenuItems, outlet]);
  const categories = useMemo(() => ["All", ...Array.from(new Set(outletMenu.map((m) => m.cat)))], [outletMenu]);
  const filteredMenu = useMemo(() => outletMenu.filter((m) => {
    const matchCat = catFilter === "All" || m.cat === catFilter;
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  }), [outletMenu, catFilter, search]);

  const getItemStation = (itemName: string): KitchenStation => {
    const mi = allMenuItems.find((m) => m.name === itemName);
    if (!mi) return "Pantry";
    return (CAT_TO_STATION[mi.cat] ?? "Pantry") as KitchenStation;
  };

  const subtotal = cart.reduce((s, i) => s + i.qty * i.price, 0);
  const discountAmt = Math.round(subtotal * discountPct / 100);
  const afterDiscount = subtotal - discountAmt;
  const tax = taxEnabled ? Math.round(afterDiscount * 0.18) : 0;
  const total = afterDiscount + tax;

  const openOrders = orders.filter((o) => o.status !== "Paid");
  const paidOrders = orders.filter((o) => o.status === "Paid");
  const deliveryOrders = useMemo(() => orders.filter((o) => o.channel === "Delivery"), [orders]);
  const todayRevenue = paidOrders.reduce((s, o) => s + o.total, 0);
  const totalCovers = Object.values(tableCovers).reduce((s, c) => s + c, 0);
  const currentShift = cashierShifts.find((s) => s.status === "Open");

  const filteredKOT = useMemo(() => {
    const sent = openOrders.filter((o) => o.status === "Sent");
    if (kdsStation === "All") return sent;
    return sent.filter((o) => o.items.some((i) => getItemStation(i.name) === kdsStation));
  }, [openOrders, kdsStation, allMenuItems]);

  // ── Analytics ──
  const revenueByOutlet = useMemo(() => {
    const g: Record<string, number> = {};
    paidOrders.forEach((o) => { g[o.outlet] = (g[o.outlet] ?? 0) + o.total; });
    return Object.entries(g).map(([outlet, revenue]) => ({ outlet, revenue }));
  }, [paidOrders]);

  const topItems = useMemo(() => {
    const g: Record<string, { name: string; qty: number; revenue: number }> = {};
    paidOrders.forEach((o) => o.items.forEach((i) => {
      g[i.name] ??= { name: i.name, qty: 0, revenue: 0 };
      g[i.name].qty += i.qty;
      g[i.name].revenue += i.qty * i.price;
    }));
    return Object.values(g).sort((a, b) => b.qty - a.qty).slice(0, 8);
  }, [paidOrders]);

  const paymentMix = useMemo(() => {
    const methods = ["Cash", "Card", "UPI", "Room Charge"];
    return methods.map((m, i) => ({ name: m, value: Math.max(1, paidOrders.length > 0 ? Math.round(paidOrders.length * [0.25, 0.45, 0.2, 0.1][i]) : 0) }));
  }, [paidOrders]);

  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 14 }, (_, i) => i + 9);
    return hours.map((h) => ({
      hour: `${h}:00`,
      revenue: Math.round(Math.abs(Math.sin(h / 3)) * 15000 + (h >= 12 && h <= 14 ? 18000 : h >= 19 && h <= 21 ? 22000 : 3000)),
    }));
  }, []);

  // ── Cart helpers ──
  const addToCart = (m: MenuItem) =>
    setCart((prev) => {
      const ex = prev.find((c) => c.id === m.id);
      return ex ? prev.map((c) => c.id === m.id ? { ...c, qty: c.qty + 1 } : c) : [...prev, { id: m.id, name: m.name, qty: 1, price: m.price }];
    });
  const updateQty = (id: string, delta: number) =>
    setCart((prev) => prev.map((c) => c.id === id ? { ...c, qty: c.qty + delta } : c).filter((c) => c.qty > 0));
  const removeFromCart = (id: string) => setCart((prev) => prev.filter((c) => c.id !== id));
  const cartCount = (id: string) => cart.find((c) => c.id === id)?.qty ?? 0;

  const resetOrder = () => {
    setCart([]); setDiscountPct(0); setOrderNotes(""); setPayMethod("Cash");
    setCustomerName(""); setDeliveryPhone(""); setDeliveryAddress("");
    setActivePromoId(null); setSplitMode(false); setSplit1(""); setSplit2("");
  };

  const buildPayload = (status: POSOrder["status"]): Omit<POSOrder, "id" | "orderNumber" | "createdAt"> => ({
    outlet,
    channel: outlet === "Room Service" ? undefined : channel,
    table: channel === "Dine-In" && outlet !== "Room Service" ? table : channel === "Takeaway" ? (customerName || "Walk-in") : undefined,
    customerName: channel === "Takeaway" ? customerName || undefined : channel === "Delivery" ? customerName || undefined : undefined,
    deliveryAddress: channel === "Delivery" ? deliveryAddress || undefined : undefined,
    roomId: outlet === "Room Service" ? roomId : undefined,
    items: cart, status, total,
  });

  const handleSendKOT = () => {
    if (!cart.length) return;
    const snap = [...cart];
    addOrder(buildPayload("Sent"));
    if (channel === "Dine-In" && outlet !== "Room Service") setTableStatuses((p) => ({ ...p, [table]: "occupied" }));
    setKotItems(snap);
    setKotContext({ outlet, table: outlet !== "Room Service" ? table : undefined, channel: channel !== "Dine-In" ? channel : undefined });
    setKotModal(true);
    resetOrder();
  };

  const handlePay = () => {
    if (!cart.length) return;
    addOrder(buildPayload("Paid"));
    toast.success(`${fmtINR(total)} received via ${payMethod}`);
    resetOrder();
  };

  const switchOutlet = (o: Outlet) => {
    setOutlet(o); setCatFilter("All"); setSearch("");
    if (o === "Room Service") { setChannel("Dine-In"); return; }
    const tables = OUTLET_TABLES[o];
    if (tables.length) setTable(tables[0]);
    else setTable("");
  };

  const togglePromo = (promoId: string) => {
    const promo = PROMOTIONS.find((p) => p.id === promoId);
    if (!promo) return;
    if (activePromoId === promoId) {
      setActivePromoId(null);
      setDiscountPct(0);
    } else {
      setActivePromoId(promoId);
      setDiscountPct(promo.discountPct);
      toast.success(`${promo.name} applied — ${promo.discountPct}% off`);
    }
  };

  const openShift = () => {
    const f = Number(shiftFloat);
    if (!f || f < 0) { toast.error("Enter a valid opening float"); return; }
    const newShift: CashierShift = {
      id: `sh${Date.now()}`, cashierName: shiftName || "Admin",
      openedAt: new Date().toLocaleString("en-IN"),
      openingFloat: f, cashSales: 0, cardSales: 0, upiSales: 0, roomChargeSales: 0, status: "Open",
    };
    setCashierShifts((p) => [newShift, ...p]);
    toast.success(`Shift opened — float ${fmtINR(f)}`);
  };

  const closeShift = (shiftId: string) => {
    const cc = Number(closingCash);
    if (!closingCash || isNaN(cc)) { toast.error("Enter closing cash count"); return; }
    const shift = cashierShifts.find((s) => s.id === shiftId);
    if (!shift) return;
    const cashSales = paidOrders.filter((o) => o.total > 0).length * 850; // simplified
    setCashierShifts((p) => p.map((s) => s.id === shiftId ? { ...s, status: "Closed", closedAt: new Date().toLocaleString("en-IN"), closingCash: cc, cashSales } : s));
    toast.success("Shift closed successfully");
    setClosingCash("");
  };

  // ── Render ──
  return (
    <>
      <PageHeader title="POS & Restaurant" description="Orders, kitchen display, table management and analytics" />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <Stat label="Today's Revenue"  value={fmtINR(todayRevenue)} tone="success" hint="Paid orders" />
        <Stat label="Open Orders"      value={openOrders.length} tone={openOrders.length > 3 ? "warning" : "info"} hint="In kitchen / open" />
        <Stat label="Avg Ticket"       value={fmtINR(Math.round(todayRevenue / Math.max(paidOrders.length, 1)))} hint="Per paid order" />
        <Stat label="Active Tables"    value={Object.values(tableStatuses).filter((s) => s === "occupied").length} hint="Currently occupied" />
        <Stat label="Delivery Orders"  value={deliveryOrders.filter((o) => o.status !== "Paid").length} hint="Pending deliveries" tone={deliveryOrders.filter((o) => o.status !== "Paid").length > 0 ? "warning" : "info"} />
      </div>

      <Tabs defaultValue="new">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="new"><ShoppingBag className="size-3.5 mr-1.5" />New Order</TabsTrigger>
          <TabsTrigger value="tables"><LayoutGrid className="size-3.5 mr-1.5" />Tables</TabsTrigger>
          <TabsTrigger value="kitchen">
            <ChefHat className="size-3.5 mr-1.5" />Kitchen
            {filteredKOT.length > 0 && <Badge variant="destructive" className="ml-1.5 size-4 p-0 grid place-items-center text-[10px]">{filteredKOT.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="live">
            <Clock className="size-3.5 mr-1.5" />Live Orders
            {openOrders.length > 0 && <Badge variant="destructive" className="ml-1.5 size-4 p-0 grid place-items-center text-[10px]">{openOrders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="delivery">
            <Truck className="size-3.5 mr-1.5" />Delivery
            {deliveryOrders.filter((o) => o.status !== "Paid").length > 0 && <Badge variant="destructive" className="ml-1.5 size-4 p-0 grid place-items-center text-[10px]">{deliveryOrders.filter((o) => o.status !== "Paid").length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="history"><ReceiptText className="size-3.5 mr-1.5" />History</TabsTrigger>
          <TabsTrigger value="analytics"><TrendingUp className="size-3.5 mr-1.5" />Analytics</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="banquet"><Building2 className="size-3.5 mr-1.5" />Banquet</TabsTrigger>
          <TabsTrigger value="cashier"><Wallet className="size-3.5 mr-1.5" />Cashier</TabsTrigger>
        </TabsList>

        {/* ── NEW ORDER ─────────────────────────────────────────────────────── */}
        <TabsContent value="new">
          <div className="grid grid-cols-12 gap-4">
            {/* Left — menu panel */}
            <div className="col-span-12 lg:col-span-8 space-y-3">
              {/* Outlet selector */}
              <div className="flex gap-2 flex-wrap">
                {OUTLETS_LIST.map((o) => (
                  <button key={o} onClick={() => switchOutlet(o)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition ${outlet === o ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40 hover:bg-accent/5"}`}>
                    {OUTLET_ICON[o]} {o}
                  </button>
                ))}
              </div>

              {/* Order Channel selector (not for Room Service) */}
              {outlet !== "Room Service" && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium mr-1">Channel:</span>
                  {CHANNELS.map((ch) => {
                    const Icon = ch.icon;
                    return (
                      <button key={ch.id} onClick={() => setChannel(ch.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition ${channel === ch.id ? "bg-secondary text-secondary-foreground border-secondary" : "border-border hover:border-primary/40"}`}>
                        <Icon className="size-3" /> {ch.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Search + category filter */}
              <div className="flex gap-2 items-center flex-wrap">
                <div className="relative">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-8 h-8 w-48 text-sm" placeholder="Search menu…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="size-3 text-muted-foreground" /></button>}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {categories.map((cat) => (
                    <button key={cat} onClick={() => setCatFilter(cat)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition ${catFilter === cat ? "bg-secondary text-secondary-foreground border-secondary" : "border-border hover:border-muted-foreground/40"}`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <Card className="p-3">
                {filteredMenu.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">No items match</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                    {filteredMenu.map((m) => {
                      const qty = cartCount(m.id);
                      return (
                        <button key={m.id} onClick={() => addToCart(m)}
                          className={`relative border rounded-lg p-3 text-left transition ${qty > 0 ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-accent/5"}`}>
                          {qty > 0 && <span className="absolute top-2 right-2 size-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">{qty}</span>}
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{m.cat}</div>
                          <div className="font-medium text-sm leading-tight">{m.name}</div>
                          {m.desc && <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight line-clamp-1">{m.desc}</div>}
                          <div className="text-sm font-semibold mt-1.5 text-primary">{fmtINR(m.price)}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* Right — order ticket */}
            <Card className="col-span-12 lg:col-span-4 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                  {OUTLET_ICON[outlet]}<span>{outlet}</span>
                  {outlet !== "Room Service" && channel !== "Dine-In" && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      {channel === "Delivery" && <Truck className="size-2.5" />}
                      {channel === "Takeaway" && <Package className="size-2.5" />}
                      {channel === "Banquet" && <Building2 className="size-2.5" />}
                      {channel}
                    </Badge>
                  )}
                </div>
                {cart.length > 0 && <button onClick={resetOrder} className="text-xs text-muted-foreground hover:text-destructive transition">Clear all</button>}
              </div>

              {/* Channel-specific location fields */}
              {outlet === "Room Service" ? (
                <div className="space-y-1">
                  <Label className="text-xs">Room</Label>
                  <Select value={roomId} onValueChange={setRoomId}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select room" /></SelectTrigger>
                    <SelectContent>{rooms.map((r) => <SelectItem key={r.id} value={r.id}>Room {r.number} — {r.type}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : channel === "Delivery" ? (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Customer Name</Label>
                    <Input className="h-7 text-xs" placeholder="Full name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1"><Phone className="size-3" />Phone</Label>
                    <Input className="h-7 text-xs" placeholder="+91 …" value={deliveryPhone} onChange={(e) => setDeliveryPhone(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1"><MapPin className="size-3" />Delivery Address</Label>
                    <Input className="h-7 text-xs" placeholder="Full address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1"><Bike className="size-3" />Assign Rider</Label>
                    <Select value={deliveryRiderId} onValueChange={setDeliveryRiderId}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RIDERS.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name} {r.available ? "✓" : "• On delivery"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : channel === "Takeaway" ? (
                <div className="space-y-1">
                  <Label className="text-xs">Customer Name / Token</Label>
                  <Input className="h-8 text-sm" placeholder="Walk-in or name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>
              ) : channel === "Banquet" ? (
                <div className="space-y-1">
                  <Label className="text-xs">Banquet Event</Label>
                  <Select value={banquetEventRef} onValueChange={setBanquetEventRef}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {banquetEvents.filter((e) => e.status !== "Cancelled" && e.status !== "Completed").map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.name} — {e.hall}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Table</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {OUTLET_TABLES[outlet].map((t) => (
                      <button key={t} onClick={() => setTable(t)}
                        className={`px-2 py-1 rounded text-xs font-mono border transition ${table === t ? "bg-primary text-primary-foreground border-primary" : tableStatuses[t] === "occupied" ? "border-destructive/40 text-destructive" : "hover:border-primary/50"}`}>
                        {t}
                        {tableStatuses[t] === "occupied" && <span className="ml-1 size-1.5 rounded-full bg-destructive inline-block" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Server */}
              <div className="space-y-1">
                <Label className="text-xs">Server</Label>
                <Select value={waiter} onValueChange={setWaiter}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{WAITERS.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Cart */}
              <div className="flex-1 min-h-[120px] max-h-[240px] overflow-y-auto space-y-2">
                {cart.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">Tap menu items to add</div>
                ) : (
                  cart.map((c) => (
                    <div key={c.id} className="text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{fmtINR(c.price)} each</div>
                          {c.note && <div className="text-[10px] text-info italic">↳ {c.note}</div>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => updateQty(c.id, -1)} className="size-6 rounded border flex items-center justify-center hover:bg-accent"><Minus className="size-3" /></button>
                          <span className="w-5 text-center font-medium">{c.qty}</span>
                          <button onClick={() => updateQty(c.id, +1)} className="size-6 rounded border flex items-center justify-center hover:bg-accent"><Plus className="size-3" /></button>
                          <button onClick={() => { setNoteItemId(c.id); setNoteText(c.note ?? ""); }} className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-primary" title="Add note"><ReceiptText className="size-3" /></button>
                          <button onClick={() => removeFromCart(c.id)} className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <Label className="text-xs">Order notes</Label>
                    <Input className="h-7 text-xs" placeholder="Allergies, special requests…" value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} />
                  </div>

                  {/* Promotions */}
                  <div>
                    <Label className="text-xs flex items-center gap-1 mb-1.5"><Tag className="size-3" />Promotions</Label>
                    <div className="space-y-1">
                      {PROMOTIONS.map((promo) => (
                        <button key={promo.id} onClick={() => togglePromo(promo.id)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md border text-xs transition ${activePromoId === promo.id ? "bg-success/10 border-success/40 text-success" : "hover:border-primary/30 text-muted-foreground hover:text-foreground"}`}>
                          <span className="font-medium">{promo.name} {promo.condition && <span className="font-normal opacity-70">· {promo.condition}</span>}</span>
                          <span className={`font-bold shrink-0 ml-2 ${activePromoId === promo.id ? "text-success" : "text-primary"}`}>{promo.discountPct}% off</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Discount + GST */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs shrink-0">Discount %</Label>
                    <Input type="number" min={0} max={100} className="h-7 text-xs w-20" value={discountPct || ""} placeholder="0" onChange={(e) => { setDiscountPct(Math.min(100, Math.max(0, Number(e.target.value)))); setActivePromoId(null); }} />
                    <button onClick={() => setTaxEnabled((v) => !v)} className={`ml-auto text-xs px-2 py-1 rounded border transition ${taxEnabled ? "bg-primary/10 border-primary/40 text-primary" : "text-muted-foreground"}`}>GST 18%</button>
                  </div>

                  {/* Totals */}
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmtINR(subtotal)}</span></div>
                    {discountAmt > 0 && <div className="flex justify-between text-success"><span>Discount ({discountPct}%){activePromoId && ` · ${PROMOTIONS.find(p => p.id === activePromoId)?.name}`}</span><span>−{fmtINR(discountAmt)}</span></div>}
                    {taxEnabled && <div className="flex justify-between text-muted-foreground"><span>CGST 9% + SGST 9%</span><span>{fmtINR(tax)}</span></div>}
                    <div className="flex justify-between font-semibold text-base pt-1 border-t"><span>Total</span><span>{fmtINR(total)}</span></div>
                  </div>

                  {/* Payment */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className="text-xs">Payment</Label>
                      <button onClick={() => setSplitMode((v) => !v)} className={`text-[10px] px-1.5 py-0.5 rounded border transition ${splitMode ? "bg-primary/10 text-primary border-primary/40" : "text-muted-foreground hover:border-muted-foreground/40"}`}>Split</button>
                    </div>
                    {splitMode ? (
                      <div className="space-y-2">
                        <div className="flex gap-1.5 items-center">
                          <Select value={payMethod} onValueChange={(v) => setPayMethod(v as PayMethod)}>
                            <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                            <SelectContent>{PAY_METHODS.map((pm) => <SelectItem key={pm.id} value={pm.id}>{pm.label}</SelectItem>)}</SelectContent>
                          </Select>
                          <Input type="number" className="h-7 w-20 text-xs" placeholder="Amt" value={split1} onChange={(e) => { setSplit1(e.target.value); setSplit2(String(total - Number(e.target.value))); }} />
                        </div>
                        <div className="flex gap-1.5 items-center">
                          <Select value={payMethod2} onValueChange={(v) => setPayMethod2(v as PayMethod)}>
                            <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                            <SelectContent>{PAY_METHODS.map((pm) => <SelectItem key={pm.id} value={pm.id}>{pm.label}</SelectItem>)}</SelectContent>
                          </Select>
                          <Input type="number" className="h-7 w-20 text-xs" placeholder="Amt" value={split2} onChange={(e) => setSplit2(e.target.value)} />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5">
                        {PAY_METHODS.map((pm) => {
                          const Icon = pm.icon;
                          return (
                            <button key={pm.id} onClick={() => setPayMethod(pm.id)}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition ${payMethod === pm.id ? "bg-primary text-primary-foreground border-primary" : "hover:border-primary/40"}`}>
                              <Icon className="size-3.5" /> {pm.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={handleSendKOT} className="gap-1.5"><ChefHat className="size-4" /> Send KOT</Button>
                    <Button onClick={handlePay} className="gap-1.5"><CreditCard className="size-4" /> Pay {fmtINR(total)}</Button>
                  </div>
                </>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* ── TABLE MANAGEMENT ──────────────────────────────────────────────── */}
        <TabsContent value="tables">
          <div className="flex gap-3 mb-3 flex-wrap text-xs">
            {(Object.entries(TABLE_STATUS_META) as [TableStatus, typeof TABLE_STATUS_META[TableStatus]][]).map(([s, m]) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`size-3 rounded border ${m.bg}`} />
                <span className={m.color}>{m.label}</span>
                <span className="text-muted-foreground">({Object.values(tableStatuses).filter((v) => v === s).length})</span>
              </div>
            ))}
          </div>
          {(["Restaurant", "Bar", "Spa"] as Outlet[]).map((out) => (
            <div key={out} className="mb-5">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5">{OUTLET_ICON[out]} {out}</h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                {ALL_TABLES.filter((t) => t.outlet === out).map((t) => {
                  const status = tableStatuses[t.id] ?? "available";
                  const meta = TABLE_STATUS_META[status];
                  const order = openOrders.find((o) => o.table === t.id);
                  return (
                    <button key={t.id} onClick={() => setSelectedTable(t.id)}
                      className={`border rounded-lg p-2.5 text-center transition-all ${meta.bg} ${selectedTable === t.id ? "ring-2 ring-primary" : ""}`}>
                      <div className="font-mono font-bold text-sm">{t.id}</div>
                      <div className={`text-[10px] font-medium ${meta.color}`}>{meta.label}</div>
                      <div className="text-[10px] text-muted-foreground">{t.seats} seats</div>
                      {order && <div className="text-[10px] text-info mt-0.5">{fmtINR(order.total)}</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {selectedTable && (
            <Card className="p-4 mt-2 border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Table {selectedTable}</h3>
                <Button size="sm" variant="ghost" onClick={() => setSelectedTable(null)}><X className="size-4" /></Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {(["available", "occupied", "reserved", "cleaning"] as TableStatus[]).map((s) => (
                  <Button key={s} size="sm" variant={tableStatuses[selectedTable] === s ? "default" : "outline"}
                    onClick={() => { setTableStatuses((p) => ({ ...p, [selectedTable!]: s })); toast.success(`${selectedTable} → ${TABLE_STATUS_META[s].label}`); }}>
                    {TABLE_STATUS_META[s].label}
                  </Button>
                ))}
                <div className="flex items-center gap-2 ml-auto">
                  <Label className="text-xs">Covers</Label>
                  <Input type="number" min={0} max={20} className="h-7 w-16 text-xs"
                    value={tableCovers[selectedTable] ?? ""} placeholder="0"
                    onChange={(e) => setTableCovers((p) => ({ ...p, [selectedTable!]: Number(e.target.value) }))} />
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ── KITCHEN DISPLAY ───────────────────────────────────────────────── */}
        <TabsContent value="kitchen">
          {/* Station filter */}
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <span className="text-xs text-muted-foreground font-medium mr-1">Station:</span>
            {KITCHEN_STATIONS.map((station) => (
              <button key={station} onClick={() => setKdsStation(station)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition ${kdsStation === station ? "bg-secondary text-secondary-foreground border-secondary" : "hover:border-muted-foreground/40"}`}>
                {station}
              </button>
            ))}
          </div>

          {filteredKOT.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              <CheckCircle2 className="size-10 mx-auto mb-3 opacity-30" />
              <p>{kdsStation === "All" ? "Kitchen is clear — no pending tickets." : `No orders pending at ${kdsStation} station.`}</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredKOT.map((o) => {
                const elapsedMins = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000);
                const urgency = elapsedMins >= 15 ? "destructive" : elapsedMins >= 8 ? "warning" : "success";
                const urgencyClass = urgency === "destructive" ? "border-destructive bg-destructive/5 animate-pulse" : urgency === "warning" ? "border-warning bg-warning/5" : "border-success/40 bg-success/5";
                return (
                  <Card key={o.id} className={`p-4 border-2 ${urgencyClass}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-base">
                          {OUTLET_ICON[o.outlet as Outlet]} {o.outlet}
                        </div>
                        <div className="font-mono text-sm text-muted-foreground flex items-center gap-1.5">
                          {o.table ?? "Room Svc"}
                          {o.channel && o.channel !== "Dine-In" && <Badge variant="outline" className="text-[9px] px-1">{o.channel}</Badge>}
                        </div>
                      </div>
                      <div className={`flex items-center gap-1 text-sm font-semibold ${urgency === "destructive" ? "text-destructive" : urgency === "warning" ? "text-warning-foreground" : "text-success"}`}>
                        <Timer className="size-4" />{elapsedMins}m
                      </div>
                    </div>
                    <div className="space-y-1.5 mb-3">
                      {o.items.map((i) => {
                        const itemStation = getItemStation(i.name);
                        const highlight = kdsStation === "All" || itemStation === kdsStation;
                        return (
                          <div key={i.name} className={`flex items-center justify-between text-sm transition ${!highlight ? "opacity-30" : ""}`}>
                            <span className="font-medium">{i.qty}× {i.name}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {i.note && <span className="text-xs text-muted-foreground italic">{i.note}</span>}
                              <Badge variant="outline" className="text-[9px] px-1">{itemStation}</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {urgency === "destructive" && (
                      <div className="flex items-center gap-1 text-xs text-destructive mb-2">
                        <AlertCircle className="size-3.5" /> Overdue — {elapsedMins} min
                      </div>
                    )}
                    <Button size="sm" className="w-full gap-1.5" onClick={() => { updateOrder(o.id, { status: "Paid" }); toast.success("Order marked ready & served"); }}>
                      <CheckCircle2 className="size-4" /> Mark Ready &amp; Served
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── LIVE ORDERS ───────────────────────────────────────────────────── */}
        <TabsContent value="live">
          {openOrders.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              <CheckCircle2 className="size-10 mx-auto mb-3 opacity-30" />
              <p>No open orders — all clear!</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {openOrders.map((o) => <LiveOrderCard key={o.id} order={o} onUpdate={updateOrder} />)}
            </div>
          )}
        </TabsContent>

        {/* ── DELIVERY ──────────────────────────────────────────────────────── */}
        <TabsContent value="delivery">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-success inline-block" /> {RIDERS.filter((r) => r.available).length} riders available</span>
                <span className="flex items-center gap-1.5"><Truck className="size-3.5" />{deliveryOrders.filter((o) => o.status !== "Paid").length} active deliveries</span>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => toast.info("Use New Order → Delivery channel")}>
                <Plus className="size-4" />New Delivery Order
              </Button>
            </div>

            {/* Rider availability */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {RIDERS.map((r) => (
                <Card key={r.id} className={`p-3 text-sm ${r.available ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"}`}>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.phone}</div>
                  <Badge className={`mt-1.5 text-[10px] ${r.available ? "bg-success/15 text-success border-success/30" : "bg-warning/20 text-warning-foreground border-warning/30"}`}>
                    {r.available ? "Available" : "On Delivery"}
                  </Badge>
                </Card>
              ))}
            </div>

            {/* Delivery order cards */}
            {deliveryOrders.length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">
                <Truck className="size-10 mx-auto mb-3 opacity-30" />
                <p>No delivery orders yet.</p>
                <p className="text-xs mt-1">Create orders using New Order → Delivery channel.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {deliveryOrders.map((o) => {
                  const elapsedMins = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000);
                  const slaPct = Math.min(100, Math.round((elapsedMins / 30) * 100));
                  const assignedRider = riderAssignments[o.id];
                  const riderInfo = RIDERS.find((r) => r.id === assignedRider);
                  return (
                    <Card key={o.id} className={`p-4 ${o.status === "Paid" ? "opacity-60" : ""}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-semibold text-sm">{o.customerName ?? "Customer"}</div>
                          <div className="text-xs text-muted-foreground font-mono">{o.orderNumber}</div>
                        </div>
                        <Badge className={`text-[10px] border ${o.status === "Paid" ? "bg-muted text-muted-foreground border-border" : o.status === "Sent" ? "bg-info/15 text-info border-info/30" : "bg-warning/20 text-warning-foreground border-warning/30"}`}>
                          {o.status === "Paid" ? "Delivered" : o.status === "Sent" ? "On the way" : "Preparing"}
                        </Badge>
                      </div>
                      {o.deliveryAddress && (
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground mb-2">
                          <MapPin className="size-3 mt-0.5 shrink-0" />{o.deliveryAddress}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mb-2">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</div>
                      <div className="flex justify-between text-sm font-semibold mb-3"><span>Total</span><span>{fmtINR(o.total)}</span></div>

                      {/* SLA progress */}
                      {o.status !== "Paid" && (
                        <div className="mb-3">
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                            <span>SLA Progress</span><span>{elapsedMins}m / 30m est.</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${slaPct >= 90 ? "bg-destructive" : slaPct >= 70 ? "bg-warning" : "bg-success"}`} style={{ width: `${slaPct}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Rider assignment */}
                      {o.status !== "Paid" && (
                        <div className="flex gap-2 items-center">
                          <Select value={assignedRider ?? ""} onValueChange={(v) => { setRiderAssignments((p) => ({ ...p, [o.id]: v })); toast.success(`Rider ${RIDERS.find(r => r.id === v)?.name} assigned`); }}>
                            <SelectTrigger className="h-7 text-xs flex-1">
                              <SelectValue placeholder={riderInfo ? riderInfo.name : "Assign rider"} />
                            </SelectTrigger>
                            <SelectContent>{RIDERS.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <Button size="sm" className="h-7 px-2 gap-1 text-xs" onClick={() => { updateOrder(o.id, { status: "Paid" }); toast.success("Order marked delivered"); }}>
                            <CheckCircle2 className="size-3.5" />Delivered
                          </Button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── HISTORY ────────────────────────────────────────────────────────── */}
        <TabsContent value="history">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8 h-8 w-56 text-sm" placeholder="Search history…" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} />
              </div>
              <Badge variant="outline" className="text-xs">{paidOrders.length} orders · {fmtINR(todayRevenue)}</Badge>
            </div>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {["#","Channel","Outlet","Table / Customer","Items","Total","Time",""].map((h) => (
                        <th key={h} className={`px-4 py-3 text-xs font-medium text-muted-foreground ${h === "Total" ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paidOrders
                      .filter((o) => !historySearch || o.outlet.toLowerCase().includes(historySearch.toLowerCase()) || (o.table ?? "").toLowerCase().includes(historySearch.toLowerCase()) || (o.customerName ?? "").toLowerCase().includes(historySearch.toLowerCase()) || o.items.some((i) => i.name.toLowerCase().includes(historySearch.toLowerCase())))
                      .map((o, idx) => (
                        <tr key={o.id} className="border-b last:border-0 hover:bg-accent/5">
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{o.orderNumber ?? `#${String(paidOrders.length - idx).padStart(4, "0")}`}</td>
                          <td className="px-4 py-3">
                            {o.channel && o.channel !== "Dine-In" ? (
                              <Badge variant="outline" className="text-[9px] px-1.5">{o.channel}</Badge>
                            ) : <span className="text-xs text-muted-foreground">Dine-In</span>}
                          </td>
                          <td className="px-4 py-3"><div className="flex items-center gap-1.5">{OUTLET_ICON[o.outlet as Outlet]}{o.outlet}</div></td>
                          <td className="px-4 py-3 font-mono text-xs">{o.customerName ?? o.table ?? "Room Svc"}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px] truncate">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</td>
                          <td className="px-4 py-3 text-right font-semibold">{fmtINR(o.total)}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{o.createdAt}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={() => setReceiptOrder(o)}><Printer className="size-3" />Bill</Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-destructive hover:text-destructive" onClick={() => { setVoidId(o.id); setVoidReason(""); }}><X className="size-3" />Void</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    {paidOrders.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">No paid orders yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ── ANALYTICS ──────────────────────────────────────────────────────── */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Revenue by Outlet</h3>
              {revenueByOutlet.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data yet — place and pay orders first.</div>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer>
                    <BarChart data={revenueByOutlet}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="outlet" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip formatter={(v: number) => [fmtINR(v), "Revenue"]} />
                      <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Revenue ₹" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Payment Method Mix</h3>
              <div className="h-48">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={paymentMix} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>
                      {paymentMix.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Legend iconType="circle" iconSize={8} />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
          <Card className="p-5 mb-4">
            <h3 className="font-semibold mb-4">Simulated Hourly Revenue Trend</h3>
            <div className="h-52">
              <ResponsiveContainer>
                <AreaChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="hour" fontSize={10} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: number) => [fmtINR(v), "Revenue"]} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.2} name="Revenue ₹" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          {topItems.length > 0 && (
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Top Selling Items</h3>
              <div className="h-52">
                <ResponsiveContainer>
                  <BarChart data={topItems} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                    <XAxis type="number" fontSize={11} />
                    <YAxis dataKey="name" type="category" fontSize={10} width={110} />
                    <Tooltip formatter={(v: number) => [v, "Qty sold"]} />
                    <Bar dataKey="qty" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} name="Qty" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ── TABLE RESERVATIONS ────────────────────────────────────────────── */}
        <TabsContent value="reservations">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">{tableReservations.filter((r) => r.status === "Confirmed").length} confirmed reservations</p>
            <Button size="sm" className="gap-1.5" onClick={() => setTableResOpen(true)}><Plus className="size-4" />New Reservation</Button>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Date", "Time", "Table", "Guest", "Phone", "Covers", "Status", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableReservations.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-accent/5">
                      <td className="px-4 py-3 text-xs">{r.date}</td>
                      <td className="px-4 py-3 font-medium">{r.time}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.table}</td>
                      <td className="px-4 py-3">{r.name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.phone}</td>
                      <td className="px-4 py-3 text-center">{r.guests}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] ${r.status === "Confirmed" ? "bg-success/15 text-success border-success/30" : "bg-warning/20 text-warning-foreground border-warning/30"}`}>{r.status}</Badge>
                      </td>
                      <td className="px-4 py-3 flex gap-1">
                        {r.status === "Pending" && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { setTableReservations((p) => p.map((x) => x.id === r.id ? { ...x, status: "Confirmed" } : x)); toast.success("Reservation confirmed"); }}>Confirm</Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => { setTableReservations((p) => p.filter((x) => x.id !== r.id)); toast.success("Reservation cancelled"); }}>Cancel</Button>
                      </td>
                    </tr>
                  ))}
                  {tableReservations.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">No reservations yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ── BANQUET ───────────────────────────────────────────────────────── */}
        <TabsContent value="banquet">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span><strong className="text-foreground">{banquetEvents.filter(e => e.status === "Confirmed").length}</strong> confirmed</span>
              <span><strong className="text-foreground">{banquetEvents.filter(e => e.status === "Tentative").length}</strong> tentative</span>
              <span><strong className="text-foreground">{fmtINR(banquetEvents.reduce((s, e) => s + e.advance, 0))}</strong> advances received</span>
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => { setNewBanquet({ ...BLANK_BANQUET }); setBanquetDialogOpen(true); }}>
              <Plus className="size-4" />New Event
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {banquetEvents.map((ev) => (
              <Card key={ev.id} className="p-4 flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold leading-tight truncate">{ev.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{ev.hall}</div>
                  </div>
                  <Badge className={`text-[10px] border shrink-0 ${BANQUET_STATUS_META[ev.status].color}`}>{ev.status}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground"><CalendarDays className="size-3" />{ev.date} {ev.time}</div>
                  <div className="flex items-center gap-1 text-muted-foreground"><Users className="size-3" />{ev.covers} covers</div>
                  <div className="flex items-center gap-1 text-muted-foreground"><Phone className="size-3" />{ev.contactName}</div>
                  <div className="flex items-center gap-1 text-muted-foreground">{ev.phone}</div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <div><span className="text-muted-foreground">Package:</span> <span className="font-medium">{ev.package || "—"}</span></div>
                  <div><span className="text-muted-foreground">Total:</span> <span className="font-semibold text-foreground">{fmtINR(ev.total)}</span></div>
                  <div><span className="text-muted-foreground">Advance:</span> <span className="text-success font-medium">{fmtINR(ev.advance)}</span></div>
                  <div><span className="text-muted-foreground">Balance:</span> <span className={`font-medium ${ev.total - ev.advance > 0 ? "text-warning-foreground" : "text-muted-foreground"}`}>{fmtINR(Math.max(0, ev.total - ev.advance))}</span></div>
                </div>
                <div className="flex gap-1.5 mt-auto pt-1">
                  {ev.status === "Tentative" && (
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => { setBanquetEvents((p) => p.map((e) => e.id === ev.id ? { ...e, status: "Confirmed" } : e)); toast.success("Event confirmed"); }}>Confirm</Button>
                  )}
                  {ev.status === "Confirmed" && (
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => { setBanquetEvents((p) => p.map((e) => e.id === ev.id ? { ...e, status: "In Progress" } : e)); toast.success("Event started"); }}>Start Event</Button>
                  )}
                  {ev.status === "In Progress" && (
                    <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => { setBanquetEvents((p) => p.map((e) => e.id === ev.id ? { ...e, status: "Completed" } : e)); toast.success("Event completed"); }}>Complete</Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => { setBanquetEvents((p) => p.map((e) => e.id === ev.id ? { ...e, status: "Cancelled" } : e)); toast.success("Event cancelled"); }}>
                    Cancel
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── CASHIER SHIFT ─────────────────────────────────────────────────── */}
        <TabsContent value="cashier">
          {!currentShift ? (
            <div className="max-w-sm mx-auto">
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="size-10 rounded-full bg-primary/10 grid place-items-center"><Wallet className="size-5 text-primary" /></div>
                  <div>
                    <h3 className="font-semibold">Open Cashier Shift</h3>
                    <p className="text-xs text-muted-foreground">Count and enter your opening float to begin</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Cashier Name</Label>
                    <Input className="h-8 mt-1" placeholder="Your name" value={shiftName} onChange={(e) => setShiftName(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Opening Float (₹)</Label>
                    <Input type="number" min={0} className="h-8 mt-1" placeholder="5000" value={shiftFloat} onChange={(e) => setShiftFloat(e.target.value)} />
                  </div>
                  <Button className="w-full gap-1.5 mt-2" onClick={openShift}><Zap className="size-4" />Open Shift</Button>
                </div>
              </Card>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Active Shift — {currentShift.cashierName}</h3>
                  <p className="text-xs text-muted-foreground">Opened: {currentShift.openedAt}</p>
                </div>
                <Badge className="bg-success/15 text-success border-success/30">Shift Open</Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Opening Float</div>
                  <div className="text-xl font-bold">{fmtINR(currentShift.openingFloat)}</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Cash Sales</div>
                  <div className="text-xl font-bold text-success">{fmtINR(paidOrders.filter((o) => o.total > 0).length * 820)}</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Card + UPI Sales</div>
                  <div className="text-xl font-bold">{fmtINR(todayRevenue - paidOrders.filter((o) => o.total > 0).length * 820)}</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Expected Closing</div>
                  <div className="text-xl font-bold text-primary">{fmtINR(currentShift.openingFloat + paidOrders.filter((o) => o.total > 0).length * 820)}</div>
                </Card>
              </div>

              <Card className="p-5">
                <h4 className="font-semibold mb-3">Payment Breakdown — This Shift</h4>
                <div className="space-y-2">
                  {[
                    { label: "Cash", value: paidOrders.filter((o) => o.total > 0).length * 820 },
                    { label: "Card", value: Math.round(todayRevenue * 0.45) },
                    { label: "UPI", value: Math.round(todayRevenue * 0.20) },
                    { label: "Room Charge", value: Math.round(todayRevenue * 0.10) },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center gap-3">
                      <span className="text-sm w-24 shrink-0">{row.label}</span>
                      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, Math.round((row.value / Math.max(todayRevenue, 1)) * 100))}%` }} />
                      </div>
                      <span className="text-sm font-medium w-20 text-right shrink-0">{fmtINR(row.value)}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5 border-warning/30">
                <h4 className="font-semibold mb-3">Close Shift</h4>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Label className="text-xs">Closing Cash Count (₹)</Label>
                    <Input type="number" min={0} className="h-8 mt-1" placeholder="Enter physical cash count" value={closingCash} onChange={(e) => setClosingCash(e.target.value)} />
                  </div>
                  {closingCash && (
                    <div className="text-right text-sm mb-0.5">
                      <div className="text-xs text-muted-foreground">Variance</div>
                      <div className={`font-semibold ${Number(closingCash) - (currentShift.openingFloat + paidOrders.filter((o) => o.total > 0).length * 820) >= 0 ? "text-success" : "text-destructive"}`}>
                        {fmtINR(Number(closingCash) - (currentShift.openingFloat + paidOrders.filter((o) => o.total > 0).length * 820))}
                      </div>
                    </div>
                  )}
                  <Button variant="outline" className="gap-1.5" onClick={() => closeShift(currentShift.id)} disabled={!closingCash}>
                    <CheckCircle2 className="size-4" />Close Shift
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* Shift history */}
          {cashierShifts.filter((s) => s.status === "Closed").length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold mb-3 text-sm">Shift History</h4>
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        {["Cashier", "Opened", "Closed", "Float", "Cash Sales", "Closing", "Variance"].map((h) => (
                          <th key={h} className="px-4 py-3 text-xs font-medium text-muted-foreground text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cashierShifts.filter((s) => s.status === "Closed").map((s) => {
                        const variance = (s.closingCash ?? 0) - s.openingFloat - s.cashSales;
                        return (
                          <tr key={s.id} className="border-b last:border-0 hover:bg-accent/5">
                            <td className="px-4 py-3 font-medium">{s.cashierName}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{s.openedAt}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{s.closedAt ?? "—"}</td>
                            <td className="px-4 py-3">{fmtINR(s.openingFloat)}</td>
                            <td className="px-4 py-3 text-success">{fmtINR(s.cashSales)}</td>
                            <td className="px-4 py-3">{s.closingCash != null ? fmtINR(s.closingCash) : "—"}</td>
                            <td className={`px-4 py-3 font-semibold ${variance >= 0 ? "text-success" : "text-destructive"}`}>{s.closingCash != null ? `${variance >= 0 ? "+" : ""}${fmtINR(variance)}` : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── New Table Reservation Dialog ── */}
      <Dialog open={tableResOpen} onOpenChange={setTableResOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Book a Table</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Date</Label><Input type="date" className="h-8 mt-1" value={newTR.date} onChange={(e) => setNewTR({ ...newTR, date: e.target.value })} /></div>
            <div><Label className="text-xs">Time</Label><Input type="time" className="h-8 mt-1" value={newTR.time} onChange={(e) => setNewTR({ ...newTR, time: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Table</Label>
              <select className="mt-1 h-8 w-full border rounded px-2 text-sm bg-background" value={newTR.table} onChange={(e) => setNewTR({ ...newTR, table: e.target.value })}>
                {OUTLET_TABLES.Restaurant.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><Label className="text-xs">Covers</Label><Input type="number" min={1} max={12} className="h-8 mt-1" value={newTR.guests} onChange={(e) => setNewTR({ ...newTR, guests: e.target.value })} /></div>
            <div className="col-span-2"><Label className="text-xs">Guest Name</Label><Input className="h-8 mt-1" placeholder="Full name" value={newTR.name} onChange={(e) => setNewTR({ ...newTR, name: e.target.value })} /></div>
            <div className="col-span-2"><Label className="text-xs">Phone</Label><Input className="h-8 mt-1" placeholder="+91 …" value={newTR.phone} onChange={(e) => setNewTR({ ...newTR, phone: e.target.value })} /></div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setTableResOpen(false)}>Cancel</Button>
            <Button className="flex-1" disabled={!newTR.date || !newTR.time || !newTR.name}
              onClick={() => {
                setTableReservations((p) => [...p, { id: `tr${Date.now()}`, date: newTR.date, time: newTR.time, table: newTR.table, guests: Number(newTR.guests), name: newTR.name, phone: newTR.phone, status: "Confirmed" }]);
                toast.success(`Table ${newTR.table} reserved for ${newTR.name}`);
                setTableResOpen(false);
                setNewTR({ date: "", time: "", table: "T-01", guests: "2", name: "", phone: "" });
              }}>Reserve</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── New Banquet Event Dialog ── */}
      <Dialog open={banquetDialogOpen} onOpenChange={setBanquetDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Banquet Event</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Event Name *</Label>
              <Input className="h-8 mt-1" placeholder="e.g. Singh Wedding Reception" value={newBanquet.name} onChange={(e) => setNewBanquet({ ...newBanquet, name: e.target.value })} />
            </div>
            <div><Label className="text-xs">Date</Label><Input type="date" className="h-8 mt-1" value={newBanquet.date} onChange={(e) => setNewBanquet({ ...newBanquet, date: e.target.value })} /></div>
            <div><Label className="text-xs">Time</Label><Input type="time" className="h-8 mt-1" value={newBanquet.time} onChange={(e) => setNewBanquet({ ...newBanquet, time: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Hall</Label>
              <select className="mt-1 h-8 w-full border rounded px-2 text-sm bg-background" value={newBanquet.hall} onChange={(e) => setNewBanquet({ ...newBanquet, hall: e.target.value })}>
                {BANQUET_HALLS.map((h) => <option key={h}>{h}</option>)}
              </select>
            </div>
            <div><Label className="text-xs">Covers</Label><Input type="number" min={1} className="h-8 mt-1" value={newBanquet.covers} onChange={(e) => setNewBanquet({ ...newBanquet, covers: e.target.value })} /></div>
            <div className="col-span-2"><Label className="text-xs">Contact Name</Label><Input className="h-8 mt-1" placeholder="Guest / organiser name" value={newBanquet.contactName} onChange={(e) => setNewBanquet({ ...newBanquet, contactName: e.target.value })} /></div>
            <div><Label className="text-xs">Phone</Label><Input className="h-8 mt-1" value={newBanquet.phone} onChange={(e) => setNewBanquet({ ...newBanquet, phone: e.target.value })} /></div>
            <div><Label className="text-xs">Package</Label><Input className="h-8 mt-1" placeholder="Package name" value={newBanquet.package} onChange={(e) => setNewBanquet({ ...newBanquet, package: e.target.value })} /></div>
            <div><Label className="text-xs">Advance (₹)</Label><Input type="number" min={0} className="h-8 mt-1" value={newBanquet.advance} onChange={(e) => setNewBanquet({ ...newBanquet, advance: e.target.value })} /></div>
            <div><Label className="text-xs">Total (₹)</Label><Input type="number" min={0} className="h-8 mt-1" value={newBanquet.total} onChange={(e) => setNewBanquet({ ...newBanquet, total: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanquetDialogOpen(false)}>Cancel</Button>
            <Button disabled={!newBanquet.name || !newBanquet.date || !newBanquet.contactName}
              onClick={() => {
                setBanquetEvents((p) => [...p, { id: `be${Date.now()}`, name: newBanquet.name, date: newBanquet.date, time: newBanquet.time, hall: newBanquet.hall, covers: Number(newBanquet.covers) || 0, contactName: newBanquet.contactName, phone: newBanquet.phone, package: newBanquet.package, advance: Number(newBanquet.advance) || 0, total: Number(newBanquet.total) || 0, status: "Tentative" }]);
                toast.success(`Event "${newBanquet.name}" added`);
                setBanquetDialogOpen(false);
                setNewBanquet({ ...BLANK_BANQUET });
              }}>
              Add Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Void Order Dialog ── */}
      <Dialog open={!!voidId} onOpenChange={() => setVoidId(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Void Order</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will mark the order as voided. Please enter a reason.</p>
          <Input placeholder="Reason for void (e.g. Wrong order, Guest complaint)" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setVoidId(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" disabled={!voidReason.trim()}
              onClick={() => { updateOrder(voidId!, { status: "Open" }); toast.success("Order voided"); setVoidId(null); setVoidReason(""); }}>
              Void Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Item Note Dialog ── */}
      <Dialog open={!!noteItemId} onOpenChange={() => setNoteItemId(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Item Note</DialogTitle></DialogHeader>
          <Input placeholder="e.g. No onion, extra spicy…" value={noteText} onChange={(e) => setNoteText(e.target.value)} autoFocus />
          <Button onClick={() => { setCart((prev) => prev.map((c) => c.id === noteItemId ? { ...c, note: noteText || undefined } : c)); setNoteItemId(null); }}>Save Note</Button>
        </DialogContent>
      </Dialog>

      {/* ── KOT Modal ── */}
      <Dialog open={kotModal} onOpenChange={setKotModal}>
        <KOTModal order={{ ...kotContext, items: kotItems }} onClose={() => setKotModal(false)} />
      </Dialog>

      {/* ── Receipt Modal ── */}
      {receiptOrder && (
        <Dialog open={!!receiptOrder} onOpenChange={() => setReceiptOrder(null)}>
          <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
        </Dialog>
      )}
    </>
  );
}

// ── Live Order Card ────────────────────────────────────────────────────────────
function LiveOrderCard({ order, onUpdate }: { order: POSOrder; onUpdate: (id: string, patch: Partial<POSOrder>) => void }) {
  const statusColor: Record<string, string> = {
    Open: "bg-warning/15 text-warning-foreground border-warning/30",
    Sent: "bg-info/15 text-info border-info/30",
    Paid: "bg-success/15 text-success border-success/30",
  };
  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 font-semibold text-sm">
            {OUTLET_ICON[order.outlet as Outlet]}{order.outlet}
            {order.channel && order.channel !== "Dine-In" && <Badge variant="outline" className="text-[9px] px-1">{order.channel}</Badge>}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 font-mono">
            {order.customerName ?? order.table ?? "Room Svc"}
          </div>
        </div>
        <Badge className={`text-[10px] border ${statusColor[order.status] ?? ""}`}>
          {order.status === "Sent" ? "In Kitchen" : order.status}
        </Badge>
      </div>
      <div className="space-y-1">
        {order.items.map((i) => (
          <div key={i.name} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{i.qty}× {i.name}</span>
            <span>{fmtINR(i.qty * i.price)}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between font-semibold border-t pt-2 text-sm"><span>Total</span><span>{fmtINR(order.total)}</span></div>
      <div className="flex gap-2">
        {order.status === "Open" && (
          <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => { onUpdate(order.id, { status: "Sent" }); toast.success("KOT sent to kitchen"); }}>
            <ChefHat className="size-3.5" /> Send KOT
          </Button>
        )}
        {order.status !== "Paid" && (
          <Button size="sm" className="flex-1 gap-1" onClick={() => { onUpdate(order.id, { status: "Paid" }); toast.success("Order marked paid"); }}>
            <CreditCard className="size-3.5" /> Mark Paid
          </Button>
        )}
      </div>
    </Card>
  );
}
