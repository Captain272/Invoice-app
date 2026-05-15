"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/layout/EmptyState";
import { createOptionMapper, updateOptionMapper, deleteOptionMapper } from "@/server/actions/configuration";

type Mapper = {
  id: string;
  key: string;
  label: string;
  isActive: boolean;
  values: { id?: string; label: string; value: string; displayOrder: number }[];
  _count?: { customerFields: number; companyFields: number };
};

export function OptionMappersTab({ mappers, readonly }: { mappers: Mapper[]; readonly: boolean }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Mapper | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreate() { setEditing(null); setOpen(true); }
  function openEdit(m: Mapper) { setEditing(m); setOpen(true); }

  function onDelete(m: Mapper) {
    const usage = (m._count?.customerFields ?? 0) + (m._count?.companyFields ?? 0);
    if (usage > 0) { toast.error(`Mapper is used by ${usage} field(s)`); return; }
    if (!confirm(`Delete mapper "${m.label}"?`)) return;
    startTransition(async () => {
      try { await deleteOptionMapper(m.id); toast.success("Mapper deleted"); }
      catch (e) { toast.error((e as Error).message); }
    });
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold">Option Mappers</h2>
            <p className="text-sm text-muted-foreground max-w-xl">Reusable dropdown option lists. Reference them from select/multi-select fields.</p>
          </div>
          {!readonly && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate} variant="amber"><Plus className="h-4 w-4" /> Add mapper</Button>
              </DialogTrigger>
              <MapperDialog
                key={editing?.id ?? "new"}
                initial={editing}
                onCancel={() => setOpen(false)}
                onSubmit={async (data) => {
                  try {
                    if (editing) await updateOptionMapper(editing.id, data);
                    else await createOptionMapper(data);
                    toast.success(editing ? "Mapper updated" : "Mapper created");
                    setOpen(false);
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              />
            </Dialog>
          )}
        </div>

        {mappers.length === 0 ? (
          <EmptyState title="No option mappers yet" description="Create reusable dropdowns like tax types, payment terms, or currencies." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {mappers.map((m) => {
              const usage = (m._count?.customerFields ?? 0) + (m._count?.companyFields ?? 0);
              return (
                <div key={m.id} className="rounded-lg border p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{m.label}</h3>
                        {!m.isActive && <Badge variant="secondary">Inactive</Badge>}
                      </div>
                      <p className="font-mono text-xs text-muted-foreground mt-0.5">{m.key}</p>
                    </div>
                    {!readonly && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => onDelete(m)} disabled={isPending}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.values.map((v, i) => <Badge key={i} variant="outline">{v.label}</Badge>)}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Used by {usage} field{usage === 1 ? "" : "s"}</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MapperDialog({
  initial, onSubmit, onCancel,
}: {
  initial: Mapper | null;
  onSubmit: (data: { key: string; label: string; isActive: boolean; values: { label: string; value: string; displayOrder: number }[] }) => Promise<void>;
  onCancel: () => void;
}) {
  const [key, setKey] = useState(initial?.key ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [values, setValues] = useState<{ label: string; value: string }[]>(
    initial?.values.length ? initial.values.map((v) => ({ label: v.label, value: v.value })) : [{ label: "", value: "" }]
  );
  const [submitting, setSubmitting] = useState(false);

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{initial ? "Edit option mapper" : "Add option mapper"}</DialogTitle>
        <DialogDescription>Define reusable dropdown values.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Key</Label>
            <Input value={key} disabled={!!initial} onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} className="font-mono text-xs mt-1" />
          </div>
          <div>
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Values</Label>
          {values.map((v, i) => (
            <div key={i} className="flex gap-2">
              <Input value={v.label} onChange={(e) => setValues(values.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Label" />
              <Input value={v.value} onChange={(e) => setValues(values.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="Value" />
              <Button variant="ghost" size="icon" onClick={() => setValues(values.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setValues([...values, { label: "", value: "" }])}><Plus className="h-4 w-4" /> Add value</Button>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button
          disabled={submitting || !key || !label || values.filter(v => v.label && v.value).length === 0}
          onClick={async () => {
            setSubmitting(true);
            try {
              await onSubmit({
                key, label, isActive,
                values: values.filter(v => v.label && v.value).map((v, i) => ({ ...v, displayOrder: i })),
              });
            } finally { setSubmitting(false); }
          }}
        >
          {submitting ? "Saving…" : initial ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
