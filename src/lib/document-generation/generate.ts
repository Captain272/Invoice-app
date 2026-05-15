import { prisma } from "@/lib/prisma";
import { renderTemplate, renderFileName } from "@/lib/template-engine/render";
import { STORAGE, writeFile, readFile, toDataUrl } from "@/lib/storage/local";
import { htmlToPdf } from "./pdf";
import { convertToPdfA3 } from "./pdfa3";
import { logAudit } from "@/lib/audit";
import type { ExportFormat, Prisma } from "@prisma/client";

export type GenerateInput = {
  customerId: string;
  invoiceId?: string | null;
  reportTemplateId: string;
  exportFormat: ExportFormat;
  generatedById?: string | null;
};

export async function generateDocument(input: GenerateInput) {
  const [customer, fieldValues, fieldConfigs, company, companyFieldValues, companyFieldConfigs, template, invoice] = await Promise.all([
    prisma.customer.findUnique({ where: { id: input.customerId } }),
    prisma.customerFieldValue.findMany({ where: { customerId: input.customerId }, include: { fieldConfig: true } }),
    prisma.customerFieldConfig.findMany({ where: { isActive: true } }),
    prisma.companyProfile.findFirst(),
    prisma.companyFieldValue.findMany({ include: { fieldConfig: true } }),
    prisma.companyFieldConfig.findMany({ where: { isActive: true } }),
    prisma.reportTemplate.findUnique({ where: { id: input.reportTemplateId } }),
    input.invoiceId
      ? prisma.invoice.findUnique({
          where: { id: input.invoiceId },
          include: { lineItems: { orderBy: { displayOrder: "asc" } } },
        })
      : Promise.resolve(null),
  ]);

  if (!customer) throw new Error("Customer not found");
  if (!template) throw new Error("Report template not found");

  // Build template data
  const customerFields: Record<string, string | null> = {};
  for (const fc of fieldConfigs) {
    const fv = fieldValues.find((v) => v.fieldConfigId === fc.id);
    customerFields[fc.key] = fv?.value ?? fc.defaultValue ?? null;
  }
  const companyFields: Record<string, string | null> = {};
  for (const fc of companyFieldConfigs) {
    const fv = companyFieldValues.find((v) => v.fieldConfigId === fc.id);
    companyFields[fc.key] = fv?.value ?? fc.defaultValue ?? null;
  }

  const lineItems = (invoice?.lineItems ?? []).map((li) => ({
    pos: li.pos,
    key: li.key,
    label: li.label,
    description: li.description,
    quantity: li.quantity,
    unit: li.unit,
    unit_price: li.unitPrice,
    tax_type: li.taxType,
    amount: li.amount || li.quantity * li.unitPrice,
    value: li.value,
  }));

  const subtotal = lineItems.reduce((s, li) => s + li.amount, 0);

  const data = {
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
    },
    customer_name: customer.name,
    customer_email: customer.email,
    customer_address: customer.address,
    ...customerFields,
    company: company
      ? {
          name: company.companyName,
          address: company.address,
          vat_id: company.vatId,
          email: company.email,
          phone: company.phone,
          website: company.website,
          bank_name: company.bankName,
          iban: company.iban,
          swift: company.swift,
          tax_number: company.taxNumber,
          logo_url: company.logoUrl,
        }
      : null,
    company_name: company?.companyName ?? null,
    company_logo: company?.logoUrl
      ? `<img src="${await toDataUrl(company.logoUrl).catch(() => company.logoUrl)}" alt="${company.companyName}" style="max-height:80px" />`
      : "",
    ...companyFields,
    invoice: invoice
      ? {
          number: invoice.invoiceNumber,
          quote_number: invoice.quoteNumber,
          date: invoice.invoiceDate?.toISOString().split("T")[0] ?? "",
          period_start: invoice.performancePeriodStart?.toISOString().split("T")[0] ?? "",
          period_end: invoice.performancePeriodEnd?.toISOString().split("T")[0] ?? "",
          payment_terms: invoice.paymentTerms,
          tax_mode: invoice.taxMode,
          currency: invoice.currency,
          notes: invoice.notes,
        }
      : null,
    invoice_number: invoice?.invoiceNumber ?? "",
    invoice_date: invoice?.invoiceDate?.toISOString().split("T")[0] ?? "",
    tax_rate: invoice?.taxMode ?? "",
    currency: invoice?.currency ?? "EUR",
    line_items: lineItems,
    subtotal,
    today: new Date().toISOString().split("T")[0],
    date: new Date().toISOString().split("T")[0],
    generated_at: new Date().toISOString(),
  };

  // Read template file (from Supabase Storage)
  const templateBuf = await readFile(template.templatePath);
  const templateContent = templateBuf.toString("utf-8");
  const rendered = renderTemplate(templateContent, data, { format: template.templateType });

  // Filename
  let baseName: string;
  try {
    baseName = renderFileName(template.fileNameFormula, data) || `document_${Date.now()}`;
  } catch {
    baseName = `document_${Date.now()}`;
  }

  let buffer: Buffer;
  let extension: string;
  let warning: string | undefined;

  if (input.exportFormat === "PDF") {
    buffer = await htmlToPdf(rendered);
    extension = "pdf";
  } else if (input.exportFormat === "XML") {
    buffer = Buffer.from(rendered, "utf-8");
    extension = "xml";
  } else if (input.exportFormat === "PDFA3") {
    const res = await convertToPdfA3({ html: rendered });
    buffer = res.buffer;
    warning = res.warning;
    extension = "pdf";
  } else {
    throw new Error(`Unsupported export format: ${input.exportFormat}`);
  }

  const finalFileName = `${baseName}.${extension}`;
  const filePath = await writeFile(STORAGE.generated, `${Date.now()}_${finalFileName}`, buffer);

  const meta: Prisma.InputJsonValue = {
    templateName: template.reportName,
    templateVersion: template.version,
    warning: warning ?? null,
  };

  const doc = await prisma.generatedDocument.create({
    data: {
      customerId: input.customerId,
      invoiceId: input.invoiceId ?? null,
      reportTemplateId: input.reportTemplateId,
      fileName: finalFileName,
      filePath,
      documentType: template.reportType,
      exportFormat: input.exportFormat,
      fileSize: buffer.byteLength,
      generatedById: input.generatedById ?? null,
      metadata: meta,
    },
  });

  await logAudit({
    userId: input.generatedById,
    action: "DOCUMENT_GENERATED",
    entityType: "GeneratedDocument",
    entityId: doc.id,
    metadata: { fileName: finalFileName, format: input.exportFormat },
  });

  return { document: doc, warning };
}
