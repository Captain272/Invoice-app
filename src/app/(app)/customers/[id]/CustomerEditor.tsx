"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Plus, Trash2, FileText, Download, Sparkles, X } from "lucide-react";
import type { Customer, CustomerFieldValue, GeneratedDocument, Invoice, InvoiceLineItem, ReportTemplate, InvoiceFieldValue } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DynamicFieldRenderer, type DynamicField } from "@/components/forms/DynamicFieldRenderer";
import { EmptyState } from "@/components/layout/EmptyState";
import { formatDateTime, formatBytes } from "@/lib/utils";
import { createCustomer, updateCustomer, saveInvoiceForCustomer } from "@/server/actions/customers";
import { runGenerateDocument } from "@/server/actions/documents";

type SystemFieldConfig = DynamicField & { systemColumn: string | null; displayOrder: number };
type CustomFieldConfig = DynamicField & { displayOrder: number };
type InvoiceWithItems = (Invoice & { lineItems: InvoiceLineItem[]; fieldValues?: InvoiceFieldValue[] }) | null;
type CustomerWithValues = (Customer & { fieldValues: CustomerFieldValue[] }) | null;

const TAX_DEFAULT = [
  { label: "19%", value: "19" },
  { label: "16%", value: "16" },
  { label: "0%", value: "0" },
  { label: "§13b", value: "13b" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "ARCHIVED", label: "Archived" },
];

// Accept decimals with either dot or comma as separator (e.g. "1.5", "1,5", "10.25").
function parseLocaleNumber(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;
  const n = Number(trimmed.replace(/,/g, "."));
  return Number.isFinite(n) ? n : null;
}

type CoreState = {
  name: string;
  email: string;
  phone: string;
  address: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
};

type HeaderState = {
  invoiceNumber: string;
  quoteNumber: string;
  invoiceDate: string;
  performancePeriodStart: string;
  performancePeriodEnd: string;
  paymentTerms: string;
  taxMode: string;
  currency: string;
  notes: string;
};

export function CustomerEditor({
  customer,
  customerSystemFields,
  customerCustomFields,
  invoiceFields,
  invoice,
  documents,
  templates,
  taxMapper,
}: {
  customer: CustomerWithValues;
  customerSystemFields: SystemFieldConfig[];
  customerCustomFields: CustomFieldConfig[];
  invoiceFields: SystemFieldConfig[];
  invoice: InvoiceWithItems;
  documents: GeneratedDocument[];
  templates: ReportTemplate[];
  taxMapper: { label: string; value: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState("details");

  const [core, setCore] = useState<CoreState>({
    name: customer?.name ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    address: customer?.address ?? "",
    status: (customer?.status ?? "ACTIVE") as CoreState["status"],
  });

  // Custom customer field values (non-system).
  const initialCustomerDynamic: Record<string, string | null> = {};
  for (const fc of customerCustomFields) {
    const fv = customer?.fieldValues.find((v) => v.fieldConfigId === fc.id);
    initialCustomerDynamic[fc.key] = fv?.value ?? fc.defaultValue ?? "";
  }
  const [customerDynamic, setCustomerDynamic] = useState(initialCustomerDynamic);
  const [customerDynamicErrors, setCustomerDynamicErrors] = useState<Record<string, string>>({});
  const [coreErrors, setCoreErrors] = useState<Record<string, string>>({});

  // Split invoice fields into system + custom.
  const invoiceSystemFields = useMemo(() => invoiceFields.filter((f) => f.systemColumn).sort((a, b) => a.displayOrder - b.displayOrder), [invoiceFields]);
  const invoiceCustomFields = useMemo(() => invoiceFields.filter((f) => !f.systemColumn).sort((a, b) => a.displayOrder - b.displayOrder), [invoiceFields]);

  const [header, setHeader] = useState<HeaderState>({
    invoiceNumber: invoice?.invoiceNumber ?? "",
    quoteNumber: invoice?.quoteNumber ?? "",
    invoiceDate: invoice?.invoiceDate ? invoice.invoiceDate.toISOString().split("T")[0] : "",
    performancePeriodStart: invoice?.performancePeriodStart ? invoice.performancePeriodStart.toISOString().split("T")[0] : "",
    performancePeriodEnd: invoice?.performancePeriodEnd ? invoice.performancePeriodEnd.toISOString().split("T")[0] : "",
    paymentTerms: invoice?.paymentTerms ?? "",
    taxMode: invoice?.taxMode ?? "",
    currency: invoice?.currency ?? (invoiceSystemFields.find((f) => f.systemColumn === "currency")?.defaultValue ?? "EUR"),
    notes: invoice?.notes ?? "",
  });
  const [headerErrors, setHeaderErrors] = useState<Record<string, string>>({});

  const initialInvoiceDynamic: Record<string, string | null> = {};
  for (const fc of invoiceCustomFields) {
    const fv = invoice?.fieldValues?.find((v) => v.fieldConfigId === fc.id);
    initialInvoiceDynamic[fc.key] = fv?.value ?? fc.defaultValue ?? "";
  }
  const [invoiceDynamic, setInvoiceDynamic] = useState(initialInvoiceDynamic);
  const [invoiceDynamicErrors, setInvoiceDynamicErrors] = useState<Record<string, string>>({});

  type LineItem = {
    pos: string; key: string; label: string; description: string;
    quantity: string; unit: string; unitPrice: string; taxType: string; amount: string; value: string;
  };
  const initialItems: LineItem[] = invoice?.lineItems.length
    ? invoice.lineItems.map((li) => ({
        pos: String(li.pos), key: li.key ?? "", label: li.label ?? "", description: li.description ?? "",
        quantity: String(li.quantity), unit: li.unit ?? "", unitPrice: String(li.unitPrice),
        taxType: li.taxType ?? "", amount: String(li.amount), value: li.value ?? "",
      }))
    : [{ pos: "1", key: "", label: "", description: "", quantity: "1", unit: "", unitPrice: "0", taxType: "", amount: "0", value: "" }];
  const [items, setItems] = useState<LineItem[]>(initialItems);

  const [invoiceSubTab, setInvoiceSubTab] = useState<"header" | "items">("header");
  const [isPending, startTransition] = useTransition();
  const [generateOpen, setGenerateOpen] = useState(false);

  const taxOptions = taxMapper.length > 0 ? taxMapper : TAX_DEFAULT;

  // Read core value for a system field by its systemColumn.
  function coreValueFor(col: string): string {
    switch (col) {
      case "name": return core.name;
      case "email": return core.email;
      case "phone": return core.phone;
      case "address": return core.address;
      case "status": return core.status;
      default: return "";
    }
  }
  function setCoreValueFor(col: string, val: string) {
    setCore((c) => {
      switch (col) {
        case "name": return { ...c, name: val };
        case "email": return { ...c, email: val };
        case "phone": return { ...c, phone: val };
        case "address": return { ...c, address: val };
        case "status": return { ...c, status: (val || "ACTIVE") as CoreState["status"] };
        default: return c;
      }
    });
  }

  function headerValueFor(col: string): string {
    return (header as unknown as Record<string, string>)[col] ?? "";
  }
  function setHeaderValueFor(col: string, val: string) {
    setHeader((h) => ({ ...h, [col]: val } as HeaderState));
  }

  function validateDetails(): boolean {
    const ce: Record<string, string> = {};
    for (const fc of customerSystemFields) {
      if (!fc.systemColumn || !fc.required) continue;
      const v = coreValueFor(fc.systemColumn);
      if (v === null || v === undefined || v === "") ce[fc.systemColumn] = `${fc.name} is required`;
    }
    // Name is always required regardless of config.
    if (!core.name) ce.name = "Name is required";
    setCoreErrors(ce);

    const de: Record<string, string> = {};
    for (const fc of customerCustomFields) {
      if (fc.required) {
        const v = customerDynamic[fc.key];
        if (v === null || v === undefined || v === "") de[fc.key] = `${fc.name} is required`;
      }
    }
    setCustomerDynamicErrors(de);
    return Object.keys(ce).length === 0 && Object.keys(de).length === 0;
  }

  function validateInvoice(): boolean {
    const he: Record<string, string> = {};
    for (const fc of invoiceSystemFields) {
      if (!fc.systemColumn || !fc.required) continue;
      const v = headerValueFor(fc.systemColumn);
      if (v === null || v === undefined || v === "") he[fc.systemColumn] = `${fc.name} is required`;
    }
    // Invoice number is always required.
    if (!header.invoiceNumber) he.invoiceNumber = "Invoice number is required";
    setHeaderErrors(he);

    const de: Record<string, string> = {};
    for (const fc of invoiceCustomFields) {
      if (fc.required) {
        const v = invoiceDynamic[fc.key];
        if (v === null || v === undefined || v === "") de[fc.key] = `${fc.name} is required`;
      }
    }
    setInvoiceDynamicErrors(de);
    return Object.keys(he).length === 0 && Object.keys(de).length === 0;
  }

  async function saveDetails(advance: boolean) {
    if (!validateDetails()) { toast.error("Please fill required fields"); return; }
    startTransition(async () => {
      try {
        const payload = { core, dynamic: customerDynamic };
        if (customer) {
          await updateCustomer(customer.id, payload);
          toast.success("Customer saved");
          if (advance) setTab("invoice");
        } else {
          const created = await createCustomer(payload);
          toast.success("Customer created");
          router.replace(`/customers/${created.id}`);
        }
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  async function saveInvoice(action: "save" | "next" | "generate") {
    if (!customer) { toast.error("Save customer first"); return; }
    if (!validateInvoice()) { toast.error("Please fill required fields"); setInvoiceSubTab("header"); return; }
    startTransition(async () => {
      try {
        await saveInvoiceForCustomer({
          customerId: customer.id,
          invoiceId: invoice?.id ?? null,
          header,
          dynamic: invoiceDynamic,
          lineItems: items.map((li, i) => ({
            pos: parseLocaleNumber(li.pos) ?? i + 1,
            key: li.key || null,
            label: li.label || null,
            description: li.description || null,
            quantity: parseLocaleNumber(li.quantity) ?? 0,
            unit: li.unit || null,
            unitPrice: parseLocaleNumber(li.unitPrice) ?? 0,
            taxType: li.taxType || null,
            amount: parseLocaleNumber(li.amount) ?? (parseLocaleNumber(li.quantity) ?? 0) * (parseLocaleNumber(li.unitPrice) ?? 0),
            value: li.value || null,
          })),
        });
        toast.success("Invoice saved");
        if (action === "generate") setGenerateOpen(true);
        if (action === "next") setTab("documents");
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function addItem() {
    setItems([
      ...items,
      { pos: String(items.length + 1), key: "", label: "", description: "", quantity: "1", unit: "", unitPrice: "0", taxType: "", amount: "0", value: "" },
    ]);
  }

  function updateItem(i: number, patch: Partial<LineItem>) {
    setItems(items.map((it, idx) => {
      if (idx !== i) return it;
      const next = { ...it, ...patch };
      const q = parseLocaleNumber(next.quantity), p = parseLocaleNumber(next.unitPrice);
      if (q !== null && p !== null) next.amount = String(+(q * p).toFixed(2));
      return next;
    }));
  }

  function removeItem(i: number) {
    setItems(items.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, pos: String(idx + 1) })));
  }

  return (
    <Tabs value={tab} onValueChange={setTab} orientation="vertical" className="flex flex-col md:flex-row gap-6">
      <TabsList className="flex md:flex-col gap-1 h-auto bg-card border p-1.5 md:w-56 shrink-0">
        <TabsTrigger value="details" className="md:justify-start md:w-full">Customer Details</TabsTrigger>
        <TabsTrigger value="invoice" className="md:justify-start md:w-full" disabled={!customer}>Invoice Details</TabsTrigger>
        <TabsTrigger value="documents" className="md:justify-start md:w-full" disabled={!customer}>
          Documents {customer && documents.length > 0 && <Badge variant="secondary" className="ml-1">{documents.length}</Badge>}
        </TabsTrigger>
      </TabsList>

      <div className="flex-1 min-w-0">
        <TabsContent value="details" className="m-0">
          <Card><CardContent className="p-6 space-y-5">
            <h2 className="text-lg font-semibold">Customer Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customerSystemFields.map((fc) => {
                if (!fc.systemColumn) return null;
                const col = fc.systemColumn;
                const v = coreValueFor(col);
                const err = coreErrors[col];
                const isFullRow = col === "address" || fc.type === "textarea";
                return (
                  <div key={fc.id} className={isFullRow ? "md:col-span-2" : ""}>
                    <Label>{fc.name} {fc.required && <span className="text-destructive">*</span>}</Label>
                    <SystemCustomerInput field={fc} value={v} onChange={(val) => setCoreValueFor(col, val)} />
                    {fc.helpText && <p className="text-xs text-muted-foreground mt-1">{fc.helpText}</p>}
                    {err && <p className="text-xs text-destructive mt-1">{err}</p>}
                  </div>
                );
              })}
            </div>

            {customerCustomFields.length > 0 && (
              <div className="border-t pt-5">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Additional fields</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customerCustomFields.map((fc) => (
                    <DynamicFieldRenderer
                      key={fc.id}
                      field={fc}
                      value={customerDynamic[fc.key]}
                      onChange={(val) => setCustomerDynamic({ ...customerDynamic, [fc.key]: val ?? "" })}
                      error={customerDynamicErrors[fc.key]}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => saveDetails(false)} disabled={isPending}>Save</Button>
              <Button onClick={() => saveDetails(true)} disabled={isPending} variant="amber">
                {customer ? "Save and Next" : "Create and Continue"} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="invoice" className="m-0">
          <Card><CardContent className="p-6 space-y-5">
            <Tabs value={invoiceSubTab} onValueChange={(v) => setInvoiceSubTab(v as "header" | "items")}>
              <TabsList>
                <TabsTrigger value="header">Header Details</TabsTrigger>
                <TabsTrigger value="items">Variables / Line Items</TabsTrigger>
              </TabsList>

              <TabsContent value="header" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {invoiceSystemFields.map((fc) => {
                    if (!fc.systemColumn) return null;
                    const col = fc.systemColumn;
                    const v = headerValueFor(col);
                    const err = headerErrors[col];
                    const isFullRow = fc.type === "textarea";
                    return (
                      <div key={fc.id} className={isFullRow ? "md:col-span-2" : ""}>
                        <Label>{fc.name} {fc.required && <span className="text-destructive">*</span>}</Label>
                        <SystemInvoiceInput field={fc} value={v} onChange={(val) => setHeaderValueFor(col, val)} taxOptions={taxOptions} />
                        {fc.helpText && <p className="text-xs text-muted-foreground mt-1">{fc.helpText}</p>}
                        {err && <p className="text-xs text-destructive mt-1">{err}</p>}
                      </div>
                    );
                  })}
                </div>

                {invoiceCustomFields.length > 0 && (
                  <div className="border-t pt-5">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Additional invoice fields</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {invoiceCustomFields.map((fc) => (
                        <DynamicFieldRenderer
                          key={fc.id}
                          field={fc}
                          value={invoiceDynamic[fc.key]}
                          onChange={(val) => setInvoiceDynamic({ ...invoiceDynamic, [fc.key]: val ?? "" })}
                          error={invoiceDynamicErrors[fc.key]}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="items" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">Click + to add rows. Use <code>{`{{customer_name}}`}</code>, <code>{`{{tax_rate}}`}</code>, etc. in descriptions. Totals and tax are computed inside the template via formulas.</p>
                <div className="rounded-lg border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left">
                      <tr>
                        <th className="p-2 font-medium w-12">POS</th>
                        <th className="p-2 font-medium">Key</th>
                        <th className="p-2 font-medium">Label</th>
                        <th className="p-2 font-medium">Description</th>
                        <th className="p-2 font-medium w-20">Qty</th>
                        <th className="p-2 font-medium w-20">Unit</th>
                        <th className="p-2 font-medium w-24">Unit Price</th>
                        <th className="p-2 font-medium w-24">Tax</th>
                        <th className="p-2 font-medium w-24">Amount</th>
                        <th className="p-2 font-medium w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map((it, i) => (
                        <tr key={i}>
                          <td className="p-1"><Input inputMode="decimal" value={it.pos} onChange={(e) => updateItem(i, { pos: e.target.value })} className="h-8 w-16" /></td>
                          <td className="p-1"><Input value={it.key} onChange={(e) => updateItem(i, { key: e.target.value })} placeholder="line_key" className="h-8 font-mono text-xs" /></td>
                          <td className="p-1"><Input value={it.label} onChange={(e) => updateItem(i, { label: e.target.value })} className="h-8" /></td>
                          <td className="p-1"><Input value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} className="h-8" placeholder="e.g. Consulting for {{customer_name}}" /></td>
                          <td className="p-1"><Input value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} className="h-8" /></td>
                          <td className="p-1"><Input value={it.unit} onChange={(e) => updateItem(i, { unit: e.target.value })} placeholder="hr" className="h-8" /></td>
                          <td className="p-1"><Input value={it.unitPrice} onChange={(e) => updateItem(i, { unitPrice: e.target.value })} className="h-8" /></td>
                          <td className="p-1">
                            <Select value={it.taxType || "__none__"} onValueChange={(v) => updateItem(i, { taxType: v === "__none__" ? "" : v })}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">—</SelectItem>
                                {taxOptions.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-1"><Input value={it.amount} onChange={(e) => updateItem(i, { amount: e.target.value })} className="h-8" /></td>
                          <td className="p-1 text-right"><Button size="icon" variant="ghost" onClick={() => removeItem(i)} disabled={items.length <= 1}><X className="h-4 w-4" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4" /> Add row</Button>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setTab("details")}>Cancel</Button>
              <Button variant="outline" onClick={() => saveInvoice("save")} disabled={isPending}>Save</Button>
              <Button variant="outline" onClick={() => saveInvoice("next")} disabled={isPending}>Save & Next <ArrowRight className="h-4 w-4" /></Button>
              <Button onClick={() => saveInvoice("generate")} disabled={isPending} variant="amber">
                <Sparkles className="h-4 w-4" /> Save & Generate
              </Button>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="documents" className="m-0">
          <Card><CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">Documents</h2>
            {documents.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No documents yet for this customer"
                description="Generated documents will appear here. Go to Invoice Details and click Save & Generate."
              />
            ) : (
              <div className="divide-y">
                {documents.map((d) => (
                  <div key={d.id} className="flex items-center gap-4 py-3">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{d.fileName}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(d.createdAt)} · {formatBytes(d.fileSize)}</p>
                    </div>
                    <Badge variant="outline">{d.exportFormat}</Badge>
                    <Button asChild size="sm" variant="outline"><a href={`/api/documents/${d.id}/download`}><Download className="h-4 w-4" /></a></Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </div>

      <GenerateDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        customerId={customer?.id}
        invoiceId={invoice?.id ?? null}
        invoiceNumber={header.invoiceNumber}
        customerName={core.name}
        templates={templates}
        onDone={(docId) => {
          setGenerateOpen(false);
          setTab("documents");
          router.refresh();
          if (docId) toast.success("Document generated. Find it in the Documents tab.");
        }}
      />
    </Tabs>
  );
}

function SystemCustomerInput({ field, value, onChange }: { field: SystemFieldConfig; value: string; onChange: (v: string) => void }) {
  if (field.systemColumn === "status") {
    return (
      <Select value={value || "ACTIVE"} onValueChange={onChange}>
        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  if (field.type === "textarea") {
    return <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} className="mt-1" rows={2} />;
  }
  const inputType = field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text";
  return <Input type={inputType} value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} className="mt-1" />;
}

function SystemInvoiceInput({
  field, value, onChange, taxOptions,
}: {
  field: SystemFieldConfig;
  value: string;
  onChange: (v: string) => void;
  taxOptions: { label: string; value: string }[];
}) {
  if (field.systemColumn === "taxMode") {
    return (
      <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger className="mt-1"><SelectValue placeholder={field.placeholder ?? "Choose tax mode"} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">—</SelectItem>
          {taxOptions.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  if (field.type === "date") {
    return <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1" />;
  }
  if (field.type === "textarea") {
    return <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} className="mt-1" rows={2} />;
  }
  const isMono = field.systemColumn === "invoiceNumber" || field.systemColumn === "quoteNumber";
  return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} className={`mt-1 ${isMono ? "font-mono" : ""}`} />;
}

function GenerateDialog({
  open, onOpenChange, customerId, invoiceId, invoiceNumber, customerName, templates, onDone,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  customerId: string | undefined;
  invoiceId: string | null;
  invoiceNumber: string;
  customerName: string;
  templates: ReportTemplate[];
  onDone: (docId?: string) => void;
}) {
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? "");
  const [format, setFormat] = useState<"PDF" | "XML" | "PDFA3">("PDF");
  const [running, setRunning] = useState(false);

  const tpl = templates.find((t) => t.id === templateId);

  async function onGenerate() {
    if (!customerId || !templateId) return;
    setRunning(true);
    try {
      const res = await runGenerateDocument({ customerId, invoiceId, reportTemplateId: templateId, exportFormat: format });
      if (res.ok) {
        if (res.warning) toast.warning(res.warning);
        // Trigger immediate browser download. The file is already persisted in
        // GeneratedDocument (per-customer + global Documents) — this just hands
        // the user a local copy without an extra click.
        if (res.documentId) {
          const a = document.createElement("a");
          a.href = `/api/documents/${res.documentId}/download`;
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
        onDone(res.documentId);
      } else {
        toast.error(res.error);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate document</DialogTitle>
          <DialogDescription>Choose a template and export format. Your document is ready in seconds.</DialogDescription>
        </DialogHeader>

        {templates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No active templates"
            description="Upload a template under Configuration → Report Mappings first."
          />
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Report template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.reportName} ({t.templateType})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Export format</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {(["PDF", "XML", "PDFA3"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`rounded-md border p-3 text-sm transition-colors ${format === f ? "border-amber bg-amber/10 text-foreground" : "hover:bg-muted/40"}`}
                  >
                    <div className="font-medium">{f === "PDFA3" ? "PDF/A-3" : f}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {f === "PDF" ? "Standard PDF" : f === "XML" ? "Structured data" : "Archive-ready"}
                    </div>
                  </button>
                ))}
              </div>
              {format === "PDFA3" && (
                <p className="mt-2 text-xs text-amber-foreground bg-amber/10 border border-amber/20 rounded-md p-2">
                  PDF/A-3 conversion is currently a placeholder — see <code>src/lib/document-generation/pdfa3.ts</code> to wire up a real provider.
                </p>
              )}
            </div>

            {tpl && (
              <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{customerName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Invoice</span><span className="font-mono">{invoiceNumber || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Template</span><span>{tpl.reportName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Format</span><span>{format}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Filename formula</span><span className="font-mono">{tpl.fileNameFormula}</span></div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>Cancel</Button>
          <Button onClick={onGenerate} disabled={running || !templateId} variant="amber">
            <Sparkles className="h-4 w-4" /> {running ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
