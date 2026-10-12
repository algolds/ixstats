"use client";

import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { isJobActive, type MapImportJobView } from "~/hooks/useMapImportJob";

const STATUS_TEXT: Record<string, string> = {
  queued: "Waiting for the import runner",
  running: "Working",
  succeeded: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

interface ImportJobProgressProps {
  job: MapImportJobView | undefined;
  /** Why the job could not be read at all, when it could not: it is shown instead of waiting for it */
  readError?: string | null;
  /** Reads the job again, after `readError` */
  onRetryRead?: () => void;
}

/** A job's progress bar, stage and error, with Cancel while it runs. */
export function ImportJobProgress({ job, readError, onRetryRead }: ImportJobProgressProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const cancel = api.geoEditor.mapImport.cancel.useMutation({
    onSuccess: () => void utils.geoEditor.mapImport.job.invalidate(),
    onError: (error) => notify.error("Could not cancel the import", error.message),
  });
  if (!job && readError) {
    return (
      <div className="flex flex-col items-start gap-2" role="alert">
        <p className="text-destructive text-footnote">The import could not be read: {readError}</p>
        {onRetryRead && (
          <Button size="sm" variant="outline" onClick={onRetryRead}>
            Try again
          </Button>
        )}
      </div>
    );
  }
  if (!job) return <p className="text-label-secondary text-footnote">Loading the import…</p>;
  const tone =
    job.status === "failed" ? "destructive" : job.status === "succeeded" ? "success" : "tint";

  return (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      <div className="text-footnote flex items-center justify-between gap-3">
        <span className="text-label">
          {STATUS_TEXT[job.status] ?? job.status}
          {job.stage && job.status === "running" ? `: ${job.stage}` : ""}
        </span>
        <span className="text-label-secondary tabular-nums">{job.progress}%</span>
      </div>
      <Progress value={job.progress} tone={tone} aria-label="Import progress" />
      {job.status === "queued" && (
        <p className="text-label-secondary text-footnote">
          The import runs in the background. If the map-import job of the cron runner is on, it
          starts within a minute.
        </p>
      )}
      {job.error && <p className="text-destructive text-footnote">{job.error}</p>}
      {isJobActive(job) && (
        <div>
          <Button
            size="sm"
            variant="outline"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate({ jobId: job.id })}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
