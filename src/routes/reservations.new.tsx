import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { useAuth } from "@/lib/api/auth";
import {
  useAvailableRooms,
  useCreateReservation,
  useReservationQuote,
  useUploadReservationDocument,
} from "@/lib/api/hooks";
import type { ReservationPaymentInput } from "@/lib/api/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reservations/new")({
  head: () => ({ meta: [{ title: "New Reservation · MHMS" }] }),
  // A walk-in and a manual reservation are the same form — the only difference
  // is how the guest reached the desk, which is what approach_type records.
  // Rather than a second near-identical wizard to keep in step, ?walkin=1
  // preselects the approach and defaults the stay to tonight.
  //
  // The param is optional and omitted when false, so every existing <Link
  // to="/reservations/new"> keeps working without having to pass a search
  // object.
  validateSearch: (search: Record<string, unknown>): { walkin?: boolean } =>
    search.walkin === "1" || search.walkin === true ? { walkin: true } : {},
  component: NewReservation,
});

// Booking sources / OTA channels.
const BOOKING_SOURCES = [
  "Direct", "Booking.com", "Expedia", "MakeMyTrip", "Goibibo",
  "Agoda", "Airbnb", "Walk-in", "Phone", "Corporate",
];

const APPROACH_TYPES = [
  { value: "walk_in", label: "Walk-in" },
  { value: "manual", label: "Manual reservation" },
  { value: "phone", label: "Phone enquiry" },
  { value: "corporate", label: "Corporate booking" },
];

const ID_PROOF_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "driver_license", label: "Driver licence" },
  { value: "national_id", label: "National ID / Aadhaar" },
  { value: "voter_id", label: "Voter ID" },
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI" },
  { value: "credit", label: "Bill to company (credit)" },
];

// Common shape both the live API rooms and the demo store rooms normalize into.
interface RoomVM {
  id: string;
  number: string;
  type: string;
  floor: number;
  capacity: number;
  rate: number;
  amenities: string[];
}

function dateAtMidnightUTC(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function countCalendarNights(checkIn: string, checkOut: string): number | null {
  const start = dateAtMidnightUTC(checkIn);
  const end = dateAtMidnightUTC(checkOut);
  if (!start || !end) return null;
  const nights = Math.round((end.getTime() - start.getTime()) / 86400000);
  return nights > 0 ? nights : null;
}

function addCalendarNights(checkIn: string, nights: number): string | null {
  const start = dateAtMidnightUTC(checkIn);
  if (!start || !Number.isInteger(nights) || nights < 1) return null;
  start.setUTCDate(start.getUTCDate() + nights);
  return start.toISOString().slice(0, 10);
}

function positiveWholeNights(value: string): number | null {
  const nights = Number(value);
  return Number.isInteger(nights) && nights >= 1 ? nights : null;
}

function NewReservation() {
  const nav = useNavigate();
  const { walkin } = useSearch({ from: "/reservations/new" });
  const authed = !!useAuth((s) => s.user);
  const createRes = useCreateReservation();
  const uploadDoc = useUploadReservationDocument();
  const [idFile, setIdFile] = useState<File | null>(null);

  const { rooms, addGuest, addReservation } = useMHMS();
  const [step, setStep] = useState(1);
  const [g, setG] = useState({
    name: "", email: "", phone: "", nationality: "Indian", adults: 2, children: 0,
    idType: "", idNumber: "",
  });
  const [r, setR] = useState({
    checkIn: new Date().toISOString().slice(0, 10),
    // A walk-in is here now and usually leaving tomorrow; a planned booking
    // more often runs a couple of nights.
    checkOut: new Date(Date.now() + 86400000 * (walkin ? 1 : 2)).toISOString().slice(0, 10),
    roomId: "",
    source: walkin ? "Walk-in" : "Direct",
    approachType: walkin ? "walk_in" : "manual",
    promoCode: "",
    notes: "",
    // A walk-in is standing at the desk now; a planned booking arrives at the
    // property's usual check-in hour.
    checkInTime: walkin ? new Date().toTimeString().slice(0, 5) : "14:00",
    checkOutTime: "11:00",
  });
  // Keep the field's editable text separate from the dates it controls. A
  // derived number value fights partial edits (for example, typing "12") and
  // can become NaN while a date input is temporarily empty.
  const [durationNights, setDurationNights] = useState(() => String(walkin ? 1 : 2));
  const [pay, setPay] = useState({
    take: true,
    method: "cash" as ReservationPaymentInput["method"],
    upiId: "", transactionRef: "", cardLast4: "", authCode: "", cashReceived: "",
  });
  // The promo code that has actually been priced, as opposed to what is
  // currently being typed. Quoting on every keystroke would fire a request per
  // character and flicker the total.
  const [appliedPromo, setAppliedPromo] = useState("");

  // Ask which rooms are free for the chosen dates, rather than which are free
  // right now. The old filter (status === "available") made the wizard
  // impossible to finish at a busy hotel: every room read occupied or cleaning,
  // step 2 offered nothing, and Continue stayed disabled — while those same
  // rooms were perfectly bookable for the dates being requested.
  const liveRooms = useAvailableRooms(r.checkIn, r.checkOut);
  const isLive = authed && !!liveRooms.data;

  const available: RoomVM[] = isLive
    ? (liveRooms.data ?? []).map((rm) => ({ id: rm.id, number: rm.room_number, type: rm.room_type, floor: rm.floor, capacity: rm.capacity, rate: rm.price_per_night, amenities: rm.amenities ?? [] }))
    : rooms
        .filter((x) => x.status === "vacant_clean" || x.status === "vacant_dirty")
        .map((rm) => ({ id: rm.id, number: rm.number, type: rm.type, floor: rm.floor, capacity: rm.capacity, rate: rm.rate, amenities: rm.amenities }));

  const guestCount = Math.max(1, g.adults + g.children);
  const selectedRoom = available.find((x) => x.id === r.roomId);
  const selectedRoomFits = !!selectedRoom && guestCount <= selectedRoom.capacity;

  // Dates are editable on step 1, which can be revisited after a room is
  // chosen, and the choice may not survive the new dates. Drop it rather than
  // submit a room that is no longer free, and send the user back to pick again
  // instead of leaving the later steps rendering an empty card.
  //
  // Depends on liveRooms.data, not the mapped array, which is rebuilt each
  // render and would re-run this on every one.
  useEffect(() => {
    if (!isLive || liveRooms.isLoading || !r.roomId) return;
    if (!(liveRooms.data ?? []).some((rm) => rm.id === r.roomId)) {
      setR((prev) => ({ ...prev, roomId: "" }));
      setStep((s) => (s > 2 ? 2 : s));
    }
  }, [isLive, liveRooms.isLoading, liveRooms.data, r.roomId]);

  const nights = countCalendarNights(r.checkIn, r.checkOut) ?? 1;

  // Money comes from the server. The wizard used to compute a hardcoded 18% GST
  // here, display the total including it, and then send nothing — so the guest
  // agreed to one figure while the reservation stored another, on every single
  // booking. The tax rate is per-tenant (hotels.gst_rate) and was never 18% for
  // everyone anyway.
  const quoteQ = useReservationQuote({
    room_id: r.roomId,
    check_in_date: r.checkIn,
    check_out_date: r.checkOut,
    check_in_time: r.checkInTime || undefined,
    check_out_time: r.checkOutTime || undefined,
    promo_code: appliedPromo || undefined,
  });
  const quote = quoteQ.data;

  // Demo mode has no server to ask, so it falls back to the room rate alone
  // rather than inventing a tax figure.
  const subtotal = quote?.base_total ?? (selectedRoom?.rate ?? 0) * nights;
  const discount = quote?.discount ?? 0;
  const tax = quote?.tax_amount ?? 0;
  const total = quote?.payable ?? subtotal;

  const steps = ["Guest Details", "Room Selection", "Rate & Payment", "Confirm"];

  // Mirrors the server's per-method rules, so the desk is told what is missing
  // before the request is made rather than after it is refused.
  const paymentReady = (() => {
    if (!isLive || !pay.take) return true;
    switch (pay.method) {
      case "upi": return !!pay.upiId.trim() && !!pay.transactionRef.trim();
      case "card": return !!pay.authCode.trim() && (pay.cardLast4 === "" || /^\d{4}$/.test(pay.cardLast4));
      case "cash": return Number(pay.cashReceived || 0) >= total;
      default: return true;
    }
  })();

  const changeDue = pay.method === "cash" ? Math.max(0, Number(pay.cashReceived || 0) - total) : 0;

  const submit = () => {
    if (!selectedRoom || !selectedRoomFits) {
      toast.error(selectedRoom
        ? `Room ${selectedRoom.number} sleeps ${selectedRoom.capacity}; ${guestCount} guests requested.`
        : "Choose an available room before confirming.");
      setStep(2);
      return;
    }
    if (isLive) {
      const payment: ReservationPaymentInput | undefined = pay.take
        ? {
            method: pay.method,
            upi_id: pay.upiId.trim() || undefined,
            transaction_ref: pay.transactionRef.trim() || undefined,
            // Four digits only. The API refuses anything longer rather than
            // truncating it, because a longer value means a full card number
            // was already transmitted.
            card_last4: pay.cardLast4.trim() || undefined,
            auth_code: pay.authCode.trim() || undefined,
            cash_received: pay.method === "cash" ? Number(pay.cashReceived || 0) : undefined,
          }
        : undefined;

      createRes.mutate(
        {
          guest_name: g.name,
          guest_email: g.email || undefined,
          guest_phone: g.phone || undefined,
          room_id: r.roomId,
          check_in_date: r.checkIn,
          check_out_date: r.checkOut,
          source: r.source,
          notes: r.notes || undefined,
          adults: g.adults,
          children: g.children,
          approach_type: r.approachType,
          check_in_time: r.checkInTime || undefined,
          check_out_time: r.checkOutTime || undefined,
          promo_code: appliedPromo || undefined,
          id_type: g.idType || undefined,
          id_number: g.idNumber || undefined,
          payment,
        },
        {
          onSuccess: async (res) => {
            // Name what the submission actually produced. A settled booking
            // writes a customer, an invoice and a numbered voucher, and the
            // desk should be able to quote the invoice number immediately.
            const inv = res?.settlement?.invoice_number;
            toast.success(
              inv
                ? `Reservation ${res?.confirmation_no ?? ""} created and settled · invoice ${inv}`
                : `Reservation ${res?.confirmation_no ?? ""} created for ${g.name}`,
            );

            // The document is filed against a reservation id that did not exist
            // until a moment ago, so it uploads second. A failed upload must not
            // discard a booking that is already taken and paid for — it is
            // reported on its own and the ID can be attached from the
            // reservation afterwards.
            if (idFile && res?.id && g.idType) {
              try {
                await uploadDoc.mutateAsync({
                  reservationId: res.id,
                  file: idFile,
                  docType: g.idType,
                  docNumber: g.idNumber || undefined,
                });
              } catch (e: any) {
                toast.error(`Booking saved, but the ID document did not upload: ${e?.message ?? "unknown error"}`);
              }
            }
            nav({ to: "/reservations" });
          },
          onError: (e: any) => toast.error(e?.message ?? "Failed to create reservation"),
        },
      );
      return;
    }
    // Demo fallback (no live session).
    const guest = addGuest({ name: g.name, email: g.email, phone: g.phone, nationality: g.nationality, loyaltyTier: "Silver", loyaltyPoints: 0, totalStays: 1 });
    const res = addReservation({
      guestId: guest.id, roomId: r.roomId, checkIn: r.checkIn, checkOut: r.checkOut,
      adults: g.adults, children: g.children, status: "confirmed", rate: selectedRoom!.rate, source: r.source as never, notes: r.notes,
    });
    toast.success(`Reservation ${res.code} created for ${guest.name}`);
    nav({ to: "/reservations" });
  };

  const continueToNextStep = async () => {
    if (step !== 2) {
      setStep((current) => current + 1);
      return;
    }

    if (!selectedRoom || !selectedRoomFits) {
      toast.error(selectedRoom
        ? `Room ${selectedRoom.number} sleeps ${selectedRoom.capacity}; ${guestCount} guests requested.`
        : "Choose a room that can accommodate every guest.");
      return;
    }

    // The room list can become stale while the desk collects guest details.
    // Recheck before payment; Create remains the final protection against a
    // concurrent reservation being made after this request completes.
    if (isLive) {
      const { data } = await liveRooms.refetch();
      const refreshedRoom = data?.find((room) => room.id === r.roomId);
      if (!refreshedRoom) {
        setR((previous) => ({ ...previous, roomId: "" }));
        toast.error(`Room ${selectedRoom.number} is no longer available for these dates. Choose another room.`);
        return;
      }
      if (guestCount > refreshedRoom.capacity) {
        setR((previous) => ({ ...previous, roomId: "" }));
        toast.error(`Room ${refreshedRoom.room_number} sleeps ${refreshedRoom.capacity}; ${guestCount} guests requested.`);
        return;
      }
    }

    setStep(3);
  };

  return (
    <>
      <PageHeader
        title={walkin ? "Walk-in" : "New Reservation"}
        description={walkin ? "Same form as a manual reservation, defaulted for a guest at the desk" : "Step-by-step booking wizard"}
        actions={
          <Badge variant={isLive ? "default" : "outline"} className="self-center">
            {isLive ? "Live data" : "Demo data"}
          </Badge>
        }
      />

      <div className="flex items-center gap-2 mb-6">
        {steps.map((s, i) => {
          const idx = i + 1;
          const done = idx < step;
          const active = idx === step;
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`size-8 rounded-full grid place-items-center text-sm font-semibold ${active ? "bg-primary text-primary-foreground" : done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
                {done ? <Check className="size-4" /> : idx}
              </div>
              <span className={`text-sm ${active ? "font-medium" : "text-muted-foreground"}`}>{s}</span>
              {i < steps.length - 1 && <div className="w-12 h-px bg-border mx-2" />}
            </div>
          );
        })}
      </div>

      <Card className="p-6 max-w-3xl">
        {step === 1 && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full name *"><Input value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={g.email} onChange={(e) => setG({ ...g, email: e.target.value })} /></Field>
            <Field label="Phone *"><Input value={g.phone} onChange={(e) => setG({ ...g, phone: e.target.value })} placeholder="+91 …" /></Field>
            <Field label="Nationality">
              <Select value={g.nationality} onValueChange={(v) => setG({ ...g, nationality: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Indian">Indian</SelectItem>
                  <SelectItem value="Foreign">Foreign</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Approach type">
              <Select value={r.approachType} onValueChange={(v) => setR({ ...r, approachType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APPROACH_TYPES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Booking source">
              <Select value={r.source} onValueChange={(v) => setR({ ...r, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BOOKING_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="ID proof type">
              <Select value={g.idType} onValueChange={(v) => setG({ ...g, idType: v })}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {ID_PROOF_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="ID number">
              <Input value={g.idNumber} onChange={(e) => setG({ ...g, idNumber: e.target.value })} placeholder="Document number" />
            </Field>
            <Field label="ID document">
              {/* The server decides the type from the file's leading bytes, so
                  this accept list is a convenience for the file picker and not
                  the check that matters. Max 5 MB. */}
              <Input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => setIdFile(e.target.files?.[0] ?? null)}
              />
              {idFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  {idFile.name} · {(idFile.size / 1024).toFixed(0)} KB
                  {idFile.size > 5 * 1024 * 1024 && (
                    <span className="text-destructive"> — over the 5 MB limit</span>
                  )}
                </p>
              )}
            </Field>
            <div />
            <Field label="Adults"><Input type="number" min={1} value={g.adults} onChange={(e) => setG({ ...g, adults: +e.target.value })} /></Field>
            <Field label="Children"><Input type="number" min={0} value={g.children} onChange={(e) => setG({ ...g, children: +e.target.value })} /></Field>
            <Field label="Check-in date *"><Input type="date" value={r.checkIn} onChange={(e) => {
              const checkIn = e.target.value;
              const checkOut = addCalendarNights(checkIn, positiveWholeNights(durationNights) ?? 0);
              setR({ ...r, checkIn, checkOut: checkOut ?? r.checkOut });
            }} /></Field>
            <Field label="Check-in time"><Input type="time" value={r.checkInTime} onChange={(e) => setR({ ...r, checkInTime: e.target.value })} /></Field>
            {/* The desk books in nights. Editing either this or the check-out
                date updates the other, so the two can never disagree — the API
                rejects a mismatched pair rather than guessing which was meant. */}
            <Field label="Duration (nights)">
              <Input
                type="number"
                min={1}
                value={durationNights}
                onChange={(e) => {
                  const value = e.target.value;
                  setDurationNights(value);
                  const checkOut = addCalendarNights(r.checkIn, positiveWholeNights(value) ?? 0);
                  if (checkOut) setR({ ...r, checkOut });
                }}
                onBlur={() => setDurationNights(String(positiveWholeNights(durationNights) ?? nights))}
              />
            </Field>
            <Field label="Check-out date *"><Input type="date" value={r.checkOut} onChange={(e) => {
              const checkOut = e.target.value;
              const nextNights = countCalendarNights(r.checkIn, checkOut);
              if (nextNights) setDurationNights(String(nextNights));
              setR({ ...r, checkOut });
            }} /></Field>
            <Field label="Check-out time"><Input type="time" value={r.checkOutTime} onChange={(e) => setR({ ...r, checkOutTime: e.target.value })} /></Field>
            {selectedRoom && g.adults + g.children > selectedRoom.capacity && (
              <div className="col-span-2 text-sm text-destructive">
                Room {selectedRoom.number} sleeps {selectedRoom.capacity}. Reduce the guest count or pick another room.
              </div>
            )}
          </div>
        )}
        {step === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto">
            <div className="col-span-2 text-sm text-muted-foreground">
              Select a room for {guestCount} guest{guestCount === 1 ? "" : "s"}. Rooms that cannot accommodate the party are unavailable.
            </div>
            {isLive && liveRooms.isLoading && (
              <div className="col-span-2 flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
            )}
            {available.map((rm) => {
              const roomFits = guestCount <= rm.capacity;
              return (
              <button
                key={rm.id}
                type="button"
                disabled={!roomFits}
                onClick={() => setR({ ...r, roomId: rm.id })}
                className={`text-left border rounded-lg p-4 transition ${r.roomId === rm.id && roomFits ? "border-primary bg-primary/5 ring-2 ring-primary/20" : roomFits ? "hover:border-primary/40" : "cursor-not-allowed opacity-50"}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Room {rm.number}</div>
                    <div className="text-sm text-muted-foreground">{rm.type} · Floor {rm.floor} · Sleeps {rm.capacity}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{fmtINR(rm.rate)}</div>
                    <div className="text-xs text-muted-foreground">per night</div>
                  </div>
                </div>
                {!roomFits && (
                  <p className="mt-2 text-xs text-destructive">Cannot assign: sleeps {rm.capacity}, {guestCount} guests requested.</p>
                )}
                <div className="flex flex-wrap gap-1 mt-2">{rm.amenities.map((a) => <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>)}</div>
              </button>
              );
            })}
            {available.length === 0 && !liveRooms.isLoading && (
              <div className="col-span-2 text-center py-10 text-muted-foreground text-sm">
                No rooms are free for {r.checkIn} → {r.checkOut}. Try different dates.
              </div>
            )}
          </div>
        )}
        {step === 3 && selectedRoom && (
          <div className="space-y-3 text-sm">
            <Row k={`Room ${selectedRoom.number} · ${selectedRoom.type}`} v={`${nights} night${nights > 1 ? "s" : ""} × ${fmtINR(quote?.room_rate ?? selectedRoom.rate)}`} />
            <Row k="Subtotal" v={fmtINR(subtotal)} />
            {discount > 0 && <Row k={`Discount (${appliedPromo})`} v={<span className="text-success">−{fmtINR(discount)}</span>} />}
            <Row k={quote ? `GST (${quote.tax_rate}%)` : "GST"} v={fmtINR(tax)} />
            <div className="border-t pt-3">
              <Row k="Payable" v={<span className="text-lg font-semibold">{quoteQ.isLoading ? "…" : fmtINR(total)}</span>} />
            </div>

            <div className="pt-2">
              <Label>Promo code</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={r.promoCode}
                  onChange={(e) => setR({ ...r, promoCode: e.target.value.toUpperCase() })}
                  placeholder="SUMMER25"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!r.promoCode.trim() || quoteQ.isFetching}
                  onClick={() => setAppliedPromo(r.promoCode.trim())}
                >
                  Apply
                </Button>
                {appliedPromo && (
                  <Button type="button" variant="ghost" onClick={() => { setAppliedPromo(""); setR({ ...r, promoCode: "" }); }}>
                    Clear
                  </Button>
                )}
              </div>
              {/* The server is the judge of a code. It re-checks on submit, so
                  a code that lapses between quoting and confirming is caught
                  there too rather than silently charging full price. */}
              {appliedPromo && !quoteQ.isFetching && discount === 0 && (
                <p className="text-xs text-destructive mt-1">
                  {appliedPromo} did not apply to this stay.
                </p>
              )}
            </div>

            <div className="pt-2 border-t">
              <label className="flex items-center gap-2 py-3 cursor-pointer">
                <input type="checkbox" checked={pay.take} onChange={(e) => setPay({ ...pay, take: e.target.checked })} />
                <span className="font-medium">Take payment now</span>
                <span className="text-muted-foreground text-xs">
                  raises the receipt voucher, ledger entry, sales invoice and customer record
                </span>
              </label>

              {pay.take && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Payment method">
                    <Select value={pay.method} onValueChange={(v) => setPay({ ...pay, method: v as ReservationPaymentInput["method"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <div />

                  {pay.method === "upi" && (
                    <>
                      <Field label="UPI ID *"><Input value={pay.upiId} onChange={(e) => setPay({ ...pay, upiId: e.target.value })} placeholder="guest@okaxis" /></Field>
                      <Field label="Transaction ID *"><Input value={pay.transactionRef} onChange={(e) => setPay({ ...pay, transactionRef: e.target.value })} /></Field>
                    </>
                  )}

                  {pay.method === "card" && (
                    <>
                      <Field label="Card last 4 digits">
                        <Input
                          inputMode="numeric"
                          maxLength={4}
                          value={pay.cardLast4}
                          onChange={(e) => setPay({ ...pay, cardLast4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                          placeholder="4242"
                        />
                        {/* Four digits, never the full number: anything sent
                            here also lands in the request logs and in every
                            database backup. */}
                        <p className="text-xs text-muted-foreground mt-1">Last 4 only — never enter the full card number.</p>
                      </Field>
                      <Field label="Auth / approval code *"><Input value={pay.authCode} onChange={(e) => setPay({ ...pay, authCode: e.target.value })} /></Field>
                    </>
                  )}

                  {pay.method === "cash" && (
                    <>
                      <Field label="Cash received *">
                        <Input type="number" min={0} value={pay.cashReceived} onChange={(e) => setPay({ ...pay, cashReceived: e.target.value })} />
                      </Field>
                      <Field label="Change to give"><div className="h-10 flex items-center font-medium">{fmtINR(changeDue)}</div></Field>
                    </>
                  )}

                  {pay.method === "credit" && (
                    <p className="col-span-2 text-xs text-muted-foreground">
                      Nothing is collected now. This books a receivable against the customer, so a phone or email is required.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label>Special requests</Label>
              <Textarea className="mt-1" value={r.notes} onChange={(e) => setR({ ...r, notes: e.target.value })} placeholder="Late check-in, dietary, accessibility…" />
            </div>
          </div>
        )}
        {step === 4 && selectedRoom && (
          <div className="space-y-4">
            <div className="bg-success/10 border border-success/30 text-success rounded-md p-4 text-sm">
              Review the booking summary and confirm to create the reservation.
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Guest"><div className="font-medium">{g.name}</div><div className="text-muted-foreground text-xs">{g.email || "no email"} · {g.phone}</div></Field>
              <Field label="Source"><div className="font-medium">{r.source}</div></Field>
              <Field label="Room"><div className="font-medium">{selectedRoom.number} · {selectedRoom.type}</div></Field>
              <Field label="Stay"><div>{r.checkIn} → {r.checkOut} ({nights} nights)</div></Field>
              <Field label="Occupancy"><div>{g.adults} adult{g.adults > 1 ? "s" : ""}{g.children > 0 ? `, ${g.children} child${g.children > 1 ? "ren" : ""}` : ""}</div></Field>
              <Field label="Payment">
                <div className="font-medium">
                  {pay.take ? PAYMENT_METHODS.find((m) => m.value === pay.method)?.label : "Not taken yet"}
                </div>
              </Field>
              <Field label="Payable"><div className="font-semibold text-lg">{fmtINR(total)}</div></Field>
            </div>
            {!selectedRoomFits && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                Room {selectedRoom.number} sleeps {selectedRoom.capacity}; {guestCount} guests requested. Go back and choose a suitable room.
              </div>
            )}
            {pay.take && (
              <p className="text-xs text-muted-foreground">
                Confirming records the payment and posts the receipt voucher, ledger entry and sales invoice
                against the customer — all in one transaction, so nothing lands half-done.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <Button variant="outline" disabled={step === 1} onClick={() => setStep(step - 1)}><ArrowLeft className="size-4" /> Back</Button>
          {step < 4 ? (
            <Button
              onClick={() => void continueToNextStep()}
              disabled={
                // At least one contact detail: the API requires it, because
                // without a phone or an email a returning guest can never be
                // matched and no folio can be opened at check-in.
                (step === 1 && (!g.name || (!g.phone && !g.email))) ||
                (step === 2 && (!r.roomId || !selectedRoomFits)) ||
                (step === 3 && !paymentReady)
              }
            >
              Continue <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={createRes.isPending || !paymentReady || !selectedRoomFits}>
              {createRes.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {pay.take ? " Confirm & take payment" : " Confirm reservation"}
            </Button>
          )}
        </div>
      </Card>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return <div className="flex items-center justify-between"><div>{k}</div><div className="font-medium">{v}</div></div>;
}
