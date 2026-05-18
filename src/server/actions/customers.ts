"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "./auth-helper";
import { customerCoreSchema, invoiceHeaderSchema, lineItemSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

const dynamicFieldsSchema = z.record(z.string(), z.union([z.string(), z.null(), z.undefined()]));

export async function createCustomer(input: {
  core: z.input<typeof customerCoreSchema>;
  dynamic?: Record<string, string | null | undefined>;
}) {
  const session = await requirePerm("customers:write");
  const core = customerCoreSchema.parse(input.core);
  const dynamic = dynamicFieldsSchema.parse(input.dynamic ?? {});

  // Validate required dynamic fields
  const configs = await prisma.customerFieldConfig.findMany({ where: { isActive: true, isSystem: false } });
  for (const fc of configs) {
    if (fc.required) {
      const v = dynamic[fc.key];
      if (v === undefined || v === null || v === "") {
        throw new Error(`Field "${fc.name}" is required`);
      }
    }
  }

  const customer = await prisma.$transaction(async (tx) => {
    const c = await tx.customer.create({
      data: {
        name: core.name,
        email: core.email || null,
        phone: core.phone || null,
        address: core.address || null,
        status: core.status,
      },
    });
    for (const fc of configs) {
      const v = dynamic[fc.key];
      if (v !== undefined) {
        await tx.customerFieldValue.create({
          data: { customerId: c.id, fieldConfigId: fc.id, key: fc.key, value: v ?? null },
        });
      }
    }
    return c;
  });

  await logAudit({
    userId: session.user.id,
    action: "CUSTOMER_CREATED",
    entityType: "Customer",
    entityId: customer.id,
    metadata: { name: customer.name },
  });

  revalidatePath("/customers");
  return customer;
}

export async function updateCustomer(id: string, input: {
  core: z.input<typeof customerCoreSchema>;
  dynamic?: Record<string, string | null | undefined>;
}) {
  const session = await requirePerm("customers:write");
  const core = customerCoreSchema.parse(input.core);
  const dynamic = dynamicFieldsSchema.parse(input.dynamic ?? {});

  const configs = await prisma.customerFieldConfig.findMany({ where: { isActive: true, isSystem: false } });
  for (const fc of configs) {
    if (fc.required) {
      const v = dynamic[fc.key];
      if (v === undefined || v === null || v === "") {
        throw new Error(`Field "${fc.name}" is required`);
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id },
      data: {
        name: core.name,
        email: core.email || null,
        phone: core.phone || null,
        address: core.address || null,
        status: core.status,
      },
    });
    for (const fc of configs) {
      const v = dynamic[fc.key];
      if (v === undefined) continue;
      await tx.customerFieldValue.upsert({
        where: { customerId_fieldConfigId: { customerId: id, fieldConfigId: fc.id } },
        update: { value: v ?? null, key: fc.key },
        create: { customerId: id, fieldConfigId: fc.id, key: fc.key, value: v ?? null },
      });
    }
  });

  await logAudit({
    userId: session.user.id,
    action: "CUSTOMER_UPDATED",
    entityType: "Customer",
    entityId: id,
  });

  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
}

export async function deleteCustomer(id: string) {
  const session = await requirePerm("customers:delete");
  await prisma.customer.delete({ where: { id } });
  await logAudit({
    userId: session.user.id,
    action: "CUSTOMER_DELETED",
    entityType: "Customer",
    entityId: id,
  });
  revalidatePath("/customers");
}

// Invoice header + line items upsert
export async function saveInvoiceForCustomer(input: {
  customerId: string;
  invoiceId?: string | null;
  header: z.input<typeof invoiceHeaderSchema>;
  dynamic?: Record<string, string | null | undefined>;
  lineItems: z.input<typeof lineItemSchema>[];
}) {
  const session = await requirePerm("customers:write");
  const h = invoiceHeaderSchema.parse(input.header);
  const items = z.array(lineItemSchema).parse(input.lineItems);
  const dynamic = dynamicFieldsSchema.parse(input.dynamic ?? {});

  // Validate required custom invoice fields per config.
  const invoiceCustomConfigs = await prisma.invoiceFieldConfig.findMany({ where: { isActive: true, isSystem: false } });
  for (const fc of invoiceCustomConfigs) {
    if (fc.required) {
      const v = dynamic[fc.key];
      if (v === undefined || v === null || v === "") throw new Error(`Field "${fc.name}" is required`);
    }
  }

  const parseDate = (s?: string | null) => (s ? new Date(s) : null);

  const data = {
    invoiceNumber: h.invoiceNumber,
    quoteNumber: h.quoteNumber || null,
    invoiceDate: parseDate(h.invoiceDate),
    performancePeriodStart: parseDate(h.performancePeriodStart),
    performancePeriodEnd: parseDate(h.performancePeriodEnd),
    paymentTerms: h.paymentTerms || null,
    taxMode: h.taxMode || null,
    currency: h.currency || "EUR",
    notes: h.notes || null,
  };

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = input.invoiceId
      ? await tx.invoice.update({ where: { id: input.invoiceId }, data })
      : await tx.invoice.create({ data: { ...data, customerId: input.customerId } });

    await tx.invoiceLineItem.deleteMany({ where: { invoiceId: inv.id } });
    if (items.length) {
      await tx.invoiceLineItem.createMany({
        data: items.map((li, idx) => ({
          invoiceId: inv.id,
          pos: li.pos ?? idx + 1,
          key: li.key || null,
          label: li.label || null,
          description: li.description || null,
          quantity: Number(li.quantity) || 0,
          unit: li.unit || null,
          unitPrice: Number(li.unitPrice) || 0,
          taxType: li.taxType || null,
          amount: Number(li.amount) || (Number(li.quantity) * Number(li.unitPrice)) || 0,
          value: li.value || null,
          displayOrder: idx,
        })),
      });
    }

    for (const fc of invoiceCustomConfigs) {
      const v = dynamic[fc.key];
      if (v === undefined) continue;
      await tx.invoiceFieldValue.upsert({
        where: { invoiceId_fieldConfigId: { invoiceId: inv.id, fieldConfigId: fc.id } },
        update: { value: v ?? null, key: fc.key },
        create: { invoiceId: inv.id, fieldConfigId: fc.id, key: fc.key, value: v ?? null },
      });
    }
    return inv;
  });

  await logAudit({
    userId: session.user.id,
    action: "INVOICE_UPDATED",
    entityType: "Invoice",
    entityId: invoice.id,
    metadata: { invoiceNumber: invoice.invoiceNumber, customerId: input.customerId },
  });

  revalidatePath(`/customers/${input.customerId}`);
  return invoice;
}
