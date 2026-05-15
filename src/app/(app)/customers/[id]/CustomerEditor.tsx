"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Plus, Trash2, FileText, Download, Sparkles, X } from "lucide-react";
import type { Customer, CustomerFieldValue, GeneratedDocument, Invoice, InvoiceLineItem, ReportTemplate } from "@prisma/client";
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

type FieldConfig = DynamicField;
type InvoiceWithItems = (Invoice & { lineItems: InvoiceLineItem[] }) | null;
type CustomerWithValues = (Customer & { fieldValues: CustomerFieldValue[] }) | null;

const TAX_DEFAULT = [
  { label: "19%", value: "19" },
  { label: "16%", value: "16" },
  { label: "0%", value: "0" },
  { label: "§13b", value: "13b" },
];

export function CustomerEditor({
  customer,
  fieldConfigs,
  invoice,
  documents,
  templates,
  taxMapper,
}: {
  customer: CustomerWithValues;
  fieldConfigs: FieldConfig[];
  invoice: InvoiceWithItems;
  documents: GeneratedDocument[];
  templates: ReportTemplate[];
  taxMapper: { label: string; value: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState("details");

  // Core
  const [core, setCore] = useState({
    name: customer?.name ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    address: customer?.address ?? "",
    status: (customer?.status ?? "ACTIVE") as "ACTIVE" | "INACTIVE" | "ARCHIVED",
  });

  // Dynamic field values
  const initialDynamic: Record<string, string | null> = {};
  for (const fc of fieldConfigs) {
    const fv = customer?.fieldValues.find((v) => v.fieldConfigId === fc.id);
    initialDynamic[fc.key] = fv?.value ?? fc.defaultValue ?? "";
  }
  const [dynamic, setDynamic] = useState(initialDynamic);
  const [dynamicErrors, setDynamicErrors] = useState<Record<string, string>>({});

  // Invoice header
  const [header, setHeader] = useState({
    invoiceNumber: invoice?.invoiceNumber ?? "",
    quoteNumber: invoice?.quoteNumber ?? "",
    invoiceDate: invoice?.invoiceDate ? invoice.invoiceDate.toISOString().split("T")[0] : "",
    performancePeriodStart: invoice?.performancePeriodStart ? invoice.performancePeriodStart.toISOString().split("T")[0] : "",
    performancePeriodEnd: invoice?.performancePeriodEnd ? invoice.performancePeriodEnd.toISOString().split("T")[0] : "",
    paymentTerms: invoice?.paymentTerms ?? "",
    taxMode: invoice?.taxMode ?? "",
    currency: invoice?.currency ?? "EUR",
    notes: invoice?.notes ?? "",
  });

  type LineItem = {
    pos: number; key: string; label: string; description: string;
    quantity: string; unit: string; unitPrice: string; taxType: string; amount: string; value: string;
  };
  const initialItems: LineItem[] = invoice?.lineItems.length
    ? invoice.lineItems.map((li) => ({
        pos: li.pos, key: li.key ?? "", label: li.label ?? "", description: li.description ?? "",
        quantity: String(li.quantity), unit: li.unit ?? "", unitPrice: String(li.unitPrice),
        taxType: li.taxType ?? "", amount: String(li.amount), value: li.value ?? "",
      }))
    : [{ pos: 1, key: "", label: "", description: "", quantity: "1", unit: "", unitPrice: "0", taxType: "", amount: "0", value: "" }];
  const [items, setItems] = useState<LineItem[]>(initialItems);

  const [invoiceSubTab, setInvoiceSubTab] = useState<"header" | "items">("header");
  const [isPending, startTransition] = useTransition();
  const [generateOpen, setGenerateOpen] = useState(false);

  const taxOptions = taxMapper.length > 0 ? taxMapper : TAX_DEFAULT;

  function validateDynamic(): boolean {
    const errs: Record<string, string> = {};
    for (const fc of fieldConfigs) {
      if (fc.required) {
        const v = dynamic[fc.key];
        if (v === null || v === undefined || v === "") errs[fc.key] = `${fc.name} is required`;
      }
    }
    setDynamicErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function saveDetails(advance: boolean) {
    if (!core.name) { toast.error("Name is required"); return; }
    if (!validateDynamic()) { toast.error("Please fill required fields"); return; }
    startTransition(async () => {
      try {
        const payload = { core, dynamic };
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
    if (!header.invoiceNumber) { toast.error("Invoice number is required"); setInvoiceSubTab("header"); return; }
    startTransition(async () => {
      try {
        await saveInvoiceForCustomer({
          customerId: customer.id,
          invoiceId: invoice?.id ?? null,
          header,
          lineItems: items.map((li, i) => ({
            pos: li.pos ?? i + 1,
            key: li.key || null,
            label: li.label || null,
            description: li.description || null,
            quantity: Number(li.quantity) || 0,
            unit: li.unit || null,
            unitPrice: Number(li.unitPrice) || 0,
            taxType: li.taxType || null,
            amount: Number(li.amount) || Number(li.quantity) * Number(li.unitPrice) || 0,
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
      { pos: items.length + 1, key: "", label: "", description: "", quantity: "1", unit: "", unitPrice: "0", taxType: "", amount: "0", value: "" },
    ]);
  }

  function updateItem(i: number, patch: Partial<LineItem>) {
    setItems(items.map((it, idx) => {
      if (idx !== i) return it;
      const next = { ...it, ...patch };
      // Auto-compute amount if not manually set
      const q = Number(next.quantity), p = Number(next.unitPrice);
      if (Number.isFinite(q) && Number.isFinite(p)) next.amount = String(+(q * p).toFixed(2));
      return next;
    }));
  }

  function removeItem(i: number) {
    setItems(items.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, pos: idx + 1 })));
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
              <div><Label>Name <span className="text-destructive">*</span></Label><Input value={core.name} onChange={(e) => setCore({ ...core, name: e.target.value })} className="mt-1" /></div>
              <div><Label>Email</Label><Input type="email" value={core.email} onChange={(e) => setCore({ ...core, email: e.target.value })} className="mt-1" /></div>
              <div><Label>Phone</Label><Input value={core.phone} onChange={(e) => setCore({ ...core, phone: e.target.value })} className="mt-1" /></div>
              <div>
                <Label>Status</Label>
                <Select value={core.status} onValueChange={(v) => setCore({ ...core, status: v as "ACTIVE" | "INACTIVE" | "ARCHIVED" })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2"><Label>Address</Label><Textarea value={core.address} onChange={(e) => setCore({ ...core, address: e.target.value })} className="mt-1" rows={2} /></div>
            </div>

            {fieldConfigs.length > 0 && (
              <>
                <div className="border-t pt-5">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Additional fields</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {fieldConfigs.map((fc) => (
                      <DynamicFieldRenderer
                        key={fc.id}
                        field={fc}
                        value={dynamic[fc.key]}
                        onChange={(v) => setDynamic({ ...dynamic, [fc.key]: v ?? "" })}
                        error={dynamicErrors[fc.key]}
                      />
                    ))}
                  </div>
                </div>
              </>
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
                  <div><Label>Invoice number <span className="text-destructive">*</span></Label><Input value={header.invoiceNumber} onChange={(e) => setHeader({ ...header, invoiceNumber: e.target.value })} className="mt-1 font-mono" /></div>
                  <div><Label>Quote number</Label><Input value={header.quoteNumber} onChange={(e) => setHeader({ ...header, quoteNumber: e.target.value })} className="mt-1 font-mono" /></div>
                  <div><Label>Invoice date</Label><Input type="date" value={header.invoiceDate} onChange={(e) => setHeader({ ...header, invoiceDate: e.target.value })} className="mt-1" /></div>
                  <div><Label>Payment terms</Label><Input value={header.paymentTerms} onChange={(e) => setHeader({ ...header, paymentTerms: e.target.value })} placeholder="Net 30" className="mt-1" /></div>
                  <div><Label>Performance period start</Label><Input type="date" value={header.performancePeriodStart} onChange={(e) => setHeader({ ...header, performancePeriodStart: e.target.value })} className="mt-1" /></div>
                  <div><Label>Performance period end</Label><Input type="date" value={header.performancePeriodEnd} onChange={(e) => setHeader({ ...header, performancePeriodEnd: e.target.value })} className="mt-1" /></div>
                  <div>
                    <Label>Tax mode</Label>
                    <Select value={header.taxMode || "__none__"} onValueChange={(v) => setHeader({ ...header, taxMode: v === "__none__" ? "" : v })}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Choose tax mode" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {taxOptions.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Currency</Label><Input value={header.currency} onChange={(e) => setHeader({ ...header, currency: e.target.value })} className="mt-1" /></div>
                  <div className="md:col-span-2"><Label>Notes</Label><Textarea value={header.notes} onChange={(e) => setHeader({ ...header, notes: e.target.value })} className="mt-1" rows={2} /></div>
                </div>
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
                          <td className="p-1"><Input value={it.pos} onChange={(e) => updateItem(i, { pos: Number(e.target.value) || i + 1 })} className="h-8 w-14" /></td>
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
