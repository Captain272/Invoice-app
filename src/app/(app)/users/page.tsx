import { redirect } from "next/navigation";
import { getSession } from "@/server/actions/auth-helper";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { UsersTable } from "./UsersTable";

export default async function UsersPage() {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "users:read")) redirect("/dashboard");
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader
        title="Users"
        description="Manage who can access this platform and what they can do."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Users" }]}
      />
      <UsersTable users={users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt }))} currentUserId={session.user.id} />
    </>
  );
}
