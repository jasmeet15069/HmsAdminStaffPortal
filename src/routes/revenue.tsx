import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend, AreaChart, Area } from "recharts";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const DEMAND_CALENDAR = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(2026, 5, 18 + i);
  const occ = Math.round(40 + Math.random() * 58);
  const level = occ >= 85 ? "High" : occ >= 65 ? "Medium" : "Low";
  return {
    day: date.toLocaleDateString("en", { weekday: "short" }),
    date: date.toLocaleDateString("en", { month: "short", day: "numeric" }),
    occ,
    level,
  };
});

export const Route = createFileRoute("/revenue")({
  head: () => ({ meta: [{ title: "Revenue Management · MHMS" }] }),
  component: Revenue,
});

function Revenue() {
  const { rooms } = useMHMS();
  const [adjust, setAdjust] = useState([0]);
  const [dynamicPricing, setDynamicPricing] = useState(true);

  const forecast = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    day: `Jun ${18 + i}`,
    occupancy: 55 + Math.round(Math.random() * 40),
    rate: 5000 + Math.round(Math.random() * 3000) + adjust[0] * 50,
    revpar: 0,
  })).map((d) => ({ ...d, revpar: Math.round(d.rate * d.occupancy / 100) })), [adjust]);

  const competitors = [
    { name: "Hotel Apex", rate: 6200, occ: 72, diff: -200 },
    { name: "Grand Plaza", rate: 7100, occ: 81, diff: 700 },
    { name: "Crystal Inn", rate: 5400, occ: 68, diff: -1000 },
    { name: "Seascape Resort", rate: 6800, occ: 75, diff: 400 },
    { name: "You (MHMS)", rate: 6200 + adjust[0] * 50, occ: 78, diff: 0 },
  ];

  const paceData = Array.from({ length: 12 }, (_, i) => ({
    month: new Date(2026, i).toLocaleString("en", { month: "short" }),
    thisYear: Math.round(300 + Math.random() * 250),
    lastYear: Math.round(280 + Math.random() * 200),
  }));

  const roomTypes = Array.from(new Set(rooms.map((r) => r.type))).map((t) => {
    const typeRooms = rooms.filter((r) => r.type === t);
    const base = typeRooms[0]?.rate ?? 0;
    const adj = Math.round(base * (1 + adjust[0] / 100));
    const occ = Math.round(typeRooms.filter((r) => r.status === "occupied").length / typeRooms.length * 100);
    return { type: t, base, adj, count: typeRooms.length, occ };
  });

  const adr = Math.round(rooms.reduce((s, r) => s + r.rate, 0) / rooms.length);
  const occPct = Math.round(rooms.filter((r) => r.status === "occupied").length / rooms.length * 100);
  const revpar = Math.round(adr * occPct / 100);

  return (
    <>
      <PageHeader
        title="Revenue Management"
        description="Dynamic pricing, forecasts, comp set and pace analysis"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Label className="text-xs font-medium">Dynamic Pricing</Label>
              <Switch checked={dynamicPricing} onCheckedChange={setDynamicPricing} />
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="ADR" value={fmtINR(adr + adjust[0] * 50)} tone="success" hint="Average Daily Rate" />
        <Stat label="RevPAR" value={fmtINR(revpar + adjust[0] * 40)} tone="info" hint="Revenue Per Available Room" />
        <Stat label="Occupancy" value={`${occPct}%`} hint="Current occupancy" />
        <Stat label="Pace vs LY" value="+9.4%" tone="success" hint="Year-over-year booking pace" />
      </div>

      <Tabs defaultValue="forecast">
        <TabsList className="mb-4">
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="rates">Rate Strategy</TabsTrigger>
          <TabsTrigger value="demand">Demand Calendar</TabsTrigger>
          <TabsTrigger value="comp">Comp Set</TabsTrigger>
          <TabsTrigger value="pace">Pace Analysis</TabsTrigger>
        </TabsList>

        {/* Forecast */}
        <TabsContent value="forecast">
          <Card className="p-5">
            <h3 className="font-semibold mb-1">14-Day Occupancy & Rate Forecast</h3>
            <p className="text-xs text-muted-foreground mb-4">Projected based on current bookings + historical patterns</p>
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={forecast}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="day" fontSize={10} interval={1} />
                  <YAxis yAxisId="l" fontSize={11} />
                  <YAxis yAxisId="r" orientation="right" fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="l" type="monotone" dataKey="occupancy" stroke="hsl(var(--chart-1))" name="Occupancy %" strokeWidth={2} dot={false} />
                  <Line yAxisId="r" type="monotone" dataKey="rate" stroke="hsl(var(--chart-2))" name="ADR ₹" strokeWidth={2} dot={false} />
                  <Line yAxisId="r" type="monotone" dataKey="revpar" stroke="hsl(var(--chart-3))" name="RevPAR ₹" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        {/* Rate Strategy */}
        <TabsContent value="rates">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5 space-y-4">
              <h3 className="font-semibold">Bulk Rate Adjustment</h3>
              <p className="text-xs text-muted-foreground">Apply a delta to all room type base rates for the next 14 days.</p>
              <div>
                <Label className="text-sm">Adjustment: <span className="font-semibold text-foreground">{adjust[0] >= 0 ? "+" : ""}{adjust[0]}%</span></Label>
                <Slider value={adjust} onValueChange={setAdjust} min={-30} max={50} step={1} className="my-3" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>-30%</span><span>0%</span><span>+50%</span>
                </div>
              </div>
              <div className="space-y-2">
                {roomTypes.map((rt) => (
                  <div key={rt.type} className="flex items-center justify-between border rounded p-3">
                    <div>
                      <div className="font-medium text-sm">{rt.type}</div>
                      <div className="text-xs text-muted-foreground">{rt.count} rooms · Occ {rt.occ}%</div>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground line-through text-xs mr-2">{fmtINR(rt.base)}</span>
                      <span className={`font-semibold ${adjust[0] > 0 ? "text-success" : adjust[0] < 0 ? "text-destructive" : ""}`}>{fmtINR(rt.adj)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="w-full" onClick={() => toast.success(`Applied ${adjust[0]}% to all room types for next 14 days`)}>
                Apply Rate Adjustment
              </Button>
            </Card>
            <Card className="p-5 space-y-4">
              <h3 className="font-semibold">Dynamic Pricing Rules</h3>
              <div className="space-y-3">
                {[
                  { rule: "Occupancy > 85%", action: "Increase rates by 15%", active: true },
                  { rule: "Occupancy < 40%", action: "Decrease rates by 10%", active: true },
                  { rule: "Advance booking < 3 days", action: "Increase rates by 20%", active: dynamicPricing },
                  { rule: "Long weekend (3+ days)", action: "Increase rates by 25%", active: true },
                  { rule: "Local events detected", action: "Surge pricing +30%", active: dynamicPricing },
                ].map((r) => (
                  <div key={r.rule} className="flex items-start justify-between border rounded p-3 gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{r.rule}</div>
                      <div className="text-xs text-muted-foreground">{r.action}</div>
                    </div>
                    <Switch defaultChecked={r.active} onCheckedChange={() => toast.info("Rule updated")} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Demand Calendar */}
        <TabsContent value="demand">
          <Card className="p-5">
            <h3 className="font-semibold mb-1">30-Day Demand Forecast</h3>
            <div className="flex items-center gap-4 mb-4 text-xs">
              <span className="flex items-center gap-1"><div className="size-3 rounded bg-destructive/60" />High ≥85%</span>
              <span className="flex items-center gap-1"><div className="size-3 rounded bg-warning/60" />Medium 65-84%</span>
              <span className="flex items-center gap-1"><div className="size-3 rounded bg-success/40" />Low &lt;65%</span>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-7 lg:grid-cols-10 gap-1.5">
              {DEMAND_CALENDAR.map((d, i) => (
                <div key={i} className={`rounded-lg p-2 text-center cursor-pointer hover:opacity-80 transition-opacity ${d.level === "High" ? "bg-destructive/20" : d.level === "Medium" ? "bg-warning/20" : "bg-success/10"}`}>
                  <div className="text-[10px] text-muted-foreground">{d.day}</div>
                  <div className="text-xs font-semibold mt-0.5">{d.occ}%</div>
                  <div className="text-[9px] text-muted-foreground">{d.date}</div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Comp Set */}
        <TabsContent value="comp">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Competitive Set — Tonight's Rates</h3>
              <div className="space-y-3">
                {competitors.map((c) => {
                  const isUs = c.name.startsWith("You");
                  const Icon = c.diff > 0 ? TrendingUp : c.diff < 0 ? TrendingDown : Minus;
                  return (
                    <div key={c.name} className={`flex items-center justify-between p-3 rounded border ${isUs ? "border-primary/50 bg-primary/5" : ""}`}>
                      <div>
                        <div className={`font-medium text-sm ${isUs ? "text-primary" : ""}`}>{c.name}</div>
                        <div className="text-xs text-muted-foreground">Occupancy: {c.occ}%</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{fmtINR(c.rate)}</div>
                        {!isUs && (
                          <div className={`text-xs flex items-center gap-0.5 ${c.diff > 0 ? "text-destructive" : c.diff < 0 ? "text-success" : "text-muted-foreground"}`}>
                            <Icon className="size-3" />
                            {c.diff > 0 ? `+${fmtINR(c.diff)} vs us` : `${fmtINR(Math.abs(c.diff))} below us`}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Rate Comparison Chart</h3>
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={competitors.map((c) => ({ name: c.name.split(" ")[0], rate: c.rate }))}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="rate" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Rate ₹" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Pace Analysis */}
        <TabsContent value="pace">
          <Card className="p-5">
            <h3 className="font-semibold mb-1">Booking Pace — This Year vs Last Year</h3>
            <p className="text-xs text-muted-foreground mb-4">Cumulative bookings by month. 2026 is outpacing 2025 by +9.4% YTD.</p>
            <div className="h-72">
              <ResponsiveContainer>
                <AreaChart data={paceData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="thisYear" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.2} name="2026" strokeWidth={2} />
                  <Area type="monotone" dataKey="lastYear" stroke="hsl(var(--chart-4))" fill="hsl(var(--chart-4))" fillOpacity={0.15} name="2025" strokeWidth={2} strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
