"use client";

import { Refresh, Undo } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { ConfirmButton } from "./ConfirmButton";
import { ROLLBACK_EFFECT } from "./rollback-copy";
import type { JobRow } from "./job-labels";

type Actionable = Pick<JobRow, "id" | "canCancel" | "canRetry" | "canRollBack" | "importId">;

/** Cancel, Retry and Roll back for one job, each only where the server says the job allows it. */
export function JobActions({ job }: { job: Actionable }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const refresh = () => {
    void utils.atlas.jobs.invalidate();
    void utils.atlas.realms.invalidate();
    void utils.atlas.health.invalidate();
  };

  const cancel = api.atlas.jobs.cancel.useMutation({
    onSuccess: ({ cancelled }) => {
      if (cancelled) notify.success("Job cancelled");
      else notify.info("Job already finished", "It could not be cancelled any more");
      refresh();
    },
    onError: (error) => notify.error("Could not cancel the job", error.message),
  });
  const retry = api.atlas.jobs.retry.useMutation({
    onSuccess: ({ note }) => {
      notify.success("Job started again", note);
      refresh();
    },
    onError: (error) => notify.error("Could not start the job again", error.message),
  });
  const rollback = api.atlas.jobs.rollback.useMutation({
    onSuccess: (result) => {
      notify.success(
        "Import rolled back",
        `${result.restored} borders restored, ${result.deleted} removed`
      );
      refresh();
      void utils.geoCore.invalidate();
    },
    onError: (error) => notify.error("Could not roll back", error.message),
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {job.canCancel && (
        <ConfirmButton
          label="Cancel"
          title="Cancel this job?"
          description="The job stops where it is. Nothing it already wrote is undone."
          confirmLabel="Cancel job"
          keepLabel="Keep running"
          disabled={cancel.isPending}
          onConfirm={() => cancel.mutate({ jobId: job.id })}
        />
      )}
      {job.canRetry && (
        <Button
          size="sm"
          variant="outline"
          disabled={retry.isPending}
          onClick={() => retry.mutate({ jobId: job.id })}
        >
          <Refresh />
          Retry
        </Button>
      )}
      {job.canRollBack && job.importId && (
        <ConfirmButton
          label="Roll back"
          title="Roll back this import?"
          description={ROLLBACK_EFFECT}
          disabled={rollback.isPending}
          icon={<Undo />}
          onConfirm={() => rollback.mutate({ importId: job.importId! })}
        />
      )}
    </div>
  );
}
