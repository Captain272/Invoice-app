"use server";

import { prisma } from "@/lib/prisma";

const COMPANY_SYSTEM_FIELDS = [
  { key: "company_name", name: "Company name", type: "text" as const, displayOrder: -100, required: true, systemColumn: "companyName" },
  { key: "vat_id", name: "VAT ID", type: "text" as const, displayOrder: -90, required: false, systemColumn: "vatId" },
  { key: "address", name: "Address", type: "textarea" as const, displayOrder: -80, required: false, systemColumn: "address" },
  { key: "email", name: "Email", type: "email" as const, displayOrder: -70, required: false, systemColumn: "email" },
  { key: "phone", name: "Phone", type: "phone" as const, displayOrder: -60, required: false, systemColumn: "phone" },
  { key: "website", name: "Website", type: "text" as const, displayOrder: -50, required: false, systemColumn: "website" },
  { key: "tax_number", name: "Tax number", type: "text" as const, displayOrder: -40, required: false, systemColumn: "taxNumber" },
  { key: "bank_name", name: "Bank name", type: "text" as const, displayOrder: -30, required: false, systemColumn: "bankName" },
  { key: "iban", name: "IBAN", type: "text" as const, displayOrder: -20, required: false, systemColumn: "iban" },
  { key: "swift", name: "SWIFT / BIC", type: "text" as const, displayOrder: -10, required: false, systemColumn: "swift" },
];

const CUSTOMER_SYSTEM_FIELDS = [
  { key: "name", name: "Name", type: "text" as const, displayOrder: -50, required: true, systemColumn: "name" },
  { key: "email", name: "Email", type: "email" as const, displayOrder: -40, required: false, systemColumn: "email" },
  { key: "phone", name: "Phone", type: "phone" as const, displayOrder: -30, required: false, systemColumn: "phone" },
  { key: "status", name: "Status", type: "select" as const, displayOrder: -20, required: false, systemColumn: "status" },
  { key: "address", name: "Address", type: "textarea" as const, displayOrder: -10, required: false, systemColumn: "address" },
];

const INVOICE_SYSTEM_FIELDS = [
  { key: "invoice_number", name: "Invoice number", type: "text" as const, displayOrder: -90, required: true, systemColumn: "invoiceNumber" },
  { key: "quote_number", name: "Quote number", type: "text" as const, displayOrder: -80, required: false, systemColumn: "quoteNumber" },
  { key: "invoice_date", name: "Invoice date", type: "date" as const, displayOrder: -70, required: false, systemColumn: "invoiceDate" },
  { key: "payment_terms", name: "Payment terms", type: "text" as const, displayOrder: -60, required: false, systemColumn: "paymentTerms", placeholder: "Net 30" },
  { key: "performance_period_start", name: "Performance period start", type: "date" as const, displayOrder: -50, required: false, systemColumn: "performancePeriodStart" },
  { key: "performance_period_end", name: "Performance period end", type: "date" as const, displayOrder: -40, required: false, systemColumn: "performancePeriodEnd" },
  { key: "tax_mode", name: "Tax mode", type: "select" as const, displayOrder: -30, required: false, systemColumn: "taxMode" },
  { key: "currency", name: "Currency", type: "text" as const, displayOrder: -20, required: false, systemColumn: "currency", defaultValue: "EUR" },
  { key: "notes", name: "Notes", type: "textarea" as const, displayOrder: -10, required: false, systemColumn: "notes" },
];

const INVOICE_VARIABLES = [
  { scope: "line_item", key: "pos", label: "POS", displayOrder: 0, description: "Line item position" },
  { scope: "line_item", key: "key", label: "Key", displayOrder: 1, description: null },
  { scope: "line_item", key: "label", label: "Label", displayOrder: 2, description: null },
  { scope: "line_item", key: "description", label: "Description", displayOrder: 3, description: null },
  { scope: "line_item", key: "quantity", label: "Quantity", displayOrder: 4, description: null },
  { scope: "line_item", key: "unit", label: "Unit", displayOrder: 5, description: null },
  { scope: "line_item", key: "unit_price", label: "Unit price", displayOrder: 6, description: null },
  { scope: "line_item", key: "tax", label: "Tax", displayOrder: 7, description: null },
  { scope: "line_item", key: "amount", label: "Amount", displayOrder: 8, description: null },
  { scope: "placeholder", key: "today", label: "Today's date", displayOrder: 0, description: "Auto-filled at generation time" },
  { scope: "placeholder", key: "customer_name", label: "Customer name", displayOrder: 1, description: null },
  { scope: "placeholder", key: "company_name", label: "Company name", displayOrder: 2, description: null },
];

let bootstrapped = false;

// Run an array of write thunks in small sequential batches so we never open
// more connections than the Prisma pool allows (default 5). Fanning all ~36
// upserts out at once exhausts the pool and triggers P2024 timeouts.
async function runBatched(thunks: Array<() => PromiseLike<unknown>>, size = 4): Promise<void> {
  for (let i = 0; i < thunks.length; i += size) {
    await Promise.all(thunks.slice(i, i + size).map((run) => run()));
  }
}

export async function ensureSystemConfig(): Promise<void> {
  if (bootstrapped) return;

  // Cheap existence check: if the system rows are already seeded, skip the
  // upsert stampede entirely. The in-memory `bootstrapped` flag resets on every
  // serverless cold start, so without this guard the writes ran on every load.
  const [companyCount, customerCount, invoiceCount, variableCount] = await Promise.all([
    prisma.companyFieldConfig.count({ where: { isSystem: true } }),
    prisma.customerFieldConfig.count({ where: { isSystem: true } }),
    prisma.invoiceFieldConfig.count({ where: { isSystem: true } }),
    prisma.invoiceVariable.count(),
  ]);

  if (
    companyCount >= COMPANY_SYSTEM_FIELDS.length &&
    customerCount >= CUSTOMER_SYSTEM_FIELDS.length &&
    invoiceCount >= INVOICE_SYSTEM_FIELDS.length &&
    variableCount >= INVOICE_VARIABLES.length
  ) {
    bootstrapped = true;
    return;
  }

  await runBatched([
    ...COMPANY_SYSTEM_FIELDS.map((f) => () =>
      prisma.companyFieldConfig.upsert({
        where: { key: f.key },
        update: { isSystem: true, systemColumn: f.systemColumn },
        create: { ...f, isSystem: true, isActive: true },
      }),
    ),
    ...CUSTOMER_SYSTEM_FIELDS.map((f) => () =>
      prisma.customerFieldConfig.upsert({
        where: { key: f.key },
        update: { isSystem: true, systemColumn: f.systemColumn },
        create: { ...f, isSystem: true, isActive: true },
      }),
    ),
    ...INVOICE_SYSTEM_FIELDS.map((f) => () =>
      prisma.invoiceFieldConfig.upsert({
        where: { key: f.key },
        update: { isSystem: true, systemColumn: f.systemColumn },
        create: { ...f, isSystem: true, isActive: true },
      }),
    ),
    ...INVOICE_VARIABLES.map((v) => () =>
      prisma.invoiceVariable.upsert({
        where: { scope_key: { scope: v.scope, key: v.key } },
        update: {},
        create: { ...v, isActive: true },
      }),
    ),
  ]);

  bootstrapped = true;
}
