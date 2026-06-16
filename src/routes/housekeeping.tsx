import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, roomStatusMeta, type RoomStatus } from "@/lib/mhms-store";
import { useAuth } from "@/lib/api/auth";
import {
  useRooms,
  useHousekeepingTasks,
  useUpdateHousekeepingTask,
  useUpdateRoomStatus,
} from "@/lib/api/hooks";
import type { RoomStatus as ApiRoomStatus } from "@/lib/api/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/housekeeping")({
  head: () => ({ meta: [{ title: "Housekeeping · MHMS" }] }),
  component: Housekeeping,
});

// Live API room status -> demo roomStatusMeta key (for consistent colours/labels).
const apiRoomStatusToDemo: Record<ApiRoomStatus, RoomStatus> = {
  available: "vacant_clean",
  occupied: "occupied",
  cleaning: "vacant_dirty",
  maintenance: "maintenance",
};

interface GridCell {
  id: string;
  number: string;
  type: string;
  floor: number;
  status: RoomStatus;
  lastCleaned?: string;
}

function Housekeeping() {
  const authed = !!useAuth((s) => s.user);
  const liveRooms = useRooms();
  const liveTasks = useHousekeepingTasks();
  const isLive = authed && !!liveRooms.data;
  const updateRoomM = useUpdateRoomStatus();
  const updateTaskM = useUpdateHousekeepingTask();

  const { rooms, tasks, setRoomStatus, updateTask, addTask } = useMHMS();
  const [newOpen, setNewOpen] = useState(false);
  const [task, setTask] = useState({
    roomId: rooms[0]?.id ?? "",
    type: "Cleaning" as const,
    priority: "Normal" as const,
    assignedTo: "",
  });

  // Normalized room grid cells from whichever source is active.
  const cells: GridCell[] = useMemo(() => {
    if (isLive) {
      return (liveRooms.data ?? []).map((r) => ({
        id: r.id,
        number: r.room_number,
        type: r.room_type || "Room",
        floor: r.floor,
        status: apiRoomStatusToDemo[r.status] ?? "vacant_clean",
      }));
    }
    return rooms.map((r) => ({
      id: r.id,
      number: r.number,
      type: r.type,
      floor: r.floor,
      status: r.status,
      lastCleaned: r.lastCleaned,
    }));
  }, [isLive, liveRooms.data, rooms]);

  const counts = (s: RoomStatus) => cells.filter((r) => r.status === s).length;

  // Set live room status using the API's enum (reverse of the display map).
  const setLiveRoom = (id: string, demoStatus: RoomStatus, number: string) => {
    const apiStatus = (Object.entries(apiRoomStatusToDemo).find(([, v]) => v === demoStatus)?.[0] ??
      "available") as ApiRoomStatus;
    updateRoomM.mutate(
      { id, status: apiStatus },
      { onSuccess: () => toast.success(`Room ${number} set ${roomStatusMeta[demoStatus].label}`) },
    );
  };

  // Normalized task rows (live tasks have lowercase statuses; demo uses Title Case).
  const taskRows = useMemo(() => {
    const kindOf = (s: string): "pending" | "in_progress" | "completed" => {
      const k = s.toLowerCase().replace(/\s+/g, "_");
      return k === "completed" ? "completed" : k === "in_progress" ? "in_progress" : "pending";
    };
    if (isLive) {
      return (liveTasks.data ?? []).map((t) => ({
        id: t.id,
        roomNumber: t.room?.room_number ?? "—",
        type: t.task_type,
        priority: t.priority,
        assigned: t.assigned_staff?.full_name ?? t.assigned_to ?? "—",
        kind: kindOf(t.status),
        statusLabel: t.status,
      }));
    }
    return tasks.map((t) => ({
      id: t.id,
      roomNumber: rooms.find((x) => x.id === t.roomId)?.number ?? "—",
      type: t.type,
      priority: t.priority,
      assigned: t.assignedTo ?? "—",
      kind: kindOf(t.status),
      statusLabel: t.status,
    }));
  }, [isLive, liveTasks.data, tasks, rooms]);

  return (
    <>
      <PageHeader
        title="Housekeeping"
        description="Room status, cleaning tasks, inspections"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={isLive ? "default" : "outline"} className="self-center">
              {isLive ? "Live data" : "Demo data"}
            </Badge>
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
              <DialogTrigger asChild>
                <Button
                  disabled={isLive}
                  title={isLive ? "Create tasks from the live system" : undefined}
                >
                  <Plus className="size-4" /> New task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create cleaning task</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Room</Label>
                    <Select
                      value={task.roomId}
                      onValueChange={(v) => setTask({ ...task, roomId: v })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {rooms.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.number} · {r.type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={task.type}
                      onValueChange={(v) => setTask({ ...task, type: v as never })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Cleaning", "Turndown", "Deep Clean", "Inspection"].map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select
                      value={task.priority}
                      onValueChange={(v) => setTask({ ...task, priority: v as never })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Low", "Normal", "High", "Urgent"].map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Assign to</Label>
                    <Input
                      className="mt-1"
                      value={task.assignedTo}
                      onChange={(e) => setTask({ ...task, assignedTo: e.target.value })}
                      placeholder="Staff name"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNewOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      addTask({ ...task, status: "Pending" });
                      toast.success("Task created");
                      setNewOpen(false);
                    }}
                  >
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Stat label="Clean" value={counts("vacant_clean")} tone="success" />
        <Stat label="Dirty" value={counts("vacant_dirty")} tone="warning" />
        <Stat label="Occupied" value={counts("occupied")} tone="info" />
        <Stat label="Maintenance" value={counts("maintenance")} tone="destructive" />
        <Stat
          label="Pending Tasks"
          value={
            isLive
              ? (liveTasks.data ?? []).filter((t) => t.status !== "completed").length
              : tasks.filter((t) => t.status !== "Completed").length
          }
        />
      </div>

      <Tabs defaultValue="grid">
        <TabsList>
          <TabsTrigger value="grid">Room Grid</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>
        <TabsContent value="grid">
          <Card className="p-4 mt-4">
            <div className="grid grid-cols-6 md:grid-cols-10 gap-2">
              {cells.map((r) => (
                <Dialog key={r.id}>
                  <DialogTrigger asChild>
                    <button
                      className={`border rounded-md p-2 text-center hover:shadow transition ${roomStatusMeta[r.status].color}`}
                    >
                      <div className="font-mono text-sm font-semibold">{r.number}</div>
                      <div className="text-[10px] opacity-80">{r.type[0]}</div>
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        Room {r.number} · {r.type}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 text-sm">
                      <div>
                        Status:{" "}
                        <Badge variant="outline" className={roomStatusMeta[r.status].color}>
                          {roomStatusMeta[r.status].label}
                        </Badge>
                      </div>
                      <div>Floor: {r.floor}</div>
                      {!isLive && <div>Last cleaned: {r.lastCleaned ?? "—"}</div>}
                    </div>
                    <DialogFooter className="flex-wrap gap-2">
                      {(isLive
                        ? ([
                            "vacant_clean",
                            "vacant_dirty",
                            "occupied",
                            "maintenance",
                          ] as RoomStatus[])
                        : ([
                            "vacant_clean",
                            "vacant_dirty",
                            "maintenance",
                            "blocked",
                          ] as RoomStatus[])
                      ).map((s) => (
                        <Button
                          key={s}
                          variant="outline"
                          size="sm"
                          disabled={updateRoomM.isPending}
                          onClick={() => {
                            isLive
                              ? setLiveRoom(r.id, s, r.number)
                              : (setRoomStatus(r.id, s),
                                toast.success(`Room ${r.number} set ${roomStatusMeta[s].label}`));
                          }}
                        >
                          Mark {roomStatusMeta[s].label}
                        </Button>
                      ))}
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
            <div className="flex gap-3 mt-4 text-xs">
              {(Object.keys(roomStatusMeta) as RoomStatus[]).map((s) => (
                <div key={s} className="flex items-center gap-1.5">
                  <span className={`size-3 rounded ${roomStatusMeta[s].color}`} />
                  {roomStatusMeta[s].label}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="tasks">
          <Card className="p-4 mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taskRows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono">{t.roomNumber}</TableCell>
                    <TableCell>{t.type}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.priority === "High" ||
                          t.priority === "Urgent" ||
                          t.priority === "high" ||
                          t.priority === "urgent"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {t.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>{t.assigned}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          t.kind === "completed"
                            ? "bg-success/15 text-success border-success/30"
                            : t.kind === "in_progress"
                              ? "bg-info/15 text-info border-info/30"
                              : ""
                        }
                      >
                        {t.statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2">
                      {t.kind !== "completed" && (
                        <>
                          {t.kind === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updateTaskM.isPending}
                              onClick={() => {
                                isLive
                                  ? updateTaskM.mutate(
                                      { id: t.id, patch: { status: "in_progress" } },
                                      { onSuccess: () => toast.success("Started") },
                                    )
                                  : (updateTask(t.id, { status: "In Progress" }),
                                    toast.success("Started"));
                              }}
                            >
                              Start
                            </Button>
                          )}
                          <Button
                            size="sm"
                            disabled={updateTaskM.isPending}
                            onClick={() => {
                              isLive
                                ? updateTaskM.mutate(
                                    { id: t.id, patch: { status: "completed" } },
                                    { onSuccess: () => toast.success("Task completed") },
                                  )
                                : (updateTask(t.id, { status: "Completed" }),
                                  toast.success("Task completed; room cleaned"));
                            }}
                          >
                            <CheckCircle2 className="size-4" /> Complete
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {taskRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No housekeeping tasks
                    </TableCell>
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
