"use client";

import { Button } from "~/components/ui/button";
import type { RouterOutputs } from "~/trpc/react";
import type { WorldSource } from "~/lib/worldgen/world-controls";
import type { WorldGenResult } from "~/lib/worldgen/worker/world-messages";

/**
 * What the apply flow can read. `WorldPanel` renders this region below the draft's statistics, on a realm (never in
 * the studio's sandbox), and owns everything in it.
 */
export interface WorldApplyRegionProps {
  /** The realm the world would be applied to */
  realm: { id: string; slug: string | null };
  /**
   * The draft on the map: seed, the parameters with defaults filled in, the layers as JSON strings, the slots, the
   * packed cells. Null until a world has been made.
   */
  result: WorldGenResult | null;
  /** How the draft was made: from a preset, or around the realm's own borders */
  source: WorldSource;
  /** A generation is running, so `result` is about to be replaced */
  generating: boolean;
  /** Whether claims or an archived realm lock applying (`realms.map.worldStatus`); undefined while it loads */
  status: RouterOutputs["realms"]["map"]["worldStatus"] | undefined;
  /** Drops the draft from the map and the stored recipe: call it once the world has been applied */
  onDiscardDraft: () => void;
}

/**
 * The seam for applying a world. The upload, dry run, apply, progress and result flow renders here, reading the
 * props above; until it does, applying is not offered.
 */
export function WorldApplyRegion({ result, generating }: WorldApplyRegionProps) {
  return (
    <div className="border-separator space-y-2 border-t pt-3">
      <Button className="w-full" disabled>
        Use this world
      </Button>
      {!result && !generating && (
        <p className="text-label-secondary text-caption">Make a preview first.</p>
      )}
    </div>
  );
}
