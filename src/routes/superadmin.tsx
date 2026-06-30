import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  Building2,
  Users2,
  BedDouble,
  Activity,
  HardDrive,
  Database,
  Gauge,
  Lock,
  GitBranch,
  Plus,
  Settings2,
  Loader2,
  ArrowUpRight,
  CircleDot,
} from "lucide-react";

import { PageHeader, Stat } from "@/components/AppShell";
import { useAuth } from "@/lib/api/auth";
import {
  usePlatformTenants,
  usePlatformPlans,
  useUpdateTenantPlan,
} from "@/lib/api/hooks";
import type { PlatformTenant } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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

export const Route = createFileRoute("/superadmin")({
  head: () => ({ meta: [{ title: "Superadmin Control Center · MHMS" }] }),
  component: Superadmin,
});

// Plan tier display metadata. Mirrors plan_catalog.go (basic/pro/premium).
const PLAN_META: Record<string, { label: string; tone: string }> = {
  basic: { label: "Basic", tone: "bg-muted text-muted-foreground" },
  pro: { label: "Pro", tone: "bg-info/15 text-info" },
  premium: { label: "Premium", tone: "bg-primary/15 text-primary" },
};

// The existing live hmsadmin deployment runs on the demo/default tenant. It is
// the platform's founding tenant, so it is pinned and surfaced as "Client 1".
const PRIMARY_TENANT_ID = "00000000-0000-0000-0000-000000000001";

// orderTenants returns tenants with the primary (existing hmsadmin) first, then
// the rest oldest-first, so the displayed "Client N" numbering is stable and the
// founding hotel always reads as Client 1.
function orderTenants(tenants: PlatformTenant[]): PlatformTenant[] {
  return [...tenants].sort((a, b) => {
    if (a.id === PRIMARY_TENANT_ID) return -1;
    if (b.id === PRIMARY_TENANT_ID) return 1;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
}

function Superadmin() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);

  // Hard gate: only the platform super-admin may view this portal.
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    setChecked(true);
    if (user && !user.platform_admin) navigate({ to: "/" });
  }, [user, navigate]);

  const tenantsQ = usePlatformTenants();
  const tenants = tenantsQ.data ?? [];

  if (!checked || (user && !user.platform_admin)) return null;

  return (
    <>
      <PageHeader
        title="Superadmin Control Center"
        description="Platform operations — fleet health, client lifecycle, plans, access, backups, monitoring & security across every tenant."
        actions={
          <Button asChild className="gap-1.5">
            <Link to="/master">
              <Plus className="size-4" /> New Client
            </Link>
          </Button>
        }
      />

      <FleetStats tenants={tenants} loading={tenantsQ.isLoading} />

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview" className="gap-1.5"><Activity className="size-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="clients" className="gap-1.5"><Building2 className="size-3.5" /> Clients</TabsTrigger>
          <TabsTrigger value="access" className="gap-1.5"><Users2 className="size-3.5" /> Role-Feature Matrix</TabsTrigger>
          <TabsTrigger value="backups" className="gap-1.5"><HardDrive className="size-3.5" /> Backups</TabsTrigger>
          <TabsTrigger value="monitoring" className="gap-1.5"><Gauge className="size-3.5" /> Monitoring</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5"><Lock className="size-3.5" /> Security</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab tenants={tenants} loading={tenantsQ.isLoading} />
        </TabsContent>
        <TabsContent value="clients" className="mt-4">
          <ClientsTab tenants={tenants} loading={tenantsQ.isLoading} />
        </TabsContent>
        <TabsContent value="access" className="mt-4">
          <FeatureMatrixTab />
        </TabsContent>
        <TabsContent value="backups" className="mt-4">
          <BackupsTab tenants={tenants} />
        </TabsContent>
        <TabsContent value="monitoring" className="mt-4">
          <MonitoringTab />
        </TabsContent>
        <TabsContent value="security" className="mt-4">
          <SecurityTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

// ---------------------------------------------------------------------------
// Fleet-wide KPI strip — computed from live platform data.
// ---------------------------------------------------------------------------
function FleetStats({ tenants, loading }: { tenants: PlatformTenant[]; loading: boolean }) {
  const s = useMemo(() => {
    const active = tenants.filter((t) => t.is_active).length;
    const rooms = tenants.reduce((n, t) => n + (t.rooms_used || 0), 0);
    const users = tenants.reduce((n, t) => n + (t.users_used || 0), 0);
    const premium = tenants.filter((t) => t.plan_tier === "premium").length;
    return { total: tenants.length, active, suspended: tenants.length - active, rooms, users, premium };
  }, [tenants]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
      <Stat label="Clients" value={loading ? "—" : s.total} hint={`${s.active} active · ${s.suspended} suspended`} />
      <Stat label="Active" value={loading ? "—" : s.active} tone="success" />
      <Stat label="Suspended" value={loading ? "—" : s.suspended} tone={s.suspended ? "warning" : undefined} />
      <Stat label="Rooms Managed" value={loading ? "—" : s.rooms} />
      <Stat label="Staff Seats" value={loading ? "—" : s.users} />
      <Stat label="Premium Clients" value={loading ? "—" : s.premium} tone="info" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview — plan distribution + capacity utilisation, all from real data.
// ---------------------------------------------------------------------------
function OverviewTab({ tenants, loading }: { tenants: PlatformTenant[]; loading: boolean }) {
  const dist = useMemo(() => {
    const d: Record<string, number> = { basic: 0, pro: 0, premium: 0 };
    for (const t of tenants) d[t.plan_tier] = (d[t.plan_tier] ?? 0) + 1;
    return d;
  }, [tenants]);
  const max = Math.max(1, ...Object.values(dist));

  // Tenants nearing their plan ceilings (>=80% of rooms or users).
  const nearLimit = useMemo(
    () =>
      tenants.filter((t) => {
        const r = t.rooms_max ? t.rooms_used / t.rooms_max : 0;
        const u = t.users_max ? t.users_used / t.users_max : 0;
        return Math.max(r, u) >= 0.8;
      }),
    [tenants],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel title="Plan Distribution" icon={<GitBranch className="size-4 text-primary" />}>
        {loading ? (
          <Spinner />
        ) : (
          <div className="space-y-3">
            {(["basic", "pro", "premium"] as const).map((p) => (
              <div key={p}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${PLAN_META[p].tone}`}>{PLAN_META[p].label}</span>
                  </span>
                  <span className="text-muted-foreground">{dist[p] ?? 0} clients</span>
                </div>
                <Progress value={((dist[p] ?? 0) / max) * 100} className="h-2" />
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Approaching Plan Limits" icon={<Gauge className="size-4 text-warning-foreground" />}>
        {loading ? (
          <Spinner />
        ) : nearLimit.length === 0 ? (
          <Empty text="All clients comfortably within their plan limits." />
        ) : (
          <div className="space-y-2.5">
            {nearLimit.map((t) => {
              const rPct = t.rooms_max ? Math.round((t.rooms_used / t.rooms_max) * 100) : 0;
              const uPct = t.users_max ? Math.round((t.users_used / t.users_max) * 100) : 0;
              const pct = Math.max(rPct, uPct);
              return (
                <div key={t.id} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-32 truncate">{t.name}</span>
                  <Progress value={pct} className="h-2 flex-1" />
                  <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Infrastructure Snapshot" icon={<Database className="size-4 text-info" />} className="lg:col-span-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <MiniStat label="Isolated Databases" value={loading ? "—" : tenants.filter((t) => t.database_name).length} />
          <MiniStat label="Shared-mode Tenants" value={loading ? "—" : tenants.filter((t) => !t.database_name).length} />
          <MiniStat label="Redis Namespaces" value={loading ? "—" : tenants.length} hint="t:{id}:*" />
          <MiniStat label="DNS" value="superadminhms" hint="172.105.41.151" />
        </div>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clients — lifecycle table (plan change + suspend) wired to live endpoints.
// ---------------------------------------------------------------------------
function ClientsTab({ tenants, loading }: { tenants: PlatformTenant[]; loading: boolean }) {
  const plansQ = usePlatformPlans();
  const updatePlanM = useUpdateTenantPlan();
  const plans = plansQ.data ?? [];
  const ordered = useMemo(() => orderTenants(tenants), [tenants]);

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
    <Panel
      title="Client Tenants"
      icon={<ShieldCheck className="size-4 text-primary" />}
      action={
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link to="/master"><Settings2 className="size-3.5" /> Full manager</Link>
        </Button>
      }
    >
      <div className="overflow-x-auto -mx-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">#</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Rooms</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Database</TableHead>
              <TableHead className="text-right">Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={7} className="text-center py-8"><Spinner /></TableCell></TableRow>
            )}
            {!loading && ordered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">No clients yet.</TableCell></TableRow>
            )}
            {ordered.map((t, i) => {
              const isPrimary = t.id === PRIMARY_TENANT_ID;
              return (
              <TableRow key={t.id} className={isPrimary ? "bg-primary/5" : undefined}>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium tabular-nums">Client {i + 1}</span>
                    {isPrimary && <Badge variant="secondary" className="text-[10px] w-fit">Primary · hmsadmin</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs text-muted-foreground">{t.slug} · {t.currency ?? "—"}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Select value={t.plan_tier} onValueChange={(v) => changePlan(t, v)}>
                    <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-sm">{t.rooms_used}{t.rooms_max ? ` / ${t.rooms_max}` : ""}</TableCell>
                <TableCell className="text-sm">{t.users_used}{t.users_max ? ` / ${t.users_max}` : ""}</TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">{t.database_name ?? "shared"}</TableCell>
                <TableCell className="text-right">
                  <Switch checked={t.is_active} onCheckedChange={(v) => toggleActive(t, v)} />
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// The three new surfaces below render their full intended layout and clearly
// indicate the backend phase that activates live data, so the dashboard is
// complete and ready to wire (see hms_superadmin_build_plan.md).
// ---------------------------------------------------------------------------
function FeatureMatrixTab() {
  return (
    <Panel title="Role-Feature Matrix" icon={<Users2 className="size-4 text-primary" />} action={<PhaseBadge phase="2" />}>
      <p className="text-sm text-muted-foreground mb-4">
        Per-client <span className="font-medium text-foreground">client × role × feature</span> access. Plan sets the
        ceiling; this matrix sets what each role on each client can actually see — fully independent per client.
      </p>
      <div className="rounded-lg border overflow-hidden">
        <div className="grid grid-cols-4 text-xs font-medium bg-muted/50 px-3 py-2">
          <span>Feature</span>
          <span className="text-center">Client A · receptionist</span>
          <span className="text-center">Client B · receptionist</span>
          <span className="text-center">Enforced by</span>
        </div>
        {[
          ["Dashboard", true, true],
          ["Rooms", true, true],
          ["Reservations", true, true],
          ["Billing", false, true],
          ["CRM", false, true],
          ["POS", false, true],
        ].map(([f, a, b]) => (
          <div key={f as string} className="grid grid-cols-4 px-3 py-2 text-sm border-t items-center">
            <span>{f as string}</span>
            <span className="text-center">{a ? "✓" : "✗"}</span>
            <span className="text-center">{b ? "✓" : "✗"}</span>
            <span className="text-center text-xs text-muted-foreground font-mono">featureMatrixGate</span>
          </div>
        ))}
      </div>
      <NextStep text="Wire migration 014_client_role_permissions + featureMatrixGate, then GET/PUT /superadmin/clients/:id/feature-matrix." />
    </Panel>
  );
}

function BackupsTab({ tenants }: { tenants: PlatformTenant[] }) {
  const destinations = ["Google Drive", "Supabase", "AWS S3", "Cloudflare R2", "Azure Blob", "Dropbox", "Mega", "Backblaze B2", "FTP", "SFTP", "NAS", "MinIO", "Local"];
  return (
    <div className="space-y-4">
      <Panel title="Backup Center" icon={<HardDrive className="size-4 text-success" />} action={<PhaseBadge phase="4" />}>
        <p className="text-sm text-muted-foreground mb-4">
          Per-client schedule → <span className="font-mono text-xs">pg_dump + Redis snapshot → compress → encrypt → verify → upload</span>,
          with retention, retry &amp; notifications. Nothing hardcoded — every client configures its own cadence and destination.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {["Snapshot/Restore", "Compression", "Encryption", "Verification", "Retention", "Cron schedule", "Retry failed", "Notifications"].map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm rounded-md border px-2.5 py-1.5">
              <CircleDot className="size-3 text-muted-foreground" /> {f}
            </div>
          ))}
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Storage destinations</p>
        <div className="flex flex-wrap gap-1.5">
          {destinations.map((d) => <Badge key={d} variant="secondary">{d}</Badge>)}
        </div>
      </Panel>
      <Panel title="Per-Client Backup Status" icon={<Database className="size-4 text-info" />}>
        <Table>
          <TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Schedule</TableHead><TableHead>Destination</TableHead><TableHead>Last backup</TableHead><TableHead className="text-right">Enabled</TableHead></TableRow></TableHeader>
          <TableBody>
            {orderTenants(tenants).slice(0, 6).map((t, i) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">
                  <span className="text-muted-foreground tabular-nums mr-2">#{i + 1}</span>{t.name}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">— not configured</TableCell>
                <TableCell className="text-muted-foreground text-sm">—</TableCell>
                <TableCell className="text-muted-foreground text-sm">—</TableCell>
                <TableCell className="text-right"><Switch disabled /></TableCell>
              </TableRow>
            ))}
            {tenants.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">No clients.</TableCell></TableRow>}
          </TableBody>
        </Table>
        <NextStep text="Wire migration 016_backup (backup_configurations/jobs/storage_destinations) + StorageDriver interface + cron scheduler." />
      </Panel>
    </div>
  );
}

function MonitoringTab() {
  const metrics = ["CPU", "RAM", "Disk", "Redis", "PostgreSQL", "API", "Workers", "Cron Jobs", "Queues", "Storage", "Bandwidth", "DB Connections", "Slow Queries", "Error Rate", "Uptime", "SSL", "Response Time", "Alerts"];
  return (
    <Panel title="Live Monitoring" icon={<Gauge className="size-4 text-info" />} action={<PhaseBadge phase="5" />}>
      <p className="text-sm text-muted-foreground mb-4">
        Real-time platform health with per-client dimensions and configurable alert thresholds. Builds on the existing
        OpenTelemetry metrics and <span className="font-mono text-xs">/health · /ready</span> probes.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {metrics.map((m) => (
          <div key={m} className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">{m}</div>
            <div className="text-lg font-semibold font-display flex items-center gap-1.5 text-muted-foreground/60">
              <CircleDot className="size-3" /> —
            </div>
          </div>
        ))}
      </div>
      <NextStep text="Wire OTel → Prometheus/Grafana + GET /superadmin/monitoring & /superadmin/analytics + alert rules." />
    </Panel>
  );
}

function SecurityTab() {
  const live = ["JWT (access 15m / refresh 168h)", "bcrypt cost 12", "Per-client rate limiting", "Per-IP DoS guard (240/min)", "CORS allow-list"];
  const planned = ["2FA / MFA (TOTP)", "Refresh-token rotation", "Password policy", "IP whitelist (per client)", "Session & device mgmt", "CAPTCHA", "CSRF", "XSS hardening", "SQLi sweep", "Secret rotation", "Vault integration", "Encryption at rest", "Threat detection", "Audit log (all admin actions)"];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel title="Active Controls" icon={<ShieldCheck className="size-4 text-success" />}>
        <div className="space-y-2">
          {live.map((s) => (
            <div key={s} className="flex items-center gap-2 text-sm"><CircleDot className="size-3 text-success" /> {s}</div>
          ))}
        </div>
      </Panel>
      <Panel title="Hardening Roadmap" icon={<Lock className="size-4 text-warning-foreground" />} action={<PhaseBadge phase="6" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {planned.map((s) => (
            <div key={s} className="flex items-center gap-2 text-sm text-muted-foreground"><CircleDot className="size-3" /> {s}</div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers.
// ---------------------------------------------------------------------------
function Panel({
  title, icon, action, children, className = "",
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-card border rounded-lg ${className}`}>
      <div className="px-4 py-3 border-b flex items-center gap-2">
        {icon}
        <span className="font-medium text-sm">{title}</span>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold font-display mt-0.5">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{hint}</div>}
    </div>
  );
}

function PhaseBadge({ phase }: { phase: string }) {
  return (
    <Badge variant="outline" className="gap-1 text-[11px]">
      <ArrowUpRight className="size-3" /> Build plan · Phase {phase}
    </Badge>
  );
}

function Spinner() {
  return <div className="py-6 flex justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
}
function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-4 text-center">{text}</p>;
}
function NextStep({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-md bg-muted/40 border border-dashed px-3 py-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Next:</span> {text}
    </div>
  );
}
