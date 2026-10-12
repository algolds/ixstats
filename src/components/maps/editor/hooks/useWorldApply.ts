"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "~/trpc/react";
import { useMapImportJob, type MapImportJobView } from "~/hooks/useMapImportJob";
import { encodeWorldBundle } from "~/lib/maps/import/world-bundle";
import { uploadWorldBundle } from "~/lib/maps/import/upload-client";
import type { WorldSource } from "~/lib/worldgen/world-controls";
import {
  buildWorldBundle,
  failureOf,
  type WorldFailure,
  type WorldFailureStage,
} from "~/lib/worldgen/world-apply";
import type { WorldGenResult } from "~/lib/worldgen/worker/world-messages";
import { useLatest } from "./useLatest";

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
 * Where the flow is. The draft that was sent is kept with it: the check and the apply are of that world, whatever the
 * draft on the map becomes meanwhile.
 */
type Flow =
  | { step: "idle" }
  | { step: "sending"; draft: WorldGenResult }
  | { step: "checking"; draft: WorldGenResult; checkJobId: string }
  /** `applyJobId` is null while the apply is being queued */
  | { step: "applying"; draft: WorldGenResult; checkJobId: string; applyJobId: string | null }
  | { step: "failed"; failure: WorldFailure };

export type WorldApplyView =
  | { stage: "idle" }
  | { stage: "sending" }
  | { stage: "checking"; progress: number; message: string }
  /** `outdated`: the draft on the map is no longer the world that was checked */
  | { stage: "review"; diff: WorldDryRun; outdated: boolean }
  | { stage: "applying"; progress: number; message: string }
  | { stage: "done"; applied: WorldApplied }
  | { stage: "failed"; failure: WorldFailure };

/** A job's query, as far as the flow reads it */
type Polled = Pick<ReturnType<typeof useMapImportJob>, "data" | "error">;
type Outcome<T> = { result: T } | { failure: WorldFailure } | null;

/** A job that has finished: its result, or why it failed. Null while it is queued or running. */
function outcomeOf<T extends JobResult>(
  poll: Polled,
  stage: WorldFailureStage,
  accepts: (result: JobResult | null) => result is T
): Outcome<T> {
  const job = poll.data;
  if (!job) return poll.error ? { failure: failureOf(poll.error, stage) } : null;
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

/** What the flow shows: its own step, read together with the check and apply jobs it is polling. */
function worldApplyView(
  flow: Flow,
  check: Polled,
  apply: Polled,
  current: WorldGenResult | null
): WorldApplyView {
  switch (flow.step) {
    case "idle":
    case "sending":
      return { stage: flow.step };
    case "failed":
      return { stage: "failed", failure: flow.failure };
    case "checking": {
      const outcome = outcomeOf(check, "check", isDryRun);
      if (!outcome) return { stage: "checking", ...progressOf(check.data, "Starting the check") };
      if ("failure" in outcome) return { stage: "failed", failure: outcome.failure };
      return { stage: "review", diff: outcome.result, outdated: flow.draft !== current };
    }
    case "applying": {
      const outcome = outcomeOf(apply, "apply", isApplied);
      if (!outcome) return { stage: "applying", ...progressOf(apply.data, "Starting") };
      if ("failure" in outcome) return { stage: "failed", failure: outcome.failure };
      return { stage: "done", applied: outcome.result };
    }
  }
}

interface UseWorldApplyArgs {
  realmId: string;
  result: WorldGenResult | null;
  source: WorldSource;
  /** The world is applied: drop the draft from the map and the stored recipe */
  onApplied: () => void;
}

/**
 * Applying the draft world to the realm: build the bundle, upload it, queue the `world` import (its dry run), show
 * what it would do, and on confirmation queue the apply. The server checks everything again; every refusal comes back
 * as a `failed` view with the server's reason, and the draft stays. `begin` also serves as the retry.
 */
export function useWorldApply({ realmId, result, source, onApplied }: UseWorldApplyArgs) {
  const [flow, setFlow] = useState<Flow>({ step: "idle" });
  const utils = api.useUtils();
  const start = api.geoEditor.mapImport.start.useMutation();
  const applyWorld = api.geoEditor.mapImport.applyWorld.useMutation();
  const checkJobId = flow.step === "checking" || flow.step === "applying" ? flow.checkJobId : null;
  const applyJobId = flow.step === "applying" ? flow.applyJobId : null;
  const check = useMapImportJob(checkJobId);
  const apply = useMapImportJob(applyJobId);
  const view = worldApplyView(flow, check, apply, result);

  const latest = useLatest({
    flow,
    busy: view.stage === "sending" || view.stage === "applying",
    result,
    source,
    realmId,
    onApplied,
    utils,
    start: start.mutateAsync,
    applyWorld: applyWorld.mutateAsync,
  });

  const begin = useCallback(async () => {
    const { busy, result: draft, source: from, realmId: realm } = latest.current;
    if (!draft || busy) return;
    setFlow({ step: "sending", draft });
    try {
      const bytes = await encodeWorldBundle(buildWorldBundle(draft, from));
      const upload = await uploadWorldBundle(realm, bytes);
      const { jobId } = await latest.current.start({
        realmId: realm,
        uploadId: upload.uploadId,
        kind: "world",
        filename: `world-${draft.seed}.json.gz`,
      });
      setFlow({ step: "checking", draft, checkJobId: jobId });
    } catch (error) {
      const failure = failureOf(error instanceof Error ? error : new Error(String(error)), "send");
      setFlow({ step: "failed", failure });
    }
  }, [latest]);

  const confirm = useCallback(async () => {
    const { flow: now } = latest.current;
    if (now.step !== "checking") return;
    setFlow({ ...now, step: "applying", applyJobId: null });
    try {
      const { jobId } = await latest.current.applyWorld({ jobId: now.checkJobId });
      setFlow({ ...now, step: "applying", applyJobId: jobId });
    } catch (error) {
      const failure = failureOf(error instanceof Error ? error : new Error(String(error)), "apply");
      setFlow({ step: "failed", failure });
    }
  }, [latest]);

  const close = useCallback(() => setFlow({ step: "idle" }), []);

  // The world is applied: the live map is the new world, so the draft goes (unless the draft moved on since it was
  // sent), and everything that reads the realm's map or its lock asks again. A refusal can mean a claim landed.
  const stage = view.stage;
  useEffect(() => {
    const { flow: now, result: draft, onApplied: applied, utils: cache } = latest.current;
    if (stage === "done") {
      if (now.step === "applying" && now.draft === draft) applied();
      void cache.realms.map.version.invalidate();
      void cache.realms.map.display.invalidate();
    }
    if (stage === "done" || stage === "failed") void cache.realms.map.worldStatus.invalidate();
  }, [stage, latest]);

  return { view, begin, confirm, close };
}
