import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { fmtINR } from "@/lib/mhms-store";
import {
  useConsolidatedReport,
  useNightAuditRevenue,
  useNightAuditChecklist,
  useNightAuditReports,
  useCloseDay,
} from "@/lib/api/hooks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle2, Clock, Moon, Download, AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/csv";

// Procedural metadata for the standard night-audit steps. The completion state
// is driven by the live checklist endpoint; this only supplies labels/category
// for any step the backend hasn't named.
const STEP_CATEGORY_COLORS: Record<string, string> = {
  "Front Desk": "bg-info/15 text-info",
  Billing: "bg-success/15 text-success",
  "F&B": "bg-orange-500/15 text-orange-600",
  Finance: "bg-purple-500/15 text-purple-600",
  Revenue: "bg-warning/15 text-warning-foreground",
  Reports: "bg-muted text-muted-foreground",
  System: "bg-destructive/15 text-destructive",
  Audit: "bg-muted text-muted-foreground",
};

export const Route = createFileRoute("/night-audit")({
  head: () => ({ meta: [{ title: "Night Audit · MHMS" }] }),
  component: NightAudit,
});

function NightAudit() {
  const reportQ = useConsolidatedReport();
  const revenueQ = useNightAuditRevenue();
  const checklistQ = useNightAuditChecklist();
  const reportsQ = useNightAuditReports();
  const closeDay = useCloseDay();

  const r = reportQ.data;
  const checklist = useMemo(() => checklistQ.data ?? [], [checklistQ.data]);
  const revenue = revenueQ.data ?? [];
  const pastReports = reportsQ.data ?? [];

  // Live metrics from the consolidated report.
  const arrivals = r?.arrivals_today ?? 0;
  const departures = r?.departures_today ?? 0;
  const inHouse = r?.occupied_rooms ?? 0;
  const roomRevenue = r?.total_revenue ?? 0;
  const outstanding = r?.pending_payments ?? 0;
  const occupancy = r?.occupancy_rate ?? 0;
  const openComplaints = r?.open_complaints ?? 0;

  // Checklist completion: seed from the backend `completed` flags; the operator
  // can additionally mark steps run during this session (the day is finalised by
  // Complete Audit, which calls the close-day endpoint).
  const backendDone = checklist.filter((s) => s.completed).length;
  const [localRun, setLocalRun] = useState<Set<number>>(new Set());
  const isStepDone = (i: number) => checklist[i]?.completed || localRun.has(i);
  const doneCount = checklist.reduce((n, _s, i) => (isStepDone(i) ? n + 1 : n), 0);
  const total = checklist.length;
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const allDone = total > 0 && doneCount === total;

  const exportAudit = () => {
    downloadCSV(`night-audit.csv`, [
      { metric: "Arrivals Today", value: arrivals },
      { metric: "Departures Today", value: departures },
      { metric: "In-House (occupied rooms)", value: inHouse },
      { metric: "Occupancy %", value: occupancy.toFixed(1) },
      { metric: "Room Revenue", value: roomRevenue },
      { metric: "Outstanding AR", value: outstanding },
      { metric: "Open Complaints", value: openComplaints },
    ]);
    toast.success("Audit exported");
  };

  const runStep = (i: number) => {
    setLocalRun((prev) => new Set(prev).add(i));
    toast.success(`Step ${i + 1} marked complete`);
  };

  const completeAudit = () => {
    closeDay.mutate(undefined, {
      onSuccess: (res) => {
        toast.success(`Night audit complete — business date ${res.audit_date} closed.`);
        setLocalRun(new Set());
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Close day failed"),
    });
  };

  const loading = reportQ.isLoading || checklistQ.isLoading;

  return (
    <>
      <PageHeader
        title="Night Audit"
        description={r ? "Live operational close-of-day" : "Sign in to load live audit data"}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportAudit} className="gap-1.5">
              <Download className="size-4" />Export CSV
            </Button>
            <Button
              size="sm"
              disabled={!allDone || closeDay.isPending}
              className="gap-1.5"
              onClick={completeAudit}
            >
              <Moon className="size-4" /> {closeDay.isPending ? "Closing…" : "Complete Audit"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <Stat label="Arrivals" value={arrivals} hint="Expected today" />
        <Stat label="Departures" value={departures} hint="Checked out today" />
        <Stat label="In-House" value={inHouse} hint="Occupied rooms" tone="info" />
        <Stat label="Day Revenue" value={fmtINR(roomRevenue)} tone="success" hint="Completed payments" />
        <Stat
          label="Outstanding"
          value={fmtINR(outstanding)}
          tone={outstanding > 0 ? "warning" : "success"}
          hint="Unpaid invoices"
        />
      </div>

      <Tabs defaultValue="checklist">
        <TabsList className="mb-4">
          <TabsTrigger value="checklist">
            <Moon className="size-3.5 mr-1.5" />Audit Checklist
            <Badge variant="outline" className="ml-1.5 text-[10px]">{doneCount}/{total}</Badge>
          </TabsTrigger>
          <TabsTrigger value="summary">Revenue Audit</TabsTrigger>
          <TabsTrigger value="reports">
            Past Audits
            {pastReports.length > 0 && (
              <Badge variant="outline" className="ml-1.5 text-[10px]">{pastReports.length}</Badge>
            )}
          </TabsTrigger>
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
              {loading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Loading checklist…</div>
              ) : total === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No checklist available. Sign in to load the live night-audit checklist.
                </div>
              ) : (
                <div className="space-y-2">
                  {checklist.map((s, i) => {
                    const isDone = isStepDone(i);
                    const isNext = !isDone && doneCount === i;
                    return (
                      <div
                        key={s.task}
                        className={`p-3 rounded-lg border transition-colors ${isDone ? "bg-success/5 border-success/30" : isNext ? "border-primary bg-primary/5" : "border-transparent bg-muted/30"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            {isDone ? (
                              <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
                            ) : (
                              <Clock className={`size-5 shrink-0 mt-0.5 ${isNext ? "text-primary" : "text-muted-foreground"}`} />
                            )}
                            <div className={`font-medium text-sm ${isDone ? "line-through text-muted-foreground" : ""}`}>
                              {i + 1}. {s.task}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {!isDone && (
                              <Button size="sm" className="h-7 px-2" onClick={() => runStep(i)}>Run</Button>
                            )}
                            {isDone && (
                              <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-[10px]">Done</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
            <div className="space-y-3">
              <Card className="p-4">
                <h3 className="font-semibold text-sm mb-3">Today's Highlights</h3>
                <div className="space-y-2 text-sm">
                  {[
                    ["Arrivals today", String(arrivals), ""],
                    ["Departures today", String(departures), ""],
                    ["Occupied rooms", String(inHouse), "text-info"],
                    ["Occupancy", `${occupancy.toFixed(1)}%`, ""],
                    ["Open complaints", String(openComplaints), openComplaints > 0 ? "text-warning-foreground" : "text-success"],
                    ["Room revenue", fmtINR(roomRevenue), "text-success"],
                    ["Outstanding AR", fmtINR(outstanding), outstanding > 0 ? "text-destructive" : "text-success"],
                  ].map(([label, val, cls]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={`font-medium ${cls}`}>{val}</span>
                    </div>
                  ))}
                </div>
              </Card>
              {backendDone < total && total > 0 && (
                <Card className="p-4 border-warning/30 bg-warning/5">
                  <div className="flex items-center gap-2 text-warning-foreground font-medium text-sm">
                    <AlertTriangle className="size-4" />
                    {total - backendDone} step{total - backendDone > 1 ? "s" : ""} pending before close
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Revenue Audit */}
        <TabsContent value="summary">
          <Card>
            <div className="p-4 border-b">
              <h3 className="font-semibold">Revenue Audit — Expected vs Actual</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Category", "Expected", "Actual", "Variance"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {revenue.map((row) => (
                    <tr key={row.category} className="border-b last:border-0 hover:bg-accent/5">
                      <td className="px-4 py-3 font-medium">{row.category}</td>
                      <td className="px-4 py-3">{fmtINR(row.expected)}</td>
                      <td className="px-4 py-3">{fmtINR(row.actual)}</td>
                      <td className={`px-4 py-3 font-medium ${row.difference < 0 ? "text-destructive" : row.difference > 0 ? "text-success" : ""}`}>
                        {fmtINR(row.difference)}
                      </td>
                    </tr>
                  ))}
                  {revenue.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">{revenueQ.isLoading ? "Loading…" : "No revenue data for the current business date."}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Past Audits */}
        <TabsContent value="reports">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Audit Date", "Status", "Closed By", "Created"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pastReports.map((a) => (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-accent/5">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{a.audit_date}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] ${STEP_CATEGORY_COLORS["Reports"]}`}>{a.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{a.closed_by ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{a.created_at}</td>
                    </tr>
                  ))}
                  {pastReports.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">{reportsQ.isLoading ? "Loading…" : "No past night audits recorded yet."}</td></tr>
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
