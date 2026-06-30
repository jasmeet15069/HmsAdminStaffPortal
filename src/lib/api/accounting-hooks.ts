import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { isAuthenticated } from "./auth";

export interface Account {
  id: string; code: string; name: string; type: string; sub_type: string;
  parent_code: string | null; opening_balance: number; currency: string;
  is_active: boolean; display_order: number;
  created_at: string; updated_at: string;
}

export interface Customer {
  id: string; code: string; name: string; gstin: string;
  address: string; email: string; phone: string;
  credit_days: number; credit_limit: number | null;
  is_active: boolean; created_at: string; updated_at: string;
}

export interface Vendor {
  id: string; code: string; name: string; gstin: string;
  address: string; email: string; phone: string;
  credit_days: number; credit_limit: number | null;
  is_active: boolean; created_at: string; updated_at: string;
}

export interface SalesInvoice {
  id: string; customer_id: string; invoice_number: string;
  invoice_date: string; due_date: string | null; reference: string;
  subtotal: number; discount_total: number; tax_total: number;
  total: number; status: string; notes: string;
  created_at: string; updated_at: string;
}

export interface SalesInvoiceLine {
  id: string; account_id: string; description: string;
  quantity: number; unit_price: number; discount: number;
  tax_rate: number; tax_amount: number; total: number;
}

export interface SalesInvoiceDetail extends SalesInvoice {
  lines: SalesInvoiceLine[];
}

export interface CreditNote {
  id: string; invoice_id: string; credit_note_number: string;
  date: string; reason: string;
  subtotal: number; tax_total: number; total: number;
  status: string; created_at: string; updated_at: string;
}

export interface DebitNote {
  id: string; vendor_id: string; debit_note_number: string;
  date: string; reason: string;
  subtotal: number; tax_total: number; total: number;
  status: string; created_at: string; updated_at: string;
}

export interface PurchaseOrder {
  id: string; vendor_id: string; po_number: string;
  order_date: string; expected_date: string | null;
  status: string; subtotal: number; tax_total: number;
  total: number; notes: string;
  created_at: string; updated_at: string;
}

export interface GRN {
  id: string; po_id: string; grn_number: string;
  received_date: string; vendor_invoice_ref: string;
  status: string; notes: string;
  created_at: string; updated_at: string;
}

export interface JournalEntry {
  id: string; date: string; description: string;
  reference: string; created_at: string;
}

export interface JournalLine {
  id: string; account_id: string; debit: number; credit: number; memo: string;
}

export interface JournalEntryDetail extends JournalEntry {
  lines: JournalLine[];
}

export interface TrialBalanceRow {
  code: string; name: string; type: string; balance: number;
}

const acctKeys = {
  all: ["accounting"] as const,
  coa: ["accounting", "coa"] as const,
  customers: ["accounting", "customers"] as const,
  vendors: ["accounting", "vendors"] as const,
  invoices: ["accounting", "invoices"] as const,
  creditNotes: ["accounting", "credit-notes"] as const,
  debitNotes: ["accounting", "debit-notes"] as const,
  pos: ["accounting", "purchase-orders"] as const,
  grn: ["accounting", "grn"] as const,
  journals: ["accounting", "journal-entries"] as const,
  trialBalance: ["accounting", "trial-balance"] as const,
};

export function useAccounts() {
  return useQuery({ queryKey: acctKeys.coa, queryFn: () => apiFetch<Account[]>("/api/accounting/chart-of-accounts"), enabled: isAuthenticated() });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Account>) => apiFetch("/api/accounting/chart-of-accounts", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: acctKeys.coa }),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<Account>) => apiFetch(`/api/accounting/chart-of-accounts/${id}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: acctKeys.coa }),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/accounting/chart-of-accounts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: acctKeys.coa }),
  });
}

export function useCustomers() {
  return useQuery({ queryKey: acctKeys.customers, queryFn: () => apiFetch<Customer[]>("/api/accounting/customers"), enabled: isAuthenticated() });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Customer>) => apiFetch("/api/accounting/customers", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: acctKeys.customers }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<Customer>) => apiFetch(`/api/accounting/customers/${id}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: acctKeys.customers }),
  });
}

export function useVendors() {
  return useQuery({ queryKey: acctKeys.vendors, queryFn: () => apiFetch<Vendor[]>("/api/accounting/vendors"), enabled: isAuthenticated() });
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Vendor>) => apiFetch("/api/accounting/vendors", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: acctKeys.vendors }),
  });
}

export function useUpdateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<Vendor>) => apiFetch(`/api/accounting/vendors/${id}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: acctKeys.vendors }),
  });
}

export function useSalesInvoices() {
  return useQuery({ queryKey: acctKeys.invoices, queryFn: () => apiFetch<SalesInvoice[]>("/api/accounting/sales-invoices"), enabled: isAuthenticated() });
}

export function useGetSalesInvoice(id: string | null) {
  return useQuery({
    queryKey: [...acctKeys.invoices, id] as const,
    queryFn: () => apiFetch<SalesInvoiceDetail>(`/api/accounting/sales-invoices/${id}`),
    enabled: isAuthenticated() && !!id,
  });
}

export function useCreateSalesInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => apiFetch("/api/accounting/sales-invoices", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: acctKeys.invoices }),
  });
}

export function usePostSalesInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/accounting/sales-invoices/${id}/post`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: acctKeys.invoices }),
  });
}

export function useCancelSalesInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/accounting/sales-invoices/${id}/cancel`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: acctKeys.invoices }),
  });
}

export function useCreateCreditNoteFromInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/accounting/sales-invoices/${id}/credit-note`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: acctKeys.invoices }); qc.invalidateQueries({ queryKey: acctKeys.creditNotes }); },
  });
}

export function useCreditNotes() {
  return useQuery({ queryKey: acctKeys.creditNotes, queryFn: () => apiFetch<CreditNote[]>("/api/accounting/credit-notes"), enabled: isAuthenticated() });
}

export function useCreateCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => apiFetch("/api/accounting/credit-notes", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: acctKeys.creditNotes }),
  });
}

export function usePostCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/accounting/credit-notes/${id}/post`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: acctKeys.creditNotes }),
  });
}

export function useDebitNotes() {
  return useQuery({ queryKey: acctKeys.debitNotes, queryFn: () => apiFetch<DebitNote[]>("/api/accounting/debit-notes"), enabled: isAuthenticated() });
}

export function useCreateDebitNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => apiFetch("/api/accounting/debit-notes", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: acctKeys.debitNotes }),
  });
}

export function usePostDebitNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/accounting/debit-notes/${id}/post`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: acctKeys.debitNotes }),
  });
}

export function usePurchaseOrders() {
  return useQuery({ queryKey: acctKeys.pos, queryFn: () => apiFetch<PurchaseOrder[]>("/api/accounting/purchase-orders"), enabled: isAuthenticated() });
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => apiFetch("/api/accounting/purchase-orders", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: acctKeys.pos }),
  });
}

export function useApprovePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/accounting/purchase-orders/${id}/approve`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: acctKeys.pos }),
  });
}

export function useGRN() {
  return useQuery({ queryKey: acctKeys.grn, queryFn: () => apiFetch<GRN[]>("/api/accounting/grn"), enabled: isAuthenticated() });
}

export function useCreateGRN() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => apiFetch("/api/accounting/grn", { method: "POST", body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: acctKeys.grn }); qc.invalidateQueries({ queryKey: acctKeys.pos }); },
  });
}

export function usePostGRN() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/accounting/grn/${id}/post`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: acctKeys.grn }),
  });
}

export function useJournalEntries() {
  return useQuery({ queryKey: acctKeys.journals, queryFn: () => apiFetch<JournalEntry[]>("/api/accounting/journal-entries"), enabled: isAuthenticated() });
}

export function useGetJournalEntry(id: string | null) {
  return useQuery({
    queryKey: [...acctKeys.journals, id] as const,
    queryFn: () => apiFetch<JournalEntryDetail>(`/api/accounting/journal-entries/${id}`),
    enabled: isAuthenticated() && !!id,
  });
}

export function useCreateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => apiFetch("/api/accounting/journal-entries", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: acctKeys.journals }),
  });
}

export function useTrialBalance() {
  return useQuery({ queryKey: acctKeys.trialBalance, queryFn: () => apiFetch<TrialBalanceRow[]>("/api/accounting/trial-balance"), enabled: isAuthenticated() });
}
