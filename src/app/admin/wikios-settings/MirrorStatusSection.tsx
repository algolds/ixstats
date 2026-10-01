"use client";
// src/app/admin/wikios-settings/MirrorStatusSection.tsx
// The outbound mirror's outbox (WikiOS -> classic MediaWiki): jobs by state, the uploads still waiting, and the dead
// jobs, which an administrator requeues (tried again) or discards (given up on).

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { CheckCircle, Refresh, Trash, WarningTriangle } from "iconoir-react";

const REFRESH_MS = 30_000;

/** "45 s", "12 min", "3 h 5 min": how long a job has waited. */
function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} h${rest > 0 ? ` ${rest} min` : ""}`;
}

function Stat({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="border-border/30 bg-background/40 rounded-xl border px-3 py-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className={`text-sm font-semibold ${alert ? "text-red-400" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

export function MirrorStatusSection() {
  const notify = useNotify();
  const utils = api.useUtils();
  const { data: status, isLoading } = api.wikios.getMirrorStatus.useQuery(undefined, {
    refetchInterval: REFRESH_MS,
  });

  const onSuccess = (title: string) => () => {
    notify.success(title);
    void utils.wikios.getMirrorStatus.invalidate();
  };
  const onError = (error: { message: string }) => notify.error("Error", error.message);
  const requeue = api.wikios.requeueMirrorJob.useMutation({
    onSuccess: onSuccess("Mirror job requeued"),
    onError,
  });
  const discard = api.wikios.discardMirrorJob.useMutation({
    onSuccess: onSuccess("Mirror job discarded"),
    onError,
  });
  const busy = requeue.isPending || discard.isPending;
  /** The dead job an administrator is being asked to confirm giving up on. */
  const [discarding, setDiscarding] = useState<{ id: string; kind: string; title: string } | null>(
    null
  );

  return (
    <div className="border-border/30 bg-card/25 space-y-4 rounded-2xl border p-5 shadow-xs backdrop-blur-md">
      <div className="border-border/20 flex items-center gap-2 border-b pb-3">
        <Refresh className="h-4 w-4 text-sky-400" />
        <div>
          <h3 className="text-foreground text-xs font-bold">MediaWiki Mirror Outbox</h3>
          <p className="text-muted-foreground text-xs">
            WikiOS edits, moves, deletions, protections and uploads on their way to classic
            MediaWiki
          </p>
        </div>
      </div>

      {isLoading || !status ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : (
        <>
          {(status.paused || !status.botConfigured) && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              <WarningTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {status.paused
                  ? "The mirror worker is stopped (SKIP_MEDIAWIKI_SYNC): jobs accumulate and nothing is lost."
                  : "No mirror bot account is configured (WIKIOS_MEDIAWIKI_BOT_USER and WIKIOS_MEDIAWIKI_BOT_TOKEN): every job fails."}
              </span>
            </div>
          )}

          {status.uploadsWaiting > 0 && (
            <div className="border-border/30 bg-background/40 text-muted-foreground flex items-start gap-2 rounded-xl border p-3 text-xs">
              <WarningTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
              <span>
                {status.uploadsWaiting} uploaded file{status.uploadsWaiting === 1 ? "" : "s"} not in
                MediaWiki yet: WikiOS serves {status.uploadsWaiting === 1 ? "it" : "them"} from its
                upload directory (WIKIOS_UPLOAD_DIR), which is the only copy until the job is done.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Pending" value={String(status.counts.pending)} />
            <Stat label="Running" value={String(status.counts.running)} />
            <Stat label="Dead" value={String(status.counts.dead)} alert={status.counts.dead > 0} />
            <Stat label="Discarded" value={String(status.counts.discarded)} />
            <Stat label="Done" value={String(status.counts.done)} />
            <Stat
              label="Oldest waiting"
              value={
                status.oldestPendingSeconds === null
                  ? "none"
                  : formatWait(status.oldestPendingSeconds)
              }
            />
          </div>

          {status.dead.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              No dead jobs: MediaWiki is in step with WikiOS.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 font-medium">Job</th>
                    <th className="px-2 py-1 font-medium">Page</th>
                    <th className="px-2 py-1 font-medium">Attempts</th>
                    <th className="px-2 py-1 font-medium">Last error</th>
                    <th className="px-2 py-1 font-medium">Died</th>
                    <th className="px-2 py-1" />
                  </tr>
                </thead>
                <tbody className="divide-border/20 divide-y">
                  {status.dead.map((job) => (
                    <tr key={job.id}>
                      <td className="px-2 py-1.5 font-mono">{job.kind}</td>
                      <td className="text-foreground px-2 py-1.5 font-medium">{job.title}</td>
                      <td className="px-2 py-1.5">{job.attempts}</td>
                      <td
                        className="text-muted-foreground max-w-xs truncate px-2 py-1.5"
                        title={job.lastError ?? undefined}
                      >
                        {job.lastError}
                      </td>
                      <td className="text-muted-foreground px-2 py-1.5">
                        {new Date(job.diedAt).toLocaleString()}
                      </td>
                      <td className="flex gap-1 px-2 py-1.5">
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={busy}
                          onClick={() => requeue.mutate({ id: job.id })}
                        >
                          <Refresh className="h-3 w-3" /> Requeue
                        </Button>
                        <Button
                          size="xs"
                          variant="destructive"
                          disabled={busy}
                          onClick={() =>
                            setDiscarding({ id: job.id, kind: job.kind, title: job.title })
                          }
                        >
                          <Trash className="h-3 w-3" /> Discard
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <AlertDialog open={discarding !== null} onOpenChange={(open) => !open && setDiscarding(null)}>
        <AlertDialogContent className="border-border bg-card text-card-foreground border shadow-2xl backdrop-blur-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground flex items-center gap-2">
              <WarningTriangle className="h-5 w-5 text-red-400" />
              Discard this mirror job?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs">
              The {discarding?.kind} of &ldquo;{discarding?.title}&rdquo; never reached classic
              MediaWiki. Discarding gives up on it: it is kept as discarded (not done), MediaWiki
              stays out of step for this page until someone edits it again, and the jobs queued
              behind it for this page can run. Requeue it instead to try again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose>Cancel</AlertDialogClose>
            <Button
              variant="destructive"
              disabled={discard.isPending}
              onClick={() => {
                if (discarding) discard.mutate({ id: discarding.id });
                setDiscarding(null);
              }}
            >
              <Trash className="h-3.5 w-3.5" /> Discard job
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
