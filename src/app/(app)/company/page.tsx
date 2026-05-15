import { redirect } from "next/navigation";
import { getSession } from "@/server/actions/auth-helper";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { CompanyForm } from "./CompanyForm";

export default async function CompanyPage() {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "company:read")) redirect("/dashboard");
  const readonly = !can(session.user.role, "company:write");

  const [profile, fieldConfigs, values] = await Promise.all([
    prisma.companyProfile.findFirst(),
    prisma.companyFieldConfig.findMany({
      where: { isActive: true },
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
      <CompanyForm profile={profile} fieldConfigs={fieldConfigs} fieldValues={values} readonly={readonly} />
    </>
  );
}
