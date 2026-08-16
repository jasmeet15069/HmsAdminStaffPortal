import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useMHMS, resStatusMeta, fmtINR, type ResStatus } from "@/lib/mhms-store";
import { useAuth } from "@/lib/api/auth";
import {
  useReservations,
  useReservationDocuments,
  useReservationGuests,
  useCheckIn,
  useCheckOut,
  useCancelReservation,
} from "@/lib/api/hooks";
import { downloadReservationDocument, getAccessToken, API_URL } from "@/lib/api/client";
import type { Reservation as ApiReservation, ReservationDocument } from "@/lib/api/types";
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
import { Plus, Search, Eye, LogIn, LogOut, Loader2, X, Download, FileText } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/reservations")({
  head: () => ({ meta: [{ title: "Reservations · MHMS" }] }),
  component: ReservationsRoute,
});

// This route owns the reservations list as well as the new/detail child
// routes. Rendering the list unconditionally meant /reservations/new matched
// correctly but its wizard was never mounted because there was no outlet.
function ReservationsRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname === "/reservations" ? <ReservationsPage /> : <Outlet />;
}

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
  canCancel: boolean;
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
  const cancelM = useCancelReservation();

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(null);
  // Only fetched once a reservation is actually opened — a busy front desk's
  // list should not eagerly fetch every guest's ID/photo metadata.
  const docsQ = useReservationDocuments(isLive ? open : null);
  // Every guest on the reservation (ordinal 0 is the one named on the booking
  // itself; 1+ are companions added afterward), so documents can be grouped
  // under whoever they actually belong to rather than shown as one pile.
  const guestsQ = useReservationGuests(isLive ? open : null);

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
          canCancel: r.status === "upcoming" || r.status === "pending_checkin",
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
        canCancel: r.status === "confirmed" || r.status === "pending",
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

  // Groups the flat document list by who it actually belongs to. Older
  // reservations (or the rare failed guest-lookup) have no reservation_guests
  // rows at all, in which case everything falls under the one guest named on
  // the booking — the same single bucket this screen always showed.
  const guestGroups = useMemo(() => {
    const docs = docsQ.data ?? [];
    const guestList = guestsQ.data ?? [];
    if (guestList.length === 0) {
      return [{ id: null as string | null, name: sel?.guestName ?? "Guest", docs }];
    }
    return guestList.map((g) => ({
      id: g.id,
      name: g.ordinal === 0 ? g.full_name : `${g.full_name} (guest ${g.ordinal + 1})`,
      docs: docs.filter((d) =>
        g.ordinal === 0 ? !d.reservation_guest_id || d.reservation_guest_id === g.id : d.reservation_guest_id === g.id,
      ),
    }));
  }, [docsQ.data, guestsQ.data, sel?.guestName]);

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
  const doCancel = (id: string) => {
    if (!window.confirm("Cancel this reservation? Paid reservations must be refunded or credited first.")) return;
    if (isLive) {
      cancelM.mutate(id, {
        onSuccess: () => {
          toast.success("Reservation cancelled");
          setOpen(null);
        },
        onError: (e: any) => toast.error(e.message ?? "Cancel failed"),
      });
    } else {
      cancelReservation(id);
      toast.success("Reservation cancelled");
      setOpen(null);
    }
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
            {/* Both open the same wizard. Walk-in only preselects the approach
                type and defaults the stay to one night, so there is one form to
                maintain rather than two that drift apart. */}
            <Button variant="outline" asChild>
              <Link to="/reservations/new" search={{ walkin: true }}>
                <Plus className="size-4" /> Walk-in
              </Link>
            </Button>
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

              {isLive && (
                <div className="border-t pt-3 mt-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                    Guest photos &amp; ID documents
                  </div>
                  {(docsQ.isLoading || guestsQ.isLoading) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> Loading…
                    </div>
                  )}
                  {!docsQ.isLoading && !guestsQ.isLoading && guestGroups.every((g) => g.docs.length === 0) && (
                    <div className="text-sm text-muted-foreground">
                      No photo or ID document on file for this reservation.
                    </div>
                  )}
                  <div className="space-y-4">
                    {guestGroups.map((group) =>
                      group.docs.length === 0 ? null : (
                        <div key={group.id ?? "primary"}>
                          {/* Only worth a heading once there is more than one
                              guest with documents — a single-guest reservation
                              (still the common case) looks exactly as it always
                              did. */}
                          {guestGroups.filter((g) => g.docs.length > 0).length > 1 && (
                            <div className="text-sm font-medium mb-2">{group.name}</div>
                          )}
                          <div className="flex flex-wrap gap-4">
                            {group.docs.map((doc) => (
                              <DocumentCard key={doc.id} reservationId={sel.id} doc={doc} />
                            ))}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

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
                {sel.canCancel && (
                  <Button
                    variant="destructive"
                    disabled={cancelM.isPending}
                    onClick={() => doCancel(sel.id)}
                  >
                    {cancelM.isPending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
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

const DOC_TYPE_LABEL: Record<string, string> = {
  guest_photo: "Guest photo",
  passport: "Passport",
  driver_license: "Driver licence",
  national_id: "National ID",
  voter_id: "Voter ID",
};

// A document's bytes are never public — every read goes through the
// authenticated /content endpoint (see reservation_documents.go), so an
// image thumbnail can't just be an <img src="..."> to that URL. Instead this
// fetches the bytes once (with the auth header) and renders them from a
// local object URL, the same pattern the download button uses.
function DocumentCard({ reservationId, doc }: { reservationId: string; doc: ReservationDocument }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const isImage = doc.mime_type === "image/jpeg" || doc.mime_type === "image/png";

  useEffect(() => {
    if (!isImage || !doc.artifact_available) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const token = getAccessToken();
        const res = await fetch(
          `${API_URL}/api/reservations/${reservationId}/documents/${doc.id}/content`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        if (!res.ok) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      } catch {
        // Thumbnail is a nicety; the download button still works if this fails.
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId, doc.id, isImage, doc.artifact_available]);

  const download = async () => {
    setDownloading(true);
    try {
      const ext = doc.mime_type === "application/pdf" ? "pdf" : doc.mime_type === "image/png" ? "png" : "jpg";
      await downloadReservationDocument(
        reservationId,
        doc.id,
        `${DOC_TYPE_LABEL[doc.doc_type] ?? doc.doc_type}-${doc.id.slice(0, 8)}.${ext}`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="w-32 space-y-1.5">
      <div className="size-32 rounded-md border grid place-items-center overflow-hidden bg-muted/40">
        {!doc.artifact_available ? (
          <span className="text-[11px] text-destructive text-center px-2">File missing on server</span>
        ) : previewUrl ? (
          <img src={previewUrl} alt={DOC_TYPE_LABEL[doc.doc_type] ?? doc.doc_type} className="size-full object-cover" />
        ) : isImage ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : (
          <FileText className="size-8 text-muted-foreground" />
        )}
      </div>
      <div className="text-xs font-medium truncate">{DOC_TYPE_LABEL[doc.doc_type] ?? doc.doc_type}</div>
      <Button
        variant="outline"
        size="sm"
        className="w-full h-7 text-xs"
        disabled={!doc.artifact_available || downloading}
        onClick={() => void download()}
      >
        {downloading ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
        Download
      </Button>
    </div>
  );
}
