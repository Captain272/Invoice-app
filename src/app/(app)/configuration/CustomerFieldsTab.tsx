"use client";

import { FieldsTab, type FieldRow } from "./FieldsTab";
import { createCustomerField, updateCustomerField, deleteCustomerField } from "@/server/actions/configuration";

export function CustomerFieldsTab({ fields, mappers, readonly }: { fields: FieldRow[]; mappers: { id: string; label: string }[]; readonly: boolean }) {
  return (
    <FieldsTab
      title="Customer Fields"
      description="Configure additional fields collected on customer profiles. Required fields must be filled before a customer can be saved."
      fields={fields}
      mappers={mappers}
      readonly={readonly}
      createAction={async (v) => { await createCustomerField(v); }}
      updateAction={async (id, v) => { await updateCustomerField(id, v); }}
      deleteAction={async (id) => { await deleteCustomerField(id); }}
    />
  );
}
