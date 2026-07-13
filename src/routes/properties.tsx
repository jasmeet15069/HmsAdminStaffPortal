import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend } from "recharts";
import { Building2, MapPin, Phone, Mail, Plus, Star, Bed, Coffee, Loader2, Pencil, Trash2, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/lib/api/auth";
import { useProperties, useBranches, useCreateBranch, useUpdateBranch, useDeleteBranch } from "@/lib/api/hooks";
import type { Branch } from "@/lib/api/types";

// The Properties/branches feature is hotel-admin only (matches the backend gate).
const HOTEL_ADMIN_ROLES = ["hotel_admin", "admin", "super_admin"];

const PROPERTY_DETAILS = [
  {
    id: "prop-1",
    amenities: ["Swimming Pool", "Spa & Wellness", "Conference Rooms", "Rooftop Bar", "Gym", "Valet Parking"],
    contact: { gm: "Vikram Malhotra", phone: "+91 22 6789 4321", email: "gm.mumbai@azuregrand.in" },
    rating: 4.7,
    yearOpened: 2014,
    category: "5-Star",
  },
  {
    id: "prop-2",
    amenities: ["Swimming Pool", "Business Centre", "Restaurant", "Bar", "Gym"],
    contact: { gm: "Priya Nair", phone: "+91 11 5678 9012", email: "gm.delhi@azuregrand.in" },
    rating: 4.5,
    yearOpened: 2017,
    category: "5-Star",
  },
  {
    id: "prop-3",
    amenities: ["Rooftop Pool", "Spa", "2 Restaurants", "Bar", "Golf Simulator"],
    contact: { gm: "Arjun Kumar", phone: "+91 80 4321 8765", email: "gm.bangalore@azuregrand.in" },
    rating: 4.8,
    yearOpened: 2019,
    category: "5-Star Luxury",
  },
];

export const Route = createFileRoute("/properties")({
  head: () => ({ meta: [{ title: "Properties · MHMS" }] }),
  component: Properties,
});

function Properties() {
  const user = useAuth((s) => s.user);
  const authed = !!user;
  const isHotelAdmin = !!user?.roles?.some((r) => HOTEL_ADMIN_ROLES.includes(r));
  const propertiesQ = useProperties();
  const branchesQ = useBranches({ enabled: authed && isHotelAdmin });
  const createBranchM = useCreateBranch();
  const updateBranchM = useUpdateBranch();
  const deleteBranchM = useDeleteBranch();
  const { properties: demoProperties, setProperty, rooms } = useMHMS();

  const liveBranches = authed && isHotelAdmin && branchesQ.data ? branchesQ.data : [];
  const branchesLive = authed && isHotelAdmin && !!branchesQ.data;
  const liveCount = branchesLive ? liveBranches.length : null;
  const properties = demoProperties;

  const [selectedProperty, setSelectedProperty] = useState(properties[0]?.id ?? null);
  const [addOpen, setAddOpen] = useState(false);
  const [newBranch, setNewBranch] = useState({ name: "", code: "", address: "", phone: "", email: "", star_rating: "", total_rooms: "" });
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [editForm, setEditForm] = useState({ name: "", code: "", address: "", phone: "", email: "", star_rating: "", total_rooms: "", is_active: true });

  const openEdit = (b: Branch) => {
    setEditBranch(b);
    setEditForm({
      name: b.name ?? "", code: b.code ?? "", address: b.address ?? "", phone: b.phone ?? "",
      email: b.email ?? "", star_rating: b.star_rating != null ? String(b.star_rating) : "",
      total_rooms: b.total_rooms != null ? String(b.total_rooms) : "", is_active: b.is_active,
    });
  };

  const handleUpdateBranch = () => {
    if (!editBranch || !editForm.name.trim()) return;
    updateBranchM.mutate({
      id: editBranch.id,
      patch: {
        name: editForm.name.trim(),
        code: editForm.code.trim(),
        address: editForm.address.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        star_rating: editForm.star_rating ? parseInt(editForm.star_rating) : undefined,
        total_rooms: editForm.total_rooms ? parseInt(editForm.total_rooms) : undefined,
        is_active: editForm.is_active,
      } as Partial<Branch>,
    }, {
      onSuccess: () => { setEditBranch(null); toast.success("Property updated"); },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update"),
    });
  };

  const handleDeleteBranch = (b: Branch) => {
    if (!window.confirm(`Delete property "${b.name}"? Rooms attached to it will be unassigned.`)) return;
    deleteBranchM.mutate(b.id, {
      onSuccess: () => toast.success("Property deleted"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to delete"),
    });
  };

  const handleCreateBranch = () => {
    if (!newBranch.name.trim()) return;
    createBranchM.mutate({
      name: newBranch.name.trim(),
      code: newBranch.code.trim() || undefined,
      address: newBranch.address.trim() || undefined,
      phone: newBranch.phone.trim() || undefined,
      email: newBranch.email.trim() || undefined,
      star_rating: newBranch.star_rating ? parseInt(newBranch.star_rating) : undefined,
      total_rooms: newBranch.total_rooms ? parseInt(newBranch.total_rooms) : undefined,
    } as Partial<import("@/lib/api/types").Branch>, {
      onSuccess: () => { setAddOpen(false); setNewBranch({ name: "", code: "", address: "", phone: "", email: "", star_rating: "", total_rooms: "" }); toast.success("Property added"); },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add property"),
    });
  };

  const selectedP = properties.find((p) => p.id === selectedProperty);
  const selectedDetails = PROPERTY_DETAILS.find((d) => d.id === selectedProperty);
  const propertyRooms = rooms; // in a multi-property setup, rooms would be filtered by property

  const avgOcc = properties.length ? Math.round(properties.reduce((s, p) => s + p.occupancy, 0) / properties.length) : 0;
  const avgAdr = properties.length ? Math.round(properties.reduce((s, p) => s + p.adr, 0) / properties.length) : 0;
  const totalRooms = properties.reduce((s, p) => s + p.rooms, 0);

  const roomTypeBreakdown = Array.from(new Set(propertyRooms.map((r) => r.type))).map((t) => ({
    type: t,
    total: propertyRooms.filter((r) => r.type === t).length,
    occupied: propertyRooms.filter((r) => r.type === t && r.status === "occupied").length,
    rate: propertyRooms.find((r) => r.type === t)?.rate ?? 0,
  }));

  const portfolioMetrics = properties.map((p) => ({
    property: p.name.split(" ").slice(-1)[0],
    occupancy: p.occupancy,
    adr: Math.round(p.adr / 1000),
  }));

  const radarData = properties.map((p) => ({
    property: p.name.split(" ").slice(-1)[0],
    Occupancy: p.occupancy,
    ADR: Math.round(p.adr / 100),
    RevPAR: Math.round((p.adr * p.occupancy / 100) / 100),
  }));

  return (
    <>
      <PageHeader
        title="Multi-Property Management"
        description="Portfolio overview and individual property management"
        actions={
          isHotelAdmin ? (
            <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" /> Add Property
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="Properties" value={liveCount ?? properties.length} hint={liveCount !== null ? "Live · in portfolio" : "Demo portfolio"} />
        <Stat label="Total Rooms" value={totalRooms} hint="Across all properties" />
        <Stat label="Portfolio Occupancy" value={`${avgOcc}%`} tone="info" hint="Average across properties" />
        <Stat label="Portfolio ADR" value={fmtINR(avgAdr)} tone="success" hint="Average daily rate" />
      </div>

      <Tabs defaultValue="branches">
        <TabsList className="mb-4">
          <TabsTrigger value="branches"><Building2 className="size-3.5 mr-1.5" />Branches{branchesLive ? "" : " · Demo"}</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio Analytics</TabsTrigger>
          <TabsTrigger value="property">Property Detail</TabsTrigger>
          <TabsTrigger value="roomtypes"><Bed className="size-3.5 mr-1.5" />Room Types</TabsTrigger>
        </TabsList>

        {/* Branches — real multi-property CRUD via /api/branches (hotel-admin only) */}
        <TabsContent value="branches">
          {authed && !isHotelAdmin ? (
            <Card className="p-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Lock className="size-6 text-muted-foreground/70" />
              Property management is restricted to the <span className="font-medium text-foreground">hotel admin</span> role.
            </Card>
          ) : branchesQ.isLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : liveBranches.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              No properties yet. Use <span className="font-medium text-foreground">Add Property</span> to create your first branch.
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {liveBranches.map((b) => (
                <Card key={b.id} className={`p-4 ${!b.is_active ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0"><Building2 className="size-5" /></div>
                      <div>
                        <div className="font-semibold flex items-center gap-1.5">{b.name}{b.is_primary && <Badge variant="secondary" className="text-[10px]">Primary</Badge>}{!b.is_active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}</div>
                        {b.address && <div className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" />{b.address}</div>}
                      </div>
                    </div>
                    {b.star_rating ? <div className="flex items-center gap-1 text-xs font-medium"><Star className="size-3 text-yellow-500" />{b.star_rating}</div> : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center mb-3">
                    <div className="bg-muted/50 rounded p-2"><div className="text-[10px] text-muted-foreground">Code</div><div className="font-bold text-sm font-mono">{b.code || "—"}</div></div>
                    <div className="bg-muted/50 rounded p-2"><div className="text-[10px] text-muted-foreground">Rooms</div><div className="font-bold text-sm">{b.total_rooms ?? "—"}</div></div>
                  </div>
                  {(b.phone || b.email) && (
                    <div className="text-xs text-muted-foreground space-y-0.5 mb-3">
                      {b.phone && <div className="flex items-center gap-1"><Phone className="size-3" />{b.phone}</div>}
                      {b.email && <div className="flex items-center gap-1 break-all"><Mail className="size-3" />{b.email}</div>}
                    </div>
                  )}
                  <div className="flex gap-1.5 pt-1 border-t mt-auto">
                    <Button size="sm" variant="outline" className="flex-1 h-7 gap-1" onClick={() => openEdit(b)}>
                      <Pencil className="size-3" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" disabled={deleteBranchM.isPending} onClick={() => handleDeleteBranch(b)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Portfolio Overview */}
        <TabsContent value="portfolio">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Occupancy & ADR by Property</h3>
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart data={portfolioMetrics}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="property" fontSize={11} />
                    <YAxis yAxisId="l" fontSize={11} />
                    <YAxis yAxisId="r" orientation="right" fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="l" dataKey="occupancy" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Occupancy %" />
                    <Bar yAxisId="r" dataKey="adr" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="ADR (₹'000)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Performance Radar</h3>
              <div className="h-60">
                <ResponsiveContainer>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="property" fontSize={11} />
                    <Radar name="Occupancy" dataKey="Occupancy" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.2} />
                    <Radar name="ADR Index" dataKey="ADR" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.2} />
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {properties.map((p, idx) => {
              const details = PROPERTY_DETAILS[idx] ?? PROPERTY_DETAILS[0];
              return (
                <Card key={p.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setProperty(p.id); setSelectedProperty(p.id); toast.success(`Switched to ${p.name}`); }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                        <Building2 className="size-5" />
                      </div>
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3" />{p.city}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium">
                      <Star className="size-3 text-yellow-500" />
                      {details.rating}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="bg-muted/50 rounded p-2">
                      <div className="text-[10px] text-muted-foreground">Rooms</div>
                      <div className="font-bold text-sm">{p.rooms}</div>
                    </div>
                    <div className="bg-muted/50 rounded p-2">
                      <div className="text-[10px] text-muted-foreground">Occupancy</div>
                      <div className="font-bold text-sm">{p.occupancy}%</div>
                    </div>
                    <div className="bg-muted/50 rounded p-2">
                      <div className="text-[10px] text-muted-foreground">ADR</div>
                      <div className="font-bold text-sm">{Math.round(p.adr / 1000)}K</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{details.category}</Badge>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Property Detail */}
        <TabsContent value="property">
          <div className="flex gap-2 mb-4 flex-wrap">
            {properties.map((p) => (
              <button key={p.id} onClick={() => setSelectedProperty(p.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${selectedProperty === p.id ? "bg-secondary text-secondary-foreground border-secondary" : "hover:border-muted-foreground/40"}`}>
                {p.name}
              </button>
            ))}
          </div>
          {selectedP && selectedDetails && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="p-5 lg:col-span-2 space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{selectedP.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <MapPin className="size-3.5" />{selectedP.city}
                    <span>·</span>
                    <Star className="size-3.5 text-yellow-500" />{selectedDetails.rating}
                    <span>·</span>
                    <span>{selectedDetails.category}</span>
                    <span>·</span>
                    <span>Since {selectedDetails.yearOpened}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">Amenities</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDetails.amenities.map((a) => (
                      <Badge key={a} variant="secondary" className="text-xs gap-1">
                        <Coffee className="size-2.5" />{a}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="border rounded-lg p-3 text-center">
                    <div className="text-[10px] text-muted-foreground mb-1">Total Rooms</div>
                    <div className="text-xl font-bold">{selectedP.rooms}</div>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <div className="text-[10px] text-muted-foreground mb-1">Occupancy</div>
                    <div className="text-xl font-bold text-info">{selectedP.occupancy}%</div>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <div className="text-[10px] text-muted-foreground mb-1">ADR</div>
                    <div className="text-xl font-bold text-success">{fmtINR(selectedP.adr)}</div>
                  </div>
                </div>
              </Card>
              <Card className="p-5 space-y-4">
                <h3 className="font-semibold">Contacts</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-muted-foreground">General Manager</div>
                    <div className="font-medium mt-0.5">{selectedDetails.contact.gm}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="size-3" />Phone</div>
                    <div className="mt-0.5 text-sm">{selectedDetails.contact.phone}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="size-3" />Email</div>
                    <div className="mt-0.5 text-sm break-all">{selectedDetails.contact.email}</div>
                  </div>
                </div>
                <div className="border-t pt-3 space-y-2">
                  <Button size="sm" className="w-full" onClick={() => { setProperty(selectedP.id); toast.success(`Switched to ${selectedP.name}`); }}>
                    Switch to this property
                  </Button>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => toast.info("Opening property settings")}>
                    Property Settings
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Room Types */}
        <TabsContent value="roomtypes">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
            {roomTypeBreakdown.map((rt) => (
              <Card key={rt.type} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold text-sm">{rt.type}</div>
                  <Bed className="size-4 text-muted-foreground" />
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total rooms</span><span className="font-medium">{rt.total}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Currently occupied</span><span className="font-medium text-info">{rt.occupied}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Occupancy rate</span><span className="font-medium">{rt.total ? Math.round((rt.occupied / rt.total) * 100) : 0}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Base rate (BAR)</span><span className="font-medium text-success">{fmtINR(rt.rate)}</span></div>
                </div>
              </Card>
            ))}
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Room", "Type", "Status", "Floor", "Capacity", "Rate"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {propertyRooms.slice(0, 15).map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-accent/5">
                      <td className="px-4 py-3 font-mono text-xs font-medium">{r.number}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{r.type}</Badge></td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] ${r.status === "occupied" ? "bg-info/15 text-info border-info/30" : r.status === "vacant_clean" ? "bg-success/15 text-success border-success/30" : r.status === "maintenance" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning-foreground"}`}>
                          {r.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.floor}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.capacity}</td>
                      <td className="px-4 py-3 font-medium">{fmtINR(r.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Property</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Property name *</Label>
              <Input className="mt-1" placeholder="Seaside Resort — Goa" value={newBranch.name} onChange={(e) => setNewBranch((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Code</Label>
                <Input className="mt-1 font-mono" placeholder="GOA" value={newBranch.code} onChange={(e) => setNewBranch((p) => ({ ...p, code: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <Label className="text-xs">Total rooms</Label>
                <Input className="mt-1" type="number" min={0} placeholder="40" value={newBranch.total_rooms} onChange={(e) => setNewBranch((p) => ({ ...p, total_rooms: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Address</Label>
              <Input className="mt-1" placeholder="Candolim Beach Road" value={newBranch.address} onChange={(e) => setNewBranch((p) => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Phone</Label>
                <Input className="mt-1" placeholder="+91 …" value={newBranch.phone} onChange={(e) => setNewBranch((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Star rating</Label>
                <Input className="mt-1" type="number" min={1} max={5} placeholder="4" value={newBranch.star_rating} onChange={(e) => setNewBranch((p) => ({ ...p, star_rating: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input className="mt-1" type="email" placeholder="goa@hotel.com" value={newBranch.email} onChange={(e) => setNewBranch((p) => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={createBranchM.isPending || !newBranch.name.trim()} onClick={handleCreateBranch}>
              {createBranchM.isPending && <Loader2 className="size-3.5 mr-1.5 animate-spin" />} Add Property
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editBranch} onOpenChange={(o) => !o && setEditBranch(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Property</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Property name *</Label>
              <Input className="mt-1" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Code</Label>
                <Input className="mt-1 font-mono" value={editForm.code} onChange={(e) => setEditForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <Label className="text-xs">Total rooms</Label>
                <Input className="mt-1" type="number" min={0} value={editForm.total_rooms} onChange={(e) => setEditForm((p) => ({ ...p, total_rooms: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Address</Label>
              <Input className="mt-1" value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Phone</Label>
                <Input className="mt-1" value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Star rating</Label>
                <Input className="mt-1" type="number" min={1} max={5} value={editForm.star_rating} onChange={(e) => setEditForm((p) => ({ ...p, star_rating: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input className="mt-1" type="email" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm pt-1">
              <input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.checked }))} />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditBranch(null)}>Cancel</Button>
            <Button size="sm" disabled={updateBranchM.isPending || !editForm.name.trim()} onClick={handleUpdateBranch}>
              {updateBranchM.isPending && <Loader2 className="size-3.5 mr-1.5 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
