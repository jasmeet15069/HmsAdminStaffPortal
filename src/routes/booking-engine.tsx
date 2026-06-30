import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { Calendar, TrendingUp, Globe2, Plus, Tag, CheckCircle2, Edit2, Trash2, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/api/auth";
import { usePromotions, useCreatePromotion, useUpdatePromotion, useDeletePromotion, useBookingAvailability } from "@/lib/api/hooks";
import type { Promotion } from "@/lib/api/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const INITIAL_RATE_PLANS = [
  { id: "rp1", name: "Best Available Rate", code: "BAR", type: "Public", discount: 0, active: true, bookings: 62 },
  { id: "rp2", name: "Non-Refundable Advance", code: "NRF", type: "Public", discount: 15, active: true, bookings: 38 },
  { id: "rp3", name: "Corporate Rate", code: "CORP", type: "Private", discount: 20, active: true, bookings: 25 },
  { id: "rp4", name: "Weekend Getaway", code: "WKND", type: "Public", discount: 10, active: true, bookings: 18 },
  { id: "rp5", name: "Long Stay (7+ nights)", code: "LST7", type: "Public", discount: 25, active: false, bookings: 8 },
];

const INITIAL_PROMO_CODES = [
  { id: "pc1", code: "SUMMER25", discount: 25, type: "Percentage", uses: 42, limit: 100, expiry: "2026-08-31", active: true },
  { id: "pc2", code: "WELCOME10", discount: 10, type: "Percentage", uses: 128, limit: 500, expiry: "2026-12-31", active: true },
  { id: "pc3", code: "FLAT500", discount: 500, type: "Flat (₹)", uses: 67, limit: 200, expiry: "2026-07-15", active: true },
  { id: "pc4", code: "CORP2026", discount: 20, type: "Percentage", uses: 34, limit: 50, expiry: "2026-12-31", active: false },
];

const FUNNEL_DATA = [
  { stage: "Widget Visits", value: 4820 },
  { stage: "Searched", value: 3240 },
  { stage: "Room Selected", value: 1480 },
  { stage: "Guest Details", value: 820 },
  { stage: "Payment Page", value: 520 },
  { stage: "Confirmed", value: 380 },
];

const TREND_DATA = [
  { month: "Jan", bookings: 28 }, { month: "Feb", bookings: 32 }, { month: "Mar", bookings: 38 },
  { month: "Apr", bookings: 35 }, { month: "May", bookings: 42 }, { month: "Jun", bookings: 48 },
];

const SOURCE_DATA = [
  { name: "Direct Website", value: 380 },
  { name: "Mobile App", value: 142 },
  { name: "Phone", value: 68 },
  { name: "Walk-in", value: 44 },
];
const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

export const Route = createFileRoute("/booking-engine")({
  head: () => ({ meta: [{ title: "Booking Engine · MHMS" }] }),
  component: BookingEngine,
});

function BookingEngine() {
  const authed = !!useAuth((s) => s.user);
  const { rooms } = useMHMS();
  const promotionsQ = usePromotions();
  const createPromoM = useCreatePromotion();
  const updatePromoM = useUpdatePromotion();
  const deletePromoM = useDeletePromotion();

  const [widgetColor, setWidgetColor] = useState("#1a56db");
  const [promoEnabled, setPromoEnabled] = useState(true);
  const [showBestRate, setShowBestRate] = useState(true);
  const [ratePlans, setRatePlans] = useState(INITIAL_RATE_PLANS);
  const [promoCodes, setPromoCodes] = useState(INITIAL_PROMO_CODES);
  const [searchDate, setSearchDate] = useState({ in: new Date().toISOString().slice(0, 10), out: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10) });
  const [newPromoOpen, setNewPromoOpen] = useState(false);
  const [newPromo, setNewPromo] = useState({ code: "", discount_type: "percentage", discount_value: "", max_uses: "", valid_until: "" });

  const isLive = authed && !!promotionsQ.data;

  const displayPromoCodes = useMemo(() => {
    if (isLive && promotionsQ.data) {
      return promotionsQ.data.map((p: any) => ({
        id: p.id,
        code: p.code,
        discount: p.discount_value ?? p.discount,
        type: p.discount_type === "flat" ? "Flat (₹)" : "Percentage",
        uses: p.usage_count ?? 0,
        limit: p.max_uses ?? 999,
        expiry: p.valid_until ? p.valid_until.slice(0, 10) : "—",
        active: p.is_active ?? true,
        _live: true,
      }));
    }
    return promoCodes;
  }, [isLive, promotionsQ.data, promoCodes]);

  const handleCreatePromo = () => {
    if (!newPromo.code) return;
    createPromoM.mutate({
      code: newPromo.code,
      discount_type: newPromo.discount_type,
      discount_value: parseFloat(newPromo.discount_value) || 0,
      usage_limit: parseInt(newPromo.max_uses) || 0,
      valid_to: newPromo.valid_until || new Date(Date.now() + 365 * 86400000).toISOString(),
      valid_from: new Date().toISOString(),
      active: true,
      name: newPromo.code,
      description: null,
      min_nights: 0,
      min_amount: 0,
      max_discount: null,
    } as Omit<Promotion, "id" | "hotel_id" | "used_count" | "created_at">, {
      onSuccess: () => { setNewPromoOpen(false); setNewPromo({ code: "", discount_type: "percentage", discount_value: "", max_uses: "", valid_until: "" }); toast.success("Promo code created"); },
      onError: () => toast.error("Failed to create promo"),
    });
  };

  const togglePromo = (p: typeof displayPromoCodes[0]) => {
    if ((p as any)._live) {
      updatePromoM.mutate({ id: p.id, patch: { active: !p.active } }, { onError: () => toast.error("Failed to update") });
    } else {
      setPromoCodes(promoCodes.map((c) => c.id === p.id ? { ...c, active: !c.active } : c));
    }
  };

  const deletePromo = (p: typeof displayPromoCodes[0]) => {
    if ((p as any)._live) {
      deletePromoM.mutate(p.id, { onError: () => toast.error("Failed to delete") });
    } else {
      setPromoCodes(promoCodes.filter((c) => c.id !== p.id));
    }
  };

  const activeRooms = rooms.filter((r) => r.status !== "maintenance");
  const convRate = ((FUNNEL_DATA[5].value / FUNNEL_DATA[0].value) * 100).toFixed(1);
  const roomTypes = Array.from(new Set(activeRooms.map((r) => r.type))).map((t) => {
    const sample = activeRooms.find((r) => r.type === t)!;
    const available = activeRooms.filter((r) => r.type === t && r.status !== "occupied").length;
    return { type: t, rate: sample.rate, capacity: sample.capacity, available };
  });

  return (
    <>
      <PageHeader title="Booking Engine" description="Direct booking widget, rate plans, promo codes and analytics" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="Direct Bookings MTD" value={380} tone="success" hint="This month" />
        <Stat label="Conversion Rate" value={`${convRate}%`} tone="info" hint="Widget visits → confirmed" />
        <Stat label="Widget Visits (MTD)" value="4,820" hint="Unique sessions" />
        <Stat label="Avg Booking Value" value={fmtINR(8240)} hint="Direct channel" />
      </div>

      <Tabs defaultValue="preview">
        <TabsList className="mb-4">
          <TabsTrigger value="preview"><Globe2 className="size-3.5 mr-1.5" />Live Widget</TabsTrigger>
          <TabsTrigger value="rateplans"><Tag className="size-3.5 mr-1.5" />Rate Plans</TabsTrigger>
          <TabsTrigger value="promo">Promo Codes</TabsTrigger>
          <TabsTrigger value="analytics"><TrendingUp className="size-3.5 mr-1.5" />Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Widget Preview */}
        <TabsContent value="preview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Booking Widget Preview</h3>
                <Badge variant="default" className="text-xs gap-1"><CheckCircle2 className="size-3" />Live</Badge>
              </div>
              <div className="border rounded-xl p-5 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900">
                <h2 className="text-xl font-bold mb-1">Book Your Stay</h2>
                {showBestRate && <p className="text-sm text-muted-foreground mb-4">Best rates guaranteed when you book direct</p>}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div>
                    <Label className="text-xs">Check-in</Label>
                    <Input type="date" className="mt-1 h-9" value={searchDate.in} onChange={(e) => setSearchDate({ ...searchDate, in: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Check-out</Label>
                    <Input type="date" className="mt-1 h-9" value={searchDate.out} onChange={(e) => setSearchDate({ ...searchDate, out: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Guests</Label>
                    <Select defaultValue="2">
                      <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>{n} Guest{n > 1 ? "s" : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {promoEnabled && (
                    <div>
                      <Label className="text-xs">Promo Code</Label>
                      <Input className="mt-1 h-9" placeholder="Optional" />
                    </div>
                  )}
                </div>
                <Button className="w-full" style={{ background: widgetColor }}>
                  <Calendar className="size-4 mr-2" /> Search Availability
                </Button>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                  {roomTypes.map((rt) => (
                    <div key={rt.type} className="border rounded-lg p-3 hover:border-primary/50 transition-colors cursor-pointer">
                      <div className="font-medium text-sm">{rt.type}</div>
                      <div className="text-xs text-muted-foreground">{rt.available} available · Up to {rt.capacity} guests</div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-semibold" style={{ color: widgetColor }}>
                          {fmtINR(rt.rate)} <span className="text-muted-foreground font-normal text-xs">/ night</span>
                        </span>
                        <Button size="sm" className="h-7 text-xs" style={{ background: widgetColor }} onClick={() => toast.success(`${rt.type} added to cart`)}>Book Now</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            <Card className="p-5 space-y-4">
              <h3 className="font-semibold">Today's Snapshot</h3>
              <div className="space-y-2 text-sm">
                {[["Direct bookings today", "8", ""], ["Pending payment", "3", "text-warning-foreground"], ["Abandoned checkouts", "12", "text-destructive"]].map(([label, val, cls]) => (
                  <div key={label as string} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={`font-medium ${cls}`}>{val}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">Active Rate Plans</div>
                {ratePlans.filter((p) => p.active).map((p) => (
                  <div key={p.id} className="flex justify-between text-xs py-1">
                    <span className="font-mono">{p.code}</span>
                    <span className="text-muted-foreground">{p.discount > 0 ? `-${p.discount}%` : "Base rate"}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Rate Plans */}
        <TabsContent value="rateplans">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">{ratePlans.filter((p) => p.active).length} active rate plans</p>
            <Button size="sm" className="gap-1.5" onClick={() => toast.success("Rate plan created")}>
              <Plus className="size-4" /> New Rate Plan
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {ratePlans.map((plan) => (
              <Card key={plan.id} className={`p-4 transition-opacity ${!plan.active ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-sm">{plan.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[10px] font-mono">{plan.code}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{plan.type}</Badge>
                    </div>
                  </div>
                  <Switch checked={plan.active} onCheckedChange={(v) => setRatePlans(ratePlans.map((p) => p.id === plan.id ? { ...p, active: v } : p))} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-center mb-3">
                  <div className="bg-muted/50 rounded p-2">
                    <div className="text-[10px] text-muted-foreground">Discount</div>
                    <div className="font-bold text-sm">{plan.discount > 0 ? `-${plan.discount}%` : "Base"}</div>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <div className="text-[10px] text-muted-foreground">Bookings</div>
                    <div className="font-bold text-sm">{plan.bookings}</div>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="flex-1 h-7 gap-1" onClick={() => toast.info(`Editing ${plan.code}`)}>
                    <Edit2 className="size-3" />Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => toast.success("Rate plan removed")}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Promo Codes */}
        <TabsContent value="promo">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">{displayPromoCodes.filter((p) => p.active).length} active promo codes{isLive ? " · Live" : " · Demo"}</p>
            <Button size="sm" className="gap-1.5" onClick={() => isLive ? setNewPromoOpen(true) : toast.success("Promo code created")}>
              <Plus className="size-4" /> New Code
            </Button>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Code", "Discount", "Uses / Limit", "Expiry", "Active", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayPromoCodes.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-accent/5">
                      <td className="px-4 py-3 font-mono font-semibold text-sm">{p.code}</td>
                      <td className="px-4 py-3 font-medium text-success">
                        {p.type === "Percentage" ? `-${p.discount}%` : `-₹${p.discount}`}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs mb-1">{p.uses} / {p.limit}</div>
                        <div className="w-20 h-1 bg-muted rounded">
                          <div className="h-1 bg-primary rounded" style={{ width: `${Math.min(100, (p.uses / p.limit) * 100)}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{p.expiry}</td>
                      <td className="px-4 py-3">
                        <Switch checked={p.active} onCheckedChange={() => togglePromo(p)} />
                      </td>
                      <td className="px-4 py-3 flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { navigator.clipboard?.writeText(p.code); toast.success(`Code ${p.code} copied`); }}>Copy</Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => deletePromo(p)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-1">Booking Funnel</h3>
              <p className="text-xs text-muted-foreground mb-4">This month · {convRate}% overall conversion</p>
              <div className="space-y-2">
                {FUNNEL_DATA.map((stage, i) => {
                  const pct = (stage.value / FUNNEL_DATA[0].value) * 100;
                  return (
                    <div key={stage.stage}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{stage.stage}</span>
                        <span className="font-medium">{stage.value.toLocaleString()}</span>
                      </div>
                      <div className="h-5 rounded-md bg-muted overflow-hidden">
                        <div className="h-5 rounded-md bg-primary/80 transition-all" style={{ width: `${pct}%`, opacity: 1 - i * 0.08 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Booking Source Mix</h3>
              <div className="h-52">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={SOURCE_DATA} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                      {SOURCE_DATA.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Legend iconType="circle" iconSize={8} />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-5 lg:col-span-2">
              <h3 className="font-semibold mb-4">Monthly Direct Bookings Trend</h3>
              <div className="h-48">
                <ResponsiveContainer>
                  <LineChart data={TREND_DATA}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Line type="monotone" dataKey="bookings" stroke="hsl(var(--chart-1))" strokeWidth={2} name="Bookings" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5 space-y-4">
              <h3 className="font-semibold">Appearance</h3>
              <div>
                <Label className="text-xs">Brand Color</Label>
                <div className="flex gap-2 mt-1 items-center">
                  <Input type="color" className="w-12 h-8 p-1 cursor-pointer" value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} />
                  <Input className="h-8 font-mono text-sm flex-1" value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Widget Title</Label>
                <Input className="h-8 mt-1" defaultValue="Book Your Stay" />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Show promo code field</Label>
                <Switch checked={promoEnabled} onCheckedChange={setPromoEnabled} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Show "Best Rate" tagline</Label>
                <Switch checked={showBestRate} onCheckedChange={setShowBestRate} />
              </div>
            </Card>
            <Card className="p-5 space-y-4">
              <h3 className="font-semibold">Booking Policies</h3>
              {[["Min advance booking (days)", "0"], ["Max advance booking (days)", "365"], ["Minimum stay (nights)", "1"], ["Maximum stay (nights)", "30"], ["Check-in time", "14:00"], ["Check-out time", "12:00"]].map(([label, def]) => (
                <div key={label}>
                  <Label className="text-xs">{label}</Label>
                  <Input className="h-8 mt-1" defaultValue={def} />
                </div>
              ))}
              <Button className="w-full" onClick={() => toast.success("Settings saved")}>Save Settings</Button>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* New Promo Dialog */}
      <Dialog open={newPromoOpen} onOpenChange={setNewPromoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Promo Code</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Code</Label>
              <Input className="mt-1 font-mono uppercase" placeholder="SUMMER25" value={newPromo.code} onChange={(e) => setNewPromo((p) => ({ ...p, code: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <Label className="text-xs">Discount Type</Label>
              <Select value={newPromo.discount_type} onValueChange={(v) => setNewPromo((p) => ({ ...p, discount_type: v }))}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage %</SelectItem>
                  <SelectItem value="flat">Flat Amount ₹</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Discount Value</Label>
              <Input className="mt-1" type="number" placeholder={newPromo.discount_type === "percentage" ? "e.g. 25" : "e.g. 500"} value={newPromo.discount_value} onChange={(e) => setNewPromo((p) => ({ ...p, discount_value: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Max Uses</Label>
                <Input className="mt-1" type="number" placeholder="Unlimited" value={newPromo.max_uses} onChange={(e) => setNewPromo((p) => ({ ...p, max_uses: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Valid Until</Label>
                <Input className="mt-1" type="date" value={newPromo.valid_until} onChange={(e) => setNewPromo((p) => ({ ...p, valid_until: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNewPromoOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={createPromoM.isPending || !newPromo.code} onClick={handleCreatePromo}>
              {createPromoM.isPending && <Loader2 className="size-3.5 mr-1.5 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
