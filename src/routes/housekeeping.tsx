import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, roomStatusMeta, type RoomStatus } from "@/lib/mhms-store";
import { useAuth } from "@/lib/api/auth";
import { useRooms, useHousekeepingTasks, useUpdateHousekeepingTask, useUpdateRoomStatus } from "@/lib/api/hooks";
import type { RoomStatus as ApiRoomStatus } from "@/lib/api/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, CheckCircle2, Package, Users, LayoutGrid, ClipboardList, AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/housekeeping")({
  head: () => ({ meta: [{ title: "Housekeeping · MHMS" }] }),
  component: Housekeeping,
});

const apiRoomStatusToDemo: Record<ApiRoomStatus, RoomStatus> = {
  available: "vacant_clean", occupied: "occupied", cleaning: "vacant_dirty", maintenance: "maintenance",
};

interface GridCell { id: string; number: string; type: string; floor: number; status: RoomStatus; lastCleaned?: string; }

const HK_STAFF = [
  { id: "s1", name: "Sunita Rao",    shift: "Morning", floor: 1, tasksToday: 8, done: 6 },
  { id: "s2", name: "Meena Pillai",  shift: "Morning", floor: 2, tasksToday: 7, done: 7 },
  { id: "s3", name: "Ritu Sharma",   shift: "Morning", floor: 3, tasksToday: 6, done: 4 },
  { id: "s4", name: "Lakshmi T.",    shift: "Evening", floor: 4, tasksToday: 5, done: 2 },
  { id: "s5", name: "Priya Nair",    shift: "Evening", floor: 5, tasksToday: 4, done: 1 },
  { id: "s6", name: "Anita Desai",   shift: "Night",   floor: 1, tasksToday: 3, done: 0 },
];

const INITIAL_LOST_FOUND = [
  { id: "lf1", date: "2026-06-15", item: "Silver wristwatch",   location: "Room 204", foundBy: "Sunita Rao",   status: "Logged",   claimant: "" },
  { id: "lf2", date: "2026-06-16", item: "Blue umbrella",        location: "Lobby",    foundBy: "Reception",   status: "Claimed",  claimant: "Mr. Kumar" },
  { id: "lf3", date: "2026-06-17", item: "iPhone charger cable", location: "Room 312", foundBy: "Ritu Sharma", status: "Logged",   claimant: "" },
  { id: "lf4", date: "2026-06-14", item: "Reading glasses",      location: "Pool deck", foundBy: "Security",   status: "Disposed", claimant: "" },
];

function Housekeeping() {
  const authed = !!useAuth((s) => s.user);
  const liveRooms = useRooms();
  const liveTasks = useHousekeepingTasks();
  const isLive = authed && !!liveRooms.data;
  const updateRoomM = useUpdateRoomStatus();
  const updateTaskM = useUpdateHousekeepingTask();
  const { rooms, tasks, setRoomStatus, updateTask, addTask } = useMHMS();

  const [newOpen, setNewOpen] = useState(false);
  const [task, setTask] = useState({ roomId: rooms[0]?.id ?? "", type: "Cleaning" as const, priority: "Normal" as const, assignedTo: "" });
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [floorFilter, setFloorFilter] = useState<number | null>(null);
  const [lostFound, setLostFound] = useState(INITIAL_LOST_FOUND);
  const [lfOpen, setLfOpen] = useState(false);
  const [newLf, setNewLf] = useState({ item: "", location: "", foundBy: "" });
  const [staffAssignments, setStaffAssignments] = useState<Record<string, number>>(
    () => Object.fromEntries(HK_STAFF.map((s) => [s.id, s.floor]))
  );

  // Normalized room grid
  const cells: GridCell[] = useMemo(() => {
    if (isLive) return (liveRooms.data ?? []).map((r) => ({
      id: r.id, number: r.room_number, type: r.room_type || "Room",
      floor: r.floor, status: apiRoomStatusToDemo[r.status] ?? "vacant_clean",
    }));
    return rooms.map((r) => ({ id: r.id, number: r.number, type: r.type, floor: r.floor, status: r.status, lastCleaned: r.lastCleaned }));
  }, [isLive, liveRooms.data, rooms]);

  const floors = useMemo(() => [...new Set(cells.map((c) => c.floor))].sort((a, b) => a - b), [cells]);
  const filteredCells = floorFilter !== null ? cells.filter((c) => c.floor === floorFilter) : cells;

  const counts = (s: RoomStatus) => cells.filter((r) => r.status === s).length;

  const setLiveRoom = (id: string, demoStatus: RoomStatus, number: string) => {
    const apiStatus = (Object.entries(apiRoomStatusToDemo).find(([, v]) => v === demoStatus)?.[0] ?? "available") as ApiRoomStatus;
    updateRoomM.mutate({ id, status: apiStatus }, { onSuccess: () => toast.success(`Room ${number} → ${roomStatusMeta[demoStatus].label}`) });
  };

  // Normalized tasks
  const taskRows = useMemo(() => {
    const kindOf = (s: string): "pending" | "in_progress" | "completed" => {
      const k = s.toLowerCase().replace(/\s+/g, "_");
      return k === "completed" ? "completed" : k === "in_progress" ? "in_progress" : "pending";
    };
    if (isLive) return (liveTasks.data ?? []).map((t) => ({
      id: t.id, roomNumber: t.room?.room_number ?? "—", type: t.task_type, priority: t.priority,
      assigned: t.assigned_staff?.full_name ?? t.assigned_to ?? "—", kind: kindOf(t.status), statusLabel: t.status,
    }));
    return tasks.map((t) => ({
      id: t.id, roomNumber: rooms.find((x) => x.id === t.roomId)?.number ?? "—", type: t.type,
      priority: t.priority, assigned: t.assignedTo ?? "—", kind: kindOf(t.status), statusLabel: t.status,
    }));
  }, [isLive, liveTasks.data, tasks, rooms]);

  const filteredTasks = taskRows.filter((t) => {
    const matchP = priorityFilter === "All" || t.priority === priorityFilter || t.priority.toLowerCase() === priorityFilter.toLowerCase();
    const matchS = statusFilter === "All" || t.kind === statusFilter;
    return matchP && matchS;
  });

  const pendingCount = taskRows.filter((t) => t.kind !== "completed").length;
  const completedToday = taskRows.filter((t) => t.kind === "completed").length;

  const priorityDot = (p: string) => {
    if (p === "High" || p === "high" || p === "Urgent" || p === "urgent") return "bg-destructive";
    if (p === "Normal" || p === "normal") return "bg-info";
    return "bg-muted-foreground";
  };

  // Floor summary data
  const floorData = useMemo(() => floors.map((f) => {
    const fr = cells.filter((c) => c.floor === f);
    return {
      floor: f, total: fr.length,
      clean: fr.filter((c) => c.status === "vacant_clean").length,
      dirty: fr.filter((c) => c.status === "vacant_dirty").length,
      occupied: fr.filter((c) => c.status === "occupied").length,
      maintenance: fr.filter((c) => c.status === "maintenance").length,
    };
  }), [floors, cells]);

  return (
    <>
      <PageHeader
        title="Housekeeping"
        description="Room status, tasks, staff assignments and lost & found"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={isLive ? "default" : "outline"}>{isLive ? "Live" : "Demo"}</Badge>
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
              <DialogTrigger asChild>
                <Button disabled={isLive} size="sm"><Plus className="size-4" /> New Task</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Housekeeping Task</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Room</Label>
                    <Select value={task.roomId} onValueChange={(v) => setTask({ ...task, roomId: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-72">{rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.number} · {r.type}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={task.type} onValueChange={(v) => setTask({ ...task, type: v as never })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{["Cleaning", "Turndown", "Deep Clean", "Inspection"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={task.priority} onValueChange={(v) => setTask({ ...task, priority: v as never })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{["Low", "Normal", "High", "Urgent"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Assign to</Label>
                    <Select value={task.assignedTo} onValueChange={(v) => setTask({ ...task, assignedTo: v })}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select staff" /></SelectTrigger>
                      <SelectContent>{HK_STAFF.map((s) => <SelectItem key={s.id} value={s.name}>{s.name} ({s.shift})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
                  <Button onClick={() => { addTask({ ...task, status: "Pending" }); toast.success("Task created"); setNewOpen(false); }}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <Stat label="Clean" value={counts("vacant_clean")} tone="success" />
        <Stat label="Dirty" value={counts("vacant_dirty")} tone="warning" />
        <Stat label="Occupied" value={counts("occupied")} tone="info" />
        <Stat label="Maintenance" value={counts("maintenance")} tone="destructive" />
        <Stat label="Tasks Pending" value={pendingCount} hint={`${completedToday} done today`} />
      </div>

      <Tabs defaultValue="grid">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="grid"><LayoutGrid className="size-3.5 mr-1.5" />Room Grid</TabsTrigger>
          <TabsTrigger value="floors">Floor View</TabsTrigger>
          <TabsTrigger value="tasks">
            <ClipboardList className="size-3.5 mr-1.5" />Tasks
            {pendingCount > 0 && <Badge variant="destructive" className="ml-1.5 size-4 p-0 grid place-items-center text-[10px]">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="staff"><Users className="size-3.5 mr-1.5" />Staff</TabsTrigger>
          <TabsTrigger value="lostfound"><Package className="size-3.5 mr-1.5" />Lost & Found</TabsTrigger>
        </TabsList>

        {/* ── ROOM GRID ──────────────────────────────────────────────────────── */}
        <TabsContent value="grid">
          <div className="flex gap-1.5 mb-3 flex-wrap items-center">
            <span className="text-xs text-muted-foreground">Floor:</span>
            <button onClick={() => setFloorFilter(null)}
              className={`px-2.5 py-1 rounded text-xs font-medium border transition ${floorFilter === null ? "bg-secondary text-secondary-foreground" : "hover:border-muted-foreground/40"}`}>All</button>
            {floors.map((f) => (
              <button key={f} onClick={() => setFloorFilter(f)}
                className={`px-2.5 py-1 rounded text-xs font-medium border transition ${floorFilter === f ? "bg-secondary text-secondary-foreground" : "hover:border-muted-foreground/40"}`}>{f}F</button>
            ))}
          </div>
          <Card className="p-4">
            <div className="grid grid-cols-6 md:grid-cols-10 lg:grid-cols-14 gap-2">
              {filteredCells.map((r) => (
                <Dialog key={r.id}>
                  <DialogTrigger asChild>
                    <button className={`border rounded-md p-2 text-center hover:shadow transition ${roomStatusMeta[r.status].color}`}>
                      <div className="font-mono text-sm font-semibold">{r.number}</div>
                      <div className="text-[10px] opacity-80">{r.type[0]}</div>
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Room {r.number} · {r.type}</DialogTitle></DialogHeader>
                    <div className="space-y-2 text-sm">
                      <div>Status: <Badge variant="outline" className={roomStatusMeta[r.status].color}>{roomStatusMeta[r.status].label}</Badge></div>
                      <div>Floor: {r.floor}</div>
                      {!isLive && <div>Last cleaned: {r.lastCleaned ?? "—"}</div>}
                    </div>
                    <DialogFooter className="flex-wrap gap-2">
                      {(["vacant_clean", "vacant_dirty", "occupied", "maintenance", "blocked"] as RoomStatus[]).map((s) => (
                        <Button key={s} variant="outline" size="sm" disabled={updateRoomM.isPending}
                          onClick={() => { isLive ? setLiveRoom(r.id, s, r.number) : (setRoomStatus(r.id, s), toast.success(`Room ${r.number} → ${roomStatusMeta[s].label}`)); }}>
                          {roomStatusMeta[s].label}
                        </Button>
                      ))}
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
            <div className="flex gap-3 mt-4 text-xs flex-wrap">
              {(Object.keys(roomStatusMeta) as RoomStatus[]).map((s) => (
                <div key={s} className="flex items-center gap-1.5">
                  <span className={`size-3 rounded ${roomStatusMeta[s].color}`} />
                  {roomStatusMeta[s].label}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* ── FLOOR VIEW ─────────────────────────────────────────────────────── */}
        <TabsContent value="floors">
          <div className="space-y-3">
            {floorData.map((f) => {
              const pct = Math.round((f.clean / f.total) * 100);
              return (
                <Card key={f.floor} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">Floor {f.floor}</h3>
                      <p className="text-xs text-muted-foreground">{f.total} rooms total</p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <Badge className="bg-success/15 text-success border-success/30">{f.clean} clean</Badge>
                      <Badge className="bg-warning/15 text-warning-foreground border-warning/30">{f.dirty} dirty</Badge>
                      <Badge className="bg-info/15 text-info border-info/30">{f.occupied} occ.</Badge>
                      {f.maintenance > 0 && <Badge className="bg-destructive/15 text-destructive border-destructive/30">{f.maintenance} maint.</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={pct} className="flex-1 h-2" />
                    <span className="text-xs font-medium w-12 text-right">{pct}% clean</span>
                  </div>
                  <div className="grid grid-cols-8 sm:grid-cols-12 gap-1.5 mt-3">
                    {cells.filter((c) => c.floor === f.floor).map((r) => (
                      <div key={r.id} title={`${r.number} — ${roomStatusMeta[r.status].label}`}
                        className={`border rounded p-1 text-center ${roomStatusMeta[r.status].color}`}>
                        <div className="font-mono text-[10px] font-bold">{r.number}</div>
                      </div>
                    ))}
                  </div>
                  {/* Staff on this floor */}
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {HK_STAFF.filter((s) => staffAssignments[s.id] === f.floor).map((s) => (
                      <div key={s.id} className="text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
                        {s.name} · {s.shift}
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── TASKS ──────────────────────────────────────────────────────────── */}
        <TabsContent value="tasks">
          <div className="flex gap-2 mb-3 flex-wrap">
            {["All", "Low", "Normal", "High", "Urgent"].map((p) => (
              <button key={p} onClick={() => setPriorityFilter(p)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition ${priorityFilter === p ? "bg-secondary text-secondary-foreground border-secondary" : "hover:border-muted-foreground/40"}`}>{p}</button>
            ))}
            <div className="ml-auto flex gap-1.5">
              {["All", "pending", "in_progress", "completed"].map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition ${statusFilter === s ? "bg-secondary text-secondary-foreground border-secondary" : "hover:border-muted-foreground/40"}`}>
                  {s === "All" ? "All" : s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {["", "Room", "Type", "Priority", "Assigned", "Status", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((t) => (
                  <tr key={t.id} className={`border-b last:border-0 hover:bg-accent/5 ${t.kind === "completed" ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3"><div className={`size-2 rounded-full ${priorityDot(t.priority)}`} /></td>
                    <td className="px-4 py-3 font-mono text-xs">{t.roomNumber}</td>
                    <td className="px-4 py-3">{t.type}</td>
                    <td className="px-4 py-3">
                      <Badge variant={t.priority === "High" || t.priority === "high" || t.priority === "Urgent" || t.priority === "urgent" ? "destructive" : "secondary"} className="text-[10px]">
                        {t.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{t.assigned}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-[10px] ${t.kind === "completed" ? "bg-success/15 text-success border-success/30" : t.kind === "in_progress" ? "bg-info/15 text-info border-info/30" : ""}`}>
                        {t.statusLabel}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 space-x-1">
                      {t.kind !== "completed" && (
                        <>
                          {t.kind === "pending" && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={updateTaskM.isPending}
                              onClick={() => { isLive ? updateTaskM.mutate({ id: t.id, patch: { status: "in_progress" } }, { onSuccess: () => toast.success("Started") }) : (updateTask(t.id, { status: "In Progress" }), toast.success("Started")); }}>
                              Start
                            </Button>
                          )}
                          <Button size="sm" className="h-7 px-2 text-xs" disabled={updateTaskM.isPending}
                            onClick={() => { isLive ? updateTaskM.mutate({ id: t.id, patch: { status: "completed" } }, { onSuccess: () => toast.success("Completed") }) : (updateTask(t.id, { status: "Completed" }), toast.success("Task complete")); }}>
                            <CheckCircle2 className="size-3 mr-1" />Done
                          </Button>
                        </>
                      )}
                      {t.kind === "completed" && <CheckCircle2 className="size-4 text-success mx-2" />}
                    </td>
                  </tr>
                ))}
                {filteredTasks.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No tasks match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* ── STAFF ──────────────────────────────────────────────────────────── */}
        <TabsContent value="staff">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Staff", "Shift", "Assigned Floor", "Tasks Today", "Completed", "Progress"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HK_STAFF.map((s) => {
                    const pct = s.tasksToday > 0 ? Math.round((s.done / s.tasksToday) * 100) : 0;
                    return (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-accent/5">
                        <td className="px-4 py-3 font-medium">{s.name}</td>
                        <td className="px-4 py-3">
                          <Badge className={`text-[10px] ${s.shift === "Morning" ? "bg-warning/20 text-warning-foreground" : s.shift === "Evening" ? "bg-info/15 text-info" : "bg-muted text-muted-foreground"}`}>
                            {s.shift}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Select value={String(staffAssignments[s.id])} onValueChange={(v) => { setStaffAssignments((p) => ({ ...p, [s.id]: Number(v) })); toast.success(`${s.name} moved to floor ${v}`); }}>
                            <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{floors.map((f) => <SelectItem key={f} value={String(f)}>Floor {f}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3 text-center">{s.tasksToday}</td>
                        <td className="px-4 py-3 text-center">{s.done}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="flex-1 h-2" />
                            <span className="text-xs w-8 text-right">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ── LOST & FOUND ───────────────────────────────────────────────────── */}
        <TabsContent value="lostfound">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">{lostFound.filter((l) => l.status === "Logged").length} open items</p>
            <Button size="sm" className="gap-1.5" onClick={() => setLfOpen(true)}><Plus className="size-4" />Log Item</Button>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Date", "Item", "Found At", "Found By", "Status", "Claimant", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lostFound.map((item) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-accent/5">
                      <td className="px-4 py-3 text-xs text-muted-foreground">{item.date}</td>
                      <td className="px-4 py-3 font-medium">{item.item}</td>
                      <td className="px-4 py-3 text-xs">{item.location}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{item.foundBy}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] ${item.status === "Claimed" ? "bg-success/15 text-success" : item.status === "Disposed" ? "bg-muted text-muted-foreground" : "bg-warning/20 text-warning-foreground"}`}>
                          {item.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs">{item.claimant || "—"}</td>
                      <td className="px-4 py-3">
                        {item.status === "Logged" && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                            onClick={() => { const name = prompt("Claimant name:"); if (name) { setLostFound((p) => p.map((x) => x.id === item.id ? { ...x, status: "Claimed", claimant: name } : x)); toast.success("Item claimed"); } }}>
                            Mark Claimed
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {lostFound.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No items logged.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Log Lost & Found dialog */}
      <Dialog open={lfOpen} onOpenChange={setLfOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Log Lost & Found Item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Item Description *</Label><Input className="h-8 mt-1" placeholder="e.g. Silver wristwatch" value={newLf.item} onChange={(e) => setNewLf({ ...newLf, item: e.target.value })} /></div>
            <div><Label className="text-xs">Found At *</Label><Input className="h-8 mt-1" placeholder="e.g. Room 204, Lobby" value={newLf.location} onChange={(e) => setNewLf({ ...newLf, location: e.target.value })} /></div>
            <div><Label className="text-xs">Found By</Label><Input className="h-8 mt-1" placeholder="Staff name" value={newLf.foundBy} onChange={(e) => setNewLf({ ...newLf, foundBy: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLfOpen(false)}>Cancel</Button>
            <Button disabled={!newLf.item || !newLf.location}
              onClick={() => {
                setLostFound((p) => [...p, { id: `lf${Date.now()}`, date: new Date().toISOString().slice(0, 10), item: newLf.item, location: newLf.location, foundBy: newLf.foundBy || "Staff", status: "Logged", claimant: "" }]);
                toast.success("Item logged"); setLfOpen(false); setNewLf({ item: "", location: "", foundBy: "" });
              }}>Log Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
