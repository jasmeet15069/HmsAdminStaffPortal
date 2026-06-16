import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Wrench } from "lucide-react";

export const Route = createFileRoute("/maintenance")({
  head: () => ({ meta: [{ title: "Maintenance · MHMS" }] }),
  component: Maintenance,
});

function Maintenance() {
  const { maintenance, rooms, addTicket, updateTicket } = useMHMS();
  const [open, setOpen] = useState(false);
  const [t, setT] = useState({ title: "", description: "", priority: "Normal" as const, roomId: "", assignedTo: "" });

  return (
    <>
      <PageHeader title="Maintenance" description="Tickets, assignments and resolutions" actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4" /> New ticket</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New maintenance ticket</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input className="mt-1" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea className="mt-1" value={t.description} onChange={(e) => setT({ ...t, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Priority</Label>
                  <Select value={t.priority} onValueChange={(v) => setT({ ...t, priority: v as never })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Low","Normal","High","Critical"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Room (optional)</Label>
                  <Select value={t.roomId} onValueChange={(v) => setT({ ...t, roomId: v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent className="max-h-72">{rooms.map(r => <SelectItem key={r.id} value={r.id}>{r.number}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Assign to</Label><Input className="mt-1" value={t.assignedTo} onChange={(e) => setT({ ...t, assignedTo: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => { addTicket({ ...t, status: "Open" }); setOpen(false); toast.success("Ticket created"); }}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Open" value={maintenance.filter(m => m.status === "Open").length} tone="warning" />
        <Stat label="In Progress" value={maintenance.filter(m => m.status === "In Progress").length} tone="info" />
        <Stat label="Resolved" value={maintenance.filter(m => m.status === "Resolved").length} tone="success" />
        <Stat label="Critical" value={maintenance.filter(m => m.priority === "Critical").length} tone="destructive" />
      </div>
      <Card className="p-4">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Title</TableHead><TableHead>Location</TableHead><TableHead>Priority</TableHead>
            <TableHead>Assigned</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {maintenance.map(m => {
              const r = rooms.find(x => x.id === m.roomId);
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium"><Wrench className="size-3.5 inline mr-1 opacity-60" />{m.title}</TableCell>
                  <TableCell>{r ? `Room ${r.number}` : "Common area"}</TableCell>
                  <TableCell><Badge variant={m.priority === "Critical" || m.priority === "High" ? "destructive" : "secondary"}>{m.priority}</Badge></TableCell>
                  <TableCell>{m.assignedTo ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{m.status}</Badge></TableCell>
                  <TableCell>{m.createdAt}</TableCell>
                  <TableCell className="space-x-1">
                    {m.status === "Open" && <Button size="sm" variant="outline" onClick={() => { updateTicket(m.id, { status: "In Progress" }); toast.success("Started"); }}>Start</Button>}
                    {m.status !== "Resolved" && m.status !== "Closed" && <Button size="sm" onClick={() => { updateTicket(m.id, { status: "Resolved" }); toast.success("Resolved"); }}>Resolve</Button>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
