"use client";

/**
 * QuickLayerUpdate - Streamlined one-panel SVG layer update workflow.
 *
 * Flow: Drop SVG → auto-detect layer → process → see diff → one-click apply.
 * Preserves existing featureId→countryId linkages automatically.
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
import {
  Upload,
  FileUp,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Minus,
  Pencil,
  Equal,
  Link2,
  RotateCcw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const LAYER_TYPES = [
  { value: "auto", label: "Auto-detect" },
  { value: "political", label: "Political" },
  { value: "climate", label: "Climate" },
  { value: "altitudes", label: "Altitudes" },
  { value: "rivers", label: "Rivers" },
  { value: "lakes", label: "Lakes" },
  { value: "icecaps", label: "Icecaps" },
  { value: "background", label: "Background" },
] as const;

type LayerOption = (typeof LAYER_TYPES)[number]["value"];

// Client-side layer type detection from filename
const LAYER_KEYWORDS: Record<string, string[]> = {
  political: ["political", "countries", "borders", "nations", "sovereign"],
  altitudes: ["altitude", "altitudes", "elevation", "terrain", "height", "topo"],
  climate: ["climate", "biome", "vegetation", "temperature"],
  rivers: ["river", "rivers", "waterway", "stream"],
  lakes: ["lake", "lakes", "water", "sea", "ocean"],
  icecaps: ["ice", "icecap", "glacier", "snow", "polar", "arctic"],
  background: ["background", "base", "outline", "coastline", "land"],
};

function detectLayerFromFilename(fileName: string): string | null {
  const lower = fileName.toLowerCase().replace(/[_\-\.]/g, " ");
  for (const [layerType, keywords] of Object.entries(LAYER_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return layerType;
  }
  return null;
}

interface DiffSummary {
  addedCount: number;
  modifiedCount: number;
  removedCount: number;
  unchangedCount: number;
  linkagesPreserved: number;
  linkagesLost: number;
}

interface ProcessResult {
  uploadId: string;
  fileName: string;
  layerType: string;
  featureCount: number;
  diff?: {
    summary: DiffSummary;
    added: Array<{ featureId: string; displayName: string }>;
    modified: Array<{ featureId: string; displayName: string }>;
    removed: Array<{ featureId: string; displayName: string; countryName?: string }>;
    unchanged: Array<{ featureId: string; displayName: string }>;
    preservedLinkages: Array<{ featureId: string; countryId: string; countryName?: string }>;
  };
}

type Stage = "select" | "processing" | "review" | "committing" | "done";

export function QuickLayerUpdate() {
  const [stage, setStage] = useState<Stage>("select");
  const [selectedLayer, setSelectedLayer] = useState<LayerOption>("auto");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = api.useUtils();

  const processMutation = api.geo.processSvgUpload.useMutation();
  const commitMutation = api.geo.commitSvgUpload.useMutation();

  const reset = useCallback(() => {
    setStage("select");
    setError(null);
    setResult(null);
    setDetailsExpanded(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!file.name.endsWith(".svg")) {
        setError("File must be an SVG");
        return;
      }

      // Determine layer type
      const layerType = selectedLayer === "auto" ? detectLayerFromFilename(file.name) : selectedLayer;
      if (!layerType) {
        setError(`Could not detect layer type from "${file.name}". Please select a layer type manually.`);
        return;
      }

      setStage("processing");

      try {
        // Step 1: Upload the SVG file
        const formData = new FormData();
        formData.append("file", file);
        formData.append("layerType", layerType);

        const uploadRes = await fetch(withBasePath("/api/admin/upload-svg"), {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(err.error || `Upload failed (${uploadRes.status})`);
        }

        const uploadData = (await uploadRes.json()) as { id: string; layerType: string; fileName: string };

        // Step 2: Process the SVG (parse, convert, match, diff)
        const processResult = await processMutation.mutateAsync({
          uploadId: uploadData.id,
        });

        setResult({
          uploadId: uploadData.id,
          fileName: uploadData.fileName,
          layerType: uploadData.layerType,
          featureCount: processResult.featureCount,
          diff: processResult.diff as ProcessResult["diff"],
        });
        setStage("review");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Processing failed");
        setStage("select");
      }
    },
    [selectedLayer, processMutation]
  );

  const handleCommit = useCallback(async () => {
    if (!result) return;
    setStage("committing");
    setError(null);

    try {
      await commitMutation.mutateAsync({ uploadId: result.uploadId });
      setStage("done");
      // Invalidate all geo caches
      await utils.geo.invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Commit failed");
      setStage("review");
    }
  }, [result, commitMutation, utils.geo]);

  // Drag-and-drop handlers
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const onDragLeave = useCallback(() => setIsDragging(false), []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );
  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">
            &times;
          </button>
        </div>
      )}

      {/* Stage: Select & Upload */}
      {stage === "select" && (
        <div className="space-y-4">
          {/* Layer selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-foreground/80">Layer:</label>
            <Select value={selectedLayer} onValueChange={(v) => setSelectedLayer(v as LayerOption)}>
              <SelectTrigger className="w-48 border-border bg-muted">
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
          </div>

          {/* Drop zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 transition-all ${
              isDragging
                ? "border-blue-400 bg-blue-500/10"
                : "border-border bg-muted/50 hover:border-muted-foreground hover:bg-muted"
            }`}
          >
            <FileUp className={`h-10 w-10 ${isDragging ? "text-blue-400" : "text-muted-foreground"}`} />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground/80">
                Drop SVG file here or click to browse
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Layer type will be auto-detected from filename
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".svg"
              className="hidden"
              onChange={onFileChange}
            />
          </div>
        </div>
      )}

      {/* Stage: Processing */}
      {stage === "processing" && (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <p className="text-sm text-muted-foreground">Processing SVG... parsing, converting, computing diff</p>
        </div>
      )}

      {/* Stage: Review diff */}
      {stage === "review" && result && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{result.fileName}</h3>
              <p className="text-sm text-muted-foreground">
                Layer: <Badge variant="outline" className="ml-1">{result.layerType}</Badge>
                {" \u00B7 "}
                {result.featureCount} features parsed
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={reset} className="border-border text-muted-foreground">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Start Over
            </Button>
          </div>

          {/* Diff summary badges */}
          {result.diff?.summary && (
            <div className="flex flex-wrap gap-3">
              <DiffBadge icon={Plus} label="Added" count={result.diff.summary.addedCount} color="emerald" />
              <DiffBadge icon={Pencil} label="Modified" count={result.diff.summary.modifiedCount} color="blue" />
              <DiffBadge icon={Minus} label="Removed" count={result.diff.summary.removedCount} color="red" />
              <DiffBadge icon={Equal} label="Unchanged" count={result.diff.summary.unchangedCount} color="slate" />
              <DiffBadge icon={Link2} label="Links Preserved" count={result.diff.summary.linkagesPreserved} color="amber" />
            </div>
          )}

          {/* Warning for lost linkages */}
          {result.diff?.summary && result.diff.summary.linkagesLost > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="text-sm">
                {result.diff.summary.linkagesLost} feature(s) with country linkages will be removed.
                {result.diff.removed
                  .filter((r) => r.countryName)
                  .map((r) => ` ${r.displayName} (${r.countryName})`)
                  .join(",")}
              </span>
            </div>
          )}

          {/* Expandable feature details */}
          <button
            onClick={() => setDetailsExpanded(!detailsExpanded)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {detailsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Feature details
          </button>

          {detailsExpanded && result.diff && (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-muted/50">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Feature ID</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Country Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {result.diff.added.map((f) => (
                    <DiffRow key={f.featureId} status="added" featureId={f.featureId} displayName={f.displayName} />
                  ))}
                  {result.diff.modified.map((f) => (
                    <DiffRow key={f.featureId} status="modified" featureId={f.featureId} displayName={f.displayName} />
                  ))}
                  {result.diff.removed.map((f) => (
                    <DiffRow
                      key={f.featureId}
                      status="removed"
                      featureId={f.featureId}
                      displayName={f.displayName}
                      countryName={f.countryName}
                    />
                  ))}
                  {result.diff.unchanged.slice(0, 20).map((f) => {
                    const link = result.diff!.preservedLinkages.find((l) => l.featureId === f.featureId);
                    return (
                      <DiffRow
                        key={f.featureId}
                        status="unchanged"
                        featureId={f.featureId}
                        displayName={f.displayName}
                        countryName={link?.countryName}
                      />
                    );
                  })}
                  {result.diff.unchanged.length > 20 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-center text-xs text-muted-foreground">
                        ...and {result.diff.unchanged.length - 20} more unchanged features
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Apply button */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleCommit}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <Upload className="mr-1.5 h-4 w-4" />
              Apply Update
            </Button>
            <Button variant="outline" onClick={reset} className="border-border text-muted-foreground">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Stage: Committing */}
      {stage === "committing" && (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <p className="text-sm text-muted-foreground">Applying update... writing to database</p>
        </div>
      )}

      {/* Stage: Done */}
      {stage === "done" && result && (
        <div className="flex flex-col items-center gap-4 py-12">
          <CheckCircle2 className="h-12 w-12 text-emerald-400" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">Update Applied</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.featureCount} features committed to <Badge variant="outline">{result.layerType}</Badge> layer
            </p>
          </div>
          <Button variant="outline" onClick={reset} className="border-border text-foreground/80">
            Upload Another
          </Button>
        </div>
      )}
    </div>
  );
}

function DiffBadge({
  icon: Icon,
  label,
  count,
  color,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    red: "border-red-500/30 bg-red-500/10 text-red-400",
    slate: "border-border/50 bg-muted text-muted-foreground",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  };

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${colorMap[color] ?? colorMap.slate}`}>
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium">{count}</span>
      <span className="text-xs opacity-70">{label}</span>
    </div>
  );
}

function DiffRow({
  status,
  featureId,
  displayName,
  countryName,
}: {
  status: "added" | "modified" | "removed" | "unchanged";
  featureId: string;
  displayName: string;
  countryName?: string;
}) {
  const statusConfig = {
    added: { color: "text-emerald-400", bg: "bg-emerald-500/10", label: "NEW" },
    modified: { color: "text-blue-400", bg: "bg-blue-500/10", label: "MOD" },
    removed: { color: "text-red-400", bg: "bg-red-500/10", label: "DEL" },
    unchanged: { color: "text-muted-foreground", bg: "bg-muted", label: "\u2014" },
  };
  const cfg = statusConfig[status];

  return (
    <tr className="text-foreground">
      <td className="px-3 py-1.5">
        <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>
      </td>
      <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{featureId}</td>
      <td className="px-3 py-1.5 text-sm">{displayName}</td>
      <td className="px-3 py-1.5">
        {countryName ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-400">
            <Link2 className="h-3 w-3" />
            {countryName}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
        )}
      </td>
    </tr>
  );
}
