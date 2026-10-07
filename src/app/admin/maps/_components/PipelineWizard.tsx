"use client";

/**
 * PipelineWizard - Unified import pipeline with two modes:
 *
 * 1. Quick Update (default): Drop SVG → auto-detect layer → diff → one-click apply (IxWorld only)
 * 2. Full Pipeline: the realm map import (a flat-colour PNG/JPEG, an SVG of nations or GeoJSON, analysed in
 *    the background, mapped to the realm's nations, dry run, apply, roll back; map-import/), or the layered
 *    Inkscape SVG pipeline (LayeredSvgPipeline)
 *
 * The Quick Update mode preserves existing featureId→countryId linkages automatically.
 */

import { SegmentedControl } from "~/components/ui/segmented-control";
import { useState, useRef } from "react";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { LAYER_TYPES } from "./layer-types";
import { LayeredSvgPipeline } from "./LayeredSvgPipeline";
import { RealmMapImportWizard } from "./map-import/RealmMapImportWizard";
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
  Upload as FileUp,
  SystemRestart as Loader2,
  CheckCircle as CheckCircle2,
  WarningTriangle as AlertTriangle,
  Plus,
  Minus,
  EditPencil as Pencil,
  Minus as Equal,
  Link as Link2,
  Undo as RotateCcw,
  NavArrowDown as ChevronDown,
  NavArrowRight as ChevronRight,
  Flash as Zap,
  Settings as Settings2,
} from "iconoir-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import { Card } from "~/components/ui/card";

const QUICK_LAYER_OPTIONS = [{ value: "auto", label: "Auto-detect" }, ...LAYER_TYPES] as const;

type LayerOption = (typeof QUICK_LAYER_OPTIONS)[number]["value"];

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
  const lower = fileName.toLowerCase().replace(/[_\-.]/g, " ");
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

type QuickStage = "select" | "processing" | "review" | "committing" | "done";

export function PipelineWizard({ initialJobId = null }: { initialJobId?: string | null }) {
  const [mode, setMode] = useState<"quick" | "full">(initialJobId ? "full" : "quick");

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <SegmentedControl
        asTabs
        aria-label="Pipeline mode"
        value={mode}
        onValueChange={setMode}
        options={[
          { value: "quick", label: "Quick update", icon: <Zap /> },
          { value: "full", label: "Full pipeline", icon: <Settings2 /> },
        ]}
      />

      {mode === "quick" ? <QuickUpdatePanel /> : <FullPipelinePanel initialJobId={initialJobId} />}
    </div>
  );
}

/** Full pipeline: the realm map import (PNG, SVG, GeoJSON), or the layered Inkscape SVG pipeline. */
function FullPipelinePanel({ initialJobId }: { initialJobId: string | null }) {
  const [kind, setKind] = useState<"realm" | "layered">("realm");
  return (
    <div className="space-y-4">
      <SegmentedControl
        aria-label="Import kind"
        value={kind}
        onValueChange={setKind}
        options={[
          { value: "realm", label: "Realm map (PNG, SVG, GeoJSON)" },
          { value: "layered", label: "Layered SVG (all layers)" },
        ]}
      />
      {kind === "realm" ? (
        <Card className="rounded-row p-6">
          <RealmMapImportWizard initialJobId={initialJobId} />
        </Card>
      ) : (
        <LayeredSvgPipeline />
      )}
    </div>
  );
}

const DIFF_BADGES = [
  { key: "addedCount", icon: Plus, label: "Added", color: "emerald" },
  { key: "modifiedCount", icon: Pencil, label: "Modified", color: "blue" },
  { key: "removedCount", icon: Minus, label: "Removed", color: "red" },
  { key: "unchangedCount", icon: Equal, label: "Unchanged", color: "slate" },
  { key: "linkagesPreserved", icon: Link2, label: "Links preserved", color: "amber" },
] as const;

/** Unchanged features are listed only up to this many rows. */
const MAX_UNCHANGED_ROWS = 20;

function ErrorBanner({
  children,
  onDismiss,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div className="border-destructive/30 text-destructive rounded-control flex items-center gap-2 border px-4 py-3">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="text-body">{children}</span>
      <Button variant="ghost" size="sm" className="text-destructive ml-auto" onClick={onDismiss}>
        &times;
      </Button>
    </div>
  );
}

function BusyPanel({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16">
      <Loader2 className={`${color} h-8 w-8 animate-spin`} />
      <p className="text-label-secondary text-body">{children}</p>
    </div>
  );
}

/** Diff summary, linkage warning and per-feature table for a processed upload. */
function QuickUpdateReview({
  result,
  onCommit,
  onReset,
}: {
  result: ProcessResult;
  onCommit: () => void;
  onReset: () => void;
}) {
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const diff = result.diff;

  const rows = diff
    ? [
        ...diff.added.map((f) => ({ ...f, status: "added" as const, countryName: undefined })),
        ...diff.modified.map((f) => ({
          ...f,
          status: "modified" as const,
          countryName: undefined,
        })),
        ...diff.removed.map((f) => ({ ...f, status: "removed" as const })),
        ...diff.unchanged.slice(0, MAX_UNCHANGED_ROWS).map((f) => ({
          ...f,
          status: "unchanged" as const,
          countryName: diff.preservedLinkages.find((l) => l.featureId === f.featureId)?.countryName,
        })),
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-label text-title-3">{result.fileName}</h3>
          <p className="text-label-secondary text-body">
            Layer:{" "}
            <Badge variant="outline" className="ml-1">
              {result.layerType}
            </Badge>
            {" · "}
            {result.featureCount} features parsed
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="mr-2 h-3.5 w-3.5" /> Start over
        </Button>
      </div>

      {diff?.summary && (
        <div className="flex flex-wrap gap-3">
          {DIFF_BADGES.map(({ key, ...badge }) => (
            <DiffBadge key={key} count={diff.summary[key]} {...badge} />
          ))}
        </div>
      )}

      {diff?.summary && diff.summary.linkagesLost > 0 && (
        <div className="rounded-control border-yellow/30 text-yellow flex items-center gap-2 border px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-body">
            {diff.summary.linkagesLost} feature(s) with country linkages will be removed.
            {diff.removed
              .filter((r) => r.countryName)
              .map((r) => ` ${r.displayName} (${r.countryName})`)
              .join(",")}
          </span>
        </div>
      )}

      <Button variant="ghost" size="sm" onClick={() => setDetailsExpanded(!detailsExpanded)}>
        {detailsExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        Feature details
      </Button>

      {detailsExpanded && diff && (
        <Table containerClassName="max-h-64">
          <TableHeader sticky>
            <TableRow>
              {["Status", "Feature ID", "Name", "Country link"].map((heading) => (
                <TableHead key={heading} className="px-3">
                  {heading}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <DiffRow key={`${row.status}-${row.featureId}`} {...row} />
            ))}
            {diff.unchanged.length > MAX_UNCHANGED_ROWS && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-label-secondary text-footnote px-3 text-center"
                >
                  ...and {diff.unchanged.length - MAX_UNCHANGED_ROWS} more unchanged features
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <div className="flex gap-3 pt-2">
        <Button onClick={onCommit}>
          <Upload className="mr-2 h-4 w-4" />
          Apply update
        </Button>
        <Button variant="outline" onClick={onReset}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function QuickUpdatePanel() {
  const [stage, setStage] = useState<QuickStage>("select");
  const [selectedLayer, setSelectedLayer] = useState<LayerOption>("auto");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = api.useUtils();

  const processMutation = api.geoAdmin.processSvgUpload.useMutation();
  const commitMutation = api.geoAdmin.commitSvgUpload.useMutation();

  const reset = () => {
    setStage("select");
    setError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /** Upload the SVG, then process it into a diff against the current layer. */
  const handleFile = async (file: File) => {
    setError(null);

    if (!file.name.endsWith(".svg")) {
      setError("File must be an SVG");
      return;
    }

    const layerType = selectedLayer === "auto" ? detectLayerFromFilename(file.name) : selectedLayer;
    if (!layerType) {
      setError(
        `Could not detect layer type from "${file.name}". Please select a layer type manually.`
      );
      return;
    }

    setStage("processing");

    try {
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

      const uploadData = (await uploadRes.json()) as {
        id: string;
        layerType: string;
        fileName: string;
      };
      const processResult = await processMutation.mutateAsync({ uploadId: uploadData.id });

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
  };

  const handleCommit = async () => {
    if (!result) return;
    setStage("committing");
    setError(null);

    try {
      await commitMutation.mutateAsync({ uploadId: result.uploadId });
      setStage("done");
      await Promise.all([
        utils.geoCore.invalidate(),
        utils.geoFeatures.invalidate(),
        utils.geoEditor.invalidate(),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Commit failed");
      setStage("review");
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  return (
    <div className="space-y-4">
      {error && <ErrorBanner onDismiss={() => setError(null)}>{error}</ErrorBanner>}

      {stage === "select" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-label text-body font-medium">Layer:</label>
            <Select value={selectedLayer} onValueChange={(v) => setSelectedLayer(v as LayerOption)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUICK_LAYER_OPTIONS.map((lt) => (
                  <SelectItem key={lt.value} value={lt.value}>
                    {lt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-row flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-12 transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
              isDragging
                ? "bg-fill-3 border-blue"
                : "border-separator bg-fill-4 hover:border-separator hover:bg-fill-4"
            }`}
          >
            <FileUp className={`h-10 w-10 ${isDragging ? "text-blue" : "text-label-secondary"}`} />
            <div className="text-center">
              <p className="text-label text-body font-medium">
                Drop SVG file here or click to browse
              </p>
              <p className="text-label-secondary text-footnote mt-1">
                Layer type will be auto-detected from filename. Quick Update changes IxWorld's map;
                use Full Pipeline to import another realm's.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".svg"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </div>
        </div>
      )}

      {stage === "processing" && (
        <BusyPanel color="text-blue">
          Processing SVG... parsing, converting, computing diff
        </BusyPanel>
      )}

      {stage === "review" && result && (
        <QuickUpdateReview result={result} onCommit={handleCommit} onReset={reset} />
      )}

      {stage === "committing" && (
        <BusyPanel color="text-green">Applying update... writing to database</BusyPanel>
      )}

      {stage === "done" && result && (
        <div className="flex flex-col items-center gap-4 py-12">
          <CheckCircle2 className="text-green h-12 w-12" />
          <div className="text-center">
            <h3 className="text-label text-title-3">Update applied</h3>
            <p className="text-label-secondary text-body mt-1">
              {result.featureCount} features committed to{" "}
              <Badge variant="outline">{result.layerType}</Badge> layer
            </p>
          </div>
          <Button variant="outline" onClick={reset}>
            Upload another
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
  icon: typeof Plus;
  label: string;
  count: number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "border-green/30 text-green",
    blue: "border-blue/30 text-blue",
    red: "border-destructive/30 text-destructive",
    slate: "border-separator text-label-secondary",
    amber: "border-yellow/30 text-yellow",
  };

  return (
    <div
      className={`rounded-control flex items-center gap-2 border px-3 py-2 ${colorMap[color] ?? colorMap.slate}`}
    >
      <Icon className="h-4 w-4" />
      <span className="text-body font-medium">{count}</span>
      <span className="text-footnote opacity-70">{label}</span>
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
    added: { className: "border-green/30 text-green", label: "New" },
    modified: { className: "border-blue/30 text-blue", label: "Modified" },
    removed: { className: "border-destructive/30 text-destructive", label: "Removed" },
    unchanged: { className: "text-label-secondary", label: "—" },
  };
  const cfg = statusConfig[status];

  return (
    <TableRow className="text-label">
      <TableCell className="px-3 py-2">
        <Badge variant="outline" className={cfg.className}>
          {cfg.label}
        </Badge>
      </TableCell>
      <TableCell className="text-label-secondary text-footnote px-3 py-2 font-mono">
        {featureId}
      </TableCell>
      <TableCell className="text-body px-3 py-2">{displayName}</TableCell>
      <TableCell className="px-3 py-2">
        {countryName ? (
          <span className="text-footnote text-yellow inline-flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            {countryName}
          </span>
        ) : (
          <span className="text-label-secondary text-footnote">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}
