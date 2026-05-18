import { NextResponse } from "next/server";
import { getSession } from "@/server/actions/auth-helper";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { readFile } from "@/lib/storage/local";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "config:read")) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { id } = await params;
  const tpl = await prisma.reportTemplate.findUnique({ where: { id } });
  if (!tpl) return new NextResponse("Not found", { status: 404 });

  let buffer: Buffer;
  try {
    buffer = await readFile(tpl.templatePath);
  } catch {
    return new NextResponse("File missing", { status: 404 });
  }

  const ext = tpl.originalFileName.split(".").pop()?.toLowerCase();
  const mime =
    ext === "xml" ? "application/xml" :
    ext === "html" || ext === "htm" ? "text/html" :
    "application/octet-stream";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${tpl.originalFileName}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
