import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, roomStatusMeta, type RoomStatus } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/housekeeping")({
  head: () => ({ meta: [{ title: "Housekeeping · MHMS" }] }),
  component: Housekeeping,
});

function Housekeeping() {
  const { rooms, tasks, setRoomStatus, updateTask, addTask } = useMHMS();
  const [newOpen, setNewOpen] = useState(false);
  const [task, setTask] = useState({ roomId: rooms[0]?.id ?? "", type: "Cleaning" as const, priority: "Normal" as const, assignedTo: "" });

  const counts = (s: RoomStatus) => rooms.filter(r => r.status === s).length;

  return (
    <>
      <PageHeader title="Housekeeping" description="Room status, cleaning tasks, inspections" actions={
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4" /> New task</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create cleaning task</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Room</Label>
                <Select value={task.roomId} onValueChange={(v) => setTask({ ...task, roomId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {rooms.map(r => <SelectItem key={r.id} value={r.id}>{r.number} · {r.type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Type</Label>
                <Select value={task.type} onValueChange={(v) => setTask({ ...task, type: v as never })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Cleaning","Turndown","Deep Clean","Inspection"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Priority</Label>
                <Select value={task.priority} onValueChange={(v) => setTask({ ...task, priority: v as never })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Low","Normal","High","Urgent"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Assign to</Label>
                <Input className="mt-1" value={task.assignedTo} onChange={(e) => setTask({ ...task, assignedTo: e.target.value })} placeholder="Staff name" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button onClick={() => { addTask({ ...task, status: "Pending" }); toast.success("Task created"); setNewOpen(false); }}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Stat label="Clean" value={counts("vacant_clean")} tone="success" />
        <Stat label="Dirty" value={counts("vacant_dirty")} tone="warning" />
        <Stat label="Occupied" value={counts("occupied")} tone="info" />
        <Stat label="Maintenance" value={counts("maintenance")} tone="destructive" />
        <Stat label="Pending Tasks" value={tasks.filter(t => t.status !== "Completed").length} />
      </div>

      <Tabs defaultValue="grid">
        <TabsList>
          <TabsTrigger value="grid">Room Grid</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>
        <TabsContent value="grid">
          <Card className="p-4 mt-4">
            <div className="grid grid-cols-6 md:grid-cols-10 gap-2">
              {rooms.map((r) => (
                <Dialog key={r.id}>
                  <DialogTrigger asChild>
                    <button className={`border rounded-md p-2 text-center hover:shadow transition ${roomStatusMeta[r.status].color}`}>
                      <div className="font-mono text-sm font-semibold">{r.number}</div>
                      <div className="text-[10px] opacity-80">{r.type[0]}</div>
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Room {r.number} · {r.type}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 text-sm">
                      <div>Status: <Badge variant="outline" className={roomStatusMeta[r.status].color}>{roomStatusMeta[r.status].label}</Badge></div>
                      <div>Floor: {r.floor}</div>
                      <div>Last cleaned: {r.lastCleaned ?? "—"}</div>
                    </div>
                    <DialogFooter className="flex-wrap gap-2">
                      {(["vacant_clean","vacant_dirty","maintenance","blocked"] as RoomStatus[]).map(s => (
                        <Button key={s} variant="outline" size="sm" onClick={() => { setRoomStatus(r.id, s); toast.success(`Room ${r.number} set ${roomStatusMeta[s].label}`); }}>
                          Mark {roomStatusMeta[s].label}
                        </Button>
                      ))}
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
            <div className="flex gap-3 mt-4 text-xs">
              {(Object.keys(roomStatusMeta) as RoomStatus[]).map(s => (
                <div key={s} className="flex items-center gap-1.5"><span className={`size-3 rounded ${roomStatusMeta[s].color}`} />{roomStatusMeta[s].label}</div>
              ))}
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="tasks">
          <Card className="p-4 mt-4">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Room</TableHead><TableHead>Type</TableHead><TableHead>Priority</TableHead>
                <TableHead>Assigned</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {tasks.map(t => {
                  const r = rooms.find(x => x.id === t.roomId);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono">{r?.number}</TableCell>
                      <TableCell>{t.type}</TableCell>
                      <TableCell><Badge variant={t.priority === "High" || t.priority === "Urgent" ? "destructive" : "secondary"}>{t.priority}</Badge></TableCell>
                      <TableCell>{t.assignedTo ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          t.status === "Completed" ? "bg-success/15 text-success border-success/30" :
                          t.status === "In Progress" ? "bg-info/15 text-info border-info/30" : ""
                        }>{t.status}</Badge>
                      </TableCell>
                      <TableCell className="space-x-2">
                        {t.status !== "Completed" && (
                          <>
                            {t.status === "Pending" && (
                              <Button size="sm" variant="outline" onClick={() => { updateTask(t.id, { status: "In Progress" }); toast.success("Started"); }}>Start</Button>
                            )}
                            <Button size="sm" onClick={() => { updateTask(t.id, { status: "Completed" }); toast.success("Task completed; room cleaned"); }}>
                              <CheckCircle2 className="size-4" /> Complete
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
