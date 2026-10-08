"use client";

import { useCallback, useState } from "react";
import { Map as MapIcon } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Signal } from "~/components/ui/signal";
import { PipelineEditor } from "./PipelineEditor";
import { PresetLoader } from "./PresetLoader";
import { RunHistory } from "./RunHistory";
import { RunSection } from "./RunSection";
import { isRunActive } from "./run-status";
import { EMPTY_PIPELINE, stableJson } from "./pipeline-draft";

type PipelineView = RouterOutputs["realms"]["mapPipeline"]["get"];

function builtText(built: PipelineView["built"]): string {
  const layers = built.rasterLayers.map((l) => l.label);
  return [
    layers.length > 0
      ? `${layers.length} raster ${layers.length === 1 ? "layer" : "layers"} (${layers.join(", ")})`
      : "no raster layers",
    built.defaultView ? "a default view" : "no default view",
    built.hasClimateKey ? "its own climate key" : "IxWorld's climate key",
  ].join(", ");
}

function runBlocked(view: PipelineView, dirty: boolean, running: boolean): string | null {
  if (!view.pipeline) return "Save the pipeline first.";
  if (dirty) return "Save your changes first: a run uses the saved config.";
  if (running) return "A run is in progress.";
  return null;
}

function NoPipeline({
  view,
  onLoaded,
  onScratch,
}: {
  view: PipelineView;
  onLoaded: () => void;
  onScratch: () => void;
}) {
  return (
    <Card className="flex flex-col items-center gap-4 pb-6">
      <EmptyState
        compact
        icon={<MapIcon />}
        title="No map pipeline yet"
        message={`Load a community map's preset, or start from scratch and upload ${view.realm.name}'s art.`}
      />
      <PresetLoader
        slug={view.realm.slug}
        presets={view.presets}
        allowForce={false}
        dirty={false}
        onLoaded={onLoaded}
      />
      <Button variant="ghost" onClick={onScratch}>
        Start from scratch
      </Button>
    </Card>
  );
}

/**
 * A realm's map pipeline (docs/systems/realm-maps.md): its config (preset, art, raster and physical layers, climate
 * key, labels, flags, default view, smoothing), runs (dry run or apply, any steps) with live progress, and the run
 * history. In /admin/realms → Map (site admins) and the realm's Manage tab (founder and Map officers).
 */
export function MapPipelinePanel({
  slug,
  onDirtyChange,
}: {
  slug: string;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const utils = api.useUtils();
  const [scratch, setScratch] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const {
    data: view,
    isLoading,
    error,
  } = api.realms.mapPipeline.get.useQuery({ realm: slug }, { retry: false });
  const { data: runs } = api.realms.mapPipeline.runs.useQuery(
    { realm: slug, take: 20 },
    {
      retry: false,
      enabled: !!view,
      refetchInterval: (query) =>
        query.state.data?.some((run) => isRunActive(run.status)) ? 4000 : false,
    }
  );
  const refresh = useCallback(() => {
    void utils.realms.mapPipeline.get.invalidate({ realm: slug });
    void utils.realms.mapPipeline.runs.invalidate({ realm: slug });
  }, [utils, slug]);
  const reportDirty = useCallback(
    (next: boolean) => {
      setDirty(next);
      onDirtyChange?.(next);
    },
    [onDirtyChange]
  );

  if (isLoading) return <p className="text-label-secondary text-body">Loading the map pipeline…</p>;
  if (!view)
    return <p className="text-label-secondary text-body">{error?.message ?? "Not available."}</p>;

  const latest = runs?.[0];
  const running = isRunActive(latest?.status);
  const followed = jobId ?? (running && latest ? latest.id : null);
  const editing = !!view.pipeline || scratch;

  return (
    <div className="flex flex-col gap-6">
      {view.problem && (
        <Signal tone="destructive" title="The saved pipeline no longer reads">
          {view.problem}. Load a preset or start from scratch to replace it.
        </Signal>
      )}
      <p className="text-label-secondary text-footnote">Built now: {builtText(view.built)}.</p>
      {editing ? (
        <PipelineEditor
          key={stableJson(view.pipeline)}
          slug={slug}
          realmId={view.realm.id}
          saved={view.pipeline}
          initial={view.pipeline ?? EMPTY_PIPELINE}
          source={view.source}
          presets={view.presets}
          onSaved={refresh}
          onDirtyChange={reportDirty}
        />
      ) : (
        <NoPipeline view={view} onLoaded={refresh} onScratch={() => setScratch(true)} />
      )}
      {view.pipeline && (
        <RunSection
          slug={slug}
          steps={view.steps}
          blocked={runBlocked(view, dirty, running)}
          jobId={followed}
          onStarted={(id) => {
            setJobId(id);
            void utils.realms.mapPipeline.runs.invalidate({ realm: slug });
          }}
          onFinished={refresh}
        />
      )}
      {runs && runs.length > 0 && (
        <RunHistory runs={runs} selectedId={followed} onSelect={setJobId} />
      )}
    </div>
  );
}
