"use client";

import React, { useState, useCallback, useRef } from "react";
import { api } from "~/trpc/react";
import {
  Download,
  Upload,
  Trash2,
  Package,
  Loader2,
  FileJson,
  Globe2,
  Calendar,
  HardDrive,
  Eye,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { TemplatePreviewDialog } from "./TemplatePreviewDialog";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TemplateManager() {
  const [exportName, setExportName] = useState("");
  const [exportDescription, setExportDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace");
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [importJson, setImportJson] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = api.useUtils();

  const { data: templates, isLoading: templatesLoading } = api.geo.listWorldTemplates.useQuery(
    undefined,
    {
      refetchOnWindowFocus: false,
    }
  );

  const exportMutation = api.geo.exportWorldTemplate.useMutation({
    onSuccess: () => {
      setExportName("");
      setExportDescription("");
      void utils.geo.listWorldTemplates.invalidate();
    },
  });

  const importMutation = api.geo.importWorldTemplate.useMutation({
    onSuccess: () => {
      setImportJson(null);
      void utils.geo.listWorldTemplates.invalidate();
      void utils.geo.getMapStats.invalidate();
    },
  });

  const deleteMutation = api.geo.deleteWorldTemplate.useMutation({
    onSuccess: () => {
      void utils.geo.listWorldTemplates.invalidate();
    },
  });

  const handleExport = useCallback(() => {
    if (!exportName.trim()) return;
    exportMutation.mutate({
      name: exportName.trim(),
      description: exportDescription.trim() || undefined,
      isPublic,
    });
  }, [exportName, exportDescription, isPublic, exportMutation]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImportJson(reader.result as string);
    };
    reader.readAsText(file);
    // Reset the input so the same file can be re-selected
    e.target.value = "";
  }, []);

  const handleImportFromFile = useCallback(() => {
    if (!importJson) return;
    importMutation.mutate({ templateJson: importJson, mode: importMode });
  }, [importJson, importMode, importMutation]);

  const handleImportFromTemplate = useCallback(
    (templateId: string) => {
      importMutation.mutate({ templateId, mode: importMode });
    },
    [importMode, importMutation]
  );

  const handleDelete = useCallback(
    (templateId: string) => {
      deleteMutation.mutate({ templateId });
    },
    [deleteMutation]
  );

  const handleDownload = useCallback(
    async (templateId: string, name: string) => {
      try {
        const data = await utils.geo.downloadWorldTemplate.fetch({ templateId });
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${name.replace(/\s+/g, "-").toLowerCase()}-template.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Download failed:", err);
      }
    },
    [utils]
  );

  return (
    <div className="space-y-6">
      {/* Export Section */}
      <div className="border-border bg-muted/50 rounded-xl border p-5">
        <div className="mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-emerald-400" />
          <h3 className="text-foreground text-lg font-semibold">Export World Template</h3>
        </div>
        <p className="text-muted-foreground mb-4 text-sm">
          Export the current world state (all map layers, countries, sovereignty) as a reusable
          template.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium">
              Template Name *
            </label>
            <Input
              value={exportName}
              onChange={(e) => setExportName(e.target.value)}
              placeholder="e.g., IxEarth v2.0"
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium">
              Description
            </label>
            <textarea
              value={exportDescription}
              onChange={(e) => setExportDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              className="border-border bg-muted/50 text-foreground placeholder-muted-foreground w-full rounded-lg border px-3 py-2 text-sm focus:border-emerald-500/50 focus:outline-none"
            />
          </div>
          <label className="text-muted-foreground flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="border-border rounded"
            />
            Make template public
          </label>

          <Button
            onClick={handleExport}
            disabled={!exportName.trim() || exportMutation.isPending}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
          >
            {exportMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Package className="h-4 w-4" />
            )}
            {exportMutation.isPending ? "Exporting..." : "Export Current World"}
          </Button>

          {exportMutation.isSuccess && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-500">
              Template exported successfully! {exportMutation.data.totalFeatures} features,{" "}
              {formatBytes(exportMutation.data.fileSizeBytes ?? 0)}.
            </div>
          )}
          {exportMutation.isError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
              Export failed: {exportMutation.error.message}
            </div>
          )}
        </div>
      </div>

      {/* Import Section */}
      <div className="border-border bg-muted/50 rounded-xl border p-5">
        <div className="mb-4 flex items-center gap-2">
          <Upload className="h-5 w-5 text-blue-400" />
          <h3 className="text-foreground text-lg font-semibold">Import Template</h3>
        </div>

        <div className="mb-4 flex gap-3">
          <label className="text-foreground flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="importMode"
              value="replace"
              checked={importMode === "replace"}
              onChange={() => setImportMode("replace")}
            />
            Replace (deactivate all existing)
          </label>
          <label className="text-foreground flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="importMode"
              value="merge"
              checked={importMode === "merge"}
              onChange={() => setImportMode("merge")}
            />
            Merge (replace per-layer)
          </label>
        </div>

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <FileJson className="h-4 w-4" />
            Choose JSON File
          </Button>

          {importJson && (
            <>
              <span className="text-muted-foreground text-xs">
                {formatBytes(importJson.length)} loaded
              </span>
              <Button onClick={handleImportFromFile} disabled={importMutation.isPending}>
                {importMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Import
              </Button>
            </>
          )}
        </div>

        {importMutation.isSuccess && (
          <div className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-500">
            <p className="font-medium">
              Import complete: {importMutation.data.totalImported} features
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-blue-500/70">
              {importMutation.data.log.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        )}
        {importMutation.isError && (
          <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
            Import failed: {importMutation.error.message}
          </div>
        )}
      </div>

      {/* Template Library */}
      <div className="border-border bg-muted/50 rounded-xl border p-5">
        <div className="mb-4 flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-purple-400" />
          <h3 className="text-foreground text-lg font-semibold">Template Library</h3>
        </div>

        {templatesLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading templates...</span>
          </div>
        ) : !templates || templates.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            No templates saved yet. Export your first world template above.
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => {
              const meta = t.metadata as Record<string, unknown> | null;
              const featureCounts = meta?.featureCounts as Record<string, number> | undefined;
              return (
                <div
                  key={t.id}
                  className="border-border bg-muted/30 flex items-start justify-between rounded-lg border p-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-foreground font-medium">{t.name}</h4>
                      <span className="bg-muted/50 text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
                        v{t.version}
                      </span>
                      {t.isPublic && (
                        <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-500">
                          Public
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-muted-foreground mt-1 text-xs">{t.description}</p>
                    )}
                    <div className="text-muted-foreground mt-2 flex flex-wrap gap-3 text-xs">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(t.createdAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {formatBytes(t.fileSizeBytes)}
                      </span>
                      {featureCounts && (
                        <span>
                          {Object.entries(featureCounts)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="ml-4 flex gap-1">
                    <button
                      onClick={() => setPreviewTemplateId(t.id)}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1.5"
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => void handleDownload(t.id, t.name)}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1.5"
                      title="Download JSON"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleImportFromTemplate(t.id)}
                      disabled={importMutation.isPending}
                      className="rounded p-1.5 text-blue-400/60 hover:bg-blue-500/10 hover:text-blue-500"
                      title={`Import (${importMode} mode)`}
                    >
                      <Upload className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={deleteMutation.isPending}
                      className="rounded p-1.5 text-red-400/40 hover:bg-red-500/10 hover:text-red-500"
                      title="Delete template"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      {previewTemplateId && (
        <TemplatePreviewDialog
          templateId={previewTemplateId}
          onClose={() => setPreviewTemplateId(null)}
        />
      )}
    </div>
  );
}
