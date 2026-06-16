import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR, roomStatusMeta } from "@/lib/mhms-store";
import { useDashboardData, useDashboardStats } from "@/lib/api/hooks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarPlus, LogIn, LogOut, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard · MHMS" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { rooms, reservations, guests, folios, tasks, maintenance } = useMHMS();
  const today = new Date().toISOString().slice(0, 10);

  // Live data from the Go API. When unavailable (signed out / backend down),
  // these are undefined and we fall back to the local demo store below.
  const { data: liveStats } = useDashboardStats();
  const { data: liveData } = useDashboardData();
  const isLive = !!liveStats;

  const occupied = liveStats?.rooms_occupied ?? rooms.filter((r) => r.status === "occupied").length;
  const roomsTotal = liveStats
    ? liveStats.rooms_occupied + liveStats.rooms_available
    : rooms.length;
  const arrivals =
    liveStats?.guests_checking_in_today ??
    reservations.filter((r) => r.checkIn === today && r.status !== "cancelled").length;
  const departures =
    liveStats?.guests_checking_out_today ??
    reservations.filter((r) => r.checkOut === today && r.status === "checked_in").length;
  const inHouse =
    liveStats?.rooms_occupied ?? reservations.filter((r) => r.status === "checked_in").length;
  const occupancyPct = liveStats
    ? Math.round(liveStats.occupancy_rate)
    : Math.round((occupied / rooms.length) * 100);
  const revenue = liveStats?.revenue_today ?? folios.reduce((s, f) => s + f.amount, 0);
  const adr = Math.round(revenue / Math.max(occupied, 1));

  const revenueByDept = liveData?.charts.department_revenue?.length
    ? liveData.charts.department_revenue.map((d) => ({ name: d.department, value: d.current }))
    : [
        {
          name: "Rooms",
          value: folios.filter((f) => f.category === "Room").reduce((s, f) => s + f.amount, 0),
        },
        { name: "F&B", value: 285000 },
        { name: "Spa", value: 76000 },
        { name: "Other", value: 42000 },
      ];

  const weekData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      day: d.toLocaleDateString("en", { weekday: "short" }),
      occupancy: 60 + Math.round(Math.random() * 35),
      revenue: 180000 + Math.round(Math.random() * 220000),
    };
  });

  const statusBreakdown = (
    ["vacant_clean", "occupied", "vacant_dirty", "maintenance", "blocked"] as const
  ).map((s) => ({
    name: roomStatusMeta[s].label,
    value: rooms.filter((r) => r.status === s).length,
  }));
  const COLORS = [
    "hsl(var(--chart-2))",
    "hsl(var(--chart-1))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  return (
    <>
      <PageHeader
        title="Operations Dashboard"
        description={`Today · ${new Date().toLocaleDateString("en-IN", { dateStyle: "full" })}`}
        actions={
          <>
            <Badge variant={isLive ? "default" : "outline"} className="self-center">
              {isLive ? "Live data" : "Demo data"}
            </Badge>
            <Button variant="outline" asChild>
              <Link to="/reports">View reports</Link>
            </Button>
            <Button asChild>
              <Link to="/reservations/new">
                <CalendarPlus className="size-4" /> New reservation
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Occupancy"
          value={`${occupancyPct}%`}
          hint={`${occupied}/${roomsTotal} rooms`}
          tone="info"
        />
        <Stat label="ADR" value={fmtINR(adr)} hint="Avg daily rate" tone="success" />
        <Stat
          label="RevPAR"
          value={fmtINR(Math.round((adr * occupancyPct) / 100))}
          hint="Revenue per available room"
        />
        <Stat
          label="Total Revenue (MTD)"
          value={fmtINR(revenue + 403000)}
          hint="All departments"
          tone="success"
        />
        <Stat label="Today's Arrivals" value={arrivals} hint="Scheduled check-ins" />
        <Stat label="Today's Departures" value={departures} hint="Scheduled check-outs" />
        <Stat
          label="In-House Guests"
          value={inHouse}
          hint={`${guests.filter((g) => g.vip).length} VIP`}
          tone="info"
        />
        <Stat
          label="Open Tickets"
          value={maintenance.filter((m) => m.status !== "Resolved" && m.status !== "Closed").length}
          hint="Maintenance"
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Occupancy & Revenue · last 7 days</h3>
              <p className="text-xs text-muted-foreground">Property-wide performance</p>
            </div>
            <Badge variant="outline">Live</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={weekData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" fontSize={12} />
                <YAxis yAxisId="l" fontSize={12} />
                <YAxis yAxisId="r" orientation="right" fontSize={12} />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="l"
                  type="monotone"
                  dataKey="occupancy"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  name="Occupancy %"
                />
                <Line
                  yAxisId="r"
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  name="Revenue ₹"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-4">Room Status</h3>
          <div className="h-48">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={statusBreakdown}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={75}
                >
                  {statusBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {statusBreakdown.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: COLORS[i] }} />
                  {s.name}
                </div>
                <span className="font-medium">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Department Revenue</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={revenueByDept}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { to: "/front-desk", label: "Check In", icon: LogIn },
              { to: "/front-desk", label: "Check Out", icon: LogOut },
              { to: "/housekeeping", label: "Assign Cleaning", icon: Sparkles },
              { to: "/reservations/new", label: "New Booking", icon: CalendarPlus },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.label}
                  to={a.to}
                  className="border rounded-lg p-4 hover:bg-accent/5 hover:border-primary/40 transition group"
                >
                  <Icon className="size-5 text-primary mb-3" />
                  <div className="font-medium text-sm">{a.label}</div>
                  <ArrowRight className="size-4 text-muted-foreground group-hover:translate-x-1 transition mt-2" />
                </Link>
              );
            })}
          </div>
          <div className="mt-5">
            <h4 className="text-sm font-semibold mb-2">Pending Housekeeping</h4>
            <div className="space-y-1.5">
              {tasks
                .filter((t) => t.status !== "Completed")
                .slice(0, 5)
                .map((t) => {
                  const room = rooms.find((r) => r.id === t.roomId);
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between text-sm py-1.5 border-b last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono">
                          {room?.number}
                        </Badge>
                        <span>{t.type}</span>
                        <span className="text-muted-foreground text-xs">
                          · {t.assignedTo || "Unassigned"}
                        </span>
                      </div>
                      <Badge
                        variant={
                          t.priority === "High" || t.priority === "Urgent"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {t.priority}
                      </Badge>
                    </div>
                  );
                })}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
