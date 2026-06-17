import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle2, Clock, Moon, Download, AlertTriangle, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { downloadCSV, printHTML } from "@/lib/csv";

const STEPS = [
  { label: "Verify all arrivals processed", desc: "Confirm all expected arrivals are checked in; flag no-shows.", category: "Front Desk" },
  { label: "Confirm departures completed", desc: "Verify all departures are processed and rooms handed to housekeeping.", category: "Front Desk" },
  { label: "Post room & tax charges", desc: "Auto-post nightly room rate and applicable GST to all in-house folios.", category: "Billing" },
  { label: "Reconcile POS revenue", desc: "Match POS orders to folio charges and cash drawer totals.", category: "F&B" },
  { label: "Process credit card batch", desc: "Submit end-of-day card transactions to payment gateway for settlement.", category: "Billing" },
  { label: "Handle no-shows", desc: "Apply no-show charges per policy; release rooms back to inventory.", category: "Front Desk" },
  { label: "Review AR aging", desc: "Identify folios with balances >30 days and flag for follow-up.", category: "Finance" },
  { label: "Update statistics", desc: "Compute final occupancy, ADR, and RevPAR for the business date.", category: "Revenue" },
  { label: "Generate audit reports", desc: "Print or save the night audit summary, arrivals, departures, and revenue.", category: "Reports" },
  { label: "Roll business date", desc: "Advance the system business date to the next day.", category: "System" },
];

const AR_AGING = [
  { folio: "RES2001", guest: "Priya Sharma", amount: 45000, age: "0-30 days", status: "Current" },
  { folio: "RES1988", guest: "Raj Mehta Enterprises", amount: 128000, age: "31-60 days", status: "Overdue" },
  { folio: "RES1976", guest: "Sunflower Corp Ltd.", amount: 67500, age: "61-90 days", status: "Overdue" },
  { folio: "RES1965", guest: "Mr. Arjun Pillai", amount: 14200, age: ">90 days", status: "Collections" },
];

const STEP_CATEGORY_COLORS: Record<string, string> = {
  "Front Desk": "bg-info/15 text-info",
  Billing: "bg-success/15 text-success",
  "F&B": "bg-orange-500/15 text-orange-600",
  Finance: "bg-purple-500/15 text-purple-600",
  Revenue: "bg-warning/15 text-warning-foreground",
  Reports: "bg-muted text-muted-foreground",
  System: "bg-destructive/15 text-destructive",
};

export const Route = createFileRoute("/night-audit")({
  head: () => ({ meta: [{ title: "Night Audit · MHMS" }] }),
  component: NightAudit,
});

function NightAudit() {
  const { reservations, folios, payments, businessDate, rollBusinessDate, auditLog, logAudit, orders, guests } = useMHMS();
  const [done, setDone] = useState<number[]>([]);
  const today = businessDate;

  const arrivals = reservations.filter((r) => r.checkIn === today);
  const departures = reservations.filter((r) => r.checkOut === today);
  const inHouse = reservations.filter((r) => r.status === "checked_in");
  const noShows = reservations.filter((r) => r.checkIn === today && r.status === "confirmed");
  const revenue = folios.reduce((s, f) => s + f.amount, 0);
  const collections = payments.reduce((s, p) => s + p.amount, 0);
  const posRev = orders.filter((o) => o.status === "Paid").reduce((s, o) => s + o.total, 0);
  const outstanding = revenue - collections;

  const progress = Math.round((done.length / STEPS.length) * 100);

  const exportAudit = () => {
    downloadCSV(`night-audit-${today}.csv`, [
      { metric: "Business Date", value: today },
      { metric: "Arrivals Expected", value: arrivals.length },
      { metric: "Departures", value: departures.length },
      { metric: "In-House Guests", value: inHouse.length },
      { metric: "No-Shows", value: noShows.length },
      { metric: "Room Revenue", value: revenue },
      { metric: "POS Revenue", value: posRev },
      { metric: "Collections", value: collections },
      { metric: "Outstanding AR", value: outstanding },
    ]);
    toast.success("Audit exported");
  };

  const printAuditReport = () => {
    const arrRows = arrivals.map((r) => `<tr><td>${r.code}</td><td>${guests.find((g) => g.id === r.guestId)?.name ?? "—"}</td><td>${r.checkIn}</td><td class="right">${fmtINR(r.rate)}</td></tr>`).join("");
    const depRows = departures.map((r) => `<tr><td>${r.code}</td><td>${guests.find((g) => g.id === r.guestId)?.name ?? "—"}</td><td>${r.checkOut}</td><td class="right">${fmtINR(r.rate)}</td></tr>`).join("");
    printHTML(`Night Audit ${today}`, `
      <div class="brand"><div><h1>Night Audit Report</h1><div class="muted">Hotel Harmony</div></div><div style="text-align:right"><h1>${today}</h1></div></div>
      <h2>Summary</h2>
      <table>
        <tr><th>Metric</th><th class="right">Value</th></tr>
        <tr><td>Arrivals</td><td class="right">${arrivals.length}</td></tr>
        <tr><td>Departures</td><td class="right">${departures.length}</td></tr>
        <tr><td>In-House Guests</td><td class="right">${inHouse.length}</td></tr>
        <tr><td>No-Shows</td><td class="right">${noShows.length}</td></tr>
        <tr><td>Room Revenue</td><td class="right">${fmtINR(revenue)}</td></tr>
        <tr><td>POS Revenue</td><td class="right">${fmtINR(posRev)}</td></tr>
        <tr><td>Collections</td><td class="right">${fmtINR(collections)}</td></tr>
        <tr><td>Outstanding AR</td><td class="right">${fmtINR(outstanding)}</td></tr>
      </table>
      <h2>Arrivals</h2>
      <table><tr><th>Code</th><th>Guest</th><th>Date</th><th class="right">Rate</th></tr>${arrRows || `<tr><td colspan="4" class="muted">None today</td></tr>`}</table>
      <h2>Departures</h2>
      <table><tr><th>Code</th><th>Guest</th><th>Date</th><th class="right">Rate</th></tr>${depRows || `<tr><td colspan="4" class="muted">None today</td></tr>`}</table>
    `);
  };

  return (
    <>
      <PageHeader
        title="Night Audit"
        description={`Business date: ${today}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportAudit} className="gap-1.5"><Download className="size-4" />Export CSV</Button>
            <Button variant="outline" size="sm" onClick={printAuditReport}>Print Report</Button>
            <Button size="sm" disabled={done.length !== STEPS.length} className="gap-1.5"
              onClick={() => { rollBusinessDate(); toast.success("Night audit complete — business date advanced."); setDone([]); }}>
              <Moon className="size-4" /> Complete Audit
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <Stat label="Arrivals" value={arrivals.length} hint="Expected today" />
        <Stat label="Departures" value={departures.length} hint="Checked out today" />
        <Stat label="In-House" value={inHouse.length} hint="Currently staying" tone="info" />
        <Stat label="Day Revenue" value={fmtINR(revenue)} tone="success" hint="Room charges" />
        <Stat label="Outstanding" value={fmtINR(outstanding)} tone={outstanding > 0 ? "warning" : "success"} hint="Uncollected" />
      </div>

      <Tabs defaultValue="checklist">
        <TabsList className="mb-4">
          <TabsTrigger value="checklist">
            <Moon className="size-3.5 mr-1.5" />Audit Checklist
            <Badge variant="outline" className="ml-1.5 text-[10px]">{done.length}/{STEPS.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="summary">Revenue Summary</TabsTrigger>
          <TabsTrigger value="ar">
            AR Aging
            {AR_AGING.filter((a) => a.status !== "Current").length > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-[10px] size-4 p-0 grid place-items-center">
                {AR_AGING.filter((a) => a.status !== "Current").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="log">Audit Log</TabsTrigger>
        </TabsList>

        {/* Checklist */}
        <TabsContent value="checklist">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Audit Steps</h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-32 h-1.5 bg-muted rounded-full">
                    <div className="h-1.5 bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  {progress}%
                </div>
              </div>
              <div className="space-y-2">
                {STEPS.map((s, i) => {
                  const isDone = done.includes(i);
                  const isNext = !isDone && done.length === i;
                  return (
                    <div key={s.label} className={`p-3 rounded-lg border transition-colors ${isDone ? "bg-success/5 border-success/30" : isNext ? "border-primary bg-primary/5" : "border-transparent bg-muted/30"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {isDone
                            ? <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
                            : <Clock className={`size-5 shrink-0 mt-0.5 ${isNext ? "text-primary" : "text-muted-foreground"}`} />}
                          <div>
                            <div className={`font-medium text-sm ${isDone ? "line-through text-muted-foreground" : ""}`}>
                              {i + 1}. {s.label}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={`text-[10px] ${STEP_CATEGORY_COLORS[s.category] ?? "bg-muted text-muted-foreground"}`}>{s.category}</Badge>
                          {!isDone && (
                            <Button size="sm" className="h-7 px-2" disabled={!isNext}
                              onClick={() => { setDone([...done, i]); logAudit("Night Audit", `Step ${i + 1}: ${s.label}`); toast.success(`Step ${i + 1} complete`); }}>
                              Run
                            </Button>
                          )}
                          {isDone && <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-[10px]">Done</Badge>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
            <div className="space-y-3">
              <Card className="p-4">
                <h3 className="font-semibold text-sm mb-3">Today's Highlights</h3>
                <div className="space-y-2 text-sm">
                  {[
                    ["Arrivals today", arrivals.length, ""],
                    ["Departures today", departures.length, ""],
                    ["Currently in-house", inHouse.length, "text-info"],
                    ["No-shows", noShows.length, noShows.length > 0 ? "text-warning-foreground" : "text-success"],
                    ["POS revenue", fmtINR(posRev), "text-success"],
                    ["Total collected", fmtINR(collections), "text-success"],
                    ["Outstanding AR", fmtINR(outstanding), outstanding > 0 ? "text-destructive" : "text-success"],
                  ].map(([label, val, cls]) => (
                    <div key={label as string} className="flex justify-between">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={`font-medium ${cls}`}>{val}</span>
                    </div>
                  ))}
                </div>
              </Card>
              {noShows.length > 0 && (
                <Card className="p-4 border-warning/30 bg-warning/5">
                  <div className="flex items-center gap-2 text-warning-foreground font-medium text-sm mb-2">
                    <AlertTriangle className="size-4" />
                    {noShows.length} No-Show{noShows.length > 1 ? "s" : ""} to Process
                  </div>
                  {noShows.slice(0, 3).map((r) => (
                    <div key={r.id} className="text-xs text-muted-foreground">{r.code} · {guests.find((g) => g.id === r.guestId)?.name}</div>
                  ))}
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Revenue Summary */}
        <TabsContent value="summary">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Revenue Breakdown — {today}</h3>
              <div className="space-y-3">
                {[
                  { label: "Room Revenue", amount: revenue, accent: false },
                  { label: "POS / F&B Revenue", amount: posRev, accent: false },
                  { label: "Total Revenue", amount: revenue + posRev, accent: true },
                  { label: "Collections Received", amount: collections, accent: false },
                  { label: "Outstanding Balance", amount: outstanding, accent: true },
                ].map((item, i) => (
                  <div key={item.label} className={`flex justify-between text-sm ${item.accent ? "font-semibold text-base pt-2 border-t" : ""}`}>
                    <span className={item.accent ? "" : "text-muted-foreground"}>{item.label}</span>
                    <span className={outstanding > 0 && item.label === "Outstanding Balance" ? "text-destructive" : item.amount > 0 && item.accent ? "text-success" : ""}>{fmtINR(item.amount)}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Cash Drawer Reconciliation</h3>
              <div className="space-y-3 text-sm">
                {[
                  { label: "Opening balance", amount: 25000 },
                  { label: "Cash received (payments)", amount: collections * 0.35 },
                  { label: "Cash expenses / petty cash", amount: -4200 },
                  { label: "Expected closing balance", amount: 25000 + collections * 0.35 - 4200 },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium">{fmtINR(Math.round(item.amount))}</span>
                  </div>
                ))}
                <div className="border-t pt-3">
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Variance</span>
                    <span className="text-success">₹0.00</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* AR Aging */}
        <TabsContent value="ar">
          <Card>
            <div className="p-4 border-b flex items-center gap-2">
              <Info className="size-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Accounts receivable aging — review and follow up on overdue balances.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Folio", "Guest / Company", "Amount", "Age", "Status", "Action"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {AR_AGING.map((a) => (
                    <tr key={a.folio} className="border-b last:border-0 hover:bg-accent/5">
                      <td className="px-4 py-3 font-mono text-xs">{a.folio}</td>
                      <td className="px-4 py-3 font-medium">{a.guest}</td>
                      <td className="px-4 py-3 font-medium">{fmtINR(a.amount)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{a.age}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] ${a.status === "Current" ? "bg-success/15 text-success" : a.status === "Overdue" ? "bg-warning/15 text-warning-foreground" : "bg-destructive/15 text-destructive"}`}>
                          {a.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                          onClick={() => toast.success(`Follow-up sent for ${a.folio}`)}>
                          {a.status === "Collections" ? "Send to Collections" : "Follow Up"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Audit Log */}
        <TabsContent value="log">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Date", "User", "Action"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLog.slice(0, 25).map((a) => (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-accent/5">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{a.date}</td>
                      <td className="px-4 py-3 font-medium">{a.user}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.action}</td>
                    </tr>
                  ))}
                  {auditLog.length === 0 && (
                    <tr><td colSpan={3} className="text-center py-10 text-muted-foreground">No audit events yet. Run the checklist to populate the log.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
