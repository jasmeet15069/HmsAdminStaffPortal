import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useMHMS, resStatusMeta, fmtINR, type ResStatus } from "@/lib/mhms-store";
import { useAuth } from "@/lib/api/auth";
import { useReservations, useCheckIn, useCheckOut } from "@/lib/api/hooks";
import type { Reservation as ApiReservation } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Search, Eye, LogIn, LogOut, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/reservations")({
  head: () => ({ meta: [{ title: "Reservations · MHMS" }] }),
  component: ReservationsPage,
});

// A view-model row that both the live API and the demo store normalize into, so
// the table/dialog render from a single shape regardless of data source.
interface Row {
  id: string;
  code: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  roomLabel: string;
  source: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  amount: number;
  // Unified status bucket used for tabs/filtering.
  bucket: "upcoming" | "in_house" | "checked_out" | "cancelled";
  statusLabel: string;
  statusColor: string;
  canCheckIn: boolean;
  canCheckOut: boolean;
}

// Live API status -> unified bucket + presentation.
const liveStatusMeta: Record<
  ApiReservation["status"],
  { bucket: Row["bucket"]; label: string; color: string }
> = {
  upcoming: { bucket: "upcoming", label: "Upcoming", color: "bg-info/15 text-info border-info/30" },
  pending_checkin: {
    bucket: "upcoming",
    label: "Due In",
    color: "bg-warning/20 text-warning-foreground border-warning/40",
  },
  in_house: {
    bucket: "in_house",
    label: "In-House",
    color: "bg-success/15 text-success border-success/30",
  },
  checked_out: {
    bucket: "checked_out",
    label: "Departed",
    color: "bg-muted text-muted-foreground border-border",
  },
};

// OTA / booking-source badge colours.
const sourceColor = (src: string): string => {
  switch (src) {
    case "Booking.com": return "bg-blue-500/15 text-blue-600 border-blue-300/40";
    case "Expedia": return "bg-yellow-500/15 text-yellow-700 border-yellow-300/40";
    case "MakeMyTrip": return "bg-red-500/15 text-red-600 border-red-300/40";
    case "Goibibo": return "bg-orange-500/15 text-orange-600 border-orange-300/40";
    case "Agoda": return "bg-purple-500/15 text-purple-600 border-purple-300/40";
    case "Airbnb": return "bg-pink-500/15 text-pink-600 border-pink-300/40";
    case "Corporate": return "bg-info/15 text-info border-info/30";
    case "Walk-in": return "bg-success/15 text-success border-success/30";
    case "Phone": return "bg-muted text-muted-foreground border-border";
    default: return "bg-primary/10 text-primary border-primary/30"; // Direct
  }
};

// Demo store status -> unified bucket.
const demoBucket: Record<ResStatus, Row["bucket"]> = {
  confirmed: "upcoming",
  pending: "upcoming",
  checked_in: "in_house",
  checked_out: "checked_out",
  cancelled: "cancelled",
  no_show: "cancelled",
};

function ReservationsPage() {
  const authed = !!useAuth((s) => s.user);
  const live = useReservations();
  const isLive = authed && !!live.data;

  const { reservations, guests, rooms, cancelReservation, checkIn, checkOut } = useMHMS();
  const checkInM = useCheckIn();
  const checkOutM = useCheckOut();

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(null);

  const rows: Row[] = useMemo(() => {
    if (isLive) {
      return (live.data ?? []).map((r) => {
        const meta = liveStatusMeta[r.status] ?? liveStatusMeta.upcoming;
        return {
          id: r.id,
          code: r.id.slice(0, 8).toUpperCase(),
          guestName: r.guest_name,
          guestEmail: r.guest_email ?? undefined,
          guestPhone: r.guest_phone ?? undefined,
          roomLabel: r.room_number
            ? `${r.room_number}${r.room_type ? ` · ${r.room_type}` : ""}`
            : "—",
          source: r.source || "Direct",
          checkIn: r.check_in_date.slice(0, 10),
          checkOut: r.check_out_date.slice(0, 10),
          nights: r.nights,
          amount: r.total_amount ?? 0,
          bucket: meta.bucket,
          statusLabel: meta.label,
          statusColor: meta.color,
          canCheckIn: r.status === "upcoming" || r.status === "pending_checkin",
          canCheckOut: r.status === "in_house",
        };
      });
    }
    return reservations.map((r) => {
      const g = guests.find((x) => x.id === r.guestId);
      const room = rooms.find((x) => x.id === r.roomId);
      const meta = resStatusMeta[r.status];
      const nights = Math.round(
        (new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 86400000,
      );
      return {
        id: r.id,
        code: r.code,
        guestName: g?.name ?? "—",
        guestEmail: g?.email,
        guestPhone: g?.phone,
        roomLabel: room ? `${room.number} · ${room.type}` : "—",
        source: r.source || "Direct",
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        nights,
        amount: r.rate,
        bucket: demoBucket[r.status],
        statusLabel: meta.label,
        statusColor: meta.color,
        canCheckIn: r.status === "confirmed",
        canCheckOut: r.status === "checked_in",
      };
    });
  }, [isLive, live.data, reservations, guests, rooms]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const matchQ =
          !q ||
          r.guestName.toLowerCase().includes(q.toLowerCase()) ||
          r.code.toLowerCase().includes(q.toLowerCase()) ||
          (r.guestPhone ?? "").toLowerCase().includes(q.toLowerCase()) ||
          r.source.toLowerCase().includes(q.toLowerCase());
        const matchTab = tab === "all" || r.bucket === tab;
        return matchQ && matchTab;
      }),
    [rows, q, tab],
  );

  const counts = useMemo(
    () => ({
      all: rows.length,
      upcoming: rows.filter((r) => r.bucket === "upcoming").length,
      in_house: rows.filter((r) => r.bucket === "in_house").length,
      checked_out: rows.filter((r) => r.bucket === "checked_out").length,
    }),
    [rows],
  );

  const sel = open ? rows.find((r) => r.id === open) : null;

  const doCheckIn = (id: string) => {
    if (isLive) checkInM.mutate(id, { onSuccess: () => toast.success("Guest checked in") });
    else {
      checkIn(id);
      toast.success("Guest checked in");
    }
    setOpen(null);
  };
  const doCheckOut = (id: string) => {
    if (isLive) checkOutM.mutate(id, { onSuccess: () => toast.success("Guest checked out") });
    else {
      checkOut(id);
      toast.success("Guest checked out");
    }
    setOpen(null);
  };

  return (
    <>
      <PageHeader
        title="Reservations"
        description="Manage bookings, modifications, group blocks and cancellations."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={isLive ? "default" : "outline"} className="self-center">
              {isLive ? "Live data" : "Demo data"}
            </Badge>
            <Button asChild>
              <Link to="/reservations/new">
                <Plus className="size-4" /> New reservation
              </Link>
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">
            All{" "}
            <Badge variant="secondary" className="ml-2">
              {counts.all}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming{" "}
            <Badge variant="secondary" className="ml-2">
              {counts.upcoming}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="in_house">
            In-house{" "}
            <Badge variant="secondary" className="ml-2">
              {counts.in_house}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="checked_out">
            Departed{" "}
            <Badge variant="secondary" className="ml-2">
              {counts.checked_out}
            </Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by guest or code…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-9"
                />
              </div>
              {isLive && live.isFetching && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Nights</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell className="font-medium">{r.guestName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.guestPhone ?? "—"}</TableCell>
                    <TableCell>{r.roomLabel}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded border ${sourceColor(r.source)}`}>{r.source}</span>
                    </TableCell>
                    <TableCell>{r.checkIn}</TableCell>
                    <TableCell>{r.checkOut}</TableCell>
                    <TableCell>{r.nights}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded border ${r.statusColor}`}>
                        {r.statusLabel}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {r.amount ? fmtINR(r.amount) : "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setOpen(r.id)}>
                        <Eye className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      No reservations match your filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          {sel && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  Reservation {sel.code}
                  <span className={`text-xs px-2 py-0.5 rounded border ${sel.statusColor}`}>
                    {sel.statusLabel}
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Field label="Guest" value={sel.guestName} />
                <Field label="Email" value={sel.guestEmail ?? "—"} />
                <Field label="Phone" value={sel.guestPhone ?? "—"} />
                <Field
                  label="Booking Source"
                  value={<span className={`text-xs px-2 py-0.5 rounded border ${sourceColor(sel.source)}`}>{sel.source}</span>}
                />
                <Field label="Room" value={sel.roomLabel} />
                <Field label="Check-in" value={sel.checkIn} />
                <Field label="Check-out" value={sel.checkOut} />
                <Field label="Nights" value={sel.nights} />
                <Field label="Amount" value={sel.amount ? fmtINR(sel.amount) : "—"} />
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                {sel.canCheckIn && (
                  <Button onClick={() => doCheckIn(sel.id)} disabled={checkInM.isPending}>
                    {checkInM.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <LogIn className="size-4" />
                    )}{" "}
                    Check In
                  </Button>
                )}
                {sel.canCheckOut && (
                  <Button onClick={() => doCheckOut(sel.id)} disabled={checkOutM.isPending}>
                    {checkOutM.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <LogOut className="size-4" />
                    )}{" "}
                    Check Out
                  </Button>
                )}
                {!isLive && sel.bucket === "upcoming" && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      cancelReservation(sel.id);
                      toast.success("Reservation cancelled");
                      setOpen(null);
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <Button variant="outline" onClick={() => setOpen(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}
