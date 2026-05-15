"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile, updateAppSetting } from "@/server/actions/settings";

export function SettingsForm({
  initialName, initialEmail, settings,
}: {
  initialName: string;
  initialEmail: string;
  settings: Record<string, string>;
}) {
  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState("");
  const [currency, setCurrency] = useState(settings.default_currency ?? "EUR");
  const [format, setFormat] = useState(settings.default_export ?? "PDF");
  const [isPending, startTransition] = useTransition();

  async function saveProfile() {
    startTransition(async () => {
      try { await updateProfile({ name, password: password || undefined }); toast.success("Profile updated"); setPassword(""); }
      catch (e) { toast.error((e as Error).message); }
    });
  }

  async function saveDefaults() {
    startTransition(async () => {
      try {
        await updateAppSetting("default_currency", currency);
        await updateAppSetting("default_export", format);
        toast.success("Defaults saved");
      } catch (e) { toast.error((e as Error).message); }
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" /></div>
        <div><Label>Email</Label><Input value={initialEmail} disabled className="mt-1" /></div>
        <div><Label>New password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" placeholder="Leave blank to keep current" /></div>
        <div className="flex justify-end"><Button onClick={saveProfile} disabled={isPending}>{isPending ? "Saving…" : "Save profile"}</Button></div>
      </div>

      <div className="border-t pt-5 space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">App defaults</h3>
        <div><Label>Default currency</Label><Input value={currency} onChange={(e) => setCurrency(e.target.value)} className="mt-1" /></div>
        <div>
          <Label>Default export format</Label>
          <select value={format} onChange={(e) => setFormat(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="PDF">PDF</option>
            <option value="XML">XML</option>
            <option value="PDFA3">PDF/A-3</option>
          </select>
        </div>
        <div className="flex justify-end"><Button onClick={saveDefaults} disabled={isPending} variant="outline">{isPending ? "Saving…" : "Save defaults"}</Button></div>
      </div>
    </div>
  );
}
