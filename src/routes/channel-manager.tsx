import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Globe2, RefreshCw, AlertTriangle, CheckCircle2, Clock, TrendingUp, Settings, Plus, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { fmtINR } from "@/lib/mhms-store";
import { useAuth } from "@/lib/api/auth";
import { useChannelConnections, useCreateChannelConnection, useUpdateChannelConnection, useDeleteChannelConnection, useChannelAnalytics } from "@/lib/api/hooks";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL_CHANNELS = [
  { id: "ch1", name: "MakeMyTrip", logo: "MMT", connected: true, roomsMapped: 42, bookings30d: 38, revenue30d: 284000, lastSync: "2 min ago", parity: "OK", commission: 15 },
  { id: "ch2", name: "Booking.com", logo: "BK", connected: true, roomsMapped: 42, bookings30d: 52, revenue30d: 412000, lastSync: "5 min ago", parity: "Parity Issue", commission: 18 },
  { id: "ch3", name: "Expedia", logo: "EX", connected: true, roomsMapped: 36, bookings30d: 24, revenue30d: 198000, lastSync: "12 min ago", parity: "OK", commission: 20 },
  { id: "ch4", name: "Agoda", logo: "AG", connected: false, roomsMapped: 0, bookings30d: 0, revenue30d: 0, lastSync: "Never", parity: "—", commission: 16 },
  { id: "ch5", name: "Airbnb", logo: "AB", connected: true, roomsMapped: 18, bookings30d: 15, revenue30d: 156000, lastSync: "1 hr ago", parity: "OK", commission: 3 },
  { id: "ch6", name: "Direct (Website)", logo: "DW", connected: true, roomsMapped: 42, bookings30d: 28, revenue30d: 298000, lastSync: "Live", parity: "OK", commission: 0 },
];

const RATE_PARITY = [
  { roomType: "Standard Room", direct: 4500, mmt: 4500, booking: 4800, expedia: 4600 },
  { roomType: "Deluxe Room", direct: 6500, mmt: 6500, booking: 7100, expedia: 6800 },
  { roomType: "Suite", direct: 12000, mmt: 12500, booking: 13000, expedia: 12800 },
  { roomType: "Pool View", direct: 8500, mmt: 8500, booking: 8500, expedia: 8700 },
  { roomType: "Family Room", direct: 9000, mmt: 9200, booking: 9500, expedia: 9000 },
];

export const Route = createFileRoute("/channel-manager")({
  head: () => ({ meta: [{ title: "Channel Manager · MHMS" }] }),
  component: ChannelManager,
});

function ChannelManager() {
  const authed = !!useAuth((s) => s.user);
  const connectionsQ = useChannelConnections();
  const analyticsQ = useChannelAnalytics();
  const createConnM = useCreateChannelConnection();
  const updateConnM = useUpdateChannelConnection();
  const deleteConnM = useDeleteChannelConnection();

  const [demoChannels, setDemoChannels] = useState(INITIAL_CHANNELS);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newConn, setNewConn] = useState({ channel_name: "", api_key: "", commission: "" });

  const isLive = authed && !!connectionsQ.data;

  const channels = useMemo(() => {
    if (isLive && connectionsQ.data) {
      return connectionsQ.data.map((c: any) => ({
        id: c.id,
        name: c.channel_name,
        logo: (c.channel_name ?? "").slice(0, 2).toUpperCase(),
        connected: c.is_active ?? true,
        roomsMapped: c.rooms_mapped ?? 0,
        bookings30d: c.bookings_30d ?? 0,
        revenue30d: c.revenue_30d ?? 0,
        lastSync: c.last_sync ? new Date(c.last_sync).toLocaleString() : "Never",
        parity: c.parity_status ?? "OK",
        commission: c.commission_rate ?? 0,
        _live: true,
      }));
    }
    return demoChannels;
  }, [isLive, connectionsQ.data, demoChannels]);

  const connected = channels.filter((c) => c.connected).length;
  const totalBookings = channels.reduce((s, c) => s + c.bookings30d, 0);
  const totalRevenue = channels.reduce((s, c) => s + c.revenue30d, 0);
  const parityIssues = channels.filter((c) => c.parity === "Parity Issue").length;

  const perfChartData = channels
    .filter((c) => c.connected && c.bookings30d > 0)
    .map((c) => ({
      name: c.name === "Direct (Website)" ? "Direct" : c.name,
      bookings: c.bookings30d,
      revenue: Math.round(c.revenue30d / 1000),
    }));

  const toggleChannel = (ch: typeof channels[0]) => {
    if ((ch as any)._live) {
      updateConnM.mutate({ id: ch.id, patch: { connected: !ch.connected } as any }, {
        onSuccess: () => connectionsQ.refetch(),
        onError: () => toast.error("Failed to update channel"),
      });
    } else {
      setDemoChannels((prev) => prev.map((c) => c.id === ch.id ? { ...c, connected: !c.connected } : c));
    }
  };

  const syncChannel = (id: string, name: string) => {
    setSyncing(id);
    if ((channels.find((c) => c.id === id) as any)?._live) {
      updateConnM.mutate({ id, patch: { last_sync_at: new Date().toISOString() } as any }, {
        onSettled: () => { setSyncing(null); connectionsQ.refetch(); toast.success(`${name} synced successfully`); },
      });
    } else {
      setTimeout(() => {
        setDemoChannels((prev) => prev.map((c) => c.id === id ? { ...c, lastSync: "just now" } : c));
        setSyncing(null);
        toast.success(`${name} synced successfully`);
      }, 1500);
    }
  };

  const handleAddConn = () => {
    if (!newConn.channel_name) return;
    createConnM.mutate({
      channel_name: newConn.channel_name,
      api_key: newConn.api_key,
      channel_type: "ota",
      settings: { commission_rate: parseFloat(newConn.commission) || 0 },
      connected: true,
    }, {
      onSuccess: () => { setAddOpen(false); setNewConn({ channel_name: "", api_key: "", commission: "" }); connectionsQ.refetch(); toast.success("Channel connected"); },
      onError: () => toast.error("Failed to add channel"),
    });
  };

  return (
    <>
      <PageHeader
        title="Channel Manager"
        description="Manage OTA connections, rates, and inventory distribution"
        actions={
          <div className="flex gap-2">
            {isLive && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddOpen(true)}>
                <Plus className="size-4" /> Add Channel
              </Button>
            )}
            <Button size="sm" className="gap-1.5" onClick={() => { channels.filter((c) => c.connected).forEach((c) => syncChannel(c.id, c.name)); toast.success("Syncing all channels…"); }}>
              <RefreshCw className="size-4" /> Sync All
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="Active Channels" value={`${connected}/${channels.length}`} tone="info" hint="Connected OTAs" />
        <Stat label="Bookings (30d)" value={totalBookings} hint="All channels combined" />
        <Stat label="OTA Revenue (30d)" value={fmtINR(totalRevenue)} tone="success" hint="Gross before commission" />
        <Stat label="Parity Issues" value={parityIssues} tone={parityIssues > 0 ? "warning" : "success"} hint="Rate discrepancies" />
      </div>

      <Tabs defaultValue="channels">
        <TabsList className="mb-4">
          <TabsTrigger value="channels"><Globe2 className="size-3.5 mr-1.5" />Channels</TabsTrigger>
          <TabsTrigger value="parity">
            <AlertTriangle className="size-3.5 mr-1.5" />Rate Parity
            {parityIssues > 0 && <Badge variant="destructive" className="ml-1.5 text-[10px] size-4 p-0 grid place-items-center">{parityIssues}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="performance"><TrendingUp className="size-3.5 mr-1.5" />Performance</TabsTrigger>
        </TabsList>

        {/* Channels */}
        <TabsContent value="channels">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {channels.map((ch) => (
              <Card key={ch.id} className={`p-4 transition-opacity ${!ch.connected ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 text-primary font-bold text-sm grid place-items-center shrink-0">{ch.logo}</div>
                    <div>
                      <div className="font-semibold text-sm">{ch.name}</div>
                      <div className="text-xs text-muted-foreground">Commission: {ch.commission}%</div>
                    </div>
                  </div>
                  <Switch checked={ch.connected} onCheckedChange={() => toggleChannel(ch)} />
                </div>

                {ch.connected && (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                      <div className="bg-muted/50 rounded p-1.5">
                        <div className="text-[10px] text-muted-foreground">Rooms</div>
                        <div className="font-bold text-sm">{ch.roomsMapped}</div>
                      </div>
                      <div className="bg-muted/50 rounded p-1.5">
                        <div className="text-[10px] text-muted-foreground">Bookings</div>
                        <div className="font-bold text-sm">{ch.bookings30d}</div>
                      </div>
                      <div className="bg-muted/50 rounded p-1.5">
                        <div className="text-[10px] text-muted-foreground">Revenue</div>
                        <div className="font-bold text-sm">{Math.round(ch.revenue30d / 1000)}K</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-3 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="size-3" />Last sync: {ch.lastSync}
                      </div>
                      <Badge className={`text-[10px] gap-1 ${ch.parity === "OK" ? "bg-success/15 text-success border-success/30" : "bg-warning/15 text-warning-foreground border-warning/30"}`}>
                        {ch.parity === "OK" ? <CheckCircle2 className="size-2.5" /> : <AlertTriangle className="size-2.5" />}
                        {ch.parity}
                      </Badge>
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  {ch.connected && (
                    <Button size="sm" variant="outline" className="flex-1 h-7 gap-1" disabled={syncing === ch.id}
                      onClick={() => syncChannel(ch.id, ch.name)}>
                      <RefreshCw className={`size-3.5 ${syncing === ch.id ? "animate-spin" : ""}`} />
                      {syncing === ch.id ? "Syncing…" : "Sync"}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => toast.info(`${ch.name} settings`)}>
                    <Settings className="size-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Rate Parity */}
        <TabsContent value="parity">
          <Card>
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Rate Parity Check</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Tonight's rates. Highlighted = above direct BAR rate.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => toast.success("Rates rechecked")}>
                <RefreshCw className="size-3.5 mr-1" /> Recheck
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Room Type</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Direct (BAR)</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">MakeMyTrip</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Booking.com</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Expedia</th>
                  </tr>
                </thead>
                <tbody>
                  {RATE_PARITY.map((r) => (
                    <tr key={r.roomType} className="border-b last:border-0 hover:bg-accent/5">
                      <td className="px-4 py-3 font-medium">{r.roomType}</td>
                      <td className="px-4 py-3 text-right font-semibold">{fmtINR(r.direct)}</td>
                      {[r.mmt, r.booking, r.expedia].map((rate, idx) => (
                        <td key={idx} className={`px-4 py-3 text-right ${rate > r.direct ? "text-warning-foreground font-semibold" : "text-success"}`}>
                          {fmtINR(rate)}
                          {rate > r.direct && <AlertTriangle className="inline size-3 ml-1 mb-0.5" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Performance */}
        <TabsContent value="performance">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Bookings by Channel (30d)</h3>
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart data={perfChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="bookings" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Bookings" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Revenue by Channel — ₹'000 (30d)</h3>
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart data={perfChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: number) => [`₹${v}K`, "Revenue"]} />
                    <Bar dataKey="revenue" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Revenue (₹K)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-5 lg:col-span-2">
              <h3 className="font-semibold mb-3">Channel Mix — Net Revenue Summary</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {["Channel", "Bookings", "Gross Revenue", "Commission %", "Commission Cost", "Net Revenue"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {channels.filter((c) => c.connected && c.revenue30d > 0).map((c) => {
                      const commCost = Math.round(c.revenue30d * c.commission / 100);
                      const netRevenue = c.revenue30d - commCost;
                      return (
                        <tr key={c.id} className="border-b last:border-0 hover:bg-accent/5">
                          <td className="px-3 py-2 font-medium">{c.name}</td>
                          <td className="px-3 py-2">{c.bookings30d}</td>
                          <td className="px-3 py-2">{fmtINR(c.revenue30d)}</td>
                          <td className="px-3 py-2">{c.commission}%</td>
                          <td className="px-3 py-2 text-destructive">{c.commission > 0 ? `-${fmtINR(commCost)}` : "—"}</td>
                          <td className="px-3 py-2 font-semibold text-success">{fmtINR(netRevenue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Channel Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Connect Channel</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Channel Name</Label>
              <Input className="mt-1" placeholder="e.g. MakeMyTrip, Booking.com" value={newConn.channel_name} onChange={(e) => setNewConn((p) => ({ ...p, channel_name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">API Key / Credentials</Label>
              <Input className="mt-1" placeholder="API key or auth token" value={newConn.api_key} onChange={(e) => setNewConn((p) => ({ ...p, api_key: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Commission %</Label>
              <Input className="mt-1" type="number" placeholder="e.g. 15" value={newConn.commission} onChange={(e) => setNewConn((p) => ({ ...p, commission: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={createConnM.isPending} onClick={handleAddConn}>
              {createConnM.isPending && <Loader2 className="size-3.5 mr-1.5 animate-spin" />} Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
