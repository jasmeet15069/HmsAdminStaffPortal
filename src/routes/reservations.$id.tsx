import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, resStatusMeta, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, LogIn, LogOut, Plus, Printer, X, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { printHTML } from "@/lib/csv";

export const Route = createFileRoute("/reservations/$id")({
  head: () => ({ meta: [{ title: "Reservation · MHMS" }] }),
  component: ReservationDetail,
});

function ReservationDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { reservations, guests, rooms, folios, payments, addCharge, addPayment, checkIn, checkOut, cancelReservation, updateReservation } = useMHMS();
  const r = reservations.find((x) => x.id === id);
  const g = r ? guests.find((x) => x.id === r.guestId) : null;
  const rm = r ? rooms.find((x) => x.id === r.roomId) : null;
  const [chargeOpen, setChargeOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [charge, setCharge] = useState({ description: "", amount: 0, category: "F&B" as const });
  const [pay, setPay] = useState({ amount: 0, method: "Card" as const, reference: "" });
  const [edit, setEdit] = useState({ checkIn: r?.checkIn ?? "", checkOut: r?.checkOut ?? "", notes: r?.notes ?? "" });

  if (!r || !g || !rm) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Reservation not found</p>
        <Button asChild><Link to="/reservations">Back</Link></Button>
      </div>
    );
  }

  const myCharges = folios.filter((f) => f.reservationId === r.id);
  const myPays = payments.filter((p) => p.reservationId === r.id);
  const total = myCharges.reduce((s, f) => s + f.amount, 0);
  const paid = myPays.reduce((s, p) => s + p.amount, 0);
  const balance = total - paid;
  const nights = Math.max(1, Math.round((+new Date(r.checkOut) - +new Date(r.checkIn)) / 86400000));

  const printInvoice = () => {
    const rowsHTML = myCharges.map((f) => `<tr><td>${f.date}</td><td>${f.description}</td><td>${f.category}</td><td class="right">${fmtINR(f.amount)}</td></tr>`).join("");
    const paysHTML = myPays.map((p) => `<tr><td>${p.date}</td><td>${p.method}</td><td>${p.reference ?? ""}</td><td class="right">${fmtINR(p.amount)}</td></tr>`).join("");
    printHTML(`Invoice ${r.code}`, `
      <div class="brand">
        <div><h1>Hotel Harmony</h1><div class="muted">123 Marine Drive · GSTIN 27AAACA1234B1Z5</div></div>
        <div style="text-align:right"><h1>INVOICE</h1><div class="muted">INV-${r.code.slice(3)} · ${r.checkOut}</div></div>
      </div>
      <h2>Bill To</h2>
      <div><strong>${g.name}</strong><br>${g.email} · ${g.phone}<br>${g.nationality ?? ""}</div>
      <h2>Stay Details</h2>
      <table><tr><th>Reservation</th><th>Room</th><th>Check-in</th><th>Check-out</th><th>Nights</th></tr>
      <tr><td>${r.code}</td><td>${rm.number} (${rm.type})</td><td>${r.checkIn}</td><td>${r.checkOut}</td><td>${nights}</td></tr></table>
      <h2>Charges</h2>
      <table><tr><th>Date</th><th>Description</th><th>Category</th><th class="right">Amount</th></tr>${rowsHTML}</table>
      <h2>Payments</h2>
      <table><tr><th>Date</th><th>Method</th><th>Reference</th><th class="right">Amount</th></tr>${paysHTML || `<tr><td colspan="4" class="muted">No payments recorded</td></tr>`}</table>
      <div class="totals">
        <div class="row"><span>Subtotal</span><span>${fmtINR(total)}</span></div>
        <div class="row"><span>Paid</span><span>${fmtINR(paid)}</span></div>
        <div class="row grand"><span>Balance Due</span><span>${fmtINR(balance)}</span></div>
      </div>
      <div style="clear:both;margin-top:60px" class="muted">Thank you for staying with us. <span class="badge">${r.status.toUpperCase()}</span></div>
    `);
  };

  return (
    <>
      <PageHeader
        title={`Reservation ${r.code}`}
        description={`${g.name} · Room ${rm.number}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => nav({ to: "/reservations" })}><ArrowLeft className="size-4" /> Back</Button>
            <Button variant="outline" onClick={printInvoice}><Printer className="size-4" /> Print Invoice</Button>
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-4 mb-6">
        <Card className="col-span-12 lg:col-span-8 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-lg">
                  <Link to="/guests/$id" params={{ id: g.id }} className="hover:underline">{g.name}</Link>
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded border ${resStatusMeta[r.status].color}`}>{resStatusMeta[r.status].label}</span>
              </div>
              <div className="text-sm text-muted-foreground">{g.email} · {g.phone}</div>
            </div>
            <div className="flex gap-2">
              {r.status === "confirmed" && <Button onClick={() => { checkIn(r.id); toast.success("Checked in"); }}><LogIn className="size-4" /> Check In</Button>}
              {r.status === "checked_in" && <Button onClick={() => { checkOut(r.id); toast.success("Checked out"); }}><LogOut className="size-4" /> Check Out</Button>}
              {(r.status === "confirmed" || r.status === "pending") && <Button variant="destructive" onClick={() => { cancelReservation(r.id); toast.success("Cancelled"); }}><X className="size-4" /> Cancel</Button>}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <KV label="Room" v={`${rm.number} · ${rm.type}`} />
            <KV label="Rate / night" v={fmtINR(rm.rate)} />
            <KV label="Nights" v={nights} />
            <KV label="Source" v={r.source} />
            <KV label="Check-in" v={r.checkIn} />
            <KV label="Check-out" v={r.checkOut} />
            <KV label="Adults / Children" v={`${r.adults} / ${r.children}`} />
            <KV label="Loyalty" v={`${g.loyaltyTier} · ${g.loyaltyPoints} pts`} />
          </div>
          <div className="mt-4">
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild><Button variant="outline" size="sm"><FileText className="size-4" /> Modify booking</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Modify reservation</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Check-in</Label><Input type="date" className="mt-1" value={edit.checkIn} onChange={(e) => setEdit({ ...edit, checkIn: e.target.value })} /></div>
                    <div><Label>Check-out</Label><Input type="date" className="mt-1" value={edit.checkOut} onChange={(e) => setEdit({ ...edit, checkOut: e.target.value })} /></div>
                  </div>
                  <div><Label>Notes</Label><Textarea className="mt-1" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                  <Button onClick={() => { updateReservation(r.id, edit); setEditOpen(false); toast.success("Reservation updated"); }}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </Card>
        <div className="col-span-12 lg:col-span-4 space-y-3">
          <Stat label="Total Charges" value={fmtINR(total)} />
          <Stat label="Paid" value={fmtINR(paid)} tone="success" />
          <Stat label="Balance Due" value={fmtINR(balance)} tone={balance > 0 ? "warning" : "success"} />
        </div>
      </div>

      <Tabs defaultValue="folio">
        <TabsList>
          <TabsTrigger value="folio">Folio ({myCharges.length})</TabsTrigger>
          <TabsTrigger value="pays">Payments ({myPays.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>
        <TabsContent value="folio">
          <Card className="p-4 mt-4">
            <div className="flex gap-2 mb-3">
              <Dialog open={chargeOpen} onOpenChange={setChargeOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="size-4" /> Add charge</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add charge</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Description</Label><Input className="mt-1" value={charge.description} onChange={(e) => setCharge({ ...charge, description: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Amount</Label><Input className="mt-1" type="number" value={charge.amount} onChange={(e) => setCharge({ ...charge, amount: +e.target.value })} /></div>
                      <div><Label>Category</Label>
                        <Select value={charge.category} onValueChange={(v) => setCharge({ ...charge, category: v as never })}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>{["Room","F&B","Spa","Laundry","Mini-bar","Tax","Other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setChargeOpen(false)}>Cancel</Button>
                    <Button onClick={() => { addCharge({ ...charge, reservationId: r.id, date: new Date().toISOString().slice(0,10) }); setChargeOpen(false); setCharge({ description: "", amount: 0, category: "F&B" }); toast.success("Charge added"); }}>Add</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={payOpen} onOpenChange={setPayOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline">Receive payment</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Receive payment</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Amount</Label><Input className="mt-1" type="number" value={pay.amount || balance} onChange={(e) => setPay({ ...pay, amount: +e.target.value })} /></div>
                    <div><Label>Method</Label>
                      <Select value={pay.method} onValueChange={(v) => setPay({ ...pay, method: v as never })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{["Card","Cash","UPI","Bank Transfer"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Reference</Label><Input className="mt-1" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} placeholder="TXN ID" /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
                    <Button onClick={() => { addPayment({ amount: pay.amount || balance, method: pay.method, reference: pay.reference || ("TXN" + Date.now()), reservationId: r.id, date: new Date().toISOString().slice(0,10) }); setPayOpen(false); setPay({ amount: 0, method: "Card", reference: "" }); toast.success("Payment recorded"); }}>Receive</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {myCharges.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{f.date}</TableCell>
                    <TableCell>{f.description}</TableCell>
                    <TableCell><Badge variant="outline">{f.category}</Badge></TableCell>
                    <TableCell className="text-right">{fmtINR(f.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end border-t pt-3 mt-3 text-sm">
              <div className="w-64 space-y-1">
                <div className="flex justify-between"><span>Subtotal</span><span>{fmtINR(total)}</span></div>
                <div className="flex justify-between"><span>Paid</span><span className="text-success">{fmtINR(paid)}</span></div>
                <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>Balance</span><span className={balance > 0 ? "text-destructive" : "text-success"}>{fmtINR(balance)}</span></div>
              </div>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="pays">
          <Card className="p-4 mt-4">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {myPays.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.date}</TableCell>
                    <TableCell><Badge variant="outline">{p.method}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                    <TableCell className="text-right">{fmtINR(p.amount)}</TableCell>
                  </TableRow>
                ))}
                {myPays.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No payments yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="notes">
          <Card className="p-5 mt-4 text-sm whitespace-pre-wrap min-h-[120px]">
            {r.notes || <span className="text-muted-foreground">No notes. Use "Modify booking" to add.</span>}
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function KV({ label, v }: { label: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className="font-medium mt-0.5">{v}</div>
    </div>
  );
}
