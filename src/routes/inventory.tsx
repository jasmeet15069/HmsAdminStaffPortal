import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Minus } from "lucide-react";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory · MHMS" }] }),
  component: Inventory,
});

function Inventory() {
  const { inventory, updateInventory } = useMHMS();
  const [q, setQ] = useState("");
  const [adj, setAdj] = useState<{ id: string; delta: number } | null>(null);

  const filtered = inventory.filter(i => !q || i.name.toLowerCase().includes(q.toLowerCase()) || i.sku.toLowerCase().includes(q.toLowerCase()));
  const totalValue = inventory.reduce((s,i) => s + i.stock * i.unitCost, 0);
  const lowStock = inventory.filter(i => i.stock < i.reorderLevel).length;

  return (
    <>
      <PageHeader title="Inventory Management" description="Stock control, reorder points, valuation" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Items" value={inventory.length} />
        <Stat label="Low Stock Alerts" value={lowStock} tone="warning" />
        <Stat label="Inventory Value" value={fmtINR(totalValue)} tone="success" />
        <Stat label="Categories" value={new Set(inventory.map(i => i.category)).size} />
      </div>
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <Input placeholder="Search SKU or name…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
          <Button className="ml-auto" onClick={() => toast.info("Item creation form")}><Plus className="size-4" /> New item</Button>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>SKU</TableHead><TableHead>Item</TableHead><TableHead>Category</TableHead>
            <TableHead>Stock</TableHead><TableHead>Reorder Level</TableHead><TableHead>Unit Cost</TableHead>
            <TableHead>Value</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map(i => {
              const low = i.stock < i.reorderLevel;
              const pct = Math.min(100, Math.round((i.stock / (i.reorderLevel * 2)) * 100));
              return (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs">{i.sku}</TableCell>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell><Badge variant="outline">{i.category}</Badge></TableCell>
                  <TableCell>
                    <div>{i.stock} {i.unit}</div>
                    <Progress value={pct} className="h-1.5 mt-1 w-24" />
                  </TableCell>
                  <TableCell>{i.reorderLevel}</TableCell>
                  <TableCell>{fmtINR(i.unitCost)}</TableCell>
                  <TableCell>{fmtINR(i.stock * i.unitCost)}</TableCell>
                  <TableCell>{low ? <Badge variant="destructive">Reorder</Badge> : <Badge variant="outline" className="bg-success/15 text-success border-success/30">OK</Badge>}</TableCell>
                  <TableCell className="space-x-1">
                    <Button size="icon" variant="outline" className="size-7" onClick={() => { updateInventory(i.id, { stock: i.stock + 10 }); toast.success("Added 10 units"); }}><Plus className="size-3.5" /></Button>
                    <Button size="icon" variant="outline" className="size-7" onClick={() => { updateInventory(i.id, { stock: Math.max(0, i.stock - 10) }); toast.success("Removed 10 units"); }}><Minus className="size-3.5" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
