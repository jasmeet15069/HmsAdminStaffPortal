import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Search, Shield, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ROLES = ["Admin", "Manager", "Front Desk", "Housekeeping", "Accounts", "F&B"] as const;

const PERMS = [
  { mod: "Dashboard", roles: ["Admin", "Manager", "Front Desk", "Housekeeping", "Accounts", "F&B"] },
  { mod: "Reservations", roles: ["Admin", "Manager", "Front Desk"] },
  { mod: "Front Desk", roles: ["Admin", "Manager", "Front Desk"] },
  { mod: "POS & Restaurant", roles: ["Admin", "Manager", "F&B"] },
  { mod: "Housekeeping", roles: ["Admin", "Manager", "Housekeeping"] },
  { mod: "Revenue Mgmt", roles: ["Admin", "Manager"] },
  { mod: "Billing & Finance", roles: ["Admin", "Manager", "Accounts"] },
  { mod: "Inventory", roles: ["Admin", "Manager"] },
  { mod: "Procurement", roles: ["Admin", "Manager"] },
  { mod: "Maintenance", roles: ["Admin", "Manager"] },
  { mod: "CRM & Loyalty", roles: ["Admin", "Manager", "Front Desk"] },
  { mod: "Channel Manager", roles: ["Admin", "Manager"] },
  { mod: "Booking Engine", roles: ["Admin", "Manager"] },
  { mod: "Reports", roles: ["Admin", "Manager", "Accounts"] },
  { mod: "Night Audit", roles: ["Admin", "Manager", "Accounts"] },
  { mod: "Users & Roles", roles: ["Admin"] },
  { mod: "System Admin", roles: ["Admin"] },
];

const ACTIVITY_LOG = [
  { user: "Sarah Manager", action: "Updated rate plan for Weekend", time: "2 min ago", ip: "192.168.1.42" },
  { user: "Dev Front Desk", action: "Checked in reservation RES2014", time: "14 min ago", ip: "192.168.1.15" },
  { user: "Admin User", action: "Created new user Raj Accounts", time: "1 hr ago", ip: "192.168.1.5" },
  { user: "Sunita HK", action: "Completed task 304-Deep Clean", time: "2 hrs ago", ip: "192.168.1.28" },
  { user: "Arjun F&B", action: "Voided POS order #POS-0087", time: "3 hrs ago", ip: "192.168.1.33" },
  { user: "Admin User", action: "Exported Daily Revenue report", time: "4 hrs ago", ip: "192.168.1.5" },
  { user: "Dev Front Desk", action: "Processed check-out RES2010", time: "5 hrs ago", ip: "192.168.1.15" },
  { user: "Sarah Manager", action: "Approved procurement PO-2026-0041", time: "6 hrs ago", ip: "192.168.1.42" },
];

export const Route = createFileRoute("/users")({
  head: () => ({ meta: [{ title: "Users & Roles · MHMS" }] }),
  component: Users,
});

function Users() {
  const { users, addUser, updateUser } = useMHMS();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "Front Desk" });
  const [editUser, setEditUser] = useState<typeof users[number] | null>(null);

  const filtered = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "All" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const handleAdd = () => {
    if (!form.name || !form.email) return;
    addUser({ name: form.name, email: form.email, role: form.role as any, active: true, lastLogin: new Date().toISOString().slice(0, 10) });
    toast.success("User created · invitation sent");
    setAddOpen(false);
    setForm({ name: "", email: "", role: "Front Desk" });
  };

  const initials = (name: string) => name.split(" ").map((s) => s[0]?.toUpperCase() ?? "").join("").slice(0, 2);

  const ROLE_COLORS: Record<string, string> = {
    Admin: "bg-destructive/15 text-destructive border-destructive/30",
    Manager: "bg-warning/15 text-warning-foreground border-warning/30",
    "Front Desk": "bg-info/15 text-info border-info/30",
    Housekeeping: "bg-muted text-muted-foreground",
    Accounts: "bg-success/15 text-success border-success/30",
    "F&B": "bg-purple-500/15 text-purple-600 border-purple-300/30",
  };

  return (
    <>
      <PageHeader
        title="Users & Roles"
        description="Access control, permissions and activity audit"
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> Add User
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="Total Users" value={users.length} hint="All accounts" />
        <Stat label="Active" value={users.filter((u) => u.active).length} tone="success" hint="Can log in" />
        <Stat label="Roles" value={new Set(users.map((u) => u.role)).size} hint="Unique roles" />
        <Stat label="Admins" value={users.filter((u) => u.role === "Admin").length} tone="warning" hint="Full access" />
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="perms"><Shield className="size-3.5 mr-1.5" />Permissions Matrix</TabsTrigger>
          <TabsTrigger value="activity"><Clock className="size-3.5 mr-1.5" />Activity Log</TabsTrigger>
        </TabsList>

        {/* Users */}
        <TabsContent value="users">
          <div className="flex gap-2 mb-3 flex-wrap">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8 h-8 w-52 text-sm" placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {["All", ...ROLES].map((r) => (
                <button key={r} onClick={() => setRoleFilter(r)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${roleFilter === r ? "bg-secondary text-secondary-foreground border-secondary" : "hover:border-muted-foreground/40"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["User", "Email", "Role", "Last Login", "2FA", "Active", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-accent/5">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials(u.name)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{u.email}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] border ${ROLE_COLORS[u.role] ?? "bg-muted text-muted-foreground"}`}>{u.role}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{u.lastLogin}</td>
                      <td className="px-4 py-3">
                        {u.role === "Admin" || u.role === "Accounts"
                          ? <CheckCircle2 className="size-3.5 text-success" />
                          : <XCircle className="size-3.5 text-muted-foreground" />}
                      </td>
                      <td className="px-4 py-3">
                        <Switch checked={u.active} onCheckedChange={(v) => { updateUser(u.id, { active: v }); toast.success(`${u.name} ${v ? "activated" : "deactivated"}`); }} />
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditUser(u)}>Edit</Button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">No users match your search.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Permissions */}
        <TabsContent value="perms">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Module</th>
                    {ROLES.map((r) => (
                      <th key={r} className="px-3 py-3 text-xs font-medium text-muted-foreground text-center whitespace-nowrap">{r}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMS.map((p) => (
                    <tr key={p.mod} className="border-b last:border-0 hover:bg-accent/5">
                      <td className="px-4 py-3 font-medium text-sm">{p.mod}</td>
                      {ROLES.map((r) => (
                        <td key={r} className="px-3 py-3 text-center">
                          {p.roles.includes(r)
                            ? <CheckCircle2 className="size-4 text-success mx-auto" />
                            : <XCircle className="size-4 text-muted-foreground/30 mx-auto" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Activity Log */}
        <TabsContent value="activity">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Time", "User", "Action", "IP Address"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ACTIVITY_LOG.map((a, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-accent/5">
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{a.time}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6"><AvatarFallback className="text-[10px]">{initials(a.user)}</AvatarFallback></Avatar>
                          <span className="font-medium text-sm">{a.user}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{a.action}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{a.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add User Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Full Name *</Label>
              <Input className="h-8 mt-1" placeholder="e.g. Raj Sharma" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Email *</Label>
              <Input className="h-8 mt-1" type="email" placeholder="raj@hotel.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">An invitation email will be sent to the user.</p>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button className="flex-1" disabled={!form.name || !form.email} onClick={handleAdd}>Add User</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      {editUser && (
        <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Edit User — {editUser.name}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Role</Label>
                <Select defaultValue={editUser.role} onValueChange={(v) => updateUser(editUser.id, { role: v as any })}>
                  <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between border rounded p-3">
                <Label className="text-xs">Active Account</Label>
                <Switch defaultChecked={editUser.active} onCheckedChange={(v) => updateUser(editUser.id, { active: v })} />
              </div>
              <Button className="w-full" onClick={() => { toast.success("User updated"); setEditUser(null); }}>Save Changes</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
