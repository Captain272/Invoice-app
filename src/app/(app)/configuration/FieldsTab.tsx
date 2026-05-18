"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/layout/EmptyState";
import type { FieldType } from "@prisma/client";

export type FieldRow = {
  id: string;
  key: string;
  name: string;
  type: FieldType;
  optionMapperId?: string | null;
  optionMapper?: { id: string; label: string } | null;
  required: boolean;
  defaultValue?: string | null;
  placeholder?: string | null;
  helpText?: string | null;
  displayOrder: number;
  isActive: boolean;
  isSystem?: boolean;
};

const FIELD_TYPES: FieldType[] = [
  "text", "textarea", "integer", "decimal", "date", "boolean",
  "select", "multi_select", "email", "phone", "currency",
];

export function FieldsTab({
  title,
  description,
  fields,
  mappers,
  readonly,
  createAction,
  updateAction,
  deleteAction,
}: {
  title: string;
  description: string;
  fields: FieldRow[];
  mappers: { id: string; label: string }[];
  readonly: boolean;
  createAction: (input: FormFieldValues) => Promise<unknown>;
  updateAction: (id: string, input: Partial<FormFieldValues>) => Promise<unknown>;
  deleteAction: (id: string) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FieldRow | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreate() { setEditing(null); setOpen(true); }
  function openEdit(f: FieldRow) { setEditing(f); setOpen(true); }

  function onToggle(f: FieldRow) {
    startTransition(async () => {
      try { await updateAction(f.id, { isActive: !f.isActive }); toast.success(f.isActive ? "Field deactivated" : "Field activated"); }
      catch (e) { toast.error((e as Error).message); }
    });
  }

  function onDelete(f: FieldRow) {
    if (!confirm(`Delete field "${f.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      try { await deleteAction(f.id); toast.success("Field deleted"); }
      catch (e) { toast.error((e as Error).message); }
    });
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground max-w-xl">{description}</p>
          </div>
          {!readonly && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate} variant="amber"><Plus className="h-4 w-4" /> Add field</Button>
              </DialogTrigger>
              <FieldDialog
                key={editing?.id ?? "new"}
                initial={editing}
                mappers={mappers}
                onCancel={() => setOpen(false)}
                onSubmit={async (values) => {
                  try {
                    if (editing) {
                      await updateAction(editing.id, values);
                      toast.success("Field updated");
                    } else {
                      await createAction(values);
                      toast.success("Field created");
                    }
                    setOpen(false);
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              />
            </Dialog>
          )}
        </div>

        {fields.length === 0 ? (
          <EmptyState
            title="No fields configured yet"
            description="Add your first dynamic field. Fields appear on customer and company forms and are available in templates as placeholders."
          />
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-3 font-medium">Key</th>
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Type</th>
                  <th className="p-3 font-medium">Mapper</th>
                  <th className="p-3 font-medium">Required</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {fields.map((f) => (
                  <tr key={f.id} className="hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">
                      <span className="inline-flex items-center gap-2">
                        {f.key}
                        {f.isSystem && <Badge variant="outline" className="text-[10px]">system</Badge>}
                      </span>
                    </td>
                    <td className="p-3 font-medium">{f.name}</td>
                    <td className="p-3"><Badge variant="outline">{f.type}</Badge></td>
                    <td className="p-3 text-muted-foreground">{f.optionMapper?.label ?? "—"}</td>
                    <td className="p-3">{f.required ? <Badge variant="amber">Required</Badge> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-3">
                      <label className="inline-flex items-center gap-2 cursor-pointer" title={f.isSystem && f.required ? "Required system field — cannot be deactivated" : f.isActive ? "Active — toggle to deactivate" : "Inactive — toggle to activate"}>
                        <Switch
                          checked={f.isActive}
                          onCheckedChange={() => onToggle(f)}
                          disabled={readonly || isPending || (f.isSystem && f.required)}
                        />
                        <span className="text-xs text-muted-foreground">{f.isActive ? "Active" : "Inactive"}</span>
                      </label>
                    </td>
                    <td className="p-3 text-right">
                      {!readonly && (
                        <div className="inline-flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(f)} title="Edit field"><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => onDelete(f)} disabled={isPending || f.isSystem} title={f.isSystem ? "System fields cannot be deleted" : "Delete field"}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type FormFieldValues = {
  key: string;
  name: string;
  type: FieldType;
  optionMapperId?: string | null;
  required: boolean;
  defaultValue?: string | null;
  placeholder?: string | null;
  helpText?: string | null;
  displayOrder: number;
  isActive: boolean;
};

function FieldDialog({
  initial, mappers, onSubmit, onCancel,
}: {
  initial: FieldRow | null;
  mappers: { id: string; label: string }[];
  onSubmit: (values: FormFieldValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<FormFieldValues>({
    key: initial?.key ?? "",
    name: initial?.name ?? "",
    type: initial?.type ?? "text",
    optionMapperId: initial?.optionMapperId ?? null,
    required: initial?.required ?? false,
    defaultValue: initial?.defaultValue ?? "",
    placeholder: initial?.placeholder ?? "",
    helpText: initial?.helpText ?? "",
    displayOrder: initial?.displayOrder ?? 0,
    isActive: initial?.isActive ?? true,
  });
  const [submitting, setSubmitting] = useState(false);
  const needsMapper = values.type === "select" || values.type === "multi_select";

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{initial ? "Edit field" : "Add field"}</DialogTitle>
        <DialogDescription>Dynamic fields appear on the relevant form and are available in templates via their key.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Key</Label>
            <Input
              value={values.key}
              disabled={!!initial}
              onChange={(e) => setValues({ ...values, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
              placeholder="customer_email"
              className="font-mono text-xs mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {initial?.isSystem
                ? "System field — key and type are locked."
                : <>snake_case, unique. Used in templates: <code>{`{{${values.key || "key"}}}`}</code></>}
            </p>
          </div>
          <div>
            <Label>Display Name</Label>
            <Input value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} placeholder="Customer Email" className="mt-1" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={values.type} disabled={initial?.isSystem} onValueChange={(v) => setValues({ ...values, type: v as FieldType })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {needsMapper && (
            <div>
              <Label>Option Mapper</Label>
              <Select value={values.optionMapperId ?? "__none__"} onValueChange={(v) => setValues({ ...values, optionMapperId: v === "__none__" ? null : v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select mapper" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {mappers.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div>
          <Label>Placeholder</Label>
          <Input value={values.placeholder ?? ""} onChange={(e) => setValues({ ...values, placeholder: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label>Default value</Label>
          <Input value={values.defaultValue ?? ""} onChange={(e) => setValues({ ...values, defaultValue: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label>Help text</Label>
          <Textarea value={values.helpText ?? ""} onChange={(e) => setValues({ ...values, helpText: e.target.value })} className="mt-1" rows={2} />
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={values.required} onCheckedChange={(b) => setValues({ ...values, required: b })} />
            Required
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={values.isActive} onCheckedChange={(b) => setValues({ ...values, isActive: b })} />
            Active
          </label>
          <div className="ml-auto">
            <Label className="text-xs">Order</Label>
            <Input
              type="number"
              value={values.displayOrder}
              onChange={(e) => setValues({ ...values, displayOrder: Number(e.target.value) })}
              className="w-20 h-8 mt-1"
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button
          onClick={async () => {
            setSubmitting(true);
            try { await onSubmit(values); } finally { setSubmitting(false); }
          }}
          disabled={submitting || !values.key || !values.name}
        >
          {submitting ? "Saving…" : initial ? "Save changes" : "Create field"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
