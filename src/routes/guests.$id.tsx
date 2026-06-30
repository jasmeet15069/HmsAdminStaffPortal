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
import { ArrowLeft, Mail, Phone, Star, Save, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/api/auth";
import { useGuestDetail, useUpdateGuest, useReservations } from "@/lib/api/hooks";

export const Route = createFileRoute("/guests/$id")({
  head: () => ({ meta: [{ title: "Guest Profile · MHMS" }] }),
  component: GuestDetail,
});

function GuestDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const authed = !!useAuth((s) => s.user);
  const { guests, reservations: demoReservations, rooms, folios, payments, updateGuest } = useMHMS();
  const guestDetailQ = useGuestDetail(authed ? id : null);
  const updateGuestM = useUpdateGuest();
  const liveResQ = useReservations();

  const demoGuest = guests.find((x) => x.id === id);

  const g = authed && guestDetailQ.data
    ? {
        id: guestDetailQ.data.id,
        name: guestDetailQ.data.full_name,
        email: guestDetailQ.data.email ?? "",
        phone: guestDetailQ.data.phone ?? "",
        nationality: guestDetailQ.data.country ?? "",
        loyaltyTier: (guestDetailQ.data as any).loyalty_tier ?? "Bronze",
        loyaltyPoints: guestDetailQ.data.loyalty_points ?? 0,
        vip: guestDetailQ.data.vip_status === "vip",
        totalStays: guestDetailQ.data.total_stays ?? 0,
        _live: true,
      }
    : demoGuest;

  const [form, setForm] = useState<typeof g>(g ?? undefined);

  const isLive = authed && !!(g as any)?._live;

  // Sync form when live data loads
  const prevGId = form?.id;
  if (g && g.id !== prevGId) setForm(g as any);

  if (!g || !form) {
    if (authed && guestDetailQ.isLoading) {
      return <div className="text-center py-12 text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Loading guest…</div>;
    }
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Guest not found</p>
        <Button asChild><Link to="/crm">Back to CRM</Link></Button>
      </div>
    );
  }

  const myRes = isLive
    ? (liveResQ.data ?? []).filter((r: any) => r.guest_id === id || r.guestId === id).sort((a: any, b: any) => (b.check_in ?? b.checkIn ?? "").localeCompare(a.check_in ?? a.checkIn ?? ""))
    : demoReservations.filter((r) => r.guestId === g.id).sort((a, b) => b.checkIn.localeCompare(a.checkIn));

  const ltv = myRes.reduce((s: number, r: any) => s + (r.rate ?? r.total_amount ?? 0), 0);
  const totalCharges = folios.filter((f) => (myRes as any[]).some((r: any) => r.id === f.reservationId)).reduce((s, f) => s + f.amount, 0);
  const totalPaid = payments.filter((p) => myRes.some((r: any) => r.id === p.reservationId)).reduce((s, p) => s + p.amount, 0);

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
                {(myRes as any[]).map((r) => {
                  const roomId = r.roomId ?? r.room_id;
                  const rm = rooms.find((x) => x.id === roomId);
                  return (
                    <TableRow key={r.id}>
                      <TableCell><Link to="/reservations/$id" params={{ id: r.id }} className="font-mono text-xs underline">{r.code ?? r.booking_number ?? r.id.slice(0, 8)}</Link></TableCell>
                      <TableCell>{rm?.number ?? r.room_number ?? "—"} · {rm?.type ?? r.room_type ?? ""}</TableCell>
                      <TableCell>{r.checkIn ?? r.check_in}</TableCell>
                      <TableCell>{r.checkOut ?? r.check_out}</TableCell>
                      <TableCell><Badge variant="outline">{r.source ?? r.booking_source ?? "Direct"}</Badge></TableCell>
                      <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                      <TableCell className="text-right">{fmtINR(r.rate ?? r.total_amount ?? 0)}</TableCell>
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
              <div><Label>Full name</Label><Input className="mt-1" value={form?.name ?? ""} onChange={(e) => setForm({ ...form!, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input className="mt-1" value={form?.email ?? ""} onChange={(e) => setForm({ ...form!, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input className="mt-1" value={form?.phone ?? ""} onChange={(e) => setForm({ ...form!, phone: e.target.value })} /></div>
              <div><Label>Nationality</Label><Input className="mt-1" value={form?.nationality ?? ""} onChange={(e) => setForm({ ...form!, nationality: e.target.value })} /></div>
              <div><Label>Loyalty Tier</Label><Input className="mt-1" value={form?.loyaltyTier ?? ""} onChange={(e) => setForm({ ...form!, loyaltyTier: e.target.value as never })} /></div>
              <div><Label>Loyalty Points</Label><Input type="number" className="mt-1" value={form?.loyaltyPoints ?? 0} onChange={(e) => setForm({ ...form!, loyaltyPoints: +e.target.value })} /></div>
            </div>
            <Button className="mt-5" disabled={updateGuestM.isPending} onClick={() => {
              if (isLive) {
                updateGuestM.mutate({ id: g.id, patch: { full_name: form!.name, email: form!.email, phone: form!.phone, country: form!.nationality } }, {
                  onSuccess: () => toast.success("Profile updated"),
                  onError: () => toast.error("Failed to update"),
                });
              } else {
                updateGuest(g.id, form as any);
                toast.success("Profile updated");
              }
            }}>
              {updateGuestM.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save changes
            </Button>
          </Card>
        </TabsContent>
        <TabsContent value="payments">
          <Card className="p-4 mt-4">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Reservation</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {payments.filter((p) => (myRes as any[]).some((r) => r.id === p.reservationId)).map((p) => {
                  const r = (myRes as any[]).find((x) => x.id === p.reservationId);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{p.date}</TableCell>
                      <TableCell className="font-mono text-xs">{r?.code ?? r?.booking_number ?? "—"}</TableCell>
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
