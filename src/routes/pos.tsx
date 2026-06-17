import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import type { POSOrder } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Search,
  Printer,
  ChefHat,
  Banknote,
  Smartphone,
  BedDouble,
  Clock,
  CheckCircle2,
  ReceiptText,
  UtensilsCrossed,
  Wine,
  Sparkles,
  ShoppingBag,
  Filter,
  X,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

// ── Menu data ──────────────────────────────────────────────────────────────────

type Outlet = "Restaurant" | "Bar" | "Room Service" | "Spa";
type MenuItem = { id: string; name: string; price: number; cat: string; desc?: string };

const MENU: Record<Outlet, MenuItem[]> = {
  Restaurant: [
    { id: "r1",  name: "Paneer Tikka",         price: 380, cat: "Starter",  desc: "Grilled cottage cheese cubes" },
    { id: "r2",  name: "Chicken Tikka",         price: 420, cat: "Starter",  desc: "Tandoor-smoked chicken" },
    { id: "r3",  name: "Tomato Soup",           price: 220, cat: "Starter",  desc: "Creamy tomato bisque" },
    { id: "r4",  name: "Spring Rolls",          price: 280, cat: "Starter",  desc: "Crispy veg rolls" },
    { id: "r5",  name: "Butter Chicken",        price: 520, cat: "Main",     desc: "Murgh makhani, butter sauce" },
    { id: "r6",  name: "Dal Makhani",           price: 280, cat: "Main",     desc: "Slow-cooked black lentil" },
    { id: "r7",  name: "Veg Biryani",           price: 340, cat: "Main",     desc: "Fragrant basmati rice" },
    { id: "r8",  name: "Chicken Biryani",       price: 420, cat: "Main",     desc: "Dum-cooked chicken biryani" },
    { id: "r9",  name: "Margherita Pizza",      price: 480, cat: "Main",     desc: "Fresh mozzarella & basil" },
    { id: "r10", name: "Pasta Arrabiata",       price: 380, cat: "Main",     desc: "Penne in spicy tomato" },
    { id: "r11", name: "Grilled Fish",          price: 680, cat: "Main",     desc: "Sea bass with herb butter" },
    { id: "r12", name: "Mushroom Risotto",      price: 460, cat: "Main",     desc: "Arborio rice, wild mushroom" },
    { id: "r13", name: "Garlic Naan",           price: 80,  cat: "Bread",    desc: "Butter-glazed naan" },
    { id: "r14", name: "Naan",                  price: 60,  cat: "Bread" },
    { id: "r15", name: "Laccha Paratha",        price: 70,  cat: "Bread" },
    { id: "r16", name: "Caesar Salad",          price: 320, cat: "Salad",    desc: "Romaine, parmesan, croutons" },
    { id: "r17", name: "Greek Salad",           price: 280, cat: "Salad" },
    { id: "r18", name: "Gulab Jamun",           price: 180, cat: "Dessert",  desc: "Milk solids in sugar syrup" },
    { id: "r19", name: "Chocolate Brownie",     price: 240, cat: "Dessert",  desc: "Warm, with vanilla ice cream" },
    { id: "r20", name: "Cheesecake",            price: 280, cat: "Dessert" },
    { id: "r21", name: "Fresh Lime Soda",       price: 120, cat: "Beverage" },
    { id: "r22", name: "Mango Lassi",           price: 160, cat: "Beverage" },
    { id: "r23", name: "Masala Chai",           price: 80,  cat: "Beverage" },
    { id: "r24", name: "Cold Coffee",           price: 180, cat: "Beverage" },
    { id: "r25", name: "Cappuccino",            price: 180, cat: "Beverage" },
    { id: "r26", name: "Club Sandwich",         price: 380, cat: "Snack",    desc: "Triple-decker with fries" },
    { id: "r27", name: "French Fries",          price: 200, cat: "Snack" },
  ],
  Bar: [
    { id: "b1",  name: "Old Fashioned",         price: 680, cat: "Cocktail",  desc: "Bourbon, bitters, orange" },
    { id: "b2",  name: "Mojito",                price: 520, cat: "Cocktail",  desc: "Rum, mint, lime, soda" },
    { id: "b3",  name: "Cosmopolitan",          price: 580, cat: "Cocktail",  desc: "Vodka, triple sec, cranberry" },
    { id: "b4",  name: "Margarita",             price: 560, cat: "Cocktail",  desc: "Tequila, lime, salt rim" },
    { id: "b5",  name: "Whiskey Sour",          price: 620, cat: "Cocktail",  desc: "Bourbon, lemon, egg white" },
    { id: "b6",  name: "Negroni",               price: 650, cat: "Cocktail",  desc: "Gin, Campari, vermouth" },
    { id: "b7",  name: "Virgin Mojito",         price: 280, cat: "Mocktail",  desc: "Mint, lime, soda" },
    { id: "b8",  name: "Shirley Temple",        price: 260, cat: "Mocktail" },
    { id: "b9",  name: "Blue Lagoon (N/A)",     price: 300, cat: "Mocktail" },
    { id: "b10", name: "Kingfisher",            price: 380, cat: "Beer",      desc: "330ml bottle" },
    { id: "b11", name: "Heineken",              price: 450, cat: "Beer",      desc: "330ml bottle" },
    { id: "b12", name: "Corona",               price: 480, cat: "Beer",      desc: "355ml bottle" },
    { id: "b13", name: "House Whiskey",         price: 420, cat: "Spirit",    desc: "60ml peg" },
    { id: "b14", name: "Premium Scotch",        price: 780, cat: "Spirit",    desc: "60ml — single malt" },
    { id: "b15", name: "Vodka",                 price: 380, cat: "Spirit",    desc: "60ml peg" },
    { id: "b16", name: "House Red Wine",        price: 580, cat: "Wine",      desc: "150ml glass" },
    { id: "b17", name: "House White Wine",      price: 540, cat: "Wine",      desc: "150ml glass" },
    { id: "b18", name: "Prosecco",              price: 780, cat: "Wine",      desc: "150ml glass" },
    { id: "b19", name: "Mixed Nuts",            price: 280, cat: "Snack" },
    { id: "b20", name: "Nachos & Salsa",        price: 380, cat: "Snack" },
    { id: "b21", name: "Cheese Platter",        price: 680, cat: "Snack",     desc: "3 cheeses, crackers, fruit" },
    { id: "b22", name: "Mini Sliders (4 pc)",   price: 480, cat: "Snack" },
  ],
  "Room Service": [
    { id: "rs1",  name: "Club Sandwich",        price: 420, cat: "Snack",    desc: "With waffle fries" },
    { id: "rs2",  name: "Butter Chicken",       price: 580, cat: "Main",     desc: "With rice & naan" },
    { id: "rs3",  name: "Veg Biryani",          price: 380, cat: "Main" },
    { id: "rs4",  name: "Pasta Arrabiata",      price: 420, cat: "Main" },
    { id: "rs5",  name: "Caesar Salad",         price: 360, cat: "Salad" },
    { id: "rs6",  name: "Continental Breakfast",price: 680, cat: "Breakfast", desc: "Eggs, toast, juice, coffee" },
    { id: "rs7",  name: "Indian Breakfast",     price: 580, cat: "Breakfast", desc: "Poha / Idli, chai, fruit" },
    { id: "rs8",  name: "Pancakes",             price: 380, cat: "Breakfast" },
    { id: "rs9",  name: "Chocolate Brownie",    price: 280, cat: "Dessert" },
    { id: "rs10", name: "Fresh Fruit Platter",  price: 380, cat: "Dessert" },
    { id: "rs11", name: "Fresh Lime Soda",      price: 160, cat: "Beverage" },
    { id: "rs12", name: "Masala Chai",          price: 120, cat: "Beverage" },
    { id: "rs13", name: "Cappuccino",           price: 220, cat: "Beverage",  desc: "Includes delivery surcharge" },
    { id: "rs14", name: "Bottled Water (1L)",   price: 80,  cat: "Beverage" },
    { id: "rs15", name: "Soft Drink",           price: 120, cat: "Beverage" },
    { id: "rs16", name: "Beer (Kingfisher)",    price: 480, cat: "Beverage" },
  ],
  Spa: [
    { id: "sp1",  name: "Swedish Massage 60 min",    price: 2800, cat: "Massage",   desc: "Full-body relaxation" },
    { id: "sp2",  name: "Swedish Massage 90 min",    price: 3800, cat: "Massage",   desc: "Extended session" },
    { id: "sp3",  name: "Deep Tissue 60 min",         price: 3200, cat: "Massage",   desc: "Targeted muscle relief" },
    { id: "sp4",  name: "Deep Tissue 90 min",         price: 4500, cat: "Massage",   desc: "Extended deep tissue" },
    { id: "sp5",  name: "Aromatherapy 60 min",        price: 3000, cat: "Massage",   desc: "Essential oils blend" },
    { id: "sp6",  name: "Hot Stone Massage",          price: 4200, cat: "Massage",   desc: "Volcanic stones therapy" },
    { id: "sp7",  name: "Classic Facial",             price: 1800, cat: "Facial",    desc: "Deep cleanse + mask" },
    { id: "sp8",  name: "Anti-Ageing Facial",         price: 2800, cat: "Facial",    desc: "Premium collagen treatment" },
    { id: "sp9",  name: "Manicure",                   price: 1200, cat: "Nails" },
    { id: "sp10", name: "Pedicure",                   price: 1400, cat: "Nails" },
    { id: "sp11", name: "Mani + Pedi Combo",          price: 2200, cat: "Nails" },
    { id: "sp12", name: "Couple Retreat (120 min)",   price: 9500, cat: "Package",   desc: "2 × Swedish + bubble bath" },
    { id: "sp13", name: "Full Body Package",          price: 7800, cat: "Package",   desc: "Massage + facial + mani" },
    { id: "sp14", name: "Relaxation Escape",          price: 5500, cat: "Package",   desc: "90-min massage + steam" },
  ],
};

const OUTLET_TABLES: Record<Outlet, string[]> = {
  Restaurant:     ["T-01","T-02","T-03","T-04","T-05","T-06","T-07","T-08","T-09","T-10","T-11","T-12"],
  Bar:            ["B-01","B-02","B-03","B-04","B-05","B-06"],
  "Room Service": [],
  Spa:            ["S-01","S-02","S-03","S-04"],
};

const OUTLET_ICON: Record<Outlet, React.ReactNode> = {
  Restaurant:     <UtensilsCrossed className="size-3.5" />,
  Bar:            <Wine className="size-3.5" />,
  "Room Service": <BedDouble className="size-3.5" />,
  Spa:            <Sparkles className="size-3.5" />,
};

const PAY_METHODS = [
  { id: "Cash",         label: "Cash",        icon: Banknote },
  { id: "Card",         label: "Card",        icon: CreditCard },
  { id: "UPI",          label: "UPI",         icon: Smartphone },
  { id: "Room Charge",  label: "Room Charge", icon: BedDouble },
] as const;

type CartItem = { id: string; name: string; qty: number; price: number; note?: string };
type PayMethod = typeof PAY_METHODS[number]["id"];

// ── KOT/Bill modal content ────────────────────────────────────────────────────

function KOTModal({ order, onClose }: { order: { outlet: string; table?: string; items: CartItem[] }; onClose: () => void }) {
  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Kitchen Order Ticket</DialogTitle>
      </DialogHeader>
      <div className="font-mono text-sm space-y-1 p-4 bg-muted rounded-lg">
        <div className="text-center font-bold text-base">{order.outlet.toUpperCase()}</div>
        <div className="text-center text-muted-foreground">{order.table ?? "—"}</div>
        <Separator className="my-2" />
        {order.items.map((i) => (
          <div key={i.id} className="flex justify-between">
            <span>{i.qty}× {i.name}</span>
            {i.note && <span className="text-muted-foreground text-xs">({i.note})</span>}
          </div>
        ))}
        <Separator className="my-2" />
        <div className="text-center text-xs text-muted-foreground">{new Date().toLocaleTimeString()}</div>
      </div>
      <Button onClick={onClose} className="w-full">Close</Button>
    </DialogContent>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const Route = createFileRoute("/pos")({
  head: () => ({ meta: [{ title: "POS & Restaurant · MHMS" }] }),
  component: POS,
});

function POS() {
  const { orders, addOrder, updateOrder, rooms } = useMHMS();

  // ── New order state ──
  const [outlet, setOutlet] = useState<Outlet>("Restaurant");
  const [catFilter, setCatFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [table, setTable] = useState("T-01");
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountPct, setDiscountPct] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [payMethod, setPayMethod] = useState<PayMethod>("Cash");
  const [orderNotes, setOrderNotes] = useState("");
  const [kotModal, setKotModal] = useState(false);
  const [historySearch, setHistorySearch] = useState("");

  // ── Derived values ──
  const menuItems = MENU[outlet];
  const categories = useMemo(
    () => ["All", ...Array.from(new Set(menuItems.map((m) => m.cat)))],
    [outlet]
  );
  const filteredMenu = useMemo(
    () =>
      menuItems.filter((m) => {
        const matchCat = catFilter === "All" || m.cat === catFilter;
        const matchSearch = m.name.toLowerCase().includes(search.toLowerCase());
        return matchCat && matchSearch;
      }),
    [menuItems, catFilter, search]
  );

  const subtotal = cart.reduce((s, i) => s + i.qty * i.price, 0);
  const discountAmt = Math.round(subtotal * discountPct / 100);
  const afterDiscount = subtotal - discountAmt;
  const tax = taxEnabled ? Math.round(afterDiscount * 0.18) : 0;
  const total = afterDiscount + tax;

  const openOrders = orders.filter((o) => o.status !== "Paid");
  const todayRevenue = orders.filter((o) => o.status === "Paid").reduce((s, o) => s + o.total, 0);
  const paidOrders = orders.filter((o) => o.status === "Paid");

  // ── Cart helpers ──
  const addToCart = (m: MenuItem) =>
    setCart((prev) => {
      const ex = prev.find((c) => c.id === m.id);
      return ex
        ? prev.map((c) => (c.id === m.id ? { ...c, qty: c.qty + 1 } : c))
        : [...prev, { id: m.id, name: m.name, qty: 1, price: m.price }];
    });

  const updateQty = (id: string, delta: number) =>
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((c) => c.id !== id));

  const cartCount = (id: string) => cart.find((c) => c.id === id)?.qty ?? 0;

  const resetOrder = () => {
    setCart([]);
    setDiscountPct(0);
    setOrderNotes("");
    setPayMethod("Cash");
  };

  const buildOrderPayload = (status: POSOrder["status"]) => ({
    outlet,
    table: outlet === "Room Service" ? undefined : table,
    roomId: outlet === "Room Service" ? roomId : undefined,
    items: cart,
    status,
    total,
  });

  const handleSendKOT = () => {
    if (!cart.length) return;
    addOrder(buildOrderPayload("Sent"));
    setKotModal(true);
    resetOrder();
  };

  const handlePay = () => {
    if (!cart.length) return;
    addOrder(buildOrderPayload("Paid"));
    toast.success(`Payment of ${fmtINR(total)} received via ${payMethod}`);
    resetOrder();
  };

  // ── Outlet switch — reset category filter ──
  const switchOutlet = (o: Outlet) => {
    setOutlet(o);
    setCatFilter("All");
    setSearch("");
    const tables = OUTLET_TABLES[o];
    if (tables.length) setTable(tables[0]);
  };

  return (
    <>
      <PageHeader
        title="POS & Restaurant"
        description="Orders for restaurant, bar, room service and spa"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="Today's Revenue" value={fmtINR(todayRevenue)} tone="success" hint="Paid orders" />
        <Stat label="Open Orders" value={openOrders.length} tone="info" hint="Pending / KOT sent" />
        <Stat label="Avg Ticket" value={fmtINR(Math.round(todayRevenue / Math.max(paidOrders.length, 1)))} hint="Per paid order" />
        <Stat label="Active Tables" value={new Set(openOrders.filter((o) => o.table).map((o) => o.table)).size} hint="Dine-in" />
      </div>

      <Tabs defaultValue="new">
        <TabsList className="mb-4">
          <TabsTrigger value="new">
            <ShoppingBag className="size-3.5 mr-1.5" /> New Order
          </TabsTrigger>
          <TabsTrigger value="live">
            <Clock className="size-3.5 mr-1.5" /> Live Orders
            {openOrders.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 size-5 p-0 grid place-items-center text-[10px]">
                {openOrders.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">
            <ReceiptText className="size-3.5 mr-1.5" /> History
          </TabsTrigger>
        </TabsList>

        {/* ── NEW ORDER ─────────────────────────────────────────────────── */}
        <TabsContent value="new">
          <div className="grid grid-cols-12 gap-4">
            {/* Left — menu panel */}
            <div className="col-span-12 lg:col-span-8 space-y-3">
              {/* Outlet selector */}
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(MENU) as Outlet[]).map((o) => (
                  <button
                    key={o}
                    onClick={() => switchOutlet(o)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                      outlet === o
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary/40 hover:bg-accent/5"
                    }`}
                  >
                    {OUTLET_ICON[o]} {o}
                  </button>
                ))}
              </div>

              {/* Search + category filters */}
              <div className="flex gap-2 items-center flex-wrap">
                <div className="relative">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8 h-8 w-48 text-sm"
                    placeholder="Search menu…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                      <X className="size-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCatFilter(cat)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition ${
                        catFilter === cat
                          ? "bg-secondary text-secondary-foreground border-secondary"
                          : "border-border hover:border-muted-foreground/40"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Menu grid */}
              <Card className="p-3">
                {filteredMenu.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">No items match your search</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                    {filteredMenu.map((m) => {
                      const qty = cartCount(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => addToCart(m)}
                          className={`relative border rounded-lg p-3 text-left transition group ${
                            qty > 0
                              ? "border-primary bg-primary/5"
                              : "hover:border-primary/50 hover:bg-accent/5"
                          }`}
                        >
                          {qty > 0 && (
                            <span className="absolute top-2 right-2 size-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">
                              {qty}
                            </span>
                          )}
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{m.cat}</div>
                          <div className="font-medium text-sm leading-tight">{m.name}</div>
                          {m.desc && <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight line-clamp-1">{m.desc}</div>}
                          <div className="text-sm font-semibold mt-1.5 text-primary">{fmtINR(m.price)}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* Right — order ticket */}
            <Card className="col-span-12 lg:col-span-4 p-4 flex flex-col gap-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                  {OUTLET_ICON[outlet]}
                  <span>{outlet}</span>
                </div>
                {cart.length > 0 && (
                  <button onClick={resetOrder} className="text-xs text-muted-foreground hover:text-destructive transition">
                    Clear all
                  </button>
                )}
              </div>

              {/* Table / Room selector */}
              <div>
                {outlet === "Room Service" ? (
                  <div className="space-y-1">
                    <Label className="text-xs">Room</Label>
                    <Select value={roomId} onValueChange={setRoomId}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select room" />
                      </SelectTrigger>
                      <SelectContent>
                        {rooms.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            Room {r.number} — {r.type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs">Table</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {OUTLET_TABLES[outlet].map((t) => (
                        <button
                          key={t}
                          onClick={() => setTable(t)}
                          className={`px-2 py-1 rounded text-xs font-mono border transition ${
                            table === t
                              ? "bg-primary text-primary-foreground border-primary"
                              : "hover:border-primary/50"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Cart items */}
              <div className="flex-1 min-h-[180px] max-h-[300px] overflow-y-auto space-y-2">
                {cart.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    Tap menu items to add
                  </div>
                ) : (
                  cart.map((c) => (
                    <div key={c.id} className="flex items-start justify-between text-sm gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{fmtINR(c.price)} each</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => updateQty(c.id, -1)}
                          className="size-6 rounded border flex items-center justify-center hover:bg-accent"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="w-5 text-center font-medium text-sm">{c.qty}</span>
                        <button
                          onClick={() => updateQty(c.id, +1)}
                          className="size-6 rounded border flex items-center justify-center hover:bg-accent"
                        >
                          <Plus className="size-3" />
                        </button>
                        <button
                          onClick={() => removeFromCart(c.id)}
                          className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <>
                  <Separator />

                  {/* Notes */}
                  <div className="space-y-1">
                    <Label className="text-xs">Order notes</Label>
                    <Input
                      className="h-7 text-xs"
                      placeholder="Allergies, special requests…"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                    />
                  </div>

                  {/* Discount */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs shrink-0">Discount %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="h-7 text-xs w-20"
                      value={discountPct || ""}
                      placeholder="0"
                      onChange={(e) => setDiscountPct(Math.min(100, Math.max(0, Number(e.target.value))))}
                    />
                    <button
                      onClick={() => setTaxEnabled((v) => !v)}
                      className={`ml-auto text-xs px-2 py-1 rounded border transition ${taxEnabled ? "bg-primary/10 border-primary/40 text-primary" : "text-muted-foreground"}`}
                    >
                      GST 18%
                    </button>
                  </div>

                  {/* Totals */}
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span><span>{fmtINR(subtotal)}</span>
                    </div>
                    {discountAmt > 0 && (
                      <div className="flex justify-between text-success">
                        <span>Discount ({discountPct}%)</span><span>−{fmtINR(discountAmt)}</span>
                      </div>
                    )}
                    {taxEnabled && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>CGST 9% + SGST 9%</span><span>{fmtINR(tax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-base pt-1 border-t">
                      <span>Total</span><span>{fmtINR(total)}</span>
                    </div>
                  </div>

                  {/* Payment method */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {PAY_METHODS.map((pm) => {
                      const Icon = pm.icon;
                      return (
                        <button
                          key={pm.id}
                          onClick={() => setPayMethod(pm.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition ${
                            payMethod === pm.id
                              ? "bg-primary text-primary-foreground border-primary"
                              : "hover:border-primary/40"
                          }`}
                        >
                          <Icon className="size-3.5" /> {pm.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={handleSendKOT} className="gap-1.5">
                      <ChefHat className="size-4" /> Send KOT
                    </Button>
                    <Button onClick={handlePay} className="gap-1.5">
                      <CreditCard className="size-4" /> Pay {fmtINR(total)}
                    </Button>
                  </div>
                </>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* ── LIVE ORDERS ───────────────────────────────────────────────── */}
        <TabsContent value="live">
          {openOrders.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              <CheckCircle2 className="size-10 mx-auto mb-3 opacity-30" />
              <p>No open orders — all clear!</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-1">
              {openOrders.map((o) => (
                <LiveOrderCard key={o.id} order={o} onUpdate={updateOrder} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── ORDER HISTORY ─────────────────────────────────────────────── */}
        <TabsContent value="history">
          <div className="space-y-3 mt-1">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8 h-8 w-56 text-sm"
                  placeholder="Search order history…"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
              </div>
              <Badge variant="outline" className="text-xs">
                {paidOrders.length} orders · {fmtINR(todayRevenue)} total
              </Badge>
            </div>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Order</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Outlet</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Table / Room</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Items</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Total</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paidOrders
                      .filter((o) =>
                        historySearch
                          ? o.outlet.toLowerCase().includes(historySearch.toLowerCase()) ||
                            (o.table ?? "").toLowerCase().includes(historySearch.toLowerCase()) ||
                            o.items.some((i) => i.name.toLowerCase().includes(historySearch.toLowerCase()))
                          : true
                      )
                      .map((o, idx) => (
                        <tr key={o.id} className="border-b last:border-0 hover:bg-accent/5">
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            #{String(idx + 1).padStart(4, "0")}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {OUTLET_ICON[o.outlet as Outlet]}
                              {o.outlet}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{o.table ?? `Room`}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs max-w-[180px] truncate">
                            {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">{fmtINR(o.total)}</td>
                          <td className="px-4 py-3">
                            <Badge variant="default" className="text-[10px]">Paid</Badge>
                          </td>
                        </tr>
                      ))}
                    {paidOrders.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                          No paid orders yet today
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* KOT Modal */}
      <Dialog open={kotModal} onOpenChange={setKotModal}>
        <KOTModal
          order={{ outlet, table: outlet !== "Room Service" ? table : undefined, items: [] }}
          onClose={() => setKotModal(false)}
        />
      </Dialog>
    </>
  );
}

// ── Live Order Card ───────────────────────────────────────────────────────────

function LiveOrderCard({
  order,
  onUpdate,
}: {
  order: POSOrder;
  onUpdate: (id: string, patch: Partial<POSOrder>) => void;
}) {
  const statusColor: Record<string, string> = {
    Open: "bg-warning/15 text-warning-foreground border-warning/30",
    Sent: "bg-info/15 text-info border-info/30",
    Paid: "bg-success/15 text-success border-success/30",
  };

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 font-semibold text-sm">
            {OUTLET_ICON[order.outlet as Outlet]}
            {order.outlet}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 font-mono">
            {order.table ?? `Room Svc`}
          </div>
        </div>
        <Badge className={`text-[10px] border ${statusColor[order.status] ?? ""}`}>
          {order.status === "Sent" ? "In Kitchen" : order.status}
        </Badge>
      </div>

      <div className="space-y-1">
        {order.items.map((i) => (
          <div key={i.name} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{i.qty}× {i.name}</span>
            <span>{fmtINR(i.qty * i.price)}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-between font-semibold border-t pt-2 text-sm">
        <span>Total</span>
        <span>{fmtINR(order.total)}</span>
      </div>

      <div className="flex gap-2">
        {order.status === "Open" && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1"
            onClick={() => { onUpdate(order.id, { status: "Sent" }); toast.success("KOT sent to kitchen"); }}
          >
            <ChefHat className="size-3.5" /> Send KOT
          </Button>
        )}
        {order.status !== "Paid" && (
          <Button
            size="sm"
            className="flex-1 gap-1"
            onClick={() => { onUpdate(order.id, { status: "Paid" }); toast.success("Order marked paid"); }}
          >
            <CreditCard className="size-3.5" /> Mark Paid
          </Button>
        )}
      </div>
    </Card>
  );
}
