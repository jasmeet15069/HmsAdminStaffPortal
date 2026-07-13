import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FileText, Receipt, Package, ListOrdered, Calculator, BookOpen, Users, Building2, Loader2, Eye, CheckCircle2, XCircle, Ban, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount,
  useCustomers, useCreateCustomer, useUpdateCustomer,
  useVendors, useCreateVendor, useUpdateVendor,
  useSalesInvoices, useGetSalesInvoice, useCreateSalesInvoice, usePostSalesInvoice, useCancelSalesInvoice, useCreateCreditNoteFromInvoice,
  useCreditNotes, useCreateCreditNote, usePostCreditNote,
  useDebitNotes, useCreateDebitNote, usePostDebitNote,
  usePurchaseOrders, useCreatePurchaseOrder, useApprovePurchaseOrder,
  useGRN, useCreateGRN, usePostGRN,
  useJournalEntries, useGetJournalEntry, useCreateJournalEntry,
  useTrialBalance,
  type Account, type Customer, type Vendor, type SalesInvoice,
  type CreditNote, type DebitNote, type PurchaseOrder, type GRN,
  type JournalEntry, type JournalEntryDetail, type TrialBalanceRow,
} from "@/lib/api/accounting-hooks";

export const Route = createFileRoute("/accounting")({
  component: AccountingPage,
  head: () => ({ meta: [{ title: "Accounting · MHMS" }] }),
});

const fmtCurr = (n: number) => (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const cap = (s: string) => s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : s;
const fmtDate = (d: string | null | undefined) => d ? new Date(d + (d.includes("T") ? "" : "T00:00:00")).toLocaleDateString("en-CA") : "—";

const STATUS_META: Record<string, { color: string }> = {
  draft: { color: "bg-muted text-muted-foreground" },
  posted: { color: "bg-success/15 text-success border-success/30" },
  cancelled: { color: "bg-destructive/15 text-destructive" },
  approved: { color: "bg-info/15 text-info border-info/30" },
  received: { color: "bg-success/15 text-success border-success/30" },
};

const ACCOUNT_TYPES = ["asset", "liability", "equity", "income", "expense"];
const TAX_RATES = ["0", "5", "12", "18", "28"];

function AccountingPage() {
  const [tab, setTab] = useState("coa");

  const coaQ = useAccounts();
  const accounts = coaQ.data ?? [];

  const customersQ = useCustomers();
  const customers = customersQ.data ?? [];

  const vendorsQ = useVendors();
  const vendors = vendorsQ.data ?? [];

  const invQ = useSalesInvoices();
  const invoices = invQ.data ?? [];

  const cnQ = useCreditNotes();
  const creditNotes = cnQ.data ?? [];

  const dnQ = useDebitNotes();
  const debitNotes = dnQ.data ?? [];

  const poQ = usePurchaseOrders();
  const pos = poQ.data ?? [];

  const grnQ = useGRN();
  const grns = grnQ.data ?? [];

  const journalQ = useJournalEntries();
  const journals = journalQ.data ?? [];

  const tbQ = useTrialBalance();
  const tbData = tbQ.data ?? [];

  const totalSales = invoices.filter((i) => i.status === "posted").reduce((s, i) => s + i.total, 0);
  const openPOs = pos.filter((p) => p.status === "draft").length;
  const postedJournals = journals.length;

  const sections = [
    { key: "coa", label: "Chart of Accounts", icon: BookOpen },
    { key: "customers", label: "Customers", icon: Users },
    { key: "vendors", label: "Vendors", icon: Building2 },
    { key: "invoices", label: "Sales Invoices", icon: FileText },
    { key: "credit-notes", label: "Credit Notes", icon: Receipt },
    { key: "debit-notes", label: "Debit Notes", icon: Ban },
    { key: "po", label: "Purchase Orders", icon: Package },
    { key: "grn", label: "GRN", icon: ListOrdered },
    { key: "journals", label: "Journal Entries", icon: Calculator },
    { key: "trial", label: "Trial Balance", icon: Calculator },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Accounting" description="Full-cycle financial management — invoices, POs, GRN, and journals" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="Posted Sales" value={fmtCurr(totalSales)} hint="Invoice total" />
        <Stat label="Draft POs" value={openPOs} hint="Pending approval" />
        <Stat label="Journal Entries" value={postedJournals} hint="Total entries" />
        <Stat label="Accounts" value={accounts.length} hint="Chart of Accounts" />
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          {sections.map((s) => (
            <TabsTrigger key={s.key} value={s.key} className="gap-1.5">
              <s.icon className="size-3.5" /> {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Chart of Accounts ──────────────────────────────────────── */}
        <TabsContent value="coa" className="mt-4">
          <ChartOfAccountsTab accounts={accounts} isLoading={coaQ.isLoading} />
        </TabsContent>

        {/* ── Customers ──────────────────────────────────────────────── */}
        <TabsContent value="customers" className="mt-4">
          <CustomersTab customers={customers} isLoading={customersQ.isLoading} />
        </TabsContent>

        {/* ── Vendors ────────────────────────────────────────────────── */}
        <TabsContent value="vendors" className="mt-4">
          <VendorsTab vendors={vendors} isLoading={vendorsQ.isLoading} />
        </TabsContent>

        {/* ── Sales Invoices ─────────────────────────────────────────── */}
        <TabsContent value="invoices" className="mt-4">
          <SalesInvoicesTab invoices={invoices} accounts={accounts} customers={customers} isLoading={invQ.isLoading} />
        </TabsContent>

        {/* ── Credit Notes ───────────────────────────────────────────── */}
        <TabsContent value="credit-notes" className="mt-4">
          <CreditNotesTab creditNotes={creditNotes} invoices={invoices} accounts={accounts} isLoading={cnQ.isLoading} />
        </TabsContent>

        {/* ── Debit Notes ────────────────────────────────────────────── */}
        <TabsContent value="debit-notes" className="mt-4">
          <DebitNotesTab debitNotes={debitNotes} vendors={vendors} isLoading={dnQ.isLoading} />
        </TabsContent>

        {/* ── Purchase Orders ────────────────────────────────────────── */}
        <TabsContent value="po" className="mt-4">
          <PurchaseOrdersTab pos={pos} vendors={vendors} isLoading={poQ.isLoading} />
        </TabsContent>

        {/* ── GRN ────────────────────────────────────────────────────── */}
        <TabsContent value="grn" className="mt-4">
          <GRNTab grns={grns} pos={pos} isLoading={grnQ.isLoading} />
        </TabsContent>

        {/* ── Journal Entries ────────────────────────────────────────── */}
        <TabsContent value="journals" className="mt-4">
          <JournalEntriesTab journals={journals} accounts={accounts} isLoading={journalQ.isLoading} />
        </TabsContent>

        {/* ── Trial Balance ──────────────────────────────────────────── */}
        <TabsContent value="trial" className="mt-4">
          <TrialBalanceTab data={tbData} accounts={accounts} isLoading={tbQ.isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Chart of Accounts ──────────────────────────────────────────────

function ChartOfAccountsTab({ accounts, isLoading }: { accounts: Account[]; isLoading: boolean }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [edit, setEdit] = useState<Account | null>(null);
  const createAcct = useCreateAccount();
  const updateAcct = useUpdateAccount();
  const deleteAcct = useDeleteAccount();
  const [form, setForm] = useState({ code: "", name: "", type: "asset", sub_type: "", opening_balance: 0, currency: "USD", display_order: 0 });

  const filtered = accounts.filter((a) => {
    const ms = a.code.toLowerCase().includes(search.toLowerCase()) || a.name.toLowerCase().includes(search.toLowerCase());
    const mt = typeFilter === "all" || a.type === typeFilter;
    return ms && mt;
  });

  const handleSave = () => {
    if (!form.code || !form.name) { toast.error("Code and name are required"); return; }
    const mutate = edit
      ? updateAcct.mutateAsync({ id: edit.id, code: form.code, name: form.name, type: form.type, sub_type: form.sub_type, opening_balance: form.opening_balance, currency: form.currency, display_order: form.display_order })
      : createAcct.mutateAsync(form);
    mutate.then(() => {
      toast.success(edit ? "Account updated" : "Account created");
      setCreateOpen(false); setEdit(null); setForm({ code: "", name: "", type: "asset", sub_type: "", opening_balance: 0, currency: "USD", display_order: 0 });
    }).catch((e: any) => toast.error(e.message ?? "Failed"));
  };

  const openEdit = (a: Account) => {
    setEdit(a);
    setForm({ code: a.code, name: a.name, type: a.type, sub_type: a.sub_type, opening_balance: a.opening_balance, currency: a.currency, display_order: a.display_order });
    setCreateOpen(true);
  };

  const openCreate = () => {
    setEdit(null);
    setForm({ code: "", name: "", type: "asset", sub_type: "", opening_balance: 0, currency: "USD", display_order: 0 });
    setCreateOpen(true);
  };

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8 h-8 w-52 text-sm" placeholder="Search accounts…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["all", ...ACCOUNT_TYPES].map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${typeFilter === t ? "bg-secondary text-secondary-foreground border-secondary" : "hover:border-muted-foreground/40"}`}>
              {cap(t)}
            </button>
          ))}
        </div>
        <Button size="sm" className="ml-auto gap-1.5" onClick={openCreate}><Plus className="size-3.5" /> New Account</Button>
      </div>
      <Card>
        {isLoading ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {["Code", "Name", "Type", "Sub Type", "Opening Balance", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-accent/5">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{a.code}</td>
                  <td className="px-4 py-3">{a.name}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className="text-[10px]">{cap(a.type)}</Badge></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{a.sub_type || "—"}</td>
                  <td className="px-4 py-3 font-medium">{fmtCurr(a.opening_balance)}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-[10px] ${a.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{a.is_active ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(a)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" disabled={deleteAcct.isPending}
                        onClick={() => deleteAcct.mutate(a.id, { onSuccess: () => toast.success("Account deleted"), onError: (e: any) => toast.error(e.message) })}>
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">No accounts found</td></tr>}
            </tbody>
          </table>
        </div>
        )}
      </Card>
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setEdit(null); } setCreateOpen(o); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{edit ? "Edit Account" : "New Account"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Code</Label><Input className="h-8 mt-1" placeholder="1000" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{cap(t)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-xs">Name</Label><Input className="h-8 mt-1" placeholder="Cash" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label className="text-xs">Sub Type</Label><Input className="h-8 mt-1" placeholder="Current Asset" value={form.sub_type} onChange={(e) => setForm({ ...form, sub_type: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Opening Balance</Label><Input className="h-8 mt-1" type="number" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Display Order</Label><Input className="h-8 mt-1" type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setEdit(null); }}>Cancel</Button>
            <Button disabled={createAcct.isPending || updateAcct.isPending} onClick={handleSave}>{createAcct.isPending || updateAcct.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Customers ──────────────────────────────────────────────────────

function CustomersTab({ customers, isLoading }: { customers: Customer[]; isLoading: boolean }) {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [edit, setEdit] = useState<Customer | null>(null);
  const createCust = useCreateCustomer();
  const updateCust = useUpdateCustomer();
  const [form, setForm] = useState({ code: "", name: "", gstin: "", address: "", email: "", phone: "", credit_days: 30, credit_limit: 0 });

  const filtered = customers.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()));

  const handleSave = () => {
    if (!form.code || !form.name) { toast.error("Code and name are required"); return; }
    const mutate = edit
      ? updateCust.mutateAsync({ id: edit.id, ...form, credit_limit: form.credit_limit || undefined })
      : createCust.mutateAsync({ ...form, credit_limit: form.credit_limit || undefined });
    mutate.then(() => {
      toast.success(edit ? "Customer updated" : "Customer created");
      setCreateOpen(false); setEdit(null); setForm({ code: "", name: "", gstin: "", address: "", email: "", phone: "", credit_days: 30, credit_limit: 0 });
    }).catch((e: any) => toast.error(e.message ?? "Failed"));
  };

  const openEdit = (c: Customer) => {
    setEdit(c);
    setForm({ code: c.code, name: c.name, gstin: c.gstin, address: c.address, email: c.email, phone: c.phone, credit_days: c.credit_days, credit_limit: c.credit_limit ?? 0 });
    setCreateOpen(true);
  };

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <div className="relative"><Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input className="pl-8 h-8 w-52 text-sm" placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Button size="sm" className="ml-auto gap-1.5" onClick={() => { setEdit(null); setForm({ code: "", name: "", gstin: "", address: "", email: "", phone: "", credit_days: 30, credit_limit: 0 }); setCreateOpen(true); }}><Plus className="size-3.5" /> New Customer</Button>
      </div>
      <Card>
        {isLoading ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b">{["Code", "Name", "GSTIN", "Email", "Phone", "Credit Days", "Status", ""].map((h) => (<th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>))}</tr></thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-accent/5">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{c.code}</td>
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.gstin || "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.email || "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.phone || "—"}</td>
                  <td className="px-4 py-3 text-xs">{c.credit_days}d</td>
                  <td className="px-4 py-3"><Badge className={`text-[10px] ${c.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{c.is_active ? "Active" : "Inactive"}</Badge></td>
                  <td className="px-4 py-3"><Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(c)}>Edit</Button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-muted-foreground text-sm">No customers found</td></tr>}
            </tbody>
          </table>
        </div>
        )}
      </Card>
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) setEdit(null); setCreateOpen(o); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{edit ? "Edit Customer" : "New Customer"}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Code</Label><Input className="h-8 mt-1" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label className="text-xs">Credit Days</Label><Input className="h-8 mt-1" type="number" value={form.credit_days} onChange={(e) => setForm({ ...form, credit_days: Number(e.target.value) })} /></div>
            </div>
            <div><Label className="text-xs">Name</Label><Input className="h-8 mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label className="text-xs">GSTIN</Label><Input className="h-8 mt-1" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></div>
            <div><Label className="text-xs">Email</Label><Input className="h-8 mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label className="text-xs">Phone</Label><Input className="h-8 mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label className="text-xs">Address</Label><Textarea className="mt-1 min-h-[60px]" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label className="text-xs">Credit Limit</Label><Input className="h-8 mt-1" type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setEdit(null); }}>Cancel</Button>
            <Button disabled={createCust.isPending || updateCust.isPending} onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Vendors ────────────────────────────────────────────────────────

function VendorsTab({ vendors, isLoading }: { vendors: Vendor[]; isLoading: boolean }) {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [edit, setEdit] = useState<Vendor | null>(null);
  const createV = useCreateVendor();
  const updateV = useUpdateVendor();
  const [form, setForm] = useState({ code: "", name: "", gstin: "", address: "", email: "", phone: "", credit_days: 30, credit_limit: 0 });

  const filtered = vendors.filter((v) => v.name.toLowerCase().includes(search.toLowerCase()) || v.code.toLowerCase().includes(search.toLowerCase()));

  const handleSave = () => {
    if (!form.code || !form.name) { toast.error("Code and name are required"); return; }
    const mutate = edit
      ? updateV.mutateAsync({ id: edit.id, ...form, credit_limit: form.credit_limit || undefined })
      : createV.mutateAsync({ ...form, credit_limit: form.credit_limit || undefined });
    mutate.then(() => {
      toast.success(edit ? "Vendor updated" : "Vendor created");
      setCreateOpen(false); setEdit(null); setForm({ code: "", name: "", gstin: "", address: "", email: "", phone: "", credit_days: 30, credit_limit: 0 });
    }).catch((e: any) => toast.error(e.message ?? "Failed"));
  };

  const openEdit = (v: Vendor) => {
    setEdit(v);
    setForm({ code: v.code, name: v.name, gstin: v.gstin, address: v.address, email: v.email, phone: v.phone, credit_days: v.credit_days, credit_limit: v.credit_limit ?? 0 });
    setCreateOpen(true);
  };

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <div className="relative"><Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input className="pl-8 h-8 w-52 text-sm" placeholder="Search vendors…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Button size="sm" className="ml-auto gap-1.5" onClick={() => { setEdit(null); setForm({ code: "", name: "", gstin: "", address: "", email: "", phone: "", credit_days: 30, credit_limit: 0 }); setCreateOpen(true); }}><Plus className="size-3.5" /> New Vendor</Button>
      </div>
      <Card>
        {isLoading ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b">{["Code", "Name", "GSTIN", "Email", "Phone", "Credit Days", "Status", ""].map((h) => (<th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>))}</tr></thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-accent/5">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{v.code}</td>
                  <td className="px-4 py-3">{v.name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{v.gstin || "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{v.email || "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{v.phone || "—"}</td>
                  <td className="px-4 py-3 text-xs">{v.credit_days}d</td>
                  <td className="px-4 py-3"><Badge className={`text-[10px] ${v.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{v.is_active ? "Active" : "Inactive"}</Badge></td>
                  <td className="px-4 py-3"><Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(v)}>Edit</Button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-muted-foreground text-sm">No vendors found</td></tr>}
            </tbody>
          </table>
        </div>
        )}
      </Card>
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) setEdit(null); setCreateOpen(o); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{edit ? "Edit Vendor" : "New Vendor"}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Code</Label><Input className="h-8 mt-1" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label className="text-xs">Credit Days</Label><Input className="h-8 mt-1" type="number" value={form.credit_days} onChange={(e) => setForm({ ...form, credit_days: Number(e.target.value) })} /></div>
            </div>
            <div><Label className="text-xs">Name</Label><Input className="h-8 mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label className="text-xs">GSTIN</Label><Input className="h-8 mt-1" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></div>
            <div><Label className="text-xs">Email</Label><Input className="h-8 mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label className="text-xs">Phone</Label><Input className="h-8 mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label className="text-xs">Address</Label><Textarea className="mt-1 min-h-[60px]" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label className="text-xs">Credit Limit</Label><Input className="h-8 mt-1" type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setEdit(null); }}>Cancel</Button>
            <Button disabled={createV.isPending || updateV.isPending} onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sales Invoices ─────────────────────────────────────────────────

function SalesInvoicesTab({ invoices, accounts, customers, isLoading }: { invoices: SalesInvoice[]; accounts: Account[]; customers: Customer[]; isLoading: boolean }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailQ = useGetSalesInvoice(detailId);
  const createInv = useCreateSalesInvoice();
  const postInv = usePostSalesInvoice();
  const cancelInv = useCancelSalesInvoice();
  const creditNoteInv = useCreateCreditNoteFromInvoice();

  const [form, setForm] = useState({ customer_id: "", date: "", due_date: "", reference: "", notes: "" });
  const [lines, setLines] = useState<{ account_id: string; description: string; quantity: number; unit_price: number; discount: number; tax_rate: number }[]>([]);

  const filtered = invoices.filter((inv) => {
    const ms = inv.invoice_number.toLowerCase().includes(search.toLowerCase());
    const ms2 = inv.reference?.toLowerCase().includes(search.toLowerCase());
    const mf = statusFilter === "all" || inv.status === statusFilter;
    return (ms || ms2) && mf;
  });

  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const handleCreate = () => {
    if (!form.customer_id || lines.length === 0) { toast.error("Customer and at least one line required"); return; }
    createInv.mutate({ ...form, lines }, {
      onSuccess: () => { toast.success("Invoice created"); setCreateOpen(false); setForm({ customer_id: "", date: "", due_date: "", reference: "", notes: "" }); setLines([]); },
      onError: (e: any) => toast.error(e.message ?? "Failed"),
    });
  };

  const addLine = () => setLines([...lines, { account_id: accounts[0]?.id ?? "", description: "", quantity: 1, unit_price: 0, discount: 0, tax_rate: 18 }]);
  const updLine = (i: number, p: Partial<typeof lines[0]>) => { const n = [...lines]; n[i] = { ...n[i], ...p }; setLines(n); };
  const delLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const lineTotal = (l: typeof lines[0]) => {
    const st = l.quantity * l.unit_price;
    const afterDisc = st - l.discount;
    return afterDisc + afterDisc * l.tax_rate / 100;
  };

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <div className="relative"><Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input className="pl-8 h-8 w-52 text-sm" placeholder="Search invoices…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="flex gap-1.5 flex-wrap">
          {["all", "draft", "posted", "cancelled"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${statusFilter === s ? "bg-secondary text-secondary-foreground border-secondary" : "hover:border-muted-foreground/40"}`}>
              {cap(s)}
            </button>
          ))}
        </div>
        <Button size="sm" className="ml-auto gap-1.5" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> New Invoice</Button>
      </div>
      <Card>
        {isLoading ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b">{["Invoice #", "Customer", "Date", "Due Date", "Subtotal", "Total", "Status", "Actions"].map((h) => (<th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>))}</tr></thead>
            <tbody>
              {filtered.map((inv) => {
                const meta = STATUS_META[inv.status] ?? STATUS_META.draft;
                return (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-accent/5">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-xs">{customerMap.get(inv.customer_id)?.name || inv.customer_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{inv.invoice_date}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{inv.due_date || "—"}</td>
                    <td className="px-4 py-3 text-xs">{fmtCurr(inv.subtotal)}</td>
                    <td className="px-4 py-3 font-medium">{fmtCurr(inv.total)}</td>
                    <td className="px-4 py-3"><Badge className={`text-[10px] border ${meta.color}`}>{cap(inv.status)}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-1.5" onClick={() => setDetailId(detailId === inv.id ? null : inv.id)}>
                          <Eye className="size-3.5" />
                        </Button>
                        {inv.status === "draft" && (
                          <Button size="sm" variant="ghost" className="h-7 px-1.5 text-success" disabled={postInv.isPending}
                            onClick={() => postInv.mutate(inv.id, { onSuccess: () => toast.success("Invoice posted"), onError: (e: any) => toast.error(e.message) })}>
                            <CheckCircle2 className="size-3.5" />
                          </Button>
                        )}
                        {inv.status === "draft" && (
                          <Button size="sm" variant="ghost" className="h-7 px-1.5 text-destructive" disabled={cancelInv.isPending}
                            onClick={() => cancelInv.mutate(inv.id, { onSuccess: () => toast.success("Invoice cancelled"), onError: (e: any) => toast.error(e.message) })}>
                            <XCircle className="size-3.5" />
                          </Button>
                        )}
                        {inv.status === "posted" && (
                          <Button size="sm" variant="ghost" className="h-7 px-1.5 text-info" disabled={creditNoteInv.isPending}
                            onClick={() => creditNoteInv.mutate(inv.id, { onSuccess: () => toast.success("Credit note created"), onError: (e: any) => toast.error(e.message) })}>
                            <Receipt className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-muted-foreground text-sm">No invoices found</td></tr>}
            </tbody>
          </table>
        </div>
        )}
      </Card>
      {detailId && (
        <InvoiceDetailPanel invoiceId={detailId} accountMap={accountMap} onClose={() => setDetailId(null)} />
      )}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Sales Invoice</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Customer</Label>
                <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                  <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>{customers.filter((c) => c.is_active).map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Date</Label><Input className="h-8 mt-1" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Due Date</Label><Input className="h-8 mt-1" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
              <div><Label className="text-xs">Reference</Label><Input className="h-8 mt-1" placeholder="PO-123" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Notes</Label><Input className="h-8 mt-1" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2"><Label className="text-xs font-semibold">Invoice Lines</Label><Button size="sm" variant="outline" className="h-7 gap-1" onClick={addLine}><Plus className="size-3" /> Add Line</Button></div>
              {lines.map((l, i) => (
                <div key={i} className="border rounded p-2 mb-2 space-y-1.5">
                  <div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground">Line {i + 1}</span><Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-destructive" onClick={() => delLine(i)}><Trash2 className="size-3" /></Button></div>
                  <div><Label className="text-[10px]">Account</Label>
                    <Select value={l.account_id} onValueChange={(v) => updLine(i, { account_id: v })}>
                      <SelectTrigger className="h-7 mt-0.5 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{accounts.filter((a) => a.is_active).map((a) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-[10px]">Description</Label><Input className="h-7 mt-0.5 text-xs" value={l.description} onChange={(e) => updLine(i, { description: e.target.value })} /></div>
                  <div className="grid grid-cols-4 gap-1">
                    <div><Label className="text-[10px]">Qty</Label><Input className="h-7 mt-0.5 text-xs" type="number" min={0} step={1} value={l.quantity} onChange={(e) => updLine(i, { quantity: Number(e.target.value) })} /></div>
                    <div><Label className="text-[10px]">Price</Label><Input className="h-7 mt-0.5 text-xs" type="number" min={0} step={0.01} value={l.unit_price} onChange={(e) => updLine(i, { unit_price: Number(e.target.value) })} /></div>
                    <div><Label className="text-[10px]">Disc</Label><Input className="h-7 mt-0.5 text-xs" type="number" min={0} value={l.discount} onChange={(e) => updLine(i, { discount: Number(e.target.value) })} /></div>
                    <div><Label className="text-[10px]">Tax %</Label>
                      <Select value={String(l.tax_rate)} onValueChange={(v) => updLine(i, { tax_rate: Number(v) })}>
                        <SelectTrigger className="h-7 mt-0.5 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{TAX_RATES.map((r) => <SelectItem key={r} value={r}>{r}%</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="text-xs text-right text-muted-foreground">Line total: {fmtCurr(lineTotal(l))}</div>
                </div>
              ))}
              {lines.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Add at least one line</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={createInv.isPending || lines.length === 0} onClick={handleCreate}>{createInv.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Create Invoice"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvoiceDetailPanel({ invoiceId, accountMap, onClose }: { invoiceId: string; accountMap: Map<string, Account>; onClose: () => void }) {
  const { data, isLoading } = useGetSalesInvoice(invoiceId);
  if (isLoading) return <Card className="p-4 mt-3 flex justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></Card>;
  if (!data) return null;
  return (
    <Card className="p-4 mt-3">
      <div className="flex items-center justify-between mb-3">
        <div><h4 className="font-semibold text-sm">{data.invoice_number}</h4><p className="text-xs text-muted-foreground">Status: <Badge className={`text-[10px] border ${STATUS_META[data.status]?.color ?? ""}`}>{cap(data.status)}</Badge></p></div>
        <Button size="sm" variant="outline" className="h-7" onClick={onClose}>Close</Button>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs mb-3">
        <div><span className="text-muted-foreground">Date</span><div className="font-medium">{data.invoice_date}</div></div>
        <div><span className="text-muted-foreground">Due Date</span><div className="font-medium">{data.due_date || "—"}</div></div>
        <div><span className="text-muted-foreground">Reference</span><div className="font-medium">{data.reference || "—"}</div></div>
        <div><span className="text-muted-foreground">Notes</span><div className="font-medium">{data.notes || "—"}</div></div>
      </div>
      <table className="w-full text-xs">
        <thead><tr className="border-b">
          <th className="text-left py-1.5 text-muted-foreground">Account</th>
          <th className="text-left py-1.5 text-muted-foreground">Description</th>
          <th className="text-right py-1.5 text-muted-foreground">Qty</th>
          <th className="text-right py-1.5 text-muted-foreground">Unit Price</th>
          <th className="text-right py-1.5 text-muted-foreground">Disc</th>
          <th className="text-right py-1.5 text-muted-foreground">Tax</th>
          <th className="text-right py-1.5 text-muted-foreground">Total</th>
        </tr></thead>
        <tbody>
          {data.lines.map((l) => (
            <tr key={l.id} className="border-b">
              <td className="py-1.5">{accountMap.get(l.account_id)?.code || l.account_id.slice(0, 8)}</td>
              <td className="py-1.5">{l.description}</td>
              <td className="py-1.5 text-right">{l.quantity}</td>
              <td className="py-1.5 text-right">{fmtCurr(l.unit_price)}</td>
              <td className="py-1.5 text-right">{fmtCurr(l.discount)}</td>
              <td className="py-1.5 text-right">{fmtCurr(l.tax_amount)}</td>
              <td className="py-1.5 text-right font-medium">{fmtCurr(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-end mt-3 text-sm space-x-4">
        <div><span className="text-muted-foreground">Subtotal:</span> <span className="font-medium">{fmtCurr(data.subtotal)}</span></div>
        <div><span className="text-muted-foreground">Discount:</span> <span className="font-medium">{fmtCurr(data.discount_total)}</span></div>
        <div><span className="text-muted-foreground">Tax:</span> <span className="font-medium">{fmtCurr(data.tax_total)}</span></div>
        <div><span className="text-muted-foreground">Total:</span> <span className="font-semibold">{fmtCurr(data.total)}</span></div>
      </div>
    </Card>
  );
}

// ── Credit Notes ───────────────────────────────────────────────────

function CreditNotesTab({ creditNotes, invoices, accounts, isLoading }: { creditNotes: CreditNote[]; invoices: SalesInvoice[]; accounts: Account[]; isLoading: boolean }) {
  const [createOpen, setCreateOpen] = useState(false);
  const createCN = useCreateCreditNote();
  const postCN = usePostCreditNote();
  const [form, setForm] = useState({ invoice_id: "", date: "", reason: "" });
  const [cnLines, setCnLines] = useState<{ account_id: string; description: string; quantity: number; unit_price: number }[]>([]);

  const invoiceMap = useMemo(() => new Map(invoices.map((i) => [i.id, i])), [invoices]);

  const handleCreate = () => {
    createCN.mutate({ ...form, lines: cnLines.length > 0 ? cnLines : undefined }, {
      onSuccess: () => { toast.success("Credit note created"); setCreateOpen(false); setForm({ invoice_id: "", date: "", reason: "" }); setCnLines([]); },
      onError: (e: any) => toast.error(e.message ?? "Failed"),
    });
  };

  const addCnLine = () => setCnLines([...cnLines, { account_id: accounts[0]?.id ?? "", description: "", quantity: 1, unit_price: 0 }]);
  const updCnLine = (i: number, p: Partial<typeof cnLines[0]>) => { const n = [...cnLines]; n[i] = { ...n[i], ...p }; setCnLines(n); };

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> New Credit Note</Button>
      </div>
      <Card>
        {isLoading ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b">{["CN #", "Invoice", "Date", "Reason", "Total", "Status", "Actions"].map((h) => (<th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>))}</tr></thead>
            <tbody>
              {creditNotes.map((cn) => {
                const meta = STATUS_META[cn.status] ?? STATUS_META.draft;
                return (
                  <tr key={cn.id} className="border-b last:border-0 hover:bg-accent/5">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{cn.credit_note_number}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{invoiceMap.get(cn.invoice_id)?.invoice_number || cn.invoice_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-xs">{cn.date}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{cn.reason || "—"}</td>
                    <td className="px-4 py-3 font-medium">{fmtCurr(cn.total)}</td>
                    <td className="px-4 py-3"><Badge className={`text-[10px] border ${meta.color}`}>{cap(cn.status)}</Badge></td>
                    <td className="px-4 py-3">
                      {cn.status === "draft" && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-success" disabled={postCN.isPending}
                          onClick={() => postCN.mutate(cn.id, { onSuccess: () => toast.success("Credit note posted"), onError: (e: any) => toast.error(e.message) })}>
                          <CheckCircle2 className="size-3.5 mr-1" /> Post
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {creditNotes.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">No credit notes</td></tr>}
            </tbody>
          </table>
        </div>
        )}
      </Card>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Credit Note</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Invoice (optional)</Label>
              <Select value={form.invoice_id} onValueChange={(v) => setForm({ ...form, invoice_id: v })}>
                <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Select invoice" /></SelectTrigger>
                <SelectContent>{invoices.filter((i) => i.status === "posted").map((i) => <SelectItem key={i.id} value={i.id}>{i.invoice_number}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Date</Label><Input className="h-8 mt-1" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><Label className="text-xs">Reason</Label><Input className="h-8 mt-1" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            <div className="border-t pt-2">
              <div className="flex items-center justify-between mb-2"><Label className="text-xs font-semibold">Lines (optional)</Label><Button size="sm" variant="outline" className="h-7 gap-1" onClick={addCnLine}><Plus className="size-3" /> Add</Button></div>
              {cnLines.map((l, i) => (
                <div key={i} className="border rounded p-2 mb-1.5 space-y-1">
                  <div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground">Line {i + 1}</span><Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-destructive" onClick={() => setCnLines(cnLines.filter((_, idx) => idx !== i))}><Trash2 className="size-3" /></Button></div>
                  <div><Label className="text-[10px]">Account</Label>
                    <Select value={l.account_id} onValueChange={(v) => updCnLine(i, { account_id: v })}>
                      <SelectTrigger className="h-7 mt-0.5 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{accounts.filter((a) => a.is_active).map((a) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <div className="col-span-2"><Label className="text-[10px]">Description</Label><Input className="h-7 mt-0.5 text-xs" value={l.description} onChange={(e) => updCnLine(i, { description: e.target.value })} /></div>
                    <div><Label className="text-[10px]">Qty</Label><Input className="h-7 mt-0.5 text-xs" type="number" min={1} value={l.quantity} onChange={(e) => updCnLine(i, { quantity: Number(e.target.value) })} /></div>
                    <div><Label className="text-[10px]">Unit Price</Label><Input className="h-7 mt-0.5 text-xs" type="number" min={0} value={l.unit_price} onChange={(e) => updCnLine(i, { unit_price: Number(e.target.value) })} /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={createCN.isPending} onClick={handleCreate}>{createCN.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Debit Notes ────────────────────────────────────────────────────

function DebitNotesTab({ debitNotes, vendors, isLoading }: { debitNotes: DebitNote[]; vendors: Vendor[]; isLoading: boolean }) {
  const [createOpen, setCreateOpen] = useState(false);
  const createDN = useCreateDebitNote();
  const postDN = usePostDebitNote();
  const [form, setForm] = useState({ vendor_id: "", date: "", reason: "", subtotal: 0, tax_total: 0, total: 0 });

  const vendorMap = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);

  const handleCreate = () => {
    createDN.mutate(form, {
      onSuccess: () => { toast.success("Debit note created"); setCreateOpen(false); setForm({ vendor_id: "", date: "", reason: "", subtotal: 0, tax_total: 0, total: 0 }); },
      onError: (e: any) => toast.error(e.message ?? "Failed"),
    });
  };

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> New Debit Note</Button>
      </div>
      <Card>
        {isLoading ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b">{["DN #", "Vendor", "Date", "Reason", "Total", "Status", "Actions"].map((h) => (<th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>))}</tr></thead>
            <tbody>
              {debitNotes.map((dn) => (
                <tr key={dn.id} className="border-b last:border-0 hover:bg-accent/5">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{dn.debit_note_number}</td>
                  <td className="px-4 py-3 text-xs">{vendorMap.get(dn.vendor_id)?.name || dn.vendor_id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-xs">{dn.date}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{dn.reason || "—"}</td>
                  <td className="px-4 py-3 font-medium">{fmtCurr(dn.total)}</td>
                  <td className="px-4 py-3"><Badge className={`text-[10px] border ${STATUS_META[dn.status]?.color ?? ""}`}>{cap(dn.status)}</Badge></td>
                  <td className="px-4 py-3">
                    {dn.status === "draft" && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-success" disabled={postDN.isPending}
                        onClick={() => postDN.mutate(dn.id, { onSuccess: () => toast.success("Debit note posted"), onError: (e: any) => toast.error(e.message) })}>
                        <CheckCircle2 className="size-3.5 mr-1" /> Post
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {debitNotes.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">No debit notes</td></tr>}
            </tbody>
          </table>
        </div>
        )}
      </Card>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Debit Note</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Vendor</Label>
              <Select value={form.vendor_id} onValueChange={(v) => setForm({ ...form, vendor_id: v })}>
                <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>{vendors.filter((v) => v.is_active).map((v) => <SelectItem key={v.id} value={v.id}>{v.name} ({v.code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Date</Label><Input className="h-8 mt-1" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><Label className="text-xs">Reason</Label><Input className="h-8 mt-1" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">Subtotal</Label><Input className="h-8 mt-1" type="number" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Tax</Label><Input className="h-8 mt-1" type="number" value={form.tax_total} onChange={(e) => setForm({ ...form, tax_total: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Total</Label><Input className="h-8 mt-1" type="number" value={form.total} onChange={(e) => setForm({ ...form, total: Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={createDN.isPending} onClick={handleCreate}>{createDN.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Purchase Orders ────────────────────────────────────────────────

function PurchaseOrdersTab({ pos, vendors, isLoading }: { pos: PurchaseOrder[]; vendors: Vendor[]; isLoading: boolean }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const createPO = useCreatePurchaseOrder();
  const approvePO = useApprovePurchaseOrder();
  const [form, setForm] = useState({ vendor_id: "", date: "", expected_date: "", notes: "" });
  const [poLines, setPoLines] = useState<{ description: string; quantity: number; unit_price: number }[]>([]);

  const vendorMap = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);

  const filtered = pos.filter((p) => {
    const ms = p.po_number.toLowerCase().includes(search.toLowerCase());
    const mf = statusFilter === "all" || p.status === statusFilter;
    return ms && mf;
  });

  const handleCreate = () => {
    if (!form.vendor_id || poLines.length === 0) { toast.error("Vendor and at least one line required"); return; }
    createPO.mutate({ ...form, lines: poLines }, {
      onSuccess: () => { toast.success("Purchase order created"); setCreateOpen(false); setForm({ vendor_id: "", date: "", expected_date: "", notes: "" }); setPoLines([]); },
      onError: (e: any) => toast.error(e.message ?? "Failed"),
    });
  };

  const addPoLine = () => setPoLines([...poLines, { description: "", quantity: 1, unit_price: 0 }]);
  const updPoLine = (i: number, p: Partial<typeof poLines[0]>) => { const n = [...poLines]; n[i] = { ...n[i], ...p }; setPoLines(n); };

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <div className="relative"><Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input className="pl-8 h-8 w-52 text-sm" placeholder="Search PO…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="flex gap-1.5 flex-wrap">
          {["all", "draft", "approved", "received", "cancelled"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${statusFilter === s ? "bg-secondary text-secondary-foreground border-secondary" : "hover:border-muted-foreground/40"}`}>{cap(s)}</button>
          ))}
        </div>
        <Button size="sm" className="ml-auto gap-1.5" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> New PO</Button>
      </div>
      <Card>
        {isLoading ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b">{["PO #", "Vendor", "Date", "Expected", "Subtotal", "Total", "Status", "Actions"].map((h) => (<th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>))}</tr></thead>
            <tbody>
              {filtered.map((p) => {
                const meta = STATUS_META[p.status] ?? STATUS_META.draft;
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-accent/5">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{p.po_number}</td>
                    <td className="px-4 py-3 text-xs">{vendorMap.get(p.vendor_id)?.name || p.vendor_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.order_date}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.expected_date || "—"}</td>
                    <td className="px-4 py-3 text-xs">{fmtCurr(p.subtotal)}</td>
                    <td className="px-4 py-3 font-medium">{fmtCurr(p.total)}</td>
                    <td className="px-4 py-3"><Badge className={`text-[10px] border ${meta.color}`}>{cap(p.status)}</Badge></td>
                    <td className="px-4 py-3">
                      {p.status === "draft" && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-info" disabled={approvePO.isPending}
                          onClick={() => approvePO.mutate(p.id, { onSuccess: () => toast.success("PO approved"), onError: (e: any) => toast.error(e.message) })}>
                          <CheckCircle2 className="size-3.5 mr-1" /> Approve
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-muted-foreground text-sm">No purchase orders found</td></tr>}
            </tbody>
          </table>
        </div>
        )}
      </Card>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Vendor</Label>
                <Select value={form.vendor_id} onValueChange={(v) => setForm({ ...form, vendor_id: v })}>
                  <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>{vendors.filter((v) => v.is_active).map((v) => <SelectItem key={v.id} value={v.id}>{v.name} ({v.code})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Order Date</Label><Input className="h-8 mt-1" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Expected Date</Label><Input className="h-8 mt-1" type="date" value={form.expected_date} onChange={(e) => setForm({ ...form, expected_date: e.target.value })} /></div>
              <div><Label className="text-xs">Notes</Label><Input className="h-8 mt-1" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="border-t pt-2">
              <div className="flex items-center justify-between mb-2"><Label className="text-xs font-semibold">PO Lines</Label><Button size="sm" variant="outline" className="h-7 gap-1" onClick={addPoLine}><Plus className="size-3" /> Add</Button></div>
              {poLines.map((l, i) => (
                <div key={i} className="border rounded p-2 mb-1.5 space-y-1">
                  <div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground">Line {i + 1}</span><Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-destructive" onClick={() => setPoLines(poLines.filter((_, idx) => idx !== i))}><Trash2 className="size-3" /></Button></div>
                  <div><Label className="text-[10px]">Description</Label><Input className="h-7 mt-0.5 text-xs" value={l.description} onChange={(e) => updPoLine(i, { description: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-1">
                    <div><Label className="text-[10px]">Quantity</Label><Input className="h-7 mt-0.5 text-xs" type="number" min={1} value={l.quantity} onChange={(e) => updPoLine(i, { quantity: Number(e.target.value) })} /></div>
                    <div><Label className="text-[10px]">Unit Price</Label><Input className="h-7 mt-0.5 text-xs" type="number" min={0} step={0.01} value={l.unit_price} onChange={(e) => updPoLine(i, { unit_price: Number(e.target.value) })} /></div>
                  </div>
                  <div className="text-xs text-right text-muted-foreground">{fmtCurr(l.quantity * l.unit_price)}</div>
                </div>
              ))}
              {poLines.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Add at least one line</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={createPO.isPending || poLines.length === 0} onClick={handleCreate}>{createPO.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Create PO"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── GRN ────────────────────────────────────────────────────────────

function GRNTab({ grns, pos, isLoading }: { grns: GRN[]; pos: PurchaseOrder[]; isLoading: boolean }) {
  const [createOpen, setCreateOpen] = useState(false);
  const createGRN = useCreateGRN();
  const postGRN = usePostGRN();
  const [form, setForm] = useState({ po_id: "", received_date: "", vendor_invoice_ref: "", notes: "" });
  const [grnLines, setGrnLines] = useState<{ item_description: string; quantity_ordered: number; quantity_received: number; quantity_accepted: number; quantity_rejected: number; unit_price: number }[]>([]);

  const poMap = useMemo(() => new Map(pos.map((p) => [p.id, p])), [pos]);

  const handleCreate = () => {
    if (!form.po_id || grnLines.length === 0) { toast.error("PO and at least one line required"); return; }
    createGRN.mutate({ ...form, lines: grnLines }, {
      onSuccess: () => { toast.success("GRN created"); setCreateOpen(false); setForm({ po_id: "", received_date: "", vendor_invoice_ref: "", notes: "" }); setGrnLines([]); },
      onError: (e: any) => toast.error(e.message ?? "Failed"),
    });
  };

  const addGrnLine = () => setGrnLines([...grnLines, { item_description: "", quantity_ordered: 0, quantity_received: 0, quantity_accepted: 0, quantity_rejected: 0, unit_price: 0 }]);
  const updGrnLine = (i: number, p: Partial<typeof grnLines[0]>) => { const n = [...grnLines]; n[i] = { ...n[i], ...p }; setGrnLines(n); };

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> New GRN</Button>
      </div>
      <Card>
        {isLoading ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b">{["GRN #", "PO", "Date", "Vendor Inv Ref", "Status", "Actions"].map((h) => (<th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>))}</tr></thead>
            <tbody>
              {grns.map((g) => {
                const meta = STATUS_META[g.status] ?? STATUS_META.draft;
                return (
                  <tr key={g.id} className="border-b last:border-0 hover:bg-accent/5">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{g.grn_number}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{poMap.get(g.po_id)?.po_number || g.po_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-xs">{g.received_date}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{g.vendor_invoice_ref || "—"}</td>
                    <td className="px-4 py-3"><Badge className={`text-[10px] border ${meta.color}`}>{cap(g.status)}</Badge></td>
                    <td className="px-4 py-3">
                      {g.status === "draft" && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-success" disabled={postGRN.isPending}
                          onClick={() => postGRN.mutate(g.id, { onSuccess: () => toast.success("GRN posted"), onError: (e: any) => toast.error(e.message) })}>
                          <CheckCircle2 className="size-3.5 mr-1" /> Post
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {grns.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">No GRN records</td></tr>}
            </tbody>
          </table>
        </div>
        )}
      </Card>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Goods Receipt Note</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Purchase Order</Label>
                <Select value={form.po_id} onValueChange={(v) => setForm({ ...form, po_id: v })}>
                  <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Select PO" /></SelectTrigger>
                  <SelectContent>{pos.filter((p) => p.status === "approved" || p.status === "received").map((p) => <SelectItem key={p.id} value={p.id}>{p.po_number}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Received Date</Label><Input className="h-8 mt-1" type="date" value={form.received_date} onChange={(e) => setForm({ ...form, received_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Vendor Invoice Ref</Label><Input className="h-8 mt-1" value={form.vendor_invoice_ref} onChange={(e) => setForm({ ...form, vendor_invoice_ref: e.target.value })} /></div>
              <div><Label className="text-xs">Notes</Label><Input className="h-8 mt-1" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="border-t pt-2">
              <div className="flex items-center justify-between mb-2"><Label className="text-xs font-semibold">Items</Label><Button size="sm" variant="outline" className="h-7 gap-1" onClick={addGrnLine}><Plus className="size-3" /> Add</Button></div>
              {grnLines.map((l, i) => (
                <div key={i} className="border rounded p-2 mb-1.5 space-y-1">
                  <div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground">Item {i + 1}</span><Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-destructive" onClick={() => setGrnLines(grnLines.filter((_, idx) => idx !== i))}><Trash2 className="size-3" /></Button></div>
                  <div><Label className="text-[10px]">Description</Label><Input className="h-7 mt-0.5 text-xs" value={l.item_description} onChange={(e) => updGrnLine(i, { item_description: e.target.value })} /></div>
                  <div className="grid grid-cols-4 gap-1">
                    <div><Label className="text-[10px]">Ord</Label><Input className="h-7 mt-0.5 text-xs" type="number" min={0} value={l.quantity_ordered} onChange={(e) => updGrnLine(i, { quantity_ordered: Number(e.target.value) })} /></div>
                    <div><Label className="text-[10px]">Rcvd</Label><Input className="h-7 mt-0.5 text-xs" type="number" min={0} value={l.quantity_received} onChange={(e) => updGrnLine(i, { quantity_received: Number(e.target.value) })} /></div>
                    <div><Label className="text-[10px]">Acc</Label><Input className="h-7 mt-0.5 text-xs" type="number" min={0} value={l.quantity_accepted} onChange={(e) => updGrnLine(i, { quantity_accepted: Number(e.target.value) })} /></div>
                    <div><Label className="text-[10px]">Rej</Label><Input className="h-7 mt-0.5 text-xs" type="number" min={0} value={l.quantity_rejected} onChange={(e) => updGrnLine(i, { quantity_rejected: Number(e.target.value) })} /></div>
                  </div>
                  <div><Label className="text-[10px]">Unit Price</Label><Input className="h-7 mt-0.5 text-xs" type="number" min={0} step={0.01} value={l.unit_price} onChange={(e) => updGrnLine(i, { unit_price: Number(e.target.value) })} /></div>
                  <div className="text-xs text-right text-muted-foreground">Total: {fmtCurr(l.quantity_accepted * l.unit_price)}</div>
                </div>
              ))}
              {grnLines.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Add at least one item</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={createGRN.isPending || grnLines.length === 0} onClick={handleCreate}>{createGRN.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Create GRN"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Journal Entries ────────────────────────────────────────────────

function JournalEntriesTab({ journals, accounts, isLoading }: { journals: JournalEntry[]; accounts: Account[]; isLoading: boolean }) {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailQ = useGetJournalEntry(detailId);
  const createJE = useCreateJournalEntry();

  const [form, setForm] = useState({ date: "", description: "", reference: "" });
  const [jeLines, setJeLines] = useState<{ account_id: string; debit: number; credit: number; memo: string }[]>([]);

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const filtered = journals.filter((j) => j.description.toLowerCase().includes(search.toLowerCase()));

  const totals = useMemo(() => {
    let d = 0, c = 0;
    jeLines.forEach((l) => { d += l.debit; c += l.credit; });
    return { debit: d, credit: c };
  }, [jeLines]);

  const handleCreate = () => {
    if (!form.description || jeLines.length === 0) { toast.error("Description and at least one line required"); return; }
    if (totals.debit !== totals.credit) { toast.error("Total debits must equal total credits"); return; }
    createJE.mutate({ ...form, lines: jeLines }, {
      onSuccess: () => { toast.success("Journal entry created"); setCreateOpen(false); setForm({ date: "", description: "", reference: "" }); setJeLines([]); },
      onError: (e: any) => toast.error(e.message ?? "Failed"),
    });
  };

  const addJeLine = () => setJeLines([...jeLines, { account_id: accounts[0]?.id ?? "", debit: 0, credit: 0, memo: "" }]);
  const updJeLine = (i: number, p: Partial<typeof jeLines[0]>) => { const n = [...jeLines]; n[i] = { ...n[i], ...p }; setJeLines(n); };

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <div className="relative"><Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input className="pl-8 h-8 w-52 text-sm" placeholder="Search entries…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Button size="sm" className="ml-auto gap-1.5" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> New Entry</Button>
      </div>
      <Card>
        {isLoading ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b">{["Date", "Description", "Reference", "Created", "Actions"].map((h) => (<th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>))}</tr></thead>
            <tbody>
              {filtered.map((j) => (
                <tr key={j.id} className="border-b last:border-0 hover:bg-accent/5">
                  <td className="px-4 py-3 text-xs">{j.date}</td>
                  <td className="px-4 py-3">{j.description}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{j.reference || "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(j.created_at)}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setDetailId(detailId === j.id ? null : j.id)}>
                      <Eye className="size-3.5 mr-1" /> View
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">No journal entries</td></tr>}
            </tbody>
          </table>
        </div>
        )}
      </Card>
      {detailId && <JournalEntryDetailPanel entryId={detailId} accountMap={accountMap} onClose={() => setDetailId(null)} />}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Journal Entry</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Date</Label><Input className="h-8 mt-1" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label className="text-xs">Reference</Label><Input className="h-8 mt-1" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Description</Label><Input className="h-8 mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="border-t pt-2">
              <div className="flex items-center justify-between mb-2"><Label className="text-xs font-semibold">Lines (Debit = Credit)</Label><Button size="sm" variant="outline" className="h-7 gap-1" onClick={addJeLine}><Plus className="size-3" /> Add</Button></div>
              {jeLines.map((l, i) => (
                <div key={i} className="border rounded p-2 mb-1.5 space-y-1">
                  <div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground">Line {i + 1}</span><Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-destructive" onClick={() => setJeLines(jeLines.filter((_, idx) => idx !== i))}><Trash2 className="size-3" /></Button></div>
                  <div><Label className="text-[10px]">Account</Label>
                    <Select value={l.account_id} onValueChange={(v) => updJeLine(i, { account_id: v })}>
                      <SelectTrigger className="h-7 mt-0.5 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{accounts.filter((a) => a.is_active).map((a) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <div><Label className="text-[10px]">Debit</Label><Input className="h-7 mt-0.5 text-xs" type="number" min={0} step={0.01} value={l.debit} onChange={(e) => updJeLine(i, { debit: Number(e.target.value) })} /></div>
                    <div><Label className="text-[10px]">Credit</Label><Input className="h-7 mt-0.5 text-xs" type="number" min={0} step={0.01} value={l.credit} onChange={(e) => updJeLine(i, { credit: Number(e.target.value) })} /></div>
                    <div><Label className="text-[10px]">Memo</Label><Input className="h-7 mt-0.5 text-xs" value={l.memo} onChange={(e) => updJeLine(i, { memo: e.target.value })} /></div>
                  </div>
                </div>
              ))}
              {jeLines.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Add at least one line</p>}
              {jeLines.length > 0 && (
                <div className="flex justify-between text-xs font-medium border-t pt-1 mt-1">
                  <span>Total Debit: <span className="text-success">{fmtCurr(totals.debit)}</span></span>
                  <span>Total Credit: <span className="text-info">{fmtCurr(totals.credit)}</span></span>
                  <span className={totals.debit === totals.credit ? "text-success" : "text-destructive"}>
                    {totals.debit === totals.credit ? "Balanced" : `Diff: ${fmtCurr(Math.abs(totals.debit - totals.credit))}`}
                  </span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={createJE.isPending || jeLines.length === 0 || totals.debit !== totals.credit} onClick={handleCreate}>
              {createJE.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Create Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function JournalEntryDetailPanel({ entryId, accountMap, onClose }: { entryId: string; accountMap: Map<string, Account>; onClose: () => void }) {
  const { data, isLoading } = useGetJournalEntry(entryId);
  if (isLoading) return <Card className="p-4 mt-3 flex justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></Card>;
  if (!data) return null;
  return (
    <Card className="p-4 mt-3">
      <div className="flex items-center justify-between mb-3">
        <div><h4 className="font-semibold text-sm">{data.description}</h4><p className="text-xs text-muted-foreground">{data.date} {data.reference ? `· ${data.reference}` : ""}</p></div>
        <Button size="sm" variant="outline" className="h-7" onClick={onClose}>Close</Button>
      </div>
      <table className="w-full text-xs">
        <thead><tr className="border-b">
          <th className="text-left py-1.5 text-muted-foreground">Account</th>
          <th className="text-right py-1.5 text-muted-foreground">Debit</th>
          <th className="text-right py-1.5 text-muted-foreground">Credit</th>
          <th className="text-left py-1.5 text-muted-foreground">Memo</th>
        </tr></thead>
        <tbody>
          {data.lines.map((l) => (
            <tr key={l.id} className="border-b">
              <td className="py-1.5">{accountMap.get(l.account_id)?.code || l.account_id.slice(0, 8)} — {accountMap.get(l.account_id)?.name || ""}</td>
              <td className="py-1.5 text-right text-success font-medium">{l.debit > 0 ? fmtCurr(l.debit) : ""}</td>
              <td className="py-1.5 text-right text-info font-medium">{l.credit > 0 ? fmtCurr(l.credit) : ""}</td>
              <td className="py-1.5 text-muted-foreground">{l.memo || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ── Trial Balance ──────────────────────────────────────────────────

function TrialBalanceTab({ data, accounts, isLoading }: { data: TrialBalanceRow[]; accounts: Account[]; isLoading: boolean }) {
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = data.filter((r) => typeFilter === "all" || r.type === typeFilter);
  const totalDr = filtered.filter((r) => r.balance > 0).reduce((s, r) => s + r.balance, 0);
  const totalCr = filtered.filter((r) => r.balance < 0).reduce((s, r) => s + Math.abs(r.balance), 0);

  if (isLoading) return <Card className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></Card>;

  return (
    <div>
      {accounts.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <p className="text-sm">No accounts found. Add accounts in the Chart of Accounts tab first, then create journal entries to see balances.</p>
        </Card>
      ) : (
        <>
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {["all", ...ACCOUNT_TYPES].map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${typeFilter === t ? "bg-secondary text-secondary-foreground border-secondary" : "hover:border-muted-foreground/40"}`}>
                {cap(t)}
              </button>
            ))}
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {["Code", "Account", "Type", "Debit", "Credit"].map((h) => (
                      <th key={h} className={`px-4 py-3 text-xs font-medium text-muted-foreground ${h === "Debit" || h === "Credit" ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={`${r.code}-${i}`} className="border-b last:border-0 hover:bg-accent/5">
                      <td className="px-4 py-3 font-mono text-xs font-medium">{r.code}</td>
                      <td className="px-4 py-3">{r.name}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className="text-[10px]">{cap(r.type)}</Badge></td>
                      <td className="px-4 py-3 text-right text-success font-medium">{r.balance > 0 ? fmtCurr(r.balance) : ""}</td>
                      <td className="px-4 py-3 text-right text-info font-medium">{r.balance < 0 ? fmtCurr(Math.abs(r.balance)) : ""}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 font-semibold">
                    <td colSpan={3} className="px-4 py-3 text-sm">Totals</td>
                    <td className="px-4 py-3 text-right text-success">{fmtCurr(totalDr)}</td>
                    <td className="px-4 py-3 text-right text-info">{fmtCurr(totalCr)}</td>
                  </tr>
                  {totalDr !== totalCr && (
                    <tr className="text-destructive text-xs">
                      <td colSpan={5} className="px-4 py-2 text-center">Trial balance is out of balance by {fmtCurr(Math.abs(totalDr - totalCr))}</td>
                    </tr>
                  )}
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">No accounts match this filter</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
