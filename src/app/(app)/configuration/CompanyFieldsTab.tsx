"use client";

import { FieldsTab, type FieldRow } from "./FieldsTab";
import { createCompanyField, updateCompanyField, deleteCompanyField } from "@/server/actions/configuration";

export function CompanyFieldsTab({ fields, mappers, readonly }: { fields: FieldRow[]; mappers: { id: string; label: string }[]; readonly: boolean }) {
  return (
    <FieldsTab
      title="Company Fields"
      description="Configure additional fields on the company profile. Available in templates as placeholders."
      fields={fields}
      mappers={mappers}
      readonly={readonly}
      createAction={async (v) => { await createCompanyField(v); }}
      updateAction={async (id, v) => { await updateCompanyField(id, v); }}
      deleteAction={async (id) => { await deleteCompanyField(id); }}
    />
  );
}
