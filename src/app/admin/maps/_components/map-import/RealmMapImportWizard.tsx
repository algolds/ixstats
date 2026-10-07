"use client";

/**
 * The realm map import wizard (PNG, JPEG, SVG or GeoJSON): upload → georeference and engine settings → analysis
 * (a background job, polled) → regions to nations → dry run → apply (a background job) → done, with Roll back.
 * Site admins pick the realm; a founder or Map officer gets it fixed to their own realm. `initialJobId` resumes an
 * analysis started elsewhere ("Import this map" on the realm's wiki panel).
 */
import { useMemo, useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { StepIndicator } from "~/components/ui/step-indicator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { MapImportApplyInput, MapImportOptionsInput } from "~/lib/maps/import/options";
import type { RegionMappingPlan } from "~/lib/maps/import/mapping";
import { MAX_MAP_IMPORT_BYTES } from "~/lib/maps/import/options";
import type { CapitalHint } from "./GeorefPanel";
import { ImportHistory } from "./ImportHistory";
import { ImportJobProgress } from "./ImportJobProgress";
import { ImportReviewStep } from "./ImportReviewStep";
import { ImportSettings, uploadMapFile, type MapUploadInfo } from "./ImportSourceStep";
import { RegionNationMapper } from "./RegionNationMapper";
import { useMapImportJob } from "./useMapImportJob";

type Step = "upload" | "settings" | "analyse" | "map" | "review" | "apply";
const STEPS: Array<{ id: Step; label: string }> = [
  { id: "upload", label: "Upload" },
  { id: "settings", label: "Settings" },
  { id: "analyse", label: "Analyse" },
  { id: "map", label: "Nations" },
  { id: "review", label: "Review" },
  { id: "apply", label: "Apply" },
];

interface WizardProps {
  /** Fixes the realm (the founder's Manage tab); site admins choose it otherwise. */
  realmId?: string;
  initialJobId?: string | null;
}

export function RealmMapImportWizard({ realmId: fixedRealmId, initialJobId = null }: WizardProps) {
  const notify = useNotify();
  const [chosenRealm, setChosenRealm] = useState("");
  const [step, setStep] = useState<Step>(initialJobId ? "analyse" : "upload");
  const [upload, setUpload] = useState<MapUploadInfo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyseJobId, setAnalyseJobId] = useState<string | null>(initialJobId);
  const [plan, setPlan] = useState<RegionMappingPlan | null>(null);
  const [applyJobId, setApplyJobId] = useState<string | null>(null);

  const analyseJob = useMapImportJob(analyseJobId).data;
  const applyJob = useMapImportJob(applyJobId).data;
  const realmId = fixedRealmId ?? analyseJob?.realmId ?? chosenRealm;
  const { data: realms } = api.realms.adminListRealms.useQuery(undefined, {
    enabled: !fixedRealmId,
  });
  const context = api.geoEditor.mapImport.context.useQuery(
    { realmId },
    { enabled: !!realmId, retry: false }
  );
  const hints = api.realms.wiki.infoboxHints.useQuery(
    { slug: context.data?.realm.slug ?? "" },
    {
      enabled: !!context.data?.realm.slug && step !== "upload",
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const start = api.geoEditor.mapImport.start.useMutation();
  const applyImport = api.geoEditor.mapImport.applyImport.useMutation();

  const capitals: CapitalHint[] = useMemo(
    () =>
      (hints.data?.nations ?? []).flatMap((n) =>
        n.capitalCoordinates
          ? [{ nation: n.title, capital: n.capital, coordinates: n.capitalCoordinates }]
          : []
      ),
    [hints.data]
  );
  const thumbs = useMemo(
    () =>
      Object.fromEntries(
        (hints.data?.nations ?? []).flatMap((n) =>
          n.locatorMap?.thumbUrl ? [[n.title, n.locatorMap.thumbUrl]] : []
        )
      ),
    [hints.data]
  );

  // The analysis moves the wizard on by itself once it has finished.
  const shownStep: Step = step === "analyse" && analyseJob?.status === "succeeded" ? "map" : step;
  const analysis = analyseJob?.result?.phase === "analyse" ? analyseJob.result : null;

  const reset = () => {
    setStep("upload");
    setUpload(null);
    setAnalyseJobId(null);
    setPlan(null);
    setApplyJobId(null);
  };

  const onFile = async (file: File) => {
    if (!realmId) return;
    setUploading(true);
    try {
      setUpload(await uploadMapFile(realmId, file));
      setStep("settings");
    } catch (error) {
      notify.error("Upload failed", error instanceof Error ? error.message : String(error));
    } finally {
      setUploading(false);
    }
  };

  const onAnalyse = async (options: MapImportOptionsInput) => {
    if (!upload) return;
    try {
      const { jobId } = await start.mutateAsync({
        realmId,
        uploadId: upload.uploadId,
        kind: upload.kind,
        filename: upload.filename,
        options,
      });
      setAnalyseJobId(jobId);
      setStep("analyse");
    } catch (error) {
      notify.error(
        "Could not start the analysis",
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const onApply = async (apply: MapImportApplyInput) => {
    if (!analyseJobId) return;
    try {
      const { jobId } = await applyImport.mutateAsync({ jobId: analyseJobId, apply });
      setApplyJobId(jobId);
      setStep("apply");
    } catch (error) {
      notify.error(
        "Could not apply the import",
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const currentIndex = STEPS.findIndex((s) => s.id === shownStep);
  return (
    <div className="flex flex-col gap-5">
      <StepIndicator steps={STEPS} current={currentIndex} aria-label="Map import steps" />

      {!fixedRealmId && shownStep === "upload" && (
        <div className="flex flex-wrap items-center gap-3">
          <Label>Realm</Label>
          <Select value={chosenRealm} onValueChange={setChosenRealm}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Choose the realm" />
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
      )}
      {context.error && <p className="text-destructive text-footnote">{context.error.message}</p>}

      {shownStep === "upload" && (
        <div className="border-separator rounded-row flex flex-col items-center gap-3 border-2 border-dashed p-8 text-center">
          <p className="text-label text-body font-medium">
            A political map of {context.data?.realm.name ?? "the realm"}
          </p>
          <p className="text-label-secondary text-footnote max-w-xl">
            A flat-colour PNG or JPEG (one or more colours per nation, up to 64 megapixels), an SVG
            with one shape or group per nation, or a GeoJSON FeatureCollection. Up to{" "}
            {MAX_MAP_IMPORT_BYTES / 1024 / 1024} MB.
          </p>
          <Button asChild disabled={!realmId || uploading}>
            <label className={realmId ? "cursor-pointer" : "cursor-not-allowed"}>
              {uploading ? "Uploading…" : "Choose a file"}
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.svg,.geojson,.json"
                className="hidden"
                disabled={!realmId || uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onFile(file);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
        </div>
      )}

      {shownStep === "settings" && upload && (
        <ImportSettings
          upload={upload}
          initialGeoref={{
            projection: context.data?.mapSettings.projection,
            bounds: context.data?.mapSettings.bounds,
            controlPoints: context.data?.mapSettings.controlPoints,
          }}
          capitals={capitals}
          busy={start.isPending}
          onAnalyse={(options) => void onAnalyse(options)}
          onReset={reset}
        />
      )}

      {shownStep === "analyse" && (
        <div className="flex flex-col gap-3">
          <ImportJobProgress job={analyseJob} />
          {analyseJob && ["failed", "cancelled"].includes(analyseJob.status) && (
            <div>
              <Button variant="outline" onClick={reset}>
                Start again
              </Button>
            </div>
          )}
        </div>
      )}

      {shownStep === "map" && analysis && context.data && (
        <div className="flex flex-col gap-3">
          <AnalysisReport analysis={analysis} />
          <RegionNationMapper
            key={analyseJobId}
            regions={analysis.regions}
            suggested={analysis.suggestedMapping}
            nations={context.data.nations}
            thumbs={thumbs}
            busy={false}
            onContinue={(next) => {
              setPlan(next);
              setStep("review");
            }}
          />
        </div>
      )}

      {shownStep === "review" && plan && analyseJobId && (
        <ImportReviewStep
          jobId={analyseJobId}
          mapping={plan.mapping}
          pixelSpace={analysis?.space === "pixel"}
          busy={applyImport.isPending}
          onBack={() => setStep("map")}
          onApply={(apply) => void onApply(apply)}
        />
      )}

      {shownStep === "apply" && (
        <div className="flex flex-col gap-3">
          <ImportJobProgress job={applyJob} />
          {applyJob?.status === "succeeded" && applyJob.result?.phase === "apply" && (
            <p className="text-label text-body">
              {applyJob.result.written} borders written
              {applyJob.result.deactivated ? `, ${applyJob.result.deactivated} retired` : ""}
              {applyJob.result.landAreasFilled.length
                ? `, land area filled for ${applyJob.result.landAreasFilled.length} nations`
                : ""}
              {applyJob.result.adjacencyPairs !== null
                ? `; ${applyJob.result.adjacencyPairs} neighbouring pairs`
                : ""}
              .
              {applyJob.result.rejected.length
                ? ` ${applyJob.result.rejected.length} borders were refused.`
                : ""}
            </p>
          )}
          {applyJob && !["queued", "running"].includes(applyJob.status) && (
            <div>
              <Button variant="outline" onClick={reset}>
                Import another map
              </Button>
            </div>
          )}
        </div>
      )}

      {realmId && context.data && (
        <ImportHistory realmId={realmId} imports={context.data.imports} />
      )}
    </div>
  );
}

type Analysis = Extract<
  NonNullable<NonNullable<ReturnType<typeof useMapImportJob>["data"]>["result"]>,
  { phase: "analyse" }
>;

function AnalysisReport({ analysis }: { analysis: Analysis }) {
  const { report } = analysis;
  return (
    <details className="text-footnote">
      <summary className="text-label-secondary cursor-pointer">
        {analysis.regions.length} regions found
        {report.mergedRegions ? `, ${report.mergedRegions.count} specks merged` : ""}
        {report.unmatchedColours?.length
          ? `, ${report.unmatchedColours.length} unmatched colours`
          : ""}
        {report.warnings.length ? `, ${report.warnings.length} warnings` : ""}
      </summary>
      <div className="mt-2 flex flex-col gap-1">
        {report.warnings.map((w) => (
          <p key={w} className="text-warning-ink">
            {w}
          </p>
        ))}
        {analysis.georef?.warnings.map((w) => (
          <p key={w} className="text-warning-ink">
            {w}
          </p>
        ))}
        {report.unmatchedColours && report.unmatchedColours.length > 0 && (
          <p className="text-label-secondary">
            Unmatched: {report.unmatchedColours.map((c) => `${c.hex} (${c.pixels} px)`).join(", ")}
          </p>
        )}
        <pre className="border-separator bg-surface text-label-secondary rounded-control-sm max-h-40 overflow-auto border p-2">
          {report.log.join("\n")}
        </pre>
      </div>
    </details>
  );
}
