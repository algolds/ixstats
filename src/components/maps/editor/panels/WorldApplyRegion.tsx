"use client";

import { Button } from "~/components/ui/button";
import type { RouterOutputs } from "~/trpc/react";
import type { WorldSource } from "~/lib/worldgen/world-controls";
import type { WorldGenResult } from "~/lib/worldgen/worker/world-messages";

/**
 * Whether claims or an archived realm lock applying, as `realms.map.worldStatus` answers. `loading` and `failed`
 * are different: a failed read is not an unlocked world, and the server checks the lock again when it applies.
 */
export type WorldLock =
  | { phase: "loading" }
  | { phase: "failed"; message: string; retry: () => void }
  | { phase: "ready"; status: RouterOutputs["realms"]["map"]["worldStatus"] };

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
  /**
   * `result` is not the world the controls, the seed and the realm's map now ask for: a slider is mid-drag, the last
   * generation failed, or the realm's map changed or is loading under a draft fitted to it. Apply only a draft
   * that is not stale.
   */
  stale: boolean;
  lock: WorldLock;
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
