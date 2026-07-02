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
import { Plus, Search, Shield, CheckCircle2, XCircle, Clock, Loader2, Eye, EyeOff, Trash2, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/api/auth";
import {
  useApiUsers,
  useCreateApiUser,
  useUpdateUser,
  useSetUserRole,
  useDeleteUser,
  useResetUserPassword,
} from "@/lib/api/hooks";
import type { ApiUser } from "@/lib/api/types";

const DEFAULT_DOMAIN = "serenentra.com";

const UI_ROLES = ["Admin", "Manager", "Front Desk", "Housekeeping", "Accounts", "F&B"] as const;
type UiRole = (typeof UI_ROLES)[number];

const UI_TO_API: Record<UiRole, string> = {
  Admin: "hotel_admin",
  Manager: "property_manager",
  "Front Desk": "receptionist",
  Housekeeping: "housekeeping",
  Accounts: "admin",
  "F&B": "food_manager",
};

const API_TO_UI: Record<string, UiRole | "Guest"> = {
  hotel_admin: "Admin",
  super_admin: "Admin",
  property_manager: "Manager",
  receptionist: "Front Desk",
  housekeeping: "Housekeeping",
  admin: "Accounts",
  food_manager: "F&B",
  kitchen_manager: "F&B",
  waiter: "F&B",
  maintenance: "Manager",
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const initials = (name: string) =>
  name.split(" ").map((s) => s[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "??";

const primaryRole = (roles: string[]): UiRole | "Guest" => {
  const nonGuest = roles.find((r) => r !== "guest");
  if (!nonGuest) return "Guest";
  return API_TO_UI[nonGuest] ?? "Guest";
};

const primaryApiRole = (roles: string[]): string =>
  roles.find((r) => r !== "guest") ?? "guest";

const toUiRole = (roles: string[]): UiRole => {
  const pr = primaryRole(roles);
  return UI_ROLES.includes(pr as UiRole) ? (pr as UiRole) : "Front Desk";
};

const isHotelAdmin = (roles: string[], platformAdmin: boolean): boolean =>
  platformAdmin ||
  roles.some((r) => r === "hotel_admin" || r === "super_admin" || r === "platform_admin");

// Split email helpers
const stripDomain = (email: string): string =>
  email.endsWith(`@${DEFAULT_DOMAIN}`) ? email.slice(0, -(DEFAULT_DOMAIN.length + 1)) : email;

const buildEmail = (prefix: string): string =>
  prefix.includes("@") ? prefix : `${prefix}@${DEFAULT_DOMAIN}`;

// ---------------------------------------------------------------------------
// Edit dialog (hotel admin only)
// ---------------------------------------------------------------------------

function EditUserDialog({ user, onClose }: { user: ApiUser; onClose: () => void }) {
  const [name, setName] = useState(user.full_name || "");
  const [role, setRole] = useState<UiRole>(toUiRole(user.roles));
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPwField, setShowPwField] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateUser = useUpdateUser();
  const setRoleMut = useSetUserRole();
  const resetPw = useResetUserPassword();
  const deleteUser = useDeleteUser();

  const isSaving = updateUser.isPending || setRoleMut.isPending || resetPw.isPending;
  const isDeleting = deleteUser.isPending;

  const handleSave = async () => {
    const ops: Promise<unknown>[] = [];

    if (name.trim() && name.trim() !== (user.full_name || "")) {
      ops.push(updateUser.mutateAsync({ userId: user.id, data: { full_name: name.trim() } }));
    }

    const currentApiRole = primaryApiRole(user.roles);
    const newApiRole = UI_TO_API[role];
    if (newApiRole !== currentApiRole) {
      ops.push(setRoleMut.mutateAsync({ userId: user.id, role: newApiRole }));
    }

    if (showPwField && password.length >= 8) {
      ops.push(resetPw.mutateAsync({ userId: user.id, password }));
    }

    if (ops.length === 0) { onClose(); return; }

    try {
      await Promise.all(ops);
      toast.success("User updated");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save changes");
    }
  };

  const handleDelete = () => {
    deleteUser.mutate(user.id, {
      onSuccess: () => { toast.success(`${user.full_name || user.email} removed`); onClose(); },
      onError: (e: any) => toast.error(e.message ?? "Failed to delete user"),
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Staff Member</DialogTitle>
        </DialogHeader>

        {/* Identity */}
        <div className="flex items-center gap-3 py-1 border-b pb-3">
          <Avatar className="size-10">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {initials(user.full_name || user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user.email}</p>
            <p className="text-xs text-muted-foreground">Joined {user.joined_at}</p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Name */}
          <div>
            <Label className="text-xs">Full Name</Label>
            <Input
              className="h-8 mt-1"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Role */}
          <div>
            <Label className="text-xs">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UiRole)}>
              <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {UI_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Password reset */}
          {!showPwField ? (
            <button
              type="button"
              onClick={() => setShowPwField(true)}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Reset password…
            </button>
          ) : (
            <div>
              <Label className="text-xs">
                New Password <span className="text-muted-foreground">(min 8 chars)</span>
              </Label>
              <div className="relative mt-1">
                <Input
                  className="h-8 pr-8"
                  type={showPw ? "text" : "password"}
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setShowPwField(false); setPassword(""); }}
                className="text-xs text-muted-foreground hover:underline mt-1"
              >
                Cancel reset
              </button>
            </div>
          )}
        </div>

        {/* Actions row */}
        <div className="flex items-center justify-between pt-3 border-t">
          {/* Delete */}
          {!confirmDelete ? (
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-destructive hover:underline"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-destructive font-medium">Sure?</span>
              <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" disabled={isDeleting} onClick={handleDelete}>
                {isDeleting ? <Loader2 className="size-3 animate-spin" /> : "Yes, delete"}
              </Button>
              <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              className="h-8"
              disabled={isSaving || (showPwField && password.length > 0 && password.length < 8)}
              onClick={handleSave}
            >
              {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/users")({
  head: () => ({ meta: [{ title: "Users & Roles · HMS" }] }),
  component: Users,
});

function Users() {
  const authUser = useAuth((s) => s.user);
  const canManage = isHotelAdmin(authUser?.roles ?? [], authUser?.platform_admin ?? false);

  const usersQ = useApiUsers();
  const users = usersQ.data ?? [];
  const createUser = useCreateApiUser();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [emailPrefix, setEmailPrefix] = useState("");
  const [form, setForm] = useState({ name: "", password: "", role: "Front Desk" as UiRole });
  const [showAddPw, setShowAddPw] = useState(false);
  const [editUser, setEditUser] = useState<ApiUser | null>(null);

  const filtered = users.filter((u) => {
    const name = u.full_name || u.email;
    const matchSearch =
      name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole =
      roleFilter === "All" ||
      u.roles.some((r) => API_TO_UI[r] === roleFilter);
    return matchSearch && matchRole;
  });

  const adminCount = users.filter((u) =>
    u.roles.some((r) => r === "hotel_admin" || r === "super_admin")
  ).length;
  const uniqueRoles = new Set(
    users.flatMap((u) => u.roles.filter((r) => r !== "guest").map((r) => API_TO_UI[r] ?? r))
  );

  const handleAdd = () => {
    const email = buildEmail(emailPrefix.trim());
    if (!form.name || !emailPrefix.trim() || form.password.length < 8) return;
    createUser.mutate(
      { email, password: form.password, full_name: form.name, role: UI_TO_API[form.role] },
      {
        onSuccess: () => {
          toast.success("Staff member created");
          setAddOpen(false);
          setEmailPrefix("");
          setForm({ name: "", password: "", role: "Front Desk" });
          setShowAddPw(false);
        },
        onError: (e: any) => toast.error(e.message ?? "Failed to create user"),
      }
    );
  };

  const openAdd = () => {
    setEmailPrefix("");
    setForm({ name: "", password: "", role: "Front Desk" });
    setShowAddPw(false);
    setAddOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Users & Roles"
        description="Manage staff accounts, roles and permissions"
        actions={
          canManage ? (
            <Button size="sm" className="gap-1.5" onClick={openAdd}>
              <Plus className="size-4" /> Add Staff
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="Total Staff" value={usersQ.isLoading ? "…" : users.length} hint="All accounts" />
        <Stat label="Active" value={usersQ.isLoading ? "…" : users.length} tone="success" hint="Registered accounts" />
        <Stat label="Roles Used" value={usersQ.isLoading ? "…" : uniqueRoles.size} hint="Distinct roles in use" />
        <Stat label="Admins" value={usersQ.isLoading ? "…" : adminCount} tone="warning" hint="hotel_admin role" />
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="perms">
            <Shield className="size-3.5 mr-1.5" />Permissions Matrix
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Clock className="size-3.5 mr-1.5" />Activity Log
          </TabsTrigger>
        </TabsList>

        {/* ── Users tab ── */}
        <TabsContent value="users">
          <div className="flex gap-2 mb-3 flex-wrap">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8 h-8 w-52 text-sm"
                placeholder="Search staff…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {["All", ...UI_ROLES].map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    roleFilter === r
                      ? "bg-secondary text-secondary-foreground border-secondary"
                      : "hover:border-muted-foreground/40"
                  }`}
                >
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
                    {["Staff Member", "Email / Login", "Role", "Joined", ...(canManage ? [""] : [])].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usersQ.isLoading ? (
                    <tr>
                      <td colSpan={canManage ? 5 : 4} className="py-10 text-center">
                        <Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" />
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={canManage ? 5 : 4} className="text-center py-10 text-muted-foreground text-sm">
                        {search || roleFilter !== "All"
                          ? "No staff match your search."
                          : canManage
                          ? "No staff yet — click Add Staff to create the first account."
                          : "No staff accounts yet."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((u) => {
                      const pr = primaryRole(u.roles);
                      const isCurrentUser = u.email === authUser?.email;
                      return (
                        <tr key={u.id} className="border-b last:border-0 hover:bg-accent/5">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="size-8">
                                <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                                  {initials(u.full_name || u.email)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <span className="font-medium">
                                  {u.full_name || <span className="text-muted-foreground italic text-xs">No name</span>}
                                </span>
                                {isCurrentUser && (
                                  <span className="ml-1.5 text-[10px] text-muted-foreground">(you)</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-muted-foreground">
                              {stripDomain(u.email)}
                              <span className="text-muted-foreground/50">@{DEFAULT_DOMAIN}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`text-[10px] border ${ROLE_COLORS[pr] ?? "bg-muted text-muted-foreground"}`}>
                              {pr}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{u.joined_at}</td>
                          {canManage && (
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-3 text-xs"
                                onClick={() => setEditUser(u)}
                              >
                                Edit
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {!canManage && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3">
              <Lock className="size-3.5" />
              Only hotel admins can add or edit staff accounts.
            </p>
          )}
        </TabsContent>

        {/* ── Permissions matrix ── */}
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

        {/* ── Activity log ── */}
        <TabsContent value="activity">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Time", "User", "Action"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      Activity log coming soon
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Add Staff dialog (admin only) ── */}
      {canManage && (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Add Staff Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Full Name *</Label>
                <Input
                  className="h-8 mt-1"
                  placeholder="e.g. Raj Sharma"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              {/* Split email input */}
              <div>
                <Label className="text-xs">Email / Login *</Label>
                <div className="flex mt-1">
                  <Input
                    className="h-8 rounded-r-none border-r-0 flex-1 text-sm"
                    placeholder="raj.sharma"
                    value={emailPrefix}
                    onChange={(e) => setEmailPrefix(e.target.value.replace(/@.*/, ""))}
                    autoComplete="off"
                  />
                  <span className="h-8 px-2.5 flex items-center text-xs text-muted-foreground bg-muted border rounded-r-md whitespace-nowrap select-none">
                    @{DEFAULT_DOMAIN}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Login: {emailPrefix.trim() ? buildEmail(emailPrefix.trim()) : `name@${DEFAULT_DOMAIN}`}
                </p>
              </div>

              <div>
                <Label className="text-xs">Password *</Label>
                <div className="relative mt-1">
                  <Input
                    className="h-8 pr-8"
                    type={showAddPw ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowAddPw(!showAddPw)}
                  >
                    {showAddPw ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
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

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setAddOpen(false); setShowAddPw(false); }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={!form.name || !emailPrefix.trim() || form.password.length < 8 || createUser.isPending}
                  onClick={handleAdd}
                >
                  {createUser.isPending ? <Loader2 className="size-4 animate-spin" /> : "Add Staff"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Edit dialog (admin only) ── */}
      {canManage && editUser && (
        <EditUserDialog user={editUser} onClose={() => setEditUser(null)} />
      )}
    </>
  );
}
