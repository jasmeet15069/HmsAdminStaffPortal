import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
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
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell,
} from "recharts";
import {
  UtensilsCrossed, Users, Clock, TrendingUp, Plus, X,
  CheckCircle2, AlertCircle, Timer, Star, ChefHat,
  LayoutGrid, CalendarDays, Flame, Award, Minus,
  ArrowUpRight, ArrowDownRight, RefreshCw, Printer,
  TableProperties, UserCheck,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/restaurant")({
  head: () => ({ meta: [{ title: "Restaurant · MHMS" }] }),
  component: RestaurantPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────
type TableStatus = "available" | "occupied" | "reserved" | "cleaning" | "blocked";
type Section = "Main Dining" | "Terrace" | "Private" | "Bar Lounge";
type WaitlistEntry = {
  id: string; name: string; size: number; phone: string;
  addedAt: string; waitMins: number; status: "Waiting" | "Notified" | "Seated" | "Left";
};
type FloorTable = {
  id: string; label: string; section: Section; seats: number;
  status: TableStatus; waiter?: string; covers?: number;
  order?: { items: number; total: number; elapsed: number };
};
type WaiterStat = {
  id: string; name: string; section: Section;
  tables: number; covers: number; revenue: number; avgCheck: number; turns: number;
};

// ── Static data ────────────────────────────────────────────────────────────────
const SECTIONS: Section[] = ["Main Dining", "Terrace", "Private", "Bar Lounge"];

const STATUS_META: Record<TableStatus, { label: string; bg: string; text: string; dot: string }> = {
  available: { label: "Available", bg: "bg-success/15 border-success/40",           text: "text-success",             dot: "bg-success" },
  occupied:  { label: "Occupied",  bg: "bg-destructive/10 border-destructive/30",   text: "text-destructive",         dot: "bg-destructive" },
  reserved:  { label: "Reserved",  bg: "bg-info/10 border-info/30",                 text: "text-info",                dot: "bg-info" },
  cleaning:  { label: "Cleaning",  bg: "bg-warning/15 border-warning/30",           text: "text-warning-foreground",  dot: "bg-warning" },
  blocked:   { label: "Blocked",   bg: "bg-muted border-border",                    text: "text-muted-foreground",    dot: "bg-muted-foreground" },
};

const INITIAL_FLOOR: FloorTable[] = [
  // Main Dining
  { id: "T01", label: "T-01", section: "Main Dining", seats: 4,  status: "occupied",  waiter: "Arjun",  covers: 3, order: { items: 4,  total: 1840, elapsed: 25 } },
  { id: "T02", label: "T-02", section: "Main Dining", seats: 4,  status: "available" },
  { id: "T03", label: "T-03", section: "Main Dining", seats: 2,  status: "reserved",  waiter: "Sona" },
  { id: "T04", label: "T-04", section: "Main Dining", seats: 6,  status: "occupied",  waiter: "Vikram", covers: 5, order: { items: 9,  total: 3620, elapsed: 42 } },
  { id: "T05", label: "T-05", section: "Main Dining", seats: 4,  status: "cleaning" },
  { id: "T06", label: "T-06", section: "Main Dining", seats: 4,  status: "available" },
  { id: "T07", label: "T-07", section: "Main Dining", seats: 8,  status: "occupied",  waiter: "Priya",  covers: 7, order: { items: 14, total: 5890, elapsed: 18 } },
  { id: "T08", label: "T-08", section: "Main Dining", seats: 2,  status: "reserved",  waiter: "Arjun" },
  { id: "T09", label: "T-09", section: "Main Dining", seats: 4,  status: "available" },
  { id: "T10", label: "T-10", section: "Main Dining", seats: 4,  status: "occupied",  waiter: "Karan",  covers: 2, order: { items: 3,  total: 980,  elapsed: 8  } },
  { id: "T11", label: "T-11", section: "Main Dining", seats: 4,  status: "available" },
  { id: "T12", label: "T-12", section: "Main Dining", seats: 6,  status: "blocked" },
  // Terrace
  { id: "TR1", label: "TR-1", section: "Terrace", seats: 4, status: "available" },
  { id: "TR2", label: "TR-2", section: "Terrace", seats: 4, status: "occupied", waiter: "Sona", covers: 4, order: { items: 6, total: 2240, elapsed: 31 } },
  { id: "TR3", label: "TR-3", section: "Terrace", seats: 6, status: "reserved", waiter: "Vikram" },
  { id: "TR4", label: "TR-4", section: "Terrace", seats: 4, status: "available" },
  { id: "TR5", label: "TR-5", section: "Terrace", seats: 2, status: "occupied", waiter: "Priya", covers: 2, order: { items: 4, total: 1580, elapsed: 55 } },
  { id: "TR6", label: "TR-6", section: "Terrace", seats: 4, status: "available" },
  // Private
  { id: "PR1", label: "Pvt-1", section: "Private", seats: 10, status: "occupied", waiter: "Arjun", covers: 8, order: { items: 20, total: 9200, elapsed: 65 } },
  { id: "PR2", label: "Pvt-2", section: "Private", seats: 8,  status: "available" },
  // Bar Lounge
  { id: "BL1", label: "BL-1", section: "Bar Lounge", seats: 2, status: "occupied",  waiter: "Karan", covers: 2, order: { items: 3, total: 1740, elapsed: 20 } },
  { id: "BL2", label: "BL-2", section: "Bar Lounge", seats: 2, status: "available" },
  { id: "BL3", label: "BL-3", section: "Bar Lounge", seats: 4, status: "occupied",  waiter: "Karan", covers: 3, order: { items: 5, total: 2890, elapsed: 35 } },
  { id: "BL4", label: "BL-4", section: "Bar Lounge", seats: 2, status: "available" },
];

const INITIAL_WAITLIST: WaitlistEntry[] = [
  { id: "wl1", name: "Mehta Family",  size: 5, phone: "9876501234", addedAt: "19:15", waitMins: 22, status: "Waiting"  },
  { id: "wl2", name: "Mr. Kapoor",    size: 2, phone: "9812345678", addedAt: "19:28", waitMins: 9,  status: "Notified" },
  { id: "wl3", name: "Singh Group",   size: 8, phone: "9988776655", addedAt: "19:32", waitMins: 5,  status: "Waiting"  },
  { id: "wl4", name: "Ms. Verma",     size: 1, phone: "9009876543", addedAt: "19:40", waitMins: 0,  status: "Waiting"  },
];

const INITIAL_WAITERS: WaiterStat[] = [
  { id: "w1", name: "Arjun Mehta",  section: "Main Dining", tables: 3, covers: 11, revenue: 14640, avgCheck: 1331, turns: 2 },
  { id: "w2", name: "Sona Patel",   section: "Terrace",     tables: 2, covers:  6, revenue:  6080, avgCheck: 1013, turns: 2 },
  { id: "w3", name: "Vikram Das",   section: "Terrace",     tables: 2, covers:  9, revenue:  8820, avgCheck:  980, turns: 1 },
  { id: "w4", name: "Priya Rao",    section: "Main Dining", tables: 2, covers:  9, revenue:  7470, avgCheck:  830, turns: 2 },
  { id: "w5", name: "Karan Singh",  section: "Bar Lounge",  tables: 2, covers:  5, revenue:  4630, avgCheck:  926, turns: 3 },
];

const HOURLY_COVERS = [
  { hour: "11", covers: 4 }, { hour: "12", covers: 18 }, { hour: "13", covers: 32 },
  { hour: "14", covers: 28 }, { hour: "15", covers: 12 }, { hour: "16", covers: 6 },
  { hour: "17", covers: 9 },  { hour: "18", covers: 24 }, { hour: "19", covers: 38 },
  { hour: "20", covers: 42 }, { hour: "21", covers: 35 }, { hour: "22", covers: 18 },
];

const WEEKLY_REVENUE = [
  { day: "Mon", revenue: 42000 }, { day: "Tue", revenue: 38000 }, { day: "Wed", revenue: 51000 },
  { day: "Thu", revenue: 47000 }, { day: "Fri", revenue: 68000 }, { day: "Sat", revenue: 82000 },
  { day: "Sun", revenue: 74000 },
];

const OPENING_CHECKLIST = [
  { id: "oc1", task: "Table linen replaced and pressed",      section: "Setup" },
  { id: "oc2", task: "Cutlery and glassware polished",        section: "Setup" },
  { id: "oc3", task: "Candles / centerpieces placed",         section: "Setup" },
  { id: "oc4", task: "Daily specials briefed to all waiters", section: "Staff" },
  { id: "oc5", task: "Reservation list printed and reviewed", section: "Staff" },
  { id: "oc6", task: "POS terminals checked and active",      section: "Systems" },
  { id: "oc7", task: "Kitchen mise en place complete",        section: "Kitchen" },
  { id: "oc8", task: "Music and ambience set",                section: "Ambience" },
  { id: "oc9", task: "Floor swept and mopped",                section: "Hygiene" },
  { id: "oc10", task: "Restrooms stocked and cleaned",        section: "Hygiene" },
];

const BLANK_WAITLIST = { name: "", size: "2", phone: "" };

// ── Component ─────────────────────────────────────────────────────────────────
function RestaurantPage() {
  const { orders, menuItems } = useMHMS();

  const [floor, setFloor] = useState<FloorTable[]>(INITIAL_FLOOR);
  const [sectionFilter, setSectionFilter] = useState<Section | "All">("All");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>(INITIAL_WAITLIST);
  const [addWLOpen, setAddWLOpen] = useState(false);
  const [newWL, setNewWL] = useState({ ...BLANK_WAITLIST });
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [waiters] = useState<WaiterStat[]>(INITIAL_WAITERS);
  const [sectionAssign, setSectionAssign] = useState<Record<string, Section>>(() =>
    Object.fromEntries(INITIAL_WAITERS.map((w) => [w.id, w.section]))
  );

  // ── Derived floor stats ──
  const floorStats = useMemo(() => {
    const occupied = floor.filter((t) => t.status === "occupied").length;
    const total = floor.filter((t) => t.status !== "blocked").length;
    const covers = floor.reduce((s, t) => s + (t.covers ?? 0), 0);
    const revenue = floor.reduce((s, t) => s + (t.order?.total ?? 0), 0);
    const avgTurnMins = floor.filter((t) => t.order).reduce((s, t, _i, arr) => s + (t.order!.elapsed / arr.length), 0);
    return { occupied, total, covers, revenue, avgTurnMins: Math.round(avgTurnMins), utilPct: Math.round((occupied / Math.max(total, 1)) * 100) };
  }, [floor]);

  // ── Menu Engineering ──
  const menuEngineering = useMemo(() => {
    const paidOrders = orders.filter((o) => o.status === "Paid" && o.outlet === "Restaurant");
    const itemStats: Record<string, { name: string; cat: string; qty: number; revenue: number; price: number }> = {};
    paidOrders.forEach((o) => o.items.forEach((i) => {
      itemStats[i.name] ??= { name: i.name, cat: "", qty: 0, revenue: 0, price: i.price };
      itemStats[i.name].qty += i.qty;
      itemStats[i.name].revenue += i.qty * i.price;
    }));
    // Fill in from store with some demo data if orders are sparse
    menuItems.filter((m) => m.outlet === "Restaurant" && m.active).forEach((m) => {
      if (!itemStats[m.name]) {
        itemStats[m.name] = { name: m.name, cat: m.cat, qty: Math.floor(Math.random() * 40 + 5), revenue: 0, price: m.price };
        itemStats[m.name].revenue = itemStats[m.name].qty * m.price;
      } else {
        itemStats[m.name].cat = m.cat;
        if (itemStats[m.name].qty < 5) {
          itemStats[m.name].qty += Math.floor(Math.random() * 30 + 5);
          itemStats[m.name].revenue = itemStats[m.name].qty * m.price;
        }
      }
    });
    const items = Object.values(itemStats);
    const medQty = items.sort((a, b) => b.qty - a.qty)[Math.floor(items.length / 2)]?.qty ?? 1;
    const medRev = [...items].sort((a, b) => b.revenue - a.revenue)[Math.floor(items.length / 2)]?.revenue ?? 1;
    return items.map((item) => ({
      ...item,
      category:
        item.qty >= medQty && item.revenue >= medRev ? "Star" as const :
        item.qty >= medQty && item.revenue < medRev  ? "Plowhorse" as const :
        item.qty < medQty  && item.revenue >= medRev ? "Puzzle" as const : "Dog" as const,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [orders, menuItems]);

  const meByCategory = useMemo(() => {
    const g: Record<string, number> = { Star: 0, Plowhorse: 0, Puzzle: 0, Dog: 0 };
    menuEngineering.forEach((i) => { g[i.category]++; });
    return g;
  }, [menuEngineering]);

  const ME_META = {
    Star:      { color: "text-yellow-500", bg: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800/40", icon: Star,    tip: "High popularity & high margin — promote these" },
    Plowhorse: { color: "text-info",       bg: "bg-info/10 border-info/30",                                                       icon: Flame,   tip: "High popularity but lower margin — consider pricing" },
    Puzzle:    { color: "text-purple-500", bg: "bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800/40", icon: Award,   tip: "High margin but low popularity — needs better visibility" },
    Dog:       { color: "text-muted-foreground", bg: "bg-muted border-border",                                                   icon: Minus,   tip: "Low popularity & low margin — review or remove" },
  } as const;

  const visibleTables = floor.filter((t) => sectionFilter === "All" || t.section === sectionFilter);
  const selectedT = floor.find((t) => t.id === selectedTable);

  const waitingCount = waitlist.filter((w) => w.status === "Waiting").length;
  const checklistDone = OPENING_CHECKLIST.filter((c) => checklist[c.id]).length;

  return (
    <>
      <PageHeader
        title="Restaurant"
        description="Floor plan, menu engineering, waitlist and team performance"
        actions={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-success inline-block" />{floorStats.occupied}/{floorStats.total} tables occupied</span>
            <span className="text-border">|</span>
            <span>{floorStats.covers} covers today</span>
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <Stat label="Table Utilisation" value={`${floorStats.utilPct}%`} tone={floorStats.utilPct >= 70 ? "success" : floorStats.utilPct >= 40 ? "warning" : "info"} hint={`${floorStats.occupied} of ${floorStats.total} tables`} />
        <Stat label="Covers Today"      value={floorStats.covers}  hint="Guests seated" />
        <Stat label="Live Revenue"      value={fmtINR(floorStats.revenue)} tone="success" hint="Open orders on floor" />
        <Stat label="Avg Turn Time"     value={`${floorStats.avgTurnMins}m`} hint="Avg occupied table time" />
        <Stat label="Waitlist"          value={waitingCount} tone={waitingCount > 3 ? "warning" : "info"} hint="Guests waiting" />
      </div>

      <Tabs defaultValue="floor">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="floor"><LayoutGrid className="size-3.5 mr-1.5" />Floor Plan</TabsTrigger>
          <TabsTrigger value="dashboard"><TrendingUp className="size-3.5 mr-1.5" />Analytics</TabsTrigger>
          <TabsTrigger value="menu-eng"><Star className="size-3.5 mr-1.5" />Menu Engineering</TabsTrigger>
          <TabsTrigger value="waitlist">
            <Users className="size-3.5 mr-1.5" />Waitlist
            {waitingCount > 0 && <Badge variant="destructive" className="ml-1.5 size-4 p-0 grid place-items-center text-[10px]">{waitingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="staff"><UserCheck className="size-3.5 mr-1.5" />Staff Performance</TabsTrigger>
          <TabsTrigger value="opening"><CheckCircle2 className="size-3.5 mr-1.5" />Opening Checklist</TabsTrigger>
        </TabsList>

        {/* ── FLOOR PLAN ──────────────────────────────────────────────────── */}
        <TabsContent value="floor">
          {/* Legend + section filter */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="flex gap-3 text-xs flex-wrap">
              {(Object.entries(STATUS_META) as [TableStatus, typeof STATUS_META[TableStatus]][]).map(([s, m]) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-full ${m.dot}`} />
                  <span className={m.text}>{m.label}</span>
                  <span className="text-muted-foreground">({floor.filter((t) => t.status === s).length})</span>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(["All", ...SECTIONS] as (Section | "All")[]).map((sec) => (
                <button key={sec} onClick={() => setSectionFilter(sec)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition ${sectionFilter === sec ? "bg-secondary text-secondary-foreground border-secondary" : "hover:border-muted-foreground/40"}`}>
                  {sec}
                </button>
              ))}
            </div>
          </div>

          {/* Section grids */}
          {(sectionFilter === "All" ? SECTIONS : [sectionFilter]).map((sec) => {
            const secTables = visibleTables.filter((t) => t.section === sec);
            if (secTables.length === 0) return null;
            const secOcc = secTables.filter((t) => t.status === "occupied").length;
            const secTotal = secTables.filter((t) => t.status !== "blocked").length;
            return (
              <div key={sec} className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-sm">{sec}</h3>
                  <Badge variant="outline" className="text-[9px] px-1.5">{secOcc}/{secTotal} occupied</Badge>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-2">
                  {secTables.map((t) => {
                    const meta = STATUS_META[t.status];
                    const isSelected = selectedTable === t.id;
                    const overdue = t.order && t.order.elapsed > 60;
                    return (
                      <button key={t.id} onClick={() => setSelectedTable(isSelected ? null : t.id)}
                        className={`border-2 rounded-xl p-3 text-center transition-all ${meta.bg} ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""} ${overdue ? "animate-pulse" : ""}`}>
                        <div className="font-mono font-bold text-sm">{t.label}</div>
                        <div className={`text-[10px] font-medium ${meta.text}`}>{meta.label}</div>
                        <div className="text-[10px] text-muted-foreground">{t.seats} seats</div>
                        {t.covers && <div className="text-[10px] font-medium mt-0.5">{t.covers} covers</div>}
                        {t.order && (
                          <div className={`text-[10px] mt-0.5 font-semibold ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                            <Timer className="size-2.5 inline mr-0.5" />{t.order.elapsed}m
                          </div>
                        )}
                        {t.waiter && <div className="text-[9px] text-muted-foreground mt-0.5 truncate">{t.waiter}</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Selected table panel */}
          {selectedT && (
            <Card className="p-4 mt-2 border-primary/30 bg-primary/[0.03]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold">Table {selectedT.label}</h3>
                  <Badge className={`text-[10px] border ${STATUS_META[selectedT.status].bg} ${STATUS_META[selectedT.status].text}`}>{STATUS_META[selectedT.status].label}</Badge>
                  <span className="text-xs text-muted-foreground">{selectedT.section} · {selectedT.seats} seats</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedTable(null)}><X className="size-4" /></Button>
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                {(["available", "occupied", "reserved", "cleaning", "blocked"] as TableStatus[]).map((s) => (
                  <Button key={s} size="sm" variant={selectedT.status === s ? "default" : "outline"}
                    onClick={() => { setFloor((p) => p.map((t) => t.id === selectedT.id ? { ...t, status: s } : t)); toast.success(`${selectedT.label} → ${STATUS_META[s].label}`); }}>
                    {STATUS_META[s].label}
                  </Button>
                ))}
                {selectedT.order && (
                  <div className="ml-auto flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{selectedT.order.items} items</span>
                    <span className="font-semibold">{fmtINR(selectedT.order.total)}</span>
                    <span className={`flex items-center gap-1 text-xs ${selectedT.order.elapsed > 60 ? "text-destructive" : "text-muted-foreground"}`}>
                      <Timer className="size-3.5" />{selectedT.order.elapsed}m
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ── ANALYTICS DASHBOARD ─────────────────────────────────────────── */}
        <TabsContent value="dashboard">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Avg Check",        value: fmtINR(1180), vs: "+8%", up: true, hint: "vs yesterday" },
              { label: "Table Turns",      value: "2.3×",       vs: "+0.2", up: true, hint: "avg per table" },
              { label: "Revenue / Seat",   value: fmtINR(820),  vs: "+12%", up: true, hint: "per seat available" },
              { label: "Food Cost %",      value: "31%",        vs: "-2%", up: true, hint: "vs 33% target" },
            ].map((kpi) => (
              <Card key={kpi.label} className="p-4">
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{kpi.label}</div>
                <div className="text-2xl font-semibold font-display mt-1">{kpi.value}</div>
                <div className={`flex items-center gap-1 text-xs mt-1 ${kpi.up ? "text-success" : "text-destructive"}`}>
                  {kpi.up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                  {kpi.vs} {kpi.hint}
                </div>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">Hourly Cover Count <span className="text-xs font-normal text-muted-foreground">— Today</span></h3>
              <div className="h-52">
                <ResponsiveContainer>
                  <BarChart data={HOURLY_COVERS}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="hour" fontSize={10} tickFormatter={(v) => `${v}:00`} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: number) => [v, "Covers"]} labelFormatter={(l) => `${l}:00`} />
                    <Bar dataKey="covers" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]}>
                      {HOURLY_COVERS.map((entry, i) => (
                        <Cell key={i} fill={entry.covers >= 30 ? "hsl(var(--chart-1))" : "hsl(var(--chart-1)/0.5)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">Weekly Revenue Trend</h3>
              <div className="h-52">
                <ResponsiveContainer>
                  <AreaChart data={WEEKLY_REVENUE}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="day" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: number) => [fmtINR(v), "Revenue"]} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Section performance */}
          <Card className="p-5">
            <h3 className="font-semibold mb-4">Section Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {SECTIONS.map((sec) => {
                const secTables = floor.filter((t) => t.section === sec);
                const secOcc = secTables.filter((t) => t.status === "occupied").length;
                const secTotal = secTables.filter((t) => t.status !== "blocked").length;
                const secRevenue = secTables.reduce((s, t) => s + (t.order?.total ?? 0), 0);
                const secCovers = secTables.reduce((s, t) => s + (t.covers ?? 0), 0);
                const utilPct = Math.round((secOcc / Math.max(secTotal, 1)) * 100);
                return (
                  <Card key={sec} className="p-4 bg-muted/30">
                    <div className="font-medium text-sm mb-2">{sec}</div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Utilisation</span>
                        <span className={`font-semibold ${utilPct >= 70 ? "text-success" : utilPct >= 40 ? "text-warning-foreground" : "text-muted-foreground"}`}>{utilPct}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${utilPct}%` }} />
                      </div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Covers</span><span>{secCovers}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Revenue</span><span className="font-semibold text-success">{fmtINR(secRevenue)}</span></div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* ── MENU ENGINEERING ──────────────────────────────────────────────── */}
        <TabsContent value="menu-eng">
          {/* BCG summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {(["Star", "Plowhorse", "Puzzle", "Dog"] as const).map((cat) => {
              const meta = ME_META[cat];
              const Icon = meta.icon;
              return (
                <Card key={cat} className={`p-4 border ${meta.bg}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`size-4 ${meta.color}`} />
                    <span className={`font-semibold text-sm ${meta.color}`}>{cat}s</span>
                    <span className="ml-auto text-2xl font-bold">{meByCategory[cat]}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{meta.tip}</p>
                </Card>
              );
            })}
          </div>

          {/* Matrix explanation */}
          <Card className="p-4 mb-4 bg-muted/30 border-dashed">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-center">
              <div><span className="font-semibold text-yellow-500">⭐ Stars</span> — High popularity + High margin. Promote, maintain quality.</div>
              <div><span className="font-semibold text-info">🔥 Plowhorses</span> — High popularity + Lower margin. Re-engineer recipe or reprice.</div>
              <div><span className="font-semibold text-purple-500">🏆 Puzzles</span> — Low popularity + High margin. Improve visibility on menu.</div>
              <div><span className="font-semibold text-muted-foreground">➖ Dogs</span> — Low popularity + Low margin. Consider removing.</div>
            </div>
          </Card>

          {/* Item list grouped by category */}
          {(["Star", "Plowhorse", "Puzzle", "Dog"] as const).map((cat) => {
            const items = menuEngineering.filter((i) => i.category === cat);
            if (items.length === 0) return null;
            const meta = ME_META[cat];
            const Icon = meta.icon;
            return (
              <div key={cat} className="mb-5">
                <h3 className={`font-semibold text-sm mb-2 flex items-center gap-1.5 ${meta.color}`}>
                  <Icon className="size-4" /> {cat}s <span className="font-normal text-muted-foreground">({items.length} items)</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {items.slice(0, 12).map((item) => (
                    <Card key={item.name} className={`p-3 border ${meta.bg}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium text-sm truncate ${cat === "Dog" ? "text-muted-foreground" : ""}`}>{item.name}</div>
                          <div className="text-[10px] text-muted-foreground">{item.cat}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-semibold">{fmtINR(item.price)}</div>
                          <div className="text-[10px] text-muted-foreground">{item.qty} sold</div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Revenue</span>
                        <span className="font-semibold text-success">{fmtINR(item.revenue)}</span>
                      </div>
                      <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full" style={{ width: `${Math.min(100, Math.round((item.qty / 45) * 100))}%` }} />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </TabsContent>

        {/* ── WAITLIST ─────────────────────────────────────────────────────── */}
        <TabsContent value="waitlist">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span><strong className="text-foreground">{waitlist.filter((w) => w.status === "Waiting").length}</strong> waiting</span>
              <span><strong className="text-foreground">{waitlist.filter((w) => w.status === "Notified").length}</strong> notified</span>
              <span><strong className="text-foreground">{waitlist.filter((w) => w.status === "Seated").length}</strong> seated today</span>
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => { setNewWL({ ...BLANK_WAITLIST }); setAddWLOpen(true); }}>
              <Plus className="size-4" />Add to Waitlist
            </Button>
          </div>

          {waitlist.filter((w) => w.status !== "Left" && w.status !== "Seated").length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              <Users className="size-10 mx-auto mb-3 opacity-30" />
              <p>No guests currently waiting.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {waitlist.filter((w) => w.status !== "Left" && w.status !== "Seated").map((w, idx) => (
                <Card key={w.id} className={`p-4 flex items-center gap-4 ${w.status === "Notified" ? "border-info/40 bg-info/5" : ""}`}>
                  <div className="size-8 rounded-full bg-muted grid place-items-center font-bold text-sm shrink-0">{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{w.name}</span>
                      <Badge variant="outline" className="text-[10px]"><Users className="size-2.5 mr-1" />{w.size} guests</Badge>
                      {w.status === "Notified" && <Badge className="text-[10px] bg-info/15 text-info border-info/30">Notified</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                      <span><Clock className="size-3 inline mr-1" />Added {w.addedAt}</span>
                      <span><Timer className="size-3 inline mr-1" />{w.waitMins > 0 ? `${w.waitMins}m waiting` : "Just arrived"}</span>
                      <span>{w.phone}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {w.status === "Waiting" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                        onClick={() => { setWaitlist((p) => p.map((x) => x.id === w.id ? { ...x, status: "Notified" } : x)); toast.success(`${w.name} notified`); }}>
                        <AlertCircle className="size-3" />Notify
                      </Button>
                    )}
                    <Button size="sm" className="h-7 text-xs gap-1"
                      onClick={() => { setWaitlist((p) => p.map((x) => x.id === w.id ? { ...x, status: "Seated" } : x)); toast.success(`${w.name} seated`); }}>
                      <CheckCircle2 className="size-3" />Seat
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => { setWaitlist((p) => p.map((x) => x.id === w.id ? { ...x, status: "Left" } : x)); toast.success(`${w.name} removed from waitlist`); }}>
                      <X className="size-3" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Seated / Left log */}
          {waitlist.filter((w) => w.status === "Seated" || w.status === "Left").length > 0 && (
            <div className="mt-5">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Completed today</h4>
              <div className="space-y-1.5">
                {waitlist.filter((w) => w.status === "Seated" || w.status === "Left").map((w) => (
                  <div key={w.id} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-muted/40 text-sm">
                    <span className={`size-2 rounded-full shrink-0 ${w.status === "Seated" ? "bg-success" : "bg-muted-foreground"}`} />
                    <span className="font-medium">{w.name}</span>
                    <span className="text-muted-foreground text-xs">{w.size} guests · {w.addedAt}</span>
                    <Badge variant="outline" className={`ml-auto text-[10px] ${w.status === "Seated" ? "text-success border-success/30" : ""}`}>{w.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── STAFF PERFORMANCE ─────────────────────────────────────────────── */}
        <TabsContent value="staff">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{waiters.length} servers on duty — {floor.filter((t) => t.status === "occupied").length} tables active</p>
            </div>

            {/* Waiter cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {waiters.map((w) => {
                const assignedSection = sectionAssign[w.id] ?? w.section;
                const activeTables = floor.filter((t) => t.waiter === w.name && t.status === "occupied").length;
                return (
                  <Card key={w.id} className="p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold">{w.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{assignedSection}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-success">{fmtINR(w.revenue)}</div>
                        <div className="text-xs text-muted-foreground">today's revenue</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-muted/40 rounded-md p-2">
                        <div className="font-semibold text-base">{activeTables}</div>
                        <div className="text-muted-foreground">Active</div>
                      </div>
                      <div className="bg-muted/40 rounded-md p-2">
                        <div className="font-semibold text-base">{w.covers}</div>
                        <div className="text-muted-foreground">Covers</div>
                      </div>
                      <div className="bg-muted/40 rounded-md p-2">
                        <div className="font-semibold text-base">{w.turns}×</div>
                        <div className="text-muted-foreground">Turns</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Avg check: <strong className="text-foreground">{fmtINR(w.avgCheck)}</strong></span>
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs">Section:</Label>
                        <Select value={assignedSection} onValueChange={(v) => { setSectionAssign((p) => ({ ...p, [w.id]: v as Section })); toast.success(`${w.name} moved to ${v}`); }}>
                          <SelectTrigger className="h-6 text-[11px] w-28 px-2"><SelectValue /></SelectTrigger>
                          <SelectContent>{SECTIONS.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    {/* Revenue bar */}
                    <div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Revenue contribution</span>
                        <span>{Math.round((w.revenue / waiters.reduce((s, x) => s + x.revenue, 0)) * 100)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round((w.revenue / waiters.reduce((s, x) => s + x.revenue, 0)) * 100)}%` }} />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Leaderboard table */}
            <Card>
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm">Server Leaderboard — Today</h3>
                <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs"><Printer className="size-3" />Print</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {["Rank", "Server", "Section", "Tables", "Covers", "Turns", "Avg Check", "Revenue"].map((h) => (
                        <th key={h} className={`px-4 py-3 text-xs font-medium text-muted-foreground ${h === "Revenue" || h === "Avg Check" ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...waiters].sort((a, b) => b.revenue - a.revenue).map((w, i) => (
                      <tr key={w.id} className="border-b last:border-0 hover:bg-accent/5">
                        <td className="px-4 py-3">
                          {i === 0 ? <span className="text-yellow-500 font-bold">#1 🏆</span> : i === 1 ? <span className="text-muted-foreground font-medium">#2</span> : <span className="text-muted-foreground text-xs">#{i + 1}</span>}
                        </td>
                        <td className="px-4 py-3 font-medium">{w.name}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{sectionAssign[w.id] ?? w.section}</td>
                        <td className="px-4 py-3 text-center">{w.tables}</td>
                        <td className="px-4 py-3 text-center">{w.covers}</td>
                        <td className="px-4 py-3 text-center">{w.turns}×</td>
                        <td className="px-4 py-3 text-right">{fmtINR(w.avgCheck)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-success">{fmtINR(w.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ── OPENING CHECKLIST ─────────────────────────────────────────────── */}
        <TabsContent value="opening">
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Pre-Service Checklist</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{checklistDone} of {OPENING_CHECKLIST.length} tasks completed</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm font-semibold text-primary">{Math.round((checklistDone / OPENING_CHECKLIST.length) * 100)}%</div>
                <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => setChecklist({})}>
                  <RefreshCw className="size-3" />Reset
                </Button>
                {checklistDone === OPENING_CHECKLIST.length && (
                  <Badge className="bg-success/15 text-success border-success/30 gap-1">
                    <CheckCircle2 className="size-3" />All done
                  </Badge>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-muted rounded-full overflow-hidden mb-5">
              <div className="h-full bg-success rounded-full transition-all" style={{ width: `${Math.round((checklistDone / OPENING_CHECKLIST.length) * 100)}%` }} />
            </div>

            {/* Grouped by section */}
            {Array.from(new Set(OPENING_CHECKLIST.map((c) => c.section))).map((sec) => (
              <div key={sec} className="mb-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{sec}</h4>
                <div className="space-y-1.5">
                  {OPENING_CHECKLIST.filter((c) => c.section === sec).map((c) => (
                    <button key={c.id}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-sm text-left transition-all ${checklist[c.id] ? "bg-success/10 border-success/30" : "hover:bg-accent/50 border-border"}`}
                      onClick={() => setChecklist((p) => ({ ...p, [c.id]: !p[c.id] }))}>
                      <div className={`size-5 rounded-full border-2 grid place-items-center shrink-0 transition-all ${checklist[c.id] ? "bg-success border-success" : "border-muted-foreground/40"}`}>
                        {checklist[c.id] && <CheckCircle2 className="size-3 text-white" />}
                      </div>
                      <span className={checklist[c.id] ? "line-through text-muted-foreground" : ""}>{c.task}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add to Waitlist Dialog */}
      <Dialog open={addWLOpen} onOpenChange={setAddWLOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add to Waitlist</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Guest Name *</Label>
              <Input className="h-8 mt-1" placeholder="Full name or party name" value={newWL.name} onChange={(e) => setNewWL({ ...newWL, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Party Size</Label>
                <Input type="number" min={1} max={20} className="h-8 mt-1" value={newWL.size} onChange={(e) => setNewWL({ ...newWL, size: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input className="h-8 mt-1" placeholder="+91 …" value={newWL.phone} onChange={(e) => setNewWL({ ...newWL, phone: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddWLOpen(false)}>Cancel</Button>
            <Button disabled={!newWL.name.trim()}
              onClick={() => {
                setWaitlist((p) => [...p, { id: `wl${Date.now()}`, name: newWL.name.trim(), size: Number(newWL.size) || 2, phone: newWL.phone, addedAt: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }), waitMins: 0, status: "Waiting" }]);
                toast.success(`${newWL.name} added to waitlist`);
                setAddWLOpen(false);
                setNewWL({ ...BLANK_WAITLIST });
              }}>
              Add Guest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
