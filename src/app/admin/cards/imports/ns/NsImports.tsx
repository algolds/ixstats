"use client";
/** NationStates: start a region sync, watch and control running syncs, run the CTE filter, and the history. */
import { Hourglass, UserXmark } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Badge, type BadgeVariant } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { NsHistory } from "./NsHistory";
import { NsRegionSync } from "./NsRegionSync";

type Sync = RouterOutputs["cards"]["admin"]["nationstates"]["active"][number];

const ACTIVE_REFRESH_MS = 5_000;

/** A sync's status as shown: a running one whose run has gone quiet is stalled, and can be resumed. */
function syncStatus(sync: Sync): { label: string; variant: BadgeVariant } {
  if (sync.status === "PAUSED") return { label: "Paused", variant: "warning" };
  return sync.stalled
    ? { label: "Stalled", variant: "warning" }
    : { label: "Running", variant: "info" };
}

function SyncRow({
  sync,
  busy,
  onPause,
  onResume,
  onStop,
}: {
  sync: Sync;
  busy: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  const paused = sync.status === "PAUSED";
  const status = syncStatus(sync);
  return (
    <TableRow>
      <TableCell>{sync.region}</TableCell>
      <TableCell>
        <Badge variant={status.variant}>{status.label}</Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {/* A sync reads the season dumps before it knows how many cards it has */}
        {sync.totalCards > 0 ? `${sync.processed} of ${sync.totalCards}` : "Reading the card dumps"}
      </TableCell>
      <TableCell className="space-x-1 text-right whitespace-nowrap">
        {!paused && (
          <Button size="xs" variant="secondary" disabled={busy} onClick={onPause}>
            Pause
          </Button>
        )}
        {(paused || sync.stalled) && (
          <Button size="xs" variant="secondary" disabled={busy} onClick={onResume}>
            Resume
          </Button>
        )}
        <Button size="xs" variant="ghost" disabled={busy} onClick={onStop}>
          Stop
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function NsImports() {
  const notify = useNotify();
  const utils = api.useUtils();
  const active = api.cards.admin.nationstates.active.useQuery(undefined, {
    refetchInterval: ACTIVE_REFRESH_MS,
  });
  const refresh = () => {
    void utils.cards.admin.nationstates.active.invalidate();
    void utils.cards.admin.nationstates.logs.invalidate();
  };
  const onError = (error: { message: string }) => notify.error("Sync not changed", error.message);
  const pause = api.cards.admin.nationstates.pause.useMutation({ onSuccess: refresh, onError });
  const resume = api.cards.admin.nationstates.resume.useMutation({ onSuccess: refresh, onError });
  const stop = api.cards.admin.nationstates.stop.useMutation({ onSuccess: refresh, onError });
  const cte = api.cards.admin.nationstates.filterCte.useMutation({
    onSuccess: () => {
      notify.success(
        "CTE filter started",
        "It runs in the background. The history shows when it is done."
      );
      refresh();
    },
    onError: (error) => notify.error("CTE filter not started", error.message),
  });
  const syncs = active.data ?? [];
  // Syncs with a pause, resume or stop still on its way: their buttons wait for the answer
  const busy = new Set(
    [pause, resume, stop]
      .filter((control) => control.isPending)
      .map((control) => control.variables?.syncLogId)
  );

  return (
    <div className="space-y-6">
      <NsRegionSync onStarted={refresh} />

      <Card content="data">
        <CardHeader className="pt-5">
          <CardTitle icon={<Hourglass />}>Running syncs</CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          {syncs.length === 0 ? (
            <EmptyState compact title="No sync running" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Region</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Done</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncs.map((sync) => (
                  <SyncRow
                    key={sync.id}
                    sync={sync}
                    busy={busy.has(sync.id)}
                    onPause={() => pause.mutate({ syncLogId: sync.id })}
                    onResume={() => resume.mutate({ syncLogId: sync.id })}
                    onStop={() => stop.mutate({ syncLogId: sync.id })}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card content="input">
        <CardHeader className="pt-5">
          <CardTitle icon={<UserXmark />}>Ceased nations</CardTitle>
          <CardDescription>
            Marks every NationStates card whose nation has ceased to exist, from the daily nations
            dump.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-5">
          <Button variant="secondary" disabled={cte.isPending} onClick={() => cte.mutate()}>
            Run the CTE filter
          </Button>
        </CardContent>
      </Card>

      <NsHistory />
    </div>
  );
}
