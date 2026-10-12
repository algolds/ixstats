"use client";

import { useEffect, useMemo } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { Button } from "~/components/ui/button";
import { useRealmMapDisplay } from "~/components/maps/core/hooks/useRealmMapDisplay";
import { transientMapStore } from "~/components/maps/editor/utils/transientStore";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import { useWorldGenerator } from "~/hooks/useWorldGenerator";
import { useWorldPreview } from "~/hooks/useWorldPreview";
import { api } from "~/trpc/react";
import { controlAvailability } from "~/lib/worldgen/world-controls";
import { hasRealmBorders, landMaskLayersFrom } from "~/lib/worldgen/realm-land-mask";
import { createWorldWorker } from "~/lib/worldgen/worker/create-world-worker";
import type { WorldWorkerFactory } from "~/lib/worldgen/worker/world-messages";
import { useWorldRecipe } from "../hooks/useWorldRecipe";
import { WorldAdvancedSection } from "./WorldAdvancedSection";
import { WorldApplyRegion } from "./WorldApplyRegion";
import { WorldBasicControls } from "./WorldBasicControls";
import { WorldCalibration } from "./WorldCalibration";
import { WorldLockedNotice } from "./WorldLockedNotice";
import { WorldSourceSection, type RealmMapState } from "./WorldSourceSection";
import { WorldProgress, WorldStats } from "./WorldStatsSection";

interface WorldPanelProps {
  /** The map the draft is drawn on; null until it is up */
  map: MapLibreMap | null;
  /** The layers the editor has loaded for this realm: what "This realm's map" is built around */
  mapLayers: readonly MapLayerData[];
  /** The admin studio: calibration instead of the apply region, and nothing of a realm is changed */
  sandbox?: boolean;
  /** Starts the generator's worker; tests pass a fake */
  createWorker?: WorldWorkerFactory;
}

type Display = NonNullable<ReturnType<typeof useRealmMapDisplay>>;

/**
 * The World tab of the world editor: generate a world for the realm, preview it on the map, and tune it. Keyed by
 * the realm, so one realm's draft is never previewed on another.
 */
export function WorldPanel(props: WorldPanelProps) {
  const display = useRealmMapDisplay();
  if (!display) {
    return <p className="text-label-secondary text-footnote p-3">Loading the realm.</p>;
  }
  return <RealmWorldPanel key={display.realmId} display={display} {...props} />;
}

function realmMapState(hasRealmMap: boolean, ready: boolean): RealmMapState {
  if (!hasRealmMap) return "none";
  return ready ? "ready" : "loading";
}

function RealmWorldPanel({
  display,
  map,
  mapLayers,
  sandbox = false,
  createWorker = createWorldWorker,
}: WorldPanelProps & { display: Display }) {
  const generator = useWorldGenerator(createWorker);
  const { active } = useWorldPreview(map, generator.result);

  const realmMapLayers = useMemo(() => landMaskLayersFrom(mapLayers), [mapLayers]);
  const hasRealmMap = display.layerTypes.includes("political");
  const realmMapReady = hasRealmBorders(realmMapLayers);
  const recipe = useWorldRecipe({
    scope: sandbox ? `sandbox:${display.realmId}` : display.realmId,
    hasRealmMap,
    realmMapReady,
    realmMapLayers,
    generator,
  });
  const { controls } = recipe;

  // The status bar shows "Draft" and the stage while a world is on the map or being made
  const generating = generator.state === "generating";
  const stage = generating ? generator.message : "";
  useEffect(() => {
    transientMapStore.setWorldDraft(active || generating ? { message: stage } : null);
  }, [active, generating, stage]);
  useEffect(() => () => transientMapStore.setWorldDraft(null), []);

  const { data: status } = api.realms.map.worldStatus.useQuery(
    { realm: display.realmSlug ?? "" },
    { enabled: !sandbox && !!display.realmSlug, retry: false, staleTime: 15_000 }
  );
  const available = controlAvailability(controls.source);
  const hasWorld = generator.result !== null;

  return (
    <div className="text-footnote flex flex-col gap-4 p-3">
      {status?.lockReason && (
        <WorldLockedNotice
          lockReason={status.lockReason}
          pendingClaims={status.pendingClaims}
          approvedClaims={status.approvedClaims}
          realmSlug={display.realmSlug}
        />
      )}

      <WorldSourceSection
        controls={controls}
        seed={recipe.seed}
        realmMap={realmMapState(hasRealmMap, realmMapReady)}
        realmSlug={display.realmSlug}
        onPickSource={recipe.pickSource}
        onPickPreset={recipe.pickPreset}
        onCommitSeed={recipe.commitSeed}
        onReroll={recipe.reroll}
      />

      <WorldBasicControls
        controls={controls}
        available={available}
        onLive={recipe.setLive}
        onCommit={recipe.apply}
      />
      <WorldAdvancedSection
        controls={controls}
        available={available}
        onLive={recipe.setLive}
        onCommit={recipe.apply}
      />

      <WorldProgress view={generator} hasWorld={hasWorld} onGenerate={recipe.generateNow} />
      {generator.result && <WorldStats stats={generator.result.stats} />}

      {hasWorld && (
        <Button variant="ghost" size="sm" className="self-start" onClick={recipe.discard}>
          Discard draft
        </Button>
      )}

      {sandbox ? (
        <WorldCalibration result={generator.result} />
      ) : (
        <WorldApplyRegion
          realm={{ id: display.realmId, slug: display.realmSlug }}
          result={generator.result}
          source={controls.source}
          generating={generating}
          status={status}
          onDiscardDraft={recipe.discard}
        />
      )}
    </div>
  );
}
