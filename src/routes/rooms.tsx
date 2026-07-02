import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader, Stat } from "@/components/AppShell";
import { fmtINR } from "@/lib/mhms-store";
import { useAuth } from "@/lib/api/auth";
import {
  useRooms, useCreateRoom, useUpdateRoom, useDeleteRoom, useUpdateRoomStatus,
} from "@/lib/api/hooks";
import { apiFetch } from "@/lib/api/client";
import { downloadCSV, parseCSV } from "@/lib/csv";
import type { Room, RoomStatus, CreateRoomInput } from "@/lib/api/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  BedDouble, Plus, Pencil, Trash2, Loader2, Search,
  Upload, Download, FileSpreadsheet, UploadCloud, CheckCircle2, X,
} from "lucide-react";
import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/rooms")({
  head: () => ({ meta: [{ title: "Room Management · MHMS" }] }),
  component: RoomManagement,
});

const STATUSES: RoomStatus[] = ["available", "occupied", "cleaning", "maintenance"];
const ROOM_TYPES = ["Standard Single", "Standard Double", "Deluxe", "Suite", "Executive", "Family"];

// Blueprint for the bulk-upload spreadsheet template. The header order here is
// exactly what POST /api/bulk/rooms accepts; the example rows are a guide the
// user overwrites with their own data.
const TEMPLATE_ROWS: Record<string, string | number>[] = [
  { room_number: "101", room_type: "Standard Single", floor: 1, capacity: 1, price_per_night: 3500, status: "available" },
  { room_number: "102", room_type: "Deluxe", floor: 2, capacity: 2, price_per_night: 8000, status: "available" },
];

type BulkResult = {
  entity: string; received: number; inserted: number; failed: number;
  errors: { row: number; error: string }[];
};

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

  // Bulk upload
  const qc = useQueryClient();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<Record<string, string>[]>([]);
  const [bulkFileName, setBulkFileName] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const bulkM = useMutation({
    mutationFn: (rows: Record<string, string>[]) =>
      apiFetch<BulkResult>("/api/bulk/rooms", { method: "POST", body: { rows } }),
    onSuccess: (r) => {
      setBulkResult(r);
      qc.invalidateQueries({ queryKey: ["rooms"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (r.inserted > 0) toast.success(`Imported ${r.inserted} of ${r.received} rooms`);
      if (r.failed > 0) toast.error(`${r.failed} row(s) failed — see details`);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Bulk upload failed"),
  });

  const resetBulk = () => { setBulkRows([]); setBulkFileName(""); setBulkResult(null); setDragActive(false); };
  const openBulk = () => { resetBulk(); setBulkOpen(true); };
  const downloadTemplate = () => { downloadCSV("rooms-template.csv", TEMPLATE_ROWS); toast.success("Template downloaded"); };

  const ingestFile = async (file: File) => {
    if (!/\.csv$/i.test(file.name)) { toast.error("Please choose a .csv file (save your Excel sheet as CSV)"); return; }
    try {
      const rows = parseCSV(await file.text());
      if (rows.length === 0) { toast.error("That file has no data rows"); return; }
      setBulkFileName(file.name);
      setBulkRows(rows);
      setBulkResult(null);
    } catch {
      toast.error("Could not read that file");
    }
  };

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
            <Button size="sm" variant="outline" className="gap-1.5" onClick={openBulk} disabled={!authed}>
              <Upload className="size-4" /> Bulk Upload
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

      {/* Bulk upload dialog */}
      <Dialog open={bulkOpen} onOpenChange={(o) => { setBulkOpen(o); if (!o) resetBulk(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Bulk Upload Rooms</DialogTitle></DialogHeader>

          {!bulkResult ? (
            <div className="space-y-5">
              {/* Step 1 — download template */}
              <div className="flex gap-3">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">1</div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Download the template</div>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                    Get the blank spreadsheet (CSV — opens in Excel or Google Sheets) with the required column headers:{" "}
                    <span className="font-mono text-[11px]">room_number, room_type, floor, capacity, price_per_night, status</span>.
                    Replace the example rows with your rooms, then save.
                  </p>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadTemplate}>
                    <Download className="size-4" /> Download Template
                  </Button>
                </div>
              </div>

              {/* Step 2 — upload filled file */}
              <div className="flex gap-3">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">2</div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Upload your filled file</div>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">Drag &amp; drop your saved CSV below, or click to choose it.</p>

                  <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) ingestFile(f); e.target.value = ""; }} />

                  {!bulkFileName ? (
                    <button type="button"
                      onClick={() => fileRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={(e) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) ingestFile(f); }}
                      className={`w-full rounded-lg border-2 border-dashed p-6 text-center transition ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"}`}>
                      <UploadCloud className="size-7 mx-auto text-muted-foreground mb-1.5" />
                      <div className="text-sm font-medium">Drop CSV here or click to browse</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">.csv files only</div>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border p-3">
                      <FileSpreadsheet className="size-5 text-success shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{bulkFileName}</div>
                        <div className="text-[11px] text-muted-foreground">{bulkRows.length} room row{bulkRows.length === 1 ? "" : "s"} ready to import</div>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={resetBulk}><X className="size-4" /></Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Result summary */
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-success" />
                <div className="text-sm font-medium">Imported {bulkResult.inserted} of {bulkResult.received} rooms</div>
              </div>
              {bulkResult.failed > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <div className="text-xs font-medium text-destructive mb-1">{bulkResult.failed} row(s) could not be imported:</div>
                  <ul className="text-[11px] text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
                    {bulkResult.errors.slice(0, 20).map((er, i) => (
                      <li key={i}>Row {er.row}: {er.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {!bulkResult ? (
              <>
                <Button variant="outline" onClick={() => { setBulkOpen(false); resetBulk(); }}>Cancel</Button>
                <Button
                  onClick={() => bulkM.mutate(bulkRows)}
                  disabled={bulkRows.length === 0 || bulkM.isPending}
                  className={bulkRows.length > 0 ? "bg-green-600 hover:bg-green-700 text-white" : ""}>
                  {bulkM.isPending ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Upload className="size-3.5 mr-1" />}
                  Upload{bulkRows.length > 0 ? ` ${bulkRows.length} Room${bulkRows.length === 1 ? "" : "s"}` : ""}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={resetBulk}>Upload Another</Button>
                <Button onClick={() => { setBulkOpen(false); resetBulk(); }}>Done</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
