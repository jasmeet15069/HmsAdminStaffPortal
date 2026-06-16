import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, CreditCard } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const MENU = [
  { name: "Butter Chicken", price: 520, cat: "Main" },
  { name: "Paneer Tikka", price: 380, cat: "Starter" },
  { name: "Veg Biryani", price: 340, cat: "Main" },
  { name: "Naan", price: 60, cat: "Bread" },
  { name: "Dal Makhani", price: 280, cat: "Main" },
  { name: "Caesar Salad", price: 320, cat: "Salad" },
  { name: "Margherita Pizza", price: 480, cat: "Main" },
  { name: "Fresh Lime Soda", price: 120, cat: "Beverage" },
  { name: "Cappuccino", price: 180, cat: "Beverage" },
  { name: "Chocolate Brownie", price: 240, cat: "Dessert" },
  { name: "Club Sandwich", price: 380, cat: "Snack" },
  { name: "French Fries", price: 200, cat: "Snack" },
];

export const Route = createFileRoute("/pos")({
  head: () => ({ meta: [{ title: "POS & Restaurant · MHMS" }] }),
  component: POS,
});

function POS() {
  const { orders, addOrder, updateOrder } = useMHMS();
  const [cart, setCart] = useState<{ name: string; qty: number; price: number }[]>([]);
  const [table, setTable] = useState("T-01");

  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);
  const add = (m: typeof MENU[number]) => {
    const ex = cart.find(c => c.name === m.name);
    setCart(ex ? cart.map(c => c.name === m.name ? { ...c, qty: c.qty + 1 } : c) : [...cart, { name: m.name, qty: 1, price: m.price }]);
  };

  const todayRevenue = orders.reduce((s, o) => s + o.total, 0);

  return (
    <>
      <PageHeader title="POS & Restaurant" description="Run orders for restaurant, bar, room service and spa" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Today's Revenue" value={fmtINR(todayRevenue)} tone="success" />
        <Stat label="Open Orders" value={orders.filter(o => o.status !== "Paid").length} tone="info" />
        <Stat label="Avg Ticket" value={fmtINR(Math.round(todayRevenue / Math.max(orders.length, 1)))} />
        <Stat label="Active Tables" value={new Set(orders.filter(o => o.status === "Open").map(o => o.table)).size} />
      </div>

      <Tabs defaultValue="new">
        <TabsList>
          <TabsTrigger value="new">New Order</TabsTrigger>
          <TabsTrigger value="open">Open Orders ({orders.filter(o => o.status !== "Paid").length})</TabsTrigger>
        </TabsList>
        <TabsContent value="new">
          <div className="grid grid-cols-12 gap-4 mt-4">
            <Card className="col-span-8 p-4">
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {MENU.map(m => (
                  <button key={m.name} onClick={() => add(m)} className="border rounded-lg p-3 text-left hover:border-primary hover:bg-primary/5 transition">
                    <div className="text-xs text-muted-foreground">{m.cat}</div>
                    <div className="font-medium text-sm">{m.name}</div>
                    <div className="text-sm font-semibold mt-1">{fmtINR(m.price)}</div>
                  </button>
                ))}
              </div>
            </Card>
            <Card className="col-span-4 p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Order Ticket</h3>
                <Badge variant="outline">{table}</Badge>
              </div>
              <div className="flex-1 space-y-2 min-h-[200px] max-h-[400px] overflow-y-auto">
                {cart.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">No items</div>}
                {cart.map(c => (
                  <div key={c.name} className="flex items-center justify-between text-sm border-b pb-2">
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.qty} × {fmtINR(c.price)}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{fmtINR(c.qty * c.price)}</span>
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => setCart(cart.filter(x => x.name !== c.name))}><Trash2 className="size-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between font-semibold text-lg"><span>Total</span><span>{fmtINR(total)}</span></div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <Button variant="outline" disabled={!cart.length} onClick={() => { addOrder({ outlet: "Restaurant", table, items: cart, status: "Sent", total }); setCart([]); toast.success("Sent to kitchen"); }}>Send to KOT</Button>
                  <Button disabled={!cart.length} onClick={() => { addOrder({ outlet: "Restaurant", table, items: cart, status: "Paid", total }); setCart([]); toast.success("Order paid"); }}>
                    <CreditCard className="size-4" /> Pay
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="open">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            {orders.filter(o => o.status !== "Paid").map(o => (
              <Card key={o.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-semibold">{o.outlet}</div>
                    <div className="text-xs text-muted-foreground">{o.table ?? "Room"}</div>
                  </div>
                  <Badge variant={o.status === "Open" ? "secondary" : "outline"}>{o.status}</Badge>
                </div>
                <div className="space-y-1 text-sm">
                  {o.items.map(i => <div key={i.name} className="flex justify-between"><span>{i.qty}× {i.name}</span><span>{fmtINR(i.qty*i.price)}</span></div>)}
                </div>
                <div className="border-t mt-2 pt-2 flex justify-between font-semibold"><span>Total</span><span>{fmtINR(o.total)}</span></div>
                <Button size="sm" className="w-full mt-3" onClick={() => { updateOrder(o.id, { status: "Paid" }); toast.success("Paid"); }}>Mark Paid</Button>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
