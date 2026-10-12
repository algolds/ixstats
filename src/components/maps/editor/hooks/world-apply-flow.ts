import type { MapImportJobView, useMapImportJob } from "~/hooks/useMapImportJob";
import {
  draftKey,
  failureOf,
  type WorldFailure,
  type WorldFailureStage,
} from "~/lib/worldgen/world-apply";
import type { WorldJobRef } from "~/lib/worldgen/world-draft-recipe";
import type { WorldSource } from "~/lib/worldgen/world-controls";
import type { WorldGenResult } from "~/lib/worldgen/worker/world-messages";

type JobResult = NonNullable<MapImportJobView["result"]>;
/** The dry run of a world: what applying it would do */
export type WorldDryRun = Extract<JobResult, { phase: "world-dry-run" }>;
/** The apply of a world: what it wrote, and how its relief step went */
export type WorldApplied = Extract<JobResult, { phase: "world-apply" }>;

const isDryRun = (result: JobResult | null): result is WorldDryRun =>
  result?.phase === "world-dry-run";
const isApplied = (result: JobResult | null): result is WorldApplied =>
  result?.phase === "world-apply";

/**
 * The world that was sent. `draft` is the object on the map when it was; it is null for a flow picked up again after
 * the tab was left or reloaded, which knows the world only by its `key` (`draftKey`).
 */
export interface Sent {
  draft: WorldGenResult | null;
  key: string;
  /** Picked up again from the stored job, not started in this tab */
  resumed: boolean;
}

/** Where the flow is. The check and the apply are of the world that was sent, whatever the draft becomes. */
export type Flow =
  | { step: "idle" }
  | { step: "sending"; sent: Sent }
  | { step: "checking"; sent: Sent; checkJobId: string }
  /** `applyJobId` is null while the apply is being queued */
  | { step: "applying"; sent: Sent; checkJobId: string; applyJobId: string | null }
  | { step: "failed"; failure: WorldFailure };

export type WorldApplyView =
  | { stage: "idle" }
  | { stage: "sending" }
  /** `cancellable`: nothing is written yet, so the check can be called off */
  | { stage: "checking"; progress: number; message: string; cancellable: boolean }
  /**
   * `outdated`: the draft on the map is no longer the world that was checked. `mapMoved`: the realm's map is newer
   * than the one the check read, so its diff no longer holds (the server refuses to apply it).
   */
  | { stage: "review"; diff: WorldDryRun; outdated: boolean; mapMoved: boolean }
  /** `cancellable`: the apply has not started (it is only queued); once it runs it is all or nothing */
  | { stage: "applying"; progress: number; message: string; cancellable: boolean }
  | { stage: "done"; applied: WorldApplied }
  | { stage: "failed"; failure: WorldFailure };

/** A job's query, as far as the flow reads it */
export type Polled = Pick<ReturnType<typeof useMapImportJob>, "data" | "error">;
type Outcome<T> = { result: T } | { failure: WorldFailure } | null;

/** A job that has finished: its result, or why it failed. Null while it is queued or running. */
function outcomeOf<T extends JobResult>(
  poll: Polled,
  stage: WorldFailureStage,
  realmId: string,
  accepts: (result: JobResult | null) => result is T
): Outcome<T> {
  const job = poll.data;
  if (!job) return poll.error ? { failure: failureOf(poll.error, stage) } : null;
  // A job of another realm is not ours, however its id got here: it reads as gone
  if (job.realmId !== realmId) {
    return { failure: { stage, code: "NOT_FOUND", reason: "Import not found" } };
  }
  if (job.status === "succeeded") {
    return accepts(job.result)
      ? { result: job.result }
      : { failure: { stage, reason: "The server finished without a result" } };
  }
  if (job.status === "failed" || job.status === "cancelled") {
    return { failure: { stage, reason: job.error ?? "The job was cancelled" } };
  }
  return null;
}

function progressOf(job: MapImportJobView | undefined, waiting: string) {
  if (!job) return { progress: 0, message: waiting };
  const message = job.status === "queued" ? "Waiting for the import runner" : job.stage;
  return { progress: job.progress, message: message ?? waiting };
}

/** Whether the draft on the map is the world that was sent. A flow picked up again has no draft to compare. */
export function isSentDraft(sent: Sent, current: WorldGenResult | null, source: WorldSource) {
  if (sent.draft) return sent.draft === current;
  return current === null || draftKey(current, source) === sent.key;
}

/**
 * Whether the realm's map is newer than the one a check read. Versions only go up, so a map version that is older than
 * the check's is a view that has not caught up, not a change.
 */
export const mapMovedSince = (checked: number | undefined, current: number | undefined) =>
  checked !== undefined && current !== undefined && current > checked;

/** A job that was stored and is not there any more (it was cleared, or the store was): nothing to pick up. */
const isGone = (failure: WorldFailure, sent: Sent) => sent.resumed && failure.code === "NOT_FOUND";

/** What the flow shows: its own step, read together with the check and apply jobs it is polling. */
export function worldApplyView(
  flow: Flow,
  check: Polled,
  apply: Polled,
  now: { realmId: string; draft: WorldGenResult | null; source: WorldSource; mapVersion?: number }
): WorldApplyView {
  const { realmId, draft: current, source } = now;
  switch (flow.step) {
    case "idle":
    case "sending":
      return { stage: flow.step };
    case "failed":
      return { stage: "failed", failure: flow.failure };
    case "checking": {
      const outcome = outcomeOf(check, "check", realmId, isDryRun);
      if (!outcome) {
        return {
          stage: "checking",
          ...progressOf(check.data, "Starting the check"),
          cancellable: true,
        };
      }
      if ("failure" in outcome) {
        return isGone(outcome.failure, flow.sent)
          ? { stage: "idle" }
          : { stage: "failed", failure: outcome.failure };
      }
      return {
        stage: "review",
        diff: outcome.result,
        outdated: !isSentDraft(flow.sent, current, source),
        mapMoved: mapMovedSince(outcome.result.mapVersion, now.mapVersion),
      };
    }
    case "applying": {
      const outcome = outcomeOf(apply, "apply", realmId, isApplied);
      if (!outcome) {
        return {
          stage: "applying",
          ...progressOf(apply.data, "Starting"),
          cancellable: apply.data?.status === "queued",
        };
      }
      if ("failure" in outcome) {
        return isGone(outcome.failure, flow.sent)
          ? { stage: "idle" }
          : { stage: "failed", failure: outcome.failure };
      }
      return { stage: "done", applied: outcome.result };
    }
  }
}

/** The flow a stored job leaves a tab in: following the apply if it was confirmed, else the check. */
export function resumedFlow(job: WorldJobRef | null): Flow {
  if (!job) return { step: "idle" };
  const sent: Sent = { draft: null, key: job.draftKey, resumed: true };
  return job.applyJobId
    ? { step: "applying", sent, checkJobId: job.checkJobId, applyJobId: job.applyJobId }
    : { step: "checking", sent, checkJobId: job.checkJobId };
}
