import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

const channels = [
  { name: "Booking.com", logo: "B", status: true, rooms: 60, bookings: 142, revenue: 1240000 },
  { name: "Expedia", logo: "E", status: true, rooms: 60, bookings: 89, revenue: 780000 },
  { name: "Agoda", logo: "A", status: true, rooms: 60, bookings: 54, revenue: 460000 },
  { name: "MakeMyTrip", logo: "M", status: false, rooms: 0, bookings: 0, revenue: 0 },
  { name: "Airbnb", logo: "A", status: true, rooms: 15, bookings: 38, revenue: 312000 },
  { name: "Goibibo", logo: "G", status: true, rooms: 60, bookings: 28, revenue: 192000 },
];

export const Route = createFileRoute("/channel-manager")({
  head: () => ({ meta: [{ title: "Channel Manager · MHMS" }] }),
  component: ChannelManager,
});

function ChannelManager() {
  const [list, setList] = useState(channels);
  return (
    <>
      <PageHeader title="Channel Manager" description="OTA connections, rates and inventory parity" actions={
        <Button onClick={() => toast.success("Synced inventory & rates to all active channels")}><RefreshCw className="size-4" /> Sync all</Button>
      } />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Active Channels" value={list.filter(c => c.status).length} tone="success" />
        <Stat label="Bookings (30d)" value={list.reduce((s,c) => s + c.bookings, 0)} />
        <Stat label="OTA Revenue" value={"₹" + (list.reduce((s,c) => s + c.revenue, 0)/100000).toFixed(1) + "L"} tone="success" />
        <Stat label="Parity Issues" value={2} tone="warning" />
      </div>
      <Card className="p-4">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Channel</TableHead><TableHead>Status</TableHead><TableHead>Rooms Mapped</TableHead>
            <TableHead>Bookings (30d)</TableHead><TableHead>Revenue</TableHead><TableHead>Last Sync</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {list.map((c, i) => (
              <TableRow key={c.name}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="size-9 rounded bg-primary/10 text-primary grid place-items-center font-bold">{c.logo}</div>
                    <span className="font-medium">{c.name}</span>
                  </div>
                </TableCell>
                <TableCell><Switch checked={c.status} onCheckedChange={(v) => { setList(list.map((x, j) => j === i ? { ...x, status: v } : x)); toast.success(`${c.name} ${v ? "connected" : "disconnected"}`); }} /></TableCell>
                <TableCell>{c.rooms}</TableCell>
                <TableCell>{c.bookings}</TableCell>
                <TableCell>₹{(c.revenue/1000).toFixed(0)}K</TableCell>
                <TableCell className="text-sm text-muted-foreground">2 min ago</TableCell>
                <TableCell><Button size="sm" variant="outline" onClick={() => toast.success(`${c.name} synced`)}>Sync</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
