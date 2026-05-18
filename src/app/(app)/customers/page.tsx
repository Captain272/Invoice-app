import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { formatDateTime } from "@/lib/utils";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim();
  const status = sp.status;

  const customers = await prisma.customer.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
      ...(status && status !== "ALL" ? { status: status as "ACTIVE" | "INACTIVE" | "ARCHIVED" } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      generatedDocuments: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { invoices: true, generatedDocuments: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Customers"
        description="Manage customers and the invoices and documents you generate for them."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Customers" }]}
        actions={<Button asChild variant="amber"><Link href="/customers/new"><Plus className="h-4 w-4" /> Add customer</Link></Button>}
      />

      <Card>
        <CardContent className="p-6">
          <form className="flex flex-wrap gap-2 mb-4" action="/customers">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input name="q" defaultValue={q ?? ""} placeholder="Search by name or email…" className="pl-9" />
            </div>
            <select name="status" defaultValue={status ?? "ALL"} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="ALL">All status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <Button type="submit" variant="outline">Filter</Button>
          </form>

          {customers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No customers yet"
              description="Add your first customer and start generating documents in minutes."
              action={<Button asChild variant="amber"><Link href="/customers/new"><Plus className="h-4 w-4" /> Add customer</Link></Button>}
            />
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="p-3 font-medium">Name</th>
                    <th className="p-3 font-medium">Email</th>
                    <th className="p-3 font-medium">Phone</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Last document</th>
                    <th className="p-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {customers.map((c) => {
                    const href = `/customers/${c.id}`;
                    const cell = "p-0";
                    const link = "block px-3 py-3 w-full";
                    return (
                      <tr key={c.id} className="hover:bg-muted/30">
                        <td className={cell}>
                          <Link href={href} className={`${link} font-medium`}>{c.name}</Link>
                        </td>
                        <td className={cell}>
                          <Link href={href} className={`${link} text-muted-foreground`}>{c.email ?? "—"}</Link>
                        </td>
                        <td className={cell}>
                          <Link href={href} className={`${link} text-muted-foreground`}>{c.phone ?? "—"}</Link>
                        </td>
                        <td className={cell}>
                          <Link href={href} className={link}>
                            <Badge variant={c.status === "ACTIVE" ? "success" : "secondary"}>{c.status.toLowerCase()}</Badge>
                          </Link>
                        </td>
                        <td className={cell}>
                          <Link href={href} className={`${link} text-muted-foreground`}>{c.generatedDocuments[0] ? formatDateTime(c.generatedDocuments[0].createdAt) : "—"}</Link>
                        </td>
                        <td className={cell}>
                          <Link href={href} className={`${link} text-muted-foreground`}>{formatDateTime(c.createdAt)}</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
