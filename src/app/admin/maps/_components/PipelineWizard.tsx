"use client";

/**
 * PipelineWizard - Unified import pipeline with two modes:
 *
 * 1. Quick Update (default): Drop SVG → auto-detect layer → diff → one-click apply
 * 2. Full Pipeline: Multi-step wizard for SVG/PNG with coordinate calibration
 *
 * The Quick Update mode preserves existing featureId→countryId linkages automatically.
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
import { Upload, Upload as FileUp, MediaImage as FileImage, Globe, Eye, Database, SystemRestart as Loader2, CheckCircle, CheckCircle as CheckCircle2, WarningTriangle as AlertTriangle, Plus, Minus, EditPencil as Pencil, Minus as Equal, Link as Link2, Undo as RotateCcw, NavArrowDown as ChevronDown, NavArrowRight as ChevronRight, Flash as Zap, Settings as Settings2 } from "iconoir-react";

// ─── Quick Update Types & Helpers ───────────────────────────────────────────

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

type QuickStage = "select" | "processing" | "review" | "committing" | "done";

// ─── Main Component ─────────────────────────────────────────────────────────

export function PipelineWizard() {
  const [mode, setMode] = useState<"quick" | "full">("quick");

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMode("quick")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === "quick"
              ? "border border-blue-500/30 bg-blue-500/20 text-blue-400"
              : "text-muted-foreground hover:text-foreground border border-transparent"
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          Quick Update
        </button>
        <button
          onClick={() => setMode("full")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === "full"
              ? "border border-blue-500/30 bg-blue-500/20 text-blue-400"
              : "text-muted-foreground hover:text-foreground border border-transparent"
          }`}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Full Pipeline
        </button>
      </div>

      {mode === "quick" ? <QuickUpdatePanel /> : <FullPipelinePanel />}
    </div>
  );
}

// ─── Quick Update Panel ─────────────────────────────────────────────────────

function QuickUpdatePanel() {
  const [stage, setStage] = useState<QuickStage>("select");
  const [selectedLayer, setSelectedLayer] = useState<LayerOption>("auto");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = api.useUtils();

  const processMutation = api.geoAdmin.processSvgUpload.useMutation();
  const commitMutation = api.geoAdmin.commitSvgUpload.useMutation();

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

      const layerType =
        selectedLayer === "auto" ? detectLayerFromFilename(file.name) : selectedLayer;
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
      await Promise.all([
        utils.geoCore.invalidate(),
        utils.geoFeatures.invalidate(),
        utils.geoEditor.invalidate(),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Commit failed");
      setStage("review");
    }
  }, [result, commitMutation, utils.geoCore, utils.geoFeatures, utils.geoEditor]);

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
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400/60 hover:text-red-400"
          >
            &times;
          </button>
        </div>
      )}

      {stage === "select" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-foreground text-sm font-medium">Layer:</label>
            <Select value={selectedLayer} onValueChange={(v) => setSelectedLayer(v as LayerOption)}>
              <SelectTrigger className="border-border bg-muted/50 w-48">
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

          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 transition-all ${
              isDragging
                ? "border-blue-400 bg-blue-500/10"
                : "border-border bg-muted/30 hover:border-border hover:bg-muted/50"
            }`}
          >
            <FileUp
              className={`h-10 w-10 ${isDragging ? "text-blue-400" : "text-muted-foreground"}`}
            />
            <div className="text-center">
              <p className="text-foreground text-sm font-medium">
                Drop SVG file here or click to browse
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
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

      {stage === "processing" && (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <p className="text-muted-foreground text-sm">
            Processing SVG... parsing, converting, computing diff
          </p>
        </div>
      )}

      {stage === "review" && result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-foreground text-lg font-semibold">{result.fileName}</h3>
              <p className="text-muted-foreground text-sm">
                Layer:{" "}
                <Badge variant="outline" className="ml-1">
                  {result.layerType}
                </Badge>
                {" · "}
                {result.featureCount} features parsed
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              className="border-border text-muted-foreground"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Start Over
            </Button>
          </div>

          {result.diff?.summary && (
            <div className="flex flex-wrap gap-3">
              <DiffBadge
                icon={Plus}
                label="Added"
                count={result.diff.summary.addedCount}
                color="emerald"
              />
              <DiffBadge
                icon={Pencil}
                label="Modified"
                count={result.diff.summary.modifiedCount}
                color="blue"
              />
              <DiffBadge
                icon={Minus}
                label="Removed"
                count={result.diff.summary.removedCount}
                color="red"
              />
              <DiffBadge
                icon={Equal}
                label="Unchanged"
                count={result.diff.summary.unchangedCount}
                color="slate"
              />
              <DiffBadge
                icon={Link2}
                label="Links Preserved"
                count={result.diff.summary.linkagesPreserved}
                color="amber"
              />
            </div>
          )}

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

          <button
            onClick={() => setDetailsExpanded(!detailsExpanded)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
          >
            {detailsExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Feature details
          </button>

          {detailsExpanded && result.diff && (
            <div className="border-border bg-muted/50 max-h-64 overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground sticky top-0 text-left text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Feature ID</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Country Link</th>
                  </tr>
                </thead>
                <tbody className="divide-border/50 divide-y">
                  {result.diff.added.map((f) => (
                    <DiffRow
                      key={f.featureId}
                      status="added"
                      featureId={f.featureId}
                      displayName={f.displayName}
                    />
                  ))}
                  {result.diff.modified.map((f) => (
                    <DiffRow
                      key={f.featureId}
                      status="modified"
                      featureId={f.featureId}
                      displayName={f.displayName}
                    />
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
                    const link = result.diff!.preservedLinkages.find(
                      (l) => l.featureId === f.featureId
                    );
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
                      <td
                        colSpan={4}
                        className="text-muted-foreground px-3 py-2 text-center text-xs"
                      >
                        ...and {result.diff.unchanged.length - 20} more unchanged features
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleCommit}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              <Upload className="mr-1.5 h-4 w-4" />
              Apply Update
            </Button>
            <Button
              variant="outline"
              onClick={reset}
              className="border-border text-muted-foreground"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {stage === "committing" && (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <p className="text-muted-foreground text-sm">Applying update... writing to database</p>
        </div>
      )}

      {stage === "done" && result && (
        <div className="flex flex-col items-center gap-4 py-12">
          <CheckCircle2 className="h-12 w-12 text-emerald-400" />
          <div className="text-center">
            <h3 className="text-foreground text-lg font-semibold">Update Applied</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {result.featureCount} features committed to{" "}
              <Badge variant="outline">{result.layerType}</Badge> layer
            </p>
          </div>
          <Button variant="outline" onClick={reset} className="border-border text-foreground">
            Upload Another
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Full Pipeline Panel (legacy wizard) ────────────────────────────────────

function FullPipelinePanel() {
  type WizardStep = "upload" | "detection" | "preview" | "import" | "complete";

  const [step, setStep] = useState<WizardStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [_fileType, setFileType] = useState<"svg" | "png" | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [pipelineResult, setPipelineResult] = useState<{
    layers: Record<string, unknown>;
    metadata: { featureCounts: Record<string, number>; log: string[]; warnings: string[] };
    validation: { valid: boolean; errors: string[] };
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number } | null>(null);

  const runPipeline = api.geoEditor.runPipeline.useMutation();
  const importPipeline = api.geoEditor.importPipelineResult.useMutation();

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);

    if (selectedFile.name.endsWith(".svg")) {
      setFileType("svg");
      const text = await selectedFile.text();
      setSvgContent(text);
      setStep("detection");
    } else if (
      selectedFile.name.endsWith(".png") ||
      selectedFile.name.endsWith(".jpg") ||
      selectedFile.name.endsWith(".jpeg")
    ) {
      setFileType("png");
      setError(
        "PNG files must first be converted to SVG. Use the color extraction tool or convert externally."
      );
    } else {
      setError("Unsupported file type. Please upload an SVG or PNG file.");
    }
  }, []);

  const handleRunPipeline = useCallback(async () => {
    if (!svgContent) return;

    setIsProcessing(true);
    setError(null);

    try {
      const result = await runPipeline.mutateAsync({
        source: "svg",
        svgContent,
      });
      setPipelineResult(result);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pipeline failed");
    } finally {
      setIsProcessing(false);
    }
  }, [svgContent, runPipeline]);

  const handleImport = useCallback(async () => {
    if (!pipelineResult) return;

    setIsProcessing(true);
    setError(null);

    try {
      const result = await importPipeline.mutateAsync({
        layers: pipelineResult.layers as Record<string, unknown>,
        mode: "merge",
      });
      setImportResult(result);
      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsProcessing(false);
    }
  }, [pipelineResult, importPipeline]);

  const handleReset = useCallback(() => {
    setStep("upload");
    setFile(null);
    setFileType(null);
    setSvgContent(null);
    setPipelineResult(null);
    setImportResult(null);
    setError(null);
    setIsProcessing(false);
  }, []);

  const steps: Array<{ id: WizardStep; label: string; icon: typeof Upload }> = [
    { id: "upload", label: "Upload", icon: Upload },
    { id: "detection", label: "Detect", icon: FileImage },
    { id: "preview", label: "Preview", icon: Eye },
    { id: "import", label: "Import", icon: Database },
    { id: "complete", label: "Done", icon: CheckCircle },
  ];

  const currentIdx = steps.findIndex((s) => s.id === step);

  return (
    <div className="border-border bg-muted/30 rounded-xl border p-6">
      <h3 className="text-foreground mb-4 text-lg font-semibold">Full Pipeline Wizard</h3>
      <p className="text-muted-foreground mb-4 text-xs">
        Multi-step wizard for importing SVG/PNG maps with coordinate calibration. For single-layer
        updates, use Quick Update mode instead.
      </p>

      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                i < currentIdx
                  ? "bg-emerald-500/20 text-emerald-400"
                  : i === currentIdx
                    ? "bg-blue-500 text-white"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i < currentIdx ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <s.icon className="h-4 w-4" />
              )}
            </div>
            <span
              className={`text-xs ${
                i === currentIdx ? "text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && <div className="bg-muted mx-1 h-px w-6" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {step === "upload" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="border-border rounded-xl border-2 border-dashed p-8 text-center">
            <Upload className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
            <p className="text-foreground mb-2 text-sm font-medium">Drop your map file here</p>
            <p className="text-muted-foreground mb-4 text-xs">
              SVG files with Inkscape layers, or PNG maps with distinct country colors
            </p>
            <Button asChild>
              <label className="cursor-pointer">
                Choose File
                <input
                  type="file"
                  accept=".svg,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </Button>
          </div>
          {file && (
            <p className="text-muted-foreground text-sm">
              Selected: {file.name} ({(file.size / 1024).toFixed(0)} KB)
            </p>
          )}
        </div>
      )}

      {step === "detection" && (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            File loaded: <span className="text-foreground font-medium">{file?.name}</span>
          </p>
          <p className="text-muted-foreground text-sm">
            The pipeline will parse this SVG file, detect layers, convert coordinates, and enrich
            altitude features with elevation metadata.
          </p>
          <Button onClick={handleRunPipeline} disabled={isProcessing}>
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Globe className="h-4 w-4" />
            )}
            {isProcessing ? "Processing..." : "Run Pipeline"}
          </Button>
        </div>
      )}

      {step === "preview" && pipelineResult && (
        <div className="space-y-4">
          <div className="border-border bg-muted/50 rounded-lg border p-4">
            <h4 className="text-foreground mb-2 text-sm font-medium">Pipeline Results</h4>
            <div className="space-y-1">
              {Object.entries(pipelineResult.metadata.featureCounts).map(([layer, count]) => (
                <div key={layer} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{layer}</span>
                  <span className="text-foreground font-medium">{count} features</span>
                </div>
              ))}
            </div>
          </div>

          {pipelineResult.metadata.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="mb-1 text-xs font-medium text-amber-400">Warnings</p>
              {pipelineResult.metadata.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-400/80">
                  {w}
                </p>
              ))}
            </div>
          )}

          {!pipelineResult.validation.valid && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <p className="mb-1 text-xs font-medium text-red-400">Validation Errors</p>
              {pipelineResult.validation.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-400/80">
                  {e}
                </p>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={() => setStep("import")} disabled={!pipelineResult.validation.valid}>
              <Database className="h-4 w-4" />
              Proceed to Import
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Start Over
            </Button>
          </div>
        </div>
      )}

      {step === "import" && (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Ready to import{" "}
            {Object.values(pipelineResult?.metadata.featureCounts ?? {}).reduce((a, b) => a + b, 0)}{" "}
            features into the database. This will merge with existing map data.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleImport}
              disabled={isProcessing}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              {isProcessing ? "Importing..." : "Import to Database"}
            </Button>
            <Button variant="outline" onClick={() => setStep("preview")} disabled={isProcessing}>
              Back
            </Button>
          </div>
        </div>
      )}

      {step === "complete" && importResult && (
        <div className="space-y-4 py-4 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-emerald-400" />
          <p className="text-foreground text-lg font-medium">Import Complete</p>
          <p className="text-muted-foreground text-sm">
            {importResult.imported} features imported successfully. Shared vertex index has been
            rebuilt.
          </p>
          <Button onClick={handleReset}>Import Another Map</Button>
        </div>
      )}

      {pipelineResult && pipelineResult.metadata.log.length > 0 && (
        <details className="mt-4">
          <summary className="text-muted-foreground hover:text-muted-foreground cursor-pointer text-xs">
            Pipeline Log ({pipelineResult.metadata.log.length} entries)
          </summary>
          <pre className="border-border bg-card text-muted-foreground mt-2 max-h-40 overflow-auto rounded border p-2 text-[10px]">
            {pipelineResult.metadata.log.join("\n")}
          </pre>
        </details>
      )}
    </div>
  );
}

// ─── Shared Sub-Components ──────────────────────────────────────────────────

function DiffBadge({
  icon: Icon,
  label,
  count,
  color,
}: {
  icon: any;
  label: string;
  count: number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    red: "border-red-500/30 bg-red-500/10 text-red-400",
    slate: "border-border/30 bg-muted/30 text-muted-foreground",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  };

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${colorMap[color] ?? colorMap.slate}`}
    >
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
    unchanged: { color: "text-muted-foreground", bg: "bg-muted/30", label: "—" },
  };
  const cfg = statusConfig[status];

  return (
    <tr className="text-foreground">
      <td className="px-3 py-1.5">
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}
        >
          {cfg.label}
        </span>
      </td>
      <td className="text-muted-foreground px-3 py-1.5 font-mono text-xs">{featureId}</td>
      <td className="px-3 py-1.5 text-sm">{displayName}</td>
      <td className="px-3 py-1.5">
        {countryName ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-400">
            <Link2 className="h-3 w-3" />
            {countryName}
          </span>
        ) : (
          <span className="text-muted-foreground/70 text-xs">—</span>
        )}
      </td>
    </tr>
  );
}
