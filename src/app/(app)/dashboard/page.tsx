import Link from "next/link";
import { Users, FileText, FileCheck2, FileWarning, Plus, Upload, Settings2, Sparkles } from "lucide-react";
import { getSession } from "@/server/actions/auth-helper";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatDateTime } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await getSession();
  const userName = session?.user?.name?.split(" ")[0] ?? "there";

  const [customers, docs, templates, draftInvoices, recentDocs, recentLogs, byFormat] = await Promise.all([
    prisma.customer.count({ where: { status: "ACTIVE" } }),
    prisma.generatedDocument.count(),
    prisma.reportTemplate.count({ where: { isActive: true } }),
    prisma.invoice.count({ where: { status: "DRAFT" } }),
    prisma.generatedDocument.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { customer: true, generatedBy: true } }),
    prisma.auditLog.findMany({ take: 6, orderBy: { createdAt: "desc" }, include: { user: true } }),
    prisma.generatedDocument.groupBy({ by: ["exportFormat"], _count: { _all: true } }),
  ]);

  const stats = [
    { label: "Active Customers", value: customers, icon: Users, accent: "bg-blue-100 text-blue-700" },
    { label: "Generated Documents", value: docs, icon: FileText, accent: "bg-emerald-100 text-emerald-700" },
    { label: "Active Templates", value: templates, icon: FileCheck2, accent: "bg-amber/20 text-amber-foreground" },
    { label: "Draft Invoices", value: draftInvoices, icon: FileWarning, accent: "bg-orange-100 text-orange-700" },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome back, ${userName}`}
        description="Generate business documents dynamically with configurable templates."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link href="/configuration"><Settings2 className="h-4 w-4" />Configure</Link></Button>
            <Button asChild variant="amber"><Link href="/customers/new"><Plus className="h-4 w-4" />Add customer</Link></Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight">{s.value}</p>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.accent}`}><Icon className="h-5 w-5" /></div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent Documents</CardTitle>
              <CardDescription>Latest documents generated across the platform</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm"><Link href="/documents">View all</Link></Button>
          </CardHeader>
          <CardContent>
            {recentDocs.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-2 text-amber" />
                Generated documents will appear here after you create invoices or payroll reports.
              </div>
            ) : (
              <div className="divide-y -mx-6">
                {recentDocs.map((d) => (
                  <div key={d.id} className="flex items-center gap-4 px-6 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{d.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.customer?.name ?? "—"} · {formatDateTime(d.createdAt)}
                      </p>
                    </div>
                    <Badge variant="outline">{d.exportFormat}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Jump to common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-start"><Link href="/customers/new"><Plus className="h-4 w-4" /> Add customer</Link></Button>
            <Button asChild variant="outline" className="w-full justify-start"><Link href="/customers"><FileText className="h-4 w-4" /> Generate document</Link></Button>
            <Button asChild variant="outline" className="w-full justify-start"><Link href="/configuration?tab=reports"><Upload className="h-4 w-4" /> Upload template</Link></Button>
            <Button asChild variant="outline" className="w-full justify-start"><Link href="/configuration"><Settings2 className="h-4 w-4" /> Configure fields</Link></Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Documents by format</CardTitle>
            <CardDescription>Distribution of generated exports</CardDescription>
          </CardHeader>
          <CardContent>
            {byFormat.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents yet.</p>
            ) : (
              <div className="space-y-3">
                {byFormat.map((b) => {
                  const total = byFormat.reduce((s, x) => s + x._count._all, 0) || 1;
                  const pct = Math.round((b._count._all / total) * 100);
                  return (
                    <div key={b.exportFormat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{b.exportFormat}</span>
                        <span className="text-muted-foreground">{b._count._all} · {pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-amber" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest audit log entries</CardDescription>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {recentLogs.map((l) => (
                  <li key={l.id} className="flex flex-col">
                    <span className="font-medium">{l.action.replace(/_/g, " ").toLowerCase()}</span>
                    <span className="text-xs text-muted-foreground">
                      {l.user?.name ?? "system"} · {formatDateTime(l.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
