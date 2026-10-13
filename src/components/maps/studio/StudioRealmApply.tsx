"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { WorldApplyRegion, type WorldLock } from "~/components/maps/editor/panels/WorldApplyRegion";
import type { PhysicalLayer } from "~/lib/maps/import/options";
import type { WorldSource } from "~/lib/worldgen/world-controls";
import { api } from "~/trpc/react";
import { useStudio } from "./StudioContext";

interface StudioRealmApplyProps {
  /** The realm the world goes to */
  realm: { id: string; slug: string };
  source: WorldSource;
  /** The admin layer choice; undefined for the founder's flow */
  layers?: readonly PhysicalLayer[];
}

/**
 * The founder's apply flow (`WorldApplyRegion`, unchanged for founders) on a realm, with the Studio's world and the
 * lock from `atlas.studio.applyStatus`, which is open to Ixnay and to a layer choice.
 */
export function StudioRealmApply({ realm, source, layers }: StudioRealmApplyProps) {
  const { generator, stale, fit } = useStudio();
  const utils = api.useUtils();
  const status = api.atlas.studio.applyStatus.useQuery(
    { realm: realm.id, layers: layers !== undefined },
    // A layer choice changes the question (claims lock a plain apply, not a choice): keep the last answer meanwhile
    { retry: false, staleTime: 15_000, placeholderData: keepPreviousData }
  );
  const lock: WorldLock = status.isError
    ? {
        phase: "failed",
        message: status.error.message,
        retry: () => void status.refetch(),
      }
    : status.data
      ? { phase: "ready", status: status.data }
      : { phase: "loading" };

  return (
    <WorldApplyRegion
      realm={realm}
      result={generator.result}
      source={source}
      generating={generator.state === "generating"}
      stale={stale}
      mapVersion={source === "realm-map" ? fit.mapVersion : undefined}
      lock={lock}
      layers={layers}
      // The world stays in the Studio, which is not a draft of that realm; what changed is the realm's status and map
      onDiscardDraft={() => {
        void utils.atlas.studio.applyStatus.invalidate();
        void utils.atlas.realms.overview.invalidate();
      }}
    />
  );
}
