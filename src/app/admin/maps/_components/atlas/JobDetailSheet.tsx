"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Signal } from "~/components/ui/signal";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { ConfirmButton } from "./ConfirmButton";
import { JobActions } from "./JobActions";
import { STATUS_LABELS, statusTone, summarizeResult } from "./job-labels";

const when = (date: Date | null) => (date ? date.toLocaleString() : "Not yet");

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-label-secondary">{label}</dt>
      <dd className="text-label min-w-0 text-right break-words">{children}</dd>
    </div>
  );
}

interface JobDetailProps {
  jobId: string;
  onClose: () => void;
  onOpenJob: (jobId: string) => void;
}

/** Applies a world check that succeeded: the check's result above is the summary of what it will write. */
function ApplyCheck({
  jobId,
  summary,
  onOpenJob,
}: {
  jobId: string;
  summary: Array<[label: string, value: string]>;
  onOpenJob: (jobId: string) => void;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const apply = api.geoEditor.mapImport.applyWorld.useMutation({
    onSuccess: ({ jobId: applyJobId }) => {
      notify.success("Apply started", "The world is being written to the realm");
      void utils.atlas.jobs.invalidate();
      void utils.atlas.realms.invalidate();
      onOpenJob(applyJobId);
    },
    onError: (error) => notify.error("Could not apply the world", error.message),
  });
  const found = summary.map(([label, value]) => `${label}: ${value}`).join(", ");
  return (
    <ConfirmButton
      label="Apply this check"
      title="Apply this world to the realm?"
      description={`${found ? `The check found ${found}. ` : ""}Applying writes what the check lists. Every guard runs again first, and the apply is refused if the map has changed since the check.`}
      confirmLabel="Apply"
      keepLabel="Not now"
      disabled={apply.isPending}
      onConfirm={() => apply.mutate({ jobId })}
    />
  );
}

function JobDetail({ jobId, onClose, onOpenJob }: JobDetailProps) {
  const { data: job, error } = api.atlas.jobs.get.useQuery(
    { jobId },
    {
      retry: false,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === "running" || status === "queued" ? 3000 : false;
      },
    }
  );

  if (!job) {
    return error ? (
      <p className="text-destructive text-body" role="alert">
        {error.message}
      </p>
    ) : (
      <Skeleton className="rounded-card h-48 w-full" />
    );
  }

  const result = summarizeResult(job.result);
  return (
    <div className="text-footnote flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Badge variant={statusTone(job.status)}>{STATUS_LABELS[job.status] ?? job.status}</Badge>
        {job.stage && <span className="text-label-secondary">{job.stage}</span>}
      </div>
      {(job.status === "running" || job.status === "queued") && (
        <Progress value={job.progress} aria-label="Job progress" />
      )}
      {job.error && (
        <Signal tone="destructive" title="The job failed">
          {job.error}
        </Signal>
      )}
      <dl className="flex flex-col gap-2">
        <Fact label="Realm">
          {job.realm ? (
            <Link href={`/admin/maps/realms/${encodeURIComponent(job.realm.slug)}`}>
              {job.realm.name}
            </Link>
          ) : (
            "No realm"
          )}
        </Fact>
        {job.filename && <Fact label="File">{job.filename}</Fact>}
        <Fact label="Requested by">{job.requestedBy}</Fact>
        <Fact label="Queued">{when(job.createdAt)}</Fact>
        <Fact label="Started">{when(job.startedAt)}</Fact>
        <Fact label="Finished">{when(job.finishedAt)}</Fact>
        {job.parentJobId && <Fact label="Follows job">{job.parentJobId}</Fact>}
      </dl>
      {result.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-label font-medium">Result</h3>
          <dl className="flex flex-col gap-2">
            {result.map(([label, value]) => (
              <Fact key={label} label={label}>
                {value}
              </Fact>
            ))}
          </dl>
        </section>
      )}
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <JobActions
            job={job}
            onRetried={({ jobId: startedId, retryAs }) => {
              if (retryAs === "analysis") onClose();
              if (retryAs === "world-check") onOpenJob(startedId);
            }}
          />
          {job.canApply && <ApplyCheck jobId={job.id} summary={result} onOpenJob={onOpenJob} />}
        </div>
        {job.canRetry && <p className="text-label-secondary text-footnote">{job.retryNote}</p>}
        {job.status === "failed" && job.retryBlocked && (
          <p className="text-label-secondary text-footnote">{job.retryBlocked}</p>
        )}
      </section>
    </div>
  );
}

/** One job's stage, progress, result summary and error, with the actions it allows. */
export function JobDetailSheet({
  jobId,
  onClose,
  onOpenJob,
}: {
  jobId: string | null;
  onClose: () => void;
  /** Show another job in the sheet: the check a retry started, or the apply started from a check */
  onOpenJob: (jobId: string) => void;
}) {
  return (
    <Sheet open={jobId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Job {jobId}</SheetTitle>
          <SheetDescription>
            Where the job is, what it produced and what can be done.
          </SheetDescription>
        </SheetHeader>
        {jobId && <JobDetail jobId={jobId} onClose={onClose} onOpenJob={onOpenJob} />}
      </SheetContent>
    </Sheet>
  );
}
