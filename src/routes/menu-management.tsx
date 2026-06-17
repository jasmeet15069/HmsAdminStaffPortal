import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import type { Outlet, MenuItem } from "@/lib/mhms-store";
import { useAuth } from "@/lib/api/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  UtensilsCrossed, Wine, BedDouble, Sparkles,
  Plus, Pencil, Trash2, Search, Lock, ShieldAlert,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/menu-management")({
  head: () => ({ meta: [{ title: "Menu Management · MHMS" }] }),
  component: MenuManagement,
});

const OUTLETS: { key: Outlet; label: string; icon: React.ReactNode }[] = [
  { key: "Restaurant",   label: "Restaurant",   icon: <UtensilsCrossed className="size-3.5" /> },
  { key: "Bar",          label: "Bar",           icon: <Wine className="size-3.5" /> },
  { key: "Room Service", label: "Room Service",  icon: <BedDouble className="size-3.5" /> },
  { key: "Spa",          label: "Spa",           icon: <Sparkles className="size-3.5" /> },
];

// Roles allowed to add / edit / remove menu items
const EDIT_ROLES = ["Admin", "Manager", "F&B", "Restaurant Manager", "Front Desk", "Receptionist"];

const BLANK_ITEM = { outlet: "Restaurant" as Outlet, name: "", price: "", cat: "", desc: "", active: true };

function MenuManagement() {
  const { menuItems, addMenuItem, updateMenuItem, removeMenuItem, users } = useMHMS();
  const authUser = useAuth((s) => s.user);

  // Resolve current user role from store
  const currentRole = useMemo(
    () => users.find((u) => u.email === authUser?.email)?.role ?? "Guest",
    [users, authUser],
  );
  const canEdit = EDIT_ROLES.includes(currentRole) || !!authUser; // live auth = allow

  // UI state
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_ITEM);

  const total = menuItems.length;
  const active = menuItems.filter((m) => m.active).length;

  const itemsForOutlet = (outlet: Outlet) =>
    menuItems.filter((m) => {
      const matchOutlet = m.outlet === outlet;
      const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.cat.toLowerCase().includes(search.toLowerCase());
      const matchCat = catFilter === "All" || m.cat === catFilter;
      return matchOutlet && matchSearch && matchCat;
    });

  const allCats = (outlet: Outlet) => ["All", ...Array.from(new Set(menuItems.filter((m) => m.outlet === outlet).map((m) => m.cat)))];

  const openAdd = (outlet: Outlet) => {
    setForm({ ...BLANK_ITEM, outlet });
    setAddOpen(true);
  };

  const openEdit = (item: MenuItem) => {
    setForm({ outlet: item.outlet, name: item.name, price: String(item.price), cat: item.cat, desc: item.desc ?? "", active: item.active });
    setEditItem(item);
  };

  const saveItem = () => {
    if (!form.name.trim() || !form.price || !form.cat.trim()) {
      toast.error("Name, price and category are required");
      return;
    }
    const price = Number(form.price);
    if (isNaN(price) || price <= 0) { toast.error("Enter a valid price"); return; }

    if (editItem) {
      updateMenuItem(editItem.id, { name: form.name.trim(), price, cat: form.cat.trim(), desc: form.desc.trim() || undefined, outlet: form.outlet, active: form.active });
      toast.success(`"${form.name}" updated`);
      setEditItem(null);
    } else {
      addMenuItem({ name: form.name.trim(), price, cat: form.cat.trim(), desc: form.desc.trim() || undefined, outlet: form.outlet, active: form.active });
      toast.success(`"${form.name}" added to ${form.outlet}`);
      setAddOpen(false);
    }
    setForm(BLANK_ITEM);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    const item = menuItems.find((m) => m.id === deleteId);
    removeMenuItem(deleteId);
    toast.success(`"${item?.name}" removed`);
    setDeleteId(null);
  };

  // Permission block
  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="size-16 rounded-full bg-destructive/10 grid place-items-center">
          <Lock className="size-7 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold">Access Restricted</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Menu management requires <strong>Restaurant Manager</strong>, <strong>Receptionist</strong>, or <strong>Admin</strong> privileges.
          Contact your system administrator to request access.
        </p>
        <Badge variant="outline" className="text-xs">Your role: {currentRole}</Badge>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Menu Management"
        description="Add, edit and remove items across all outlets — changes reflect instantly in POS"
        actions={
          <div className="flex items-center gap-2">
            {!canEdit && (
              <Badge variant="destructive" className="gap-1"><ShieldAlert className="size-3" />Read Only</Badge>
            )}
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8 h-8 w-48 text-sm" placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="Total Items" value={total} />
        <Stat label="Active in POS" value={active} tone="success" />
        <Stat label="Inactive / Hidden" value={total - active} tone="warning" />
        <Stat label="Outlets" value={4} hint="Restaurant, Bar, Room Service, Spa" />
      </div>

      <Tabs defaultValue="Restaurant">
        <TabsList className="mb-4">
          {OUTLETS.map((o) => {
            const count = menuItems.filter((m) => m.outlet === o.key && m.active).length;
            return (
              <TabsTrigger key={o.key} value={o.key} className="gap-1.5">
                {o.icon} {o.label}
                <Badge variant="secondary" className="ml-1 text-[10px]">{count}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {OUTLETS.map((o) => {
          const cats = allCats(o.key);
          const items = itemsForOutlet(o.key);
          return (
            <TabsContent key={o.key} value={o.key}>
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                {/* Category filter */}
                <div className="flex gap-1.5 flex-wrap">
                  {cats.map((c) => (
                    <button key={c} onClick={() => setCatFilter(c)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition ${catFilter === c ? "bg-secondary text-secondary-foreground border-secondary" : "hover:border-muted-foreground/40"}`}>
                      {c}
                    </button>
                  ))}
                </div>
                <Button size="sm" className="gap-1.5 shrink-0" onClick={() => openAdd(o.key)}>
                  <Plus className="size-4" />Add Item
                </Button>
              </div>

              {items.length === 0 ? (
                <Card className="p-12 text-center text-muted-foreground">
                  No items found. <button className="text-primary hover:underline" onClick={() => openAdd(o.key)}>Add the first one →</button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {items.map((item) => (
                    <Card key={item.id} className={`p-4 flex flex-col gap-2 transition ${!item.active ? "opacity-50 border-dashed" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[9px] px-1.5 shrink-0">{item.cat}</Badge>
                            {!item.active && <Badge variant="secondary" className="text-[9px] px-1.5">Hidden</Badge>}
                          </div>
                          <p className="font-semibold text-sm mt-1 leading-tight">{item.name}</p>
                          {item.desc && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">{item.desc}</p>}
                        </div>
                        <span className="text-primary font-bold text-sm shrink-0">{fmtINR(item.price)}</span>
                      </div>

                      <div className="flex items-center justify-between mt-auto pt-2 border-t">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Switch
                            checked={item.active}
                            onCheckedChange={(v) => { updateMenuItem(item.id, { active: v }); toast.success(`${item.name} ${v ? "shown in" : "hidden from"} POS`); }}
                            className="scale-75"
                          />
                          <span>{item.active ? "Active" : "Hidden"}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="size-7 p-0" onClick={() => openEdit(item)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="size-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteId(item.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Add / Edit Dialog */}
      <Dialog open={addOpen || !!editItem} onOpenChange={(v) => { if (!v) { setAddOpen(false); setEditItem(null); setForm(BLANK_ITEM); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? `Edit — ${editItem.name}` : "Add Menu Item"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Outlet</Label>
              <Select value={form.outlet} onValueChange={(v) => setForm({ ...form, outlet: v as Outlet })}>
                <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{OUTLETS.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Item Name *</Label>
              <Input className="h-8 mt-1" placeholder="e.g. Paneer Butter Masala" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Category *</Label>
              <Input className="h-8 mt-1" placeholder="e.g. Main, Starter, Cocktail" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Price (₹) *</Label>
              <Input type="number" min={1} className="h-8 mt-1" placeholder="380" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Description</Label>
              <Input className="h-8 mt-1" placeholder="Short description shown in POS" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label className="text-xs cursor-pointer">{form.active ? "Active — visible in POS" : "Hidden — not shown in POS"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setEditItem(null); setForm(BLANK_ITEM); }}>Cancel</Button>
            <Button onClick={saveItem}>{editItem ? "Save Changes" : "Add Item"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove Menu Item?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently remove <strong>"{menuItems.find((m) => m.id === deleteId)?.name}"</strong> from the menu and POS.
            Consider hiding it instead if you may need it again.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Remove Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
