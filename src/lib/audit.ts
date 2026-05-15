import { headers } from "next/headers";
import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function logAudit(params: {
  userId?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  let ipAddress: string | null = null;
  let userAgent: string | null = null;
  try {
    const h = await headers();
    ipAddress = h.get("x-forwarded-for") || h.get("x-real-ip");
    userAgent = h.get("user-agent");
  } catch {
    // outside request context
  }
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata,
      ipAddress,
      userAgent,
    },
  }).catch((e) => {
    console.error("audit log failed", e);
  });
}
