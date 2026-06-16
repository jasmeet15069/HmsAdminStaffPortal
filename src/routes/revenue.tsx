import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from "recharts";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/revenue")({
  head: () => ({ meta: [{ title: "Revenue Management · MHMS" }] }),
  component: Revenue,
});

function Revenue() {
  const { rooms } = useMHMS();
  const [adjust, setAdjust] = useState([10]);

  const forecast = Array.from({ length: 14 }, (_, i) => ({
    day: `D${i + 1}`,
    occupancy: 55 + Math.round(Math.random() * 40),
    rate: 5000 + Math.round(Math.random() * 3000) + adjust[0] * 50,
  }));

  const competitors = [
    { name: "Hotel Apex", rate: 6200, occ: 72 },
    { name: "Grand Plaza", rate: 7100, occ: 81 },
    { name: "Crystal Inn", rate: 5400, occ: 68 },
    { name: "You (MHMS)", rate: 6200 + adjust[0] * 50, occ: 78 },
  ];

  return (
    <>
      <PageHeader title="Revenue Management System" description="Dynamic pricing, forecasts and competitor rates" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="ADR" value={fmtINR(6200)} tone="success" />
        <Stat label="RevPAR" value={fmtINR(4836)} tone="info" />
        <Stat label="Forecast Occupancy" value="82%" />
        <Stat label="Pace vs LY" value="+9.4%" tone="success" />
      </div>

      <Tabs defaultValue="forecast">
        <TabsList>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="rates">Rate Adjustments</TabsTrigger>
          <TabsTrigger value="comp">Comp Set</TabsTrigger>
        </TabsList>
        <TabsContent value="forecast">
          <Card className="p-5 mt-4">
            <h3 className="font-semibold mb-3">14-day occupancy & rate forecast</h3>
            <div className="h-80">
              <ResponsiveContainer>
                <LineChart data={forecast}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="day" fontSize={12} /><YAxis yAxisId="l" fontSize={12} /><YAxis yAxisId="r" orientation="right" fontSize={12} />
                  <Tooltip /><Legend />
                  <Line yAxisId="l" type="monotone" dataKey="occupancy" stroke="hsl(var(--chart-1))" name="Occupancy %" strokeWidth={2} />
                  <Line yAxisId="r" type="monotone" dataKey="rate" stroke="hsl(var(--chart-2))" name="ADR ₹" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="rates">
          <Card className="p-5 mt-4 max-w-2xl">
            <h3 className="font-semibold">Bulk rate adjustment</h3>
            <p className="text-sm text-muted-foreground mb-4">Apply a percentage delta to base room rates for the next 14 days.</p>
            <Label>Adjustment: <span className="font-semibold text-foreground">{adjust[0] >= 0 ? "+" : ""}{adjust[0]}%</span></Label>
            <Slider value={adjust} onValueChange={setAdjust} min={-30} max={50} step={1} className="my-4" />
            <div className="grid grid-cols-2 gap-3 text-sm">
              {Array.from(new Set(rooms.map(r => r.type))).map((t) => {
                const base = rooms.find(r => r.type === t)!.rate;
                const adj = Math.round(base * (1 + adjust[0] / 100));
                return (
                  <div key={t} className="border rounded p-3 flex items-center justify-between">
                    <span>{t}</span>
                    <span><span className="text-muted-foreground line-through mr-2">{fmtINR(base)}</span><span className="font-semibold">{fmtINR(adj)}</span></span>
                  </div>
                );
              })}
            </div>
            <Button className="mt-4" onClick={() => toast.success(`Applied ${adjust[0]}% adjustment to all room types`)}>Apply to all rooms</Button>
          </Card>
        </TabsContent>
        <TabsContent value="comp">
          <Card className="p-5 mt-4">
            <h3 className="font-semibold mb-3">Competitive set</h3>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={competitors}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="rate" fill="hsl(var(--chart-1))" name="Rate ₹" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-4 gap-3 mt-4">
              {competitors.map(c => (
                <div key={c.name} className="border rounded p-3">
                  <div className="font-medium text-sm">{c.name}</div>
                  <div className="text-xs text-muted-foreground">ADR {fmtINR(c.rate)} · Occ {c.occ}%</div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
