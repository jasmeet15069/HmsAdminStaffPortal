import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { useAuth } from "@/lib/api/auth";
import { useRooms, useCreateReservation } from "@/lib/api/hooks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reservations/new")({
  head: () => ({ meta: [{ title: "New Reservation · MHMS" }] }),
  component: NewReservation,
});

// Booking sources / OTA channels.
const BOOKING_SOURCES = [
  "Direct", "Booking.com", "Expedia", "MakeMyTrip", "Goibibo",
  "Agoda", "Airbnb", "Walk-in", "Phone", "Corporate",
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

function NewReservation() {
  const nav = useNavigate();
  const authed = !!useAuth((s) => s.user);
  const liveRooms = useRooms();
  const createRes = useCreateReservation();
  const isLive = authed && !!liveRooms.data;

  const { rooms, addGuest, addReservation } = useMHMS();
  const [step, setStep] = useState(1);
  const [g, setG] = useState({ name: "", email: "", phone: "", nationality: "Indian", adults: 2, children: 0 });
  const [r, setR] = useState({
    checkIn: new Date().toISOString().slice(0, 10),
    checkOut: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    roomId: "", source: "Direct", notes: "",
  });

  const available: RoomVM[] = isLive
    ? (liveRooms.data ?? [])
        .filter((rm) => rm.status === "available")
        .map((rm) => ({ id: rm.id, number: rm.room_number, type: rm.room_type, floor: rm.floor, capacity: rm.capacity, rate: rm.price_per_night, amenities: rm.amenities ?? [] }))
    : rooms
        .filter((x) => x.status === "vacant_clean" || x.status === "vacant_dirty")
        .map((rm) => ({ id: rm.id, number: rm.number, type: rm.type, floor: rm.floor, capacity: rm.capacity, rate: rm.rate, amenities: rm.amenities }));

  const selectedRoom = available.find((x) => x.id === r.roomId);
  const nights = Math.max(1, Math.round((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 86400000));
  const subtotal = (selectedRoom?.rate ?? 0) * nights;
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax;

  const steps = ["Guest Details", "Room Selection", "Rate & Charges", "Confirm"];

  const submit = () => {
    if (isLive) {
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
        },
        {
          onSuccess: () => {
            toast.success(`Reservation created for ${g.name} · via ${r.source}`);
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

  return (
    <>
      <PageHeader
        title="New Reservation"
        description="Step-by-step booking wizard"
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
            <Field label="Booking source">
              <Select value={r.source} onValueChange={(v) => setR({ ...r, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BOOKING_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Adults"><Input type="number" min={1} value={g.adults} onChange={(e) => setG({ ...g, adults: +e.target.value })} /></Field>
            <Field label="Children"><Input type="number" min={0} value={g.children} onChange={(e) => setG({ ...g, children: +e.target.value })} /></Field>
            <div />
            <Field label="Check-in date *"><Input type="date" value={r.checkIn} onChange={(e) => setR({ ...r, checkIn: e.target.value })} /></Field>
            <Field label="Check-out date *"><Input type="date" value={r.checkOut} onChange={(e) => setR({ ...r, checkOut: e.target.value })} /></Field>
          </div>
        )}
        {step === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto">
            {isLive && liveRooms.isLoading && (
              <div className="col-span-2 flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
            )}
            {available.map((rm) => (
              <button
                key={rm.id}
                onClick={() => setR({ ...r, roomId: rm.id })}
                className={`text-left border rounded-lg p-4 transition ${r.roomId === rm.id ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-primary/40"}`}
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
                <div className="flex flex-wrap gap-1 mt-2">{rm.amenities.map((a) => <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>)}</div>
              </button>
            ))}
            {available.length === 0 && !liveRooms.isLoading && (
              <div className="col-span-2 text-center py-10 text-muted-foreground text-sm">No available rooms for these dates.</div>
            )}
          </div>
        )}
        {step === 3 && selectedRoom && (
          <div className="space-y-3 text-sm">
            <Row k={`Room ${selectedRoom.number} · ${selectedRoom.type}`} v={`${nights} night${nights > 1 ? "s" : ""} × ${fmtINR(selectedRoom.rate)}`} />
            <Row k="Subtotal" v={fmtINR(subtotal)} />
            <Row k="GST (18%)" v={fmtINR(tax)} />
            <div className="border-t pt-3"><Row k="Total" v={<span className="text-lg font-semibold">{fmtINR(total)}</span>} /></div>
            <div className="pt-4">
              <Label>Booking source</Label>
              <Select value={r.source} onValueChange={(v) => setR({ ...r, source: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BOOKING_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
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
              <Field label="Total"><div className="font-semibold text-lg">{fmtINR(total)}</div></Field>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <Button variant="outline" disabled={step === 1} onClick={() => setStep(step - 1)}><ArrowLeft className="size-4" /> Back</Button>
          {step < 4 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={(step === 1 && (!g.name || !g.phone)) || (step === 2 && !r.roomId)}
            >
              Continue <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={createRes.isPending}>
              {createRes.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Confirm reservation
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
