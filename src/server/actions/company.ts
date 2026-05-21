"use server";

import { revalidatePath } from "next/cache";
import path from "node:path";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "./auth-helper";
import { companyProfileSchema } from "@/lib/validators";
import { STORAGE, safeFileName, writeFile } from "@/lib/storage/local";
import { logAudit } from "@/lib/audit";

const ALLOWED_LOGO_EXTS = new Set([".jpg", ".jpeg", ".png"]);
const MAX_LOGO_SIZE = 1.5 * 1024 * 1024;

export async function saveCompanyProfile(input: {
  core: z.input<typeof companyProfileSchema>;
  dynamic?: Record<string, string | null | undefined>;
}) {
  const session = await requirePerm("company:write");
  const core = companyProfileSchema.parse(input.core);
  const configs = await prisma.companyFieldConfig.findMany({ where: { isActive: true, isSystem: false } });
  for (const fc of configs) {
    if (fc.required) {
      const v = input.dynamic?.[fc.key];
      if (v === undefined || v === null || v === "") {
        throw new Error(`Field "${fc.name}" is required`);
      }
    }
  }

  const existing = await prisma.companyProfile.findFirst();
  const profile = await prisma.$transaction(async (tx) => {
    const data = {
      companyName: core.companyName,
      address: core.address || null,
      vatId: core.vatId || null,
      email: core.email || null,
      phone: core.phone || null,
      website: core.website || null,
      bankName: core.bankName || null,
      iban: core.iban || null,
      swift: core.swift || null,
      taxNumber: core.taxNumber || null,
    };
    const p = existing
      ? await tx.companyProfile.update({ where: { id: existing.id }, data })
      : await tx.companyProfile.create({ data });

    for (const fc of configs) {
      const v = input.dynamic?.[fc.key];
      if (v === undefined) continue;
      await tx.companyFieldValue.upsert({
        where: { companyId_fieldConfigId: { companyId: p.id, fieldConfigId: fc.id } },
        update: { value: v ?? null, key: fc.key },
        create: { companyId: p.id, fieldConfigId: fc.id, key: fc.key, value: v ?? null },
      });
    }
    return p;
  });

  await logAudit({ userId: session.user.id, action: "COMPANY_UPDATED", entityType: "CompanyProfile", entityId: profile.id });
  revalidatePath("/company");
  return profile;
}

export async function uploadCompanyLogo(formData: FormData) {
  const session = await requirePerm("company:write");
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Logo file is required");
  if (file.size > MAX_LOGO_SIZE) throw new Error("Logo too large (max 1.5 MB)");
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_LOGO_EXTS.has(ext)) throw new Error("Only JPEG or PNG allowed");

  const safeName = `logo_${Date.now()}_${safeFileName(file.name)}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const savedPath = await writeFile(STORAGE.logos, safeName, buf);

  const existing = await prisma.companyProfile.findFirst();
  if (!existing) throw new Error("Save company profile first");
  await prisma.companyProfile.update({ where: { id: existing.id }, data: { logoUrl: savedPath } });

  await logAudit({ userId: session.user.id, action: "COMPANY_UPDATED", entityType: "CompanyProfile", entityId: existing.id, metadata: { logo: file.name } });
  revalidatePath("/company");
  return { path: savedPath };
}
