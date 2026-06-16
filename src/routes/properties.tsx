import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/properties")({
  head: () => ({ meta: [{ title: "Properties · MHMS" }] }),
  component: Properties,
});

function Properties() {
  const { properties, setProperty } = useMHMS();
  return (
    <>
      <PageHeader title="Multi-Property Management" description="Roll up across portfolio" actions={<Button onClick={() => toast.success("New property form")}>Add property</Button>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Properties" value={properties.length} />
        <Stat label="Total Rooms" value={properties.reduce((s,p) => s + p.rooms, 0)} />
        <Stat label="Portfolio Occupancy" value={Math.round(properties.reduce((s,p) => s + p.occupancy, 0) / properties.length) + "%"} tone="info" />
        <Stat label="Portfolio ADR" value={fmtINR(Math.round(properties.reduce((s,p) => s + p.adr, 0) / properties.length))} tone="success" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Occupancy by property</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={properties}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={11} /><YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="occupancy" fill="hsl(var(--chart-1))" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-3">
          <div className="space-y-2">
            {properties.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded border hover:border-primary/40 cursor-pointer" onClick={() => { setProperty(p.id); toast.success(`Switched to ${p.name}`); }}>
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded bg-primary/10 text-primary grid place-items-center"><Building2 className="size-5" /></div>
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.city} · {p.rooms} rooms</div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline">Occ {p.occupancy}%</Badge>
                  <div className="text-sm text-muted-foreground mt-1">ADR {fmtINR(p.adr)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
