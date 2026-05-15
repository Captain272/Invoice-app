import { redirect } from "next/navigation";
import { getSession } from "@/server/actions/auth-helper";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/EmptyState";
import { formatDateTime } from "@/lib/utils";

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; action?: string }>;
}) {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "audit:read")) redirect("/dashboard");

  const sp = await searchParams;
  const logs = await prisma.auditLog.findMany({
    where: {
      ...(sp.action && sp.action !== "ALL" ? { action: sp.action as "USER_LOGIN" } : {}),
      ...(sp.q ? { OR: [{ entityType: { contains: sp.q, mode: "insensitive" } }, { user: { name: { contains: sp.q, mode: "insensitive" } } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { user: true },
    take: 300,
  });

  return (
    <>
      <PageHeader title="Audit Logs" description="Every important action across the platform is tracked here." breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Audit Logs" }]} />
      <Card><CardContent className="p-6">
        <form action="/audit-logs" className="flex flex-wrap gap-2 mb-4">
          <Input name="q" defaultValue={sp.q ?? ""} placeholder="Search entity or user…" className="flex-1 min-w-[200px]" />
          <Button type="submit" variant="outline">Filter</Button>
        </form>
        {logs.length === 0 ? (
          <EmptyState title="No activity yet" description="Audit entries appear here as users interact with the platform." />
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-3 font-medium">When</th>
                  <th className="p-3 font-medium">Action</th>
                  <th className="p-3 font-medium">Entity</th>
                  <th className="p-3 font-medium">User</th>
                  <th className="p-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/30">
                    <td className="p-3 text-muted-foreground whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                    <td className="p-3"><Badge variant="outline">{l.action.replace(/_/g, " ").toLowerCase()}</Badge></td>
                    <td className="p-3 text-muted-foreground">{l.entityType ?? "—"} {l.entityId ? <span className="font-mono text-xs">{l.entityId.slice(0, 8)}</span> : null}</td>
                    <td className="p-3">{l.user?.name ?? <span className="text-muted-foreground">system</span>}</td>
                    <td className="p-3 text-xs text-muted-foreground font-mono">{l.ipAddress ?? "—"}</td>
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
