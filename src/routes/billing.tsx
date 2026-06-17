import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Plus, Download, Printer, Search, Receipt, CreditCard, FileText } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const PAYMENT_METHODS = ["Card", "Cash", "UPI", "Bank Transfer", "Room Charge"];
const CHARGE_CATEGORIES = ["Room", "F&B", "Spa", "Laundry", "Mini-bar", "Parking", "Internet", "Telephone", "Tax", "Other"];

export const Route = createFileRoute("/billing")({
  head: () => ({ meta: [{ title: "Billing & Finance · MHMS" }] }),
  component: Billing,
});

function Billing() {
  const { reservations, guests, folios, payments, addCharge, addPayment } = useMHMS();
  const [selected, setSelected] = useState<string | null>(
    reservations.find((r) => r.status === "checked_in")?.id ?? reservations[0]?.id ?? null
  );
  const [chargeOpen, setChargeOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [charge, setCharge] = useState({ description: "", amount: "", category: "F&B" });
  const [pay, setPay] = useState({ amount: "", method: "Card", reference: "" });
  const [search, setSearch] = useState("");

  const r = reservations.find((x) => x.id === selected);
  const g = r ? guests.find((x) => x.id === r.guestId) : null;
  const ch = folios.filter((f) => f.reservationId === selected);
  const pys = payments.filter((p) => p.reservationId === selected);
  const total = ch.reduce((s, f) => s + f.amount, 0);
  const paid = pys.reduce((s, p) => s + p.amount, 0);
  const balance = total - paid;
  const gst = total * 0.18;

  const totalRev = folios.reduce((s, f) => s + f.amount, 0);
  const totalCollected = payments.reduce((s, p) => s + p.amount, 0);
  const openFolios = reservations.filter((x) => x.status === "checked_in").length;

  const visibleReservations = reservations.filter((x) =>
    ["checked_in", "checked_out"].includes(x.status) &&
    (guests.find((g) => g.id === x.guestId)?.name?.toLowerCase().includes(search.toLowerCase()) || x.code.toLowerCase().includes(search.toLowerCase()))
  );

  const paymentsByMethod = useMemo(() => {
    const groups: Record<string, number> = {};
    payments.forEach((p) => { groups[p.method] = (groups[p.method] ?? 0) + p.amount; });
    return Object.entries(groups).map(([method, amount]) => ({ method, amount }));
  }, [payments]);

  const aging = useMemo(() => reservations
    .filter((x) => x.status === "checked_out")
    .map((x) => {
      const t = folios.filter((f) => f.reservationId === x.id).reduce((s, f) => s + f.amount, 0);
      const p = payments.filter((y) => y.reservationId === x.id).reduce((s, y) => s + y.amount, 0);
      return { code: x.code, guest: guests.find((g) => g.id === x.guestId)?.name ?? "—", balance: t - p };
    })
    .filter((x) => x.balance > 0), [reservations, folios, payments, guests]);

  return (
    <>
      <PageHeader title="Billing & Finance" description="Folios, invoices, payments and accounts receivable" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="Total Revenue" value={fmtINR(totalRev)} tone="success" hint="All charges" />
        <Stat label="Collected" value={fmtINR(totalCollected)} tone="info" hint="Payments received" />
        <Stat label="Outstanding" value={fmtINR(totalRev - totalCollected)} tone={totalRev - totalCollected > 0 ? "warning" : "success"} hint="Uncollected" />
        <Stat label="Open Folios" value={openFolios} hint="Guests in-house" />
      </div>

      <Tabs defaultValue="folios">
        <TabsList className="mb-4">
          <TabsTrigger value="folios"><Receipt className="size-3.5 mr-1.5" />Guest Folios</TabsTrigger>
          <TabsTrigger value="payments"><CreditCard className="size-3.5 mr-1.5" />Payments</TabsTrigger>
          <TabsTrigger value="invoices"><FileText className="size-3.5 mr-1.5" />Invoices</TabsTrigger>
          <TabsTrigger value="aging">AR Aging</TabsTrigger>
        </TabsList>

        {/* Folios */}
        <TabsContent value="folios">
          <div className="grid grid-cols-12 gap-4">
            <Card className="col-span-4 p-3">
              <div className="relative mb-2">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8 h-8 text-xs" placeholder="Search guest or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 px-1">Folios</div>
              <div className="space-y-1 max-h-[540px] overflow-y-auto">
                {visibleReservations.map((x) => {
                  const xg = guests.find((z) => z.id === x.guestId);
                  const xtotal = folios.filter((f) => f.reservationId === x.id).reduce((s, f) => s + f.amount, 0);
                  const xpaid = payments.filter((p) => p.reservationId === x.id).reduce((s, p) => s + p.amount, 0);
                  const xbal = xtotal - xpaid;
                  return (
                    <button key={x.id} onClick={() => setSelected(x.id)}
                      className={`w-full text-left p-2 rounded text-sm transition-colors ${selected === x.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"}`}>
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-xs truncate">{xg?.name}</div>
                        <Badge className={`text-[9px] ml-1 shrink-0 ${xbal > 0 ? "bg-warning/15 text-warning-foreground" : "bg-success/15 text-success"}`}>
                          {xbal > 0 ? "Balance" : "Settled"}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">{x.code} · {fmtINR(xtotal)}</div>
                    </button>
                  );
                })}
                {visibleReservations.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-6">No folios found</div>
                )}
              </div>
            </Card>

            <Card className="col-span-8 p-5">
              {r && g ? (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold">{g.name}</h3>
                      <p className="text-xs text-muted-foreground">{r.code} · {r.checkIn} → {r.checkOut} · {r.roomId ? `Room` : "No room"}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.success("PDF downloaded")}>
                        <Download className="size-3.5" />PDF
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.success("Sent to printer")}>
                        <Printer className="size-3.5" />Print
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto mb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          {["Date", "Description", "Category", "Amount"].map((h) => (
                            <th key={h} className={`py-2 text-xs font-medium text-muted-foreground ${h === "Amount" ? "text-right" : "text-left"}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ch.map((f) => (
                          <tr key={f.id} className="border-b hover:bg-accent/5">
                            <td className="py-2 text-xs text-muted-foreground">{f.date}</td>
                            <td className="py-2">{f.description}</td>
                            <td className="py-2"><Badge variant="outline" className="text-[10px]">{f.category}</Badge></td>
                            <td className="py-2 text-right">{fmtINR(f.amount)}</td>
                          </tr>
                        ))}
                        {ch.length === 0 && (
                          <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-xs">No charges on this folio</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-1 text-sm border-t pt-3">
                    <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmtINR(total)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>GST (18%)</span><span>{fmtINR(Math.round(gst))}</span></div>
                    <div className="flex justify-between text-success"><span>Paid</span><span>{fmtINR(paid)}</span></div>
                    <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
                      <span>Balance Due</span>
                      <span className={balance > 0 ? "text-destructive" : "text-success"}>{fmtINR(balance)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Dialog open={chargeOpen} onOpenChange={setChargeOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5"><Plus className="size-3.5" />Add Charge</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader><DialogTitle>Add Charge</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div><Label className="text-xs">Description</Label><Input className="h-8 mt-1" placeholder="e.g. Room service dinner" value={charge.description} onChange={(e) => setCharge({ ...charge, description: e.target.value })} /></div>
                          <div><Label className="text-xs">Amount (₹)</Label><Input className="h-8 mt-1" type="number" placeholder="500" value={charge.amount} onChange={(e) => setCharge({ ...charge, amount: e.target.value })} /></div>
                          <div>
                            <Label className="text-xs">Category</Label>
                            <Select value={charge.category} onValueChange={(v) => setCharge({ ...charge, category: v })}>
                              <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>{CHARGE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setChargeOpen(false)}>Cancel</Button>
                          <Button disabled={!charge.description || !charge.amount}
                            onClick={() => { addCharge({ description: charge.description, amount: Number(charge.amount), category: charge.category as any, reservationId: r.id, date: new Date().toISOString().slice(0, 10) }); setChargeOpen(false); toast.success("Charge added"); setCharge({ description: "", amount: "", category: "F&B" }); }}>
                            Add
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    {balance > 0 && (
                      <Dialog open={payOpen} onOpenChange={setPayOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="gap-1.5"><CreditCard className="size-3.5" />Receive Payment</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-sm">
                          <DialogHeader><DialogTitle>Receive Payment</DialogTitle></DialogHeader>
                          <div className="space-y-3">
                            <div><Label className="text-xs">Amount (₹)</Label><Input className="h-8 mt-1" type="number" placeholder={String(balance)} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></div>
                            <div>
                              <Label className="text-xs">Payment Method</Label>
                              <div className="grid grid-cols-3 gap-1.5 mt-1">
                                {PAYMENT_METHODS.map((m) => (
                                  <button key={m} onClick={() => setPay({ ...pay, method: m })}
                                    className={`py-1.5 px-2 text-xs rounded border transition-colors ${pay.method === m ? "bg-primary text-primary-foreground border-primary" : "hover:border-muted-foreground/40"}`}>
                                    {m}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div><Label className="text-xs">Reference / TXN ID</Label><Input className="h-8 mt-1" placeholder="Optional" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
                            <Button onClick={() => { addPayment({ amount: Number(pay.amount) || balance, method: pay.method as any, reference: pay.reference, reservationId: r.id, date: new Date().toISOString().slice(0, 10) }); setPayOpen(false); toast.success("Payment recorded"); setPay({ amount: "", method: "Card", reference: "" }); }}>
                              Receive
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Receipt className="size-8 mb-2 opacity-30" />
                  <div className="text-sm">Select a folio from the list</div>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Payments */}
        <TabsContent value="payments">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <Card className="lg:col-span-2 p-5">
              <h3 className="font-semibold mb-4">Payments by Method</h3>
              <div className="h-52">
                <ResponsiveContainer>
                  <BarChart data={paymentsByMethod}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="method" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: number) => [fmtINR(v), "Amount"]} />
                    <Bar dataKey="amount" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Amount" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-5 space-y-3">
              <h3 className="font-semibold">Payment Summary</h3>
              {paymentsByMethod.map((p) => (
                <div key={p.method} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{p.method}</span>
                  <span className="font-medium">{fmtINR(p.amount)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-success">{fmtINR(totalCollected)}</span>
              </div>
            </Card>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Date", "Reservation", "Guest", "Method", "Reference", "Amount"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const res = reservations.find((x) => x.id === p.reservationId);
                    const guest = res ? guests.find((g) => g.id === res.guestId) : null;
                    return (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-accent/5">
                        <td className="px-4 py-3 text-xs text-muted-foreground">{p.date}</td>
                        <td className="px-4 py-3 font-mono text-xs">{res?.code}</td>
                        <td className="px-4 py-3">{guest?.name}</td>
                        <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{p.method}</Badge></td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.reference || "—"}</td>
                        <td className="px-4 py-3 font-medium text-success">{fmtINR(p.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Invoices */}
        <TabsContent value="invoices">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Invoice #", "Guest", "Check-out Date", "Room Nights", "Status", "Total", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reservations.filter((x) => x.status === "checked_out").map((x) => {
                    const xg = guests.find((z) => z.id === x.guestId);
                    const t = folios.filter((f) => f.reservationId === x.id).reduce((s, f) => s + f.amount, 0);
                    const nights = Math.max(1, Math.round((new Date(x.checkOut).getTime() - new Date(x.checkIn).getTime()) / 86400000));
                    return (
                      <tr key={x.id} className="border-b last:border-0 hover:bg-accent/5">
                        <td className="px-4 py-3 font-mono text-xs font-medium">INV-{x.code.slice(3)}</td>
                        <td className="px-4 py-3">{xg?.name}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{x.checkOut}</td>
                        <td className="px-4 py-3 text-center">{nights}</td>
                        <td className="px-4 py-3">
                          <Badge className="bg-success/15 text-success border-success/30 text-[10px]">Paid</Badge>
                        </td>
                        <td className="px-4 py-3 font-semibold">{fmtINR(t)}</td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={() => toast.success(`Invoice INV-${x.code.slice(3)} downloaded`)}>
                            <Download className="size-3" />PDF
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* AR Aging */}
        <TabsContent value="aging">
          {aging.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">No outstanding balances. All accounts settled.</Card>
          ) : (
            <Card>
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Accounts Receivable Aging</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{aging.length} checked-out folios with outstanding balance</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => toast.success("AR aging report exported")}>
                  <Download className="size-4" />Export
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {["Folio", "Guest", "Outstanding", "Action"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aging.map((a) => (
                      <tr key={a.code} className="border-b last:border-0 hover:bg-accent/5">
                        <td className="px-4 py-3 font-mono text-xs">{a.code}</td>
                        <td className="px-4 py-3">{a.guest}</td>
                        <td className="px-4 py-3 font-semibold text-destructive">{fmtINR(a.balance)}</td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                            onClick={() => toast.success(`Follow-up sent for ${a.code}`)}>
                            Send Reminder
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
