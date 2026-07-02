import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS, fmtINR } from "@/lib/mhms-store";
import type { Outlet, MenuItem } from "@/lib/mhms-store";
import { useAuth } from "@/lib/api/auth";
import { useMenuItems, useMenuCategories, useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem, useCreateMenuCategory } from "@/lib/api/hooks";
import type { LiveMenuItem, MenuCategory } from "@/lib/api/types";
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
  Plus, Pencil, Trash2, Search, Lock, ShieldAlert, Loader2,
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
  const { menuItems: demoItems, addMenuItem, updateMenuItem: updateDemoItem, removeMenuItem, users } = useMHMS();
  const authUser = useAuth((s) => s.user);
  const authed = !!authUser;

  // Live API hooks
  const liveItemsQ = useMenuItems();
  const liveCatsQ = useMenuCategories();
  const createM = useCreateMenuItem();
  const updateM = useUpdateMenuItem();
  const deleteM = useDeleteMenuItem();
  const createCatM = useCreateMenuCategory();

  const isLive = authed && !!liveItemsQ.data;

  // Resolve current user role from store
  const currentRole = useMemo(
    () => users.find((u) => u.email === authUser?.email)?.role ?? "Guest",
    [users, authUser],
  );
  const canEdit = EDIT_ROLES.includes(currentRole) || authed;

  // UI state
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | LiveMenuItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_ITEM);
  const [newCatName, setNewCatName] = useState("");
  const [newCatOpen, setNewCatOpen] = useState(false);

  // Unified item list
  const menuItems = useMemo(() => {
    if (isLive && liveItemsQ.data) {
      return liveItemsQ.data.map((li) => ({
        id: li.id,
        name: li.name,
        price: li.price,
        cat: li.menu_categories?.name ?? "Uncategorised",
        outlet: "Restaurant" as Outlet, // live items use category grouping, not outlet
        desc: li.description ?? undefined,
        active: li.is_available,
        _live: true as const,
        _categoryId: li.category_id,
      }));
    }
    return demoItems;
  }, [isLive, liveItemsQ.data, demoItems]);

  const liveCategories: MenuCategory[] = useMemo(
    () => (isLive && liveCatsQ.data ? liveCatsQ.data.filter((c) => c.is_active) : []),
    [isLive, liveCatsQ.data],
  );

  const total = menuItems.length;
  const active = menuItems.filter((m) => m.active).length;

  // In live mode group by category name; in demo mode group by outlet
  const groupKeys: string[] = useMemo(() => {
    if (isLive) {
      const names = Array.from(new Set(menuItems.map((m) => m.cat)));
      return names.length > 0 ? names : ["All Items"];
    }
    return OUTLETS.map((o) => o.key);
  }, [isLive, menuItems]);

  const itemsForGroup = (group: string) =>
    menuItems.filter((m) => {
      const matchGroup = isLive ? m.cat === group : m.outlet === group;
      const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.cat.toLowerCase().includes(search.toLowerCase());
      const matchCat = catFilter === "All" || m.cat === catFilter;
      return matchGroup && matchSearch && matchCat;
    });

  const allCats = (group: string) => ["All", ...Array.from(new Set(menuItems.filter((m) => isLive ? m.cat === group : m.outlet === group).map((m) => m.cat)))];

  const openAdd = (group: string) => {
    const outlet = isLive ? "Restaurant" : group as Outlet;
    const cat = isLive ? group : "";
    setForm({ ...BLANK_ITEM, outlet, cat });
    setAddOpen(true);
  };

  const openEdit = (item: (typeof menuItems)[0]) => {
    setForm({ outlet: item.outlet, name: item.name, price: String(item.price), cat: item.cat, desc: item.desc ?? "", active: item.active });
    setEditItem(item);
  };

  const isPending = createM.isPending || updateM.isPending || deleteM.isPending;

  const saveItem = () => {
    if (!form.name.trim() || !form.price) {
      toast.error("Name and price are required");
      return;
    }
    const price = Number(form.price);
    if (isNaN(price) || price <= 0) { toast.error("Enter a valid price"); return; }

    if (isLive) {
      const categoryId = liveCategories.find((c) => c.name === form.cat)?.id ?? null;
      if (editItem && "_live" in editItem) {
        updateM.mutate(
          { id: editItem.id, patch: { name: form.name.trim(), price, category_id: categoryId, description: form.desc.trim() || null, is_available: form.active } },
          { onSuccess: () => { toast.success(`"${form.name}" updated`); setEditItem(null); setForm(BLANK_ITEM); }, onError: (e: any) => toast.error(e.message ?? "Update failed") },
        );
      } else {
        createM.mutate(
          { name: form.name.trim(), price, category_id: categoryId, description: form.desc.trim() || null, is_available: form.active },
          { onSuccess: () => { toast.success(`"${form.name}" added`); setAddOpen(false); setForm(BLANK_ITEM); }, onError: (e: any) => toast.error(e.message ?? "Create failed") },
        );
      }
    } else {
      if (editItem) {
        updateDemoItem(editItem.id, { name: form.name.trim(), price, cat: form.cat.trim(), desc: form.desc.trim() || undefined, outlet: form.outlet, active: form.active });
        toast.success(`"${form.name}" updated`);
        setEditItem(null);
      } else {
        addMenuItem({ name: form.name.trim(), price, cat: form.cat.trim(), desc: form.desc.trim() || undefined, outlet: form.outlet, active: form.active });
        toast.success(`"${form.name}" added to ${form.outlet}`);
        setAddOpen(false);
      }
      setForm(BLANK_ITEM);
    }
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    const item = menuItems.find((m) => m.id === deleteId);
    if (isLive) {
      deleteM.mutate(deleteId, {
        onSuccess: () => { toast.success(`"${item?.name}" removed`); setDeleteId(null); },
        onError: (e: any) => toast.error(e.message ?? "Delete failed"),
      });
    } else {
      removeMenuItem(deleteId);
      toast.success(`"${item?.name}" removed`);
      setDeleteId(null);
    }
  };

  const toggleAvailable = (item: (typeof menuItems)[0]) => {
    if (isLive && "_live" in item) {
      updateM.mutate(
        { id: item.id, patch: { is_available: !item.active } },
        { onSuccess: () => toast.success(`${item.name} ${!item.active ? "shown in" : "hidden from"} POS`) },
      );
    } else {
      updateDemoItem(item.id, { active: !item.active });
      toast.success(`${item.name} ${!item.active ? "shown in" : "hidden from"} POS`);
    }
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
        <Stat label={isLive ? "Categories" : "Outlets"} value={isLive ? liveCategories.length : 4} hint={isLive ? "Live from DB" : "Restaurant, Bar, Room Service, Spa"} />
      </div>

      {isLive && (
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="default" className="text-xs">Live</Badge>
          <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => setNewCatOpen(true)}>
            <Plus className="size-3" />New Category
          </Button>
        </div>
      )}

      <Tabs defaultValue={groupKeys[0] ?? "Restaurant"}>
        <TabsList className="mb-4 flex-wrap h-auto">
          {groupKeys.map((key) => {
            const count = menuItems.filter((m) => (isLive ? m.cat === key : m.outlet === key) && m.active).length;
            const outlet = OUTLETS.find((o) => o.key === key);
            return (
              <TabsTrigger key={key} value={key} className="gap-1.5">
                {outlet?.icon ?? <UtensilsCrossed className="size-3.5" />} {key}
                <Badge variant="secondary" className="ml-1 text-[10px]">{count}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {groupKeys.map((group) => {
          const cats = allCats(group);
          const items = itemsForGroup(group);
          return (
            <TabsContent key={group} value={group}>
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <div className="flex gap-1.5 flex-wrap">
                  {cats.map((c) => (
                    <button key={c} onClick={() => setCatFilter(c)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition ${catFilter === c ? "bg-secondary text-secondary-foreground border-secondary" : "hover:border-muted-foreground/40"}`}>
                      {c}
                    </button>
                  ))}
                </div>
                <Button size="sm" className="gap-1.5 shrink-0" onClick={() => openAdd(group)} disabled={isPending}>
                  <Plus className="size-4" />Add Item
                </Button>
              </div>

              {items.length === 0 ? (
                <Card className="p-12 text-center text-muted-foreground">
                  No items found. <button className="text-primary hover:underline" onClick={() => openAdd(group)}>Add the first one →</button>
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
                            onCheckedChange={() => toggleAvailable(item)}
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
            {!isLive && (
              <div className="col-span-2">
                <Label className="text-xs">Outlet</Label>
                <Select value={form.outlet} onValueChange={(v) => setForm({ ...form, outlet: v as Outlet })}>
                  <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{OUTLETS.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="col-span-2">
              <Label className="text-xs">Item Name *</Label>
              <Input className="h-8 mt-1" placeholder="e.g. Paneer Butter Masala" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Category{isLive ? "" : " *"}</Label>
              {isLive ? (
                <Select value={form.cat} onValueChange={(v) => setForm({ ...form, cat: v })}>
                  <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {liveCategories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input className="h-8 mt-1" placeholder="e.g. Main, Starter, Cocktail" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })} />
              )}
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
            <Button onClick={saveItem} disabled={isPending}>
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : (editItem ? "Save Changes" : "Add Item")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Category Dialog (live only) */}
      <Dialog open={newCatOpen} onOpenChange={setNewCatOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
          <div>
            <Label className="text-xs">Category Name *</Label>
            <Input className="h-8 mt-1" placeholder="e.g. Starters, Cocktails, Desserts" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCatOpen(false)}>Cancel</Button>
            <Button disabled={createCatM.isPending || !newCatName.trim()} onClick={() => {
              createCatM.mutate(
                { name: newCatName.trim() },
                { onSuccess: () => { toast.success(`Category "${newCatName}" created`); setNewCatOpen(false); setNewCatName(""); }, onError: (e: any) => toast.error(e.message ?? "Failed") },
              );
            }}>
              {createCatM.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Create"}
            </Button>
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
            <Button variant="destructive" disabled={deleteM.isPending} onClick={confirmDelete}>
              {deleteM.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Remove Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
