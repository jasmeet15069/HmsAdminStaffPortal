import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from "recharts";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/csv";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports & Analytics · MHMS" }] }),
  component: Reports,
});

const REPORTS = [
  "Daily Revenue", "Occupancy by Type", "Source Mix", "ADR / RevPAR", "Forecast vs Actual",
  "Housekeeping Productivity", "Maintenance SLA", "F&B Sales", "Tax Summary (GST)",
  "Cancellation Analysis", "Guest Demographics", "Loyalty Program", "Channel Performance",
  "Folio Aging", "Corporate Accounts", "Night Audit Trail",
];

function Reports() {
  const { folios, reservations, payments, guests, rooms } = useMHMS();
  const monthly = Array.from({ length: 12 }).map((_, i) => ({
    month: new Date(2026, i, 1).toLocaleDateString("en", { month: "short" }),
    revenue: 1200000 + Math.round(Math.random() * 1600000),
    occupancy: 55 + Math.round(Math.random() * 40),
  }));
  const sourceMix = ["Direct","Booking.com","Expedia","Walk-in","Corporate"].map((s) => ({
    name: s, value: reservations.filter(r => r.source === s).length,
  }));
  const COLORS = ["hsl(var(--chart-1))","hsl(var(--chart-2))","hsl(var(--chart-3))","hsl(var(--chart-4))","hsl(var(--chart-5))"];

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
    }
    else rows = reservations.map((r) => ({ code: r.code, status: r.status, source: r.source, rate: r.rate, checkIn: r.checkIn, checkOut: r.checkOut }));
    downloadCSV(`${name.replace(/[^\w]+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0,10)}.csv`, rows);
    toast.success(`Exported "${name}" (${rows.length} rows)`);
  };

  return (
    <>
      <PageHeader title="Reports & Analytics" description="Operational and financial reports" actions={
        <Button onClick={() => runReport("Daily Revenue")}><Download className="size-4" /> Export Daily Revenue</Button>
      } />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="catalog">All Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-4">
            <Stat label="YTD Revenue" value={fmtINR(monthly.reduce((s,m) => s + m.revenue, 0))} tone="success" />
            <Stat label="Avg Occupancy" value={Math.round(monthly.reduce((s,m) => s + m.occupancy, 0) / 12) + "%"} tone="info" />
            <Stat label="Total Bookings" value={reservations.length} />
            <Stat label="Total Folios" value={folios.length} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 p-5">
              <h3 className="font-semibold mb-3">Monthly revenue & occupancy</h3>
              <div className="h-80">
                <ResponsiveContainer>
                  <LineChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" fontSize={12} /><YAxis yAxisId="l" fontSize={12} /><YAxis yAxisId="r" orientation="right" fontSize={12} />
                    <Tooltip /><Legend />
                    <Line yAxisId="l" type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" name="Revenue ₹" strokeWidth={2} />
                    <Line yAxisId="r" type="monotone" dataKey="occupancy" stroke="hsl(var(--chart-2))" name="Occupancy %" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold mb-3">Source mix</h3>
              <div className="h-72">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={sourceMix} dataKey="value" nameKey="name" outerRadius={90} label>
                      {sourceMix.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="financial">
          <Card className="p-5 mt-4">
            <h3 className="font-semibold mb-3">Revenue by month</h3>
            <div className="h-80">
              <ResponsiveContainer>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" fontSize={12} /><YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="catalog">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {REPORTS.map(r => (
              <Card key={r} className="p-4 hover:border-primary/40 cursor-pointer transition" onClick={() => runReport(r)}>
                <div className="font-medium text-sm">{r}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Download className="size-3" /> Export CSV</div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
