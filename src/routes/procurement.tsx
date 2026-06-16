import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/procurement")({
  head: () => ({ meta: [{ title: "Procurement · MHMS" }] }),
  component: Procurement,
});

function Procurement() {
  const { purchaseOrders, addPO, updatePO, receivePO, inventory } = useMHMS();
  const [open, setOpen] = useState(false);
  const [po, setPo] = useState({ supplier: "Cotton Co.", itemName: "Bath towel", qty: 50, unitPrice: 350 });

  const total = po.qty * po.unitPrice;
  const value = purchaseOrders.reduce((s, p) => s + p.total, 0);

  return (
    <>
      <PageHeader title="Procurement" description="Purchase orders, suppliers, receiving"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4" /> New PO</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create purchase order</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Supplier</Label><Input className="mt-1" value={po.supplier} onChange={(e) => setPo({ ...po, supplier: e.target.value })} /></div>
                <div><Label>Item</Label>
                  <Select value={po.itemName} onValueChange={(v) => setPo({ ...po, itemName: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{inventory.map(i => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Qty</Label><Input className="mt-1" type="number" value={po.qty} onChange={(e) => setPo({ ...po, qty: +e.target.value })} /></div>
                  <div><Label>Unit price</Label><Input className="mt-1" type="number" value={po.unitPrice} onChange={(e) => setPo({ ...po, unitPrice: +e.target.value })} /></div>
                </div>
                <div className="text-right text-sm">Total: <span className="font-semibold">{fmtINR(total)}</span></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => { addPO({ poNumber: "PO-2026-" + Math.floor(1000 + Math.random()*9000), supplier: po.supplier, items: [{ name: po.itemName, qty: po.qty, unitPrice: po.unitPrice }], status: "Draft", total }); setOpen(false); toast.success("PO created"); }}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Total POs" value={purchaseOrders.length} />
        <Stat label="Open" value={purchaseOrders.filter(p => p.status !== "Received").length} tone="info" />
        <Stat label="Value (MTD)" value={fmtINR(value)} tone="success" />
        <Stat label="Suppliers" value={new Set(purchaseOrders.map(p => p.supplier)).size} />
      </div>
      <Card className="p-4">
        <Table>
          <TableHeader><TableRow>
            <TableHead>PO #</TableHead><TableHead>Supplier</TableHead><TableHead>Items</TableHead>
            <TableHead>Created</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {purchaseOrders.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.poNumber}</TableCell>
                <TableCell>{p.supplier}</TableCell>
                <TableCell>{p.items.map(i => `${i.qty}× ${i.name}`).join(", ")}</TableCell>
                <TableCell>{p.createdAt}</TableCell>
                <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                <TableCell className="text-right font-medium">{fmtINR(p.total)}</TableCell>
                <TableCell className="space-x-1">
                  {p.status === "Draft" && <Button size="sm" variant="outline" onClick={() => { updatePO(p.id, { status: "Sent" }); toast.success("PO sent"); }}>Send</Button>}
                  {p.status === "Sent" && <Button size="sm" onClick={() => { receivePO(p.id); toast.success(`Stock received · inventory updated`); }}>Receive</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
