import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

export const Route = createFileRoute("/reservations/new")({
  head: () => ({ meta: [{ title: "New Reservation · MHMS" }] }),
  component: NewReservation,
});

function NewReservation() {
  const nav = useNavigate();
  const { rooms, addGuest, addReservation } = useMHMS();
  const [step, setStep] = useState(1);
  const [g, setG] = useState({ name: "", email: "", phone: "", nationality: "Indian", adults: 2, children: 0 });
  const [r, setR] = useState({ checkIn: new Date().toISOString().slice(0, 10), checkOut: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10), roomId: "", source: "Direct" as const, notes: "" });

  const available = rooms.filter((x) => x.status === "vacant_clean" || x.status === "vacant_dirty");
  const selectedRoom = rooms.find((x) => x.id === r.roomId);
  const nights = Math.max(1, Math.round((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 86400000));
  const subtotal = (selectedRoom?.rate ?? 0) * nights;
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax;

  const steps = ["Guest Details", "Room Selection", "Rate & Charges", "Confirm"];

  const submit = () => {
    const guest = addGuest({ name: g.name, email: g.email, phone: g.phone, nationality: g.nationality, loyaltyTier: "Silver", loyaltyPoints: 0, totalStays: 1 });
    const res = addReservation({
      guestId: guest.id, roomId: r.roomId, checkIn: r.checkIn, checkOut: r.checkOut,
      adults: g.adults, children: g.children, status: "confirmed", rate: selectedRoom!.rate, source: r.source, notes: r.notes,
    });
    toast.success(`Reservation ${res.code} created for ${guest.name}`);
    nav({ to: "/reservations" });
  };

  return (
    <>
      <PageHeader title="New Reservation" description="Step-by-step booking wizard" />

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
            <Field label="Email *"><Input type="email" value={g.email} onChange={(e) => setG({ ...g, email: e.target.value })} /></Field>
            <Field label="Phone *"><Input value={g.phone} onChange={(e) => setG({ ...g, phone: e.target.value })} /></Field>
            <Field label="Nationality">
              <Select value={g.nationality} onValueChange={(v) => setG({ ...g, nationality: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Indian">Indian</SelectItem>
                  <SelectItem value="Foreign">Foreign</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Adults"><Input type="number" min={1} value={g.adults} onChange={(e) => setG({ ...g, adults: +e.target.value })} /></Field>
            <Field label="Children"><Input type="number" min={0} value={g.children} onChange={(e) => setG({ ...g, children: +e.target.value })} /></Field>
            <Field label="Check-in date *"><Input type="date" value={r.checkIn} onChange={(e) => setR({ ...r, checkIn: e.target.value })} /></Field>
            <Field label="Check-out date *"><Input type="date" value={r.checkOut} onChange={(e) => setR({ ...r, checkOut: e.target.value })} /></Field>
          </div>
        )}
        {step === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto">
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
                <div className="flex flex-wrap gap-1 mt-2">{rm.amenities.map(a => <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>)}</div>
              </button>
            ))}
          </div>
        )}
        {step === 3 && selectedRoom && (
          <div className="space-y-3 text-sm">
            <Row k={`Room ${selectedRoom.number} · ${selectedRoom.type}`} v={`${nights} night${nights>1?"s":""} × ${fmtINR(selectedRoom.rate)}`} />
            <Row k="Subtotal" v={fmtINR(subtotal)} />
            <Row k="GST (18%)" v={fmtINR(tax)} />
            <div className="border-t pt-3"><Row k="Total" v={<span className="text-lg font-semibold">{fmtINR(total)}</span>} /></div>
            <div className="pt-4">
              <Label>Booking source</Label>
              <Select value={r.source} onValueChange={(v) => setR({ ...r, source: v as never })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Direct">Direct</SelectItem>
                  <SelectItem value="Booking.com">Booking.com</SelectItem>
                  <SelectItem value="Expedia">Expedia</SelectItem>
                  <SelectItem value="Walk-in">Walk-in</SelectItem>
                  <SelectItem value="Corporate">Corporate</SelectItem>
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
              <Field label="Guest"><div className="font-medium">{g.name}</div><div className="text-muted-foreground text-xs">{g.email} · {g.phone}</div></Field>
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
              disabled={(step === 1 && (!g.name || !g.email || !g.phone)) || (step === 2 && !r.roomId)}
            >
              Continue <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={submit}><Check className="size-4" /> Confirm reservation</Button>
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
