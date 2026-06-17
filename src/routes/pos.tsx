import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import type { POSOrder, Outlet, MenuItem } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend,
} from "recharts";
import {
  Plus, Minus, Trash2, CreditCard, Search, ChefHat, Banknote,
  Smartphone, BedDouble, Clock, CheckCircle2, ReceiptText,
  UtensilsCrossed, Wine, Sparkles, ShoppingBag, X, Timer,
  AlertCircle, Printer, TrendingUp, LayoutGrid, Download,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { printHTML } from "@/lib/csv";

// ── Static outlet data ─────────────────────────────────────────────────────────

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

const WAITERS = [
  { id: "w1", name: "Arjun Mehta" },
  { id: "w2", name: "Sona Patel" },
  { id: "w3", name: "Vikram Das" },
  { id: "w4", name: "Priya Rao" },
  { id: "w5", name: "Karan Singh" },
];

const INITIAL_TABLE_RES = [
  { id: "tr1", date: "2026-06-17", time: "19:30", table: "T-04", guests: 4, name: "Mr. Sharma", phone: "9876543210", status: "Confirmed" },
  { id: "tr2", date: "2026-06-17", time: "20:00", table: "T-08", guests: 2, name: "Ms. Kapoor", phone: "9123456789", status: "Confirmed" },
  { id: "tr3", date: "2026-06-18", time: "13:00", table: "T-02", guests: 6, name: "Singh Family", phone: "9988776655", status: "Pending" },
  { id: "tr4", date: "2026-06-18", time: "19:00", table: "T-06", guests: 4, name: "Mr. Verma", phone: "9012345678", status: "Confirmed" },
];

type CartItem = { id: string; name: string; qty: number; price: number; note?: string };
type PayMethod = typeof PAY_METHODS[number]["id"];
type TableStatus = "available" | "occupied" | "reserved" | "cleaning";

const TABLE_STATUS_META: Record<TableStatus, { label: string; color: string; bg: string }> = {
  available: { label: "Available", color: "text-success", bg: "bg-success/15 border-success/30 hover:border-success/60" },
  occupied:  { label: "Occupied",  color: "text-destructive", bg: "bg-destructive/10 border-destructive/30 hover:border-destructive/50" },
  reserved:  { label: "Reserved",  color: "text-info", bg: "bg-info/10 border-info/30 hover:border-info/50" },
  cleaning:  { label: "Cleaning",  color: "text-warning-foreground", bg: "bg-warning/15 border-warning/30 hover:border-warning/50" },
};

// ── KOT Receipt modal ─────────────────────────────────────────────────────────
function KOTModal({ order, onClose }: { order: { outlet: string; table?: string; items: CartItem[] }; onClose: () => void }) {
  return (
    <DialogContent className="max-w-xs">
      <DialogHeader><DialogTitle>Kitchen Order Ticket</DialogTitle></DialogHeader>
      <div className="font-mono text-sm space-y-1 p-4 bg-muted rounded-lg">
        <div className="text-center font-bold text-base">{order.outlet.toUpperCase()}</div>
        <div className="text-center text-muted-foreground text-xs">{order.table ?? "—"} · {new Date().toLocaleTimeString()}</div>
        <Separator className="my-2" />
        {order.items.map((i) => (
          <div key={i.id}>
            <div className="flex justify-between">
              <span>{i.qty}× {i.name}</span>
            </div>
            {i.note && <div className="text-muted-foreground text-xs pl-4">↳ {i.note}</div>}
          </div>
        ))}
        <Separator className="my-2" />
        <div className="text-center text-xs text-muted-foreground">KOT — Hotel Harmony</div>
      </div>
      <Button onClick={onClose} className="w-full">Close</Button>
    </DialogContent>
  );
}

// ── Receipt modal ─────────────────────────────────────────────────────────────
function ReceiptModal({ order, onClose }: { order: POSOrder; onClose: () => void }) {
  const printReceipt = () => {
    const rows = order.items.map((i) => `<tr><td>${i.qty}× ${i.name}</td><td class="right">${fmtINR(i.qty * i.price)}</td></tr>`).join("");
    const tax = Math.round(order.total / 1.18 * 0.18);
    const base = order.total - tax;
    printHTML(`Receipt — ${order.outlet}`, `
      <div class="brand"><div><h1>Hotel Harmony</h1><div class="muted">GST: 27AABCA1234X1Z5</div></div><div style="text-align:right"><h1>RECEIPT</h1><div class="muted">${order.createdAt}</div></div></div>
      <div><strong>Outlet:</strong> ${order.outlet} &nbsp;&nbsp; <strong>Table:</strong> ${order.table ?? "Room Svc"}</div>
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
        <div className="text-xs text-muted-foreground text-center mb-2">{order.table ?? "Room Service"}</div>
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

// ── Main POS Component ────────────────────────────────────────────────────────
function POS() {
  const { orders, addOrder, updateOrder, rooms, menuItems: allMenuItems } = useMHMS();

  // New order state
  const [outlet, setOutlet] = useState<Outlet>("Restaurant");
  const [catFilter, setCatFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [table, setTable] = useState("T-01");
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountPct, setDiscountPct] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [payMethod, setPayMethod] = useState<PayMethod>("Cash");
  const [orderNotes, setOrderNotes] = useState("");
  const [kotModal, setKotModal] = useState(false);
  const [noteItemId, setNoteItemId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [receiptOrder, setReceiptOrder] = useState<POSOrder | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [waiter, setWaiter] = useState(WAITERS[0].id);
  const [splitMode, setSplitMode] = useState(false);
  const [split1, setSplit1] = useState("");
  const [split2, setSplit2] = useState("");
  const [payMethod2, setPayMethod2] = useState<PayMethod>("Card");
  const [voidId, setVoidId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [tableResOpen, setTableResOpen] = useState(false);
  const [tableReservations, setTableReservations] = useState(INITIAL_TABLE_RES);
  const [newTR, setNewTR] = useState({ date: "", time: "", table: "T-01", guests: "2", name: "", phone: "" });

  // Table management state
  const [tableStatuses, setTableStatuses] = useState<Record<string, TableStatus>>(() => {
    const init: Record<string, TableStatus> = {};
    ALL_TABLES.forEach((t) => { init[t.id] = "available"; });
    // seed a couple occupied/reserved
    init["T-03"] = "occupied"; init["T-07"] = "occupied"; init["T-05"] = "reserved";
    init["B-02"] = "occupied"; init["S-01"] = "occupied";
    return init;
  });
  const [tableCovers, setTableCovers] = useState<Record<string, number>>({});
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  // Derived — menu comes from store, filtered to current outlet & active items
  const outletMenu = useMemo(() => allMenuItems.filter((m) => m.outlet === outlet && m.active), [allMenuItems, outlet]);
  const categories = useMemo(() => ["All", ...Array.from(new Set(outletMenu.map((m) => m.cat)))], [outletMenu]);
  const filteredMenu = useMemo(() => outletMenu.filter((m) => {
    const matchCat = catFilter === "All" || m.cat === catFilter;
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  }), [outletMenu, catFilter, search]);

  const subtotal = cart.reduce((s, i) => s + i.qty * i.price, 0);
  const discountAmt = Math.round(subtotal * discountPct / 100);
  const afterDiscount = subtotal - discountAmt;
  const tax = taxEnabled ? Math.round(afterDiscount * 0.18) : 0;
  const total = afterDiscount + tax;

  const openOrders = orders.filter((o) => o.status !== "Paid");
  const paidOrders = orders.filter((o) => o.status === "Paid");
  const todayRevenue = paidOrders.reduce((s, o) => s + o.total, 0);
  const totalCovers = Object.values(tableCovers).reduce((s, c) => s + c, 0);

  // Analytics data
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

  // Cart helpers
  const addToCart = (m: MenuItem) =>
    setCart((prev) => {
      const ex = prev.find((c) => c.id === m.id);
      return ex ? prev.map((c) => c.id === m.id ? { ...c, qty: c.qty + 1 } : c) : [...prev, { id: m.id, name: m.name, qty: 1, price: m.price }];
    });

  const updateQty = (id: string, delta: number) =>
    setCart((prev) => prev.map((c) => c.id === id ? { ...c, qty: c.qty + delta } : c).filter((c) => c.qty > 0));

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((c) => c.id !== id));
  const cartCount = (id: string) => cart.find((c) => c.id === id)?.qty ?? 0;

  const resetOrder = () => { setCart([]); setDiscountPct(0); setOrderNotes(""); setPayMethod("Cash"); };

  const buildPayload = (status: POSOrder["status"]) => ({
    outlet, table: outlet === "Room Service" ? undefined : table,
    roomId: outlet === "Room Service" ? roomId : undefined, items: cart, status, total,
  });

  const handleSendKOT = () => {
    if (!cart.length) return;
    addOrder(buildPayload("Sent"));
    if (outlet !== "Room Service") setTableStatuses((p) => ({ ...p, [table]: "occupied" }));
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
    const tables = OUTLET_TABLES[o];
    if (tables.length) setTable(tables[0]);
    else setTable("");
  };

  return (
    <>
      <PageHeader title="POS & Restaurant" description="Orders, kitchen display, table management and analytics" />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <Stat label="Today's Revenue" value={fmtINR(todayRevenue)} tone="success" hint="Paid orders" />
        <Stat label="Open Orders" value={openOrders.length} tone={openOrders.length > 3 ? "warning" : "info"} hint="In kitchen / open" />
        <Stat label="Avg Ticket" value={fmtINR(Math.round(todayRevenue / Math.max(paidOrders.length, 1)))} hint="Per paid order" />
        <Stat label="Active Tables" value={Object.values(tableStatuses).filter((s) => s === "occupied").length} hint="Currently occupied" />
        <Stat label="Covers Today" value={totalCovers || "—"} hint="Guests served" />
      </div>

      <Tabs defaultValue="new">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="new"><ShoppingBag className="size-3.5 mr-1.5" />New Order</TabsTrigger>
          <TabsTrigger value="tables"><LayoutGrid className="size-3.5 mr-1.5" />Tables</TabsTrigger>
          <TabsTrigger value="kitchen">
            <ChefHat className="size-3.5 mr-1.5" />Kitchen
            {openOrders.filter((o) => o.status === "Sent").length > 0 && (
              <Badge variant="destructive" className="ml-1.5 size-4 p-0 grid place-items-center text-[10px]">
                {openOrders.filter((o) => o.status === "Sent").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="live">
            <Clock className="size-3.5 mr-1.5" />Live Orders
            {openOrders.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 size-4 p-0 grid place-items-center text-[10px]">
                {openOrders.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history"><ReceiptText className="size-3.5 mr-1.5" />History</TabsTrigger>
          <TabsTrigger value="analytics"><TrendingUp className="size-3.5 mr-1.5" />Analytics</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
        </TabsList>

        {/* ── NEW ORDER ──────────────────────────────────────────────────────── */}
        <TabsContent value="new">
          <div className="grid grid-cols-12 gap-4">
            {/* Left — menu panel */}
            <div className="col-span-12 lg:col-span-8 space-y-3">
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(MENU) as Outlet[]).map((o) => (
                  <button key={o} onClick={() => switchOutlet(o)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition ${outlet === o ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40 hover:bg-accent/5"}`}>
                    {OUTLET_ICON[o]} {o}
                  </button>
                ))}
              </div>

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
                <div className="flex items-center gap-2 font-semibold">{OUTLET_ICON[outlet]}<span>{outlet}</span></div>
                {cart.length > 0 && <button onClick={resetOrder} className="text-xs text-muted-foreground hover:text-destructive transition">Clear all</button>}
              </div>

              {outlet === "Room Service" ? (
                <div className="space-y-1">
                  <Label className="text-xs">Room</Label>
                  <Select value={roomId} onValueChange={setRoomId}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select room" /></SelectTrigger>
                    <SelectContent>{rooms.map((r) => <SelectItem key={r.id} value={r.id}>Room {r.number} — {r.type}</SelectItem>)}</SelectContent>
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

              <div className="space-y-1">
                <Label className="text-xs">Server</Label>
                <Select value={waiter} onValueChange={setWaiter}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{WAITERS.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex-1 min-h-[160px] max-h-[280px] overflow-y-auto space-y-2">
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
                          <button onClick={() => { setNoteItemId(c.id); setNoteText(c.note ?? ""); }} className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-primary" title="Add note">
                            <ReceiptText className="size-3" />
                          </button>
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
                  <div className="flex items-center gap-2">
                    <Label className="text-xs shrink-0">Discount %</Label>
                    <Input type="number" min={0} max={100} className="h-7 text-xs w-20" value={discountPct || ""} placeholder="0" onChange={(e) => setDiscountPct(Math.min(100, Math.max(0, Number(e.target.value))))} />
                    <button onClick={() => setTaxEnabled((v) => !v)} className={`ml-auto text-xs px-2 py-1 rounded border transition ${taxEnabled ? "bg-primary/10 border-primary/40 text-primary" : "text-muted-foreground"}`}>GST 18%</button>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmtINR(subtotal)}</span></div>
                    {discountAmt > 0 && <div className="flex justify-between text-success"><span>Discount ({discountPct}%)</span><span>−{fmtINR(discountAmt)}</span></div>}
                    {taxEnabled && <div className="flex justify-between text-muted-foreground"><span>CGST 9% + SGST 9%</span><span>{fmtINR(tax)}</span></div>}
                    <div className="flex justify-between font-semibold text-base pt-1 border-t"><span>Total</span><span>{fmtINR(total)}</span></div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className="text-xs">Payment</Label>
                      <button onClick={() => setSplitMode((v) => !v)} className={`text-[10px] px-1.5 py-0.5 rounded border transition ${splitMode ? "bg-primary/10 text-primary border-primary/40" : "text-muted-foreground hover:border-muted-foreground/40"}`}>
                        Split
                      </button>
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

        {/* ── TABLE MANAGEMENT ────────────────────────────────────────────────── */}
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
                    value={tableCovers[selectedTable] ?? ""}
                    onChange={(e) => setTableCovers((p) => ({ ...p, [selectedTable!]: Number(e.target.value) }))}
                    placeholder="0" />
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ── KITCHEN DISPLAY ────────────────────────────────────────────────── */}
        <TabsContent value="kitchen">
          {openOrders.filter((o) => o.status === "Sent").length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              <CheckCircle2 className="size-10 mx-auto mb-3 opacity-30" />
              <p>Kitchen is clear — no pending tickets.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {openOrders.filter((o) => o.status === "Sent").map((o) => {
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
                        <div className="font-mono text-sm text-muted-foreground">{o.table ?? "Room Svc"}</div>
                      </div>
                      <div className={`flex items-center gap-1 text-sm font-semibold ${urgency === "destructive" ? "text-destructive" : urgency === "warning" ? "text-warning-foreground" : "text-success"}`}>
                        <Timer className="size-4" />{elapsedMins}m
                      </div>
                    </div>
                    <div className="space-y-1 mb-3">
                      {o.items.map((i) => (
                        <div key={i.name} className="flex justify-between text-sm">
                          <span className="font-medium">{i.qty}× {i.name}</span>
                          {i.note && <span className="text-xs text-muted-foreground italic">{i.note}</span>}
                        </div>
                      ))}
                    </div>
                    {urgency === "destructive" && (
                      <div className="flex items-center gap-1 text-xs text-destructive mb-2">
                        <AlertCircle className="size-3.5" /> Overdue — {elapsedMins} min
                      </div>
                    )}
                    <Button size="sm" className="w-full gap-1.5" onClick={() => { updateOrder(o.id, { status: "Paid" }); toast.success("Order ready & marked paid"); }}>
                      <CheckCircle2 className="size-4" /> Mark Ready &amp; Served
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── LIVE ORDERS ────────────────────────────────────────────────────── */}
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

        {/* ── HISTORY ──────────────────────────────────────────────────────────── */}
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
                      {["#","Outlet","Table","Items","Total","Time",""].map((h) => (
                        <th key={h} className={`px-4 py-3 text-xs font-medium text-muted-foreground ${h === "Total" ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paidOrders
                      .filter((o) => !historySearch || o.outlet.toLowerCase().includes(historySearch.toLowerCase()) || (o.table ?? "").toLowerCase().includes(historySearch.toLowerCase()) || o.items.some((i) => i.name.toLowerCase().includes(historySearch.toLowerCase())))
                      .map((o, idx) => (
                        <tr key={o.id} className="border-b last:border-0 hover:bg-accent/5">
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{o.orderNumber ?? `#${String(paidOrders.length - idx).padStart(4, "0")}`}</td>
                          <td className="px-4 py-3"><div className="flex items-center gap-1.5">{OUTLET_ICON[o.outlet as Outlet]}{o.outlet}</div></td>
                          <td className="px-4 py-3 font-mono text-xs">{o.table ?? "Room Svc"}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</td>
                          <td className="px-4 py-3 text-right font-semibold">{fmtINR(o.total)}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{o.createdAt}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={() => setReceiptOrder(o)}>
                                <Printer className="size-3" />Bill
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-destructive hover:text-destructive" onClick={() => { setVoidId(o.id); setVoidReason(""); }}>
                                <X className="size-3" />Void
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    {paidOrders.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No paid orders yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ── ANALYTICS ────────────────────────────────────────────────────────── */}
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

        {/* ── TABLE RESERVATIONS ───────────────────────────────────────────── */}
        <TabsContent value="reservations">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              {tableReservations.filter((r) => r.status === "Confirmed").length} confirmed reservations
            </p>
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
                        <Badge className={`text-[10px] ${r.status === "Confirmed" ? "bg-success/15 text-success border-success/30" : "bg-warning/20 text-warning-foreground border-warning/30"}`}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 flex gap-1">
                        {r.status === "Pending" && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                            onClick={() => { setTableReservations((p) => p.map((x) => x.id === r.id ? { ...x, status: "Confirmed" } : x)); toast.success("Reservation confirmed"); }}>
                            Confirm
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => { setTableReservations((p) => p.filter((x) => x.id !== r.id)); toast.success("Reservation cancelled"); }}>
                          Cancel
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {tableReservations.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">No reservations yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

      </Tabs>

      {/* New Table Reservation Dialog */}
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

      {/* Void Order Dialog */}
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

      {/* Item note dialog */}
      <Dialog open={!!noteItemId} onOpenChange={() => setNoteItemId(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Item Note</DialogTitle></DialogHeader>
          <Input placeholder="e.g. No onion, extra spicy…" value={noteText} onChange={(e) => setNoteText(e.target.value)} autoFocus />
          <Button onClick={() => { setCart((prev) => prev.map((c) => c.id === noteItemId ? { ...c, note: noteText || undefined } : c)); setNoteItemId(null); }}>Save Note</Button>
        </DialogContent>
      </Dialog>

      {/* KOT Modal */}
      <Dialog open={kotModal} onOpenChange={setKotModal}>
        <KOTModal order={{ outlet, table: outlet !== "Room Service" ? table : undefined, items: [] }} onClose={() => setKotModal(false)} />
      </Dialog>

      {/* Receipt Modal */}
      {receiptOrder && (
        <Dialog open={!!receiptOrder} onOpenChange={() => setReceiptOrder(null)}>
          <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
        </Dialog>
      )}
    </>
  );
}

// ── Live Order Card ───────────────────────────────────────────────────────────
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
          <div className="flex items-center gap-1.5 font-semibold text-sm">{OUTLET_ICON[order.outlet as Outlet]}{order.outlet}</div>
          <div className="text-xs text-muted-foreground mt-0.5 font-mono">{order.table ?? "Room Svc"}</div>
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
