"use client";
/** Import jobs: progress, per-page results (rarity, licence, why a page was skipped), cancel, retry and resume. */
import { useState } from "react";
import { Hourglass } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { cardSourceLabel, parseCardWikiSource, sourceCount } from "~/lib/cards/card-sources";
import { Badge, type BadgeVariant } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { RARITY_LABELS, labelOf } from "../shared/card-labels";

type Job = RouterOutputs["cards"]["admin"]["imports"]["jobs"][number];
type Item = RouterOutputs["cards"]["admin"]["imports"]["items"][number];

/** A run beats a job's heartbeat at least this often while it works; longer quiet means no run holds it. */
const STALL_MS = 2 * 60_000;
const OPEN_REFRESH_MS = 5_000;
const IDLE_REFRESH_MS = 30_000;

const STATUS: Record<Job["status"], { label: string; variant: BadgeVariant }> = {
  QUEUED: { label: "Queued", variant: "default" },
  RUNNING: { label: "Running", variant: "info" },
  DONE: { label: "Done", variant: "success" },
  FAILED: { label: "Failed", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "default" },
};

const ITEM_STATUS: Record<Item["status"], string> = {
  QUEUED: "Queued",
  PROCESSING: "Working",
  STAGED: "Waiting for review",
  SKIPPED: "Skipped",
  BLOCKED: "Blocked",
  FAILED: "Failed",
};

const isOpen = (job: Job) => job.status === "QUEUED" || job.status === "RUNNING";
const isStalled = (job: Job) =>
  isOpen(job) && Date.now() - new Date(job.heartbeatAt ?? job.createdAt).getTime() > STALL_MS;
const sourceName = (source: string) => {
  const wiki = parseCardWikiSource(source);
  return wiki ? cardSourceLabel(wiki) : source;
};

/** The job's results, read live: `job` is the jobs list's current row, so the sheet stops polling once it ends. */
function JobItems({ job, onClose }: { job: Job | null; onClose: () => void }) {
  const items = api.cards.admin.imports.items.useQuery(
    { jobId: job?.id ?? "" },
    { enabled: job !== null, refetchInterval: job && isOpen(job) ? OPEN_REFRESH_MS : false }
  );
  const rows = items.data ?? [];
  return (
    <Sheet open={job !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent size="wide">
        <SheetHeader>
          <SheetTitle>{job?.label}</SheetTitle>
          <SheetDescription>
            {job ? sourceName(job.source) : ""}
            {job &&
              rows.length < job.total &&
              ` · Showing ${rows.length} of ${sourceCount(parseCardWikiSource(job.source) ?? "ixwiki", job.total)}`}
          </SheetDescription>
        </SheetHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Page</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Rarity</TableHead>
              <TableHead>Licence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.title}</TableCell>
                <TableCell>
                  {ITEM_STATUS[item.status]}
                  {item.reason && (
                    <p className="text-footnote text-label-secondary">{item.reason}</p>
                  )}
                </TableCell>
                <TableCell>{item.rarity ? labelOf(RARITY_LABELS, item.rarity) : "–"}</TableCell>
                <TableCell>{item.licence ?? "–"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SheetContent>
    </Sheet>
  );
}

function JobActions({
  job,
  onView,
  onResume,
  onRetry,
  onCancel,
}: {
  job: Job;
  onView: () => void;
  onResume: () => void;
  onRetry: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <Button size="xs" variant="ghost" onClick={onView}>
        View
      </Button>
      {isStalled(job) && (
        <Button size="xs" variant="secondary" onClick={onResume}>
          Resume
        </Button>
      )}
      {job.status === "FAILED" && (
        <Button size="xs" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
      {(isOpen(job) || job.status === "FAILED") && (
        <Button size="xs" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </>
  );
}

export function ImportJobs() {
  const notify = useNotify();
  const utils = api.useUtils();
  const jobs = api.cards.admin.imports.jobs.useQuery(
    { limit: 20 },
    {
      refetchInterval: (query) =>
        query.state.data?.some(isOpen) ? OPEN_REFRESH_MS : IDLE_REFRESH_MS,
    }
  );
  const [viewingId, setViewingId] = useState<string | null>(null);
  const refresh = () => void utils.cards.admin.imports.jobs.invalidate();
  const onError = (error: { message: string }) => notify.error("Import not changed", error.message);
  const cancel = api.cards.admin.imports.cancel.useMutation({ onSuccess: refresh, onError });
  const retry = api.cards.admin.imports.retry.useMutation({ onSuccess: refresh, onError });
  const resume = api.cards.admin.imports.resume.useMutation({ onSuccess: refresh, onError });
  const list = jobs.data ?? [];
  const viewing = list.find((job) => job.id === viewingId) ?? null;

  return (
    <Card content="data">
      <CardHeader className="pt-5">
        <CardTitle icon={<Hourglass />}>Recent imports</CardTitle>
      </CardHeader>
      <CardContent className="pb-5">
        {list.length === 0 ? (
          <EmptyState compact title="No imports yet" message="Find pages above to start one." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Import</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Progress</TableHead>
                <TableHead>Results</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    {job.label}
                    <p className="text-footnote text-label-secondary">{sourceName(job.source)}</p>
                    {job.error && <p className="text-footnote text-destructive">{job.error}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS[job.status].variant}>{STATUS[job.status].label}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {job.processed} of {job.total}
                  </TableCell>
                  <TableCell className="text-footnote text-label-secondary">
                    {job.staged} staged · {job.skipped} skipped · {job.blocked} blocked ·{" "}
                    {job.failed} failed
                  </TableCell>
                  <TableCell className="space-x-1 text-right whitespace-nowrap">
                    <JobActions
                      job={job}
                      onView={() => setViewingId(job.id)}
                      onResume={() => resume.mutate()}
                      onRetry={() => retry.mutate({ jobId: job.id })}
                      onCancel={() => cancel.mutate({ jobId: job.id })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <JobItems job={viewing} onClose={() => setViewingId(null)} />
    </Card>
  );
}
