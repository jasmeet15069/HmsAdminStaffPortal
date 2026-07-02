import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { fmtINR } from "@/lib/mhms-store";
import { useAuth } from "@/lib/api/auth";
import {
  useRooms, useCreateRoom, useUpdateRoom, useDeleteRoom, useUpdateRoomStatus,
} from "@/lib/api/hooks";
import type { Room, RoomStatus, CreateRoomInput } from "@/lib/api/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { BedDouble, Plus, Pencil, Trash2, Loader2, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/rooms")({
  head: () => ({ meta: [{ title: "Room Management · MHMS" }] }),
  component: RoomManagement,
});

const STATUSES: RoomStatus[] = ["available", "occupied", "cleaning", "maintenance"];
const ROOM_TYPES = ["Standard Single", "Standard Double", "Deluxe", "Suite", "Executive", "Family"];

const statusMeta: Record<RoomStatus, { label: string; color: string }> = {
  available: { label: "Available", color: "bg-success/15 text-success border-success/30" },
  occupied: { label: "Occupied", color: "bg-info/15 text-info border-info/30" },
  cleaning: { label: "Cleaning", color: "bg-warning/20 text-warning-foreground border-warning/40" },
  maintenance: { label: "Maintenance", color: "bg-destructive/15 text-destructive border-destructive/30" },
};

type FormState = {
  room_number: string; room_type: string; floor: string; capacity: string;
  price_per_night: string; status: RoomStatus; amenities: string;
};
const BLANK: FormState = {
  room_number: "", room_type: "Standard Double", floor: "1", capacity: "2",
  price_per_night: "", status: "available", amenities: "",
};

function RoomManagement() {
  const authed = !!useAuth((s) => s.user);
  const roomsQ = useRooms();
  const createM = useCreateRoom();
  const updateM = useUpdateRoom();
  const deleteM = useDeleteRoom();
  const statusM = useUpdateRoomStatus();

  const rooms = useMemo<Room[]>(() => roomsQ.data ?? [], [roomsQ.data]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Room | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(BLANK);
  const [delTarget, setDelTarget] = useState<Room | null>(null);

  const filtered = useMemo(
    () => rooms.filter((r) =>
      r.room_number.toLowerCase().includes(q.toLowerCase()) ||
      r.room_type.toLowerCase().includes(q.toLowerCase())
    ),
    [rooms, q],
  );

  const counts = useMemo(() => ({
    total: rooms.length,
    available: rooms.filter((r) => r.status === "available").length,
    occupied: rooms.filter((r) => r.status === "occupied").length,
    cleaning: rooms.filter((r) => r.status === "cleaning").length,
    maintenance: rooms.filter((r) => r.status === "maintenance").length,
  }), [rooms]);

  const openAdd = () => { setEditing(null); setForm(BLANK); setDialogOpen(true); };
  const openEdit = (r: Room) => {
    setEditing(r);
    setForm({
      room_number: r.room_number, room_type: r.room_type, floor: String(r.floor),
      capacity: String(r.capacity), price_per_night: String(r.price_per_night),
      status: r.status, amenities: (r.amenities ?? []).join(", "),
    });
    setDialogOpen(true);
  };

  const valid =
    form.room_number.trim() !== "" &&
    form.room_type.trim() !== "" &&
    Number(form.floor) >= 0 &&
    Number(form.capacity) >= 1 &&
    Number(form.price_per_night) >= 0;

  const submit = () => {
    if (!valid) { toast.error("Fill room number, type, capacity ≥ 1 and a non-negative price"); return; }
    const payload: CreateRoomInput = {
      room_number: form.room_number.trim(),
      room_type: form.room_type.trim(),
      floor: Number(form.floor),
      capacity: Number(form.capacity),
      price_per_night: Number(form.price_per_night),
      status: form.status,
      amenities: form.amenities.split(",").map((s) => s.trim()).filter(Boolean),
    };
    if (editing) {
      updateM.mutate({ id: editing.id, patch: payload }, {
        onSuccess: () => { toast.success(`Room ${payload.room_number} updated`); setDialogOpen(false); },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Update failed"),
      });
    } else {
      createM.mutate(payload, {
        onSuccess: () => { toast.success(`Room ${payload.room_number} added`); setDialogOpen(false); },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Create failed"),
      });
    }
  };

  const confirmDelete = () => {
    if (!delTarget) return;
    deleteM.mutate(delTarget.id, {
      onSuccess: () => { toast.success(`Room ${delTarget.room_number} deleted`); setDelTarget(null); },
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Delete failed"),
    });
  };

  const changeStatus = (r: Room, status: RoomStatus) => {
    if (status === r.status) return;
    statusM.mutate({ id: r.id, status }, {
      onSuccess: () => toast.success(`Room ${r.room_number} → ${statusMeta[status].label}`),
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Status change failed"),
    });
  };

  const saving = createM.isPending || updateM.isPending;

  return (
    <>
      <PageHeader
        title="Room Management"
        description="Add, edit and manage the rooms in your property."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={authed ? "default" : "outline"} className="self-center">{authed ? "Live" : "Sign in to manage"}</Badge>
            <Button size="sm" className="gap-1.5" onClick={openAdd} disabled={!authed}>
              <Plus className="size-4" /> Add Room
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <Stat label="Total Rooms" value={counts.total} hint="In this property" />
        <Stat label="Available" value={counts.available} tone="success" hint="Ready to sell" />
        <Stat label="Occupied" value={counts.occupied} tone="info" hint="In use" />
        <Stat label="Cleaning" value={counts.cleaning} tone="warning" hint="Being serviced" />
        <Stat label="Maintenance" value={counts.maintenance} tone="destructive" hint="Out of order" />
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by number or type…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          {roomsQ.isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {["Room #", "Type", "Floor", "Capacity", "Price / night", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-accent/5">
                  <td className="px-4 py-3 font-mono font-medium">{r.room_number}</td>
                  <td className="px-4 py-3">{r.room_type}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.floor}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.capacity}</td>
                  <td className="px-4 py-3 font-medium">{fmtINR(r.price_per_night)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={r.status}
                      onChange={(e) => changeStatus(r, e.target.value as RoomStatus)}
                      className={`text-xs px-2 py-1 rounded border bg-background ${statusMeta[r.status].color}`}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{statusMeta[s].label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(r)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => setDelTarget(r)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    {!authed ? (
                      "Sign in to manage your rooms."
                    ) : rooms.length === 0 ? (
                      <div className="flex flex-col items-center gap-2">
                        <BedDouble className="size-8 opacity-40" />
                        <div>No rooms yet. Click <span className="font-medium text-foreground">Add Room</span> to create your first one.</div>
                      </div>
                    ) : (
                      "No rooms match your search."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? `Edit Room ${editing.room_number}` : "Add Room"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Room Number *</Label>
              <Input className="h-8 mt-1" placeholder="e.g. 101" value={form.room_number} onChange={(e) => setForm({ ...form, room_number: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Room Type *</Label>
              <input list="room-types" className="mt-1 h-8 w-full border rounded px-2 text-sm bg-background" value={form.room_type} onChange={(e) => setForm({ ...form, room_type: e.target.value })} />
              <datalist id="room-types">{ROOM_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
            </div>
            <div>
              <Label className="text-xs">Floor</Label>
              <Input type="number" min={0} className="h-8 mt-1" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Capacity</Label>
              <Input type="number" min={1} className="h-8 mt-1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Price / night (₹) *</Label>
              <Input type="number" min={0} className="h-8 mt-1" placeholder="e.g. 3500" value={form.price_per_night} onChange={(e) => setForm({ ...form, price_per_night: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <select className="mt-1 h-8 w-full border rounded px-2 text-sm bg-background" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as RoomStatus })}>
                {STATUSES.map((s) => <option key={s} value={s}>{statusMeta[s].label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Amenities <span className="text-muted-foreground">(comma-separated)</span></Label>
              <Input className="h-8 mt-1" placeholder="AC, TV, WiFi, Mini Bar" value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!valid || saving}>
              {saving ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
              {editing ? "Save Changes" : "Add Room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete room?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Room <span className="font-medium text-foreground">{delTarget?.room_number}</span> ({delTarget?.room_type}) will be permanently removed. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteM.isPending}>
              {deleteM.isPending ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Trash2 className="size-3.5 mr-1" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
