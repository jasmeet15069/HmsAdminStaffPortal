import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2, Store, Upload, Plus, Save, FileSpreadsheet, CheckCircle2, AlertTriangle,
} from "lucide-react";

import { PageHeader } from "@/components/AppShell";
import { apiFetch } from "@/lib/api/client";
import { isAuthenticated } from "@/lib/api/auth";
import { parseCSV } from "@/lib/csv";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "Setup Wizard · MHMS" }] }),
  component: SetupWizard,
});

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------
type BusinessSettings = {
  name: string;
  address: string | null;
  currency: string;
  legal_entity_name: string | null;
  restaurant_name: string | null;
  restaurant_address: string | null;
  gstin: string | null;
  fssai: string | null;
  gst_state: string | null;
  place_of_supply: string | null;
  hsn_code: string;
  gst_rate: number;
};

type OutletRow = {
  id: string;
  name: string;
  code: string | null;
  type: string;
  is_standalone: boolean;
  address: string | null;
  gstin: string | null;
  fssai: string | null;
  place_of_supply: string | null;
  hsn_code: string;
  default_tax_rate: number;
  currency: string;
  is_active: boolean;
};

type BulkResult = {
  entity: string;
  received: number;
  inserted: number;
  failed: number;
  errors: { row: number; error: string }[];
};

function SetupWizard() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Setup Wizard"
        description="Configure your business identity, outlets, and import existing data in bulk."
      />
      <Tabs defaultValue="business">
        <TabsList>
          <TabsTrigger value="business" className="gap-1"><Building2 className="size-3.5" /> Business &amp; GST</TabsTrigger>
          <TabsTrigger value="outlets" className="gap-1"><Store className="size-3.5" /> Outlets</TabsTrigger>
          <TabsTrigger value="import" className="gap-1"><Upload className="size-3.5" /> Bulk Import</TabsTrigger>
        </TabsList>
        <TabsContent value="business"><BusinessStep /></TabsContent>
        <TabsContent value="outlets"><OutletsStep /></TabsContent>
        <TabsContent value="import"><ImportStep /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Business & GST
// ---------------------------------------------------------------------------
function BusinessStep() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["settings", "business"],
    queryFn: () => apiFetch<BusinessSettings>("/api/settings/business"),
    enabled: isAuthenticated(),
  });
  const [form, setForm] = useState<Partial<BusinessSettings>>({});
  useEffect(() => { if (q.data) setForm(q.data); }, [q.data]);

  const save = useMutation({
    mutationFn: (body: Partial<BusinessSettings>) =>
      apiFetch<BusinessSettings>("/api/settings/business", { method: "PUT", body }),
    onSuccess: (d) => {
      qc.setQueryData(["settings", "business"], d);
      toast.success("Business settings saved");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const set = (k: keyof BusinessSettings) => (v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const field = (k: keyof BusinessSettings, label: string, placeholder = "") => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        value={(form[k] as string | number | null) ?? ""}
        placeholder={placeholder}
        onChange={(e) => set(k)(e.target.value)}
      />
    </div>
  );

  return (
    <Card className="p-5 space-y-5">
      <p className="text-sm text-muted-foreground">
        These fields print on POS tax invoices. Per-outlet GST details (next tab) override these.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {field("legal_entity_name", "Legal Entity Name", "Connaught Plaza Restaurants Pvt Ltd")}
        {field("restaurant_name", "Restaurant Name", "Your Restaurant")}
        {field("restaurant_address", "Restaurant Address")}
        {field("gstin", "GSTIN", "07AAACC1201E1ZL")}
        {field("fssai", "FSSAI License No.")}
        {field("gst_state", "State", "Delhi")}
        {field("place_of_supply", "Place of Supply", "Delhi (7)")}
        {field("hsn_code", "HSN Code", "996331")}
        <div className="space-y-1">
          <Label>Default GST Rate (%)</Label>
          <Input
            type="number"
            value={form.gst_rate ?? 0}
            onChange={(e) => set("gst_rate")(Number(e.target.value))}
          />
        </div>
        {field("currency", "Currency", "INR")}
      </div>
      <div className="flex justify-end">
        <Button onClick={() => save.mutate(form)} disabled={save.isPending} className="gap-1">
          <Save className="size-4" /> {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Outlets
// ---------------------------------------------------------------------------
const EMPTY_OUTLET = {
  name: "", code: "", type: "restaurant", is_standalone: false, address: "",
  gstin: "", fssai: "", place_of_supply: "", hsn_code: "996331", default_tax_rate: 5, currency: "INR",
};

function OutletsStep() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["pos", "outlets"],
    queryFn: () => apiFetch<OutletRow[] | null>("/api/pos/outlets").then((o) => o ?? []),
    enabled: isAuthenticated(),
  });
  const [draft, setDraft] = useState<Record<string, unknown>>({ ...EMPTY_OUTLET });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<OutletRow>("/api/pos/outlets", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos", "outlets"] });
      setDraft({ ...EMPTY_OUTLET });
      toast.success("Outlet created");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Create failed"),
  });

  const d = (k: string) => (draft[k] as string | number | boolean | undefined) ?? "";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-1"><Plus className="size-4" /> New Outlet</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={d("name") as string} onChange={(e) => setDraft((s) => ({ ...s, name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={d("type") as string} onValueChange={(v) => setDraft((s) => ({ ...s, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="restaurant">Restaurant</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="cafe">Cafe</SelectItem>
                <SelectItem value="room_service">Room Service</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>GSTIN</Label>
            <Input value={d("gstin") as string} onChange={(e) => setDraft((s) => ({ ...s, gstin: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>FSSAI</Label>
            <Input value={d("fssai") as string} onChange={(e) => setDraft((s) => ({ ...s, fssai: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Place of Supply</Label>
            <Input value={d("place_of_supply") as string} onChange={(e) => setDraft((s) => ({ ...s, place_of_supply: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Default Tax Rate (%)</Label>
            <Input type="number" value={d("default_tax_rate") as number}
              onChange={(e) => setDraft((s) => ({ ...s, default_tax_rate: Number(e.target.value) }))} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={Boolean(draft.is_standalone)} onCheckedChange={(v) => setDraft((s) => ({ ...s, is_standalone: v }))} />
          Standalone (serves walk-in / outside customers)
        </label>
        <div className="flex justify-end">
          <Button onClick={() => create.mutate(draft)} disabled={create.isPending || !draft.name} className="gap-1">
            <Plus className="size-4" /> Create Outlet
          </Button>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-1"><Store className="size-4" /> Outlets</h3>
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (q.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No outlets yet. Create one to start taking dine-in orders.</p>
        ) : (
          <div className="space-y-2">
            {(q.data ?? []).map((o) => (
              <div key={o.id} className="flex items-center justify-between border-2 border-border p-3">
                <div>
                  <div className="font-medium">{o.name} <span className="text-xs text-muted-foreground">({o.type})</span></div>
                  <div className="text-xs text-muted-foreground">
                    GST {o.default_tax_rate}% · {o.gstin || "no GSTIN"} {o.is_standalone ? "· standalone" : ""}
                  </div>
                </div>
                <Badge variant={o.is_active ? "default" : "outline"}>{o.is_active ? "active" : "inactive"}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Bulk Import
// ---------------------------------------------------------------------------
const IMPORT_ENTITIES: { value: string; label: string; cols: string }[] = [
  { value: "rooms", label: "Rooms", cols: "room_number, room_type, floor, capacity, price_per_night, status" },
  { value: "menu-items", label: "Menu Items", cols: "name, description, price, is_available, preparation_time" },
  { value: "guests", label: "Customers", cols: "full_name, email, phone, address, city, country, vip_status" },
  { value: "vendors", label: "Vendors", cols: "name, contact_person, email, phone, address, category, rating" },
  { value: "promotions", label: "Promo Codes", cols: "code, name, discount_type, discount_value, min_amount, usage_limit" },
];

function ImportStep() {
  const [entity, setEntity] = useState("rooms");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);
  const meta = useMemo(() => IMPORT_ENTITIES.find((e) => e.value === entity)!, [entity]);

  const onFile = async (file: File) => {
    const text = await file.text();
    setRows(parseCSV(text));
    setFileName(file.name);
    setResult(null);
  };

  const importMut = useMutation({
    mutationFn: (body: { rows: Record<string, string>[] }) =>
      apiFetch<BulkResult>(`/api/bulk/${entity}`, { method: "POST", body }),
    onSuccess: (r) => {
      setResult(r);
      toast.success(`Imported ${r.inserted}/${r.received} ${entity}`);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Import failed"),
  });

  return (
    <Card className="p-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>What are you importing?</Label>
          <Select value={entity} onValueChange={(v) => { setEntity(v); setRows([]); setResult(null); setFileName(""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {IMPORT_ENTITIES.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>CSV file</Label>
          <Input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </div>
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <FileSpreadsheet className="size-3.5" /> Expected header columns: <code className="font-mono">{meta.cols}</code>
      </div>

      {rows.length > 0 && (
        <div className="border-2 border-border p-3 text-sm">
          <div className="flex items-center justify-between">
            <span><strong>{fileName}</strong> — {rows.length} row(s) parsed</span>
            <Button onClick={() => importMut.mutate({ rows })} disabled={importMut.isPending} className="gap-1">
              <Upload className="size-4" /> {importMut.isPending ? "Importing…" : `Import ${rows.length}`}
            </Button>
          </div>
          <div className="mt-2 max-h-40 overflow-auto font-mono text-xs text-muted-foreground">
            {Object.keys(rows[0]).join(" | ")}
          </div>
        </div>
      )}

      {result && (
        <div className="border-2 border-border p-3 text-sm space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-green-600" />
            <strong>{result.inserted}</strong> inserted, <strong>{result.failed}</strong> failed of {result.received}.
          </div>
          {result.errors.length > 0 && (
            <div className="space-y-1">
              {result.errors.slice(0, 10).map((er, i) => (
                <div key={i} className="flex items-start gap-1 text-destructive text-xs">
                  <AlertTriangle className="size-3.5 mt-0.5" /> Row {er.row}: {er.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
