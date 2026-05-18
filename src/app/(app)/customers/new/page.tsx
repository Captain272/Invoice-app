import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { CustomerEditor } from "../[id]/CustomerEditor";
import { ensureSystemConfig } from "@/server/actions/system-config";

export default async function NewCustomerPage() {
  await ensureSystemConfig();
  const [customerSystemFields, customerCustomFields, invoiceFields, mappers, templates] = await Promise.all([
    prisma.customerFieldConfig.findMany({
      where: { isActive: true, isSystem: true },
      orderBy: { displayOrder: "asc" },
      include: { optionMapper: { include: { values: { orderBy: { displayOrder: "asc" } } } } },
    }),
    prisma.customerFieldConfig.findMany({
      where: { isActive: true, isSystem: false },
      orderBy: { displayOrder: "asc" },
      include: { optionMapper: { include: { values: { orderBy: { displayOrder: "asc" } } } } },
    }),
    prisma.invoiceFieldConfig.findMany({
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
        customerSystemFields={customerSystemFields}
        customerCustomFields={customerCustomFields}
        invoiceFields={invoiceFields}
        invoice={null}
        documents={[]}
        templates={templates}
        taxMapper={mappers.find((m) => m.key === "tax_type")?.values ?? []}
      />
    </>
  );
}
