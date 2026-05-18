"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/layout/EmptyState";
import { createInvoiceVariable, updateInvoiceVariable, deleteInvoiceVariable } from "@/server/actions/configuration";

export type InvoiceVariableRow = {
  id: string;
  scope: string;
  key: string;
  label: string;
  defaultValue: string | null;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
};

const SCOPES = [
  { value: "invoice", label: "Invoice variable" },
  { value: "line_item", label: "Line item field" },
  { value: "placeholder", label: "Custom placeholder" },
  { value: "report", label: "Report variable" },
];

const SCOPE_LABELS: Record<string, string> = Object.fromEntries(SCOPES.map((s) => [s.value, s.label]));

export function InvoiceVariablesTab({ variables, readonly }: { variables: InvoiceVariableRow[]; readonly: boolean }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InvoiceVariableRow | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreate() { setEditing(null); setOpen(true); }
  function openEdit(v: InvoiceVariableRow) { setEditing(v); setOpen(true); }

  function onDelete(v: InvoiceVariableRow) {
    if (!confirm(`Delete variable "${v.key}"?`)) return;
    startTransition(async () => {
      try { await deleteInvoiceVariable(v.id); toast.success("Variable deleted"); }
      catch (e) { toast.error((e as Error).message); }
    });
  }

  const grouped = SCOPES.map((s) => ({
    scope: s.value,
    label: s.label,
    rows: variables.filter((v) => v.scope === s.value).sort((a, b) => a.displayOrder - b.displayOrder),
  }));

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold">Variables</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Invoice variables, line item fields, custom placeholders, and report variables available inside templates. Use them in the customer editor and template placeholders like <code>{`{{customer_name}}`}</code>.
            </p>
          </div>
          {!readonly && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate} variant="amber"><Plus className="h-4 w-4" /> Add variable</Button>
              </DialogTrigger>
              <VariableDialog
                key={editing?.id ?? "new"}
                initial={editing}
                onCancel={() => setOpen(false)}
                onSubmit={async (values) => {
                  try {
                    if (editing) {
                      await updateInvoiceVariable(editing.id, values);
                      toast.success("Variable updated");
                    } else {
                      await createInvoiceVariable(values);
                      toast.success("Variable created");
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

        {variables.length === 0 ? (
          <EmptyState title="No variables defined" description="Add custom variables and placeholders that templates can reference." />
        ) : (
          <div className="space-y-6">
            {grouped.map((g) => g.rows.length > 0 && (
              <div key={g.scope}>
                <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-2">{g.label}</h3>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left">
                      <tr>
                        <th className="p-3 font-medium">Key</th>
                        <th className="p-3 font-medium">Label</th>
                        <th className="p-3 font-medium">Default</th>
                        <th className="p-3 font-medium">Status</th>
                        <th className="p-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {g.rows.map((v) => (
                        <tr key={v.id} className="hover:bg-muted/30">
                          <td className="p-3 font-mono text-xs">{v.key}</td>
                          <td className="p-3 font-medium">{v.label}</td>
                          <td className="p-3 text-muted-foreground">{v.defaultValue ?? "—"}</td>
                          <td className="p-3">{v.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</td>
                          <td className="p-3 text-right">
                            {!readonly && (
                              <div className="inline-flex gap-1">
                                <Button size="icon" variant="ghost" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => onDelete(v)} disabled={isPending}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type VariableScope = "invoice" | "line_item" | "placeholder" | "report";

type VariableFormValues = {
  scope: VariableScope;
  key: string;
  label: string;
  defaultValue: string | null;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
};

function VariableDialog({
  initial, onSubmit, onCancel,
}: {
  initial: InvoiceVariableRow | null;
  onSubmit: (values: VariableFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<VariableFormValues>({
    scope: (initial?.scope as VariableScope) ?? "invoice",
    key: initial?.key ?? "",
    label: initial?.label ?? "",
    defaultValue: initial?.defaultValue ?? "",
    description: initial?.description ?? "",
    displayOrder: initial?.displayOrder ?? 0,
    isActive: initial?.isActive ?? true,
  });
  const [submitting, setSubmitting] = useState(false);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{initial ? "Edit variable" : "Add variable"}</DialogTitle>
        <DialogDescription>Variables are referenced by their key in templates and the line-item editor.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Scope</Label>
            <Select value={values.scope} disabled={!!initial} onValueChange={(v) => setValues({ ...values, scope: v as VariableScope })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCOPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">{SCOPE_LABELS[values.scope]}</p>
          </div>
          <div>
            <Label>Key</Label>
            <Input
              value={values.key}
              disabled={!!initial}
              onChange={(e) => setValues({ ...values, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
              placeholder="custom_field"
              className="font-mono text-xs mt-1"
            />
          </div>
        </div>

        <div>
          <Label>Label</Label>
          <Input value={values.label} onChange={(e) => setValues({ ...values, label: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label>Default value</Label>
          <Input value={values.defaultValue ?? ""} onChange={(e) => setValues({ ...values, defaultValue: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={values.description ?? ""} onChange={(e) => setValues({ ...values, description: e.target.value })} rows={2} className="mt-1" />
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Label className="text-xs">Display order</Label>
          <Input type="number" value={values.displayOrder} onChange={(e) => setValues({ ...values, displayOrder: Number(e.target.value) || 0 })} className="w-24 h-8" />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button
          onClick={async () => {
            setSubmitting(true);
            try { await onSubmit(values); } finally { setSubmitting(false); }
          }}
          disabled={submitting || !values.key || !values.label}
        >
          {submitting ? "Saving…" : initial ? "Save changes" : "Create variable"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
