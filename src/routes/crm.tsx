import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { useAuth } from "@/lib/api/auth";
import { useGuests } from "@/lib/api/hooks";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useMemo, useState } from "react";
import { Star } from "lucide-react";

export const Route = createFileRoute("/crm")({
  head: () => ({ meta: [{ title: "CRM & Loyalty · MHMS" }] }),
  component: CRM,
});

interface GuestRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  tier: string;
  points: number;
  stays: number;
  ltv: number | null;
  vip: boolean;
  nationality?: string;
}

function CRM() {
  const authed = !!useAuth((s) => s.user);
  const liveGuests = useGuests();
  const isLive = authed && !!liveGuests.data;

  const { guests, reservations } = useMHMS();
  const [q, setQ] = useState("");

  const rows: GuestRow[] = useMemo(() => {
    if (isLive) {
      return (liveGuests.data ?? []).map((g) => ({
        id: g.id,
        name: g.full_name,
        email: g.email ?? "—",
        phone: g.phone ?? "—",
        tier: g.vip_status && g.vip_status !== "none" ? g.vip_status : "Standard",
        points: g.loyalty_points ?? 0,
        stays: g.total_stays ?? 0,
        ltv: null,
        vip: !!g.vip_status && g.vip_status !== "none",
      }));
    }
    return guests.map((g) => ({
      id: g.id,
      name: g.name,
      email: g.email,
      phone: g.phone,
      tier: g.loyaltyTier ?? "Standard",
      points: g.loyaltyPoints ?? 0,
      stays: g.totalStays ?? 0,
      ltv: reservations.filter((r) => r.guestId === g.id).reduce((s, r) => s + r.rate, 0),
      vip: !!g.vip,
      nationality: g.nationality,
    }));
  }, [isLive, liveGuests.data, guests, reservations]);

  const filtered = rows
    .filter((g) => g.name.toLowerCase().includes(q.toLowerCase()))
    .slice()
    .sort((a, b) => b.points - a.points);

  const tierCount = (t: string) => rows.filter((g) => g.tier === t).length;

  return (
    <>
      <PageHeader
        title="CRM & Loyalty"
        description="Guest database, preferences, loyalty program"
        actions={
          <Badge variant={isLive ? "default" : "outline"} className="self-center">
            {isLive ? "Live data" : "Demo data"}
          </Badge>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Total Guests" value={rows.length} />
        <Stat label="Platinum" value={tierCount("Platinum")} tone="success" />
        <Stat label="Gold" value={tierCount("Gold")} tone="warning" />
        <Stat label="Repeat Rate" value="62%" tone="info" />
      </div>
      <Tabs defaultValue="guests">
        <TabsList>
          <TabsTrigger value="guests">Guest Database</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>
        <TabsContent value="guests">
          <Card className="p-4 mt-4">
            <Input
              placeholder="Search guests…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-sm mb-4"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Total Stays</TableHead>
                  <TableHead>Lifetime Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">
                            {g.name
                              .split(" ")
                              .map((s) => s[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium flex items-center gap-1">
                            {g.name}
                            {g.vip && <Star className="size-3.5 text-warning fill-warning" />}
                          </div>
                          {g.nationality && (
                            <div className="text-xs text-muted-foreground">{g.nationality}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {g.email}
                      <br />
                      <span className="text-muted-foreground text-xs">{g.phone}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          g.tier === "Platinum"
                            ? "bg-info/15 text-info border-info/30"
                            : g.tier === "Gold"
                              ? "bg-warning/20 text-warning-foreground border-warning/40"
                              : ""
                        }
                      >
                        {g.tier}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{g.points.toLocaleString()}</TableCell>
                    <TableCell>{g.stays}</TableCell>
                    <TableCell>{g.ltv === null ? "—" : fmtINR(g.ltv)}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No guests found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="campaigns">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            {[
              {
                name: "Monsoon Special",
                audience: "Gold + Platinum",
                sent: 248,
                opens: "62%",
                revenue: 184000,
              },
              {
                name: "Anniversary Returns",
                audience: "All Platinum",
                sent: 89,
                opens: "78%",
                revenue: 312000,
              },
              {
                name: "Corporate Q3",
                audience: "Corporate accounts",
                sent: 56,
                opens: "54%",
                revenue: 96000,
              },
            ].map((c) => (
              <Card key={c.name} className="p-4">
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.audience}</div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Sent</div>
                    <div className="font-medium">{c.sent}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Opens</div>
                    <div className="font-medium">{c.opens}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Revenue</div>
                    <div className="font-medium">{fmtINR(c.revenue)}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
