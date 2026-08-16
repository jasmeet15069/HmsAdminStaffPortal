import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { useAuth } from "@/lib/api/auth";
import {
  useAddReservationGuest,
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
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Camera, Check, Loader2, Plus, RotateCcw, Trash2, UserPlus } from "lucide-react";

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

// A guest can present more than one form of ID (passport for the visa, a
// driver's licence too), and a reservation can be more than one guest — a
// family in one room, a group sharing a suite. Both are optional beyond the
// one primary guest the wizard has always required.
interface GuestIdDoc {
  key: string;
  file: File | null;
  docType: string;
  docNumber: string;
}

interface CompanionGuest {
  key: string;
  name: string;
  email: string;
  phone: string;
  idDocs: GuestIdDoc[];
  photoFile: File | null;
  photoVerified: boolean;
}

function blankIdDoc(): GuestIdDoc {
  return { key: crypto.randomUUID(), file: null, docType: "", docNumber: "" };
}

function blankCompanion(): CompanionGuest {
  return { key: crypto.randomUUID(), name: "", email: "", phone: "", idDocs: [blankIdDoc()], photoFile: null, photoVerified: false };
}

// A guest's ID is "on file" once every row it has has both a file and a
// chosen type — an empty list, or a row missing either, is not enough to let
// the wizard proceed.
function idDocsComplete(docs: GuestIdDoc[]): boolean {
  return docs.length > 0 && docs.every((d) => !!d.file && !!d.docType);
}

function updateAt<T>(list: T[], index: number, patch: Partial<T>): T[] {
  return list.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

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
  const addGuestApi = useAddReservationGuest();
  // The primary guest's ID documents — at least one is required, and more
  // than one is allowed (a passport and a driving licence, say). See
  // idDocsComplete for what "on file" means.
  const [idDocs, setIdDocs] = useState<GuestIdDoc[]>([blankIdDoc()]);
  // The photo captured/uploaded at the desk and manually checked against the
  // ID before the wizard will let the desk proceed. Both this and idDocs are
  // mandatory — see the step-1 Continue gate below.
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoVerified, setPhotoVerified] = useState(false);
  // Anyone beyond the primary guest — optional, but a party of three ends up
  // with three fully-documented guests on the reservation, each independently
  // named, contacted, verified and stored. See CompanionGuest.
  const [companions, setCompanions] = useState<CompanionGuest[]>([]);

  const { rooms, addGuest, addReservation } = useMHMS();
  const [step, setStep] = useState(1);
  const [g, setG] = useState({
    name: "", email: "", phone: "", nationality: "Indian", adults: 2, children: 0,
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

  // Re-picking any ID document or the photo invalidates a prior verification —
  // the desk must look at whatever is on screen now, not whatever used to be
  // there.
  useEffect(() => {
    setPhotoVerified(false);
  }, [idDocs, photoFile]);

  const idPreviewUrls = useMemo(
    () => idDocs.map((d) => (d.file && d.file.type.startsWith("image/") ? URL.createObjectURL(d.file) : null)),
    [idDocs],
  );
  useEffect(() => () => { idPreviewUrls.forEach((u) => u && URL.revokeObjectURL(u)); }, [idPreviewUrls]);

  const photoPreviewUrl = useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : null), [photoFile]);
  useEffect(() => () => { if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl); }, [photoPreviewUrl]);

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

      // The primary guest's own top-level id_type/id_number, taken from the
      // first ID document on file — this is what the reservation-create
      // endpoint mirrors onto the CRM guest at booking time, same as before
      // idDocs could hold more than one.
      const primaryIdDoc = idDocs.find((d) => d.file && d.docType);

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
          id_type: primaryIdDoc?.docType || undefined,
          id_number: primaryIdDoc?.docNumber || undefined,
          payment,
        },
        {
          onSuccess: async (res) => {
            // Name what the submission actually produced. A settled booking
            // writes a customer, an invoice and a numbered voucher, and the
            // desk should be able to quote the invoice number immediately.
            const inv = res?.settlement?.invoice_number;
            const partySuffix = companions.length > 0 ? ` (party of ${1 + companions.length})` : "";
            toast.success(
              inv
                ? `Reservation ${res?.confirmation_no ?? ""} created and settled · invoice ${inv}`
                : `Reservation ${res?.confirmation_no ?? ""} created for ${g.name}${partySuffix}`,
            );

            // Every document and every companion is filed against a
            // reservation id that did not exist until a moment ago, so they
            // are all attached second. A failure here must not discard a
            // booking that is already taken and paid for — each piece is
            // reported on its own and can be attached from the reservation
            // afterwards, so failures run independently via allSettled rather
            // than aborting the rest.
            if (res?.id) {
              const reservationId = res.id;
              const tasks: Array<{ label: string; run: () => Promise<unknown> }> = [];

              idDocs.forEach((doc) => {
                if (!doc.file || !doc.docType) return;
                tasks.push({
                  label: `${g.name}'s ID document`,
                  run: () => uploadDoc.mutateAsync({
                    reservationId, file: doc.file as File, docType: doc.docType, docNumber: doc.docNumber || undefined,
                  }),
                });
              });
              if (photoFile) {
                tasks.push({
                  label: `${g.name}'s photo`,
                  run: () => uploadDoc.mutateAsync({ reservationId, file: photoFile, docType: "guest_photo" }),
                });
              }

              // Each companion has to exist on the reservation (POST .../guests)
              // before their documents can be attributed to them, so their
              // upload is one task that awaits the guest first — independent of
              // every other task, including other companions.
              companions.forEach((cg) => {
                tasks.push({
                  label: `${cg.name || "companion"}'s details`,
                  run: async () => {
                    const created = await addGuestApi.mutateAsync({
                      reservationId,
                      fullName: cg.name,
                      email: cg.email || undefined,
                      phone: cg.phone || undefined,
                      idType: cg.idDocs.find((d) => d.file && d.docType)?.docType,
                      idNumber: cg.idDocs.find((d) => d.file && d.docType)?.docNumber,
                    });
                    const reservationGuestId = created.id;
                    await Promise.all([
                      ...cg.idDocs
                        .filter((d) => d.file && d.docType)
                        .map((d) => uploadDoc.mutateAsync({
                          reservationId, file: d.file as File, docType: d.docType,
                          docNumber: d.docNumber || undefined, reservationGuestId,
                        })),
                      ...(cg.photoFile
                        ? [uploadDoc.mutateAsync({ reservationId, file: cg.photoFile, docType: "guest_photo", reservationGuestId })]
                        : []),
                    ]);
                  },
                });
              });

              const results = await Promise.allSettled(tasks.map((t) => t.run()));
              results.forEach((result, i) => {
                if (result.status === "rejected") {
                  const reason = result.reason as { message?: string } | undefined;
                  toast.error(
                    `Booking saved, but ${tasks[i].label} did not upload: ${reason?.message ?? "unknown error"}. Attach it from the reservation afterwards.`,
                  );
                }
              });
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
            <div className="col-span-2">
              <IdDocumentsEditor docs={idDocs} onChange={setIdDocs} />
            </div>
            <Field label="Guest photo *">
              <GuestPhotoCapture photoFile={photoFile} previewUrl={photoPreviewUrl} onChange={setPhotoFile} />
            </Field>

            {idDocsComplete(idDocs) && photoFile && (
              <div className="col-span-2 rounded-md border p-3 space-y-3 bg-muted/30">
                <div className="text-sm font-medium">Verify the photo against the ID before continuing</div>
                <div className="flex items-start gap-6 flex-wrap">
                  <div className="text-center">
                    <img
                      src={photoPreviewUrl ?? undefined}
                      alt="Captured guest photo"
                      className="size-28 rounded-md border object-cover"
                    />
                    <div className="text-xs text-muted-foreground mt-1">Captured photo</div>
                  </div>
                  {idDocs.map((doc, i) => (
                    <div key={doc.key} className="text-center">
                      {idPreviewUrls[i] ? (
                        <img src={idPreviewUrls[i] as string} alt="Uploaded ID" className="size-28 rounded-md border object-cover" />
                      ) : (
                        <div className="size-28 rounded-md border grid place-items-center text-xs text-muted-foreground px-2 text-center">
                          {doc.file?.name}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {ID_PROOF_TYPES.find((t) => t.value === doc.docType)?.label ?? "ID"}
                      </div>
                    </div>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={photoVerified}
                    onChange={(e) => setPhotoVerified(e.target.checked)}
                  />
                  Verified — this photo matches the person on the ID document{idDocs.length > 1 ? "s" : ""}
                </label>
              </div>
            )}

            <div className="col-span-2 border-t pt-4 mt-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-medium">Additional guests</div>
                  <div className="text-xs text-muted-foreground">
                    Optional — {g.name || "the primary guest"} above is the only guest required. Add anyone else staying so their own photo and ID are on file too.
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setCompanions((cs) => [...cs, blankCompanion()])}>
                  <UserPlus className="size-4" /> Add guest
                </Button>
              </div>
              <div className="space-y-3">
                {companions.map((cg, i) => (
                  <CompanionCard
                    key={cg.key}
                    companion={cg}
                    index={i + 2}
                    onChange={(patch) => setCompanions((cs) => updateAt(cs, i, patch))}
                    onRemove={() => setCompanions((cs) => cs.filter((_, j) => j !== i))}
                  />
                ))}
              </div>
            </div>

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
              {companions.length > 0 && (
                <Field label={`Additional guest${companions.length > 1 ? "s" : ""}`}>
                  <div>{companions.map((c) => c.name).filter(Boolean).join(", ")}</div>
                </Field>
              )}
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
                // matched and no folio can be opened at check-in. The ID
                // document(s), guest photo and the manual match check are all
                // mandatory too — no reservation is created without a
                // verified identity on file. The primary guest is the only
                // one required; any additional guest that has been *added*
                // must be just as complete before the desk can continue —
                // a half-filled companion card is not allowed to slip through.
                (step === 1 && (
                  !g.name || (!g.phone && !g.email) ||
                  !idDocsComplete(idDocs) || !photoFile || !photoVerified ||
                  companions.some((cg) =>
                    !cg.name.trim() || (!cg.phone.trim() && !cg.email.trim()) ||
                    !idDocsComplete(cg.idDocs) || !cg.photoFile || !cg.photoVerified)
                )) ||
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

// A repeatable list of ID documents for one guest — a passport and a driving
// licence both filed against the same person, say. At least one row with both
// a file and a chosen type is required (idDocsComplete), but nothing stops
// the desk from adding as many as the guest actually presents.
function IdDocumentsEditor({
  docs,
  onChange,
}: {
  docs: GuestIdDoc[];
  onChange: (docs: GuestIdDoc[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>ID documents * (at least one)</Label>
      <div className="space-y-2">
        {docs.map((doc, i) => (
          <div key={doc.key} className="flex flex-wrap items-center gap-2 border rounded-md p-2">
            <Select value={doc.docType} onValueChange={(v) => onChange(updateAt(docs, i, { docType: v }))}>
              <SelectTrigger className="w-[170px]"><SelectValue placeholder="Document type…" /></SelectTrigger>
              <SelectContent>
                {ID_PROOF_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* The server decides the type from the file's leading bytes, so
                this accept list is a convenience for the file picker and not
                the check that matters. Max 5 MB. */}
            <Input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="max-w-[200px]"
              onChange={(e) => onChange(updateAt(docs, i, { file: e.target.files?.[0] ?? null }))}
            />
            <Input
              placeholder="Document number (optional)"
              className="max-w-[170px]"
              value={doc.docNumber}
              onChange={(e) => onChange(updateAt(docs, i, { docNumber: e.target.value }))}
            />
            {doc.file && (
              <span className="text-xs text-muted-foreground">
                {(doc.file.size / 1024).toFixed(0)} KB
                {doc.file.size > 5 * 1024 * 1024 && <span className="text-destructive"> — over 5 MB</span>}
              </span>
            )}
            {docs.length > 1 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(docs.filter((_, j) => j !== i))}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...docs, blankIdDoc()])}>
        <Plus className="size-4" /> Add another document
      </Button>
    </div>
  );
}

// One additional guest on the reservation, beyond the primary guest above —
// name, contact, their own ID document(s), their own photo and their own
// verification, on exactly the same footing as the primary guest.
function CompanionCard({
  companion,
  index,
  onChange,
  onRemove,
}: {
  companion: CompanionGuest;
  index: number;
  onChange: (patch: Partial<CompanionGuest>) => void;
  onRemove: () => void;
}) {
  const previewUrl = useMemo(
    () => (companion.photoFile ? URL.createObjectURL(companion.photoFile) : null),
    [companion.photoFile],
  );
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const idPreviewUrls = useMemo(
    () => companion.idDocs.map((d) => (d.file && d.file.type.startsWith("image/") ? URL.createObjectURL(d.file) : null)),
    [companion.idDocs],
  );
  useEffect(() => () => { idPreviewUrls.forEach((u) => u && URL.revokeObjectURL(u)); }, [idPreviewUrls]);

  const complete = idDocsComplete(companion.idDocs) && !!companion.photoFile;

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Guest {index}</div>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="size-4" /> Remove
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full name *">
          <Input value={companion.name} onChange={(e) => onChange({ name: e.target.value })} />
        </Field>
        <Field label="Phone or email *">
          <Input value={companion.phone} onChange={(e) => onChange({ phone: e.target.value })} placeholder="+91 …" />
        </Field>
        <Field label="Email">
          <Input type="email" value={companion.email} onChange={(e) => onChange({ email: e.target.value })} />
        </Field>
      </div>

      <IdDocumentsEditor
        docs={companion.idDocs}
        onChange={(docs) => onChange({ idDocs: docs, photoVerified: false })}
      />

      <Field label="Photo *">
        <GuestPhotoCapture
          photoFile={companion.photoFile}
          previewUrl={previewUrl}
          onChange={(file) => onChange({ photoFile: file, photoVerified: false })}
        />
      </Field>

      {complete && (
        <div className="rounded-md border p-3 space-y-3 bg-background">
          <div className="text-sm font-medium">Verify the photo against the ID</div>
          <div className="flex items-start gap-6 flex-wrap">
            <div className="text-center">
              <img src={previewUrl ?? undefined} alt="Captured guest photo" className="size-24 rounded-md border object-cover" />
              <div className="text-xs text-muted-foreground mt-1">Captured photo</div>
            </div>
            {companion.idDocs.map((doc, i) => (
              <div key={doc.key} className="text-center">
                {idPreviewUrls[i] ? (
                  <img src={idPreviewUrls[i] as string} alt="Uploaded ID" className="size-24 rounded-md border object-cover" />
                ) : (
                  <div className="size-24 rounded-md border grid place-items-center text-xs text-muted-foreground px-2 text-center">
                    {doc.file?.name}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {ID_PROOF_TYPES.find((t) => t.value === doc.docType)?.label ?? "ID"}
                </div>
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={companion.photoVerified}
              onChange={(e) => onChange({ photoVerified: e.target.checked })}
            />
            Verified — this photo matches the person on the ID document{companion.idDocs.length > 1 ? "s" : ""}
          </label>
        </div>
      )}
    </div>
  );
}

// Captures a guest photo either live from a webcam or, when no camera is
// available at the desk (or the browser denies permission), from a plain
// file picker — same accepted formats and the same File shape either way, so
// the rest of the wizard (preview, upload) does not need to know which path
// was used.
function GuestPhotoCapture({
  photoFile,
  previewUrl,
  onChange,
}: {
  photoFile: File | null;
  previewUrl: string | null;
  onChange: (file: File | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };
  // Release the camera on unmount too — leaving it held after navigating away
  // keeps the browser's recording indicator on and the device unavailable to
  // anything else at the desk.
  useEffect(() => () => stopCamera(), []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      // The <video> element only exists once cameraOn renders it, so the
      // stream is attached on the next tick rather than right here.
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setCameraError("Camera unavailable or permission denied — use \"Upload photo\" instead.");
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) onChange(new File([blob], `guest-photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
        stopCamera();
      },
      "image/jpeg",
      0.9,
    );
  };

  if (photoFile && previewUrl) {
    return (
      <div className="flex items-center gap-3">
        <img src={previewUrl} alt="Guest" className="size-16 rounded-md border object-cover" />
        <div className="text-xs text-muted-foreground">
          {photoFile.name} · {(photoFile.size / 1024).toFixed(0)} KB
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          <RotateCcw className="size-4" /> Retake
        </Button>
      </div>
    );
  }

  if (cameraOn) {
    return (
      <div className="space-y-2">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="rounded-md border w-full max-w-[220px] aspect-[4/3] object-cover bg-black"
        />
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={capture}>
            <Camera className="size-4" /> Capture
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={stopCamera}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void startCamera()}>
          <Camera className="size-4" /> Use camera
        </Button>
        <span className="text-xs text-muted-foreground">or</span>
        <Input
          type="file"
          accept="image/jpeg,image/png"
          className="max-w-[200px]"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </div>
      {cameraError && <p className="text-xs text-destructive">{cameraError}</p>}
    </div>
  );
}
function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return <div className="flex items-center justify-between"><div>{k}</div><div className="font-medium">{v}</div></div>;
}
