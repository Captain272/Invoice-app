"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Upload, Trash2, FileCode, FileText, Plus, Download, Pencil } from "lucide-react";
import { Switch } from "@/components/ui/switch";
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
import { uploadReportTemplate, updateReportTemplate, deleteReportTemplate, toggleReportTemplate } from "@/server/actions/configuration";

type Template = {
  id: string;
  reportName: string;
  reportType: string;
  templateType: "HTML" | "XML";
  exportFormat: "PDF" | "XML" | "PDFA3";
  fileNameFormula: string;
  originalFileName: string;
  description?: string | null;
  version: number;
  isActive: boolean;
  createdAt: Date;
};

const EXPORT_FORMAT_LABELS: Record<Template["exportFormat"], string> = {
  PDF: "PDF",
  PDFA3: "PDF/A-3",
  XML: "XML",
};

export function ReportMappingsTab({ templates, readonly }: { templates: Template[]; readonly: boolean }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
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
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button variant="amber"><Plus className="h-4 w-4" /> Upload template</Button>
              </DialogTrigger>
              <TemplateDialog mode="create" onDone={() => setUploadOpen(false)} />
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
                    <Badge variant="outline">{EXPORT_FORMAT_LABELS[t.exportFormat]}</Badge>
                    <Badge variant="secondary">v{t.version}</Badge>
                    {!t.isActive && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <div><span className="font-medium text-foreground/70">Type:</span> {t.reportType}</div>
                    <div><span className="font-medium text-foreground/70">Source:</span> {t.templateType} → {EXPORT_FORMAT_LABELS[t.exportFormat]}</div>
                    <div><span className="font-medium text-foreground/70">File:</span> {t.originalFileName}</div>
                    <div><span className="font-medium text-foreground/70">Uploaded:</span> {formatDateTime(t.createdAt)}</div>
                    <div className="col-span-2"><span className="font-medium text-foreground/70">Filename formula:</span> <code className="text-xs">{t.fileNameFormula}</code></div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {!readonly && (
                    <label className="inline-flex items-center gap-2 cursor-pointer" title={t.isActive ? "Active — toggle to deactivate" : "Inactive — toggle to activate"}>
                      <Switch checked={t.isActive} onCheckedChange={() => onToggle(t)} disabled={isPending} />
                      <span className="text-xs text-muted-foreground">{t.isActive ? "Active" : "Inactive"}</span>
                    </label>
                  )}
                  <Button size="icon" variant="ghost" asChild title="Download template">
                    <a href={`/api/templates/${t.id}/download`} download={t.originalFileName}>
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  {!readonly && (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => setEditing(t)} title="Edit / re-upload template"><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => onDelete(t)} disabled={isPending} title="Delete template"><Trash2 className="h-4 w-4" /></Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          {editing && (
            <TemplateDialog
              mode="edit"
              key={editing.id}
              template={editing}
              onDone={() => setEditing(null)}
            />
          )}
        </Dialog>
      </CardContent>
    </Card>
  );
}

function TemplateDialog({
  mode,
  template,
  onDone,
}: {
  mode: "create" | "edit";
  template?: Template;
  onDone: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [templateType, setTemplateType] = useState<Template["templateType"]>(template?.templateType ?? "HTML");
  const [exportFormat, setExportFormat] = useState<Template["exportFormat"]>(template?.exportFormat ?? "PDF");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    fd.set("templateType", templateType);
    fd.set("exportFormat", exportFormat);
    setSubmitting(true);
    try {
      if (mode === "create") {
        await uploadReportTemplate(fd);
        toast.success("Template uploaded");
      } else if (template) {
        await updateReportTemplate(template.id, fd);
        toast.success("Template updated");
      }
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const isEdit = mode === "edit";

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit report template" : "Upload report template"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Update metadata, or upload a new file to replace the current version. The version number is bumped on file replacement."
            : <>Upload an HTML or XML template and pick the output format the generator should produce.</>}
        </DialogDescription>
      </DialogHeader>
      <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
        <div>
          <Label>Name</Label>
          <Input name="reportName" required defaultValue={template?.reportName ?? ""} placeholder="Standard Invoice" className="mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Report type</Label>
            <Input name="reportType" defaultValue={template?.reportType ?? "invoice"} required className="mt-1" />
          </div>
          <div>
            <Label>Source format</Label>
            <Select value={templateType} onValueChange={(v) => setTemplateType(v as Template["templateType"])}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="HTML">HTML</SelectItem>
                <SelectItem value="XML">XML</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Output format</Label>
          <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as Template["exportFormat"])}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PDF">PDF — standard</SelectItem>
              <SelectItem value="PDFA3">PDF/A-3 — archive-ready</SelectItem>
              <SelectItem value="XML">XML — structured data</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">Picked once here — when users generate from this template, this is the format they get.</p>
        </div>
        <div>
          <Label>Filename formula</Label>
          <Input name="fileNameFormula" defaultValue={template?.fileNameFormula ?? "invoice_{{invoice_number}}_{{customer_name}}_{{today}}"} required className="mt-1 font-mono text-xs" />
          <p className="text-xs text-muted-foreground mt-1">Supports the same placeholders as templates. Output is sanitized for filesystem use.</p>
        </div>
        <div>
          <Label>Description (optional)</Label>
          <Textarea name="description" rows={2} defaultValue={template?.description ?? ""} className="mt-1" />
        </div>
        <div>
          <Label>{isEdit ? "Replace file (optional — leave empty to keep current)" : "Template file (.html or .xml, max 2 MB)"}</Label>
          <Input type="file" name="file" required={!isEdit} accept=".html,.htm,.xml" className="mt-1" />
          {isEdit && template && (
            <p className="text-xs text-muted-foreground mt-1">Current: <code className="text-xs">{template.originalFileName}</code> (v{template.version}). Uploading a new file will create v{template.version + 1}.</p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone} disabled={submitting}>Cancel</Button>
          <Button type="submit" disabled={submitting}>
            <Upload className="h-4 w-4" />
            {submitting ? (isEdit ? "Saving…" : "Uploading…") : (isEdit ? "Save changes" : "Upload")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
