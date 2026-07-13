import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS } from "@/lib/mhms-store";
import { useAuth } from "@/lib/api/auth";
import { useAssets, useCreateAsset, useMaintenanceSchedule, useCreateMaintenanceTask, useCompleteMaintenanceTask } from "@/lib/api/hooks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wrench, Plus, Clock, CheckCircle2, XCircle, Search, Package, Calendar, User, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ASSETS = [
  { id: "a1", name: "Elevator — Main Lobby", type: "Mechanical", location: "Lobby", lastService: "2026-04-15", nextService: "2026-07-15", status: "OK" },
  { id: "a2", name: "HVAC Unit — Block A", type: "HVAC", location: "Roof", lastService: "2026-03-20", nextService: "2026-06-20", status: "Due Soon" },
  { id: "a3", name: "Generator — Primary", type: "Electrical", location: "Basement", lastService: "2026-05-01", nextService: "2026-08-01", status: "OK" },
  { id: "a4", name: "Swimming Pool Pump", type: "Plumbing", location: "Pool Area", lastService: "2026-05-10", nextService: "2026-06-10", status: "Overdue" },
  { id: "a5", name: "Fire Suppression System", type: "Safety", location: "All Floors", lastService: "2026-01-15", nextService: "2026-07-15", status: "OK" },
  { id: "a6", name: "Passenger Lift — Tower B", type: "Mechanical", location: "Tower B", lastService: "2026-04-28", nextService: "2026-07-28", status: "OK" },
  { id: "a7", name: "Boiler — Hot Water", type: "Plumbing", location: "Utility Room", lastService: "2026-05-15", nextService: "2026-08-15", status: "OK" },
  { id: "a8", name: "Chiller Plant", type: "HVAC", location: "Basement", lastService: "2026-02-10", nextService: "2026-06-10", status: "Overdue" },
];

const PRIORITY_META: Record<string, { color: string; dot: string }> = {
  Low:      { color: "bg-muted text-muted-foreground",                           dot: "bg-muted-foreground" },
  Normal:   { color: "bg-info/15 text-info border-info/30",                      dot: "bg-info" },
  High:     { color: "bg-warning/15 text-warning-foreground border-warning/30",  dot: "bg-warning" },
  Critical: { color: "bg-destructive/15 text-destructive border-destructive/30", dot: "bg-destructive" },
};

const STATUS_META: Record<string, { color: string; icon: React.ElementType }> = {
  Open:          { color: "bg-warning/15 text-warning-foreground border-warning/30",  icon: Clock },
  "In Progress": { color: "bg-info/15 text-info border-info/30",                      icon: Wrench },
  Resolved:      { color: "bg-success/15 text-success border-success/30",             icon: CheckCircle2 },
  Closed:        { color: "bg-muted text-muted-foreground",                           icon: XCircle },
};

export const Route = createFileRoute("/maintenance")({
  head: () => ({ meta: [{ title: "Maintenance · MHMS" }] }),
  component: Maintenance,
});

function Maintenance() {
  const authed = !!useAuth((s) => s.user);
  const assetsQ = useAssets();
  const createAssetM = useCreateAsset();
  const scheduleQ = useMaintenanceSchedule();
  const createTaskM = useCreateMaintenanceTask();
  const completeTaskM = useCompleteMaintenanceTask();
  const isLive = authed;

  const { maintenance, rooms, addTicket, updateTicket } = useMHMS();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [newOpen, setNewOpen] = useState(false);
  const [newAssetOpen, setNewAssetOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState<typeof maintenance[number] | null>(null);
  const [form, setForm] = useState({ title: "", description: "", priority: "Normal", roomId: "", assignedTo: "" });
  const [newAsset, setNewAsset] = useState({ name: "", category: "", location: "", serial_number: "" });

  const filtered = maintenance.filter((m) => {
    const room = rooms.find((r) => r.id === m.roomId);
    const location = room ? `Room ${room.number}` : "Common Area";
    const matchSearch = m.title.toLowerCase().includes(search.toLowerCase()) || location.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const open = maintenance.filter((m) => m.status === "Open").length;
  const inProgress = maintenance.filter((m) => m.status === "In Progress").length;
  const resolved = maintenance.filter((m) => m.status === "Resolved" || m.status === "Closed").length;
  const critical = maintenance.filter((m) => m.priority === "Critical" && m.status !== "Resolved" && m.status !== "Closed").length;

  const handleCreate = () => {
    if (!form.title) return;
    addTicket({
      title: form.title,
      description: form.description,
      priority: form.priority as any,
      roomId: form.roomId || undefined,
      assignedTo: form.assignedTo || "Unassigned",
      status: "Open",
    });
    toast.success("Ticket created");
    setNewOpen(false);
    setForm({ title: "", description: "", priority: "Normal", roomId: "", assignedTo: "" });
  };

  return (
    <>
      <PageHeader
        title="Maintenance"
        description="Work orders, asset register, and scheduled service"
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setNewOpen(true)}>
            <Plus className="size-4" /> New Ticket
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="Open Tickets" value={open} tone={open > 0 ? "warning" : "success"} hint="Awaiting action" />
        <Stat label="In Progress" value={inProgress} tone="info" hint="Being worked on" />
        <Stat label="Resolved" value={resolved} hint="This period" tone="success" />
        <Stat label="Critical" value={critical} tone={critical > 0 ? "destructive" : "success"} hint="Urgent priority" />
      </div>

      <Tabs defaultValue="tickets">
        <TabsList className="mb-4">
          <TabsTrigger value="tickets"><Wrench className="size-3.5 mr-1.5" />Work Orders</TabsTrigger>
          <TabsTrigger value="assets"><Package className="size-3.5 mr-1.5" />Asset Register</TabsTrigger>
          <TabsTrigger value="schedule"><Calendar className="size-3.5 mr-1.5" />PM Schedule</TabsTrigger>
        </TabsList>

        {/* Work Orders */}
        <TabsContent value="tickets">
          <div className="flex gap-2 mb-3 flex-wrap items-center">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8 h-8 w-52 text-sm" placeholder="Search tickets…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {["All", "Open", "In Progress", "Resolved", "Closed"].map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${statusFilter === s ? "bg-secondary text-secondary-foreground border-secondary" : "hover:border-muted-foreground/40"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((m) => {
              const room = rooms.find((r) => r.id === m.roomId);
              const location = room ? `Room ${room.number}` : "Common Area";
              const pm = PRIORITY_META[m.priority] ?? PRIORITY_META.Normal;
              const sm = STATUS_META[m.status] ?? STATUS_META.Open;
              const StatusIcon = sm.icon;
              return (
                <Card key={m.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailTicket(m)}>
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className={`size-2 rounded-full mt-1.5 shrink-0 ${pm.dot}`} />
                      <div className="min-w-0">
                        <div className="font-medium text-sm leading-tight">{m.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{location}</div>
                      </div>
                    </div>
                    <Badge className={`text-[10px] border shrink-0 ${pm.color}`}>{m.priority}</Badge>
                  </div>
                  {m.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{m.description}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="size-3" />{m.assignedTo ?? "Unassigned"}
                    </div>
                    <Badge className={`text-[10px] border gap-1 ${sm.color}`}>
                      <StatusIcon className="size-2.5" />{m.status}
                    </Badge>
                  </div>
                  <div className="flex gap-1.5 mt-3" onClick={(e) => e.stopPropagation()}>
                    {m.status === "Open" && (
                      <Button size="sm" variant="outline" className="flex-1 h-7"
                        onClick={() => { updateTicket(m.id, { status: "In Progress" }); toast.success("Ticket started"); }}>
                        Start
                      </Button>
                    )}
                    {m.status === "In Progress" && (
                      <Button size="sm" className="flex-1 h-7"
                        onClick={() => { updateTicket(m.id, { status: "Resolved" }); toast.success("Ticket resolved"); }}>
                        <CheckCircle2 className="size-3.5 mr-1" />Resolve
                      </Button>
                    )}
                    {m.status === "Resolved" && (
                      <Button size="sm" variant="outline" className="flex-1 h-7"
                        onClick={() => { updateTicket(m.id, { status: "Closed" }); toast.success("Ticket closed"); }}>
                        Close
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-3 text-center py-12 text-muted-foreground">No tickets match your filters.</div>
            )}
          </div>
        </TabsContent>

        {/* Asset Register */}
        <TabsContent value="assets">
          <div className="flex justify-between items-center mb-3">
            <Badge variant={isLive ? "default" : "outline"} className="text-[10px]">{isLive ? "Live" : "Demo"}</Badge>
            {isLive && <Button size="sm" variant="outline" onClick={() => setNewAssetOpen(true)}><Plus className="size-3.5 mr-1" />Add Asset</Button>}
          </div>
          <Card>
            {isLive && assetsQ.isLoading && <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Asset", "Category", "Location", "Serial", "Status", "Warranty", "Action"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLive && assetsQ.data
                    ? assetsQ.data.map((a) => (
                        <tr key={a.id} className="border-b last:border-0 hover:bg-accent/5">
                          <td className="px-4 py-3 font-medium">{a.name}</td>
                          <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{a.category ?? "—"}</Badge></td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{a.location ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs">{a.serial_number ?? "—"}</td>
                          <td className="px-4 py-3">
                            <Badge className={`text-[10px] ${a.status === "active" ? "bg-success/15 text-success border-success/30" : a.status === "maintenance" ? "bg-warning/15 text-warning-foreground border-warning/30" : "bg-muted text-muted-foreground"}`}>
                              {a.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs">{a.warranty_until?.slice(0, 10) ?? "—"}</td>
                          <td className="px-4 py-3">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                              onClick={() => { createTaskM.mutate({ asset_id: a.id, task_name: `Service: ${a.name}`, frequency: "quarterly", next_due: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10) }, { onSuccess: () => toast.success("Schedule item created") }); }}>
                              Schedule
                            </Button>
                          </td>
                        </tr>
                      ))
                    : ASSETS.map((a) => (
                        <tr key={a.id} className="border-b last:border-0 hover:bg-accent/5">
                          <td className="px-4 py-3 font-medium">{a.name}</td>
                          <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{a.type}</Badge></td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{a.location}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{a.lastService}</td>
                          <td className="px-4 py-3 text-xs font-medium">{a.nextService}</td>
                          <td className="px-4 py-3">
                            <Badge className={`text-[10px] ${a.status === "OK" ? "bg-success/15 text-success border-success/30" : a.status === "Due Soon" ? "bg-warning/15 text-warning-foreground border-warning/30" : "bg-destructive/15 text-destructive border-destructive/30"}`}>
                              {a.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={createTaskM.isPending}
                              onClick={() => isLive
                                ? createTaskM.mutate(
                                    { asset_id: a.id, task_name: `Service: ${a.name}`, frequency: "quarterly", next_due: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10) },
                                    { onSuccess: () => toast.success(`Work order scheduled for ${a.name}`), onError: (e: any) => toast.error(e?.message ?? "Failed to schedule") },
                                  )
                                : toast.success(`Work order created for ${a.name}`)}>Schedule</Button>
                          </td>
                        </tr>
                      ))
                  }
                  {isLive && assetsQ.data?.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No assets registered yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* PM Schedule */}
        <TabsContent value="schedule">
          {isLive && scheduleQ.isLoading && <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {isLive && scheduleQ.data
              ? scheduleQ.data.filter((s) => !s.completed).map((s) => {
                  const isOverdue = s.next_due < new Date().toISOString().slice(0, 10);
                  return (
                    <Card key={s.id} className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium text-sm">{s.task_name}</div>
                          <div className="text-xs text-muted-foreground">{s.asset_name ?? "General"} · {s.frequency}</div>
                        </div>
                        <Badge className={`text-[10px] ${isOverdue ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning-foreground"}`}>
                          {isOverdue ? "Overdue" : "Due Soon"}
                        </Badge>
                      </div>
                      {s.assigned_to && <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><User className="size-3" />{s.assigned_to}</div>}
                      <div className="text-xs text-muted-foreground mb-3">
                        Next due: <span className="font-medium text-foreground">{s.next_due}</span>
                        {s.last_done && ` · Last done: ${s.last_done}`}
                      </div>
                      <Button size="sm" className="w-full h-7" disabled={completeTaskM.isPending}
                        onClick={() => completeTaskM.mutate(s.id, { onSuccess: () => toast.success("Task marked complete") })}>
                        <CheckCircle2 className="size-3.5 mr-1" />Mark Complete
                      </Button>
                    </Card>
                  );
                })
              : ASSETS.filter((a) => a.status !== "OK").map((a) => (
                  <Card key={a.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium text-sm">{a.name}</div>
                        <div className="text-xs text-muted-foreground">{a.type} · {a.location}</div>
                      </div>
                      <Badge className={`text-[10px] ${a.status === "Overdue" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning-foreground"}`}>
                        {a.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mb-3">
                      Next service: <span className="font-medium text-foreground">{a.nextService}</span>
                    </div>
                    <Button size="sm" className="w-full h-7" onClick={() => toast.success(`PM scheduled for ${a.name}`)}>
                      Schedule PM Now
                    </Button>
                  </Card>
                ))
            }
            {isLive && scheduleQ.data?.filter((s) => !s.completed).length === 0 && (
              <Card className="col-span-2 p-12 text-center text-muted-foreground">All schedule items are on track.</Card>
            )}
            {!isLive && ASSETS.filter((a) => a.status !== "OK").length === 0 && (
              <Card className="col-span-2 p-12 text-center text-muted-foreground">All assets are on schedule.</Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      {detailTicket && (
        <Dialog open={!!detailTicket} onOpenChange={() => setDetailTicket(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{detailTicket.title}</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-xs text-muted-foreground">Priority</span><div><Badge className={`text-[10px] mt-1 ${PRIORITY_META[detailTicket.priority]?.color}`}>{detailTicket.priority}</Badge></div></div>
                <div><span className="text-xs text-muted-foreground">Status</span><div><Badge className={`text-[10px] mt-1 ${STATUS_META[detailTicket.status]?.color}`}>{detailTicket.status}</Badge></div></div>
                <div><span className="text-xs text-muted-foreground">Assigned To</span><div className="font-medium mt-0.5">{detailTicket.assignedTo ?? "Unassigned"}</div></div>
                <div><span className="text-xs text-muted-foreground">Created</span><div className="mt-0.5">{detailTicket.createdAt}</div></div>
              </div>
              {detailTicket.description && (
                <div>
                  <span className="text-xs text-muted-foreground">Description</span>
                  <p className="mt-1 text-sm bg-muted/50 rounded p-2">{detailTicket.description}</p>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                {detailTicket.status === "Open" && (
                  <Button className="flex-1" size="sm" onClick={() => { updateTicket(detailTicket.id, { status: "In Progress" }); setDetailTicket(null); toast.success("Started"); }}>Start Work</Button>
                )}
                {detailTicket.status === "In Progress" && (
                  <Button className="flex-1" size="sm" onClick={() => { updateTicket(detailTicket.id, { status: "Resolved" }); setDetailTicket(null); toast.success("Resolved"); }}>Mark Resolved</Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Asset Dialog */}
      <Dialog open={newAssetOpen} onOpenChange={setNewAssetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Asset</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Asset Name *</Label><Input className="h-8 mt-1" placeholder="e.g. Elevator - Main Lobby" value={newAsset.name} onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Category</Label><Input className="h-8 mt-1" placeholder="HVAC, Electrical…" value={newAsset.category} onChange={(e) => setNewAsset({ ...newAsset, category: e.target.value })} /></div>
              <div><Label className="text-xs">Location</Label><Input className="h-8 mt-1" placeholder="Roof, Basement…" value={newAsset.location} onChange={(e) => setNewAsset({ ...newAsset, location: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Serial Number</Label><Input className="h-8 mt-1" value={newAsset.serial_number} onChange={(e) => setNewAsset({ ...newAsset, serial_number: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewAssetOpen(false)}>Cancel</Button>
            <Button disabled={!newAsset.name || createAssetM.isPending}
              onClick={() => {
                createAssetM.mutate(
                  { name: newAsset.name, category: newAsset.category || undefined, location: newAsset.location || undefined, serial_number: newAsset.serial_number || undefined },
                  {
                    onSuccess: () => { toast.success("Asset added"); setNewAssetOpen(false); setNewAsset({ name: "", category: "", location: "", serial_number: "" }); },
                    onError: (e: any) => toast.error(e.message ?? "Failed to add asset"),
                  }
                );
              }}>
              {createAssetM.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Add Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Ticket Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Maintenance Ticket</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Title *</Label>
              <Input className="h-8 mt-1" placeholder="e.g. AC not cooling in Room 204" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea className="mt-1 text-sm" rows={2} placeholder="Additional details…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Low", "Normal", "High", "Critical"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Room (optional)</Label>
                <Select value={form.roomId} onValueChange={(v) => setForm({ ...form, roomId: v })}>
                  <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Common Area" /></SelectTrigger>
                  <SelectContent>
                    {rooms.map((r) => <SelectItem key={r.id} value={r.id}>Room {r.number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Assign To</Label>
              <Input className="h-8 mt-1" placeholder="e.g. Ravi Technician" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button className="flex-1" disabled={!form.title} onClick={handleCreate}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
