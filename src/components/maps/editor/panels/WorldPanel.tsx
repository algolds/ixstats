"use client";

import { useEffect, useMemo } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { Button } from "~/components/ui/button";
import { useRealmMapDisplay } from "~/components/maps/core/hooks/useRealmMapDisplay";
import { transientMapStore } from "~/components/maps/editor/utils/transientStore";
import { useMapRealm } from "~/components/maps/core/MapRealmContext";
import { useDecodedMapLayers, useRetryMapLayers } from "~/hooks/useMapLayerData";
import { useWorldGenerator } from "~/hooks/useWorldGenerator";
import { useWorldPreview } from "~/hooks/useWorldPreview";
import { api } from "~/trpc/react";
import { controlAvailability } from "~/lib/worldgen/world-controls";
import {
  MASK_LAYER_TYPES,
  hasRealmBorders,
  landMaskLayersFrom,
} from "~/lib/worldgen/realm-land-mask";
import { createWorldWorker } from "~/lib/worldgen/worker/create-world-worker";
import type { WorldWorkerFactory } from "~/lib/worldgen/worker/world-messages";
import { useWorldRecipe } from "../hooks/useWorldRecipe";
import { WorldAdvancedSection } from "./WorldAdvancedSection";
import { WorldApplyRegion, type WorldLock } from "./WorldApplyRegion";
import { WorldBasicControls } from "./WorldBasicControls";
import { WorldLockUnknownNotice, WorldLockedNotice } from "./WorldLockedNotice";
import { WorldSourceSection, type RealmMapState } from "./WorldSourceSection";
import { WorldProgress, WorldStats } from "./WorldStatsSection";

interface WorldPanelProps {
  /** The map the draft is drawn on; null until it is up */
  map: MapLibreMap | null;
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

interface MapLoad {
  ready: boolean;
  pending: boolean;
  /** A layer (or the map's version) could not be loaded */
  failed: boolean;
}

function realmMapState(hasRealmMap: boolean, { ready, pending, failed }: MapLoad): RealmMapState {
  if (!hasRealmMap) return "none";
  if (ready) return "ready";
  // A failed version read leaves the layers pending for good, so a failure outranks pending
  if (failed) return "failed";
  return pending ? "loading" : "failed";
}

function RealmWorldPanel({
  display,
  map,
  createWorker = createWorldWorker,
}: WorldPanelProps & { display: Display }) {
  const generator = useWorldGenerator(createWorker);
  const { active } = useWorldPreview(map, generator.result);

  // The editor's own layer queries (same keys, so nothing downloads twice), read for the layers a world is fitted
  // to. "Ready" is every one of them settled, so a map that is still arriving is never fitted half-loaded.
  const realm = useMapRealm();
  const loaded = useDecodedMapLayers({ layers: MASK_LAYER_TYPES, realm });
  const realmMapLayers = useMemo(() => landMaskLayersFrom(loaded.layers), [loaded.layers]);
  const hasRealmMap = display.layerTypes.includes("political");
  const mapFailed = !!loaded.error;
  // A layer that failed is not settled: left out of the mask, the fit would run on a map with its land missing
  const realmMapReady = !loaded.isPending && !mapFailed && hasRealmBorders(realmMapLayers);
  const retryMap = useRetryMapLayers();
  const recipe = useWorldRecipe({
    scope: display.realmId,
    hasRealmMap,
    realmMapReady,
    realmMapLayers,
    realmMapVersion: loaded.version,
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

  const statusQuery = api.realms.map.worldStatus.useQuery(
    { realm: display.realmSlug ?? "" },
    { enabled: !!display.realmSlug, retry: false, staleTime: 15_000 }
  );
  const status = statusQuery.data;
  const lock: WorldLock = statusQuery.isError
    ? {
        phase: "failed",
        message: statusQuery.error?.message ?? "The realm's claims could not be read",
        retry: () => void statusQuery.refetch(),
      }
    : status
      ? { phase: "ready", status }
      : { phase: "loading" };
  const available = controlAvailability(controls.source);
  const hasWorld = generator.result !== null;

  return (
    <div className="text-footnote flex flex-col gap-4 p-3">
      {status?.lockReason && (
        <WorldLockedNotice
          lockReason={status.lockReason}
          pendingClaims={status.pendingClaims}
          approvedClaims={status.approvedClaims}
          canReviewClaims={status.canReviewClaims}
          realmSlug={display.realmSlug}
        />
      )}
      {lock.phase === "failed" && <WorldLockUnknownNotice />}

      <WorldSourceSection
        controls={controls}
        seed={recipe.seed}
        realmMap={realmMapState(hasRealmMap, {
          ready: realmMapReady,
          pending: loaded.isPending,
          failed: mapFailed,
        })}
        realmSlug={display.realmSlug}
        onRetryMap={retryMap}
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

      <WorldApplyRegion
        realm={{ id: display.realmId, slug: display.realmSlug }}
        result={generator.result}
        source={controls.source}
        generating={generating}
        stale={recipe.stale || generator.state === "error"}
        mapVersion={loaded.version}
        lock={lock}
        onDiscardDraft={recipe.discard}
      />
    </div>
  );
}
