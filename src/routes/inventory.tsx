import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { Plus, ArrowUp, ArrowDown, Search, Package, AlertTriangle, BarChart3, RefreshCw, Download, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/api/auth";
import { useInventoryItems } from "@/lib/api/hooks";

type Movement = { id: string; sku: string; name: string; type: "In" | "Out" | "Adjustment"; qty: number; reason: string; by: string; date: string };

const INITIAL_MOVEMENTS: Movement[] = [
  { id: "m1", sku: "LIN-001", name: "Bath towel", type: "In", qty: 50, reason: "PO received", by: "Store Manager", date: "2026-06-15" },
  { id: "m2", sku: "AMN-001", name: "Shampoo 30ml", type: "Out", qty: 120, reason: "Housekeeping issue", by: "HK Supervisor", date: "2026-06-15" },
  { id: "m3", sku: "FNB-001", name: "Water 1L", type: "Out", qty: 60, reason: "Room service", by: "F&B Staff", date: "2026-06-16" },
  { id: "m4", sku: "LIN-002", name: "Bed sheet (Queen)", type: "Adjustment", qty: -5, reason: "Damaged — write-off", by: "Store Manager", date: "2026-06-16" },
  { id: "m5", sku: "CLN-001", name: "Floor cleaner 5L", type: "In", qty: 10, reason: "PO received", by: "Store Manager", date: "2026-06-17" },
  { id: "m6", sku: "FNB-002", name: "Coffee sachet", type: "Out", qty: 40, reason: "Room consumption", by: "HK Supervisor", date: "2026-06-17" },
];

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory · MHMS" }] }),
  component: Inventory,
});

function Inventory() {
  const authed = !!useAuth((s) => s.user);
  const { inventory: demoInventory, updateInventory } = useMHMS();
  const inventoryQ = useInventoryItems();

  const isLive = authed && !!inventoryQ.data && inventoryQ.data.length > 0;

  const inventory = useMemo(() => {
    if (isLive && inventoryQ.data) {
      return inventoryQ.data.map((i: any) => ({
        id: i.id,
        name: i.name,
        sku: i.sku ?? i.id,
        category: i.category ?? "General",
        stock: i.quantity ?? i.stock ?? 0,
        reorderLevel: i.reorder_level ?? i.reorderLevel ?? 10,
        unitCost: i.unit_cost ?? i.unitCost ?? 0,
        unit: i.unit ?? "pcs",
        supplier: i.supplier ?? "—",
        _live: true,
      }));
    }
    return demoInventory;
  }, [isLive, inventoryQ.data, demoInventory]);

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [movements, setMovements] = useState<Movement[]>(INITIAL_MOVEMENTS);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<typeof inventory[number] | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustType, setAdjustType] = useState<"In" | "Out" | "Adjustment">("In");
  const [newOpen, setNewOpen] = useState(false);

  const categories = useMemo(() => ["All", ...Array.from(new Set(inventory.map((i) => i.category)))], [inventory]);

  const filtered = useMemo(() =>
    inventory.filter((i) => {
      const matchCat = catFilter === "All" || i.category === catFilter;
      const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    }), [inventory, catFilter, search]);

  const lowStock = inventory.filter((i) => i.stock <= i.reorderLevel);
  const totalValue = inventory.reduce((s, i) => s + i.stock * i.unitCost, 0);
  const totalItems = inventory.reduce((s, i) => s + i.stock, 0);

  const chartData = [...inventory]
    .sort((a, b) => a.stock / a.reorderLevel - b.stock / b.reorderLevel)
    .slice(0, 8)
    .map((i) => ({ name: i.name.split(" ").slice(0, 2).join(" "), stock: i.stock, reorder: i.reorderLevel }));

  const stockPct = (i: typeof inventory[number]) => Math.min(100, Math.round((i.stock / Math.max(1, i.reorderLevel * 3)) * 100));

  const handleAdjust = () => {
    if (!adjustItem || !adjustQty) return;
    const qty = Number(adjustQty);
    const delta = adjustType === "Out" ? -qty : qty;
    if (!(adjustItem as any)._live) {
      updateInventory(adjustItem.id, { stock: Math.max(0, adjustItem.stock + delta) });
    } else {
      toast.info("Live inventory adjustment requires backend stock movement API");
    }
    const m: Movement = {
      id: `m${Date.now()}`,
      sku: adjustItem.sku,
      name: adjustItem.name,
      type: adjustType,
      qty: delta,
      reason: adjustReason || "Manual adjustment",
      by: "Current User",
      date: new Date().toISOString().slice(0, 10),
    };
    setMovements([m, ...movements]);
    toast.success(`Stock ${adjustType === "In" ? "added" : adjustType === "Out" ? "removed" : "adjusted"}: ${adjustItem.name}`);
    setAdjustOpen(false);
    setAdjustQty("");
    setAdjustReason("");
  };

  return (
    <>
      <PageHeader
        title="Inventory Management"
        description="Track stock, manage reorders, and view movements"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => toast.success("Report exported")} className="gap-1.5">
              <Download className="size-4" /> Export
            </Button>
            <Button size="sm" onClick={() => setNewOpen(true)} className="gap-1.5">
              <Plus className="size-4" /> Add Item
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="Total SKUs" value={inventory.length} hint={`${categories.length - 1} categories`} tone="info" />
        <Stat label="Low Stock Alerts" value={lowStock.length} tone={lowStock.length > 0 ? "warning" : "success"} hint="At or below reorder level" />
        <Stat label="Total Units" value={totalItems.toLocaleString()} hint="Across all items" />
        <Stat label="Inventory Value" value={fmtINR(totalValue)} tone="success" hint="At cost price" />
      </div>

      <Tabs defaultValue="items">
        <TabsList className="mb-4">
          <TabsTrigger value="items"><Package className="size-3.5 mr-1.5" />Stock Items</TabsTrigger>
          <TabsTrigger value="reorder">
            <AlertTriangle className="size-3.5 mr-1.5" />Reorder Queue
            {lowStock.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-[10px] size-4 p-0 grid place-items-center">{lowStock.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="chart"><BarChart3 className="size-3.5 mr-1.5" />Stock Levels</TabsTrigger>
          <TabsTrigger value="movements"><RefreshCw className="size-3.5 mr-1.5" />Movements</TabsTrigger>
        </TabsList>

        {/* Stock Items */}
        <TabsContent value="items">
          <div className="flex gap-2 mb-3 flex-wrap">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8 h-8 w-52 text-sm" placeholder="Search SKU or name…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {categories.map((c) => (
                <button key={c} onClick={() => setCatFilter(c)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${catFilter === c ? "bg-secondary text-secondary-foreground border-secondary" : "hover:border-muted-foreground/40"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["SKU", "Name", "Category", "Stock Level", "Reorder", "Unit Cost", "Value", "Status", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const pct = stockPct(item);
                    const low = item.stock <= item.reorderLevel;
                    return (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-accent/5">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.sku}</td>
                        <td className="px-4 py-3 font-medium">{item.name}</td>
                        <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{item.category}</Badge></td>
                        <td className="px-4 py-3 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className={`h-1.5 flex-1 ${low ? "[&>div]:bg-destructive" : ""}`} />
                            <span className="text-xs w-8 text-right">{item.stock}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{item.reorderLevel}</td>
                        <td className="px-4 py-3">{fmtINR(item.unitCost)}</td>
                        <td className="px-4 py-3 font-medium">{fmtINR(item.stock * item.unitCost)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={low ? "destructive" : "default"} className="text-[10px]">
                            {low ? "Low Stock" : "OK"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="size-7" title="Stock In"
                              onClick={() => { setAdjustItem(item); setAdjustType("In"); setAdjustOpen(true); }}>
                              <ArrowUp className="size-3.5 text-success" />
                            </Button>
                            <Button size="icon" variant="ghost" className="size-7" title="Stock Out"
                              onClick={() => { setAdjustItem(item); setAdjustType("Out"); setAdjustOpen(true); }}>
                              <ArrowDown className="size-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Reorder Queue */}
        <TabsContent value="reorder">
          {lowStock.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">All items are adequately stocked.</Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {lowStock.map((item) => (
                <Card key={item.id} className="p-4 border-destructive/30">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{item.sku} · {item.category}</div>
                    </div>
                    <Badge variant="destructive" className="text-[10px]">Reorder</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="bg-destructive/5 rounded p-2">
                      <div className="text-xs text-muted-foreground">Current</div>
                      <div className="font-bold text-destructive">{item.stock}</div>
                    </div>
                    <div className="bg-muted rounded p-2">
                      <div className="text-xs text-muted-foreground">Reorder at</div>
                      <div className="font-bold">{item.reorderLevel}</div>
                    </div>
                    <div className="bg-muted rounded p-2">
                      <div className="text-xs text-muted-foreground">Unit Cost</div>
                      <div className="font-bold">{fmtINR(item.unitCost)}</div>
                    </div>
                  </div>
                  <Button size="sm" className="w-full" onClick={() => toast.success(`PO draft created for ${item.name}`)}>
                    Create Purchase Order
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Chart */}
        <TabsContent value="chart">
          <Card className="p-5">
            <h3 className="font-semibold mb-1">Stock vs Reorder Level — Top Items</h3>
            <p className="text-xs text-muted-foreground mb-4">Sorted by criticality (lowest stock ratio first). Red = below reorder level.</p>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                  <XAxis type="number" fontSize={11} />
                  <YAxis dataKey="name" type="category" fontSize={11} width={110} />
                  <Tooltip />
                  <Bar dataKey="stock" name="Current Stock" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.stock <= entry.reorder ? "hsl(var(--destructive))" : "hsl(var(--chart-1))"} />
                    ))}
                  </Bar>
                  <Bar dataKey="reorder" name="Reorder Level" fill="hsl(var(--chart-4))" opacity={0.5} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        {/* Movements */}
        <TabsContent value="movements">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Date", "SKU", "Item", "Type", "Qty", "Reason", "By"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-accent/5">
                      <td className="px-4 py-3 text-muted-foreground text-xs">{m.date}</td>
                      <td className="px-4 py-3 font-mono text-xs">{m.sku}</td>
                      <td className="px-4 py-3">{m.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant={m.type === "In" ? "default" : m.type === "Out" ? "destructive" : "secondary"} className="text-[10px]">{m.type}</Badge>
                      </td>
                      <td className={`px-4 py-3 font-medium ${m.qty > 0 ? "text-success" : "text-destructive"}`}>
                        {m.qty > 0 ? "+" : ""}{m.qty}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{m.reason}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{m.by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Adjust Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Stock {adjustType} — {adjustItem?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={adjustType} onValueChange={(v) => setAdjustType(v as typeof adjustType)}>
                <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="In">Stock In (Purchase / Return)</SelectItem>
                  <SelectItem value="Out">Stock Out (Usage / Issue)</SelectItem>
                  <SelectItem value="Adjustment">Adjustment (Damage / Write-off)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Quantity</Label>
              <Input className="h-8 mt-1" type="number" min={1} placeholder="e.g. 50" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Reason</Label>
              <Input className="h-8 mt-1" placeholder="e.g. PO-2026-0044 received" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setAdjustOpen(false)}>Cancel</Button>
              <Button className="flex-1" disabled={!adjustQty} onClick={handleAdjust}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Item Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Inventory Item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {[["SKU", "e.g. AMN-003"], ["Name", "e.g. Conditioner 30ml"], ["Category", "e.g. Amenities"], ["Initial Stock", "e.g. 500"], ["Reorder Level", "e.g. 200"], ["Unit Cost (₹)", "e.g. 15"]].map(([label, placeholder]) => (
              <div key={label}>
                <Label className="text-xs">{label}</Label>
                <Input className="h-8 mt-1" placeholder={placeholder} />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => { toast.success("Item added"); setNewOpen(false); }}>Add Item</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
