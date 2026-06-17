import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Truck, Building2, CheckCircle2, Clock, XCircle, Download, Eye } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SUPPLIERS = [
  { id: "s1", name: "Cotton Co.", contact: "Raj Sharma", email: "raj@cottonco.in", phone: "+91 98765 43210", category: "Linen", terms: "Net 30", rating: 4.8, orders: 24 },
  { id: "s2", name: "Hospitality Supplies", contact: "Meera Patel", email: "meera@hospsupp.com", phone: "+91 99887 76543", category: "Amenities", terms: "Net 15", rating: 4.5, orders: 38 },
  { id: "s3", name: "Aqua Pure", contact: "Dev Singh", email: "dev@aquapure.com", phone: "+91 91234 56789", category: "F&B", terms: "Net 7", rating: 4.2, orders: 52 },
  { id: "s4", name: "Bean Bros", contact: "Priya K.", email: "priya@beanbros.in", phone: "+91 98001 12345", category: "F&B", terms: "Net 15", rating: 4.9, orders: 18 },
  { id: "s5", name: "CleanMax", contact: "Suresh R.", email: "suresh@cleanmax.co", phone: "+91 97700 88990", category: "Cleaning", terms: "Net 30", rating: 4.3, orders: 12 },
];

const STATUS_META: Record<string, { color: string; icon: React.ElementType }> = {
  Draft:     { color: "bg-muted text-muted-foreground",                icon: Clock },
  Sent:      { color: "bg-info/15 text-info border-info/30",           icon: Truck },
  Received:  { color: "bg-success/15 text-success border-success/30",  icon: CheckCircle2 },
  Cancelled: { color: "bg-destructive/15 text-destructive",            icon: XCircle },
};

export const Route = createFileRoute("/procurement")({
  head: () => ({ meta: [{ title: "Procurement · MHMS" }] }),
  component: Procurement,
});

function Procurement() {
  const { purchaseOrders, addPO, updatePO, receivePO, inventory } = useMHMS();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [newOpen, setNewOpen] = useState(false);
  const [detailPO, setDetailPO] = useState<typeof purchaseOrders[number] | null>(null);
  const [newSupplier, setNewSupplier] = useState("");
  const [newItem, setNewItem] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newUnitPrice, setNewUnitPrice] = useState("");

  const filtered = purchaseOrders.filter((po) => {
    const matchSearch = po.supplier.toLowerCase().includes(search.toLowerCase()) || po.poNumber.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || po.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalValue = purchaseOrders.reduce((s, p) => s + p.total, 0);
  const openPOs = purchaseOrders.filter((p) => p.status === "Sent").length;

  const handleCreate = () => {
    if (!newSupplier || !newItem || !newQty || !newUnitPrice) return;
    const qty = Number(newQty);
    const price = Number(newUnitPrice);
    addPO({ supplier: newSupplier, poNumber: `PO-2026-${String(Date.now()).slice(-4)}`, items: [{ name: newItem, qty, unitPrice: price }], status: "Draft", total: qty * price });
    toast.success("Purchase order created");
    setNewOpen(false);
    setNewSupplier(""); setNewItem(""); setNewQty(""); setNewUnitPrice("");
  };

  return (
    <>
      <PageHeader
        title="Procurement"
        description="Manage purchase orders, suppliers, and deliveries"
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.success("Export ready")}>
              <Download className="size-4" /> Export
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setNewOpen(true)}>
              <Plus className="size-4" /> New PO
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="Total POs" value={purchaseOrders.length} hint="All time" />
        <Stat label="Open Orders" value={openPOs} tone={openPOs > 0 ? "info" : "success"} hint="Awaiting delivery" />
        <Stat label="Value MTD" value={fmtINR(totalValue)} tone="success" hint="All POs combined" />
        <Stat label="Suppliers" value={SUPPLIERS.length} hint="Active vendor list" />
      </div>

      <Tabs defaultValue="orders">
        <TabsList className="mb-4">
          <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
          <TabsTrigger value="suppliers"><Building2 className="size-3.5 mr-1.5" />Suppliers</TabsTrigger>
          <TabsTrigger value="delivery"><Truck className="size-3.5 mr-1.5" />Delivery Tracker</TabsTrigger>
        </TabsList>

        {/* Purchase Orders */}
        <TabsContent value="orders">
          <div className="flex gap-2 mb-3 flex-wrap">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8 h-8 w-52 text-sm" placeholder="Search PO or supplier…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {["All", "Draft", "Sent", "Received", "Cancelled"].map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${statusFilter === s ? "bg-secondary text-secondary-foreground border-secondary" : "hover:border-muted-foreground/40"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["PO Number", "Supplier", "Items", "Total", "Date", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((po) => {
                    const meta = STATUS_META[po.status] ?? STATUS_META.Draft;
                    const Icon = meta.icon;
                    return (
                      <tr key={po.id} className="border-b last:border-0 hover:bg-accent/5">
                        <td className="px-4 py-3 font-mono text-xs font-medium">{po.poNumber}</td>
                        <td className="px-4 py-3">{po.supplier}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[180px] truncate">
                          {po.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                        </td>
                        <td className="px-4 py-3 font-medium">{fmtINR(po.total)}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{po.createdAt}</td>
                        <td className="px-4 py-3">
                          <Badge className={`text-[10px] border gap-1 ${meta.color}`}>
                            <Icon className="size-2.5" />{po.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={() => setDetailPO(po)}>
                              <Eye className="size-3.5" /> View
                            </Button>
                            {po.status === "Draft" && (
                              <Button size="sm" variant="outline" className="h-7 px-2"
                                onClick={() => { updatePO(po.id, { status: "Sent" }); toast.success("PO sent to supplier"); }}>
                                Send
                              </Button>
                            )}
                            {po.status === "Sent" && (
                              <Button size="sm" className="h-7 px-2"
                                onClick={() => { receivePO(po.id); toast.success("PO received — stock updated"); }}>
                                Receive
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">No purchase orders found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Suppliers */}
        <TabsContent value="suppliers">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {SUPPLIERS.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.category}</div>
                  </div>
                  <div className="text-xs font-medium">★ {s.rating}</div>
                </div>
                <div className="space-y-1.5 text-sm mb-3">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Contact</span><span>{s.contact}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Email</span><span className="truncate max-w-[140px]">{s.email}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Terms</span><Badge variant="outline" className="text-[10px]">{s.terms}</Badge></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Total Orders</span><span className="font-medium">{s.orders}</span></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 h-7" onClick={() => toast.info(`Email: ${s.email}`)}>Contact</Button>
                  <Button size="sm" className="flex-1 h-7" onClick={() => { setNewSupplier(s.name); setNewOpen(true); }}>New PO</Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Delivery Tracker */}
        <TabsContent value="delivery">
          <div className="space-y-3">
            {purchaseOrders.filter((p) => p.status === "Sent").length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">No pending deliveries.</Card>
            ) : (
              purchaseOrders.filter((p) => p.status === "Sent").map((po) => (
                <Card key={po.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-medium font-mono text-sm">{po.poNumber}</div>
                      <div className="text-xs text-muted-foreground">{po.supplier} · Ordered {po.createdAt}</div>
                    </div>
                    <Badge className="bg-info/15 text-info border border-info/30 text-[10px] gap-1">
                      <Truck className="size-2.5" /> In Transit
                    </Badge>
                  </div>
                  <div className="space-y-1 mb-3">
                    {po.items.map((i) => (
                      <div key={i.name} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{i.qty}× {i.name}</span>
                        <span>{fmtINR(i.qty * i.unitPrice)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.info("Tracking update requested")}>Request Update</Button>
                    <Button size="sm" className="flex-1" onClick={() => { receivePO(po.id); toast.success("Delivery confirmed — stock updated"); }}>
                      <CheckCircle2 className="size-3.5 mr-1" /> Confirm Received
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* PO Detail Dialog */}
      {detailPO && (
        <Dialog open={!!detailPO} onOpenChange={() => setDetailPO(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{detailPO.poNumber}</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-xs text-muted-foreground">Supplier</span><div className="font-medium">{detailPO.supplier}</div></div>
                <div><span className="text-xs text-muted-foreground">Status</span><div>{detailPO.status}</div></div>
                <div><span className="text-xs text-muted-foreground">Date</span><div>{detailPO.createdAt}</div></div>
                <div><span className="text-xs text-muted-foreground">Total</span><div className="font-semibold">{fmtINR(detailPO.total)}</div></div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50"><tr>
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground">Item</th>
                    <th className="text-right px-3 py-2 text-xs text-muted-foreground">Qty</th>
                    <th className="text-right px-3 py-2 text-xs text-muted-foreground">Unit Price</th>
                    <th className="text-right px-3 py-2 text-xs text-muted-foreground">Total</th>
                  </tr></thead>
                  <tbody>
                    {detailPO.items.map((i) => (
                      <tr key={i.name} className="border-t">
                        <td className="px-3 py-2">{i.name}</td>
                        <td className="px-3 py-2 text-right">{i.qty}</td>
                        <td className="px-3 py-2 text-right">{fmtINR(i.unitPrice)}</td>
                        <td className="px-3 py-2 text-right font-medium">{fmtINR(i.qty * i.unitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button className="w-full" onClick={() => { toast.success("PDF downloaded"); setDetailPO(null); }}>Download PDF</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* New PO Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Supplier</Label>
              <Select value={newSupplier} onValueChange={setNewSupplier}>
                <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {SUPPLIERS.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Item</Label>
              <Select value={newItem} onValueChange={setNewItem}>
                <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>
                  {inventory.map((i) => <SelectItem key={i.id} value={i.name}>{i.name} ({i.sku})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Quantity</Label>
                <Input className="h-8 mt-1" type="number" min={1} placeholder="100" value={newQty} onChange={(e) => setNewQty(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Unit Price (₹)</Label>
                <Input className="h-8 mt-1" type="number" min={0} placeholder="350" value={newUnitPrice} onChange={(e) => setNewUnitPrice(e.target.value)} />
              </div>
            </div>
            {newQty && newUnitPrice && (
              <div className="text-sm font-medium text-right">Total: {fmtINR(Number(newQty) * Number(newUnitPrice))}</div>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button className="flex-1" disabled={!newSupplier || !newItem || !newQty || !newUnitPrice} onClick={handleCreate}>Create PO</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
