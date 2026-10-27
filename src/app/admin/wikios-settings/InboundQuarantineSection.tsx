"use client";
// src/app/admin/wikios-settings/InboundQuarantineSection.tsx
// The inbound sync's quarantined steps (classic MediaWiki -> WikiOS): a recent change or log event that failed in five
// cycles, which the sync moved past so it would not stall. An administrator retries one (it runs through the same
// conflict rule as a cycle; a log event a later classic change overtook cannot be retried), resyncs an edit's page from
// classic, or dismisses it, after a confirm. The sync status is degraded while any is left.

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
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { CheckCircle, Download, Refresh, Trash, WarningTriangle } from "iconoir-react";

const REFRESH_MS = 30_000;

type QuarantinedStep = RouterOutputs["wikios"]["getQuarantinedSyncSteps"][number];

/** What kind of step a row is, in words. */
const STREAMS: Record<string, string> = { edits: "Edit", log: "Log event" };

/** A retry or resync that found nothing to apply. */
const NOTHING_TO_APPLY = "The change is no longer on MediaWiki; nothing to apply.";
const FAILED_AGAIN = "The step failed again. Its row shows the new error.";

type ActionOutcome = "applied" | "skipped" | "failed";

function QuarantinedRow({
  step,
  busy,
  onRetry,
  onResync,
  onDismiss,
}: {
  step: QuarantinedStep;
  busy: boolean;
  onRetry: () => void;
  onResync: () => void;
  onDismiss: () => void;
}) {
  return (
    <tr>
      <td className="px-2 py-1.5">{STREAMS[step.stream] ?? step.stream}</td>
      <td className="text-label px-2 py-1.5 font-medium">{step.subject}</td>
      <td className="text-label-secondary px-2 py-1.5">{step.label}</td>
      <td className="px-2 py-1.5">{step.attempts}</td>
      <td
        className="text-label-secondary max-w-xs truncate px-2 py-1.5"
        title={step.lastError ?? undefined}
      >
        {step.lastError}
        {step.staleReason && <div className="text-label whitespace-normal">{step.staleReason}</div>}
      </td>
      <td className="text-label-secondary px-2 py-1.5">
        {step.quarantinedAt ? new Date(step.quarantinedAt).toLocaleString() : null}
      </td>
      <td className="flex gap-1 px-2 py-1.5">
        <Button size="xs" variant="outline" disabled={busy || step.stale} onClick={onRetry}>
          <Refresh className="h-3 w-3" /> Retry
        </Button>
        {step.stream === "edits" && (
          <Button size="xs" variant="outline" disabled={busy} onClick={onResync}>
            <Download className="h-3 w-3" /> Resync page from classic
          </Button>
        )}
        <Button size="xs" variant="destructive" disabled={busy} onClick={onDismiss}>
          <Trash className="h-3 w-3" /> Dismiss
        </Button>
      </td>
    </tr>
  );
}

export function InboundQuarantineSection() {
  const notify = useNotify();
  const utils = api.useUtils();
  const { data: steps, isLoading } = api.wikios.getQuarantinedSyncSteps.useQuery(undefined, {
    refetchInterval: REFRESH_MS,
  });
  /** The last action's failure, announced until the next action starts. */
  const [failure, setFailure] = useState<string | null>(null);
  /** The step an administrator is being asked to confirm giving up on. */
  const [dismissing, setDismissing] = useState<QuarantinedStep | null>(null);

  const refresh = () => void utils.wikios.getQuarantinedSyncSteps.invalidate();
  const onError = (error: { message: string }) => setFailure(error.message);
  /** What a retry or resync did, said once the list is refreshed. */
  const reportOutcome = (applied: string) => (data: { outcome: ActionOutcome }) => {
    refresh();
    if (data.outcome === "applied") notify.success(applied);
    else if (data.outcome === "skipped") notify.info(NOTHING_TO_APPLY);
    else setFailure(FAILED_AGAIN);
  };
  const retry = api.wikios.retryQuarantinedSyncStep.useMutation({
    onSuccess: reportOutcome("Step applied"),
    onError,
  });
  const resync = api.wikios.resyncQuarantinedPage.useMutation({
    onSuccess: reportOutcome("Page resynced from classic"),
    onError,
  });
  const dismiss = api.wikios.dismissQuarantinedSyncStep.useMutation({
    onSuccess: () => {
      refresh();
      notify.success("Step dismissed");
    },
    onError,
  });
  // one busy state for the whole section: a retry, a resync and a dismissal never run at once
  const busy = retry.isPending || resync.isPending || dismiss.isPending;

  /** Start `mutation` on step `id`, the last failure cleared. */
  const start = (mutation: { mutate: (input: { id: string }) => void }, id: string) => {
    setFailure(null);
    mutation.mutate({ id });
  };
  const confirmDismiss = () => {
    setFailure(null);
    if (dismissing) dismiss.mutate({ id: dismissing.id });
    setDismissing(null);
  };

  return (
    <Card padding="lg" className="space-y-4">
      <div className="border-separator flex items-center gap-2 border-b pb-3">
        <WarningTriangle className="text-tint h-4 w-4" />
        <div>
          <h3 className="text-label text-caption">Inbound sync quarantine</h3>
          <p className="text-label-secondary text-footnote">
            Classic MediaWiki changes that failed in five sync cycles. The sync moved past them;
            retry one once its cause is fixed, or dismiss it.
          </p>
        </div>
      </div>

      {failure && (
        <div
          role="alert"
          className="rounded-row border-red/30 bg-red/10 text-footnote text-label border p-3"
        >
          {failure}
        </div>
      )}

      {isLoading || !steps ? (
        <Skeleton className="rounded-row h-16 w-full" />
      ) : steps.length === 0 ? (
        <div className="text-green text-footnote flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          No quarantined steps: the inbound sync is applying everything classic MediaWiki sends.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-footnote w-full text-left">
            <thead className="text-label-secondary">
              <tr>
                <th className="px-2 py-1 font-medium">Step</th>
                <th className="px-2 py-1 font-medium">Page</th>
                <th className="px-2 py-1 font-medium">What</th>
                <th className="px-2 py-1 font-medium">Attempts</th>
                <th className="px-2 py-1 font-medium">Last error</th>
                <th className="px-2 py-1 font-medium">Quarantined</th>
                <th className="px-2 py-1" />
              </tr>
            </thead>
            <tbody className="divide-separator divide-y">
              {steps.map((step) => (
                <QuarantinedRow
                  key={step.id}
                  step={step}
                  busy={busy}
                  onRetry={() => start(retry, step.id)}
                  onResync={() => start(resync, step.id)}
                  onDismiss={() => setDismissing(step)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={dismissing !== null} onOpenChange={(open) => !open && setDismissing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <WarningTriangle className="text-red h-5 w-5" />
              Dismiss this sync step?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-footnote">
              &ldquo;{dismissing?.label}&rdquo; never reached WikiOS. Dismissing gives up on it:
              WikiOS keeps what it has for &ldquo;{dismissing?.subject}&rdquo;, which may differ
              from classic MediaWiki until the page changes again. Retry it instead to apply it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose>Cancel</AlertDialogClose>
            <Button variant="destructive" disabled={busy} onClick={confirmDismiss}>
              <Trash className="h-3.5 w-3.5" /> Dismiss step
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
