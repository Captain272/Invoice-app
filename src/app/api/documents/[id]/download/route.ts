import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getSession } from "@/server/actions/auth-helper";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { STORAGE } from "@/lib/storage/local";
import { logAudit } from "@/lib/audit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "documents:read")) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { id } = await params;
  const doc = await prisma.generatedDocument.findUnique({ where: { id } });
  if (!doc) return new NextResponse("Not found", { status: 404 });

  // Restrict to upload root — defense in depth
  const resolved = path.resolve(doc.filePath);
  if (!resolved.startsWith(STORAGE.root)) return new NextResponse("Forbidden", { status: 403 });

  let buffer: Buffer;
  try { buffer = await fs.readFile(resolved); } catch { return new NextResponse("File missing", { status: 404 }); }

  await logAudit({
    userId: session.user.id,
    action: "DOCUMENT_DOWNLOADED",
    entityType: "GeneratedDocument",
    entityId: id,
  });

  const ext = doc.fileName.split(".").pop()?.toLowerCase();
  const mime = ext === "pdf" ? "application/pdf" : ext === "xml" ? "application/xml" : "application/octet-stream";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${doc.fileName}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
