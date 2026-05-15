"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import type { CompanyFieldValue, CompanyProfile } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DynamicFieldRenderer, type DynamicField } from "@/components/forms/DynamicFieldRenderer";
import { saveCompanyProfile, uploadCompanyLogo } from "@/server/actions/company";

export function CompanyForm({
  profile,
  fieldConfigs,
  fieldValues,
  readonly,
}: {
  profile: CompanyProfile | null;
  fieldConfigs: DynamicField[];
  fieldValues: CompanyFieldValue[];
  readonly: boolean;
}) {
  const router = useRouter();
  const [core, setCore] = useState({
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
  const initialDynamic: Record<string, string | null> = {};
  for (const fc of fieldConfigs) {
    const fv = fieldValues.find((v) => v.fieldConfigId === fc.id);
    initialDynamic[fc.key] = fv?.value ?? fc.defaultValue ?? "";
  }
  const [dynamic, setDynamic] = useState(initialDynamic);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(profile?.logoUrl ?? null);

  function save() {
    if (!core.companyName) { toast.error("Company name is required"); return; }
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
        <div><Label>Company name <span className="text-destructive">*</span></Label><Input value={core.companyName} disabled={readonly} onChange={(e) => setCore({ ...core, companyName: e.target.value })} className="mt-1" /></div>
        <div><Label>VAT ID</Label><Input value={core.vatId} disabled={readonly} onChange={(e) => setCore({ ...core, vatId: e.target.value })} className="mt-1" /></div>
        <div className="md:col-span-2"><Label>Address</Label><Textarea value={core.address} disabled={readonly} onChange={(e) => setCore({ ...core, address: e.target.value })} className="mt-1" rows={2} /></div>
        <div><Label>Email</Label><Input type="email" value={core.email} disabled={readonly} onChange={(e) => setCore({ ...core, email: e.target.value })} className="mt-1" /></div>
        <div><Label>Phone</Label><Input value={core.phone} disabled={readonly} onChange={(e) => setCore({ ...core, phone: e.target.value })} className="mt-1" /></div>
        <div><Label>Website</Label><Input value={core.website} disabled={readonly} onChange={(e) => setCore({ ...core, website: e.target.value })} className="mt-1" /></div>
        <div><Label>Tax number</Label><Input value={core.taxNumber} disabled={readonly} onChange={(e) => setCore({ ...core, taxNumber: e.target.value })} className="mt-1" /></div>
        <div><Label>Bank name</Label><Input value={core.bankName} disabled={readonly} onChange={(e) => setCore({ ...core, bankName: e.target.value })} className="mt-1" /></div>
        <div><Label>IBAN</Label><Input value={core.iban} disabled={readonly} onChange={(e) => setCore({ ...core, iban: e.target.value })} className="mt-1 font-mono" /></div>
        <div><Label>SWIFT / BIC</Label><Input value={core.swift} disabled={readonly} onChange={(e) => setCore({ ...core, swift: e.target.value })} className="mt-1 font-mono" /></div>
      </div>

      <div className="border-t pt-5">
        <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Company logo</h3>
        <div className="flex items-start gap-4">
          <div className="flex h-24 w-40 items-center justify-center rounded-md border bg-muted/30 overflow-hidden">
            {logoUrl ? (
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            )}
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

      {fieldConfigs.length > 0 && (
        <div className="border-t pt-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Additional fields</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fieldConfigs.map((fc) => (
              <DynamicFieldRenderer key={fc.id} field={fc} value={dynamic[fc.key]} onChange={(v) => setDynamic({ ...dynamic, [fc.key]: v ?? "" })} />
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
