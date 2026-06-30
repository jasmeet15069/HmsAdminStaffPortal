import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR, roomStatusMeta, type RoomStatus } from "@/lib/mhms-store";
import { useAuth } from "@/lib/api/auth";
import {
  useReservations, useCheckIn, useCheckOut,
  useBillingFolios, useRecordFolioPayment,
  useCreateGuest, useCreateReservation, useRooms,
} from "@/lib/api/hooks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  LogIn, LogOut, Loader2, Search, Star, Phone, Mail,
  UserPlus, CreditCard, AlertCircle, MessageSquare,
  BedDouble, CalendarClock,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/front-desk")({
  head: () => ({ meta: [{ title: "Front Desk · MHMS" }] }),
  component: FrontDesk,
});

interface DeskRow {
  id: string; guestName: string; guestEmail?: string; guestPhone?: string;
  roomLabel: string; roomId?: string; checkIn: string; checkOut: string;
  nights: number; rate: number; vip?: boolean; loyaltyTier?: string; preferences?: string;
}

const PREFERENCES = ["High floor", "Non-smoking", "Extra pillow", "Late check-out", "Early check-in", "Quiet room", "Sea view", "King bed"];

function FrontDesk() {
  const authed = !!useAuth((s) => s.user);
  const live = useReservations();
  const isLive = authed && !!live.data;
  const checkInM = useCheckIn();
  const checkOutM = useCheckOut();
  const billingFoliosQ = useBillingFolios();
  const recordPayM = useRecordFolioPayment();
  const createGuestM = useCreateGuest();
  const createResM = useCreateReservation();
  const liveRoomsQ = useRooms();
  const { reservations, guests, rooms, checkIn, checkOut, folios, payments, addPayment } = useMHMS();
  const today = new Date().toISOString().slice(0, 10);

  // Build booking_id → folio lookup for O(1) balance access in live mode
  const liveFolioMap = useMemo(() => {
    const m = new Map<string, { id: string; balance: number; total_charges: number; total_paid: number }>();
    (billingFoliosQ.data ?? []).forEach((f) => m.set(f.booking_id, f));
    return m;
  }, [billingFoliosQ.data]);

  const [searchInhouse, setSearchInhouse] = useState("");
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState<string | null>(null);
  const [walkIn, setWalkIn] = useState({ name: "", phone: "", email: "", roomType: "Deluxe", nights: "1", payment: "Card", idType: "Aadhar", idNumber: "" });

  const liveArrivals: DeskRow[] = isLive
    ? (live.data ?? []).filter((r) => r.status === "upcoming" || r.status === "pending_checkin").map((r) => ({
        id: r.id, guestName: r.guest_name, guestEmail: r.guest_email ?? undefined,
        guestPhone: r.guest_phone ?? undefined, roomLabel: r.room_number || "—",
        checkIn: r.check_in_date.slice(0, 10), checkOut: r.check_out_date.slice(0, 10),
        nights: r.nights, rate: r.total_amount ?? 0,
      })) : [];

  const liveInHouse: DeskRow[] = isLive
    ? (live.data ?? []).filter((r) => r.status === "in_house").map((r) => ({
        id: r.id, guestName: r.guest_name, guestEmail: r.guest_email ?? undefined,
        guestPhone: r.guest_phone ?? undefined, roomLabel: r.room_number || "—",
        checkIn: r.check_in_date.slice(0, 10), checkOut: r.check_out_date.slice(0, 10),
        nights: r.nights, rate: r.total_amount ?? 0,
      })) : [];

  const demoArrivals: DeskRow[] = useMemo(() => reservations
    .filter((r) => r.status === "confirmed" || (r.checkIn <= today && r.status === "pending"))
    .map((r) => {
      const g = guests.find((x) => x.id === r.guestId);
      const rm = rooms.find((x) => x.id === r.roomId);
      return {
        id: r.id, guestName: g?.name ?? "—", guestEmail: g?.email, guestPhone: g?.phone,
        roomLabel: rm ? `${rm.number} · ${rm.type}` : "—", roomId: rm?.id,
        checkIn: r.checkIn, checkOut: r.checkOut,
        nights: Math.max(1, Math.round((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 86400000)),
        rate: r.rate, vip: g?.vip, loyaltyTier: g?.loyaltyTier,
        preferences: PREFERENCES[Math.abs(r.id.charCodeAt(0) - 97) % PREFERENCES.length],
      };
    }), [reservations, guests, rooms, today]);

  const demoInHouse: DeskRow[] = useMemo(() => reservations
    .filter((r) => r.status === "checked_in")
    .map((r) => {
      const g = guests.find((x) => x.id === r.guestId);
      const rm = rooms.find((x) => x.id === r.roomId);
      const total = folios.filter((f) => f.reservationId === r.id).reduce((s, f) => s + f.amount, 0);
      const paid = payments.filter((p) => p.reservationId === r.id).reduce((s, p) => s + p.amount, 0);
      return {
        id: r.id, guestName: g?.name ?? "—", guestEmail: g?.email, guestPhone: g?.phone,
        roomLabel: rm ? `${rm.number} · ${rm.type}` : "—", roomId: rm?.id,
        checkIn: r.checkIn, checkOut: r.checkOut,
        nights: Math.max(1, Math.round((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 86400000)),
        rate: total - paid, vip: g?.vip, loyaltyTier: g?.loyaltyTier,
      };
    }), [reservations, guests, rooms, folios, payments]);

  const arrivals = isLive ? liveArrivals : demoArrivals;
  const inhouse = isLive ? liveInHouse : demoInHouse;

  const filteredInhouse = inhouse.filter((r) =>
    r.guestName.toLowerCase().includes(searchInhouse.toLowerCase()) ||
    r.roomLabel.toLowerCase().includes(searchInhouse.toLowerCase())
  );

  const availableRooms = rooms.filter((r) => r.status === "vacant_clean").length;
  const vipCount = isLive ? liveArrivals.filter((r) => r.vip).length : guests.filter((g) => g.vip && reservations.some((r) => r.guestId === g.id && r.status === "checked_in")).length;

  const doCheckIn = (id: string, name: string, room: string) => {
    if (isLive) checkInM.mutate(id, { onSuccess: () => toast.success(`${name} checked in`) });
    else { checkIn(id); toast.success(`${name} checked into ${room}`); }
  };
  const doCheckOut = (id: string, name: string) => {
    if (isLive) checkOutM.mutate(id, { onSuccess: () => toast.success(`${name} checked out`) });
    else { checkOut(id); toast.success(`${name} checked out`); }
  };

  const initials = (name: string) => name.split(" ").map((s) => s[0]?.toUpperCase() ?? "").join("").slice(0, 2);

  const tierColor = (tier?: string) => {
    if (tier === "Platinum") return "bg-info/15 text-info border-info/30";
    if (tier === "Gold") return "bg-warning/20 text-warning-foreground border-warning/40";
    return "bg-muted text-muted-foreground";
  };

  // Room map — group by floor
  const floors = useMemo(() => {
    const groups: Record<number, typeof rooms> = {};
    rooms.forEach((r) => { groups[r.floor] ??= []; groups[r.floor].push(r); });
    return Object.entries(groups).sort(([a], [b]) => Number(a) - Number(b));
  }, [rooms]);
  const [activeFloor, setActiveFloor] = useState<string | null>(null);
  const mapRooms = activeFloor ? rooms.filter((r) => r.floor === Number(activeFloor)) : rooms;

  return (
    <>
      <PageHeader
        title="Front Desk"
        description="Check-in, check-out, in-house management and room map"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={isLive ? "default" : "outline"} className="self-center">{isLive ? "Live" : "Demo"}</Badge>
            <Button size="sm" className="gap-1.5" onClick={() => setWalkInOpen(true)}>
              <UserPlus className="size-4" />Walk-In
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <Stat label="Arrivals" value={arrivals.length} tone="info" hint="Expected today" />
        <Stat label="In-House" value={inhouse.length} tone="success" hint="Currently staying" />
        <Stat label="Departures" value={inhouse.filter((r) => r.checkOut === today).length} tone="warning" hint="Due today" />
        <Stat label="VIP In-House" value={vipCount} hint="VIP guests today" />
        <Stat label="Rooms Ready" value={availableRooms} tone="success" hint="Vacant & clean" />
      </div>

      <Tabs defaultValue="arrivals">
        <TabsList className="mb-4">
          <TabsTrigger value="arrivals">
            <LogIn className="size-3.5 mr-1.5" />Arrivals
            <Badge variant="secondary" className="ml-1.5 text-[10px]">{arrivals.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="departures">
            <LogOut className="size-3.5 mr-1.5" />Departures
            <Badge variant="secondary" className="ml-1.5 text-[10px]">{inhouse.filter((r) => r.checkOut === today).length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="inhouse">
            <BedDouble className="size-3.5 mr-1.5" />In-House
            <Badge variant="secondary" className="ml-1.5 text-[10px]">{inhouse.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="roommap"><CalendarClock className="size-3.5 mr-1.5" />Room Map</TabsTrigger>
        </TabsList>

        {/* ── ARRIVALS ───────────────────────────────────────────────────────── */}
        <TabsContent value="arrivals">
          {arrivals.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">No arrivals pending today.</Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {arrivals.map((r) => (
                <Card key={r.id} className={`p-4 ${r.vip ? "border-warning/40 bg-warning/5" : ""}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-9"><AvatarFallback className="text-xs bg-primary/10 text-primary">{initials(r.guestName)}</AvatarFallback></Avatar>
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-1">
                          {r.guestName}
                          {r.vip && <Star className="size-3.5 text-yellow-500 fill-yellow-500" />}
                        </div>
                        {r.loyaltyTier && r.loyaltyTier !== "Standard" && (
                          <Badge className={`text-[9px] border mt-0.5 ${tierColor(r.loyaltyTier)}`}>{r.loyaltyTier}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div className="font-medium">{r.roomLabel}</div>
                      <div>{r.nights}N · {fmtINR(r.rate)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
                    <div className="flex items-center gap-1"><CalendarClock className="size-3" /> {r.checkIn} → {r.checkOut}</div>
                    {r.guestPhone && <div className="flex items-center gap-1"><Phone className="size-3" /> {r.guestPhone}</div>}
                    {r.guestEmail && <div className="flex items-center gap-1 col-span-2 truncate"><Mail className="size-3" /> {r.guestEmail}</div>}
                    {r.preferences && (
                      <div className="col-span-2 flex items-center gap-1 text-info">
                        <AlertCircle className="size-3" /> {r.preferences}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-1 h-8" onClick={() => setMsgOpen(r.id)}>
                      <MessageSquare className="size-3.5" />Note
                    </Button>
                    <Button size="sm" className="flex-1 gap-1 h-8" disabled={checkInM.isPending}
                      onClick={() => doCheckIn(r.id, r.guestName, r.roomLabel)}>
                      {checkInM.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <LogIn className="size-3.5" />}
                      Check In
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── DEPARTURES ─────────────────────────────────────────────────────── */}
        <TabsContent value="departures">
          {inhouse.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">No in-house guests to depart.</Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {inhouse.map((r) => {
                // Live: use folio from API; Demo: compute from store
                const liveF = isLive ? liveFolioMap.get(r.id) : null;
                const demoTotal = !isLive ? folios.filter((f) => f.reservationId === r.id).reduce((s, f) => s + f.amount, 0) : 0;
                const demoPaid = !isLive ? payments.filter((p) => p.reservationId === r.id).reduce((s, p) => s + p.amount, 0) : 0;
                const total = isLive ? (liveF?.total_charges ?? 0) : demoTotal;
                const paid = isLive ? (liveF?.total_paid ?? 0) : demoPaid;
                const balance = isLive ? (liveF?.balance ?? 0) : (demoTotal - demoPaid);
                const isDueToday = r.checkOut === today;
                return (
                  <Card key={r.id} className={`p-4 ${isDueToday ? "border-warning/40 bg-warning/5" : ""}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-9"><AvatarFallback className="text-xs bg-primary/10 text-primary">{initials(r.guestName)}</AvatarFallback></Avatar>
                        <div>
                          <div className="font-semibold text-sm flex items-center gap-1">
                            {r.guestName}{r.vip && <Star className="size-3.5 text-yellow-500 fill-yellow-500" />}
                          </div>
                          <div className="text-xs text-muted-foreground">{r.roomLabel}</div>
                        </div>
                      </div>
                      {isDueToday && <Badge className="bg-warning/20 text-warning-foreground border-warning/40 text-[10px]">Due Today</Badge>}
                    </div>

                    <div className="space-y-1.5 text-sm mb-3">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Stay</span><span>{r.checkIn} → {r.checkOut}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground"><span>Folio Total</span><span>{fmtINR(total)}</span></div>
                      <div className="flex justify-between text-success"><span>Paid</span><span>{fmtINR(paid)}</span></div>
                      <div className={`flex justify-between font-semibold border-t pt-1 ${balance > 0 ? "text-destructive" : "text-success"}`}>
                        <span>Balance</span><span>{fmtINR(balance)}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {balance > 0 && (
                        <Button size="sm" variant="outline" className="flex-1 gap-1 h-8"
                          disabled={recordPayM.isPending}
                          onClick={() => {
                            if (isLive && liveF) {
                              recordPayM.mutate(
                                { folioId: liveF.id, amount: balance, payment_method: "card", notes: "Settled at checkout" },
                                { onSuccess: () => { toast.success(`${fmtINR(balance)} settled`); billingFoliosQ.refetch(); },
                                  onError: (e: any) => toast.error(e.message ?? "Payment failed") }
                              );
                            } else {
                              addPayment({ reservationId: r.id, amount: balance, method: "Card", date: today, reference: "TXN" + Date.now() });
                              toast.success(`${fmtINR(balance)} settled`);
                            }
                          }}>
                          {recordPayM.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CreditCard className="size-3.5" />}Settle
                        </Button>
                      )}
                      <Button size="sm" className="flex-1 gap-1 h-8" disabled={checkOutM.isPending}
                        onClick={() => doCheckOut(r.id, r.guestName)}>
                        {checkOutM.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
                        Check Out
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── IN-HOUSE ───────────────────────────────────────────────────────── */}
        <TabsContent value="inhouse">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8 h-8 w-56 text-sm" placeholder="Search guest or room…" value={searchInhouse} onChange={(e) => setSearchInhouse(e.target.value)} />
            </div>
            <Badge variant="outline" className="text-xs">{filteredInhouse.length} guests</Badge>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Guest", "Room", "Check-in", "Check-out", "Nights Left", "Balance", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredInhouse.map((r) => {
                    const nightsLeft = Math.max(0, Math.round((new Date(r.checkOut).getTime() - Date.now()) / 86400000));
                    const liveF = isLive ? liveFolioMap.get(r.id) : null;
                    const balance = isLive ? (liveF?.balance ?? 0) : r.rate;
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-accent/5">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="size-7"><AvatarFallback className="text-xs">{initials(r.guestName)}</AvatarFallback></Avatar>
                            <div>
                              <div className="font-medium flex items-center gap-1">{r.guestName}{r.vip && <Star className="size-3 text-yellow-500 fill-yellow-500" />}</div>
                              {r.guestPhone && <div className="text-[10px] text-muted-foreground">{r.guestPhone}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{r.roomLabel}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{r.checkIn}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{r.checkOut}</td>
                        <td className="px-4 py-3">
                          <Badge className={`text-[10px] ${nightsLeft === 0 ? "bg-destructive/15 text-destructive" : nightsLeft === 1 ? "bg-warning/20 text-warning-foreground" : "bg-success/15 text-success"}`}>
                            {nightsLeft === 0 ? "Due today" : `${nightsLeft}N left`}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-medium">{fmtINR(balance)}</td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setMsgOpen(r.id)}>
                            <MessageSquare className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredInhouse.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No in-house guests found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ── ROOM MAP ───────────────────────────────────────────────────────── */}
        <TabsContent value="roommap">
          {/* Floor filter */}
          <div className="flex gap-1.5 mb-4 flex-wrap items-center">
            <span className="text-xs text-muted-foreground mr-1">Floor:</span>
            <button onClick={() => setActiveFloor(null)}
              className={`px-2.5 py-1 rounded text-xs font-medium border transition ${activeFloor === null ? "bg-secondary text-secondary-foreground" : "hover:border-muted-foreground/40"}`}>
              All
            </button>
            {floors.map(([floor]) => (
              <button key={floor} onClick={() => setActiveFloor(floor)}
                className={`px-2.5 py-1 rounded text-xs font-medium border transition ${activeFloor === floor ? "bg-secondary text-secondary-foreground" : "hover:border-muted-foreground/40"}`}>
                {floor}F
              </button>
            ))}
          </div>

          {/* Per-floor sections */}
          {(activeFloor ? [[activeFloor, rooms.filter((r) => r.floor === Number(activeFloor))]] as [string, typeof rooms][] : floors).map(([floor, floorRooms]) => {
            const clean = floorRooms.filter((r) => r.status === "vacant_clean").length;
            const dirty = floorRooms.filter((r) => r.status === "vacant_dirty").length;
            const occ = floorRooms.filter((r) => r.status === "occupied").length;
            const maint = floorRooms.filter((r) => r.status === "maintenance").length;
            return (
              <div key={floor} className="mb-5">
                <div className="flex items-center gap-4 mb-2">
                  <h3 className="font-semibold text-sm">Floor {floor}</h3>
                  <div className="flex gap-3 text-[10px]">
                    <span className="text-success">✓ {clean} clean</span>
                    <span className="text-warning-foreground">~ {dirty} dirty</span>
                    <span className="text-info">● {occ} occupied</span>
                    {maint > 0 && <span className="text-destructive">⚠ {maint} maint.</span>}
                  </div>
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-10 lg:grid-cols-14 gap-1.5">
                  {floorRooms.map((r) => {
                    const meta = roomStatusMeta[r.status as RoomStatus];
                    const res = reservations.find((rv) => rv.roomId === r.id && rv.status === "checked_in");
                    const guest = res ? guests.find((g) => g.id === res.guestId) : null;
                    return (
                      <div key={r.id} title={guest ? `${guest.name}` : meta.label}
                        className={`border rounded p-1.5 text-center cursor-default hover:shadow transition ${meta.color}`}>
                        <div className="font-mono text-xs font-bold leading-tight">{r.number}</div>
                        <div className="text-[9px] opacity-70 leading-tight truncate">{r.type[0]}</div>
                        {guest && <div className="size-1.5 rounded-full bg-current mx-auto mt-0.5 opacity-70" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Legend */}
          <div className="flex gap-3 flex-wrap mt-2 text-xs">
            {(Object.entries(roomStatusMeta) as [RoomStatus, typeof roomStatusMeta[RoomStatus]][]).map(([s, m]) => (
              <div key={s} className="flex items-center gap-1.5">
                <span className={`size-3 rounded border ${m.color}`} />
                {m.label}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Walk-In Dialog */}
      <Dialog open={walkInOpen} onOpenChange={setWalkInOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Walk-In Registration</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label className="text-xs">Full Name *</Label><Input className="h-8 mt-1" placeholder="Guest full name" value={walkIn.name} onChange={(e) => setWalkIn({ ...walkIn, name: e.target.value })} /></div>
            <div><Label className="text-xs">Phone *</Label><Input className="h-8 mt-1" placeholder="+91 …" value={walkIn.phone} onChange={(e) => setWalkIn({ ...walkIn, phone: e.target.value })} /></div>
            <div><Label className="text-xs">Email</Label><Input className="h-8 mt-1" placeholder="guest@email.com" value={walkIn.email} onChange={(e) => setWalkIn({ ...walkIn, email: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Room Type</Label>
              <select className="mt-1 h-8 w-full border rounded px-2 text-sm bg-background" value={walkIn.roomType} onChange={(e) => setWalkIn({ ...walkIn, roomType: e.target.value })}>
                {["Standard", "Deluxe", "Suite", "Executive"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><Label className="text-xs">Nights</Label><Input type="number" min={1} className="h-8 mt-1" value={walkIn.nights} onChange={(e) => setWalkIn({ ...walkIn, nights: e.target.value })} /></div>
            <div>
              <Label className="text-xs">ID Type</Label>
              <select className="mt-1 h-8 w-full border rounded px-2 text-sm bg-background" value={walkIn.idType} onChange={(e) => setWalkIn({ ...walkIn, idType: e.target.value })}>
                {["Aadhar", "Passport", "Driving Licence", "PAN Card"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><Label className="text-xs">ID Number</Label><Input className="h-8 mt-1" placeholder="ID number" value={walkIn.idNumber} onChange={(e) => setWalkIn({ ...walkIn, idNumber: e.target.value })} /></div>
            <div className="col-span-2">
              <Label className="text-xs">Payment Method</Label>
              <div className="flex gap-2 mt-1">
                {["Cash", "Card", "UPI"].map((m) => (
                  <button key={m} onClick={() => setWalkIn({ ...walkIn, payment: m })}
                    className={`flex-1 py-1.5 text-xs rounded border transition ${walkIn.payment === m ? "bg-primary text-primary-foreground border-primary" : "hover:border-muted-foreground/40"}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalkInOpen(false)}>Cancel</Button>
            <Button
              disabled={!walkIn.name || !walkIn.phone || createGuestM.isPending || createResM.isPending || checkInM.isPending}
              onClick={async () => {
                if (!isLive) {
                  toast.success(`Walk-in registered for ${walkIn.name}`);
                  setWalkInOpen(false);
                  setWalkIn({ name: "", phone: "", email: "", roomType: "Deluxe", nights: "1", payment: "Card", idType: "Aadhar", idNumber: "" });
                  return;
                }
                // Find first available room of the requested type
                const availRoom = (liveRoomsQ.data ?? []).find(
                  (rm) => rm.status === "available" && rm.room_type.toLowerCase().includes(walkIn.roomType.toLowerCase())
                ) ?? (liveRoomsQ.data ?? []).find((rm) => rm.status === "available");
                if (!availRoom) { toast.error("No available rooms for selected type"); return; }
                const checkInDate = today;
                const checkOutDate = new Date(Date.now() + Number(walkIn.nights) * 86400000).toISOString().slice(0, 10);
                try {
                  // 1. Create guest
                  const guest = await createGuestM.mutateAsync({ full_name: walkIn.name, phone: walkIn.phone || undefined, email: walkIn.email || undefined });
                  // 2. Create reservation
                  const res = await createResM.mutateAsync({
                    guest_name: walkIn.name,
                    guest_phone: walkIn.phone || undefined,
                    guest_email: walkIn.email || undefined,
                    room_id: availRoom.id,
                    check_in_date: checkInDate,
                    check_out_date: checkOutDate,
                    source: "walk_in",
                  });
                  // 3. Immediately check in
                  checkInM.mutate((res as any)?.id ?? (res as any)?.reservation_id ?? "", {
                    onSuccess: () => {
                      toast.success(`${walkIn.name} checked into Room ${availRoom.room_number}`);
                      setWalkInOpen(false);
                      setWalkIn({ name: "", phone: "", email: "", roomType: "Deluxe", nights: "1", payment: "Card", idType: "Aadhar", idNumber: "" });
                      live.refetch();
                    },
                    onError: (e: any) => toast.error(e.message ?? "Check-in failed"),
                  });
                } catch (e: any) {
                  toast.error(e.message ?? "Walk-in registration failed");
                }
              }}
            >
              {(createGuestM.isPending || createResM.isPending || checkInM.isPending) ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
              Register & Check In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Guest Message Dialog */}
      <Dialog open={!!msgOpen} onOpenChange={() => setMsgOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Guest Request / Note</DialogTitle></DialogHeader>
          <textarea className="w-full border rounded p-2 text-sm min-h-[100px] bg-background resize-none" placeholder="Enter guest request or note (e.g. extra blanket, wake-up call at 7am)…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMsgOpen(null)}>Cancel</Button>
            <Button onClick={() => { toast.success("Note saved and sent to housekeeping"); setMsgOpen(null); }}>Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
