import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { useAuth } from "@/lib/api/auth";
import { useGuests, useLoyaltyTiers, useCreateLoyaltyTier, useLoyaltyMembers } from "@/lib/api/hooks";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { Star, Search, Plus, Send, Users, Gift, TrendingUp, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const CAMPAIGNS = [
  { id: "c1", name: "Monsoon Special", audience: "Gold + Platinum", sent: 248, opens: 154, clicks: 62, revenue: 184000, status: "Completed" },
  { id: "c2", name: "Anniversary Returns", audience: "All Platinum", sent: 89, opens: 69, clicks: 38, revenue: 312000, status: "Completed" },
  { id: "c3", name: "Corporate Q3 Offer", audience: "Corporate accounts", sent: 56, opens: 30, clicks: 18, revenue: 96000, status: "Completed" },
  { id: "c4", name: "Diwali Staycation", audience: "All guests", sent: 0, opens: 0, clicks: 0, revenue: 0, status: "Draft" },
];

const LOYALTY_TIERS = [
  { tier: "Platinum", color: "bg-info/15 text-info border-info/30", icon: "💎", perks: "25% off F&B, Complimentary upgrade, Late check-out" },
  { tier: "Gold", color: "bg-warning/20 text-warning-foreground border-warning/40", icon: "🥇", perks: "15% off F&B, Priority check-in, Welcome drink" },
  { tier: "Silver", color: "bg-muted text-muted-foreground", icon: "🥈", perks: "5% off spa, Early check-in (subject to availability)" },
  { tier: "Standard", color: "bg-muted/50 text-muted-foreground border-muted", icon: "⚪", perks: "1 loyalty point per ₹100 spent" },
];

const PIE_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

interface GuestRow {
  id: string; name: string; email: string; phone: string; tier: string;
  points: number; stays: number; ltv: number | null; vip: boolean; nationality?: string;
}

export const Route = createFileRoute("/crm")({
  head: () => ({ meta: [{ title: "CRM & Loyalty · MHMS" }] }),
  component: CRM,
});

function CRM() {
  const authed = !!useAuth((s) => s.user);
  const liveGuests = useGuests();
  const liveTiersQ = useLoyaltyTiers();
  const createTierM = useCreateLoyaltyTier();
  const loyaltyMembersQ = useLoyaltyMembers();
  const isLive = authed && !!liveGuests.data;
  const { guests, reservations } = useMHMS();
  const [q, setQ] = useState("");
  const [tierFilter, setTierFilter] = useState("All");
  const [selectedGuest, setSelectedGuest] = useState<GuestRow | null>(null);
  const [newCampaignOpen, setNewCampaignOpen] = useState(false);
  const [newTierOpen, setNewTierOpen] = useState(false);
  const [newTier, setNewTier] = useState({ name: "", min_points: "0", multiplier: "1", benefits: "" });

  const rows: GuestRow[] = useMemo(() => {
    if (isLive) {
      return (liveGuests.data ?? []).map((g) => ({
        id: g.id, name: g.full_name, email: g.email ?? "—", phone: g.phone ?? "—",
        tier: g.vip_status && g.vip_status !== "none" ? g.vip_status : "Standard",
        points: g.loyalty_points ?? 0, stays: g.total_stays ?? 0, ltv: null,
        vip: !!g.vip_status && g.vip_status !== "none",
      }));
    }
    return guests.map((g) => ({
      id: g.id, name: g.name, email: g.email, phone: g.phone,
      tier: g.loyaltyTier ?? "Standard", points: g.loyaltyPoints ?? 0, stays: g.totalStays ?? 0,
      ltv: reservations.filter((r) => r.guestId === g.id).reduce((s, r) => s + r.rate, 0),
      vip: !!g.vip, nationality: g.nationality,
    }));
  }, [isLive, liveGuests.data, guests, reservations]);

  const filtered = rows
    .filter((g) => {
      const matchSearch = g.name.toLowerCase().includes(q.toLowerCase()) || g.email.toLowerCase().includes(q.toLowerCase());
      const matchTier = tierFilter === "All" || g.tier === tierFilter;
      return matchSearch && matchTier;
    })
    .sort((a, b) => b.points - a.points);

  // In live mode build tier list from API, else from static LOYALTY_TIERS
  const tierNames = isLive && liveTiersQ.data?.length
    ? liveTiersQ.data.map((t) => t.name)
    : LOYALTY_TIERS.map((t) => t.tier);
  const tierCounts = tierNames.map((name) => ({ name, value: rows.filter((g) => g.tier === name).length }));
  const topGuests = [...rows].sort((a, b) => b.points - a.points).slice(0, 5);
  const totalLTV = rows.reduce((s, g) => s + (g.ltv ?? 0), 0);
  const avgStays = rows.length ? (rows.reduce((s, g) => s + g.stays, 0) / rows.length).toFixed(1) : "0";

  const stayData = [
    { stays: "1", count: rows.filter((g) => g.stays === 1).length },
    { stays: "2-3", count: rows.filter((g) => g.stays >= 2 && g.stays <= 3).length },
    { stays: "4-6", count: rows.filter((g) => g.stays >= 4 && g.stays <= 6).length },
    { stays: "7+", count: rows.filter((g) => g.stays >= 7).length },
  ];

  const initials = (name: string) => name.split(" ").map((s) => s[0]?.toUpperCase() ?? "").join("").slice(0, 2);

  const tierMeta = (tier: string) => LOYALTY_TIERS.find((t) => t.tier === tier) ?? LOYALTY_TIERS[3];

  return (
    <>
      <PageHeader
        title="CRM & Loyalty"
        description="Guest database, loyalty program, and marketing campaigns"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={isLive ? "default" : "outline"} className="self-center">
              {isLive ? "Live data" : "Demo data"}
            </Badge>
            <Button size="sm" className="gap-1.5" onClick={() => setNewCampaignOpen(true)}>
              <Plus className="size-4" />New Campaign
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="Total Guests" value={rows.length} hint="In database" />
        <Stat label="Platinum / Gold" value={`${rows.filter((g) => g.tier === "Platinum").length} / ${rows.filter((g) => g.tier === "Gold").length}`} tone="success" hint="High-value tiers" />
        <Stat label="Avg Stays" value={avgStays} tone="info" hint="Per guest" />
        <Stat label="Portfolio LTV" value={fmtINR(totalLTV)} tone="success" hint="Total lifetime value" />
      </div>

      <Tabs defaultValue="guests">
        <TabsList className="mb-4">
          <TabsTrigger value="guests"><Users className="size-3.5 mr-1.5" />Guest Database</TabsTrigger>
          <TabsTrigger value="loyalty"><Gift className="size-3.5 mr-1.5" />Loyalty Program</TabsTrigger>
          <TabsTrigger value="campaigns"><Send className="size-3.5 mr-1.5" />Campaigns</TabsTrigger>
          <TabsTrigger value="analytics"><TrendingUp className="size-3.5 mr-1.5" />Analytics</TabsTrigger>
        </TabsList>

        {/* Guest Database */}
        <TabsContent value="guests">
          <div className="flex gap-2 mb-3 flex-wrap">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8 h-8 w-56 text-sm" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {["All", "Platinum", "Gold", "Silver", "Standard"].map((t) => (
                <button key={t} onClick={() => setTierFilter(t)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${tierFilter === t ? "bg-secondary text-secondary-foreground border-secondary" : "hover:border-muted-foreground/40"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Guest", "Contact", "Tier", "Points", "Stays", "Lifetime Value", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((g) => {
                    const tm = tierMeta(g.tier);
                    return (
                      <tr key={g.id} className="border-b last:border-0 hover:bg-accent/5">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="size-8">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials(g.name)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium flex items-center gap-1">
                                {g.name}
                                {g.vip && <Star className="size-3.5 text-yellow-500 fill-yellow-500" />}
                              </div>
                              {g.nationality && <div className="text-[10px] text-muted-foreground">{g.nationality}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div>{g.email}</div>
                          <div className="text-muted-foreground">{g.phone}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`text-[10px] border ${tm.color}`}>{tm.icon} {g.tier}</Badge>
                        </td>
                        <td className="px-4 py-3 font-medium">{g.points.toLocaleString()}</td>
                        <td className="px-4 py-3">{g.stays}</td>
                        <td className="px-4 py-3">{g.ltv === null ? "—" : fmtINR(g.ltv)}</td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setSelectedGuest(g)}>View</Button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No guests found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Loyalty Program */}
        <TabsContent value="loyalty">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">
              {isLive ? "Live Loyalty Tiers" : "Loyalty Tiers"}
              {isLive && liveTiersQ.isLoading && <Loader2 className="size-3.5 animate-spin inline ml-2" />}
            </h3>
            {isLive && (
              <Button size="sm" variant="outline" onClick={() => setNewTierOpen(true)}>
                <Plus className="size-3.5 mr-1" />Add Tier
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {isLive && liveTiersQ.data && liveTiersQ.data.length > 0
              ? liveTiersQ.data.map((t, i) => {
                  const memberCount = loyaltyMembersQ.data?.filter((m) => m.tier_id === t.id).length ?? 0;
                  const TIER_COLORS = [
                    "bg-info/15 text-info border-info/30",
                    "bg-warning/20 text-warning-foreground border-warning/40",
                    "bg-muted text-muted-foreground",
                    "bg-muted/50 text-muted-foreground border-muted",
                  ];
                  const TIER_ICONS = ["💎", "🥇", "🥈", "⚪"];
                  const color = TIER_COLORS[i % TIER_COLORS.length];
                  const icon = TIER_ICONS[i % TIER_ICONS.length];
                  return (
                    <Card key={t.id} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{icon}</span>
                          <div>
                            <div className="font-semibold">{t.name}</div>
                            <div className="text-xs text-muted-foreground">
                              From {t.min_points.toLocaleString()} pts · {t.multiplier}× earn rate
                            </div>
                          </div>
                        </div>
                        <Badge className={`${color} text-[10px]`}>{memberCount} members</Badge>
                      </div>
                      {t.benefits && Object.keys(t.benefits).length > 0 && (
                        <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                          {Object.entries(t.benefits).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                        </div>
                      )}
                    </Card>
                  );
                })
              : LOYALTY_TIERS.map((t) => {
                  const count = rows.filter((g) => g.tier === t.tier).length;
                  return (
                    <Card key={t.tier} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{t.icon}</span>
                          <div>
                            <div className="font-semibold">{t.tier}</div>
                            <div className="text-xs text-muted-foreground">{count} guests</div>
                          </div>
                        </div>
                        <Badge className={`${t.color} text-[10px]`}>{count} members</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">{t.perks}</div>
                    </Card>
                  );
                })
            }
          </div>

          {/* Loyalty members leaderboard */}
          <Card className="p-5">
            <h3 className="font-semibold mb-3">
              {isLive && loyaltyMembersQ.data ? "Loyalty Members" : "Top Guests by Points"}
            </h3>
            <div className="space-y-2">
              {(isLive && loyaltyMembersQ.data
                ? [...loyaltyMembersQ.data].sort((a, b) => b.points - a.points).slice(0, 10).map((m, i) => {
                    const tm = tierMeta(m.tier_name ?? "Standard");
                    return (
                      <div key={m.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/30">
                        <div className="text-muted-foreground font-medium w-5 text-sm">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{m.guest_name ?? m.guest_id.slice(0, 8)}</div>
                          <div className="text-[10px] text-muted-foreground">{m.guest_email ?? ""}</div>
                        </div>
                        <Badge className={`text-[10px] border ${tm.color}`}>{tm.icon} {m.tier_name ?? "—"}</Badge>
                        <div className="font-semibold text-sm">{m.points.toLocaleString()} pts</div>
                      </div>
                    );
                  })
                : topGuests.map((g, i) => {
                    const tm = tierMeta(g.tier);
                    return (
                      <div key={g.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/30">
                        <div className="text-muted-foreground font-medium w-5 text-sm">{i + 1}</div>
                        <Avatar className="size-7"><AvatarFallback className="text-xs">{initials(g.name)}</AvatarFallback></Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm flex items-center gap-1">
                            {g.name}{g.vip && <Star className="size-3 text-yellow-500 fill-yellow-500" />}
                          </div>
                        </div>
                        <Badge className={`text-[10px] border ${tm.color}`}>{tm.icon} {g.tier}</Badge>
                        <div className="font-semibold text-sm">{g.points.toLocaleString()} pts</div>
                      </div>
                    );
                  })
              )}
              {isLive && loyaltyMembersQ.data?.length === 0 && (
                <p className="text-center py-6 text-muted-foreground text-sm">No loyalty members enrolled yet.</p>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Campaigns */}
        <TabsContent value="campaigns">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {CAMPAIGNS.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-sm">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.audience}</div>
                  </div>
                  <Badge className={`text-[10px] ${c.status === "Completed" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                    {c.status}
                  </Badge>
                </div>
                {c.status === "Completed" && (
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="bg-muted/50 rounded p-1.5">
                      <div className="text-[10px] text-muted-foreground">Sent</div>
                      <div className="font-bold text-sm">{c.sent}</div>
                    </div>
                    <div className="bg-muted/50 rounded p-1.5">
                      <div className="text-[10px] text-muted-foreground">Open rate</div>
                      <div className="font-bold text-sm">{c.sent ? Math.round(c.opens / c.sent * 100) : 0}%</div>
                    </div>
                    <div className="bg-muted/50 rounded p-1.5">
                      <div className="text-[10px] text-muted-foreground">Revenue</div>
                      <div className="font-bold text-sm">{Math.round(c.revenue / 1000)}K</div>
                    </div>
                  </div>
                )}
                <div className="flex gap-1.5">
                  {c.status === "Draft" ? (
                    <Button size="sm" className="flex-1 h-7 gap-1" onClick={() => toast.success(`Campaign "${c.name}" launched`)}><Send className="size-3" />Launch</Button>
                  ) : (
                    <Button size="sm" variant="outline" className="flex-1 h-7" onClick={() => toast.info("Duplicating campaign")}>Duplicate</Button>
                  )}
                </div>
              </Card>
            ))}
            <Card className="p-4 border-dashed cursor-pointer hover:border-primary/50 transition-colors flex flex-col items-center justify-center min-h-[140px] text-muted-foreground" onClick={() => setNewCampaignOpen(true)}>
              <Plus className="size-8 mb-1 opacity-40" />
              <span className="text-sm">New Campaign</span>
            </Card>
          </div>
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Guests by Loyalty Tier</h3>
              <div className="h-52">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={tierCounts.filter((t) => t.value > 0)} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}>
                      {tierCounts.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Legend iconType="circle" iconSize={8} />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Stay Frequency Distribution</h3>
              <div className="h-52">
                <ResponsiveContainer>
                  <BarChart data={stayData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="stays" fontSize={11} label={{ value: "Stays", position: "insideBottom", offset: -2, fontSize: 11 }} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Guests" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Guest Detail Dialog */}
      {selectedGuest && (
        <Dialog open={!!selectedGuest} onOpenChange={() => setSelectedGuest(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Guest Profile</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="size-12">
                  <AvatarFallback className="text-base bg-primary/10 text-primary">{initials(selectedGuest.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-lg flex items-center gap-1">
                    {selectedGuest.name}{selectedGuest.vip && <Star className="size-4 text-yellow-500 fill-yellow-500" />}
                  </div>
                  <Badge className={`text-[10px] border ${tierMeta(selectedGuest.tier).color}`}>
                    {tierMeta(selectedGuest.tier).icon} {selectedGuest.tier}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Email", selectedGuest.email], ["Phone", selectedGuest.phone],
                  ["Total Stays", selectedGuest.stays], ["Loyalty Points", selectedGuest.points.toLocaleString()],
                  ["Nationality", selectedGuest.nationality ?? "—"], ["Lifetime Value", selectedGuest.ltv !== null ? fmtINR(selectedGuest.ltv) : "—"],
                ].map(([label, val]) => (
                  <div key={label as string}>
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="font-medium mt-0.5">{val}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { toast.success(`Email sent to ${selectedGuest.name}`); setSelectedGuest(null); }}>Send Email</Button>
                <Button size="sm" className="flex-1" onClick={() => { toast.success(`${selectedGuest.name} added to next campaign`); setSelectedGuest(null); }}>Add to Campaign</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Loyalty Tier Dialog */}
      <Dialog open={newTierOpen} onOpenChange={setNewTierOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Loyalty Tier</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Tier Name</Label><Input className="h-8 mt-1" placeholder="e.g. Platinum" value={newTier.name} onChange={(e) => setNewTier({ ...newTier, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Min Points</Label><Input type="number" className="h-8 mt-1" value={newTier.min_points} onChange={(e) => setNewTier({ ...newTier, min_points: e.target.value })} /></div>
              <div><Label className="text-xs">Earn Multiplier</Label><Input type="number" step="0.1" className="h-8 mt-1" value={newTier.multiplier} onChange={(e) => setNewTier({ ...newTier, multiplier: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Benefits (comma-separated)</Label><Input className="h-8 mt-1" placeholder="Late check-out, Room upgrade" value={newTier.benefits} onChange={(e) => setNewTier({ ...newTier, benefits: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setNewTierOpen(false)}>Cancel</Button>
            <Button
              className="flex-1"
              disabled={!newTier.name || createTierM.isPending}
              onClick={() => {
                const benefitsObj = newTier.benefits
                  ? Object.fromEntries(newTier.benefits.split(",").map((b, i) => [`benefit_${i + 1}`, b.trim()]))
                  : {};
                createTierM.mutate(
                  { name: newTier.name, min_points: Number(newTier.min_points), multiplier: Number(newTier.multiplier), benefits: benefitsObj },
                  {
                    onSuccess: () => { toast.success("Tier created"); setNewTierOpen(false); setNewTier({ name: "", min_points: "0", multiplier: "1", benefits: "" }); },
                    onError: (e: any) => toast.error(e.message ?? "Failed to create tier"),
                  }
                );
              }}
            >
              {createTierM.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Campaign Dialog */}
      <Dialog open={newCampaignOpen} onOpenChange={setNewCampaignOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Campaign</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Campaign Name</Label><Input className="h-8 mt-1" placeholder="e.g. Festive Season Offer" /></div>
            <div>
              <Label className="text-xs">Target Audience</Label>
              <Select defaultValue="All guests">
                <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["All guests", "Platinum only", "Gold + Platinum", "Standard only", "VIP guests", "Corporate accounts"].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Subject Line</Label><Input className="h-8 mt-1" placeholder="e.g. Exclusive offer for valued guests" /></div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setNewCampaignOpen(false)}>Save Draft</Button>
              <Button className="flex-1" onClick={() => { toast.success("Campaign created"); setNewCampaignOpen(false); }}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
