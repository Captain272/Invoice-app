"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FieldType } from "@prisma/client";

export type DynamicField = {
  id: string;
  key: string;
  name: string;
  type: FieldType;
  required: boolean;
  placeholder?: string | null;
  helpText?: string | null;
  defaultValue?: string | null;
  optionMapper?: { values: { label: string; value: string }[] } | null;
};

export function DynamicFieldRenderer({
  field,
  value,
  onChange,
  error,
}: {
  field: DynamicField;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  error?: string;
}) {
  const v = value ?? "";
  const opts = field.optionMapper?.values ?? [];
  const id = `df_${field.key}`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {field.name} {field.required && <span className="text-destructive">*</span>}
      </Label>
      {(() => {
        switch (field.type) {
          case "textarea":
            return <Textarea id={id} value={v} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} rows={3} />;
          case "integer":
            return <Input id={id} type="number" step="1" value={v} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} />;
          case "decimal":
          case "currency":
            return <Input id={id} type="number" step="0.01" value={v} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} />;
          case "date":
            return <Input id={id} type="date" value={v} onChange={(e) => onChange(e.target.value)} />;
          case "boolean":
            return (
              <div className="flex items-center gap-2 h-10">
                <Switch checked={v === "true"} onCheckedChange={(b) => onChange(b ? "true" : "false")} />
                <span className="text-sm text-muted-foreground">{v === "true" ? "Yes" : "No"}</span>
              </div>
            );
          case "select":
            return (
              <Select value={v || "__empty__"} onValueChange={(x) => onChange(x === "__empty__" ? null : x)}>
                <SelectTrigger><SelectValue placeholder={field.placeholder ?? "Select…"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__empty__">—</SelectItem>
                  {opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            );
          case "multi_select":
            return (
              <div className="flex flex-wrap gap-2">
                {opts.map((o) => {
                  const arr = v ? v.split(",").filter(Boolean) : [];
                  const checked = arr.includes(o.value);
                  return (
                    <label key={o.value} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm cursor-pointer hover:bg-muted/40">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value);
                          onChange(next.join(",") || null);
                        }}
                      />
                      {o.label}
                    </label>
                  );
                })}
              </div>
            );
          case "email":
            return <Input id={id} type="email" value={v} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} />;
          case "phone":
            return <Input id={id} type="tel" value={v} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} />;
          default:
            return <Input id={id} value={v} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} />;
        }
      })()}
      {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
