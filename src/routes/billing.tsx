import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Plus, Download, Printer, Search, Receipt, CreditCard, FileText, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  useBillingFolios,
  useBillingFolioDetail,
  useAddFolioCharge,
  useRecordFolioPayment,
  useBillingInvoices,
  useBillingTransactions,
  useGenerateInvoice,
  useEmailInvoice,
} from "@/lib/api/hooks";

const PAYMENT_METHODS = ["Card", "Cash", "UPI", "Bank Transfer", "Room Charge"] as const;
const CHARGE_CATEGORIES = ["Room", "F&B", "Spa", "Laundry", "Mini-bar", "Parking", "Internet", "Telephone", "Tax", "Other"];
const METHOD_MAP: Record<string, string> = {
  Card: "card", Cash: "cash", UPI: "upi", "Bank Transfer": "bank_transfer", "Room Charge": "room_charge",
};

export const Route = createFileRoute("/billing")({
  head: () => ({ meta: [{ title: "Billing & Finance · MHMS" }] }),
  component: Billing,
});

function Billing() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [charge, setCharge] = useState({ description: "", amount: "", category: "F&B", tax_pct: "18" });
  const [pay, setPay] = useState({ amount: "", method: "Card", notes: "" });

  const foliosQ = useBillingFolios({ search: search || undefined });
  const folios = foliosQ.data ?? [];
  const detail = useBillingFolioDetail(selected);
  const txQ = useBillingTransactions();
  const invQ = useBillingInvoices();
  const addCharge = useAddFolioCharge();
  const recordPayment = useRecordFolioPayment();
  const genInvoice = useGenerateInvoice();
  const emailInvoice = useEmailInvoice();

  const totalRev = useMemo(() => folios.reduce((s, f) => s + f.total_charges, 0), [folios]);
  const totalCollected = useMemo(() => folios.reduce((s, f) => s + f.total_paid, 0), [folios]);
  const openFolioCount = useMemo(() => folios.filter((f) => f.status === "open").length, [folios]);
  const aging = useMemo(() => folios.filter((f) => f.balance > 0), [folios]);

  const d = detail.data;
  const chargeAmt = Number(charge.amount) || 0;
  const taxAmt = Math.round(chargeAmt * (Number(charge.tax_pct) / 100) * 100) / 100;
  const txns = txQ.data ?? [];
  const invoices = invQ.data ?? [];

  const txByMethod = useMemo(() => {
    const groups: Record<string, number> = {};
    txns.forEach((t) => {
      const m = t.payment_method.replace(/_/g, " ");
      groups[m] = (groups[m] ?? 0) + t.amount;
    });
    return Object.entries(groups).map(([method, amount]) => ({ method, amount }));
  }, [txns]);

  const fmtDate = (iso: string) => (iso ? iso.slice(0, 10) : "—");
  const cap = (s: string) => (s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : s);

  return (
    <>
      <PageHeader title="Billing & Finance" description="Folios, invoices, payments and accounts receivable" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="Total Revenue" value={fmtINR(totalRev)} tone="success" hint="All charges" />
        <Stat label="Collected" value={fmtINR(totalCollected)} tone="info" hint="Payments received" />
        <Stat label="Outstanding" value={fmtINR(totalRev - totalCollected)} tone={totalRev - totalCollected > 0 ? "warning" : "success"} hint="Uncollected" />
        <Stat label="Open Folios" value={openFolioCount} hint="Guests in-house" />
      </div>

      <Tabs defaultValue="folios">
        <TabsList className="mb-4">
          <TabsTrigger value="folios"><Receipt className="size-3.5 mr-1.5" />Guest Folios</TabsTrigger>
          <TabsTrigger value="payments"><CreditCard className="size-3.5 mr-1.5" />Payments</TabsTrigger>
          <TabsTrigger value="invoices"><FileText className="size-3.5 mr-1.5" />Invoices</TabsTrigger>
          <TabsTrigger value="aging">AR Aging</TabsTrigger>
        </TabsList>

        {/* ── Folios ─────────────────────────────────────────────────── */}
        <TabsContent value="folios">
          <div className="grid grid-cols-12 gap-4">
            <Card className="col-span-4 p-3">
              <div className="relative mb-2">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8 h-8 text-xs" placeholder="Search guest…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 px-1">
                {foliosQ.isLoading ? "Loading…" : `${folios.length} Folios`}
              </div>
              <div className="space-y-1 max-h-[540px] overflow-y-auto">
                {foliosQ.isLoading && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {folios.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelected(f.id)}
                    className={`w-full text-left p-2 rounded text-sm transition-colors ${selected === f.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-xs truncate">{f.guest_name || "Unknown Guest"}</div>
                      <Badge className={`text-[9px] ml-1 shrink-0 ${f.balance > 0 ? "bg-warning/15 text-warning-foreground" : "bg-success/15 text-success"}`}>
                        {f.balance > 0 ? "Balance" : "Settled"}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {f.room_number ? `Room ${f.room_number}` : "—"} · {fmtINR(f.total_charges)} · <span className="capitalize">{f.status}</span>
                    </div>
                  </button>
                ))}
                {!foliosQ.isLoading && folios.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-6">No folios found</div>
                )}
              </div>
            </Card>

            <Card className="col-span-8 p-5">
              {d ? (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold">{d.guest_name || "Unknown Guest"}</h3>
                      <p className="text-xs text-muted-foreground">
                        {d.room_number ? `Room ${d.room_number}` : "No room"} · {fmtDate(d.created_at)}
                        {d.closed_at ? ` → ${fmtDate(d.closed_at)}` : ""}
                      </p>
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
                          {["Date", "Description", "Type", "Amount", "Tax"].map((h) => (
                            <th key={h} className={`py-2 text-xs font-medium text-muted-foreground ${h === "Amount" || h === "Tax" ? "text-right" : "text-left"}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.isLoading ? (
                          <tr><td colSpan={5} className="py-6 text-center"><Loader2 className="size-4 animate-spin mx-auto text-muted-foreground" /></td></tr>
                        ) : (
                          d.charges.map((c) => (
                            <tr key={c.id} className="border-b hover:bg-accent/5">
                              <td className="py-2 text-xs text-muted-foreground">{fmtDate(c.posted_at)}</td>
                              <td className="py-2">{c.description}</td>
                              <td className="py-2"><Badge variant="outline" className="text-[10px]">{cap(c.charge_type ?? "other")}</Badge></td>
                              <td className="py-2 text-right">{fmtINR(c.amount)}</td>
                              <td className="py-2 text-right text-muted-foreground">{fmtINR(c.tax_amount)}</td>
                            </tr>
                          ))
                        )}
                        {!detail.isLoading && d.charges.length === 0 && (
                          <tr><td colSpan={5} className="text-center py-6 text-muted-foreground text-xs">No charges on this folio</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-1 text-sm border-t pt-3">
                    <div className="flex justify-between text-muted-foreground"><span>Charges</span><span>{fmtINR(d.total_charges)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>{fmtINR(d.total_tax ?? 0)}</span></div>
                    <div className="flex justify-between text-success"><span>Paid</span><span>{fmtINR(d.total_paid)}</span></div>
                    <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
                      <span>Balance Due</span>
                      <span className={d.balance > 0 ? "text-destructive" : "text-success"}>{fmtINR(d.balance)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 flex-wrap">
                    <Dialog open={chargeOpen} onOpenChange={setChargeOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5"><Plus className="size-3.5" />Add Charge</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader><DialogTitle>Add Charge</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs">Description</Label>
                            <Input className="h-8 mt-1" placeholder="e.g. Room service dinner" value={charge.description} onChange={(e) => setCharge({ ...charge, description: e.target.value })} />
                          </div>
                          <div>
                            <Label className="text-xs">Amount (₹)</Label>
                            <Input className="h-8 mt-1" type="number" placeholder="500" value={charge.amount} onChange={(e) => setCharge({ ...charge, amount: e.target.value })} />
                          </div>
                          <div>
                            <Label className="text-xs">GST %</Label>
                            <Select value={charge.tax_pct} onValueChange={(v) => setCharge({ ...charge, tax_pct: v })}>
                              <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["0", "5", "12", "18", "28"].map((p) => <SelectItem key={p} value={p}>{p}%</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Category</Label>
                            <Select value={charge.category} onValueChange={(v) => setCharge({ ...charge, category: v })}>
                              <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>{CHARGE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          {chargeAmt > 0 && (
                            <p className="text-xs text-muted-foreground">Total with GST: {fmtINR(chargeAmt + taxAmt)}</p>
                          )}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setChargeOpen(false)}>Cancel</Button>
                          <Button
                            disabled={!charge.description || !charge.amount || addCharge.isPending}
                            onClick={() => {
                              if (!selected) return;
                              addCharge.mutate(
                                { folioId: selected, description: charge.description, charge_type: charge.category.toLowerCase(), amount: chargeAmt, tax_amount: taxAmt },
                                {
                                  onSuccess: () => {
                                    setChargeOpen(false);
                                    toast.success("Charge added");
                                    setCharge({ description: "", amount: "", category: "F&B", tax_pct: "18" });
                                  },
                                  onError: (e: any) => toast.error(e.message ?? "Failed to add charge"),
                                }
                              );
                            }}
                          >
                            {addCharge.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Add"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {d.balance > 0 && (
                      <Dialog open={payOpen} onOpenChange={setPayOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="gap-1.5"><CreditCard className="size-3.5" />Receive Payment</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-sm">
                          <DialogHeader><DialogTitle>Receive Payment</DialogTitle></DialogHeader>
                          <div className="space-y-3">
                            <div>
                              <Label className="text-xs">Amount (₹)</Label>
                              <Input className="h-8 mt-1" type="number" placeholder={String(Math.round(d.balance))} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
                            </div>
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
                            <div>
                              <Label className="text-xs">Notes (optional)</Label>
                              <Input className="h-8 mt-1" placeholder="TXN reference…" value={pay.notes} onChange={(e) => setPay({ ...pay, notes: e.target.value })} />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
                            <Button
                              disabled={recordPayment.isPending}
                              onClick={() => {
                                if (!selected) return;
                                recordPayment.mutate(
                                  { folioId: selected, amount: Number(pay.amount) || d.balance, payment_method: METHOD_MAP[pay.method] ?? "cash", notes: pay.notes || undefined },
                                  {
                                    onSuccess: () => {
                                      setPayOpen(false);
                                      toast.success("Payment recorded");
                                      setPay({ amount: "", method: "Card", notes: "" });
                                    },
                                    onError: (e: any) => toast.error(e.message ?? "Failed to record payment"),
                                  }
                                );
                              }}
                            >
                              {recordPayment.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Receive"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}

                    {d.status === "open" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={genInvoice.isPending}
                        onClick={() => genInvoice.mutate({ folio_id: selected! }, { onSuccess: () => toast.success("Invoice generated") })}
                      >
                        {genInvoice.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <><FileText className="size-3.5" />Generate Invoice</>}
                      </Button>
                    )}
                  </div>
                </>
              ) : detail.isLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <Loader2 className="size-8 animate-spin text-muted-foreground mb-2" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Receipt className="size-8 mb-2 opacity-30" />
                  <div className="text-sm">Select a folio from the list</div>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* ── Payments ───────────────────────────────────────────────── */}
        <TabsContent value="payments">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <Card className="lg:col-span-2 p-5">
              <h3 className="font-semibold mb-4">Payments by Method</h3>
              <div className="h-52">
                {txByMethod.length > 0 ? (
                  <ResponsiveContainer>
                    <BarChart data={txByMethod}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="method" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip formatter={(v: number) => [fmtINR(v), "Amount"]} />
                      <Bar dataKey="amount" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Amount" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No payment data yet</div>
                )}
              </div>
            </Card>
            <Card className="p-5 space-y-3">
              <h3 className="font-semibold">Payment Summary</h3>
              {txByMethod.map((p) => (
                <div key={p.method} className="flex justify-between text-sm">
                  <span className="text-muted-foreground capitalize">{p.method}</span>
                  <span className="font-medium">{fmtINR(p.amount)}</span>
                </div>
              ))}
              {txByMethod.length === 0 && <div className="text-xs text-muted-foreground">No transactions yet</div>}
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-success">{fmtINR(txns.reduce((s, t) => s + t.amount, 0))}</span>
              </div>
            </Card>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Date", "Payment #", "Guest", "Room", "Method", "Status", "Amount"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txQ.isLoading ? (
                    <tr><td colSpan={7} className="py-8 text-center"><Loader2 className="size-4 animate-spin mx-auto text-muted-foreground" /></td></tr>
                  ) : txns.map((t) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-accent/5">
                      <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(t.created_at)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{t.payment_number}</td>
                      <td className="px-4 py-3">{t.guest_name || "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{t.room_number || "—"}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{cap(t.payment_method)}</Badge></td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] ${t.status === "completed" ? "bg-success/15 text-success" : "bg-warning/15 text-warning-foreground"}`}>{cap(t.status)}</Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-success">{fmtINR(t.amount)}</td>
                    </tr>
                  ))}
                  {!txQ.isLoading && txns.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-xs">No transactions recorded</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ── Invoices ───────────────────────────────────────────────── */}
        <TabsContent value="invoices">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Invoice #", "Guest", "Date", "Status", "Total", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invQ.isLoading ? (
                    <tr><td colSpan={6} className="py-8 text-center"><Loader2 className="size-4 animate-spin mx-auto text-muted-foreground" /></td></tr>
                  ) : invoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-accent/5">
                      <td className="px-4 py-3 font-mono text-xs font-medium">{inv.invoice_number}</td>
                      <td className="px-4 py-3">{inv.guest_name}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(inv.created_at)}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] ${
                          inv.status === "paid" ? "bg-success/15 text-success border-success/30" :
                          inv.status === "sent" ? "bg-info/15 text-info border-info/30" :
                          "bg-muted text-muted-foreground"
                        }`}>{cap(inv.status)}</Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold">{fmtINR(inv.total)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={() => toast.success("Invoice downloaded")}>
                            <Download className="size-3" />PDF
                          </Button>
                          {inv.status === "draft" && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                              disabled={emailInvoice.isPending}
                              onClick={() => emailInvoice.mutate(inv.id, { onSuccess: () => toast.success("Invoice emailed to guest") })}>
                              Email
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!invQ.isLoading && invoices.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-10 text-muted-foreground text-xs">No invoices yet. Generate one from a folio.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ── AR Aging ───────────────────────────────────────────────── */}
        <TabsContent value="aging">
          {aging.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              {foliosQ.isLoading ? <Loader2 className="size-6 animate-spin mx-auto" /> : "No outstanding balances. All accounts settled."}
            </Card>
          ) : (
            <Card>
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Accounts Receivable Aging</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{aging.length} folios with outstanding balance</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => toast.success("AR aging report exported")}>
                  <Download className="size-4" />Export
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {["Guest", "Room", "Charges", "Paid", "Outstanding", "Action"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aging.map((f) => (
                      <tr key={f.id} className="border-b last:border-0 hover:bg-accent/5">
                        <td className="px-4 py-3 font-medium">{f.guest_name || "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{f.room_number || "—"}</td>
                        <td className="px-4 py-3">{fmtINR(f.total_charges)}</td>
                        <td className="px-4 py-3 text-success">{fmtINR(f.total_paid)}</td>
                        <td className="px-4 py-3 font-semibold text-destructive">{fmtINR(f.balance)}</td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                            onClick={() => toast.success(`Follow-up sent for ${f.guest_name}`)}>
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
