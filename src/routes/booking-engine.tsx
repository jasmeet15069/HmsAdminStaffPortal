import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";

export const Route = createFileRoute("/booking-engine")({
  head: () => ({ meta: [{ title: "Booking Engine · MHMS" }] }),
  component: BookingEngine,
});

function BookingEngine() {
  const { rooms } = useMHMS();
  const [s, setS] = useState({ in: new Date().toISOString().slice(0,10), out: new Date(Date.now()+86400000*2).toISOString().slice(0,10), guests: 2 });
  const types = Array.from(new Set(rooms.map(r => r.type))).map(t => {
    const sample = rooms.find(r => r.type === t)!;
    return { type: t, rate: sample.rate, available: rooms.filter(r => r.type === t && r.status !== "occupied" && r.status !== "maintenance").length };
  });

  return (
    <>
      <PageHeader title="Booking Engine" description="Direct booking widget — guest-facing preview" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Direct Bookings (MTD)" value={48} tone="success" />
        <Stat label="Conversion Rate" value="4.2%" tone="info" />
        <Stat label="Widget Visits" value="12.4k" />
        <Stat label="Avg Booking Value" value={fmtINR(8200)} tone="success" />
      </div>

      <Card className="p-6 mb-4">
        <h3 className="font-semibold mb-3">Live preview</h3>
        <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg p-6">
          <div className="bg-card rounded-lg p-4 max-w-2xl mx-auto">
            <div className="grid grid-cols-4 gap-3">
              <div><Label className="text-xs">Check-in</Label><Input type="date" value={s.in} onChange={(e) => setS({ ...s, in: e.target.value })} className="mt-1" /></div>
              <div><Label className="text-xs">Check-out</Label><Input type="date" value={s.out} onChange={(e) => setS({ ...s, out: e.target.value })} className="mt-1" /></div>
              <div><Label className="text-xs">Guests</Label><Input type="number" min={1} value={s.guests} onChange={(e) => setS({ ...s, guests: +e.target.value })} className="mt-1" /></div>
              <div className="flex items-end"><Button className="w-full" onClick={() => toast.success("Showing available rooms")}><Search className="size-4" /> Search</Button></div>
            </div>
          </div>
          <div className="max-w-2xl mx-auto mt-4 space-y-3">
            {types.map(t => (
              <Card key={t.type} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{t.type} Room</div>
                  <div className="text-xs text-muted-foreground">{t.available} available · Free WiFi · Breakfast included</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-lg">{fmtINR(t.rate)}</div>
                  <div className="text-xs text-muted-foreground">per night</div>
                  <Button size="sm" className="mt-1" onClick={() => toast.success(`${t.type} added to cart`)}>Book now</Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Card>
    </>
  );
}
