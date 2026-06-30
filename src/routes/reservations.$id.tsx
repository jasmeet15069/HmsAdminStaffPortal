import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, resStatusMeta, fmtINR } from "@/lib/mhms-store";
import type { FolioCharge, Payment } from "@/lib/mhms-store";
import { isAuthenticated } from "@/lib/api/auth";
import {
  useReservationDetail,
  useUpdateReservation,
  useCancelReservation,
  useCheckIn,
  useCheckOut,
  useBillingFolios,
  useBillingFolioDetail,
  useAddFolioCharge,
  useRecordFolioPayment,
  useGenerateInvoice,
  useEmailInvoice,
} from "@/lib/api/hooks";
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
import {
  ArrowLeft, LogIn, LogOut, Plus, Printer, X, FileText, Loader2, CreditCard, Mail,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { printHTML } from "@/lib/csv";

export const Route = createFileRoute("/reservations/$id")({
  head: () => ({ meta: [{ title: "Reservation · MHMS" }] }),
  component: ReservationDetail,
});

const CHARGE_CATEGORIES = ["Room", "F&B", "Spa", "Laundry", "Mini-bar", "Parking", "Internet", "Telephone", "Tax", "Other"];
const PAYMENT_METHODS = ["Card", "Cash", "UPI", "Bank Transfer"];
const METHOD_MAP: Record<string, string> = {
  Card: "card", Cash: "cash", UPI: "upi", "Bank Transfer": "bank_transfer",
};

function ReservationDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const authed = isAuthenticated();

  // API hooks — all called unconditionally at top level
  const detailQ = useReservationDetail(authed ? id : null);
  const foliosQ = useBillingFolios();
  const checkInM = useCheckIn();
  const checkOutM = useCheckOut();
  const cancelM = useCancelReservation();
  const updateM = useUpdateReservation();
  const addChargeM = useAddFolioCharge();
  const recordPayM = useRecordFolioPayment();
  const genInvoiceM = useGenerateInvoice();
  const emailInvoiceM = useEmailInvoice();

  // Find this reservation's folio from the list; then fetch its details
  const folio = useMemo(
    () => foliosQ.data?.find((f) => f.booking_id === id) ?? null,
    [foliosQ.data, id]
  );
  const folioDetailQ = useBillingFolioDetail(authed && folio ? folio.id : null);

  // Demo store fallback
  const {
    reservations, guests, rooms, folios: demoFolios, payments: demoPays,
    addCharge, addPayment, checkIn, checkOut, cancelReservation, updateReservation,
  } = useMHMS();

  // Dialog state
  const [chargeOpen, setChargeOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [charge, setCharge] = useState({ description: "", amount: "", category: "F&B", tax_pct: "18" });
  const [pay, setPay] = useState({ amount: "", method: "Card", reference: "" });

  // ── LIVE MODE ──────────────────────────────────────────────────────────────
  if (authed) {
    if (detailQ.isLoading) {
      return (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    const r = detailQ.data;
    if (!r) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Reservation not found</p>
          <Button asChild><Link to="/reservations">Back</Link></Button>
        </div>
      );
    }

    const fd = folioDetailQ.data;
    const charges = fd?.charges ?? [];
    const livePays = fd?.payments ?? [];
    const total = fd?.total_charges ?? folio?.total_charges ?? 0;
    const paid = fd?.total_paid ?? folio?.total_paid ?? 0;
    const balance = fd?.balance ?? folio?.balance ?? 0;
    const nights = r.nights ?? 1;
    const chargeAmt = Number(charge.amount) || 0;
    const taxAmt = Math.round(chargeAmt * (Number(charge.tax_pct) / 100) * 100) / 100;

    const statusColor: Record<string, string> = {
      upcoming: "bg-info/15 text-info border-info/30",
      pending_checkin: "bg-warning/20 text-warning-foreground border-warning/40",
      in_house: "bg-success/15 text-success border-success/30",
      checked_out: "bg-muted text-muted-foreground",
    };

    const printInvoice = () => {
      const rowsHTML = charges.map((c) =>
        `<tr><td>${c.posted_at?.slice(0, 10) ?? "—"}</td><td>${c.description}</td><td>${c.charge_type ?? "other"}</td><td class="right">${fmtINR(c.amount)}</td><td class="right">${fmtINR(c.tax_amount)}</td></tr>`
      ).join("");
      const paysHTML = livePays.map((p) =>
        `<tr><td>${p.created_at?.slice(0, 10) ?? "—"}</td><td>${p.method}</td><td>${p.notes ?? ""}</td><td class="right">${fmtINR(p.amount)}</td></tr>`
      ).join("");
      printHTML(`Reservation ${r.id.slice(0, 8).toUpperCase()}`, `
        <div class="brand">
          <div><h1>Hotel Harmony</h1></div>
          <div style="text-align:right"><h1>INVOICE</h1><div class="muted">${r.check_in_date?.slice(0, 10)} → ${r.check_out_date?.slice(0, 10)}</div></div>
        </div>
        <h2>Bill To</h2>
        <div><strong>${r.guest_name}</strong><br>${r.guest_email ?? ""} ${r.guest_phone ? `· ${r.guest_phone}` : ""}</div>
        <h2>Stay Details</h2>
        <table><tr><th>Room</th><th>Type</th><th>Check-in</th><th>Check-out</th><th>Nights</th></tr>
        <tr><td>${r.room_number}</td><td>${r.room_type}</td><td>${r.check_in_date?.slice(0, 10)}</td><td>${r.check_out_date?.slice(0, 10)}</td><td>${nights}</td></tr></table>
        <h2>Charges</h2>
        <table><tr><th>Date</th><th>Description</th><th>Type</th><th class="right">Amount</th><th class="right">Tax</th></tr>${rowsHTML}</table>
        <h2>Payments</h2>
        <table><tr><th>Date</th><th>Method</th><th>Ref</th><th class="right">Amount</th></tr>${paysHTML || `<tr><td colspan="4" class="muted">No payments</td></tr>`}</table>
        <div class="totals">
          <div class="row"><span>Total Charges</span><span>${fmtINR(total)}</span></div>
          <div class="row"><span>Paid</span><span>${fmtINR(paid)}</span></div>
          <div class="row grand"><span>Balance Due</span><span>${fmtINR(balance)}</span></div>
        </div>
      `);
    };

    return (
      <>
        <PageHeader
          title={`Reservation · ${r.room_number} · ${r.guest_name}`}
          description={`${r.check_in_date?.slice(0, 10)} → ${r.check_out_date?.slice(0, 10)} · ${nights} nights`}
          actions={
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => nav({ to: "/reservations" })}>
                <ArrowLeft className="size-4" /> Back
              </Button>
              <Button variant="outline" onClick={printInvoice}>
                <Printer className="size-4" /> Print Invoice
              </Button>
              {r.status === "pending_checkin" || r.status === "upcoming" ? (
                <>
                  <Button
                    disabled={checkInM.isPending}
                    onClick={() => checkInM.mutate(id, {
                      onSuccess: () => { toast.success("Checked in"); detailQ.refetch(); },
                      onError: (e: any) => toast.error(e.message ?? "Check-in failed"),
                    })}
                  >
                    {checkInM.isPending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                    Check In
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={cancelM.isPending}
                    onClick={() => cancelM.mutate(id, {
                      onSuccess: () => { toast.success("Reservation cancelled"); nav({ to: "/reservations" }); },
                      onError: (e: any) => toast.error(e.message ?? "Cancel failed"),
                    })}
                  >
                    {cancelM.isPending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                    Cancel
                  </Button>
                </>
              ) : r.status === "in_house" ? (
                <Button
                  disabled={checkOutM.isPending}
                  onClick={() => checkOutM.mutate(id, {
                    onSuccess: () => { toast.success("Checked out"); detailQ.refetch(); },
                    onError: (e: any) => toast.error(e.message ?? "Check-out failed"),
                  })}
                >
                  {checkOutM.isPending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                  Check Out
                </Button>
              ) : null}
            </div>
          }
        />

        <div className="grid grid-cols-12 gap-4 mb-6">
          <Card className="col-span-12 lg:col-span-8 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">{r.guest_name}</h3>
                <div className="text-sm text-muted-foreground">
                  {r.guest_email && <span>{r.guest_email}</span>}
                  {r.guest_phone && <span> · {r.guest_phone}</span>}
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded border ${statusColor[r.status] ?? "bg-muted text-muted-foreground"}`}>
                {r.status.replace(/_/g, " ")}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <KV label="Room" v={`${r.room_number} · ${r.room_type}`} />
              <KV label="Nights" v={nights} />
              <KV label="Check-in" v={r.check_in_date?.slice(0, 10)} />
              <KV label="Check-out" v={r.check_out_date?.slice(0, 10)} />
              <KV label="Source" v={r.source ?? "Direct"} />
              <KV label="Total Amount" v={fmtINR(r.total_amount ?? 0)} />
            </div>

            {/* Modify booking */}
            <div className="mt-4">
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm"><FileText className="size-4 mr-1" /> Modify Booking</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Modify Reservation</DialogTitle></DialogHeader>
                  <ModifyForm
                    defaultCheckIn={r.check_in_date?.slice(0, 10)}
                    defaultCheckOut={r.check_out_date?.slice(0, 10)}
                    onSave={(vals) => {
                      updateM.mutate(
                        { id, patch: { check_in_date: vals.checkIn, check_out_date: vals.checkOut, notes: vals.notes } },
                        {
                          onSuccess: () => { toast.success("Reservation updated"); setEditOpen(false); detailQ.refetch(); },
                          onError: (e: any) => toast.error(e.message ?? "Update failed"),
                        }
                      );
                    }}
                    isPending={updateM.isPending}
                    onClose={() => setEditOpen(false)}
                  />
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
            <TabsTrigger value="folio">Folio ({charges.length})</TabsTrigger>
            <TabsTrigger value="pays">Payments ({livePays.length})</TabsTrigger>
          </TabsList>

          {/* Folio */}
          <TabsContent value="folio">
            <Card className="p-4 mt-4">
              {folioDetailQ.isLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!folioDetailQ.isLoading && folio && (
                <>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {/* Add Charge */}
                    <Dialog open={chargeOpen} onOpenChange={setChargeOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline"><Plus className="size-3.5 mr-1" /> Add Charge</Button>
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
                              <SelectContent>{["0", "5", "12", "18", "28"].map((p) => <SelectItem key={p} value={p}>{p}%</SelectItem>)}</SelectContent>
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
                            disabled={!charge.description || !charge.amount || addChargeM.isPending}
                            onClick={() => {
                              addChargeM.mutate(
                                { folioId: folio.id, description: charge.description, charge_type: charge.category.toLowerCase(), amount: chargeAmt, tax_amount: taxAmt },
                                {
                                  onSuccess: () => { setChargeOpen(false); toast.success("Charge added"); setCharge({ description: "", amount: "", category: "F&B", tax_pct: "18" }); },
                                  onError: (e: any) => toast.error(e.message ?? "Failed to add charge"),
                                }
                              );
                            }}
                          >
                            {addChargeM.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Add"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Receive Payment */}
                    {balance > 0 && (
                      <Dialog open={payOpen} onOpenChange={setPayOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm"><CreditCard className="size-3.5 mr-1" /> Receive Payment</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-sm">
                          <DialogHeader><DialogTitle>Receive Payment</DialogTitle></DialogHeader>
                          <div className="space-y-3">
                            <div>
                              <Label className="text-xs">Amount (₹)</Label>
                              <Input className="h-8 mt-1" type="number" placeholder={String(Math.round(balance))} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
                            </div>
                            <div>
                              <Label className="text-xs">Method</Label>
                              <div className="grid grid-cols-2 gap-1.5 mt-1">
                                {PAYMENT_METHODS.map((m) => (
                                  <button key={m} onClick={() => setPay({ ...pay, method: m })}
                                    className={`py-1.5 px-2 text-xs rounded border transition-colors ${pay.method === m ? "bg-primary text-primary-foreground border-primary" : "hover:border-muted-foreground/40"}`}>
                                    {m}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">Reference / TXN ID</Label>
                              <Input className="h-8 mt-1" placeholder="TXN reference" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
                            <Button
                              disabled={recordPayM.isPending}
                              onClick={() => {
                                recordPayM.mutate(
                                  { folioId: folio.id, amount: Number(pay.amount) || balance, payment_method: METHOD_MAP[pay.method] ?? "cash", notes: pay.reference || undefined },
                                  {
                                    onSuccess: () => { setPayOpen(false); toast.success("Payment recorded"); setPay({ amount: "", method: "Card", reference: "" }); },
                                    onError: (e: any) => toast.error(e.message ?? "Payment failed"),
                                  }
                                );
                              }}
                            >
                              {recordPayM.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Receive"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}

                    {/* Generate Invoice */}
                    {folio.status === "open" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={genInvoiceM.isPending}
                        onClick={() => genInvoiceM.mutate(
                          { folio_id: folio.id },
                          {
                            onSuccess: () => toast.success("Invoice generated"),
                            onError: (e: any) => toast.error(e.message ?? "Failed to generate invoice"),
                          }
                        )}
                      >
                        {genInvoiceM.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5 mr-1" />}
                        Generate Invoice
                      </Button>
                    )}
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Tax</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {charges.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="text-xs text-muted-foreground">{c.posted_at?.slice(0, 10) ?? "—"}</TableCell>
                          <TableCell>{c.description}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{c.charge_type ?? "other"}</Badge></TableCell>
                          <TableCell className="text-right">{fmtINR(c.amount)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{fmtINR(c.tax_amount)}</TableCell>
                        </TableRow>
                      ))}
                      {charges.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No charges on this folio.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  <div className="flex justify-end border-t pt-3 mt-3 text-sm">
                    <div className="w-64 space-y-1">
                      <div className="flex justify-between"><span>Charges</span><span>{fmtINR(total)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>{fmtINR(fd?.total_tax ?? 0)}</span></div>
                      <div className="flex justify-between text-success"><span>Paid</span><span>{fmtINR(paid)}</span></div>
                      <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                        <span>Balance</span>
                        <span className={balance > 0 ? "text-destructive" : "text-success"}>{fmtINR(balance)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {!folioDetailQ.isLoading && !folio && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No folio found for this reservation. Charges are created automatically on check-in.
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Payments */}
          <TabsContent value="pays">
            <Card className="p-4 mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {livePays.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs text-muted-foreground">{p.created_at?.slice(0, 10) ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{p.method}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{p.notes ?? "—"}</TableCell>
                      <TableCell>
                        <Badge className={p.status === "completed" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-success">{fmtINR(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                  {livePays.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No payments recorded.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </>
    );
  }

  // ── DEMO MODE ──────────────────────────────────────────────────────────────
  const r = reservations.find((x) => x.id === id);
  const g = r ? guests.find((x) => x.id === r.guestId) : null;
  const rm = r ? rooms.find((x) => x.id === r.roomId) : null;
  const [demoEdit, setDemoEdit] = useState({ checkIn: r?.checkIn ?? "", checkOut: r?.checkOut ?? "", notes: r?.notes ?? "" });
  const [editOpen2, setEditOpen2] = useState(false);

  if (!r || !g || !rm) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Reservation not found</p>
        <Button asChild><Link to="/reservations">Back</Link></Button>
      </div>
    );
  }

  const myCharges = demoFolios.filter((f) => f.reservationId === r.id);
  const myPays = demoPays.filter((p) => p.reservationId === r.id);
  const total = myCharges.reduce((s, f) => s + f.amount, 0);
  const paid = myPays.reduce((s, p) => s + p.amount, 0);
  const balance = total - paid;
  const nights = Math.max(1, Math.round((+new Date(r.checkOut) - +new Date(r.checkIn)) / 86400000));

  const printInvoiceDemo = () => {
    const rowsHTML = myCharges.map((f) => `<tr><td>${f.date}</td><td>${f.description}</td><td>${f.category}</td><td class="right">${fmtINR(f.amount)}</td></tr>`).join("");
    const paysHTML = myPays.map((p) => `<tr><td>${p.date}</td><td>${p.method}</td><td>${p.reference ?? ""}</td><td class="right">${fmtINR(p.amount)}</td></tr>`).join("");
    printHTML(`Invoice ${r.code}`, `
      <div class="brand"><div><h1>Hotel Harmony</h1></div><div style="text-align:right"><h1>INVOICE</h1></div></div>
      <h2>Bill To</h2><div><strong>${g.name}</strong><br>${g.email} · ${g.phone}</div>
      <h2>Stay</h2>
      <table><tr><th>Reservation</th><th>Room</th><th>Check-in</th><th>Check-out</th><th>Nights</th></tr>
      <tr><td>${r.code}</td><td>${rm.number} (${rm.type})</td><td>${r.checkIn}</td><td>${r.checkOut}</td><td>${nights}</td></tr></table>
      <h2>Charges</h2>
      <table><tr><th>Date</th><th>Description</th><th>Category</th><th class="right">Amount</th></tr>${rowsHTML}</table>
      <h2>Payments</h2>
      <table><tr><th>Date</th><th>Method</th><th>Reference</th><th class="right">Amount</th></tr>${paysHTML || `<tr><td colspan="4" class="muted">No payments</td></tr>`}</table>
      <div class="totals">
        <div class="row"><span>Total</span><span>${fmtINR(total)}</span></div>
        <div class="row"><span>Paid</span><span>${fmtINR(paid)}</span></div>
        <div class="row grand"><span>Balance Due</span><span>${fmtINR(balance)}</span></div>
      </div>
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
            <Button variant="outline" onClick={printInvoiceDemo}><Printer className="size-4" /> Print Invoice</Button>
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
                <span className={`text-xs px-2 py-0.5 rounded border ${resStatusMeta[r.status]?.color ?? ""}`}>{resStatusMeta[r.status]?.label ?? r.status}</span>
              </div>
              <div className="text-sm text-muted-foreground">{g.email} · {g.phone}</div>
            </div>
            <div className="flex gap-2">
              {r.status === "confirmed" && <Button onClick={() => { checkIn(r.id); toast.success("Checked in"); }}><LogIn className="size-4" /> Check In</Button>}
              {r.status === "checked_in" && <Button onClick={() => { checkOut(r.id); toast.success("Checked out"); }}><LogOut className="size-4" /> Check Out</Button>}
              {(r.status === "confirmed" || r.status === "pending") && (
                <Button variant="destructive" onClick={() => { cancelReservation(r.id); toast.success("Cancelled"); }}>
                  <X className="size-4" /> Cancel
                </Button>
              )}
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
            <Dialog open={editOpen2} onOpenChange={setEditOpen2}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><FileText className="size-4 mr-1" /> Modify Booking</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Modify Reservation</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Check-in</Label><Input type="date" className="mt-1" value={demoEdit.checkIn} onChange={(e) => setDemoEdit({ ...demoEdit, checkIn: e.target.value })} /></div>
                    <div><Label>Check-out</Label><Input type="date" className="mt-1" value={demoEdit.checkOut} onChange={(e) => setDemoEdit({ ...demoEdit, checkOut: e.target.value })} /></div>
                  </div>
                  <div><Label>Notes</Label><Textarea className="mt-1" value={demoEdit.notes} onChange={(e) => setDemoEdit({ ...demoEdit, notes: e.target.value })} /></div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditOpen2(false)}>Cancel</Button>
                  <Button onClick={() => { updateReservation(r.id, demoEdit); setEditOpen2(false); toast.success("Reservation updated"); }}>Save</Button>
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
                <DialogTrigger asChild><Button size="sm"><Plus className="size-4" /> Add Charge</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Charge</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Description</Label><Input className="mt-1" value={charge.description} onChange={(e) => setCharge({ ...charge, description: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Amount (₹)</Label><Input className="mt-1" type="number" value={charge.amount} onChange={(e) => setCharge({ ...charge, amount: e.target.value })} /></div>
                      <div><Label>Category</Label>
                        <Select value={charge.category} onValueChange={(v) => setCharge({ ...charge, category: v })}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>{CHARGE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setChargeOpen(false)}>Cancel</Button>
                    <Button onClick={() => {
                      addCharge({ ...charge, amount: Number(charge.amount), reservationId: r.id, date: new Date().toISOString().slice(0, 10), category: charge.category as FolioCharge["category"] });
                      setChargeOpen(false);
                      setCharge({ description: "", amount: "", category: "F&B", tax_pct: "18" });
                      toast.success("Charge added");
                    }}>Add</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={payOpen} onOpenChange={setPayOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline"><CreditCard className="size-4 mr-1" /> Receive Payment</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Receive Payment</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Amount (₹)</Label><Input className="mt-1" type="number" value={pay.amount || String(balance)} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></div>
                    <div><Label>Method</Label>
                      <Select value={pay.method} onValueChange={(v) => setPay({ ...pay, method: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Reference</Label><Input className="mt-1" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} placeholder="TXN ID" /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
                    <Button onClick={() => {
                      addPayment({ amount: Number(pay.amount) || balance, method: pay.method as Payment["method"], reference: pay.reference || ("TXN" + Date.now()), reservationId: r.id, date: new Date().toISOString().slice(0, 10) });
                      setPayOpen(false);
                      setPay({ amount: "", method: "Card", reference: "" });
                      toast.success("Payment recorded");
                    }}>Receive</Button>
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
                {myCharges.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No charges yet.</TableCell></TableRow>}
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
                {myPays.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No payments yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="notes">
          <Card className="p-5 mt-4 text-sm whitespace-pre-wrap min-h-[120px]">
            {r.notes || <span className="text-muted-foreground">No notes. Use "Modify Booking" to add.</span>}
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function KV({ label, v }: { label: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className="font-medium mt-0.5">{v}</div>
    </div>
  );
}

function ModifyForm({
  defaultCheckIn,
  defaultCheckOut,
  onSave,
  isPending,
  onClose,
}: {
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  onSave: (vals: { checkIn: string; checkOut: string; notes: string }) => void;
  isPending: boolean;
  onClose: () => void;
}) {
  const [vals, setVals] = useState({ checkIn: defaultCheckIn ?? "", checkOut: defaultCheckOut ?? "", notes: "" });
  return (
    <>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Check-in</Label><Input type="date" className="mt-1" value={vals.checkIn} onChange={(e) => setVals({ ...vals, checkIn: e.target.value })} /></div>
          <div><Label>Check-out</Label><Input type="date" className="mt-1" value={vals.checkOut} onChange={(e) => setVals({ ...vals, checkOut: e.target.value })} /></div>
        </div>
        <div><Label>Notes</Label><Textarea className="mt-1" value={vals.notes} onChange={(e) => setVals({ ...vals, notes: e.target.value })} /></div>
      </div>
      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={isPending} onClick={() => onSave(vals)}>
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}
