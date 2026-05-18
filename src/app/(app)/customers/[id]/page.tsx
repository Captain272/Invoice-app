import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { CustomerEditor } from "./CustomerEditor";
import { ensureSystemConfig } from "@/server/actions/system-config";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";
  await ensureSystemConfig();

  const [customer, customerSystemFields, customerCustomFields, invoiceFields, mappers, templates] = await Promise.all([
    isNew ? null : prisma.customer.findUnique({
      where: { id },
      include: {
        fieldValues: true,
        invoices: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          include: { lineItems: { orderBy: { displayOrder: "asc" } }, fieldValues: true },
        },
        generatedDocuments: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.customerFieldConfig.findMany({ where: { isActive: true, isSystem: true }, orderBy: { displayOrder: "asc" }, include: { optionMapper: { include: { values: { orderBy: { displayOrder: "asc" } } } } } }),
    prisma.customerFieldConfig.findMany({ where: { isActive: true, isSystem: false }, orderBy: { displayOrder: "asc" }, include: { optionMapper: { include: { values: { orderBy: { displayOrder: "asc" } } } } } }),
    prisma.invoiceFieldConfig.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, include: { optionMapper: { include: { values: { orderBy: { displayOrder: "asc" } } } } } }),
    prisma.optionMapper.findMany({ include: { values: { orderBy: { displayOrder: "asc" } } } }),
    prisma.reportTemplate.findMany({ where: { isActive: true } }),
  ]);

  if (!isNew && !customer) notFound();

  const invoice = customer?.invoices[0] ?? null;

  return (
    <>
      <PageHeader
        title={customer ? customer.name : "New customer"}
        description={customer ? `Created ${customer.createdAt.toLocaleDateString()}` : "Create a customer to start generating documents for them."}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Customers", href: "/customers" },
          { label: customer?.name ?? "New" },
        ]}
      />

      <CustomerEditor
        customer={customer}
        customerSystemFields={customerSystemFields}
        customerCustomFields={customerCustomFields}
        invoiceFields={invoiceFields}
        invoice={invoice}
        documents={customer?.generatedDocuments ?? []}
        templates={templates}
        taxMapper={mappers.find((m) => m.key === "tax_type")?.values ?? []}
      />
    </>
  );
}
