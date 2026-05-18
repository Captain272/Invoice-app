"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvoiceFieldsTab } from "./InvoiceFieldsTab";
import { InvoiceVariablesTab, type InvoiceVariableRow } from "./InvoiceVariablesTab";
import type { FieldRow } from "./FieldsTab";

export function InvoiceDetailsTab({
  fields,
  variables,
  mappers,
  readonly,
}: {
  fields: FieldRow[];
  variables: InvoiceVariableRow[];
  mappers: { id: string; label: string }[];
  readonly: boolean;
}) {
  return (
    <Tabs defaultValue="fields" className="space-y-4">
      <TabsList>
        <TabsTrigger value="fields">Additional Invoice Fields</TabsTrigger>
        <TabsTrigger value="variables">Variables</TabsTrigger>
      </TabsList>
      <TabsContent value="fields">
        <InvoiceFieldsTab fields={fields} mappers={mappers} readonly={readonly} />
      </TabsContent>
      <TabsContent value="variables">
        <InvoiceVariablesTab variables={variables} readonly={readonly} />
      </TabsContent>
    </Tabs>
  );
}
