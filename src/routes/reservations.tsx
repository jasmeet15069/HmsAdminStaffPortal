import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useMHMS, resStatusMeta, fmtINR, type ResStatus } from "@/lib/mhms-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Search, Eye, X, LogIn, LogOut } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/reservations")({
  head: () => ({ meta: [{ title: "Reservations · MHMS" }] }),
  component: ReservationsPage,
});

function ReservationsPage() {
  const { reservations, guests, rooms, cancelReservation, checkIn, checkOut } = useMHMS();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      const g = guests.find((x) => x.id === r.guestId);
      const matchQ = !q || g?.name.toLowerCase().includes(q.toLowerCase()) || r.code.toLowerCase().includes(q.toLowerCase());
      const matchS = status === "all" || r.status === status;
      return matchQ && matchS;
    });
  }, [reservations, guests, q, status]);

  const counts = {
    all: reservations.length,
    confirmed: reservations.filter(r => r.status === "confirmed").length,
    checked_in: reservations.filter(r => r.status === "checked_in").length,
    checked_out: reservations.filter(r => r.status === "checked_out").length,
    cancelled: reservations.filter(r => r.status === "cancelled").length,
  };

  const sel = open ? reservations.find(r => r.id === open) : null;
  const selGuest = sel ? guests.find(g => g.id === sel.guestId) : null;
  const selRoom = sel ? rooms.find(r => r.id === sel.roomId) : null;

  return (
    <>
      <PageHeader
        title="Reservations"
        description="Manage bookings, modifications, group blocks and cancellations."
        actions={
          <Button asChild><Link to="/reservations/new"><Plus className="size-4" /> New reservation</Link></Button>
        }
      />

      <Tabs value={status} onValueChange={setStatus}>
        <TabsList>
          <TabsTrigger value="all">All <Badge variant="secondary" className="ml-2">{counts.all}</Badge></TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed <Badge variant="secondary" className="ml-2">{counts.confirmed}</Badge></TabsTrigger>
          <TabsTrigger value="checked_in">In-house <Badge variant="secondary" className="ml-2">{counts.checked_in}</Badge></TabsTrigger>
          <TabsTrigger value="checked_out">Departed <Badge variant="secondary" className="ml-2">{counts.checked_out}</Badge></TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled <Badge variant="secondary" className="ml-2">{counts.cancelled}</Badge></TabsTrigger>
        </TabsList>
        <TabsContent value={status} className="mt-4">
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search by guest or code…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-40"><SelectValue placeholder="Source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="Direct">Direct</SelectItem>
                  <SelectItem value="Booking.com">Booking.com</SelectItem>
                  <SelectItem value="Expedia">Expedia</SelectItem>
                  <SelectItem value="Walk-in">Walk-in</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const g = guests.find((x) => x.id === r.guestId);
                  const room = rooms.find((x) => x.id === r.roomId);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.code}</TableCell>
                      <TableCell className="font-medium">{g?.name}</TableCell>
                      <TableCell>{room?.number} · {room?.type}</TableCell>
                      <TableCell>{r.checkIn}</TableCell>
                      <TableCell>{r.checkOut}</TableCell>
                      <TableCell><Badge variant="outline">{r.source}</Badge></TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded border ${resStatusMeta[r.status as ResStatus].color}`}>
                          {resStatusMeta[r.status as ResStatus].label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">{fmtINR(r.rate)}</TableCell>
                      <TableCell className="space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => setOpen(r.id)}><Eye className="size-4" /></Button>
                        <Button variant="outline" size="sm" asChild><Link to="/reservations/$id" params={{ id: r.id }}>Open</Link></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No reservations match your filters</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          {sel && selGuest && selRoom && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  Reservation {sel.code}
                  <span className={`text-xs px-2 py-0.5 rounded border ${resStatusMeta[sel.status].color}`}>{resStatusMeta[sel.status].label}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Field label="Guest" value={selGuest.name} />
                <Field label="Email" value={selGuest.email} />
                <Field label="Phone" value={selGuest.phone} />
                <Field label="Loyalty" value={`${selGuest.loyaltyTier} · ${selGuest.loyaltyPoints} pts`} />
                <Field label="Room" value={`${selRoom.number} · ${selRoom.type}`} />
                <Field label="Source" value={sel.source} />
                <Field label="Check-in" value={sel.checkIn} />
                <Field label="Check-out" value={sel.checkOut} />
                <Field label="Adults / Children" value={`${sel.adults} / ${sel.children}`} />
                <Field label="Rate / night" value={fmtINR(sel.rate)} />
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                {sel.status === "confirmed" && (
                  <Button onClick={() => { checkIn(sel.id); toast.success("Guest checked in"); setOpen(null); }}>
                    <LogIn className="size-4" /> Check In
                  </Button>
                )}
                {sel.status === "checked_in" && (
                  <Button onClick={() => { checkOut(sel.id); toast.success("Guest checked out"); setOpen(null); }}>
                    <LogOut className="size-4" /> Check Out
                  </Button>
                )}
                {(sel.status === "confirmed" || sel.status === "pending") && (
                  <Button variant="destructive" onClick={() => { cancelReservation(sel.id); toast.success("Reservation cancelled"); setOpen(null); }}>
                    <X className="size-4" /> Cancel
                  </Button>
                )}
                <Button variant="outline" onClick={() => setOpen(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}
