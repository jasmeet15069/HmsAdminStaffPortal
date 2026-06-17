import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend, AreaChart, Area,
} from "recharts";
import { Download, BarChart3, FileText, TrendingUp, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/csv";

const REPORT_CATALOG = [
  { name: "Daily Revenue", category: "Financial", icon: "₹", description: "Day-by-day revenue breakdown" },
  { name: "Occupancy by Type", category: "Operations", icon: "🏨", description: "Room type occupancy rates" },
  { name: "Source Mix", category: "Sales", icon: "📊", description: "Booking source distribution" },
  { name: "ADR / RevPAR", category: "Financial", icon: "📈", description: "Key rate metrics over time" },
  { name: "Forecast vs Actual", category: "Financial", icon: "🎯", description: "Budget variance analysis" },
  { name: "Housekeeping Productivity", category: "Operations", icon: "✨", description: "HK tasks and turnaround times" },
  { name: "Maintenance SLA", category: "Operations", icon: "🔧", description: "Ticket resolution times" },
  { name: "F&B Sales", category: "F&B", icon: "🍽️", description: "POS revenue by outlet" },
  { name: "Tax Summary (GST)", category: "Financial", icon: "📋", description: "GST breakdown for compliance" },
  { name: "Cancellation Analysis", category: "Sales", icon: "❌", description: "Cancellation rates and reasons" },
  { name: "Guest Demographics", category: "CRM", icon: "👥", description: "Nationality and loyalty stats" },
  { name: "Loyalty Program", category: "CRM", icon: "⭐", description: "Points earned and redeemed" },
  { name: "Channel Performance", category: "Sales", icon: "🌐", description: "OTA vs direct booking analysis" },
  { name: "Folio Aging", category: "Financial", icon: "⏰", description: "AR aging and outstanding balances" },
  { name: "Corporate Accounts", category: "Sales", icon: "🏢", description: "Corporate booking volumes" },
  { name: "Night Audit Trail", category: "Operations", icon: "🌙", description: "Audit step history log" },
  { name: "Room Revenue", category: "Financial", icon: "🛏️", description: "Revenue per room category" },
  { name: "Payroll Summary", category: "HR", icon: "💼", description: "Staff cost by department" },
];

const CATEGORIES = ["All", "Financial", "Operations", "Sales", "F&B", "CRM", "HR"];

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports & Analytics · MHMS" }] }),
  component: Reports,
});

function Reports() {
  const { folios, reservations, payments, guests, rooms } = useMHMS();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");

  const monthly = useMemo(() => Array.from({ length: 12 }).map((_, i) => ({
    month: new Date(2026, i, 1).toLocaleDateString("en", { month: "short" }),
    revenue: 1200000 + Math.round((Math.sin(i / 2) + 1) * 800000),
    occupancy: 55 + Math.round((Math.sin(i / 2) + 1) * 20),
    adr: 5000 + Math.round((Math.cos(i / 3) + 1) * 1500),
  })), []);

  const sourceMix = useMemo(() => ["Direct", "Booking.com", "Expedia", "Walk-in", "Corporate"].map((s) => ({
    name: s,
    value: Math.max(5, reservations.filter((r) => r.source === s).length),
  })), [reservations]);

  const deptRevenue = [
    { dept: "Rooms", revenue: 2840000 },
    { dept: "F&B", revenue: 680000 },
    { dept: "Spa", revenue: 340000 },
    { dept: "Events", revenue: 220000 },
    { dept: "Other", revenue: 120000 },
  ];

  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

  const totalRevenue = monthly.reduce((s, m) => s + m.revenue, 0);
  const avgOcc = Math.round(monthly.reduce((s, m) => s + m.occupancy, 0) / 12);
  const avgAdr = Math.round(monthly.reduce((s, m) => s + m.adr, 0) / 12);

  const runReport = (name: string) => {
    let rows: Record<string, unknown>[] = [];
    if (name === "Daily Revenue") rows = monthly.map((m) => ({ month: m.month, revenue: m.revenue, occupancy: m.occupancy }));
    else if (name === "Source Mix") rows = sourceMix.map((s) => ({ source: s.name, bookings: s.value }));
    else if (name === "Folio Aging") rows = reservations.map((r) => {
      const t = folios.filter((f) => f.reservationId === r.id).reduce((s, f) => s + f.amount, 0);
      const p = payments.filter((x) => x.reservationId === r.id).reduce((s, x) => s + x.amount, 0);
      return { code: r.code, guest: guests.find((g) => g.id === r.guestId)?.name, charges: t, paid: p, balance: t - p };
    });
    else if (name === "Guest Demographics") rows = guests.map((g) => ({ name: g.name, tier: g.loyaltyTier, points: g.loyaltyPoints, stays: g.totalStays, nationality: g.nationality }));
    else if (name === "Occupancy by Type") {
      const groups: Record<string, { type: string; total: number; occupied: number }> = {};
      rooms.forEach((r) => { groups[r.type] ??= { type: r.type, total: 0, occupied: 0 }; groups[r.type].total++; if (r.status === "occupied") groups[r.type].occupied++; });
      rows = Object.values(groups).map((g) => ({ type: g.type, total: g.total, occupied: g.occupied, occupancy_pct: Math.round((g.occupied / g.total) * 100) }));
    } else rows = reservations.map((r) => ({ code: r.code, status: r.status, source: r.source, rate: r.rate, checkIn: r.checkIn, checkOut: r.checkOut }));
    downloadCSV(`${name.replace(/[^\w]+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success(`Exported "${name}" (${rows.length} rows)`);
  };

  const filteredCatalog = REPORT_CATALOG.filter((r) => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "All" || r.category === catFilter;
    return matchSearch && matchCat;
  });

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description="Operational, financial, and CRM reports with export"
        actions={
          <Button onClick={() => runReport("Daily Revenue")} className="gap-1.5">
            <Download className="size-4" /> Export Daily Revenue
          </Button>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview"><BarChart3 className="size-3.5 mr-1.5" />Overview</TabsTrigger>
          <TabsTrigger value="financial"><TrendingUp className="size-3.5 mr-1.5" />Financial</TabsTrigger>
          <TabsTrigger value="catalog"><FileText className="size-3.5 mr-1.5" />All Reports</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Stat label="YTD Revenue" value={fmtINR(totalRevenue)} tone="success" hint="Jan–Jun 2026" />
            <Stat label="Avg Occupancy" value={`${avgOcc}%`} tone="info" hint="Year to date" />
            <Stat label="Avg ADR" value={fmtINR(avgAdr)} hint="Year to date" />
            <Stat label="Total Bookings" value={reservations.length} hint="All statuses" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <Card className="lg:col-span-2 p-5">
              <h3 className="font-semibold mb-4">Monthly Revenue & Occupancy</h3>
              <div className="h-72">
                <ResponsiveContainer>
                  <LineChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" fontSize={11} />
                    <YAxis yAxisId="l" fontSize={11} />
                    <YAxis yAxisId="r" orientation="right" fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="l" type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" name="Revenue ₹" strokeWidth={2} dot={false} />
                    <Line yAxisId="r" type="monotone" dataKey="occupancy" stroke="hsl(var(--chart-2))" name="Occupancy %" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Booking Source Mix</h3>
              <div className="h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={sourceMix} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                      {sourceMix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Legend iconType="circle" iconSize={8} />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Department Revenue Breakdown</h3>
              <div className="h-52">
                <ResponsiveContainer>
                  <BarChart data={deptRevenue} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                    <XAxis type="number" fontSize={11} />
                    <YAxis dataKey="dept" type="category" fontSize={11} width={55} />
                    <Tooltip formatter={(v: number) => [fmtINR(v), "Revenue"]} />
                    <Bar dataKey="revenue" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold mb-4">ADR Trend by Month</h3>
              <div className="h-52">
                <ResponsiveContainer>
                  <AreaChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: number) => [fmtINR(v), "ADR"]} />
                    <Area type="monotone" dataKey="adr" stroke="hsl(var(--chart-4))" fill="hsl(var(--chart-4))" fillOpacity={0.2} name="ADR ₹" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Financial */}
        <TabsContent value="financial">
          <Card className="p-5 mb-4">
            <h3 className="font-semibold mb-4">Revenue by Month (Bar)</h3>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: number) => [fmtINR(v), "Revenue"]} />
                  <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Revenue ₹" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Monthly Revenue Table</h3>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => runReport("Daily Revenue")}>
                <Download className="size-3.5" /> Export
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Month", "Revenue", "Occupancy", "ADR", "RevPAR"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.month} className="border-b last:border-0 hover:bg-accent/5">
                      <td className="px-4 py-3 font-medium">{m.month}</td>
                      <td className="px-4 py-3">{fmtINR(m.revenue)}</td>
                      <td className="px-4 py-3">{m.occupancy}%</td>
                      <td className="px-4 py-3">{fmtINR(m.adr)}</td>
                      <td className="px-4 py-3">{fmtINR(Math.round(m.adr * m.occupancy / 100))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Catalog */}
        <TabsContent value="catalog">
          <div className="flex gap-2 mb-3 flex-wrap items-center">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8 h-8 w-52 text-sm" placeholder="Search reports…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCatFilter(c)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${catFilter === c ? "bg-secondary text-secondary-foreground border-secondary" : "hover:border-muted-foreground/40"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredCatalog.map((r) => (
              <Card key={r.name} className="p-4 hover:border-primary/40 cursor-pointer transition-colors group" onClick={() => runReport(r.name)}>
                <div className="flex items-start justify-between mb-2">
                  <div className="text-xl">{r.icon}</div>
                  <Badge variant="secondary" className="text-[10px]">{r.category}</Badge>
                </div>
                <div className="font-medium text-sm">{r.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5 mb-2">{r.description}</div>
                <div className="flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <Download className="size-3" /> Export CSV
                </div>
              </Card>
            ))}
            {filteredCatalog.length === 0 && (
              <div className="col-span-4 text-center py-12 text-muted-foreground">No reports match your search.</div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
