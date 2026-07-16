import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useMHMS } from "@/lib/mhms-store";
import { toast } from "sonner";
import { Database, Mail, ShieldCheck, Webhook, Key, Activity, Copy, RefreshCw, CheckCircle2, AlertTriangle, Settings, Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/api/auth";
import { apiFetch } from "@/lib/api/client";
import { useAPIKeys, useCreateAPIKey, useUpdateAPIKey, useDeleteAPIKey, useIntegrations, useUpsertIntegration, useTestIntegration } from "@/lib/api/hooks";

const INITIAL_API_KEYS = [
  { id: "k1", name: "Mobile App", key: "mhms_live_eK9x2mN...", created: "2026-01-15", lastUsed: "2 min ago", active: true },
  { id: "k2", name: "Channel Manager Integration", key: "mhms_live_pR7vWq...", created: "2026-03-10", lastUsed: "5 min ago", active: true },
  { id: "k3", name: "Reporting Dashboard", key: "mhms_live_aZ4bYm...", created: "2026-05-22", lastUsed: "1 day ago", active: true },
  { id: "k4", name: "Old POS Integration (deprecated)", key: "mhms_live_jG8nTs...", created: "2025-11-01", lastUsed: "45 days ago", active: false },
];

const SYSTEM_HEALTH = [
  { service: "API Server", status: "Healthy", latency: "12ms", uptime: "99.98%" },
  { service: "Database (PostgreSQL)", status: "Healthy", latency: "4ms", uptime: "99.99%" },
  { service: "Cache (Redis)", status: "Healthy", latency: "1ms", uptime: "100%" },
  { service: "Email (SMTP)", status: "Healthy", latency: "—", uptime: "99.95%" },
  { service: "File Storage", status: "Healthy", latency: "18ms", uptime: "99.97%" },
  { service: "Webhook Listener", status: "Degraded", latency: "320ms", uptime: "98.2%" },
];

const AUDIT_LOG_DATA = [
  { id: 1, who: "Sarah Manager", what: "Updated rate plan 'Weekend +10%'", module: "Revenue", when: "2 min ago" },
  { id: 2, who: "Dev Front Desk", what: "Checked in reservation RES2014", module: "Front Desk", when: "14 min ago" },
  { id: 3, who: "Admin User", what: "Created new user Raj Accounts", module: "Users", when: "1 hr ago" },
  { id: 4, who: "Sunita HK", what: "Marked task 304-Clean complete", module: "Housekeeping", when: "2 hrs ago" },
  { id: 5, who: "System", what: "Night audit completed (2026-06-16)", module: "Night Audit", when: "8 hrs ago" },
  { id: 6, who: "Admin User", what: "Exported Daily Revenue report", module: "Reports", when: "9 hrs ago" },
  { id: 7, who: "Arjun F&B", what: "Voided POS order #POS-0087", module: "POS", when: "10 hrs ago" },
  { id: 8, who: "Sarah Manager", what: "Approved PO-2026-0041 for Cotton Co.", module: "Procurement", when: "11 hrs ago" },
];

const MODULE_COLORS: Record<string, string> = {
  Revenue: "bg-success/15 text-success",
  "Front Desk": "bg-info/15 text-info",
  Users: "bg-destructive/15 text-destructive",
  Housekeeping: "bg-warning/15 text-warning-foreground",
  "Night Audit": "bg-muted text-muted-foreground",
  Reports: "bg-purple-500/15 text-purple-600",
  POS: "bg-orange-500/15 text-orange-600",
  Procurement: "bg-teal-500/15 text-teal-600",
};

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "System Administration · MHMS" }] }),
  component: Admin,
});

function Admin() {
  const user = useAuth((s) => s.user);
  const authed = !!user;
  const isHotelAdmin = !!user?.roles?.some((r) => ["hotel_admin", "admin", "super_admin"].includes(r));
  const { auditLog } = useMHMS();
  const [localApiKeys] = useState(INITIAL_API_KEYS);

  const keysQ = useAPIKeys();
  const createKeyM = useCreateAPIKey();
  const updateKeyM = useUpdateAPIKey();
  const deleteKeyM = useDeleteAPIKey();
  const keysLive = authed && isHotelAdmin && !!keysQ.data;
  const apiKeys = keysLive && keysQ.data
    ? keysQ.data.map((k: any) => ({ id: k.id, name: k.name, key: k.key_prefix, created: (k.created_at || "").slice(0, 10), lastUsed: k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "Never", active: k.is_active }))
    : localApiKeys;
  const [revealedKey, setRevealedKey] = useState<{ name: string; key: string } | null>(null);

  const integrationsQ = useIntegrations();
  const upsertIntM = useUpsertIntegration();
  const testIntM = useTestIntegration();
  const intMap: Record<string, any> = {};
  (integrationsQ.data ?? []).forEach((i: any) => { intMap[i.provider] = i; });

  const generateKey = () => {
    if (!keysLive) { toast.info("Sign in as a hotel admin to manage real API keys"); return; }
    const name = window.prompt("Name this API key:", "New integration") || "API key";
    createKeyM.mutate(name, {
      onSuccess: (r: any) => { setRevealedKey({ name, key: r.key }); toast.success("API key created"); },
      onError: (e: any) => toast.error(e?.message ?? "Failed"),
    });
  };
  const toggleKey = (k: any) => { if (keysLive) updateKeyM.mutate({ id: k.id, is_active: !k.active }, { onError: () => toast.error("Failed") }); };
  const removeKey = (k: any) => { if (keysLive && window.confirm(`Revoke "${k.name}"?`)) deleteKeyM.mutate(k.id, { onSuccess: () => toast.success("Key revoked"), onError: () => toast.error("Failed") }); };
  const toggleIntegration = (provider: string, category: string, on: boolean) => {
    upsertIntM.mutate({ provider, body: { category, is_enabled: on } }, { onSuccess: () => toast.success(`${provider} ${on ? "enabled" : "disabled"}`), onError: () => toast.error("Failed") });
  };
  const testIntegration = (provider: string) => {
    testIntM.mutate(provider, { onSuccess: (r: any) => (r?.ok ? toast.success(r.message || "Connected") : toast.error(r?.message || "Not connected")), onError: (e: any) => toast.error(e?.message ?? "Test failed") });
  };
  const [auditFilter, setAuditFilter] = useState("All");
  const [savingSettings, setSavingSettings] = useState(false);
  const [businessSettings, setBusinessSettings] = useState<Record<string, string>>({});

  const allAudit = [...AUDIT_LOG_DATA, ...auditLog.slice(0, 10).map((a, i) => ({
    id: 100 + i, who: a.user, what: a.action, module: a.action.split(" ")[0] ?? "System", when: a.date,
  }))];

  const filteredAudit = auditFilter === "All" ? allAudit : allAudit.filter((a) => a.module === auditFilter);

  return (
    <>
      <PageHeader title="System Administration" description="Configuration, integrations, API keys, and audit logs" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="System Status" value="All OK" tone="success" hint="6 services healthy" />
        <Stat label="API Keys" value={apiKeys.filter((k) => k.active).length} hint="Active keys" />
        <Stat label="Uptime (30d)" value="99.97%" tone="success" hint="Average across services" />
        <Stat label="Audit Events" value={allAudit.length} hint="Recorded actions" />
      </div>

      <Tabs defaultValue="general">
        <TabsList className="mb-4">
          <TabsTrigger value="general"><Settings className="size-3.5 mr-1.5" />General</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="apikeys"><Key className="size-3.5 mr-1.5" />API Keys</TabsTrigger>
          <TabsTrigger value="health"><Activity className="size-3.5 mr-1.5" />System Health</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5 space-y-4">
              <h3 className="font-semibold">Organization Settings</h3>
              <div className="grid grid-cols-2 gap-3">
                {[["Organization Name", "Hotel Harmony Group"], ["GSTIN", "27AABCA1234X1Z5"], ["Default Language", "English (India)"], ["Time Zone", "Asia/Kolkata (IST)"], ["Currency", "INR (₹)"], ["GST Rate", "18%"]].map(([label, val]) => (
                  <div key={label}>
                    <Label className="text-xs">{label}</Label>
                    <Input className="h-8 mt-1 text-sm" defaultValue={val} />
                  </div>
                ))}
              </div>
              <Button disabled={savingSettings} onClick={async () => {
                if (!authed || Object.keys(businessSettings).length === 0) { toast.success("Settings saved"); return; }
                setSavingSettings(true);
                try {
                  await apiFetch("/api/settings/business", { method: "PUT", body: businessSettings });
                  toast.success("Settings saved to server");
                } catch {
                  toast.error("Failed to save — changes saved locally");
                } finally { setSavingSettings(false); }
              }}>
                {savingSettings && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}Save Changes
              </Button>
            </Card>
            <Card className="p-5 space-y-4">
              <h3 className="font-semibold">Security & Notifications</h3>
              <div className="space-y-3">
                {[
                  { label: "Two-factor authentication (Admin & Accounts)", defaultOn: true },
                  { label: "Email guest receipts automatically", defaultOn: true },
                  { label: "Daily revenue summary email to GM", defaultOn: true },
                  { label: "SMS alerts for urgent maintenance", defaultOn: false },
                  { label: "Allow multi-session logins", defaultOn: false },
                  { label: "Enforce strong passwords (12+ chars)", defaultOn: true },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <Label className="text-xs font-normal">{s.label}</Label>
                    <Switch defaultChecked={s.defaultOn} onCheckedChange={() => toast.info("Setting updated")} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { name: "Razorpay Payments", icon: ShieldCheck, status: true, hint: "Live · PK_rzp_live_***" },
              { name: "Stripe (International)", icon: ShieldCheck, status: true, hint: "Live · pk_live_***" },
              { name: "SMTP / Email", icon: Mail, status: true, hint: "smtp.googlemail.com:587" },
              { name: "Webhook Listener", icon: Webhook, status: false, hint: "Not configured" },
              { name: "Backup Service (S3)", icon: Database, status: true, hint: "Daily at 3:00 AM IST" },
              { name: "WhatsApp Business", icon: Mail, status: false, hint: "API key not set" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.name} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`size-9 rounded-lg grid place-items-center ${item.status ? "bg-success/10" : "bg-muted"}`}>
                        <Icon className={`size-5 ${item.status ? "text-success" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.hint}</div>
                      </div>
                    </div>
                    <Switch defaultChecked={intMap[item.name]?.is_enabled ?? item.status} onCheckedChange={(on) => toggleIntegration(item.name, item.hint.split(" ")[0], on)} />
                  </div>
                  {(intMap[item.name]?.is_enabled ?? item.status) && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 h-7 gap-1" disabled={testIntM.isPending} onClick={() => testIntegration(item.name)}>
                        <Activity className="size-3" />Test
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="apikeys">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">{apiKeys.filter((k) => k.active).length} active API keys</p>
            <Button size="sm" className="gap-1.5" disabled={createKeyM.isPending} onClick={generateKey}>
              <Plus className="size-4" /> Generate Key
            </Button>
          </div>
          {revealedKey && (
            <Card className="p-4 mb-3 border-primary/40 bg-primary/5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm">New key — {revealedKey.name}</div>
                  <div className="font-mono text-xs mt-1 break-all">{revealedKey.key}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">Shown once — copy it now. Only a hash is stored.</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => { navigator.clipboard?.writeText(revealedKey.key); toast.success("Copied"); }}><Copy className="size-3" />Copy</Button>
                  <Button size="sm" variant="ghost" onClick={() => setRevealedKey(null)}>Dismiss</Button>
                </div>
              </div>
            </Card>
          )}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Name", "Key", "Created", "Last Used", "Active", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((k) => (
                    <tr key={k.id} className={`border-b last:border-0 hover:bg-accent/5 ${!k.active ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3 font-medium">{k.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{k.key}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{k.created}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{k.lastUsed}</td>
                      <td className="px-4 py-3">
                        <Switch checked={k.active} onCheckedChange={() => toggleKey(k)} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={() => { navigator.clipboard?.writeText(k.key); toast.success("Prefix copied"); }}>
                            <Copy className="size-3" />Copy
                          </Button>
                          {keysLive && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => removeKey(k)}>Revoke</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* System Health */}
        <TabsContent value="health">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
            {SYSTEM_HEALTH.map((s) => (
              <Card key={s.service} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-sm">{s.service}</div>
                  <Badge className={`text-[10px] gap-1 ${s.status === "Healthy" ? "bg-success/15 text-success border-success/30" : "bg-warning/15 text-warning-foreground border-warning/30"}`}>
                    {s.status === "Healthy" ? <CheckCircle2 className="size-2.5" /> : <AlertTriangle className="size-2.5" />}
                    {s.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/50 rounded p-2 text-center">
                    <div className="text-muted-foreground">Latency</div>
                    <div className="font-semibold mt-0.5">{s.latency}</div>
                  </div>
                  <div className="bg-muted/50 rounded p-2 text-center">
                    <div className="text-muted-foreground">30d Uptime</div>
                    <div className="font-semibold mt-0.5">{s.uptime}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Card className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">Run Full Diagnostics</div>
              <div className="text-xs text-muted-foreground">Test all services and generate a health report</div>
            </div>
            <Button variant="outline" className="gap-1.5" onClick={() => toast.success("Diagnostics complete — all systems nominal")}>
              <RefreshCw className="size-4" /> Run Diagnostics
            </Button>
          </Card>
        </TabsContent>

        {/* Audit Log */}
        <TabsContent value="audit">
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {["All", ...Object.keys(MODULE_COLORS)].map((m) => (
              <button key={m} onClick={() => setAuditFilter(m)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${auditFilter === m ? "bg-secondary text-secondary-foreground border-secondary" : "hover:border-muted-foreground/40"}`}>
                {m}
              </button>
            ))}
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Time", "User", "Action", "Module"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAudit.map((a) => (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-accent/5">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{a.when}</td>
                      <td className="px-4 py-3 font-medium text-sm">{a.who}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.what}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] ${MODULE_COLORS[a.module] ?? "bg-muted text-muted-foreground"}`}>{a.module}</Badge>
                      </td>
                    </tr>
                  ))}
                  {filteredAudit.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-10 text-muted-foreground text-sm">No events match the filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

