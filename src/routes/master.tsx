import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Plus, Settings2, Building2, Loader2 } from "lucide-react";

import { PageHeader, Stat } from "@/components/AppShell";
import { useAuth } from "@/lib/api/auth";
import {
  usePlatformTenants,
  usePlatformPlans,
  useCreatePlatformTenant,
  useUpdateTenantPlan,
  usePlatformTenantModules,
  useUpdatePlatformTenantModules,
} from "@/lib/api/hooks";
import type { PlatformTenant } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/master")({
  head: () => ({ meta: [{ title: "Master Control · MHMS" }] }),
  component: MasterAdmin,
});

const blankCreate = {
  name: "", slug: "", plan_tier: "basic", country: "", currency: "USD",
  hotel_email: "", hotel_phone: "", timezone: "UTC",
  admin_email: "", admin_password: "",
};

function MasterAdmin() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);

  // Hard gate: only the platform super-admin may view this portal.
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    setChecked(true);
    if (user && !user.platform_admin) navigate({ to: "/" });
  }, [user, navigate]);

  const tenantsQ = usePlatformTenants();
  const plansQ = usePlatformPlans();
  const createM = useCreatePlatformTenant();
  const updatePlanM = useUpdateTenantPlan();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(blankCreate);
  const [moduleTenant, setModuleTenant] = useState<PlatformTenant | null>(null);

  const allTenants = tenantsQ.data ?? [];
  const plans = plansQ.data ?? [];

  // When accessed via a client subdomain (e.g. testingxyz.serenentra.com) scope
  // the tenant list to only that client so the platform-admin cannot accidentally
  // see or modify other clients from within a client's own portal URL.
  const subdomain = typeof window !== "undefined"
    ? (() => {
        const h = window.location.hostname;
        if (h.endsWith(".serenentra.com")) return h.replace(/\.serenentra\.com$/, "");
        if (h.endsWith(".jazverse.online")) return null; // main admin portal — show all
        return null;
      })()
    : null;
  const tenants = subdomain
    ? allTenants.filter((t) => t.slug === subdomain)
    : allTenants;

  const stats = useMemo(() => {
    const active = tenants.filter((t) => t.is_active).length;
    return { total: tenants.length, active, suspended: tenants.length - active };
  }, [tenants]);

  if (!checked || (user && !user.platform_admin)) return null;

  const submitCreate = async () => {
    if (!form.name.trim()) return toast.error("Client name is required");
    if ((form.admin_email && !form.admin_password) || (!form.admin_email && form.admin_password))
      return toast.error("Provide both admin email and password, or neither");
    if (form.admin_password && form.admin_password.length < 8)
      return toast.error("Admin password must be at least 8 characters");
    try {
      await createM.mutateAsync({
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        plan_tier: form.plan_tier,
        country: form.country.trim() || undefined,
        currency: form.currency.trim() || undefined,
        hotel_email: form.hotel_email.trim() || undefined,
        hotel_phone: form.hotel_phone.trim() || undefined,
        timezone: form.timezone || undefined,
      });
      toast.success(`Client "${form.name.trim()}" provisioned`);
      setCreateOpen(false);
      setForm(blankCreate);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create client");
    }
  };

  const changePlan = async (t: PlatformTenant, plan_tier: string) => {
    try {
      await updatePlanM.mutateAsync({ id: t.id, plan_tier });
      toast.success(`${t.name} moved to ${plan_tier}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update plan");
    }
  };

  const toggleActive = async (t: PlatformTenant, is_active: boolean) => {
    try {
      await updatePlanM.mutateAsync({ id: t.id, plan_tier: t.plan_tier, is_active });
      toast.success(`${t.name} ${is_active ? "activated" : "suspended"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    }
  };

  return (
    <>
      <PageHeader
        title="Master Control"
        description="Platform super-admin — provision client instances, manage plans, and mask modules per tenant."
        actions={
          !subdomain && (
            <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> New Client
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat label="Total Clients" value={stats.total} />
        <Stat label="Active" value={stats.active} tone="success" />
        <Stat label="Suspended" value={stats.suspended} tone={stats.suspended ? "warning" : undefined} />
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <span className="font-medium text-sm">{subdomain ? `Client: ${subdomain}` : "Client Tenants"}</span>
          {tenantsQ.isLoading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Rooms</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Database</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Modules</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.length === 0 && !tenantsQ.isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8 text-sm">
                    No clients yet — create your first one.
                  </TableCell>
                </TableRow>
              )}
              {tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{t.name}</span>
                      <span className="text-xs text-muted-foreground">{t.slug} · {t.currency ?? "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select value={t.plan_tier} onValueChange={(v) => changePlan(t, v)}>
                      <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm">{t.rooms_used}{t.rooms_max ? ` / ${t.rooms_max}` : ""}</TableCell>
                  <TableCell className="text-sm">{t.users_used}{t.users_max ? ` / ${t.users_max}` : ""}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    <div className="flex flex-col gap-0.5">
                      <span>{t.database_name ?? "—"}</span>
                      {t.isolation_mode && (
                        <span className="text-[10px] text-muted-foreground/60">{t.isolation_mode}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {t.provision_status === "active" && (
                      <Badge variant="outline" className="text-green-600 border-green-300 text-xs">Active</Badge>
                    )}
                    {t.provision_status === "running" && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" /> Provisioning
                      </span>
                    )}
                    {t.provision_status === "failed" && (
                      <Badge variant="outline" className="text-red-600 border-red-300 text-xs">Failed</Badge>
                    )}
                    {(!t.provision_status || t.provision_status === "pending") && (
                      <Badge variant="outline" className="text-muted-foreground text-xs">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch checked={t.is_active} onCheckedChange={(v) => toggleActive(t, v)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setModuleTenant(t)}>
                      <Settings2 className="size-3.5" /> Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        form={form}
        setForm={setForm}
        plans={plans}
        submitting={createM.isPending}
        onSubmit={submitCreate}
      />

      {moduleTenant && (
        <ModuleDialog tenant={moduleTenant} onClose={() => setModuleTenant(null)} />
      )}
    </>
  );
}

function CreateDialog({
  open, onOpenChange, form, setForm, plans, submitting, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: typeof blankCreate;
  setForm: (f: typeof blankCreate) => void;
  plans: { id: string; name: string }[];
  submitting: boolean;
  onSubmit: () => void;
}) {
  const set = (k: keyof typeof blankCreate, v: string) => setForm({ ...form, [k]: v });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Building2 className="size-4" /> Provision New Client</DialogTitle>
          <DialogDescription>Creates an isolated hotel tenant with seeded template data. Optionally seed its first admin login.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Client / Hotel name *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Seaside Resort" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="auto from name" />
            </div>
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={form.plan_tier} onValueChange={(v) => set("plan_tier", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Input value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="IN" />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Input value={form.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} maxLength={3} placeholder="USD" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Hotel email</Label>
              <Input type="email" value={form.hotel_email} onChange={(e) => set("hotel_email", e.target.value)} placeholder="hotel@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Hotel phone</Label>
              <Input value={form.hotel_phone} onChange={(e) => set("hotel_phone", e.target.value)} placeholder="+91 98765 43210" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Select value={form.timezone} onValueChange={(v) => set("timezone", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</SelectItem>
                <SelectItem value="America/New_York">America/New_York (EST −5)</SelectItem>
                <SelectItem value="America/Los_Angeles">America/Los_Angeles (PST −8)</SelectItem>
                <SelectItem value="Asia/Dubai">Asia/Dubai (GST +4)</SelectItem>
                <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                <SelectItem value="Asia/Singapore">Asia/Singapore (+8)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="pt-1 border-t mt-1">
            <p className="text-xs text-muted-foreground mt-2 mb-2">Initial admin login (optional)</p>
            <div className="space-y-1.5">
              <Label>Admin email</Label>
              <Input type="email" value={form.admin_email} onChange={(e) => set("admin_email", e.target.value)} placeholder="manager@client.com" />
            </div>
            <div className="space-y-1.5 mt-2">
              <Label>Temp password (min 8)</Label>
              <Input type="text" value={form.admin_password} onChange={(e) => set("admin_password", e.target.value)} placeholder="share securely with client" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={submitting} className="gap-1.5">
            {submitting && <Loader2 className="size-4 animate-spin" />} Provision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModuleDialog({ tenant, onClose }: { tenant: PlatformTenant; onClose: () => void }) {
  const modulesQ = usePlatformTenantModules(tenant.id);
  const updateM = useUpdatePlatformTenantModules();
  const [local, setLocal] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    if (modulesQ.data) setLocal({ ...modulesQ.data.modules });
  }, [modulesQ.data]);

  const registry = modulesQ.data?.registry ?? [];
  const groups = useMemo(() => {
    const g: Record<string, typeof registry> = {};
    for (const m of registry) (g[m.group] ??= []).push(m);
    return g;
  }, [registry]);

  const save = async () => {
    if (!local) return;
    try {
      await updateM.mutateAsync({ id: tenant.id, modules: local });
      toast.success(`Modules updated for ${tenant.name}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update modules");
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Settings2 className="size-4" /> Modules — {tenant.name}</DialogTitle>
          <DialogDescription>Toggle which modules this client can see and access. Off = hidden + route blocked.</DialogDescription>
        </DialogHeader>
        {!local ? (
          <div className="py-8 flex justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="max-h-[55vh] overflow-y-auto pr-1 space-y-4">
            {Object.entries(groups).map(([group, mods]) => (
              <div key={group}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{group}</p>
                <div className="grid grid-cols-2 gap-2">
                  {mods.map((m) => (
                    <label key={m.key} className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm cursor-pointer hover:bg-accent/50">
                      <Checkbox
                        checked={local[m.key] !== false}
                        onCheckedChange={(v) => setLocal((p) => ({ ...(p ?? {}), [m.key]: v === true }))}
                      />
                      <span className="truncate">{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <div className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{local ? Object.values(local).filter((v) => v !== false).length : 0} enabled</Badge>
          </div>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={updateM.isPending || !local} className="gap-1.5">
            {updateM.isPending && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
