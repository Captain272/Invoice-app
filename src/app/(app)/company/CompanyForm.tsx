"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Image as ImageIcon } from "lucide-react";
import type { CompanyFieldValue, CompanyProfile } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DynamicFieldRenderer, type DynamicField } from "@/components/forms/DynamicFieldRenderer";
import { saveCompanyProfile, uploadCompanyLogo } from "@/server/actions/company";

type SystemField = DynamicField & { systemColumn: string | null; displayOrder: number };
type CustomField = DynamicField & { displayOrder: number };

type CoreState = {
  companyName: string;
  address: string;
  vatId: string;
  email: string;
  phone: string;
  website: string;
  bankName: string;
  iban: string;
  swift: string;
  taxNumber: string;
};

const MONO_COLUMNS = new Set(["iban", "swift"]);

export function CompanyForm({
  profile,
  systemFields,
  customFields,
  fieldValues,
  readonly,
}: {
  profile: CompanyProfile | null;
  systemFields: SystemField[];
  customFields: CustomField[];
  fieldValues: CompanyFieldValue[];
  readonly: boolean;
}) {
  const router = useRouter();
  const [core, setCore] = useState<CoreState>({
    companyName: profile?.companyName ?? "",
    address: profile?.address ?? "",
    vatId: profile?.vatId ?? "",
    email: profile?.email ?? "",
    phone: profile?.phone ?? "",
    website: profile?.website ?? "",
    bankName: profile?.bankName ?? "",
    iban: profile?.iban ?? "",
    swift: profile?.swift ?? "",
    taxNumber: profile?.taxNumber ?? "",
  });
  const [coreErrors, setCoreErrors] = useState<Record<string, string>>({});

  const initialDynamic: Record<string, string | null> = {};
  for (const fc of customFields) {
    const fv = fieldValues.find((v) => v.fieldConfigId === fc.id);
    initialDynamic[fc.key] = fv?.value ?? fc.defaultValue ?? "";
  }
  const [dynamic, setDynamic] = useState(initialDynamic);
  const [dynamicErrors, setDynamicErrors] = useState<Record<string, string>>({});

  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(profile?.logoUrl ?? null);

  function valueFor(col: string): string {
    return (core as unknown as Record<string, string>)[col] ?? "";
  }
  function setValueFor(col: string, val: string) {
    setCore((c) => ({ ...c, [col]: val } as CoreState));
  }

  function validate(): boolean {
    const ce: Record<string, string> = {};
    for (const fc of systemFields) {
      if (!fc.systemColumn || !fc.required) continue;
      if (!valueFor(fc.systemColumn)) ce[fc.systemColumn] = `${fc.name} is required`;
    }
    if (!core.companyName) ce.companyName = "Company name is required";
    setCoreErrors(ce);

    const de: Record<string, string> = {};
    for (const fc of customFields) {
      if (fc.required && !dynamic[fc.key]) de[fc.key] = `${fc.name} is required`;
    }
    setDynamicErrors(de);
    return Object.keys(ce).length === 0 && Object.keys(de).length === 0;
  }

  function save() {
    if (!validate()) { toast.error("Please fill required fields"); return; }
    startTransition(async () => {
      try {
        await saveCompanyProfile({ core, dynamic });
        toast.success("Company saved");
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  async function onLogoFile(file: File) {
    if (!profile) { toast.error("Save company profile first"); return; }
    const fd = new FormData();
    fd.set("file", file);
    setUploading(true);
    try {
      const res = await uploadCompanyLogo(fd);
      setLogoUrl(res.path);
      toast.success("Logo uploaded");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card><CardContent className="p-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {systemFields.map((fc) => {
          if (!fc.systemColumn) return null;
          const col = fc.systemColumn;
          const v = valueFor(col);
          const err = coreErrors[col];
          const isFullRow = fc.type === "textarea" || col === "address";
          return (
            <div key={fc.id} className={isFullRow ? "md:col-span-2" : ""}>
              <Label>{fc.name} {fc.required && <span className="text-destructive">*</span>}</Label>
              <SystemCompanyInput
                field={fc}
                value={v}
                onChange={(val) => setValueFor(col, val)}
                disabled={readonly}
                isMono={MONO_COLUMNS.has(col)}
              />
              {fc.helpText && <p className="text-xs text-muted-foreground mt-1">{fc.helpText}</p>}
              {err && <p className="text-xs text-destructive mt-1">{err}</p>}
            </div>
          );
        })}
      </div>

      <div className="border-t pt-5">
        <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Company logo</h3>
        <div className="flex items-start gap-4">
          <div className="flex h-24 w-40 items-center justify-center rounded-md border bg-muted/30 overflow-hidden">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm">{logoUrl ? "Logo uploaded ✓" : "No logo uploaded"}</p>
            <p className="text-xs text-muted-foreground mt-1">JPEG or PNG, max 1.5 MB. Use <code>{`{{company_logo}}`}</code> in templates.</p>
            <div className="mt-3 flex gap-2">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png" hidden onChange={(e) => e.target.files?.[0] && onLogoFile(e.target.files[0])} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={readonly || uploading}>
                <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload logo"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {customFields.length > 0 && (
        <div className="border-t pt-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Additional fields</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customFields.map((fc) => (
              <DynamicFieldRenderer
                key={fc.id}
                field={fc}
                value={dynamic[fc.key]}
                onChange={(v) => setDynamic({ ...dynamic, [fc.key]: v ?? "" })}
                error={dynamicErrors[fc.key]}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" disabled={readonly || isPending} onClick={() => router.refresh()}>Reset</Button>
        <Button disabled={readonly || isPending} onClick={save} variant="amber">{isPending ? "Saving…" : "Save"}</Button>
      </div>
    </CardContent></Card>
  );
}

function SystemCompanyInput({
  field, value, onChange, disabled, isMono,
}: {
  field: SystemField;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  isMono: boolean;
}) {
  if (field.type === "textarea") {
    return <Textarea value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} className="mt-1" rows={2} />;
  }
  const inputType = field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text";
  return <Input type={inputType} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} className={`mt-1 ${isMono ? "font-mono" : ""}`} />;
}
