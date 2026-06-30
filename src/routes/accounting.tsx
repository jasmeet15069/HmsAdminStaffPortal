import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calculator, BookOpen, FileText, Package, Receipt, ListOrdered } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/accounting")({ component: AccountingPage });

const sections = [
  { key: "coa", label: "Chart of Accounts", icon: BookOpen },
  { key: "invoices", label: "Sales Invoices", icon: FileText },
  { key: "cn", label: "Credit Notes", icon: Receipt },
  { key: "po", label: "Purchase Orders", icon: Package },
  { key: "grn", label: "Goods Receipt Notes", icon: ListOrdered },
  { key: "journals", label: "Journal Entries", icon: Calculator },
];

function AccountingPage() {
  const [tab, setTab] = useState("coa");

  return (
    <div className="space-y-6">
      <PageHeader title="Accounting" subtitle="Full-cycle financial management — invoices, POs, GRN, and journals" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          {sections.map((s) => (
            <TabsTrigger key={s.key} value={s.key} className="gap-1.5">
              <s.icon className="size-3.5" /> {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="coa" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Chart of Accounts</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">Manage your chart of accounts — asset, liability, equity, income, and expense accounts.</p>
              <Button className="mt-4" variant="outline" disabled>View Accounts</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Sales Invoices</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">Create and manage sales invoices, post, cancel, and issue credit notes.</p>
              <Button className="mt-4" variant="outline" disabled>Coming Soon</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cn" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Credit Notes</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">Issue credit notes against posted invoices.</p>
              <Button className="mt-4" variant="outline" disabled>Coming Soon</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="po" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Purchase Orders</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">Create and approve purchase orders.</p>
              <Button className="mt-4" variant="outline" disabled>Coming Soon</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grn" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Goods Receipt Notes</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">Record goods received against purchase orders.</p>
              <Button className="mt-4" variant="outline" disabled>Coming Soon</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="journals" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Journal Entries</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">Double-entry journal with debit/credit validation.</p>
              <Button className="mt-4" variant="outline" disabled>Coming Soon</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
