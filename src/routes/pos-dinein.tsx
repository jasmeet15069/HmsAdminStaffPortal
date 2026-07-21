import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Send, ChefHat, Receipt, Printer, DoorClosed, ArrowLeft, Trash2, Wallet, Ban,
} from "lucide-react";

import { PageHeader } from "@/components/AppShell";
import { apiFetch, getAccessToken } from "@/lib/api/client";
import { isAuthenticated } from "@/lib/api/auth";
import { fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/pos-dinein")({
  head: () => ({ meta: [{ title: "POS Dine-In · MHMS" }] }),
  component: PosDineIn,
});

type Outlet = { id: string; name: string; default_tax_rate: number };
type TableT = { id: string; outlet_id: string | null; table_number: string; seats: number; status: string; section: string | null };
type KOTItem = { id: string; item_name: string; quantity: number; unit_price: number; line_total: number; status: string; void_reason: string | null };
type KOT = { id: string; kot_number: string; round_no: number; status: string; items: KOTItem[] };
type Bill = {
  id: string; bill_number: string; status: string; subtotal: number; discount_type: string | null;
  discount_value: number; discount_amount: number; tax_rate: number; tax_amount: number;
  tip_type: string | null; tip_value: number; tip_amount: number; total_amount: number;
  amount_paid: number; amount_due: number; currency: string;
};
type SessionDetail = {
  id: string; session_number: string; table_id: string; covers: number; status: string;
  guest_name: string | null; kots: KOT[]; bill: Bill | null;
};
type BillSplit = { id: string; split_no: number; customer_name: string; amount: number };

const TABLE_COLORS: Record<string, string> = {
  available: "border-green-600 bg-green-50",
  occupied: "border-amber-600 bg-amber-50",
  billed: "border-blue-600 bg-blue-50",
  cleaning: "border-gray-500 bg-gray-100",
  reserved: "border-purple-600 bg-purple-50",
  out_of_service: "border-red-600 bg-red-50",
};

async function openInvoice(billId: string, splitId?: string) {
  const token = getAccessToken();
  let res: Response;
  try {
    res = await fetch(`/api/pos/bills/${billId}/invoice${splitId ? `?split=${splitId}` : ""}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) { toast.error("Invoice not available"); return; }
  } catch {
    toast.error("Network error loading invoice");
    return;
  }
  const html = await res.text();
  const w = window.open("", "_blank", "width=900,height=760");
  if (!w) { toast.error("Popup blocked — allow popups to print"); return; }
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 350);
}

function PosDineIn() {
  const [outletId, setOutletId] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");

  const outletsQ = useQuery({
    queryKey: ["pos", "outlets"],
    queryFn: () => apiFetch<Outlet[] | null>("/api/pos/outlets").then((o) => o ?? []),
    enabled: isAuthenticated(),
  });
  const outlets = outletsQ.data ?? [];
  useEffect(() => { if (!outletId && outlets.length) setOutletId(outlets[0].id); }, [outlets, outletId]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="POS Dine-In"
        description="Table service: assign a table, fire KOTs, generate the bill, settle, and print the GST invoice."
        actions={
          <Select value={outletId} onValueChange={(v) => { setOutletId(v); setSessionId(""); }}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Select outlet" /></SelectTrigger>
            <SelectContent>
              {outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
      {outlets.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No outlets yet. Create one in the <strong>Setup Wizard → Outlets</strong> tab first.
        </Card>
      ) : sessionId ? (
        <SessionView sessionId={sessionId} onBack={() => setSessionId("")} />
      ) : (
        <FloorView outletId={outletId} onOpenSession={setSessionId} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floor view
// ---------------------------------------------------------------------------
function FloorView({ outletId, onOpenSession }: { outletId: string; onOpenSession: (id: string) => void }) {
  const qc = useQueryClient();
  const tablesQ = useQuery({
    queryKey: ["pos", "tables", outletId],
    queryFn: () => apiFetch<TableT[] | null>(`/api/pos/tables`, { query: { outlet_id: outletId } }).then((t) => t ?? []),
    enabled: isAuthenticated() && !!outletId,
    refetchInterval: 8000,
  });
  const [newTable, setNewTable] = useState("");
  const [seats, setSeats] = useState(4);
  const [opening, setOpening] = useState<TableT | null>(null);
  const [covers, setCovers] = useState(2);
  const [guestName, setGuestName] = useState("");

  const createTable = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch<TableT>("/api/pos/tables", { method: "POST", body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pos", "tables", outletId] }); setNewTable(""); toast.success("Table added"); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const openSession = useMutation({
    mutationFn: (vars: { tableId: string; body: Record<string, unknown> }) =>
      apiFetch<{ id: string }>(`/api/pos/tables/${vars.tableId}/sessions`, { method: "POST", body: vars.body }),
    onSuccess: (s) => { setOpening(null); onOpenSession(s.id); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not open table"),
  });

  const tables = tablesQ.data ?? [];

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>New table no.</Label>
          <Input value={newTable} placeholder="T12" className="w-28" onChange={(e) => setNewTable(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Seats</Label>
          <Input type="number" value={seats} className="w-20" onChange={(e) => setSeats(Number(e.target.value))} />
        </div>
        <Button
          className="gap-1"
          disabled={!newTable || createTable.isPending}
          onClick={() => createTable.mutate({ outlet_id: outletId, table_number: newTable, seats })}
        >
          <Plus className="size-4" /> Add Table
        </Button>
      </Card>

      {tables.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">No tables in this outlet yet. Add one above.</Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {tables.map((t) => (
            <button
              key={t.id}
              disabled={t.status !== "available" && t.status !== "reserved"}
              onClick={() => { setOpening(t); setCovers(2); setGuestName(""); }}
              className={`border-2 p-4 text-left disabled:opacity-60 ${TABLE_COLORS[t.status] ?? "border-border"}`}
            >
              <div className="text-lg font-bold font-mono">{t.table_number}</div>
              <div className="text-xs">{t.seats} seats</div>
              <Badge variant="outline" className="mt-1 text-[10px] capitalize">{t.status}</Badge>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!opening} onOpenChange={(o) => !o && setOpening(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Open table {opening?.table_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Covers (guests)</Label>
              <Input type="number" value={covers} onChange={(e) => setCovers(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Guest name (optional)</Label>
              <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Walk-in" />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={openSession.isPending}
              onClick={() => opening && openSession.mutate({
                tableId: opening.id,
                body: { covers, guest_name: guestName || null, customer_type: "walk_in" },
              })}
            >
              Open Table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session view
// ---------------------------------------------------------------------------
function SessionView({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pos", "session", sessionId] });
  const sessionQ = useQuery({
    queryKey: ["pos", "session", sessionId],
    queryFn: () => apiFetch<SessionDetail>(`/api/pos/sessions/${sessionId}`),
    enabled: isAuthenticated(),
    refetchInterval: 5000,
  });
  const s = sessionQ.data;

  const sendKOT = useMutation({
    mutationFn: async (items: DraftItem[]) => {
      const kot = await apiFetch<{ id: string }>(`/api/pos/sessions/${sessionId}/kots`, { method: "POST", body: { items } });
      await apiFetch(`/api/pos/kots/${kot.id}/send`, { method: "POST" });
      return kot;
    },
    onSuccess: () => { invalidate(); toast.success("KOT sent to kitchen"); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to send KOT"),
  });

  const kotStatus = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      apiFetch(`/api/pos/kots/${v.id}/status`, { method: "PATCH", body: { status: v.status } }),
    onSuccess: invalidate,
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Transition not allowed"),
  });

  const voidItem = useMutation({
    mutationFn: (v: { kotId: string; itemId: string; reason: string }) =>
      apiFetch(`/api/pos/kots/${v.kotId}/items/${v.itemId}/void`, { method: "POST", body: { reason: v.reason } }),
    onSuccess: () => { invalidate(); toast.success("Item voided"); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Void failed"),
  });

  const genBill = useMutation({
    mutationFn: () => apiFetch<Bill>(`/api/pos/sessions/${sessionId}/bill`, { method: "POST" }),
    onSuccess: invalidate,
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Cannot generate bill"),
  });

  const closeSession = useMutation({
    mutationFn: () => apiFetch(`/api/pos/sessions/${sessionId}/close`, { method: "POST" }),
    onSuccess: () => { toast.success("Table closed"); onBack(); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Close failed"),
  });

  if (!s) return <Card className="p-6 text-sm text-muted-foreground">Loading session…</Card>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" className="gap-1" onClick={onBack}><ArrowLeft className="size-4" /> Floor</Button>
        <div className="text-sm text-muted-foreground font-mono">
          {s.session_number} · {s.covers} covers · <span className="capitalize">{s.status}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <OrderEntry onSend={(items) => sendKOT.mutate(items)} pending={sendKOT.isPending} disabled={s.status === "settled" || s.status === "closed"} />
          <KOTList
            kots={s.kots}
            onAdvance={(id, status) => kotStatus.mutate({ id, status })}
            onVoid={(kotId, itemId, reason) => voidItem.mutate({ kotId, itemId, reason })}
            voidDisabled={s.status === "settled" || s.status === "closed"}
          />
        </div>
        <BillPanel
          session={s}
          onGenerate={() => genBill.mutate()}
          generating={genBill.isPending}
          onChanged={invalidate}
          onClose={() => closeSession.mutate()}
        />
      </div>
    </div>
  );
}

type DraftItem = { item_name: string; quantity: number; unit_price: number; hsn_code?: string };

function OrderEntry({ onSend, pending, disabled }: { onSend: (items: DraftItem[]) => void; pending: boolean; disabled: boolean }) {
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [hsn, setHsn] = useState("");

  const add = () => {
    if (!name.trim() || price < 0) return;
    setDraft((d) => [...d, { item_name: name.trim(), quantity: qty, unit_price: price, hsn_code: hsn.trim() || undefined }]);
    setName(""); setQty(1); setPrice(0); setHsn("");
  };

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold flex items-center gap-1"><Plus className="size-4" /> New Order (KOT)</h3>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1 flex-1 min-w-40"><Label>Item</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Paneer Tikka" /></div>
        <div className="space-y-1"><Label>Qty</Label><Input type="number" className="w-20" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></div>
        <div className="space-y-1"><Label>Unit ₹</Label><Input type="number" className="w-24" value={price} onChange={(e) => setPrice(Number(e.target.value))} /></div>
        <div className="space-y-1"><Label>HSN (opt.)</Label><Input className="w-24" value={hsn} onChange={(e) => setHsn(e.target.value)} placeholder="996331" /></div>
        <Button variant="outline" onClick={add} disabled={disabled}>Add</Button>
      </div>
      {draft.length > 0 && (
        <div className="space-y-1">
          {draft.map((it, i) => (
            <div key={i} className="flex items-center justify-between text-sm border-b border-border py-1">
              <span>{it.quantity} × {it.item_name}{it.hsn_code ? <span className="text-muted-foreground"> · HSN {it.hsn_code}</span> : null}</span>
              <span className="flex items-center gap-2">
                {fmtINR(it.quantity * it.unit_price)}
                <button onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}><Trash2 className="size-3.5 text-destructive" /></button>
              </span>
            </div>
          ))}
          <Button className="w-full gap-1 mt-2" disabled={pending || disabled} onClick={() => { onSend(draft); setDraft([]); }}>
            <Send className="size-4" /> Send {draft.length} item(s) to Kitchen
          </Button>
        </div>
      )}
    </Card>
  );
}

function KOTList({ kots, onAdvance, onVoid, voidDisabled }: {
  kots: KOT[]; onAdvance: (id: string, status: string) => void;
  onVoid: (kotId: string, itemId: string, reason: string) => void; voidDisabled: boolean;
}) {
  const next: Record<string, string | null> = { sent: "preparing", acknowledged: "preparing", preparing: "ready", ready: "served", draft: null, served: null, cancelled: null };
  const [voidTarget, setVoidTarget] = useState<{ kotId: string; itemId: string; name: string } | null>(null);
  const [voidReason, setVoidReason] = useState("");
  if (!kots.length) return <Card className="p-4 text-sm text-muted-foreground">No KOTs yet.</Card>;
  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold flex items-center gap-1"><ChefHat className="size-4" /> Kitchen Tickets</h3>
      {kots.map((k) => (
        <div key={k.id} className="border-2 border-border p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm">{k.kot_number} · round {k.round_no}</span>
            <Badge variant="outline" className="capitalize">{k.status}</Badge>
          </div>
          <div className="mt-2 space-y-0.5 text-sm">
            {k.items.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-2">
                {it.status === "cancelled" ? (
                  <span className="text-muted-foreground line-through">
                    {it.quantity} × {it.item_name} ({fmtINR(it.line_total)})
                    {it.void_reason ? <span className="italic"> — {it.void_reason}</span> : null}
                  </span>
                ) : (
                  <>
                    <span>{it.quantity} × {it.item_name} <span className="text-muted-foreground">({fmtINR(it.line_total)})</span></span>
                    {!voidDisabled && (
                      <button
                        title="Void item"
                        onClick={() => { setVoidTarget({ kotId: k.id, itemId: it.id, name: it.item_name }); setVoidReason(""); }}
                      >
                        <Ban className="size-3.5 text-destructive" />
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
          {next[k.status] && (
            <Button size="sm" variant="outline" className="mt-2 capitalize" onClick={() => onAdvance(k.id, next[k.status]!)}>
              Mark {next[k.status]}
            </Button>
          )}
        </div>
      ))}

      <Dialog open={!!voidTarget} onOpenChange={(o) => !o && setVoidTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Void {voidTarget?.name}</DialogTitle></DialogHeader>
          <div className="space-y-1">
            <Label>Reason (required)</Label>
            <Input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Wrong order, guest changed mind..." />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={!voidReason.trim()}
              onClick={() => { if (voidTarget) { onVoid(voidTarget.kotId, voidTarget.itemId, voidReason.trim()); setVoidTarget(null); } }}
            >
              Void Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Bill panel — generate, preview, adjust, finalize, pay, invoice, close
// ---------------------------------------------------------------------------
function BillPanel({ session, onGenerate, generating, onChanged, onClose }: {
  session: SessionDetail; onGenerate: () => void; generating: boolean; onChanged: () => void; onClose: () => void;
}) {
  const bill = session.bill;
  const qc = useQueryClient();

  const splitsQ = useQuery({
    queryKey: ["pos", "splits", bill?.id],
    queryFn: () => apiFetch<{ enabled: boolean; splits: BillSplit[] }>(`/api/pos/bills/${bill!.id}/splits`),
    enabled: isAuthenticated() && !!bill,
  });
  const splits = splitsQ.data?.splits ?? [];
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitNames, setSplitNames] = useState<string[]>(["", ""]);
  useEffect(() => {
    if (!splitsQ.data) return;
    setSplitOpen(splitsQ.data.enabled);
    if (splitsQ.data.enabled) setSplitNames(splitsQ.data.splits.map((s) => s.customer_name));
  }, [splitsQ.data]);

  const saveSplits = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/pos/bills/${bill!.id}/splits`, { method: "PUT", body }),
    onSuccess: (_d, body) => {
      qc.invalidateQueries({ queryKey: ["pos", "splits", bill?.id] });
      toast.success((body as { enabled: boolean }).enabled ? "Bill split saved" : "Split removed");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Split failed"),
  });

  const patchBill = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch<Bill>(`/api/pos/bills/${bill!.id}`, { method: "PATCH", body }),
    onSuccess: onChanged,
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });
  const finalize = useMutation({
    mutationFn: () => apiFetch(`/api/pos/bills/${bill!.id}/finalize`, { method: "POST" }),
    onSuccess: onChanged,
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Finalize failed"),
  });
  const pay = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch(`/api/pos/bills/${bill!.id}/payments`, { method: "POST", body }),
    onSuccess: onChanged,
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Payment failed"),
  });

  const [discount, setDiscount] = useState(0);
  const [tipPct, setTipPct] = useState(0);
  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState(0);
  const [tendered, setTendered] = useState(0);
  const [ref, setRef] = useState("");
  useEffect(() => { if (bill) setAmount(bill.amount_due); }, [bill]);

  if (!bill) {
    return (
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-1"><Receipt className="size-4" /> Bill</h3>
        <p className="text-sm text-muted-foreground">No bill yet. Generate the consolidated bill once items are served.</p>
        <Button className="w-full" disabled={generating} onClick={onGenerate}>Generate Bill</Button>
      </Card>
    );
  }

  const editable = bill.status === "open";
  const payable = bill.status === "finalized" || bill.status === "partially_paid";
  const paid = bill.status === "paid";
  const row = (l: string, v: number, strong = false) => (
    <div className={`flex justify-between ${strong ? "font-bold" : ""}`}><span>{l}</span><span>{fmtINR(v)}</span></div>
  );

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-1"><Receipt className="size-4" /> {bill.bill_number}</h3>
        <Badge variant="outline" className="capitalize">{bill.status}</Badge>
      </div>

      <div className="text-sm space-y-1">
        {row("Subtotal", bill.subtotal)}
        {bill.discount_amount > 0 && row("Discount", -bill.discount_amount)}
        {row(`CGST (${(bill.tax_rate / 2).toFixed(2)}%)`, bill.tax_amount / 2)}
        {row(`SGST (${(bill.tax_rate / 2).toFixed(2)}%)`, bill.tax_amount / 2)}
        {bill.tip_amount > 0 && row("Tip", bill.tip_amount)}
        {row("Total", bill.total_amount, true)}
        {bill.amount_paid > 0 && row("Paid", bill.amount_paid)}
        {bill.amount_due > 0 && row("Due", bill.amount_due, true)}
      </div>

      {bill.status !== "void" && (
        <div className="space-y-2 border-t border-border pt-2">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <Checkbox
              checked={splitOpen}
              onCheckedChange={(v) => {
                const on = v === true;
                setSplitOpen(on);
                if (!on && (splitsQ.data?.enabled ?? false)) saveSplits.mutate({ enabled: false });
                if (on && splitNames.length < 2) setSplitNames(["", ""]);
              }}
            />
            Split bill — separate invoice per customer
          </label>
          {splitOpen && (
            <div className="space-y-2">
              {splitNames.map((n, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={n}
                    placeholder={`Customer ${i + 1} name`}
                    onChange={(e) => setSplitNames((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {fmtINR(bill.total_amount / splitNames.length)}
                  </span>
                  {splitNames.length > 2 && (
                    <button onClick={() => setSplitNames((arr) => arr.filter((_, j) => j !== i))}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSplitNames((arr) => [...arr, ""])}>
                  <Plus className="size-4" /> Add customer
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={saveSplits.isPending || splitNames.some((n) => !n.trim())}
                  onClick={() => saveSplits.mutate({ enabled: true, customers: splitNames.map((n) => ({ name: n.trim() })) })}
                >
                  Save Split ({splitNames.length} ways)
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {editable && (
        <div className="space-y-2 border-t border-border pt-2">
          <div className="flex items-end gap-2">
            <div className="space-y-1 flex-1"><Label>Discount ₹</Label><Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></div>
            <div className="space-y-1 flex-1"><Label>Tip %</Label><Input type="number" value={tipPct} onChange={(e) => setTipPct(Number(e.target.value))} /></div>
            <Button variant="outline" onClick={() => patchBill.mutate({ discount_type: "flat", discount_value: discount, tip_type: "percent", tip_value: tipPct })}>Apply</Button>
          </div>
          <Button className="w-full" disabled={finalize.isPending} onClick={() => finalize.mutate()}>Finalize Bill</Button>
        </div>
      )}

      {payable && (
        <div className="space-y-2 border-t border-border pt-2">
          <div className="flex items-end gap-2">
            <div className="space-y-1"><Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1"><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
          </div>
          {method === "cash" ? (
            <div className="space-y-1"><Label>Tendered</Label><Input type="number" value={tendered} onChange={(e) => setTendered(Number(e.target.value))} /></div>
          ) : (
            <div className="space-y-1"><Label>Txn reference</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="AUTH / UPI id" /></div>
          )}
          <Button
            className="w-full gap-1"
            disabled={pay.isPending}
            onClick={() => pay.mutate({
              method, amount,
              tendered: method === "cash" ? tendered : undefined,
              txn_reference: method !== "cash" ? ref : undefined,
            })}
          >
            <Wallet className="size-4" /> Take Payment
          </Button>
        </div>
      )}

      {paid && (
        <div className="space-y-2 border-t border-border pt-2">
          {splits.length > 0 ? (
            <>
              {splits.map((s) => (
                <Button key={s.id} className="w-full gap-1" variant="outline" onClick={() => openInvoice(bill.id, s.id)}>
                  <Printer className="size-4" /> Invoice — {s.customer_name} ({fmtINR(s.amount)})
                </Button>
              ))}
              <Button className="w-full gap-1" variant="ghost" onClick={() => openInvoice(bill.id)}>
                <Printer className="size-4" /> Combined GST Invoice
              </Button>
            </>
          ) : (
            <Button className="w-full gap-1" variant="outline" onClick={() => openInvoice(bill.id)}><Printer className="size-4" /> Print GST Invoice</Button>
          )}
          <Button className="w-full gap-1" onClick={onClose}><DoorClosed className="size-4" /> Close Table</Button>
        </div>
      )}
    </Card>
  );
}
