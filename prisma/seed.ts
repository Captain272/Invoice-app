import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

const SAMPLE_INVOICE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Invoice {{invoice_number}}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1a1f2e; padding: 0; margin: 0; }
  .wrap { padding: 40px 48px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #eee; padding-bottom: 24px; margin-bottom: 32px; }
  h1 { font-size: 28px; margin: 0 0 4px; letter-spacing: -0.02em; }
  .muted { color: #6b7280; font-size: 13px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
  .label { text-transform: uppercase; letter-spacing: 0.05em; font-size: 10px; color: #9ca3af; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 10px 8px; background: #f9fafb; font-weight: 600; border-bottom: 1px solid #e5e7eb; }
  td { padding: 10px 8px; border-bottom: 1px solid #f0f1f3; }
  .right { text-align: right; }
  .totals { margin-top: 24px; margin-left: auto; width: 280px; }
  .totals tr td:last-child { font-weight: 600; }
  .totals .grand { border-top: 2px solid #1a1f2e; font-size: 16px; }
  .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #eee; font-size: 11px; color: #9ca3af; }
</style>
</head>
<body><div class="wrap">
  <div class="header">
    <div>
      <h1>Invoice</h1>
      <div class="muted">Invoice #{{invoice_number}}{{if quote_number}} · Quote #{{quote_number}}{{/if}}</div>
      <div class="muted">{{invoice_date}}</div>
    </div>
    <div>
      {{{company_logo}}}
      <div style="font-weight:600; margin-top: 8px;">{{company_name}}</div>
      <div class="muted">{{company.address}}</div>
    </div>
  </div>

  <div class="grid">
    <div>
      <div class="label">Bill to</div>
      <div style="font-weight:600;">{{customer_name}}</div>
      <div class="muted">{{customer_address}}</div>
      <div class="muted">{{customer_email}}</div>
    </div>
    <div>
      <div class="label">Details</div>
      <div class="muted">Currency: {{currency}}</div>
      {{if invoice.payment_terms}}<div class="muted">Payment terms: {{invoice.payment_terms}}</div>{{/if}}
      {{if invoice.tax_mode}}<div class="muted">Tax mode: {{invoice.tax_mode}}%</div>{{/if}}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:40px">#</th>
        <th>Description</th>
        <th class="right" style="width:60px">Qty</th>
        <th class="right" style="width:80px">Unit price</th>
        <th class="right" style="width:90px">Amount</th>
      </tr>
    </thead>
    <tbody>
      {{#line_items}}
      <tr>
        <td>{{pos}}</td>
        <td>{{description}}{{if label}} <span class="muted">— {{label}}</span>{{/if}}</td>
        <td class="right">{{quantity}}{{if unit}} {{unit}}{{/if}}</td>
        <td class="right">{{unit_price}}</td>
        <td class="right">{{formula: quantity * unit_price}}</td>
      </tr>
      {{/line_items}}
    </tbody>
  </table>

  <table class="totals">
    <tr><td class="muted">Subtotal</td><td class="right">{{subtotal}} {{currency}}</td></tr>
    {{if invoice.tax_mode}}
    <tr><td class="muted">Tax ({{invoice.tax_mode}}%)</td><td class="right">{{formula: subtotal * (invoice.tax_mode / 100)}} {{currency}}</td></tr>
    <tr class="grand"><td>Total</td><td class="right">{{formula: subtotal + subtotal * (invoice.tax_mode / 100)}} {{currency}}</td></tr>
    {{else}}
    <tr class="grand"><td>Total</td><td class="right">{{subtotal}} {{currency}}</td></tr>
    {{/if}}
  </table>

  {{if invoice.notes}}
  <div style="margin-top: 32px;"><div class="label">Notes</div><div>{{invoice.notes}}</div></div>
  {{/if}}

  <div class="footer">
    <strong>{{company_name}}</strong> · {{company.email}} · {{company.website}}<br />
    {{if company.iban}}IBAN: {{company.iban}} · BIC: {{company.swift}}{{/if}}<br />
    VAT ID: {{company.vat_id}}
  </div>
</div></body>
</html>`;

const SAMPLE_INVOICE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice>
  <Header>
    <Number>{{invoice_number}}</Number>
    <Date>{{invoice_date}}</Date>
    <Currency>{{currency}}</Currency>
  </Header>
  <Supplier>
    <Name>{{company_name}}</Name>
    <VatId>{{company.vat_id}}</VatId>
    <Address>{{company.address}}</Address>
  </Supplier>
  <Customer>
    <Name>{{customer_name}}</Name>
    <Email>{{customer_email}}</Email>
    <Address>{{customer_address}}</Address>
  </Customer>
  <LineItems>
    {{#line_items}}
    <Item pos="{{pos}}">
      <Description>{{description}}</Description>
      <Quantity>{{quantity}}</Quantity>
      <UnitPrice>{{unit_price}}</UnitPrice>
      <Amount>{{formula: quantity * unit_price}}</Amount>
      <Tax>{{tax_type}}</Tax>
    </Item>
    {{/line_items}}
  </LineItems>
  <Totals>
    <Subtotal>{{subtotal}}</Subtotal>
    {{if invoice.tax_mode}}<TaxAmount>{{formula: subtotal * (invoice.tax_mode / 100)}}</TaxAmount>{{/if}}
    <Total>{{formula: subtotal + (invoice.tax_mode ? subtotal * (invoice.tax_mode / 100) : 0)}}</Total>
  </Totals>
</Invoice>`;

async function ensureUploadDirs() {
  // No-op: storage is now Supabase Storage. Bucket is auto-created on first write.
}

async function main() {
  await ensureUploadDirs();

  // ---- SUPER ADMIN ----
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) {
    console.warn(
      "⚠️  NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping admin auth user creation. " +
      "Set them and re-run the seed, or sign up via the login page and add the email to SUPER_ADMIN_EMAILS.",
    );
  } else {
    const supa = createClient(supaUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Try to create the Supabase auth user; if it already exists, look it up.
    let adminId: string | undefined;
    const created = await supa.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: "Platform Admin" },
    });
    if (created.data.user) {
      adminId = created.data.user.id;
    } else {
      // listUsers is paginated; for a seed we just scan page 1.
      const list = await supa.auth.admin.listUsers({ page: 1, perPage: 200 });
      adminId = list.data.users.find((u) => u.email?.toLowerCase() === adminEmail)?.id;
    }

    if (adminId) {
      await prisma.user.upsert({
        where: { email: adminEmail },
        update: { id: adminId, role: "SUPER_ADMIN", status: "ACTIVE" },
        create: {
          id: adminId,
          name: "Platform Admin",
          email: adminEmail,
          role: "SUPER_ADMIN",
          status: "ACTIVE",
        },
      });
      console.log(`✅ Admin ready: ${adminEmail}`);
    } else {
      console.warn(`⚠️  Could not provision admin auth user for ${adminEmail}`);
    }
  }

  // ---- TAX OPTION MAPPER ----
  const taxMapper = await prisma.optionMapper.upsert({
    where: { key: "tax_type" },
    update: {},
    create: {
      key: "tax_type", label: "Tax Type", isActive: true,
      values: { create: [
        { label: "19%", value: "19", displayOrder: 0 },
        { label: "16%", value: "16", displayOrder: 1 },
        { label: "0%", value: "0", displayOrder: 2 },
        { label: "§13b (reverse charge)", value: "13b", displayOrder: 3 },
      ]},
    },
  });

  // ---- CUSTOMER FIELD CONFIGS ----
  // System (hardcoded-column) customer fields, surfaced in Configuration so they
  // can be relabeled / marked required, but not renamed or deleted.
  const customerSystemFields = [
    { key: "name", name: "Name", type: "text" as const, displayOrder: -50, required: true, systemColumn: "name" },
    { key: "email", name: "Email", type: "email" as const, displayOrder: -40, systemColumn: "email" },
    { key: "phone", name: "Phone", type: "phone" as const, displayOrder: -30, systemColumn: "phone" },
    { key: "status", name: "Status", type: "select" as const, displayOrder: -20, systemColumn: "status" },
    { key: "address", name: "Address", type: "textarea" as const, displayOrder: -10, systemColumn: "address" },
  ];
  for (const f of customerSystemFields) {
    await prisma.customerFieldConfig.upsert({
      where: { key: f.key },
      update: { isSystem: true, systemColumn: f.systemColumn, type: f.type },
      create: { ...f, isSystem: true, isActive: true, required: f.required ?? false },
    });
  }

  const customerFields = [
    { key: "vat_number", name: "VAT Number", type: "text" as const, displayOrder: 1, placeholder: "DE123456789", helpText: "EU VAT identifier" },
    { key: "industry", name: "Industry", type: "text" as const, displayOrder: 2 },
    { key: "customer_since", name: "Customer Since", type: "date" as const, displayOrder: 3 },
  ];
  for (const f of customerFields) {
    await prisma.customerFieldConfig.upsert({
      where: { key: f.key },
      update: {},
      create: { ...f, required: false, isActive: true },
    });
  }

  // ---- INVOICE FIELD CONFIGS (system) ----
  const invoiceSystemFields = [
    { key: "invoice_number", name: "Invoice number", type: "text" as const, displayOrder: -90, required: true, systemColumn: "invoiceNumber" },
    { key: "quote_number", name: "Quote number", type: "text" as const, displayOrder: -80, systemColumn: "quoteNumber" },
    { key: "invoice_date", name: "Invoice date", type: "date" as const, displayOrder: -70, systemColumn: "invoiceDate" },
    { key: "payment_terms", name: "Payment terms", type: "text" as const, displayOrder: -60, systemColumn: "paymentTerms", placeholder: "Net 30" },
    { key: "performance_period_start", name: "Performance period start", type: "date" as const, displayOrder: -50, systemColumn: "performancePeriodStart" },
    { key: "performance_period_end", name: "Performance period end", type: "date" as const, displayOrder: -40, systemColumn: "performancePeriodEnd" },
    { key: "tax_mode", name: "Tax mode", type: "select" as const, displayOrder: -30, systemColumn: "taxMode" },
    { key: "currency", name: "Currency", type: "text" as const, displayOrder: -20, systemColumn: "currency", defaultValue: "EUR" },
    { key: "notes", name: "Notes", type: "textarea" as const, displayOrder: -10, systemColumn: "notes" },
  ];
  for (const f of invoiceSystemFields) {
    await prisma.invoiceFieldConfig.upsert({
      where: { key: f.key },
      update: { isSystem: true, systemColumn: f.systemColumn },
      create: { ...f, isSystem: true, isActive: true, required: f.required ?? false },
    });
  }

  // ---- INVOICE VARIABLES (line item / placeholder defaults) ----
  const invoiceVariables = [
    { scope: "line_item", key: "pos", label: "POS", displayOrder: 0, description: "Line item position" },
    { scope: "line_item", key: "key", label: "Key", displayOrder: 1 },
    { scope: "line_item", key: "label", label: "Label", displayOrder: 2 },
    { scope: "line_item", key: "description", label: "Description", displayOrder: 3 },
    { scope: "line_item", key: "quantity", label: "Quantity", displayOrder: 4 },
    { scope: "line_item", key: "unit", label: "Unit", displayOrder: 5 },
    { scope: "line_item", key: "unit_price", label: "Unit price", displayOrder: 6 },
    { scope: "line_item", key: "tax", label: "Tax", displayOrder: 7 },
    { scope: "line_item", key: "amount", label: "Amount", displayOrder: 8 },
    { scope: "placeholder", key: "today", label: "Today's date", displayOrder: 0, description: "Auto-filled at generation time" },
    { scope: "placeholder", key: "customer_name", label: "Customer name", displayOrder: 1 },
    { scope: "placeholder", key: "company_name", label: "Company name", displayOrder: 2 },
  ];
  for (const v of invoiceVariables) {
    await prisma.invoiceVariable.upsert({
      where: { scope_key: { scope: v.scope, key: v.key } },
      update: {},
      create: { ...v, isActive: true },
    });
  }

  // ---- COMPANY FIELD CONFIGS ----
  const companyFields = [
    { key: "trade_register", name: "Trade Register", type: "text" as const, displayOrder: 1 },
    { key: "managing_director", name: "Managing Director", type: "text" as const, displayOrder: 2 },
  ];
  for (const f of companyFields) {
    await prisma.companyFieldConfig.upsert({
      where: { key: f.key },
      update: {},
      create: { ...f, required: false, isActive: true },
    });
  }

  // ---- COMPANY PROFILE ----
  const existingCompany = await prisma.companyProfile.findFirst();
  if (!existingCompany) {
    await prisma.companyProfile.create({
      data: {
        companyName: "Acme GmbH",
        address: "Musterstraße 12, 10115 Berlin, Germany",
        vatId: "DE123456789",
        email: "billing@acme.example",
        phone: "+49 30 12345678",
        website: "acme.example",
        bankName: "Berliner Sparkasse",
        iban: "DE89 3704 0044 0532 0130 00",
        swift: "COBADEFFXXX",
        taxNumber: "30/123/45678",
      },
    });
  }

  // ---- REPORT TEMPLATES ----
  // Upload sample templates to Supabase Storage (bucket "uploads", prefix "templates/").
  const { writeFile: storageWrite, STORAGE } = await import("../src/lib/storage/local");
  const htmlKey = await storageWrite(STORAGE.templates, "sample_invoice.html", SAMPLE_INVOICE_HTML);
  const xmlKey = await storageWrite(STORAGE.templates, "sample_invoice.xml", SAMPLE_INVOICE_XML);

  const htmlTpl = await prisma.reportTemplate.findFirst({ where: { reportName: "Standard Invoice (HTML)" } });
  if (!htmlTpl) {
    await prisma.reportTemplate.create({
      data: {
        reportName: "Standard Invoice (HTML)",
        reportType: "invoice",
        templateType: "HTML",
        fileNameFormula: "invoice_{{invoice_number}}_{{customer_name}}_{{today}}",
        templatePath: htmlKey,
        originalFileName: "sample_invoice.html",
        version: 1,
        isActive: true,
        description: "Production-ready invoice with header, line items, totals, and tax calculation.",
      },
    });
  } else {
    await prisma.reportTemplate.update({ where: { id: htmlTpl.id }, data: { templatePath: htmlKey } });
  }
  const xmlTpl = await prisma.reportTemplate.findFirst({ where: { reportName: "Invoice Export (XML)" } });
  if (!xmlTpl) {
    await prisma.reportTemplate.create({
      data: {
        reportName: "Invoice Export (XML)",
        reportType: "invoice",
        templateType: "XML",
        fileNameFormula: "invoice_{{invoice_number}}_{{today}}",
        templatePath: xmlKey,
        originalFileName: "sample_invoice.xml",
        version: 1,
        isActive: true,
        description: "Structured XML export for downstream systems and e-invoicing.",
      },
    });
  } else {
    await prisma.reportTemplate.update({ where: { id: xmlTpl.id }, data: { templatePath: xmlKey } });
  }

  // ---- SAMPLE CUSTOMER ----
  const existingCustomer = await prisma.customer.findFirst({ where: { email: "max@globex.example" } });
  if (!existingCustomer) {
    const customer = await prisma.customer.create({
      data: {
        name: "Globex Corp.",
        email: "max@globex.example",
        phone: "+49 30 11122233",
        address: "Hauptstraße 5, 10117 Berlin",
        status: "ACTIVE",
      },
    });

    const fieldConfigs = await prisma.customerFieldConfig.findMany();
    for (const fc of fieldConfigs) {
      const sample: Record<string, string> = {
        vat_number: "DE987654321",
        industry: "Software",
        customer_since: "2024-01-15",
      };
      if (sample[fc.key]) {
        await prisma.customerFieldValue.create({
          data: { customerId: customer.id, fieldConfigId: fc.id, key: fc.key, value: sample[fc.key] },
        });
      }
    }

    const invoice = await prisma.invoice.create({
      data: {
        customerId: customer.id,
        invoiceNumber: "INV-2026-0001",
        quoteNumber: "Q-2026-0001",
        invoiceDate: new Date(),
        paymentTerms: "Net 30",
        taxMode: "19",
        currency: "EUR",
        notes: "Thank you for your business.",
        status: "DRAFT",
      },
    });
    await prisma.invoiceLineItem.createMany({
      data: [
        { invoiceId: invoice.id, pos: 1, key: "consulting", label: "Consulting", description: "Senior engineering consulting for {{customer_name}}", quantity: 12, unit: "hr", unitPrice: 180, taxType: "19", amount: 2160, displayOrder: 0 },
        { invoiceId: invoice.id, pos: 2, key: "setup", label: "Project setup", description: "One-time onboarding", quantity: 1, unit: "ea", unitPrice: 500, taxType: "19", amount: 500, displayOrder: 1 },
      ],
    });
  }

  console.log("✅ Seed complete.");
  console.log("   Login: admin@example.com / Admin@12345");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
