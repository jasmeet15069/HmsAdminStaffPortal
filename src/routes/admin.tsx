import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useMHMS } from "@/lib/mhms-store";
import { toast } from "sonner";
import { Database, Mail, ShieldCheck, Webhook } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "System Administration · MHMS" }] }),
  component: Admin,
});

function Admin() {
  const { resetData } = useMHMS();
  return (
    <>
      <PageHeader title="System Administration" description="Configuration, integrations, audit logs" />
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="tax">Tax & Currency</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="p-5 mt-4 max-w-2xl space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Organization name</Label><Input defaultValue="Azure Hospitality Group" className="mt-1" /></div>
              <div><Label>GSTIN</Label><Input defaultValue="27AABCA1234X1Z5" className="mt-1" /></div>
              <div><Label>Default language</Label><Input defaultValue="English (India)" className="mt-1" /></div>
              <div><Label>Time zone</Label><Input defaultValue="Asia/Kolkata (IST)" className="mt-1" /></div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <div><div className="font-medium">Two-factor authentication</div><div className="text-xs text-muted-foreground">Required for Admin & Accounts roles</div></div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between"><div><div className="font-medium">Email guest receipts automatically</div></div><Switch defaultChecked /></div>
            <Button onClick={() => toast.success("Settings saved")}>Save changes</Button>
          </Card>
        </TabsContent>

        <TabsContent value="tax">
          <Card className="p-5 mt-4 max-w-2xl space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Currency</Label><Input defaultValue="INR (₹)" className="mt-1" /></div>
              <div><Label>GST rate</Label><Input defaultValue="18%" className="mt-1" /></div>
              <div><Label>Luxury cess</Label><Input defaultValue="0%" className="mt-1" /></div>
            </div>
            <Button onClick={() => toast.success("Tax settings updated")}>Save</Button>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {[
              { name: "Stripe Payments", icon: ShieldCheck, status: true },
              { name: "Razorpay", icon: ShieldCheck, status: true },
              { name: "SMTP / Email", icon: Mail, status: true },
              { name: "Webhook Listener", icon: Webhook, status: false },
              { name: "Backup Service", icon: Database, status: true },
            ].map(i => {
              const Icon = i.icon;
              return (
                <Card key={i.name} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="size-5 text-primary" />
                    <div><div className="font-medium">{i.name}</div><div className="text-xs text-muted-foreground">{i.status ? "Connected" : "Not configured"}</div></div>
                  </div>
                  <Switch defaultChecked={i.status} onCheckedChange={() => toast.success(`${i.name} toggled`)} />
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="p-4 mt-4">
            <div className="space-y-2 text-sm">
              {[
                { who: "Sarah Manager", what: "Updated rate plan 'Weekend +10%'", when: "2 min ago" },
                { who: "Dev Front Desk", what: "Checked in RES2014", when: "12 min ago" },
                { who: "Admin User", what: "Added new user Raj Accounts", when: "1 hour ago" },
                { who: "Sunita HK", what: "Completed task 304-Clean", when: "2 hours ago" },
                { who: "System", what: "Night audit completed (2026-06-13)", when: "8 hours ago" },
              ].map((l, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div><span className="font-medium">{l.who}</span> · {l.what}</div>
                  <Badge variant="outline">{l.when}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="data">
          <Card className="p-5 mt-4 max-w-xl space-y-3">
            <div><div className="font-medium">Reset demo data</div><div className="text-sm text-muted-foreground">Restore all modules to original seed data. Useful for demos.</div></div>
            <Button variant="destructive" onClick={() => { resetData(); toast.success("All demo data reset"); }}>Reset all data</Button>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
