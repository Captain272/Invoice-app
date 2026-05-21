import { redirect } from "next/navigation";
import { getSession } from "@/server/actions/auth-helper";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { CompanyForm } from "./CompanyForm";
import { ensureSystemConfig } from "@/server/actions/system-config";

export default async function CompanyPage() {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "company:read")) redirect("/dashboard");
  const readonly = !can(session.user.role, "company:write");
  await ensureSystemConfig();

  const [profile, systemFields, customFields, values] = await Promise.all([
    prisma.companyProfile.findFirst(),
    prisma.companyFieldConfig.findMany({
      where: { isActive: true, isSystem: true },
      orderBy: { displayOrder: "asc" },
      include: { optionMapper: { include: { values: { orderBy: { displayOrder: "asc" } } } } },
    }),
    prisma.companyFieldConfig.findMany({
      where: { isActive: true, isSystem: false },
      orderBy: { displayOrder: "asc" },
      include: { optionMapper: { include: { values: { orderBy: { displayOrder: "asc" } } } } },
    }),
    prisma.companyFieldValue.findMany(),
  ]);

  return (
    <>
      <PageHeader
        title="Company Details"
        description="Your company information appears on every generated document. Logo and dynamic fields are available as template placeholders."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Company" }]}
      />
      <CompanyForm profile={profile} systemFields={systemFields} customFields={customFields} fieldValues={values} readonly={readonly} />
    </>
  );
}
