"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { useMapImportJob } from "~/hooks/useMapImportJob";
import { encodeWorldBundle } from "~/lib/maps/import/world-bundle";
import { uploadWorldBundle } from "~/lib/maps/import/upload-client";
import type { WorldSource } from "~/lib/worldgen/world-controls";
import { buildWorldBundle, draftKey, failureOf } from "~/lib/worldgen/world-apply";
import { clearWorldJob, loadWorldJob, saveWorldJob } from "~/lib/worldgen/world-draft-recipe";
import type { WorldGenResult } from "~/lib/worldgen/worker/world-messages";
import { isSentDraft, resumedFlow, worldApplyView, type Flow, type Sent } from "./world-apply-flow";
import { useLatest } from "./useLatest";

export type { WorldApplied, WorldApplyView, WorldDryRun } from "./world-apply-flow";

interface UseWorldApplyArgs {
  realmId: string;
  result: WorldGenResult | null;
  source: WorldSource;
  /** The realm's map version now, when it is known */
  mapVersion?: number;
  /** The world is applied: drop the draft from the map and the stored recipe */
  onApplied: () => void;
}

/**
 * Applying the draft world to the realm: build the bundle, upload it, queue the `world` import (its dry run), show
 * what it would do, and on confirmation queue the apply. The server checks everything again; every refusal comes back
 * as a `failed` view with the server's reason, and the draft stays. `begin` also serves as the retry.
 *
 * The job in flight is stored with the realm's draft (`saveWorldJob`), so a World tab that was left (the tab closes
 * when another is chosen) or a page that was reloaded mid-apply picks the job up again: it is polled to its end and the
 * success handling (the draft off the map, the maps asked again) runs then.
 */
export function useWorldApply({
  realmId,
  result,
  source,
  mapVersion,
  onApplied,
}: UseWorldApplyArgs) {
  const [flow, setFlow] = useState<Flow>(() => resumedFlow(loadWorldJob(realmId)));
  const utils = api.useUtils();
  const start = api.geoEditor.mapImport.start.useMutation();
  const applyWorld = api.geoEditor.mapImport.applyWorld.useMutation();
  const cancelJob = api.geoEditor.mapImport.cancel.useMutation();
  const checkJobId = flow.step === "checking" || flow.step === "applying" ? flow.checkJobId : null;
  const applyJobId = flow.step === "applying" ? flow.applyJobId : null;
  const check = useMapImportJob(checkJobId);
  const apply = useMapImportJob(applyJobId);
  const view = worldApplyView(flow, check, apply, { realmId, draft: result, source, mapVersion });
  // A call that is under way: a second press in the same moment, before the view has caught up, is ignored
  const calling = useRef(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

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
    cancelJob: cancelJob.mutateAsync,
  });

  const begin = useCallback(async () => {
    const { busy, result: draft, source: from, realmId: realm } = latest.current;
    if (!draft || busy || calling.current) return;
    calling.current = true;
    const sent: Sent = { draft, key: draftKey(draft, from), resumed: false };
    setFlow({ step: "sending", sent });
    try {
      const bytes = await encodeWorldBundle(buildWorldBundle(draft, from));
      const upload = await uploadWorldBundle(realm, bytes);
      const { jobId } = await latest.current.start({
        realmId: realm,
        uploadId: upload.uploadId,
        kind: "world",
        filename: `world-${draft.seed}.json.gz`,
      });
      saveWorldJob(realm, { checkJobId: jobId, applyJobId: null, draftKey: sent.key });
      setFlow({ step: "checking", sent, checkJobId: jobId });
    } catch (error) {
      setFlow({
        step: "failed",
        failure: failureOf(error instanceof Error ? error : new Error(String(error)), "send"),
      });
    } finally {
      calling.current = false;
    }
  }, [latest]);

  const confirm = useCallback(async () => {
    const { flow: now, realmId: realm } = latest.current;
    if (now.step !== "checking" || calling.current) return;
    calling.current = true;
    setFlow({ ...now, step: "applying", applyJobId: null });
    try {
      const { jobId } = await latest.current.applyWorld({ jobId: now.checkJobId });
      saveWorldJob(realm, {
        checkJobId: now.checkJobId,
        applyJobId: jobId,
        draftKey: now.sent.key,
      });
      setFlow({ ...now, step: "applying", applyJobId: jobId });
    } catch (error) {
      setFlow({
        step: "failed",
        failure: failureOf(error instanceof Error ? error : new Error(String(error)), "apply"),
      });
    } finally {
      calling.current = false;
    }
  }, [latest]);

  /**
   * Call off the check, or an apply that has not started. A job that has finished meanwhile is shown as it ended; a
   * call that failed for another reason is said, and Cancel can be pressed again.
   */
  const cancel = useCallback(async () => {
    const { flow: now } = latest.current;
    const jobId =
      now.step === "applying" ? now.applyJobId : now.step === "checking" ? now.checkJobId : null;
    if (!jobId) return;
    setCancelError(null);
    try {
      await latest.current.cancelJob({ jobId });
      setFlow({ step: "idle" });
    } catch (error) {
      const failure = failureOf(error instanceof Error ? error : new Error(String(error)), "check");
      if (failure.code !== "CONFLICT") setCancelError(failure.reason);
    }
  }, [latest]);

  const close = useCallback(() => setFlow({ step: "idle" }), []);

  // A job that is over (applied, refused, cancelled, gone, or closed) is not picked up again. When the world is
  // applied the live map is the new world, so the draft goes (unless the draft moved on since it was sent) and
  // everything that reads the realm's map or its lock asks again. A refusal can mean a claim landed.
  const stage = view.stage;
  useEffect(() => {
    const {
      flow: now,
      result: draft,
      source: from,
      realmId: realm,
      onApplied: applied,
      utils: cache,
    } = latest.current;
    if (stage === "idle" || stage === "done" || stage === "failed") clearWorldJob(realm);
    if (stage === "done") {
      if (now.step === "applying" && isSentDraft(now.sent, draft, from)) applied();
      void cache.realms.map.version.invalidate();
      void cache.realms.map.display.invalidate();
    }
    if (stage === "done" || stage === "failed") void cache.realms.map.worldStatus.invalidate();
  }, [stage, latest]);

  return { view, cancelError, begin, confirm, cancel, close };
}
