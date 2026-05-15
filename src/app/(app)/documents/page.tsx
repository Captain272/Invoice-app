import Link from "next/link";
import { Download, FileText, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { formatBytes, formatDateTime } from "@/lib/utils";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; format?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim();
  const docs = await prisma.generatedDocument.findMany({
    where: {
      ...(q ? { fileName: { contains: q, mode: "insensitive" } } : {}),
      ...(sp.format && sp.format !== "ALL" ? { exportFormat: sp.format as "PDF" | "XML" | "PDFA3" } : {}),
      ...(sp.type && sp.type !== "ALL" ? { documentType: sp.type } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { customer: true, generatedBy: true },
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="Documents"
        description="All generated documents across the platform. Download or audit any file."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Documents" }]}
      />
      <Card><CardContent className="p-6">
        <form action="/documents" className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input name="q" defaultValue={q ?? ""} placeholder="Search by filename…" className="pl-9" />
          </div>
          <select name="format" defaultValue={sp.format ?? "ALL"} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="ALL">All formats</option>
            <option value="PDF">PDF</option>
            <option value="XML">XML</option>
            <option value="PDFA3">PDF/A-3</option>
          </select>
          <Button type="submit" variant="outline">Filter</Button>
        </form>

        {docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Generated documents will appear here after you create invoices or payroll reports."
            action={<Button asChild variant="amber"><Link href="/customers">Go to customers</Link></Button>}
          />
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-3 font-medium">File</th>
                  <th className="p-3 font-medium">Customer</th>
                  <th className="p-3 font-medium">Type</th>
                  <th className="p-3 font-medium">Format</th>
                  <th className="p-3 font-medium">Size</th>
                  <th className="p-3 font-medium">Generated</th>
                  <th className="p-3 font-medium">By</th>
                  <th className="p-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {docs.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs truncate max-w-xs">{d.fileName}</td>
                    <td className="p-3">
                      {d.customer ? <Link className="hover:underline" href={`/customers/${d.customerId}`}>{d.customer.name}</Link> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3">{d.documentType}</td>
                    <td className="p-3"><Badge variant="outline">{d.exportFormat}</Badge></td>
                    <td className="p-3 text-muted-foreground">{formatBytes(d.fileSize)}</td>
                    <td className="p-3 text-muted-foreground">{formatDateTime(d.createdAt)}</td>
                    <td className="p-3 text-muted-foreground">{d.generatedBy?.name ?? "—"}</td>
                    <td className="p-3 text-right">
                      <Button asChild size="sm" variant="outline"><a href={`/api/documents/${d.id}/download`}><Download className="h-4 w-4" /></a></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent></Card>
    </>
  );
}
