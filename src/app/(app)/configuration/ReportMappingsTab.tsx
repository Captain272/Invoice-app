"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Upload, Trash2, Power, FileCode, FileText, Plus, Download } from "lucide-react";
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
import { formatDateTime } from "@/lib/utils";
import { uploadReportTemplate, deleteReportTemplate, toggleReportTemplate } from "@/server/actions/configuration";

type Template = {
  id: string;
  reportName: string;
  reportType: string;
  templateType: "HTML" | "XML";
  fileNameFormula: string;
  originalFileName: string;
  description?: string | null;
  version: number;
  isActive: boolean;
  createdAt: Date;
};

export function ReportMappingsTab({ templates, readonly }: { templates: Template[]; readonly: boolean }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onToggle(t: Template) {
    startTransition(async () => {
      try { await toggleReportTemplate(t.id, !t.isActive); toast.success("Updated"); }
      catch (e) { toast.error((e as Error).message); }
    });
  }

  function onDelete(t: Template) {
    if (!confirm(`Delete template "${t.reportName}"?`)) return;
    startTransition(async () => {
      try { await deleteReportTemplate(t.id); toast.success("Template deleted"); }
      catch (e) { toast.error((e as Error).message); }
    });
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold">Report Mappings</h2>
            <p className="text-sm text-muted-foreground max-w-xl">Upload HTML or XML templates. They power document generation — use placeholders like <code>{`{{customer_name}}`}</code>, loops <code>{`{{#line_items}}…{{/line_items}}`}</code>, conditionals <code>{`{{if …}}…{{/if}}`}</code>, and formulas <code>{`{{formula: quantity * unit_price}}`}</code>.</p>
          </div>
          {!readonly && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="amber"><Plus className="h-4 w-4" /> Upload template</Button>
              </DialogTrigger>
              <UploadDialog onDone={() => setOpen(false)} />
            </Dialog>
          )}
        </div>

        {templates.length === 0 ? (
          <EmptyState
            icon={FileCode}
            title="Upload your first HTML or XML template to start generating custom business documents."
          />
        ) : (
          <div className="grid gap-3">
            {templates.map((t) => (
              <div key={t.id} className="flex items-start gap-4 rounded-lg border p-4 hover:bg-muted/30 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber/15 text-amber-foreground shrink-0">
                  {t.templateType === "HTML" ? <FileText className="h-5 w-5" /> : <FileCode className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{t.reportName}</h3>
                    <Badge variant="outline">{t.templateType}</Badge>
                    <Badge variant="secondary">v{t.version}</Badge>
                    {!t.isActive && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <div><span className="font-medium text-foreground/70">Type:</span> {t.reportType}</div>
                    <div><span className="font-medium text-foreground/70">File:</span> {t.originalFileName}</div>
                    <div className="col-span-2"><span className="font-medium text-foreground/70">Filename formula:</span> <code className="text-xs">{t.fileNameFormula}</code></div>
                    <div><span className="font-medium text-foreground/70">Uploaded:</span> {formatDateTime(t.createdAt)}</div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" asChild title="Download template">
                    <a href={`/api/templates/${t.id}/download`} download={t.originalFileName}>
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  {!readonly && (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => onToggle(t)} disabled={isPending}><Power className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => onDelete(t)} disabled={isPending}><Trash2 className="h-4 w-4" /></Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UploadDialog({ onDone }: { onDone: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [templateType, setTemplateType] = useState<"HTML" | "XML">("HTML");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    fd.set("templateType", templateType);
    setSubmitting(true);
    try {
      await uploadReportTemplate(fd);
      toast.success("Template uploaded");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Upload report template</DialogTitle>
        <DialogDescription>Upload an HTML or XML template. Use placeholders like <code>{`{{invoice_number}}`}</code>.</DialogDescription>
      </DialogHeader>
      <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
        <div>
          <Label>Name</Label>
          <Input name="reportName" required placeholder="Standard Invoice" className="mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Report type</Label>
            <Input name="reportType" defaultValue="invoice" required className="mt-1" />
          </div>
          <div>
            <Label>Template type</Label>
            <Select value={templateType} onValueChange={(v) => setTemplateType(v as "HTML" | "XML")}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="HTML">HTML</SelectItem>
                <SelectItem value="XML">XML</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Filename formula</Label>
          <Input name="fileNameFormula" defaultValue="invoice_{{invoice_number}}_{{customer_name}}_{{today}}" required className="mt-1 font-mono text-xs" />
          <p className="text-xs text-muted-foreground mt-1">Supports the same placeholders as templates. Output is sanitized for filesystem use.</p>
        </div>
        <div>
          <Label>Description (optional)</Label>
          <Textarea name="description" rows={2} className="mt-1" />
        </div>
        <div>
          <Label>Template file (.html or .xml, max 2 MB)</Label>
          <Input type="file" name="file" required accept=".html,.htm,.xml" className="mt-1" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone} disabled={submitting}>Cancel</Button>
          <Button type="submit" disabled={submitting}><Upload className="h-4 w-4" />{submitting ? "Uploading…" : "Upload"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
