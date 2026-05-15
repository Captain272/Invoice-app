"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "./auth-helper";
import { generateDocument } from "@/lib/document-generation/generate";
import { logAudit } from "@/lib/audit";
import type { ExportFormat } from "@prisma/client";
import { deleteFile } from "@/lib/storage/local";

export async function runGenerateDocument(input: {
  customerId: string;
  invoiceId?: string | null;
  reportTemplateId: string;
  exportFormat: ExportFormat;
}) {
  const session = await requirePerm("documents:generate");
  try {
    const res = await generateDocument({ ...input, generatedById: session.user.id });
    revalidatePath("/documents");
    revalidatePath(`/customers/${input.customerId}`);
    return { ok: true as const, documentId: res.document.id, fileName: res.document.fileName, warning: res.warning };
  } catch (e) {
    await logAudit({
      userId: session.user.id,
      action: "GENERATION_FAILED",
      entityType: "GeneratedDocument",
      metadata: { error: (e as Error).message, ...input },
    });
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function deleteGeneratedDocument(id: string) {
  const session = await requirePerm("documents:delete");
  const d = await prisma.generatedDocument.findUnique({ where: { id } });
  if (!d) return;
  await prisma.generatedDocument.delete({ where: { id } });
  await deleteFile(d.filePath).catch(() => {});
  await logAudit({ userId: session.user.id, action: "DOCUMENT_DELETED", entityType: "GeneratedDocument", entityId: id });
  revalidatePath("/documents");
}
