import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { CustomerEditor } from "../[id]/CustomerEditor";

export default async function NewCustomerPage() {
  const [fieldConfigs, mappers, templates] = await Promise.all([
    prisma.customerFieldConfig.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      include: { optionMapper: { include: { values: { orderBy: { displayOrder: "asc" } } } } },
    }),
    prisma.optionMapper.findMany({ include: { values: { orderBy: { displayOrder: "asc" } } } }),
    prisma.reportTemplate.findMany({ where: { isActive: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="New customer"
        description="Create a customer to start generating documents for them."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Customers", href: "/customers" },
          { label: "New" },
        ]}
      />
      <CustomerEditor
        customer={null}
        fieldConfigs={fieldConfigs}
        invoice={null}
        documents={[]}
        templates={templates}
        taxMapper={mappers.find((m) => m.key === "tax_type")?.values ?? []}
      />
    </>
  );
}
