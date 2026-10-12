"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
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

function JobDetail({ jobId }: { jobId: string }) {
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
    <div className="flex flex-col gap-5 text-sm">
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
        <JobActions job={job} />
        {job.canRetry && <p className="text-label-secondary text-footnote">{job.retryNote}</p>}
        {job.status === "failed" && job.retryBlocked && (
          <p className="text-label-secondary text-footnote">{job.retryBlocked}</p>
        )}
      </section>
    </div>
  );
}

/** One job's stage, progress, result summary and error, with the actions it allows. */
export function JobDetailSheet({ jobId, onClose }: { jobId: string | null; onClose: () => void }) {
  return (
    <Sheet open={jobId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Job {jobId}</SheetTitle>
          <SheetDescription>
            Where the job is, what it produced and what can be done.
          </SheetDescription>
        </SheetHeader>
        {jobId && <JobDetail jobId={jobId} />}
      </SheetContent>
    </Sheet>
  );
}
