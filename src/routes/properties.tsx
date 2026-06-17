import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend } from "recharts";
import { Building2, MapPin, Phone, Mail, Plus, Star, Bed, Coffee, Waves } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
  const { properties, setProperty, rooms } = useMHMS();
  const [selectedProperty, setSelectedProperty] = useState(properties[0]?.id ?? null);

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
          <Button size="sm" className="gap-1.5" onClick={() => toast.success("Add property form")}>
            <Plus className="size-4" /> Add Property
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="Properties" value={properties.length} hint="In portfolio" />
        <Stat label="Total Rooms" value={totalRooms} hint="Across all properties" />
        <Stat label="Portfolio Occupancy" value={`${avgOcc}%`} tone="info" hint="Average across properties" />
        <Stat label="Portfolio ADR" value={fmtINR(avgAdr)} tone="success" hint="Average daily rate" />
      </div>

      <Tabs defaultValue="portfolio">
        <TabsList className="mb-4">
          <TabsTrigger value="portfolio"><Building2 className="size-3.5 mr-1.5" />Portfolio Overview</TabsTrigger>
          <TabsTrigger value="property">Property Detail</TabsTrigger>
          <TabsTrigger value="roomtypes"><Bed className="size-3.5 mr-1.5" />Room Types</TabsTrigger>
        </TabsList>

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
    </>
  );
}
