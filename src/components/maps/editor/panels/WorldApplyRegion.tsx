"use client";

import { Button } from "~/components/ui/button";
import type { RouterOutputs } from "~/trpc/react";
import type { WorldSource } from "~/lib/worldgen/world-controls";
import type { WorldGenResult } from "~/lib/worldgen/worker/world-messages";
import { useWorldApply } from "../hooks/useWorldApply";
import { WorldApplyReview } from "./WorldApplyReview";
import { WorldApplyDone, WorldApplyFailed, WorldApplyProgress } from "./WorldApplyStatus";
import { WorldReliefRebuild } from "./WorldReliefRebuild";

/**
 * Whether claims or an archived realm lock applying, as `realms.map.worldStatus` answers. `loading` and `failed`
 * are different: a failed read is not an unlocked world, and the server checks the lock again when it applies.
 */
export type WorldLock =
  | { phase: "loading" }
  | { phase: "failed"; message: string; retry: () => void }
  | { phase: "ready"; status: RouterOutputs["realms"]["map"]["worldStatus"] };

/** What the apply region reads. `WorldPanel` renders it on a realm (never in the studio's sandbox). */
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
   * generation failed, or the realm's map changed or is loading under a draft fitted to it. Only a draft that is not
   * stale is applied.
   */
  stale: boolean;
  /** The realm's map version now (the layers' version), when it is known: a check of an older map is not applied */
  mapVersion?: number;
  lock: WorldLock;
  /** Drops the draft from the map and the stored recipe: called once the world has been applied */
  onDiscardDraft: () => void;
}

/** Why the realm can't take a world now (its claims, its status), or null when it can. */
function lockBlock(lock: WorldLock): string | null {
  if (lock.phase === "loading") return "Checking the realm's claims.";
  if (lock.phase === "failed") return "Claims could not be checked, so using a world is off.";
  if (lock.status.lockReason === "archived") return "This realm is archived.";
  if (lock.status.lockReason === "claims") return "Claims on this realm's nations lock its world.";
  return null;
}

/** Why the draft can't be used yet, or null when it can. */
function draftBlock({ result, generating, stale }: WorldApplyRegionProps): string | null {
  if (generating) return "Wait for the preview to finish.";
  if (!result) return "Make a preview first.";
  if (stale) return "The preview no longer matches the controls or the realm's map.";
  return null;
}

/**
 * Using the draft world for the realm: Use this world uploads it and checks what it would change (the dry run), the
 * review shows that, Apply writes it. Applying is off, with the reason, while the claims are unread or lock the realm
 * or the draft is out of date; the server checks all of it again. Also offers to rebuild the relief when its build
 * failed.
 */
export function WorldApplyRegion(props: WorldApplyRegionProps) {
  const { realm, result, source, generating, stale, mapVersion, lock, onDiscardDraft } = props;
  const { view, cancelError, begin, confirm, cancel, close } = useWorldApply({
    realmId: realm.id,
    result,
    source,
    mapVersion,
    onApplied: onDiscardDraft,
  });
  const lockedBy = lockBlock(lock);
  const reviewOutdated =
    view.stage === "review" && (view.outdated || view.mapMoved || generating || stale);
  const blocked = lockedBy ?? draftBlock(props);
  const appliedRelief = view.stage === "done" ? view.applied.relief : null;
  // An archived realm's relief can't be rebuilt either, so it is not offered there
  const archived = lock.phase === "ready" && lock.status.lockReason === "archived";
  const reliefFailed =
    !archived &&
    (appliedRelief?.status === "failed" || (lock.phase === "ready" && lock.status.reliefFailed));

  return (
    <div className="border-separator space-y-3 border-t pt-3">
      <WorldReliefRebuild realmId={realm.id} failed={reliefFailed} cause={appliedRelief?.error} />
      {view.stage === "idle" && (
        <div className="space-y-2">
          <Button className="w-full" disabled={blocked !== null} onClick={() => void begin()}>
            Use this world
          </Button>
          {blocked && <p className="text-label-secondary text-caption">{blocked}</p>}
        </div>
      )}
      {view.stage === "sending" && (
        <WorldApplyProgress label="Sending the world" message="Uploading" progress={null} />
      )}
      {view.stage === "checking" && (
        <WorldApplyProgress
          label="Checking the world"
          message={view.message}
          progress={view.progress}
          onCancel={view.cancellable ? () => void cancel() : undefined}
          error={cancelError}
        />
      )}
      {view.stage === "review" && (
        <WorldApplyReview
          diff={view.diff}
          // A preview being made or out of step with the controls, or a map that moved, is not the world checked
          outdated={reviewOutdated}
          mapMoved={view.mapMoved}
          blocked={reviewOutdated ? blocked : lockedBy}
          onApply={() => void confirm()}
          onCheckAgain={() => void begin()}
          onCancel={close}
        />
      )}
      {view.stage === "applying" && (
        <WorldApplyProgress
          label="Applying the world"
          message={view.message}
          progress={view.progress}
          onCancel={view.cancellable ? () => void cancel() : undefined}
          error={cancelError}
        />
      )}
      {view.stage === "done" && (
        <WorldApplyDone applied={view.applied} realmSlug={realm.slug} onClose={close} />
      )}
      {view.stage === "failed" && (
        <WorldApplyFailed
          failure={view.failure}
          blocked={blocked}
          onRetry={() => void begin()}
          onClose={close}
        />
      )}
      {lock.phase === "failed" && (
        <Button size="sm" variant="outline" onClick={lock.retry}>
          Check claims again
        </Button>
      )}
    </div>
  );
}
