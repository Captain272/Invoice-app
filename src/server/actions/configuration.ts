"use server";

import { revalidatePath } from "next/cache";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "./auth-helper";
import {
  fieldConfigSchema,
  optionMapperSchema,
  reportTemplateSchema,
} from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { STORAGE, safeFileName, writeFile } from "@/lib/storage/local";

// ============ CUSTOMER FIELDS ============

export async function createCustomerField(input: z.input<typeof fieldConfigSchema>) {
  const session = await requirePerm("config:write");
  const data = fieldConfigSchema.parse(input);
  const existing = await prisma.customerFieldConfig.findUnique({ where: { key: data.key } });
  if (existing) throw new Error(`Key "${data.key}" already exists`);
  const f = await prisma.customerFieldConfig.create({ data });
  await logAudit({ userId: session.user.id, action: "FIELD_CREATED", entityType: "CustomerFieldConfig", entityId: f.id, metadata: { key: data.key } });
  revalidatePath("/configuration");
  return f;
}

export async function updateCustomerField(id: string, input: Partial<z.input<typeof fieldConfigSchema>>) {
  const session = await requirePerm("config:write");
  const data = fieldConfigSchema.partial().parse(input);
  const f = await prisma.customerFieldConfig.update({ where: { id }, data });
  await logAudit({ userId: session.user.id, action: "FIELD_UPDATED", entityType: "CustomerFieldConfig", entityId: id });
  revalidatePath("/configuration");
  return f;
}

export async function deleteCustomerField(id: string) {
  const session = await requirePerm("config:write");
  const used = await prisma.customerFieldValue.count({ where: { fieldConfigId: id } });
  if (used > 0) throw new Error("Field is in use — deactivate instead of deleting");
  await prisma.customerFieldConfig.delete({ where: { id } });
  await logAudit({ userId: session.user.id, action: "FIELD_DELETED", entityType: "CustomerFieldConfig", entityId: id });
  revalidatePath("/configuration");
}

// ============ COMPANY FIELDS ============

export async function createCompanyField(input: z.input<typeof fieldConfigSchema>) {
  const session = await requirePerm("config:write");
  const data = fieldConfigSchema.parse(input);
  const existing = await prisma.companyFieldConfig.findUnique({ where: { key: data.key } });
  if (existing) throw new Error(`Key "${data.key}" already exists`);
  const f = await prisma.companyFieldConfig.create({ data });
  await logAudit({ userId: session.user.id, action: "FIELD_CREATED", entityType: "CompanyFieldConfig", entityId: f.id, metadata: { key: data.key } });
  revalidatePath("/configuration");
  return f;
}

export async function updateCompanyField(id: string, input: Partial<z.input<typeof fieldConfigSchema>>) {
  const session = await requirePerm("config:write");
  const data = fieldConfigSchema.partial().parse(input);
  const f = await prisma.companyFieldConfig.update({ where: { id }, data });
  await logAudit({ userId: session.user.id, action: "FIELD_UPDATED", entityType: "CompanyFieldConfig", entityId: id });
  revalidatePath("/configuration");
  return f;
}

export async function deleteCompanyField(id: string) {
  const session = await requirePerm("config:write");
  const used = await prisma.companyFieldValue.count({ where: { fieldConfigId: id } });
  if (used > 0) throw new Error("Field is in use — deactivate instead of deleting");
  await prisma.companyFieldConfig.delete({ where: { id } });
  await logAudit({ userId: session.user.id, action: "FIELD_DELETED", entityType: "CompanyFieldConfig", entityId: id });
  revalidatePath("/configuration");
}

// ============ OPTION MAPPERS ============

export async function createOptionMapper(input: z.input<typeof optionMapperSchema>) {
  const session = await requirePerm("config:write");
  const data = optionMapperSchema.parse(input);
  const existing = await prisma.optionMapper.findUnique({ where: { key: data.key } });
  if (existing) throw new Error(`Mapper key "${data.key}" already exists`);
  const mapper = await prisma.optionMapper.create({
    data: {
      key: data.key,
      label: data.label,
      isActive: data.isActive,
      values: { create: data.values.map((v, idx) => ({ label: v.label, value: v.value, displayOrder: v.displayOrder ?? idx })) },
    },
    include: { values: true },
  });
  await logAudit({ userId: session.user.id, action: "OPTION_MAPPER_CREATED", entityType: "OptionMapper", entityId: mapper.id, metadata: { key: data.key } });
  revalidatePath("/configuration");
  return mapper;
}

export async function updateOptionMapper(id: string, input: z.input<typeof optionMapperSchema>) {
  const session = await requirePerm("config:write");
  const data = optionMapperSchema.parse(input);
  const mapper = await prisma.$transaction(async (tx) => {
    const m = await tx.optionMapper.update({
      where: { id },
      data: { label: data.label, isActive: data.isActive },
    });
    await tx.optionMapperValue.deleteMany({ where: { optionMapperId: id } });
    if (data.values.length) {
      await tx.optionMapperValue.createMany({
        data: data.values.map((v, idx) => ({
          optionMapperId: id,
          label: v.label,
          value: v.value,
          displayOrder: v.displayOrder ?? idx,
        })),
      });
    }
    return m;
  });
  await logAudit({ userId: session.user.id, action: "OPTION_MAPPER_UPDATED", entityType: "OptionMapper", entityId: id });
  revalidatePath("/configuration");
  return mapper;
}

export async function deleteOptionMapper(id: string) {
  const session = await requirePerm("config:write");
  const usage = await prisma.customerFieldConfig.count({ where: { optionMapperId: id } })
    + await prisma.companyFieldConfig.count({ where: { optionMapperId: id } });
  if (usage > 0) throw new Error(`Mapper is used by ${usage} field(s)`);
  await prisma.optionMapper.delete({ where: { id } });
  await logAudit({ userId: session.user.id, action: "OPTION_MAPPER_DELETED", entityType: "OptionMapper", entityId: id });
  revalidatePath("/configuration");
}

// ============ REPORT TEMPLATES ============

const ALLOWED_TEMPLATE_EXTS = new Set([".html", ".htm", ".xml"]);
const MAX_TEMPLATE_SIZE = 2 * 1024 * 1024; // 2 MB

export async function uploadReportTemplate(formData: FormData) {
  const session = await requirePerm("config:write");

  const fields = {
    reportName: String(formData.get("reportName") ?? ""),
    reportType: String(formData.get("reportType") ?? "invoice"),
    templateType: String(formData.get("templateType") ?? "HTML") as "HTML" | "XML",
    fileNameFormula: String(formData.get("fileNameFormula") ?? "document_{{today}}"),
    description: (formData.get("description") as string | null) || null,
    isActive: formData.get("isActive") !== "false",
  };
  const parsed = reportTemplateSchema.parse(fields);

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Template file is required");
  if (file.size > MAX_TEMPLATE_SIZE) throw new Error("Template file too large (max 2 MB)");
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_TEMPLATE_EXTS.has(ext)) throw new Error("Only .html or .xml templates allowed");

  const safeName = `${Date.now()}_${safeFileName(file.name)}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const savedPath = await writeFile(STORAGE.templates, safeName, buf);

  const tpl = await prisma.reportTemplate.create({
    data: {
      reportName: parsed.reportName,
      reportType: parsed.reportType,
      templateType: parsed.templateType,
      fileNameFormula: parsed.fileNameFormula,
      description: parsed.description ?? null,
      isActive: parsed.isActive,
      templatePath: savedPath,
      originalFileName: file.name,
      version: 1,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "TEMPLATE_UPLOADED",
    entityType: "ReportTemplate",
    entityId: tpl.id,
    metadata: { name: parsed.reportName, size: file.size },
  });

  revalidatePath("/configuration");
  return tpl;
}

export async function deleteReportTemplate(id: string) {
  const session = await requirePerm("config:write");
  const t = await prisma.reportTemplate.findUnique({ where: { id } });
  if (!t) throw new Error("Template not found");
  await prisma.reportTemplate.delete({ where: { id } });
  if (t.templatePath) await fs.unlink(t.templatePath).catch(() => {});
  await logAudit({ userId: session.user.id, action: "TEMPLATE_DELETED", entityType: "ReportTemplate", entityId: id });
  revalidatePath("/configuration");
}

export async function toggleReportTemplate(id: string, isActive: boolean) {
  const session = await requirePerm("config:write");
  await prisma.reportTemplate.update({ where: { id }, data: { isActive } });
  await logAudit({ userId: session.user.id, action: "TEMPLATE_UPDATED", entityType: "ReportTemplate", entityId: id, metadata: { isActive } });
  revalidatePath("/configuration");
}
