import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Mail, Phone, Star, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/guests/$id")({
  head: () => ({ meta: [{ title: "Guest Profile · MHMS" }] }),
  component: GuestDetail,
});

function GuestDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { guests, reservations, rooms, folios, payments, updateGuest } = useMHMS();
  const g = guests.find((x) => x.id === id);
  const [form, setForm] = useState(g);

  if (!g || !form) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Guest not found</p>
        <Button asChild><Link to="/crm">Back to CRM</Link></Button>
      </div>
    );
  }

  const myRes = reservations.filter((r) => r.guestId === g.id).sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  const ltv = myRes.reduce((s, r) => s + r.rate, 0);
  const totalCharges = folios.filter((f) => myRes.some((r) => r.id === f.reservationId)).reduce((s, f) => s + f.amount, 0);
  const totalPaid = payments.filter((p) => myRes.some((r) => r.id === p.reservationId)).reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <PageHeader
        title={g.name}
        description={`${g.loyaltyTier} member · ${g.totalStays} total stays`}
        actions={<Button variant="outline" onClick={() => nav({ to: "/crm" })}><ArrowLeft className="size-4" /> Back</Button>}
      />

      <div className="grid grid-cols-12 gap-4 mb-6">
        <Card className="col-span-12 md:col-span-4 p-5">
          <div className="flex items-center gap-4">
            <Avatar className="size-16"><AvatarFallback className="text-lg">{g.name.split(" ").map((s) => s[0]).join("")}</AvatarFallback></Avatar>
            <div>
              <div className="font-semibold text-lg flex items-center gap-2">{g.name}{g.vip && <Star className="size-4 text-warning fill-warning" />}</div>
              <div className="text-sm text-muted-foreground">{g.nationality}</div>
              <Badge className="mt-1" variant="outline">{g.loyaltyTier} · {g.loyaltyPoints?.toLocaleString()} pts</Badge>
            </div>
          </div>
          <div className="border-t mt-4 pt-4 space-y-2 text-sm">
            <div className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" />{g.email}</div>
            <div className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" />{g.phone}</div>
          </div>
        </Card>
        <div className="col-span-12 md:col-span-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Total Stays" value={myRes.length} />
          <Stat label="Lifetime Value" value={fmtINR(ltv)} tone="success" />
          <Stat label="Total Charges" value={fmtINR(totalCharges)} />
          <Stat label="Outstanding" value={fmtINR(totalCharges - totalPaid)} tone={totalCharges - totalPaid > 0 ? "warning" : "success"} />
        </div>
      </div>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Stay History</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="history">
          <Card className="p-4 mt-4">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Code</TableHead><TableHead>Room</TableHead><TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Rate</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {myRes.map((r) => {
                  const rm = rooms.find((x) => x.id === r.roomId);
                  return (
                    <TableRow key={r.id}>
                      <TableCell><Link to="/reservations/$id" params={{ id: r.id }} className="font-mono text-xs underline">{r.code}</Link></TableCell>
                      <TableCell>{rm?.number} · {rm?.type}</TableCell>
                      <TableCell>{r.checkIn}</TableCell>
                      <TableCell>{r.checkOut}</TableCell>
                      <TableCell><Badge variant="outline">{r.source}</Badge></TableCell>
                      <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                      <TableCell className="text-right">{fmtINR(r.rate)}</TableCell>
                    </TableRow>
                  );
                })}
                {myRes.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No reservations yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="profile">
          <Card className="p-5 mt-4 max-w-2xl">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Full name</Label><Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input className="mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input className="mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Nationality</Label><Input className="mt-1" value={form.nationality ?? ""} onChange={(e) => setForm({ ...form, nationality: e.target.value })} /></div>
              <div><Label>Loyalty Tier</Label><Input className="mt-1" value={form.loyaltyTier ?? ""} onChange={(e) => setForm({ ...form, loyaltyTier: e.target.value as never })} /></div>
              <div><Label>Loyalty Points</Label><Input type="number" className="mt-1" value={form.loyaltyPoints ?? 0} onChange={(e) => setForm({ ...form, loyaltyPoints: +e.target.value })} /></div>
            </div>
            <Button className="mt-5" onClick={() => { updateGuest(g.id, form); toast.success("Profile updated"); }}><Save className="size-4" /> Save changes</Button>
          </Card>
        </TabsContent>
        <TabsContent value="payments">
          <Card className="p-4 mt-4">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Reservation</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {payments.filter((p) => myRes.some((r) => r.id === p.reservationId)).map((p) => {
                  const r = myRes.find((x) => x.id === p.reservationId);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{p.date}</TableCell>
                      <TableCell className="font-mono text-xs">{r?.code}</TableCell>
                      <TableCell><Badge variant="outline">{p.method}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                      <TableCell className="text-right">{fmtINR(p.amount)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
