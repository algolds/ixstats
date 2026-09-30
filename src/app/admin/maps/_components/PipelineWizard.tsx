"use client";

/**
 * PipelineWizard - Unified import pipeline with two modes:
 *
 * 1. Quick Update (default): Drop SVG → auto-detect layer → diff → one-click apply
 * 2. Full Pipeline: Multi-step wizard into a chosen realm — an SVG, or a flat-colour PNG/JPEG whose
 *    colours the admin maps to the realm's nations before vectorising (decisions 10–11)
 *
 * The Quick Update mode preserves existing featureId→countryId linkages automatically.
 */

import { FacetCard } from "~/components/ui/facet-container";
import { useState, useRef, useCallback, useMemo } from "react";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { useNotify } from "~/hooks/useNotify";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import {
  MAX_PNG_BYTES,
  MAX_PNG_MEGAPIXELS,
  nationNameOptions,
  rankColours,
  type RankedColour,
} from "~/lib/maps/png-realm-map";
import { ColourNationMapper } from "./ColourNationMapper";
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
  MediaImage as FileImage,
  Globe,
  Eye,
  Database,
  SystemRestart as Loader2,
  CheckCircle,
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
        <div className="border-destructive/30 text-destructive flex items-center gap-2 rounded-lg border px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive ml-auto"
            onClick={() => setError(null)}
          >
            &times;
          </Button>
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
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
              isDragging
                ? "bg-accent border-blue-500"
                : "border-border bg-muted/30 hover:border-border hover:bg-muted/50"
            }`}
          >
            <FileUp
              className={`h-10 w-10 ${isDragging ? "text-blue-500" : "text-muted-foreground"}`}
            />
            <div className="text-center">
              <p className="text-foreground text-sm font-medium">
                Drop SVG file here or click to browse
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Layer type will be auto-detected from filename. Quick Update changes IxWorld's map;
                use Full Pipeline to import another realm's.
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
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 px-4 py-3 text-amber-500">
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

          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setDetailsExpanded(!detailsExpanded)}
          >
            {detailsExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Feature details
          </Button>

          {detailsExpanded && result.diff && (
            <FacetCard surface="solid" className="max-h-64 overflow-y-auto rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground sticky top-0 text-left text-xs">
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
            </FacetCard>
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
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-muted-foreground text-sm">Applying update... writing to database</p>
        </div>
      )}

      {stage === "done" && result && (
        <div className="flex flex-col items-center gap-4 py-12">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
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

interface WizardPipelineResult {
  layers: Record<string, unknown>;
  metadata: { featureCounts: Record<string, number>; log: string[]; warnings: string[] };
  validation: { valid: boolean; errors: string[] };
}

const RASTER_MAP_FILE = /\.(png|jpe?g)$/i;
const MAX_PNG_MB = MAX_PNG_BYTES / 1024 / 1024;

/** The file's bytes as plain base64 (the data: URL prefix stripped), for runPipeline's pngBase64. */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

function FullPipelinePanel() {
  type WizardStep = "upload" | "detection" | "preview" | "import" | "complete";

  const [step, setStep] = useState<WizardStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [pngBase64, setPngBase64] = useState<string | null>(null);
  const [pipelineResult, setPipelineResult] = useState<WizardPipelineResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number } | null>(null);
  // Realm the layers are imported into; "" = the server default, IxWorld
  const [targetRealmId, setTargetRealmId] = useState("");

  const runPipeline = api.geoEditor.runPipeline.useMutation();
  const importPipeline = api.geoEditor.importPipelineResult.useMutation();
  const { data: realms } = api.realms.adminListRealms.useQuery();
  const targetRealm = realms?.find((r) => r.id === (targetRealmId || DEFAULT_REALM_ID));
  const realmName = targetRealm?.name ?? "IxWorld";

  const loadRasterMap = useCallback(async (selectedFile: File) => {
    if (selectedFile.size > MAX_PNG_BYTES) {
      setError(`PNG maps are limited to ${MAX_PNG_MB} MB.`);
      return;
    }
    try {
      setPngBase64(await readFileAsBase64(selectedFile));
      setStep("detection");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the file");
    }
  }, []);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      setFile(selectedFile);
      setError(null);

      if (selectedFile.name.endsWith(".svg")) {
        const text = await selectedFile.text();
        setSvgContent(text);
        setStep("detection");
      } else if (RASTER_MAP_FILE.test(selectedFile.name)) {
        await loadRasterMap(selectedFile);
      } else {
        setError("Unsupported file type. Please upload an SVG, PNG or JPEG file.");
      }
    },
    [loadRasterMap]
  );

  const handleVectorised = useCallback((result: WizardPipelineResult) => {
    setPipelineResult(result);
    setStep("preview");
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
        realmId: targetRealmId || undefined,
      });
      setImportResult(result);
      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsProcessing(false);
    }
  }, [pipelineResult, importPipeline, targetRealmId]);

  const handleReset = useCallback(() => {
    setStep("upload");
    setFile(null);
    setSvgContent(null);
    setPngBase64(null);
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
    <FacetCard className="rounded-xl p-6">
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
                  ? "bg-emerald-500/20 text-emerald-500"
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
        <div className="border-destructive/30 text-destructive mb-4 flex items-start gap-2 rounded-lg border p-3 text-sm">
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
              SVG files with Inkscape layers, or flat-colour PNG/JPEG political maps (one colour per
              nation, up to {MAX_PNG_MB} MB and {MAX_PNG_MEGAPIXELS} megapixels)
            </p>
            <div className="mb-4 flex items-center justify-center gap-3">
              <label className="text-foreground text-sm font-medium">Target realm:</label>
              <Select value={targetRealmId} onValueChange={setTargetRealmId}>
                <SelectTrigger className="border-border bg-muted/50 w-48">
                  <SelectValue placeholder="IxWorld (default)" />
                </SelectTrigger>
                <SelectContent>
                  {realms?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

      {step === "detection" && pngBase64 && (
        <PngColourStep
          pngBase64={pngBase64}
          realmSlug={targetRealm?.slug}
          realmName={realmName}
          onVectorised={handleVectorised}
          onError={setError}
        />
      )}

      {step === "detection" && svgContent && (
        <SvgDetectionStep fileName={file?.name} busy={isProcessing} onRun={handleRunPipeline} />
      )}

      {step === "preview" && pipelineResult && (
        <PreviewStep
          result={pipelineResult}
          onProceed={() => setStep("import")}
          onReset={handleReset}
        />
      )}

      {step === "import" && pipelineResult && (
        <ImportStep
          featureCounts={pipelineResult.metadata.featureCounts}
          realmName={realmName}
          busy={isProcessing}
          onImport={handleImport}
          onBack={() => setStep("preview")}
        />
      )}

      {step === "complete" && importResult && (
        <div className="space-y-4 py-4 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
          <p className="text-foreground text-lg font-medium">Import Complete</p>
          <p className="text-muted-foreground text-sm">
            {importResult.imported} features imported successfully. Shared vertex index has been
            rebuilt.
          </p>
          <Button onClick={handleReset}>Import Another Map</Button>
        </div>
      )}

      {pipelineResult && <PipelineLog log={pipelineResult.metadata.log} />}
    </FacetCard>
  );
}

// ─── Full Pipeline steps ────────────────────────────────────────────────────

function SvgDetectionStep({
  fileName,
  busy,
  onRun,
}: {
  fileName: string | undefined;
  busy: boolean;
  onRun: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        File loaded: <span className="text-foreground font-medium">{fileName}</span>
      </p>
      <p className="text-muted-foreground text-sm">
        The pipeline will parse this SVG file, detect layers, convert coordinates, and enrich
        altitude features with elevation metadata.
      </p>
      <Button onClick={onRun} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
        {busy ? "Processing..." : "Run Pipeline"}
      </Button>
    </div>
  );
}

function PreviewStep({
  result,
  onProceed,
  onReset,
}: {
  result: WizardPipelineResult;
  onProceed: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-4">
      <FacetCard surface="solid" className="rounded-lg p-4">
        <h4 className="text-foreground mb-2 text-sm font-medium">Pipeline Results</h4>
        <div className="space-y-1">
          {Object.entries(result.metadata.featureCounts).map(([layer, count]) => (
            <div key={layer} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{layer}</span>
              <span className="text-foreground font-medium">{count} features</span>
            </div>
          ))}
        </div>
      </FacetCard>

      {result.metadata.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 p-3">
          <p className="mb-1 text-xs font-medium text-amber-500">Warnings</p>
          {result.metadata.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-500/80">
              {w}
            </p>
          ))}
        </div>
      )}

      {!result.validation.valid && (
        <div className="border-destructive/30 rounded-lg border p-3">
          <p className="text-destructive mb-1 text-xs font-medium">Validation Errors</p>
          {result.validation.errors.map((e, i) => (
            <p key={i} className="text-destructive/80 text-xs">
              {e}
            </p>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={onProceed} disabled={!result.validation.valid}>
          <Database className="h-4 w-4" />
          Proceed to Import
        </Button>
        <Button variant="outline" onClick={onReset}>
          Start Over
        </Button>
      </div>
    </div>
  );
}

function PipelineLog({ log }: { log: string[] }) {
  if (log.length === 0) return null;
  return (
    <details className="mt-4">
      <summary className="text-muted-foreground hover:text-muted-foreground cursor-pointer text-xs">
        Pipeline Log ({log.length} entries)
      </summary>
      <pre className="border-border bg-card text-muted-foreground mt-2 max-h-40 overflow-auto rounded border p-2 text-xs">
        {log.join("\n")}
      </pre>
    </details>
  );
}

function ImportStep({
  featureCounts,
  realmName,
  busy,
  onImport,
  onBack,
}: {
  featureCounts: Record<string, number>;
  realmName: string;
  busy: boolean;
  onImport: () => void;
  onBack: () => void;
}) {
  const total = Object.values(featureCounts).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Ready to import {total} features into{" "}
        <span className="text-foreground font-medium">{realmName}</span>. This will merge with that
        realm&apos;s existing map data.
      </p>
      <div className="flex gap-2">
        <Button
          onClick={onImport}
          disabled={busy}
          className="bg-emerald-600 text-white hover:bg-emerald-500"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          {busy ? "Importing..." : "Import to Database"}
        </Button>
        <Button variant="outline" onClick={onBack} disabled={busy}>
          Back
        </Button>
      </div>
    </div>
  );
}

// ─── PNG colour → nation step ───────────────────────────────────────────────

interface PngColourStepProps {
  pngBase64: string;
  realmSlug: string | undefined;
  realmName: string;
  onVectorised: (result: WizardPipelineResult) => void;
  onError: (message: string | null) => void;
}

/**
 * First run: detect the PNG's colours only (no tracing — quick on a large map). The admin maps them to the target realm's nations; second run:
 * vectorise the mapped colours, each region named after its nation (unmapped colours are dropped).
 */
function PngColourStep({
  pngBase64,
  realmSlug,
  realmName,
  onVectorised,
  onError,
}: PngColourStepProps) {
  const notify = useNotify();
  const runPipeline = api.geoEditor.runPipeline.useMutation();
  const [colours, setColours] = useState<RankedColour[] | null>(null);
  const { data: realm, isLoading: namesLoading } = api.realms.getBySlug.useQuery(
    { slug: realmSlug ?? "" },
    { enabled: !!realmSlug }
  );
  const nationNames = useMemo(
    () => nationNameOptions(realm?.countries, realm?.nationPages),
    [realm]
  );

  const analyse = async () => {
    onError(null);
    try {
      const result = await runPipeline.mutateAsync({ source: "png", pngBase64 });
      const ranked = rankColours(result.detectedColors ?? []);
      if (ranked.length === 0) {
        onError("No colours were detected — upload a flat-colour political map.");
      }
      setColours(ranked);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Colour analysis failed");
    }
  };

  const vectorise = async (colorMapping: Record<string, string>, unmapped: number) => {
    onError(null);
    try {
      const result = await runPipeline.mutateAsync({
        source: "png",
        pngBase64,
        pngConfig: { colorMapping },
      });
      if (unmapped > 0) {
        notify.info("Unmapped colours dropped", `${unmapped} colour(s) were left out of the map.`);
      }
      onVectorised(result);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Vectorising failed");
    }
  };

  if (colours && colours.length > 0) {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          {colours.length} colours detected — nations of{" "}
          <span className="text-foreground font-medium">{realmName}</span>
        </p>
        <ColourNationMapper
          colours={colours}
          nationNames={nationNames}
          namesLoading={namesLoading}
          busy={runPipeline.isPending}
          onVectorise={vectorise}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        The pipeline first finds the map&apos;s colours; you then name each one after a nation of{" "}
        <span className="text-foreground font-medium">{realmName}</span> before it is vectorised.
      </p>
      <Button onClick={analyse} disabled={runPipeline.isPending}>
        {runPipeline.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileImage className="h-4 w-4" />
        )}
        {runPipeline.isPending ? "Analysing…" : "Analyse colours"}
      </Button>
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
    emerald: "border-emerald-500/30 text-emerald-500",
    blue: "border-blue-500/30 text-blue-500",
    red: "border-destructive/30 text-destructive",
    slate: "border-border text-muted-foreground",
    amber: "border-amber-500/30 text-amber-500",
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
    added: { className: "border-emerald-500/30 text-emerald-500", label: "New" },
    modified: { className: "border-blue-500/30 text-blue-500", label: "Modified" },
    removed: { className: "border-destructive/30 text-destructive", label: "Removed" },
    unchanged: { className: "text-muted-foreground", label: "—" },
  };
  const cfg = statusConfig[status];

  return (
    <tr className="text-foreground">
      <td className="px-3 py-1.5">
        <Badge variant="outline" className={cfg.className}>
          {cfg.label}
        </Badge>
      </td>
      <td className="text-muted-foreground px-3 py-1.5 font-mono text-xs">{featureId}</td>
      <td className="px-3 py-1.5 text-sm">{displayName}</td>
      <td className="px-3 py-1.5">
        {countryName ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-500">
            <Link2 className="h-3 w-3" />
            {countryName}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </td>
    </tr>
  );
}
