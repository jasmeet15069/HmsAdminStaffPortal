import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Search, Shield, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApiUsers, useCreateApiUser, useAddUserRole, useRemoveUserRole } from "@/lib/api/hooks";

const UI_ROLES = ["Admin", "Manager", "Front Desk", "Housekeeping", "Accounts", "F&B"] as const;
type UiRole = (typeof UI_ROLES)[number];

const UI_TO_API: Record<UiRole, string> = {
  Admin: "super_admin",
  Manager: "hotel_admin",
  "Front Desk": "front_desk",
  Housekeeping: "housekeeping",
  Accounts: "accountant",
  "F&B": "fnb",
};

const API_TO_UI: Record<string, string> = {
  super_admin: "Admin",
  hotel_admin: "Manager",
  front_desk: "Front Desk",
  housekeeping: "Housekeeping",
  accountant: "Accounts",
  fnb: "F&B",
  guest: "Guest",
};

const ROLE_COLORS: Record<string, string> = {
  Admin: "bg-destructive/15 text-destructive border-destructive/30",
  Manager: "bg-warning/15 text-warning-foreground border-warning/30",
  "Front Desk": "bg-info/15 text-info border-info/30",
  Housekeeping: "bg-muted text-muted-foreground",
  Accounts: "bg-success/15 text-success border-success/30",
  "F&B": "bg-purple-500/15 text-purple-600 border-purple-300/30",
  Guest: "bg-muted text-muted-foreground",
};

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
  { user: "hoteladmin", action: "Hotel admin account created", time: "Jun 18, 2026", ip: "—" },
  { user: "jasmeet", action: "Platform master admin created", time: "System migration", ip: "—" },
];

export const Route = createFileRoute("/users")({
  head: () => ({ meta: [{ title: "Users & Roles · MHMS" }] }),
  component: Users,
});

function Users() {
  const usersQ = useApiUsers();
  const users = usersQ.data ?? [];
  const createUser = useCreateApiUser();
  const addRole = useAddUserRole();
  const removeRole = useRemoveUserRole();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "Front Desk" as UiRole });
  const [editUser, setEditUser] = useState<(typeof users)[number] | null>(null);
  const [addRoleVal, setAddRoleVal] = useState<UiRole>("Front Desk");

  const primaryRole = (roles: string[]): string => {
    const nonGuest = roles.filter((r) => r !== "guest");
    if (nonGuest.length === 0) return "Guest";
    return API_TO_UI[nonGuest[0]] ?? nonGuest[0].replace(/_/g, " ");
  };

  const filtered = users.filter((u) => {
    const name = u.full_name || u.email;
    const matchSearch =
      name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole =
      roleFilter === "All" ||
      u.roles.some((r) => (API_TO_UI[r] ?? r) === roleFilter);
    return matchSearch && matchRole;
  });

  const initials = (name: string) =>
    name.split(" ").map((s) => s[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "??";

  const adminCount = users.filter((u) => u.roles.includes("super_admin")).length;
  const uniqueRoles = new Set(users.flatMap((u) => u.roles.filter((r) => r !== "guest")));

  const handleAdd = () => {
    if (!form.name || !form.email || !form.password) return;
    createUser.mutate(
      { email: form.email, password: form.password, full_name: form.name, role: UI_TO_API[form.role] },
      {
        onSuccess: () => {
          toast.success("User created");
          setAddOpen(false);
          setForm({ name: "", email: "", password: "", role: "Front Desk" });
        },
        onError: (e: any) => toast.error(e.message ?? "Failed to create user"),
      }
    );
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
        <Stat label="Total Users" value={usersQ.isLoading ? "…" : users.length} hint="All accounts" />
        <Stat label="Active" value={usersQ.isLoading ? "…" : users.length} tone="success" hint="Registered accounts" />
        <Stat label="Roles" value={usersQ.isLoading ? "…" : uniqueRoles.size} hint="Unique roles in use" />
        <Stat label="Admins" value={usersQ.isLoading ? "…" : adminCount} tone="warning" hint="super_admin role" />
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
              {["All", ...UI_ROLES].map((r) => (
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
                    {["User", "Email", "Primary Role", "Joined", "All Roles", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usersQ.isLoading ? (
                    <tr><td colSpan={6} className="py-10 text-center"><Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
                  ) : filtered.map((u) => {
                    const pr = primaryRole(u.roles);
                    return (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-accent/5">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="size-8">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials(u.full_name || u.email)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{u.full_name || "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{u.email}</td>
                        <td className="px-4 py-3">
                          <Badge className={`text-[10px] border ${ROLE_COLORS[pr] ?? "bg-muted text-muted-foreground"}`}>{pr}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{u.joined_at}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {u.roles.filter((r) => r !== "guest").map((r) => (
                              <Badge key={r} variant="outline" className="text-[10px]">{r.replace(/_/g, " ")}</Badge>
                            ))}
                            {u.roles.every((r) => r === "guest") && (
                              <Badge variant="outline" className="text-[10px]">guest</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditUser(u); setAddRoleVal("Front Desk"); }}>Edit</Button>
                        </td>
                      </tr>
                    );
                  })}
                  {!usersQ.isLoading && filtered.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">No users match your search.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Permissions Matrix */}
        <TabsContent value="perms">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Module</th>
                    {UI_ROLES.map((r) => (
                      <th key={r} className="px-3 py-3 text-xs font-medium text-muted-foreground text-center whitespace-nowrap">{r}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMS.map((p) => (
                    <tr key={p.mod} className="border-b last:border-0 hover:bg-accent/5">
                      <td className="px-4 py-3 font-medium text-sm">{p.mod}</td>
                      {UI_ROLES.map((r) => (
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
              <Label className="text-xs">Password *</Label>
              <Input className="h-8 mt-1" type="password" placeholder="Min. 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UiRole })}>
                <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UI_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">User will be created with the selected role assigned.</p>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button
                className="flex-1"
                disabled={!form.name || !form.email || !form.password || createUser.isPending}
                onClick={handleAdd}
              >
                {createUser.isPending ? <Loader2 className="size-4 animate-spin" /> : "Add User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      {editUser && (
        <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Edit — {editUser.full_name || editUser.email}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs mb-2 block">Current Roles</Label>
                <div className="flex flex-wrap gap-1.5 p-2.5 border rounded min-h-9">
                  {editUser.roles.map((r) => (
                    <Badge key={r} variant="outline" className="text-xs gap-1.5 pr-1">
                      {r.replace(/_/g, " ")}
                      {r !== "guest" && (
                        <button
                          className="ml-0.5 text-muted-foreground hover:text-destructive leading-none"
                          onClick={() => {
                            removeRole.mutate(
                              { userId: editUser.id, role: r },
                              {
                                onSuccess: () => { toast.success(`Role '${r}' removed`); setEditUser(null); },
                                onError: (e: any) => toast.error(e.message ?? "Failed"),
                              }
                            );
                          }}
                        >×</button>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Add Role</Label>
                <div className="flex gap-2">
                  <Select value={addRoleVal} onValueChange={(v) => setAddRoleVal(v as UiRole)}>
                    <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UI_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={addRole.isPending}
                    onClick={() => {
                      addRole.mutate(
                        { userId: editUser.id, role: UI_TO_API[addRoleVal] },
                        {
                          onSuccess: () => { toast.success(`Role '${addRoleVal}' added`); setEditUser(null); },
                          onError: (e: any) => toast.error(e.message ?? "Failed"),
                        }
                      );
                    }}
                  >
                    {addRole.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Add"}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
