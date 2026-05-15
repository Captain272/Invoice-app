import { z } from "zod";

export const keySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers, and underscores (snake_case)");

export const customerCoreSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
});

export const fieldConfigSchema = z.object({
  key: keySchema,
  name: z.string().min(1).max(120),
  type: z.enum([
    "text", "textarea", "integer", "decimal", "date", "boolean",
    "select", "multi_select", "email", "phone", "currency",
  ]),
  optionMapperId: z.string().optional().nullable(),
  required: z.boolean().default(false),
  defaultValue: z.string().optional().nullable(),
  placeholder: z.string().optional().nullable(),
  helpText: z.string().optional().nullable(),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const optionMapperSchema = z.object({
  key: keySchema,
  label: z.string().min(1).max(120),
  isActive: z.boolean().default(true),
  values: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.string().min(1),
        displayOrder: z.number().int().default(0),
      })
    )
    .min(1, "At least one option is required"),
});

export const reportTemplateSchema = z.object({
  reportName: z.string().min(1).max(200),
  reportType: z.string().min(1).max(80),
  templateType: z.enum(["HTML", "XML"]),
  fileNameFormula: z.string().min(1).max(500),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const lineItemSchema = z.object({
  id: z.string().optional(),
  pos: z.number().int(),
  key: z.string().optional().nullable(),
  label: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  quantity: z.number().default(0),
  unit: z.string().optional().nullable(),
  unitPrice: z.number().default(0),
  taxType: z.string().optional().nullable(),
  amount: z.number().default(0),
  value: z.string().optional().nullable(),
});

export const invoiceHeaderSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  quoteNumber: z.string().optional().nullable(),
  invoiceDate: z.string().optional().nullable(),
  performancePeriodStart: z.string().optional().nullable(),
  performancePeriodEnd: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  taxMode: z.string().optional().nullable(),
  currency: z.string().default("EUR"),
  notes: z.string().optional().nullable(),
});

export const companyProfileSchema = z.object({
  companyName: z.string().min(1).max(200),
  address: z.string().optional().nullable(),
  vatId: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  iban: z.string().optional().nullable(),
  swift: z.string().optional().nullable(),
  taxNumber: z.string().optional().nullable(),
});
