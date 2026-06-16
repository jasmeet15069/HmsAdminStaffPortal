import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { CheckCircle2, Clock, Moon, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { downloadCSV, printHTML } from "@/lib/csv";

const STEPS = [
  "Verify all arrivals processed",
  "Confirm departures completed",
  "Post room & tax charges",
  "Reconcile POS revenue",
  "Process credit card batch",
  "Update statistics",
  "Generate audit reports",
  "Roll business date",
];

export const Route = createFileRoute("/night-audit")({
  head: () => ({ meta: [{ title: "Night Audit · MHMS" }] }),
  component: NightAudit,
});

function NightAudit() {
  const { reservations, folios, payments, businessDate, rollBusinessDate, auditLog, logAudit, orders, guests } = useMHMS();
  const [done, setDone] = useState<number[]>([]);
  const today = businessDate;
  const arrivals = reservations.filter(r => r.checkIn === today);
  const departures = reservations.filter(r => r.checkOut === today);
  const revenue = folios.reduce((s, f) => s + f.amount, 0);
  const collections = payments.reduce((s, p) => s + p.amount, 0);
  const posRev = orders.filter((o) => o.status === "Paid").reduce((s, o) => s + o.total, 0);

  const exportAudit = () => {
    downloadCSV(`night-audit-${today}.csv`, [
      { metric: "Business Date", value: today },
      { metric: "Arrivals", value: arrivals.length },
      { metric: "Departures", value: departures.length },
      { metric: "Total Revenue", value: revenue },
      { metric: "Collections", value: collections },
      { metric: "POS Revenue", value: posRev },
      { metric: "Outstanding AR", value: revenue - collections },
    ]);
  };

  const printAuditReport = () => {
    const arrRows = arrivals.map((r) => `<tr><td>${r.code}</td><td>${guests.find((g) => g.id === r.guestId)?.name}</td><td>${r.checkIn}</td><td>${fmtINR(r.rate)}</td></tr>`).join("");
    const depRows = departures.map((r) => `<tr><td>${r.code}</td><td>${guests.find((g) => g.id === r.guestId)?.name}</td><td>${r.checkOut}</td><td>${fmtINR(r.rate)}</td></tr>`).join("");
    printHTML(`Night Audit ${today}`, `
      <div class="brand"><div><h1>Night Audit Report</h1><div class="muted">Azure Grand Mumbai</div></div><div style="text-align:right"><h1>${today}</h1></div></div>
      <h2>Summary</h2>
      <table>
        <tr><th>Metric</th><th class="right">Value</th></tr>
        <tr><td>Arrivals</td><td class="right">${arrivals.length}</td></tr>
        <tr><td>Departures</td><td class="right">${departures.length}</td></tr>
        <tr><td>Room Revenue</td><td class="right">${fmtINR(revenue)}</td></tr>
        <tr><td>POS Revenue</td><td class="right">${fmtINR(posRev)}</td></tr>
        <tr><td>Collections</td><td class="right">${fmtINR(collections)}</td></tr>
        <tr><td>Outstanding</td><td class="right">${fmtINR(revenue - collections)}</td></tr>
      </table>
      <h2>Arrivals</h2>
      <table><tr><th>Code</th><th>Guest</th><th>Date</th><th class="right">Rate</th></tr>${arrRows || `<tr><td colspan="4" class="muted">None</td></tr>`}</table>
      <h2>Departures</h2>
      <table><tr><th>Code</th><th>Guest</th><th>Date</th><th class="right">Rate</th></tr>${depRows || `<tr><td colspan="4" class="muted">None</td></tr>`}</table>
    `);
  };

  return (
    <>
      <PageHeader title="Night Audit" description={`Business date: ${today}`} actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportAudit}><Download className="size-4" /> Export CSV</Button>
          <Button variant="outline" onClick={printAuditReport}>Print Report</Button>
          <Button disabled={done.length !== STEPS.length} onClick={() => { rollBusinessDate(); toast.success("Night audit completed. Business date rolled."); setDone([]); }}>
            <Moon className="size-4" /> Complete audit
          </Button>
        </div>
      } />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Arrivals" value={arrivals.length} />
        <Stat label="Departures" value={departures.length} />
        <Stat label="Day Revenue" value={fmtINR(revenue)} tone="success" />
        <Stat label="Collections" value={fmtINR(collections)} tone="info" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-semibold mb-4">Audit checklist</h3>
          <div className="space-y-2">
            {STEPS.map((s, i) => {
              const isDone = done.includes(i);
              const isNext = !isDone && done.length === i;
              return (
                <div key={s} className={`flex items-center justify-between p-3 rounded border ${isDone ? "bg-success/5 border-success/30" : isNext ? "border-primary" : ""}`}>
                  <div className="flex items-center gap-3">
                    {isDone ? <CheckCircle2 className="size-5 text-success" /> : <Clock className="size-5 text-muted-foreground" />}
                    <span className={isDone ? "line-through text-muted-foreground" : ""}>{i + 1}. {s}</span>
                  </div>
                  {!isDone && <Button size="sm" disabled={!isNext} onClick={() => { setDone([...done, i]); logAudit("Night Audit", `Step ${i+1}: ${s}`); toast.success(`Step ${i+1} done`); }}>Run</Button>}
                  {isDone && <Badge variant="outline" className="bg-success/15 text-success border-success/30">Complete</Badge>}
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Audit Log</h3>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {auditLog.slice(0, 20).map((a) => (
                <TableRow key={a.id}><TableCell className="text-xs">{a.date}</TableCell><TableCell className="text-xs"><div className="font-medium">{a.action}</div><div className="text-muted-foreground">{a.user}</div></TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
