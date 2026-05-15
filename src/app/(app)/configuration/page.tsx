import { redirect } from "next/navigation";
import { getSession } from "@/server/actions/auth-helper";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerFieldsTab } from "./CustomerFieldsTab";
import { CompanyFieldsTab } from "./CompanyFieldsTab";
import { OptionMappersTab } from "./OptionMappersTab";
import { ReportMappingsTab } from "./ReportMappingsTab";

export default async function ConfigurationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "config:read")) redirect("/dashboard");
  const readonly = !can(session.user.role, "config:write");

  const [customerFields, companyFields, optionMappers, templates] = await Promise.all([
    prisma.customerFieldConfig.findMany({ orderBy: { displayOrder: "asc" }, include: { optionMapper: true } }),
    prisma.companyFieldConfig.findMany({ orderBy: { displayOrder: "asc" }, include: { optionMapper: true } }),
    prisma.optionMapper.findMany({ include: { values: { orderBy: { displayOrder: "asc" } }, _count: { select: { customerFields: true, companyFields: true } } }, orderBy: { label: "asc" } }),
    prisma.reportTemplate.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const sp = await searchParams;
  const initialTab = sp.tab ?? "customer-fields";

  return (
    <>
      <PageHeader
        title="Configuration"
        description="Configure dynamic fields, dropdown options, and document templates. Changes apply immediately to all customers."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Configuration" }]}
      />

      <Tabs defaultValue={initialTab} className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="customer-fields">Customer Fields</TabsTrigger>
          <TabsTrigger value="company-fields">Company Fields</TabsTrigger>
          <TabsTrigger value="option-mappers">Option Mappers</TabsTrigger>
          <TabsTrigger value="reports">Report Mappings</TabsTrigger>
        </TabsList>

        <TabsContent value="customer-fields">
          <CustomerFieldsTab fields={customerFields} mappers={optionMappers} readonly={readonly} />
        </TabsContent>
        <TabsContent value="company-fields">
          <CompanyFieldsTab fields={companyFields} mappers={optionMappers} readonly={readonly} />
        </TabsContent>
        <TabsContent value="option-mappers">
          <OptionMappersTab mappers={optionMappers} readonly={readonly} />
        </TabsContent>
        <TabsContent value="reports">
          <ReportMappingsTab templates={templates} readonly={readonly} />
        </TabsContent>
      </Tabs>
    </>
  );
}
