import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { useAuth } from "@/lib/api/auth";
import { useReservations, useCheckIn, useCheckOut } from "@/lib/api/hooks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/front-desk")({
  head: () => ({ meta: [{ title: "Front Desk · MHMS" }] }),
  component: FrontDesk,
});

interface DeskRow {
  id: string;
  guestName: string;
  roomLabel: string;
  checkIn: string;
  checkOut: string;
  nights: number;
}

function FrontDesk() {
  const authed = !!useAuth((s) => s.user);
  const live = useReservations();
  const isLive = authed && !!live.data;
  const checkInM = useCheckIn();
  const checkOutM = useCheckOut();

  const { reservations, guests, rooms, checkIn, checkOut, folios, payments, addPayment } =
    useMHMS();
  const today = new Date().toISOString().slice(0, 10);

  // Live-mode rows
  const liveArrivals: DeskRow[] = isLive
    ? (live.data ?? [])
        .filter((r) => r.status === "upcoming" || r.status === "pending_checkin")
        .map((r) => ({
          id: r.id,
          guestName: r.guest_name,
          roomLabel: r.room_number || "—",
          checkIn: r.check_in_date.slice(0, 10),
          checkOut: r.check_out_date.slice(0, 10),
          nights: r.nights,
        }))
    : [];
  const liveInHouse: DeskRow[] = isLive
    ? (live.data ?? [])
        .filter((r) => r.status === "in_house")
        .map((r) => ({
          id: r.id,
          guestName: r.guest_name,
          roomLabel: r.room_number || "—",
          checkIn: r.check_in_date.slice(0, 10),
          checkOut: r.check_out_date.slice(0, 10),
          nights: r.nights,
        }))
    : [];

  // Demo-mode source
  const demoArrivals = reservations.filter(
    (r) => r.status === "confirmed" || (r.checkIn <= today && r.status === "pending"),
  );
  const demoInhouse = reservations.filter((r) => r.status === "checked_in");

  const arrivalsCount = isLive ? liveArrivals.length : demoArrivals.length;
  const inhouseCount = isLive ? liveInHouse.length : demoInhouse.length;

  const doCheckIn = (id: string, who: string, room: string) => {
    if (isLive) checkInM.mutate(id, { onSuccess: () => toast.success(`${who} checked in`) });
    else {
      checkIn(id);
      toast.success(`${who} checked into ${room}`);
    }
  };
  const doCheckOut = (id: string, who: string) => {
    if (isLive) checkOutM.mutate(id, { onSuccess: () => toast.success(`${who} checked out`) });
    else {
      checkOut(id);
      toast.success(`${who} checked out`);
    }
  };

  return (
    <>
      <PageHeader
        title="Front Desk"
        description="Check-in, check-out, in-house operations"
        actions={
          <Badge variant={isLive ? "default" : "outline"} className="self-center">
            {isLive ? "Live data" : "Demo data"}
          </Badge>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Arrivals" value={arrivalsCount} tone="info" />
        <Stat label="In-House" value={inhouseCount} tone="success" />
        <Stat label="Departures" value={inhouseCount} tone="warning" />
        <Stat label="VIP Guests" value={isLive ? "—" : guests.filter((g) => g.vip).length} />
      </div>

      <Tabs defaultValue="arrivals">
        <TabsList>
          <TabsTrigger value="arrivals">Arrivals</TabsTrigger>
          <TabsTrigger value="departures">Departures</TabsTrigger>
          <TabsTrigger value="inhouse">In-House</TabsTrigger>
        </TabsList>

        {/* Arrivals */}
        <TabsContent value="arrivals">
          <Card className="p-4 mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Nights</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLive
                  ? liveArrivals.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.guestName}</TableCell>
                        <TableCell>{r.roomLabel}</TableCell>
                        <TableCell>{r.checkIn}</TableCell>
                        <TableCell>{r.nights}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            disabled={checkInM.isPending}
                            onClick={() => doCheckIn(r.id, r.guestName, r.roomLabel)}
                          >
                            {checkInM.isPending ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <LogIn className="size-4" />
                            )}{" "}
                            Check In
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  : demoArrivals.map((r) => {
                      const g = guests.find((x) => x.id === r.guestId);
                      const rm = rooms.find((x) => x.id === r.roomId);
                      const nights = Math.round(
                        (new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 86400000,
                      );
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium flex items-center gap-2">
                            {g?.name}
                            {g?.vip && (
                              <Badge className="bg-warning text-warning-foreground">VIP</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {rm?.number} · {rm?.type}
                          </TableCell>
                          <TableCell>{r.checkIn}</TableCell>
                          <TableCell>{nights}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => doCheckIn(r.id, g?.name ?? "Guest", rm?.number ?? "")}
                            >
                              <LogIn className="size-4" /> Check In
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                {arrivalsCount === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No arrivals pending
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Departures */}
        <TabsContent value="departures">
          <Card className="p-4 mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Room</TableHead>
                  {!isLive && (
                    <>
                      <TableHead>Folio</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Balance</TableHead>
                    </>
                  )}
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLive
                  ? liveInHouse.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.guestName}</TableCell>
                        <TableCell>{r.roomLabel}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            disabled={checkOutM.isPending}
                            onClick={() => doCheckOut(r.id, r.guestName)}
                          >
                            {checkOutM.isPending ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <LogOut className="size-4" />
                            )}{" "}
                            Check Out
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  : demoInhouse.map((r) => {
                      const g = guests.find((x) => x.id === r.guestId);
                      const rm = rooms.find((x) => x.id === r.roomId);
                      const total = folios
                        .filter((f) => f.reservationId === r.id)
                        .reduce((s, f) => s + f.amount, 0);
                      const paid = payments
                        .filter((p) => p.reservationId === r.id)
                        .reduce((s, p) => s + p.amount, 0);
                      const bal = total - paid;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{g?.name}</TableCell>
                          <TableCell>{rm?.number}</TableCell>
                          <TableCell>{fmtINR(total)}</TableCell>
                          <TableCell>{fmtINR(paid)}</TableCell>
                          <TableCell
                            className={bal > 0 ? "text-destructive font-medium" : "text-success"}
                          >
                            {fmtINR(bal)}
                          </TableCell>
                          <TableCell className="space-x-2">
                            {bal > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  addPayment({
                                    reservationId: r.id,
                                    amount: bal,
                                    method: "Card",
                                    date: today,
                                    reference: "TXN" + Date.now(),
                                  });
                                  toast.success(`${fmtINR(bal)} settled`);
                                }}
                              >
                                Settle
                              </Button>
                            )}
                            <Button size="sm" onClick={() => doCheckOut(r.id, g?.name ?? "Guest")}>
                              <LogOut className="size-4" /> Check Out
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                {inhouseCount === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={isLive ? 3 : 6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No in-house guests
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* In-House */}
        <TabsContent value="inhouse">
          <Card className="p-4 mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLive
                  ? liveInHouse.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.guestName}</TableCell>
                        <TableCell>{r.roomLabel}</TableCell>
                        <TableCell>{r.checkIn}</TableCell>
                        <TableCell>{r.checkOut}</TableCell>
                      </TableRow>
                    ))
                  : demoInhouse.map((r) => {
                      const g = guests.find((x) => x.id === r.guestId);
                      const rm = rooms.find((x) => x.id === r.roomId);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{g?.name}</TableCell>
                          <TableCell>{rm?.number}</TableCell>
                          <TableCell>{r.checkIn}</TableCell>
                          <TableCell>{r.checkOut}</TableCell>
                        </TableRow>
                      );
                    })}
                {inhouseCount === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No in-house guests
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
