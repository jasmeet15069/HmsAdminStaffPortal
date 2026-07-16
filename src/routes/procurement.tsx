import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { useAuth } from "@/lib/api/auth";
import { useVendors, usePurchaseOrders, useCreatePurchaseOrder, useUpdatePOStatus, useCreateVendor } from "@/lib/api/hooks";
import { downloadCSV } from "@/lib/csv";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Truck, Building2, CheckCircle2, Clock, XCircle, Download, Eye, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { PurchaseOrder, Vendor } from "@/lib/api/types";

const STATUS_META: Record<string, { color: string; icon: React.ElementType }> = {
  Draft:     { color: "bg-muted text-muted-foreground",                icon: Clock },
  draft:     { color: "bg-muted text-muted-foreground",                icon: Clock },
  Sent:      { color: "bg-info/15 text-info border-info/30",           icon: Truck },
  sent:      { color: "bg-info/15 text-info border-info/30",           icon: Truck },
  Received:  { color: "bg-success/15 text-success border-success/30",  icon: CheckCircle2 },
  received:  { color: "bg-success/15 text-success border-success/30",  icon: CheckCircle2 },
  Cancelled: { color: "bg-destructive/15 text-destructive",            icon: XCircle },
  cancelled: { color: "bg-destructive/15 text-destructive",            icon: XCircle },
};

export const Route = createFileRoute("/procurement")({
  head: () => ({ meta: [{ title: "Procurement · MHMS" }] }),
  component: Procurement,
});

function Procurement() {
  const authed = !!useAuth((s) => s.user);
  const vendorsQ = useVendors();
  const posQ = usePurchaseOrders();
  const createPOM = useCreatePurchaseOrder();
  const updateStatusM = useUpdatePOStatus();
  const createVendorM = useCreateVendor();
  const isLive = authed && !!vendorsQ.data;

  const { purchaseOrders: demoPOs, addPO, updatePO, receivePO, inventory } = useMHMS();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [newOpen, setNewOpen] = useState(false);
  const [newVendorOpen, setNewVendorOpen] = useState(false);
  const [detailPO, setDetailPO] = useState<PurchaseOrder | any | null>(null);
  const [newSupplier, setNewSupplier] = useState("");
  const [newItem, setNewItem] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newUnitPrice, setNewUnitPrice] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [nv, setNv] = useState({ name: "", contact_person: "", email: "", phone: "", category: "", address: "" });

  // Normalize POs for display
  const allPOs: any[] = useMemo(() => {
    if (isLive && posQ.data) {
      return posQ.data.map((p) => ({
        id: p.id,
        poNumber: p.po_number,
        supplier: p.vendor_name ?? p.vendor_id ?? "—",
        vendorId: p.vendor_id,
        items: Array.isArray(p.items) ? p.items : [],
        total: p.total,
        createdAt: p.created_at?.slice(0, 10) ?? "—",
        status: p.status,
        notes: p.notes,
        _live: true,
      }));
    }
    return demoPOs.map((p) => ({
      ...p,
      poNumber: p.poNumber,
      supplier: p.supplier,
      items: p.items,
      _live: false,
    }));
  }, [isLive, posQ.data, demoPOs]);

  // Normalize vendors for display
  const allVendors: Vendor[] | any[] = useMemo(() => {
    if (isLive && vendorsQ.data) return vendorsQ.data;
    return [
      { id: "s1", name: "Cotton Co.", contact_person: "Raj Sharma", email: "raj@cottonco.in", phone: "+91 98765 43210", category: "Linen", rating: 4.8 },
      { id: "s2", name: "Hospitality Supplies", contact_person: "Meera Patel", email: "meera@hospsupp.com", phone: "+91 99887 76543", category: "Amenities", rating: 4.5 },
      { id: "s3", name: "Aqua Pure", contact_person: "Dev Singh", email: "dev@aquapure.com", phone: "+91 91234 56789", category: "F&B", rating: 4.2 },
      { id: "s4", name: "Bean Bros", contact_person: "Priya K.", email: "priya@beanbros.in", phone: "+91 98001 12345", category: "F&B", rating: 4.9 },
      { id: "s5", name: "CleanMax", contact_person: "Suresh R.", email: "suresh@cleanmax.co", phone: "+91 97700 88990", category: "Cleaning", rating: 4.3 },
    ];
  }, [isLive, vendorsQ.data]);

  const filtered = allPOs.filter((po) => {
    const matchSearch = (po.supplier ?? "").toLowerCase().includes(search.toLowerCase()) || (po.poNumber ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || po.status?.toLowerCase() === statusFilter.toLowerCase() || po.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalValue = allPOs.reduce((s, p) => s + (p.total ?? 0), 0);
  const openPOs = allPOs.filter((p) => p.status === "Sent" || p.status === "sent").length;

  const handleCreatePO = () => {
    const qty = Number(newQty);
    const price = Number(newUnitPrice);
    if (!newSupplier || !newItem || qty <= 0 || price <= 0) return;
    const items = [{ name: newItem, qty, unit_price: price }];
    const total = qty * price;
    if (isLive) {
      const vendor = allVendors.find((v) => v.name === newSupplier);
      createPOM.mutate(
        { vendor_id: vendor?.id ?? undefined, items, total, notes: newNotes || undefined },
        {
          onSuccess: () => { toast.success("Purchase order created"); setNewOpen(false); resetForm(); },
          onError: (e: any) => toast.error(e.message ?? "Failed to create PO"),
        }
      );
    } else {
      addPO({ supplier: newSupplier, poNumber: `PO-2026-${String(Date.now()).slice(-4)}`, items: [{ name: newItem, qty, unitPrice: price }], status: "Draft", total });
      toast.success("Purchase order created");
      setNewOpen(false); resetForm();
    }
  };

  const resetForm = () => { setNewSupplier(""); setNewItem(""); setNewQty(""); setNewUnitPrice(""); setNewNotes(""); };

  const handleSend = (po: any) => {
    if (po._live) updateStatusM.mutate({ id: po.id, status: "sent" }, { onSuccess: () => toast.success("PO sent to supplier"), onError: (e: any) => toast.error(e.message ?? "Update failed") });
    else { updatePO(po.id, { status: "Sent" }); toast.success("PO sent to supplier"); }
  };

  const handleReceive = (po: any) => {
    if (po._live) updateStatusM.mutate({ id: po.id, status: "received" }, { onSuccess: () => toast.success("Delivery confirmed"), onError: (e: any) => toast.error(e.message ?? "Update failed") });
    else { receivePO(po.id); toast.success("Delivery confirmed — stock updated"); }
  };

  return (
    <>
      <PageHeader
        title="Procurement"
        description={`${isLive ? "Live" : "Demo"} — manage purchase orders, suppliers, and deliveries`}
        actions={
          <>
            <Badge variant={isLive ? "default" : "outline"} className="self-center">{isLive ? "Live" : "Demo"}</Badge>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
              downloadCSV("purchase-orders.csv", filtered.map((po: any) => ({
                po: po.po_number ?? po.id, vendor: po.vendor ?? po.vendor_name ?? "", status: po.status,
                total: po.total ?? po.total_amount ?? 0, date: po.created_at ?? po.date ?? "",
              })));
              toast.success(`Exported ${filtered.length} POs`);
            }}>
              <Download className="size-4" /> Export
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setNewOpen(true)}>
              <Plus className="size-4" /> New PO
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="Total POs" value={allPOs.length} hint="All time" />
        <Stat label="Open Orders" value={openPOs} tone={openPOs > 0 ? "info" : "success"} hint="Awaiting delivery" />
        <Stat label="Value MTD" value={fmtINR(totalValue)} tone="success" hint="All POs combined" />
        <Stat label="Suppliers" value={allVendors.length} hint="Active vendor list" />
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
            {(isLive && posQ.isLoading) && <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>}
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
                    const itemsDisplay = Array.isArray(po.items)
                      ? po.items.map((i: any) => `${i.qty}× ${i.name ?? i.item_name ?? "—"}`).join(", ")
                      : "—";
                    return (
                      <tr key={po.id} className="border-b last:border-0 hover:bg-accent/5">
                        <td className="px-4 py-3 font-mono text-xs font-medium">{po.poNumber}</td>
                        <td className="px-4 py-3">{po.supplier}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[180px] truncate">{itemsDisplay}</td>
                        <td className="px-4 py-3 font-medium">{fmtINR(po.total ?? 0)}</td>
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
                            {(po.status === "Draft" || po.status === "draft") && (
                              <Button size="sm" variant="outline" className="h-7 px-2" disabled={updateStatusM.isPending}
                                onClick={() => handleSend(po)}>Send</Button>
                            )}
                            {(po.status === "Sent" || po.status === "sent") && (
                              <Button size="sm" className="h-7 px-2" disabled={updateStatusM.isPending}
                                onClick={() => handleReceive(po)}>Receive</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && !posQ.isLoading && (
                    <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">No purchase orders found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Suppliers */}
        <TabsContent value="suppliers">
          <div className="flex justify-end mb-3">
            {isLive && (
              <Button size="sm" className="gap-1.5" onClick={() => setNewVendorOpen(true)}>
                <Plus className="size-4" />Add Vendor
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {allVendors.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.category}</div>
                  </div>
                  {s.rating && <div className="text-xs font-medium">★ {Number(s.rating).toFixed(1)}</div>}
                </div>
                <div className="space-y-1.5 text-sm mb-3">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Contact</span><span>{s.contact_person ?? "—"}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Email</span><span className="truncate max-w-[140px]">{s.email ?? "—"}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Phone</span><span>{s.phone ?? "—"}</span></div>
                  {s.active !== undefined && (
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Status</span>
                      <Badge className={`text-[10px] ${s.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{s.active ? "Active" : "Inactive"}</Badge>
                    </div>
                  )}
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
            {allPOs.filter((p) => p.status === "Sent" || p.status === "sent").length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">No pending deliveries.</Card>
            ) : (
              allPOs.filter((p) => p.status === "Sent" || p.status === "sent").map((po) => (
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
                    {Array.isArray(po.items) && po.items.map((i: any) => (
                      <div key={i.name ?? i.item_name} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{i.qty}× {i.name ?? i.item_name}</span>
                        <span>{fmtINR((i.qty ?? 0) * (i.unit_price ?? i.unitPrice ?? 0))}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.info("Tracking update requested")}>Request Update</Button>
                    <Button size="sm" className="flex-1" disabled={updateStatusM.isPending} onClick={() => handleReceive(po)}>
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
                <div><span className="text-xs text-muted-foreground">Status</span><div><Badge className={`text-[10px] ${STATUS_META[detailPO.status]?.color ?? ""}`}>{detailPO.status}</Badge></div></div>
                <div><span className="text-xs text-muted-foreground">Date</span><div>{detailPO.createdAt}</div></div>
                <div><span className="text-xs text-muted-foreground">Total</span><div className="font-semibold">{fmtINR(detailPO.total ?? 0)}</div></div>
              </div>
              {detailPO.notes && <div className="text-xs text-muted-foreground">{detailPO.notes}</div>}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50"><tr>
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground">Item</th>
                    <th className="text-right px-3 py-2 text-xs text-muted-foreground">Qty</th>
                    <th className="text-right px-3 py-2 text-xs text-muted-foreground">Unit Price</th>
                    <th className="text-right px-3 py-2 text-xs text-muted-foreground">Total</th>
                  </tr></thead>
                  <tbody>
                    {Array.isArray(detailPO.items) && detailPO.items.map((i: any) => {
                      const up = i.unit_price ?? i.unitPrice ?? 0;
                      return (
                        <tr key={i.name ?? i.item_name} className="border-t">
                          <td className="px-3 py-2">{i.name ?? i.item_name}</td>
                          <td className="px-3 py-2 text-right">{i.qty}</td>
                          <td className="px-3 py-2 text-right">{fmtINR(up)}</td>
                          <td className="px-3 py-2 text-right font-medium">{fmtINR(i.qty * up)}</td>
                        </tr>
                      );
                    })}
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
                  {allVendors.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Item Name</Label>
              <Input className="h-8 mt-1" placeholder="e.g. Bath towels" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
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
            <div>
              <Label className="text-xs">Notes</Label>
              <Input className="h-8 mt-1" placeholder="Optional notes" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
            </div>
            {newQty && newUnitPrice && (
              <div className="text-sm font-medium text-right">Total: {fmtINR(Number(newQty) * Number(newUnitPrice))}</div>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button className="flex-1" disabled={!newSupplier || !newItem || !newQty || !newUnitPrice || createPOM.isPending} onClick={handleCreatePO}>
                {createPOM.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Create PO"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Vendor Dialog */}
      <Dialog open={newVendorOpen} onOpenChange={setNewVendorOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Vendor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Name *</Label><Input className="h-8 mt-1" value={nv.name} onChange={(e) => setNv({ ...nv, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Contact Person</Label><Input className="h-8 mt-1" value={nv.contact_person} onChange={(e) => setNv({ ...nv, contact_person: e.target.value })} /></div>
              <div><Label className="text-xs">Category</Label><Input className="h-8 mt-1" placeholder="F&B, Linen…" value={nv.category} onChange={(e) => setNv({ ...nv, category: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Email</Label><Input className="h-8 mt-1" type="email" value={nv.email} onChange={(e) => setNv({ ...nv, email: e.target.value })} /></div>
              <div><Label className="text-xs">Phone</Label><Input className="h-8 mt-1" value={nv.phone} onChange={(e) => setNv({ ...nv, phone: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewVendorOpen(false)}>Cancel</Button>
            <Button disabled={!nv.name || createVendorM.isPending}
              onClick={() => {
                createVendorM.mutate(
                  { name: nv.name, contact_person: nv.contact_person || undefined, email: nv.email || undefined, phone: nv.phone || undefined, category: nv.category || undefined },
                  {
                    onSuccess: () => { toast.success("Vendor added"); setNewVendorOpen(false); setNv({ name: "", contact_person: "", email: "", phone: "", category: "", address: "" }); },
                    onError: (e: any) => toast.error(e.message ?? "Failed to add vendor"),
                  }
                );
              }}>
              {createVendorM.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Add Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
