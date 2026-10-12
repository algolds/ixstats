"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Signal } from "~/components/ui/signal";
import { api } from "~/trpc/react";
import { describeWorldFailure, failureOf } from "~/lib/worldgen/world-apply";

type Rebuild =
  | { state: "idle" }
  | { state: "building" }
  | { state: "built" }
  | { state: "failed"; title: string; reason: string };

interface WorldReliefRebuildProps {
  realmId: string;
  /** The relief step of the realm's latest world import failed and has not been rebuilt */
  failed: boolean;
  /** What the relief step said when it failed, when this tab saw it happen */
  cause?: string | null;
}

/**
 * The world is applied but its relief (the shading of the land) was not built. Offers to build it again; the world
 * stays as it is. Once the relief is built the offer goes and a line says so.
 */
export function WorldReliefRebuild({ realmId, failed, cause }: WorldReliefRebuildProps) {
  const [rebuild, setRebuild] = useState<Rebuild>({ state: "idle" });
  // A relief that fails again after it was rebuilt is offered again, not shown as rebuilt
  const [wasFailed, setWasFailed] = useState(failed);
  if (failed !== wasFailed) {
    setWasFailed(failed);
    if (failed) setRebuild({ state: "idle" });
  }
  const utils = api.useUtils();
  const rebuildRelief = api.geoEditor.mapImport.rebuildRelief.useMutation();

  const run = async () => {
    setRebuild({ state: "building" });
    try {
      await rebuildRelief.mutateAsync({ realmId });
      setRebuild({ state: "built" });
      void utils.realms.map.display.invalidate();
      void utils.realms.map.version.invalidate();
      void utils.realms.map.worldStatus.invalidate();
    } catch (error) {
      const failure = failureOf(
        error instanceof Error ? error : new Error(String(error)),
        "relief"
      );
      setRebuild({ state: "failed", ...describeWorldFailure(failure) });
    }
  };

  if (rebuild.state === "built") {
    return (
      <p className="text-label-secondary text-footnote" role="status">
        The relief was rebuilt.
      </p>
    );
  }
  if (!failed) return null;
  const building = rebuild.state === "building";
  return (
    <Signal tone="warning" title="The relief was not built">
      <p>
        The world is applied, but the shading of its land is missing from the map until the relief
        is built again.
        {cause ? ` The build said: ${cause}` : ""}
      </p>
      {rebuild.state === "failed" && (
        <p className="text-destructive mt-1" role="alert">
          {rebuild.title} {rebuild.reason}
        </p>
      )}
      <Button
        size="sm"
        variant="outline"
        className="mt-2"
        disabled={building}
        onClick={() => void run()}
      >
        {building ? "Building relief" : "Rebuild relief"}
      </Button>
    </Signal>
  );
}
