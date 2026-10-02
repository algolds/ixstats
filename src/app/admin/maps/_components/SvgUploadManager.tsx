"use client";
import { useState, useRef, useCallback } from "react";
import { api } from "~/trpc/react";
import { notifyFromStore } from "~/hooks/useNotify";
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
  Upload as FileUp,
  SystemRestart as Loader2,
  Undo as RotateCcw,
  Trash as Trash2,
  CheckCircle as CheckCircle2,
  XmarkCircle as XCircle,
  Clock,
  WarningCircle as AlertCircle,
  Settings as Cog,
} from "iconoir-react";
import { SvgProcessingDialog } from "./SvgProcessingDialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import { Card } from "~/components/ui/card";

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

const STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-yellow", label: "Pending" },
  processing: { icon: Cog, color: "text-blue", label: "Processing" },
  processed: { icon: CheckCircle2, color: "text-green", label: "Processed" },
  failed: { icon: XCircle, color: "text-red", label: "Failed" },
  rolled_back: { icon: RotateCcw, color: "text-label-secondary", label: "Rolled Back" },
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

  const { data: history, isLoading: historyLoading } = api.geoAdmin.getSvgUploadHistory.useQuery(
    { layerType: selectedLayer },
    { refetchInterval: 10000 }
  );

  const [uploadError, setUploadError] = useState<string | null>(null);

  const rollbackMutation = api.geoAdmin.rollbackSvgUpload.useMutation({
    onSuccess: () => {
      utils.geoAdmin.getSvgUploadHistory.invalidate();
      utils.geoCore.getMapStats.invalidate();
    },
  });

  const deleteMutation = api.geoAdmin.deleteSvgUpload.useMutation({
    onSuccess: () => utils.geoAdmin.getSvgUploadHistory.invalidate(),
  });

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".svg")) {
        notifyFromStore({
          title: "Please upload an SVG file",
          type: "warning",
          priority: "medium",
        });
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        notifyFromStore({
          title: "File too large",
          message: "Maximum 50 MB.",
          type: "warning",
          priority: "medium",
        });
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

        utils.geoAdmin.getSvgUploadHistory.invalidate();
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
          <label className="text-label text-body font-medium">Target Layer</label>
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

          <Card className="text-label-secondary rounded-control text-footnote p-3">
            <p className="text-label font-medium">Upload an Inkscape SVG</p>
            <p className="mt-1">
              The SVG should contain a layer group matching the selected type. Features are
              extracted from <code>&lt;path&gt;</code> elements within the layer.
            </p>
          </Card>
        </div>

        {/* Right: Upload zone */}
        <div className="lg:col-span-2">
          <div
            className={`rounded-row flex min-h-[160px] cursor-pointer flex-col items-center justify-center border-2 border-dashed transition-colors ${
              isDragging ? "border-blue" : "border-separator hover:border-blue"
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
                <Loader2 className="text-blue h-6 w-6 animate-spin" />
                <span className="text-label text-body">Uploading...</span>
              </div>
            ) : (
              <>
                <FileUp
                  className={`h-10 w-10 ${isDragging ? "text-blue" : "text-label-secondary"}`}
                />
                <p className="text-label text-body mt-3 font-medium">
                  Drop SVG file here or click to browse
                </p>
                <p className="text-label-secondary text-footnote mt-1">Max 50MB</p>
              </>
            )}
          </div>

          {uploadError && (
            <div className="border-destructive/30 rounded-control text-body text-red mt-3 border p-3">
              <AlertCircle className="mb-1 inline h-4 w-4" /> {uploadError}
            </div>
          )}
        </div>
      </div>

      {/* Upload history */}
      <div>
        <h3 className="text-label text-body mb-3 font-medium">
          Upload History — {LAYER_TYPES.find((l) => l.value === selectedLayer)?.label}
        </h3>

        {historyLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !history || history.length === 0 ? (
          <Card className="text-label-secondary rounded-control text-body p-8 text-center">
            No uploads yet for this layer type.
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-label px-4">File</TableHead>
                <TableHead className="text-label px-4">Status</TableHead>
                <TableHead className="text-label px-4">Features</TableHead>
                <TableHead className="text-label px-4">Date</TableHead>
                <TableHead className="text-label px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((upload) => {
                const statusCfg = STATUS_CONFIG[upload.status] ?? STATUS_CONFIG.pending!;
                const StatusIcon = statusCfg.icon;

                return (
                  <TableRow key={upload.id} className={`${upload.isActive ? "" : ""}`}>
                    <TableCell className="px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{upload.fileName}</span>
                        <span className="text-label-secondary text-footnote">
                          {formatBytes(upload.fileSizeBytes)}
                        </span>
                        {upload.isActive && <Badge variant="green">Active</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="px-4">
                      <div className={`flex items-center gap-2 ${statusCfg.color}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        <span className="text-caption">{statusCfg.label}</span>
                      </div>
                      {upload.errorMessage && (
                        <p className="text-footnote text-red mt-0.5 max-w-[200px] truncate">
                          {upload.errorMessage}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-label px-4">{upload.featureCount ?? "—"}</TableCell>
                    <TableCell className="text-label-secondary text-footnote px-4">
                      {formatDate(upload.createdAt)}
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="flex justify-end gap-2">
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
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate({ uploadId: upload.id })}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
            utils.geoAdmin.getSvgUploadHistory.invalidate();
            utils.geoCore.getMapStats.invalidate();
          }}
        />
      )}
    </div>
  );
}
