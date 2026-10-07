"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Upload,
  MediaImage as FileImage,
  Globe,
  Eye,
  Database,
  SystemRestart as Loader2,
  CheckCircle,
  WarningTriangle as AlertTriangle,
} from "iconoir-react";

interface WizardPipelineResult {
  layers: Record<string, unknown>;
  metadata: { featureCounts: Record<string, number>; log: string[]; warnings: string[] };
  validation: { valid: boolean; errors: string[] };
}

/**
 * The layered SVG pipeline: an Inkscape SVG with political, altitude and other layers, parsed with the SVG parser
 * and written layer by layer through importPipelineResult (the shared realm map writer). Flat-colour images,
 * single-layer SVGs and GeoJSON go through the realm map import instead.
 */
export function LayeredSvgPipeline() {
  type WizardStep = "upload" | "detection" | "preview" | "import" | "complete";

  const [step, setStep] = useState<WizardStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);

    if (selectedFile.name.endsWith(".svg")) {
      const text = await selectedFile.text();
      setSvgContent(text);
      setStep("detection");
    } else {
      setError("Upload an SVG file. Images and GeoJSON go through the realm map import.");
    }
  };

  const handleRunPipeline = async () => {
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
  };

  const handleImport = async () => {
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
  };

  const handleReset = () => {
    setStep("upload");
    setFile(null);
    setSvgContent(null);
    setPipelineResult(null);
    setImportResult(null);
    setError(null);
    setIsProcessing(false);
  };

  const steps: Array<{ id: WizardStep; label: string; icon: typeof Upload }> = [
    { id: "upload", label: "Upload", icon: Upload },
    { id: "detection", label: "Detect", icon: FileImage },
    { id: "preview", label: "Preview", icon: Eye },
    { id: "import", label: "Import", icon: Database },
    { id: "complete", label: "Done", icon: CheckCircle },
  ];

  const currentIdx = steps.findIndex((s) => s.id === step);

  return (
    <Card className="rounded-row p-6">
      <h3 className="text-label text-title-3 mb-4">Layered SVG pipeline</h3>
      <p className="text-label-secondary text-footnote mb-4">
        An Inkscape SVG with its political, altitude and other layers, imported into a realm. For a
        single layer of IxWorld use Quick Update; for a flat-colour image, an SVG of nations or
        GeoJSON use the realm map import.
      </p>

      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`text-caption flex h-8 w-8 items-center justify-center rounded-full ${
                i < currentIdx
                  ? "bg-green/20 text-green"
                  : i === currentIdx
                    ? "bg-blue text-on-blue"
                    : "bg-fill-3 text-label-secondary"
              }`}
            >
              {i < currentIdx ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <s.icon className="h-4 w-4" />
              )}
            </div>
            <span
              className={`text-footnote ${
                i === currentIdx ? "text-label font-medium" : "text-label-secondary"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && <div className="bg-fill-3 mx-1 h-px w-6" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="border-destructive/30 text-destructive rounded-control text-body mb-4 flex items-start gap-2 border p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {step === "upload" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="border-separator rounded-row border-2 border-dashed p-8 text-center">
            <Upload className="text-label-secondary mx-auto mb-3 h-10 w-10" />
            <p className="text-label text-body mb-2 font-medium">Drop your map file here</p>
            <p className="text-label-secondary text-footnote mb-4">
              An SVG file with Inkscape layers (political, altitudes)
            </p>
            <div className="mb-4 flex items-center justify-center gap-3">
              <label className="text-label text-body font-medium">Target realm:</label>
              <Select value={targetRealmId} onValueChange={setTargetRealmId}>
                <SelectTrigger className="w-48">
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
                Choose file
                <input type="file" accept=".svg" onChange={handleFileSelect} className="hidden" />
              </label>
            </Button>
          </div>
          {file && (
            <p className="text-label-secondary text-body">
              Selected: {file.name} ({(file.size / 1024).toFixed(0)} KB)
            </p>
          )}
        </div>
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
          <CheckCircle className="text-green mx-auto h-12 w-12" />
          <p className="text-label text-title-3">Import complete</p>
          <p className="text-label-secondary text-body">
            {importResult.imported} features imported successfully. Shared vertex index has been
            rebuilt; Roll back is in the realm map import&apos;s history.
          </p>
          <Button onClick={handleReset}>Import another map</Button>
        </div>
      )}

      {pipelineResult && <PipelineLog log={pipelineResult.metadata.log} />}
    </Card>
  );
}

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
      <p className="text-label-secondary text-body">
        File loaded: <span className="text-label font-medium">{fileName}</span>
      </p>
      <p className="text-label-secondary text-body">
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
      <Card className="rounded-control p-4">
        <h4 className="text-label text-body mb-2 font-medium">Pipeline results</h4>
        <div className="space-y-1">
          {Object.entries(result.metadata.featureCounts).map(([layer, count]) => (
            <div key={layer} className="text-body flex justify-between">
              <span className="text-label-secondary">{layer}</span>
              <span className="text-label font-medium">{count} features</span>
            </div>
          ))}
        </div>
      </Card>

      {result.metadata.warnings.length > 0 && (
        <div className="rounded-control border-yellow/30 border p-3">
          <p className="text-caption text-yellow mb-1">Warnings</p>
          {result.metadata.warnings.map((w, i) => (
            <p key={i} className="text-footnote text-yellow">
              {w}
            </p>
          ))}
        </div>
      )}

      {!result.validation.valid && (
        <div className="border-destructive/30 rounded-control border p-3">
          <p className="text-destructive text-caption mb-1">Validation errors</p>
          {result.validation.errors.map((e, i) => (
            <p key={i} className="text-destructive/80 text-footnote">
              {e}
            </p>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={onProceed} disabled={!result.validation.valid}>
          <Database className="h-4 w-4" />
          Proceed to import
        </Button>
        <Button variant="outline" onClick={onReset}>
          Start over
        </Button>
      </div>
    </div>
  );
}

function PipelineLog({ log }: { log: string[] }) {
  if (log.length === 0) return null;
  return (
    <details className="mt-4">
      <summary className="text-label-secondary hover:text-label-secondary text-footnote cursor-pointer">
        Pipeline Log ({log.length} entries)
      </summary>
      <pre className="border-separator bg-surface text-label-secondary rounded-control-sm text-footnote mt-2 max-h-40 overflow-auto border p-2">
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
      <p className="text-label-secondary text-body">
        Ready to import {total} features into{" "}
        <span className="text-label font-medium">{realmName}</span>. This will merge with that
        realm&apos;s existing map data.
      </p>
      <div className="flex gap-2">
        <Button onClick={onImport} disabled={busy}>
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
