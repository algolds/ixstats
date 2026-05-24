"use client";

/**
 * SvgUploadManager - Admin tab for uploading and managing SVG map layers.
 *
 * Features:
 * - Layer type selector
 * - Drag-and-drop SVG file upload
 * - Upload history table with status badges
 * - Process, preview, commit, rollback actions
 */

import { useState, useRef, useCallback } from "react";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Upload,
  FileUp,
  Loader2,
  RotateCcw,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Cog,
} from "lucide-react";
import { SvgProcessingDialog } from "./SvgProcessingDialog";

const LAYER_TYPES = [
  { value: "political", label: "Political" },
  { value: "climate", label: "Climate" },
  { value: "altitudes", label: "Altitudes" },
  { value: "rivers", label: "Rivers" },
  { value: "lakes", label: "Lakes" },
  { value: "icecaps", label: "Icecaps" },
  { value: "background", label: "Background" },
] as const;

type LayerType = (typeof LAYER_TYPES)[number]["value"];

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-amber-500", label: "Pending" },
  processing: { icon: Cog, color: "text-blue-500", label: "Processing" },
  processed: { icon: CheckCircle2, color: "text-emerald-500", label: "Processed" },
  failed: { icon: XCircle, color: "text-red-500", label: "Failed" },
  rolled_back: { icon: RotateCcw, color: "text-muted-foreground", label: "Rolled Back" },
};

export function SvgUploadManager() {
  const [selectedLayer, setSelectedLayer] = useState<LayerType>("political");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [processingUpload, setProcessingUpload] = useState<{
    id: string;
    fileName: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = api.useUtils();

  const { data: history, isLoading: historyLoading } = api.geo.getSvgUploadHistory.useQuery(
    { layerType: selectedLayer },
    { refetchInterval: 10000 }
  );

  const [uploadError, setUploadError] = useState<string | null>(null);

  const rollbackMutation = api.geo.rollbackSvgUpload.useMutation({
    onSuccess: () => {
      utils.geo.getSvgUploadHistory.invalidate();
      utils.geo.getMapStats.invalidate();
    },
  });

  const deleteMutation = api.geo.deleteSvgUpload.useMutation({
    onSuccess: () => utils.geo.getSvgUploadHistory.invalidate(),
  });

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".svg")) {
        alert("Please upload an SVG file.");
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        alert("File too large. Maximum 50MB.");
        return;
      }

      setIsUploading(true);
      setUploadError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("layerType", selectedLayer);

        const res = await fetch(withBasePath("/api/admin/upload-svg"), {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          setUploadError(data.error ?? "Upload failed");
          return;
        }

        utils.geo.getSvgUploadHistory.invalidate();
        setProcessingUpload({ id: data.id, fileName: data.fileName });
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [selectedLayer, utils]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [handleFile]
  );

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Layer selector + upload zone */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Layer selector */}
        <div className="space-y-3">
          <label className="text-foreground text-sm font-medium">Target Layer</label>
          <Select value={selectedLayer} onValueChange={(v) => setSelectedLayer(v as LayerType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LAYER_TYPES.map((lt) => (
                <SelectItem key={lt.value} value={lt.value}>
                  {lt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="border-border bg-muted text-muted-foreground rounded-lg border p-3 text-xs">
            <p className="text-foreground font-medium">Upload an Inkscape SVG</p>
            <p className="mt-1">
              The SVG should contain a layer group matching the selected type. Features are
              extracted from <code>&lt;path&gt;</code> elements within the layer.
            </p>
          </div>
        </div>

        {/* Right: Upload zone */}
        <div className="lg:col-span-2">
          <div
            className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
              isDragging
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-border hover:border-blue-400"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".svg"
              className="hidden"
              onChange={handleFileInput}
            />

            {isUploading ? (
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="text-foreground/80 text-sm">Uploading...</span>
              </div>
            ) : (
              <>
                <FileUp
                  className={`h-10 w-10 ${isDragging ? "text-blue-500" : "text-muted-foreground"}`}
                />
                <p className="text-foreground/80 mt-3 text-sm font-medium">
                  Drop SVG file here or click to browse
                </p>
                <p className="text-muted-foreground mt-1 text-xs">Max 50MB</p>
              </>
            )}
          </div>

          {uploadError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              <AlertCircle className="mb-1 inline h-4 w-4" /> {uploadError}
            </div>
          )}
        </div>
      </div>

      {/* Upload history */}
      <div>
        <h3 className="text-foreground mb-3 text-sm font-medium">
          Upload History — {LAYER_TYPES.find((l) => l.value === selectedLayer)?.label}
        </h3>

        {historyLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !history || history.length === 0 ? (
          <div className="border-border bg-muted text-muted-foreground rounded-lg border p-8 text-center text-sm">
            No uploads yet for this layer type.
          </div>
        ) : (
          <div className="border-border overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-foreground/80 px-4 py-2.5 text-left font-medium">File</th>
                  <th className="text-foreground/80 px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="text-foreground/80 px-4 py-2.5 text-left font-medium">Features</th>
                  <th className="text-foreground/80 px-4 py-2.5 text-left font-medium">Date</th>
                  <th className="text-foreground/80 px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-border/50 divide-y">
                {history.map((upload) => {
                  const statusCfg = STATUS_CONFIG[upload.status] ?? STATUS_CONFIG.pending!;
                  const StatusIcon = statusCfg.icon;

                  return (
                    <tr
                      key={upload.id}
                      className={`${upload.isActive ? "bg-emerald-50/50 dark:bg-emerald-900/10" : ""}`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{upload.fileName}</span>
                          <span className="text-muted-foreground text-xs">
                            {formatBytes(upload.fileSizeBytes)}
                          </span>
                          {upload.isActive && (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                              Active
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className={`flex items-center gap-1.5 ${statusCfg.color}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">{statusCfg.label}</span>
                        </div>
                        {upload.errorMessage && (
                          <p className="mt-0.5 max-w-[200px] truncate text-xs text-red-500">
                            {upload.errorMessage}
                          </p>
                        )}
                      </td>
                      <td className="text-foreground/80 px-4 py-2.5">
                        {upload.featureCount ?? "—"}
                      </td>
                      <td className="text-muted-foreground px-4 py-2.5 text-xs">
                        {formatDate(upload.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          {(upload.status === "pending" ||
                            upload.status === "processed" ||
                            upload.status === "failed") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setProcessingUpload({
                                  id: upload.id,
                                  fileName: upload.fileName,
                                })
                              }
                            >
                              <Upload className="mr-1 h-3 w-3" />
                              {upload.status === "pending" ? "Process" : "Reprocess"}
                            </Button>
                          )}
                          {upload.status === "processed" && !upload.isActive && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => rollbackMutation.mutate({ uploadId: upload.id })}
                              disabled={rollbackMutation.isPending}
                            >
                              <RotateCcw className="mr-1 h-3 w-3" />
                              Restore
                            </Button>
                          )}
                          {!upload.isActive && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => deleteMutation.mutate({ uploadId: upload.id })}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Processing dialog */}
      {processingUpload && (
        <SvgProcessingDialog
          uploadId={processingUpload.id}
          layerType={selectedLayer}
          fileName={processingUpload.fileName}
          onClose={() => setProcessingUpload(null)}
          onCommitted={() => {
            setProcessingUpload(null);
            utils.geo.getSvgUploadHistory.invalidate();
            utils.geo.getMapStats.invalidate();
          }}
        />
      )}
    </div>
  );
}
