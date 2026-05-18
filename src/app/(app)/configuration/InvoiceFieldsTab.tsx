"use client";

import { FieldsTab, type FieldRow } from "./FieldsTab";
import { createInvoiceField, updateInvoiceField, deleteInvoiceField } from "@/server/actions/configuration";

export function InvoiceFieldsTab({ fields, mappers, readonly }: { fields: FieldRow[]; mappers: { id: string; label: string }[]; readonly: boolean }) {
  return (
    <FieldsTab
      title="Additional Invoice Fields"
      description="Configure the invoice metadata fields. System fields (invoice number, dates, payment terms, etc.) can be relabeled or marked required but not deleted. Add custom invoice fields for anything else."
      fields={fields}
      mappers={mappers}
      readonly={readonly}
      createAction={async (v) => { await createInvoiceField(v); }}
      updateAction={async (id, v) => { await updateInvoiceField(id, v); }}
      deleteAction={async (id) => { await deleteInvoiceField(id); }}
    />
  );
}
