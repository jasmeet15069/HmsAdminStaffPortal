import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, resStatusMeta, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/front-desk")({
  head: () => ({ meta: [{ title: "Front Desk · MHMS" }] }),
  component: FrontDesk,
});

function FrontDesk() {
  const { reservations, guests, rooms, checkIn, checkOut, folios, payments, addPayment } = useMHMS();
  const today = new Date().toISOString().slice(0, 10);

  const arrivals = reservations.filter((r) => r.status === "confirmed" || (r.checkIn <= today && r.status === "pending"));
  const departures = reservations.filter((r) => r.status === "checked_in");
  const inhouse = reservations.filter((r) => r.status === "checked_in");

  return (
    <>
      <PageHeader title="Front Desk" description="Check-in, check-out, in-house operations" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Arrivals Today" value={arrivals.length} tone="info" />
        <Stat label="Departures Today" value={departures.length} tone="warning" />
        <Stat label="In-House" value={inhouse.length} tone="success" />
        <Stat label="VIP Guests" value={guests.filter(g => g.vip).length} />
      </div>

      <Tabs defaultValue="arrivals">
        <TabsList>
          <TabsTrigger value="arrivals">Arrivals</TabsTrigger>
          <TabsTrigger value="departures">Departures</TabsTrigger>
          <TabsTrigger value="inhouse">In-House</TabsTrigger>
        </TabsList>

        <TabsContent value="arrivals">
          <Card className="p-4 mt-4">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Guest</TableHead><TableHead>Code</TableHead><TableHead>Room</TableHead>
                <TableHead>Check-in</TableHead><TableHead>Nights</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {arrivals.map((r) => {
                  const g = guests.find(x => x.id === r.guestId);
                  const rm = rooms.find(x => x.id === r.roomId);
                  const nights = Math.round((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 86400000);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium flex items-center gap-2"><Link to="/guests/$id" params={{ id: g?.id ?? "" }} className="hover:underline">{g?.name}</Link>{g?.vip && <Badge className="bg-warning text-warning-foreground">VIP</Badge>}</TableCell>
                      <TableCell><Link to="/reservations/$id" params={{ id: r.id }} className="font-mono text-xs underline">{r.code}</Link></TableCell>
                      <TableCell>{rm?.number} · {rm?.type}</TableCell>
                      <TableCell>{r.checkIn}</TableCell>
                      <TableCell>{nights}</TableCell>
                      <TableCell><span className={`text-xs px-2 py-0.5 rounded border ${resStatusMeta[r.status].color}`}>{resStatusMeta[r.status].label}</span></TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => { checkIn(r.id); toast.success(`${g?.name} checked into ${rm?.number}`); }}>
                          <LogIn className="size-4" /> Check In
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {arrivals.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No arrivals pending</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="departures">
          <Card className="p-4 mt-4">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Guest</TableHead><TableHead>Room</TableHead><TableHead>Folio</TableHead>
                <TableHead>Paid</TableHead><TableHead>Balance</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {departures.map((r) => {
                  const g = guests.find(x => x.id === r.guestId);
                  const rm = rooms.find(x => x.id === r.roomId);
                  const total = folios.filter(f => f.reservationId === r.id).reduce((s,f) => s + f.amount, 0);
                  const paid = payments.filter(p => p.reservationId === r.id).reduce((s,p) => s + p.amount, 0);
                  const bal = total - paid;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{g?.name}</TableCell>
                      <TableCell>{rm?.number}</TableCell>
                      <TableCell>{fmtINR(total)}</TableCell>
                      <TableCell>{fmtINR(paid)}</TableCell>
                      <TableCell className={bal > 0 ? "text-destructive font-medium" : "text-success"}>{fmtINR(bal)}</TableCell>
                      <TableCell className="space-x-2">
                        {bal > 0 && (
                          <Button size="sm" variant="outline" onClick={() => { addPayment({ reservationId: r.id, amount: bal, method: "Card", date: today, reference: "TXN" + Date.now() }); toast.success(`${fmtINR(bal)} settled`); }}>
                            Settle
                          </Button>
                        )}
                        <Button size="sm" onClick={() => { checkOut(r.id); toast.success(`${g?.name} checked out`); }}>
                          <LogOut className="size-4" /> Check Out
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {departures.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No in-house guests</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="inhouse">
          <Card className="p-4 mt-4">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Guest</TableHead><TableHead>Room</TableHead><TableHead>Check-in</TableHead><TableHead>Check-out</TableHead><TableHead>Loyalty</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {inhouse.map((r) => {
                  const g = guests.find(x => x.id === r.guestId);
                  const rm = rooms.find(x => x.id === r.roomId);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{g?.name}</TableCell>
                      <TableCell>{rm?.number}</TableCell>
                      <TableCell>{r.checkIn}</TableCell>
                      <TableCell>{r.checkOut}</TableCell>
                      <TableCell><Badge variant="outline">{g?.loyaltyTier} · {g?.loyaltyPoints} pts</Badge></TableCell>
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
