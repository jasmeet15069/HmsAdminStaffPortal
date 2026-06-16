import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Download, Printer } from "lucide-react";

export const Route = createFileRoute("/billing")({
  head: () => ({ meta: [{ title: "Billing & Finance · MHMS" }] }),
  component: Billing,
});

function Billing() {
  const { reservations, guests, folios, payments, addCharge, addPayment } = useMHMS();
  const [selected, setSelected] = useState<string | null>(reservations.find(r => r.status === "checked_in")?.id ?? reservations[0]?.id ?? null);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [charge, setCharge] = useState({ description: "", amount: 0, category: "F&B" as const });
  const [pay, setPay] = useState({ amount: 0, method: "Card" as const, reference: "" });

  const r = reservations.find(x => x.id === selected);
  const g = r ? guests.find(x => x.id === r.guestId) : null;
  const ch = folios.filter(f => f.reservationId === selected);
  const pys = payments.filter(p => p.reservationId === selected);
  const total = ch.reduce((s, f) => s + f.amount, 0);
  const paid = pys.reduce((s, p) => s + p.amount, 0);
  const balance = total - paid;

  const totalRev = folios.reduce((s, f) => s + f.amount, 0);
  const totalCollected = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <PageHeader title="Billing & Finance" description="Folios, invoices, payments and AR" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Total Revenue" value={fmtINR(totalRev)} tone="success" />
        <Stat label="Collected" value={fmtINR(totalCollected)} tone="info" />
        <Stat label="Outstanding" value={fmtINR(totalRev - totalCollected)} tone="warning" />
        <Stat label="Open Folios" value={reservations.filter(x => x.status === "checked_in").length} />
      </div>

      <Tabs defaultValue="folios">
        <TabsList>
          <TabsTrigger value="folios">Guest Folios</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="folios">
          <div className="grid grid-cols-12 gap-4 mt-4">
            <Card className="col-span-4 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-2">Open folios</div>
              <div className="space-y-1 max-h-[520px] overflow-y-auto">
                {reservations.filter(x => x.status === "checked_in" || x.status === "checked_out").map(x => {
                  const xg = guests.find(z => z.id === x.guestId);
                  return (
                    <button key={x.id} onClick={() => setSelected(x.id)} className={`w-full text-left p-2 rounded text-sm flex items-center justify-between ${selected === x.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"}`}>
                      <div><div className="font-medium">{xg?.name}</div><div className="text-xs text-muted-foreground">{x.code}</div></div>
                      <Badge variant="outline">{x.status === "checked_in" ? "Open" : "Closed"}</Badge>
                    </button>
                  );
                })}
              </div>
            </Card>
            <Card className="col-span-8 p-5">
              {r && g ? (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold">{g.name} · {r.code}</h3>
                      <p className="text-sm text-muted-foreground">{r.checkIn} → {r.checkOut}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => toast.success("Invoice PDF downloaded")}><Download className="size-4" /> PDF</Button>
                      <Button variant="outline" size="sm" onClick={() => toast.success("Sent to printer")}><Printer className="size-4" /> Print</Button>
                    </div>
                  </div>
                  <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {ch.map(f => (
                        <TableRow key={f.id}>
                          <TableCell>{f.date}</TableCell>
                          <TableCell>{f.description}</TableCell>
                          <TableCell><Badge variant="outline">{f.category}</Badge></TableCell>
                          <TableCell className="text-right">{fmtINR(f.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="border-t pt-3 mt-3 space-y-1 text-sm">
                    <div className="flex justify-between"><span>Subtotal</span><span>{fmtINR(total)}</span></div>
                    <div className="flex justify-between"><span>Paid</span><span className="text-success">{fmtINR(paid)}</span></div>
                    <div className="flex justify-between font-semibold text-lg pt-1 border-t mt-1"><span>Balance</span><span className={balance > 0 ? "text-destructive" : "text-success"}>{fmtINR(balance)}</span></div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Dialog open={chargeOpen} onOpenChange={setChargeOpen}>
                      <DialogTrigger asChild><Button variant="outline"><Plus className="size-4" /> Add charge</Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Add charge</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div><Label>Description</Label><Input className="mt-1" value={charge.description} onChange={(e) => setCharge({ ...charge, description: e.target.value })} /></div>
                          <div><Label>Amount</Label><Input className="mt-1" type="number" value={charge.amount} onChange={(e) => setCharge({ ...charge, amount: +e.target.value })} /></div>
                          <div><Label>Category</Label>
                            <Select value={charge.category} onValueChange={(v) => setCharge({ ...charge, category: v as never })}>
                              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>{["Room","F&B","Spa","Laundry","Mini-bar","Tax","Other"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setChargeOpen(false)}>Cancel</Button>
                          <Button onClick={() => { addCharge({ ...charge, reservationId: r.id, date: new Date().toISOString().slice(0,10) }); setChargeOpen(false); toast.success("Charge added"); }}>Add</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Dialog open={payOpen} onOpenChange={setPayOpen}>
                      <DialogTrigger asChild><Button>Receive payment</Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Receive payment</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div><Label>Amount</Label><Input className="mt-1" type="number" value={pay.amount || balance} onChange={(e) => setPay({ ...pay, amount: +e.target.value })} /></div>
                          <div><Label>Method</Label>
                            <Select value={pay.method} onValueChange={(v) => setPay({ ...pay, method: v as never })}>
                              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>{["Card","Cash","UPI","Bank Transfer"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div><Label>Reference</Label><Input className="mt-1" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} placeholder="TXN ID" /></div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
                          <Button onClick={() => { addPayment({ amount: pay.amount || balance, method: pay.method, reference: pay.reference, reservationId: r.id, date: new Date().toISOString().slice(0,10) }); setPayOpen(false); toast.success("Payment recorded"); }}>Receive</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </>
              ) : <div className="text-center text-muted-foreground py-12">Select a folio</div>}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="p-4 mt-4">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Reservation</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {payments.map(p => {
                  const res = reservations.find(x => x.id === p.reservationId);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{p.date}</TableCell>
                      <TableCell className="font-mono text-xs">{res?.code}</TableCell>
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

        <TabsContent value="invoices">
          <Card className="p-4 mt-4">
            <Table>
              <TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Guest</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {reservations.filter(x => x.status === "checked_out").map(x => {
                  const xg = guests.find(z => z.id === x.guestId);
                  const t = folios.filter(f => f.reservationId === x.id).reduce((s,f) => s + f.amount, 0);
                  return (
                    <TableRow key={x.id}>
                      <TableCell className="font-mono">INV-{x.code.slice(3)}</TableCell>
                      <TableCell>{xg?.name}</TableCell>
                      <TableCell>{x.checkOut}</TableCell>
                      <TableCell><Badge className="bg-success/15 text-success border-success/30" variant="outline">Paid</Badge></TableCell>
                      <TableCell className="text-right">{fmtINR(t)}</TableCell>
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
