"use client";
/** Every NationStates sync and filter run, and the cards a sync created. */
import { useState } from "react";
import { ClockRotateRight } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useDebounce } from "~/hooks/useDebounce";
import { timeAgo } from "~/lib/format/compact";
import { Badge, type BadgeVariant } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
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
import { useDialogTarget } from "~/app/admin/vault/player-cards/useDialogTarget";
import { RARITY_LABELS, REVIEW_STATE_LABELS, labelOf } from "../../shared/card-labels";

type Log = RouterOutputs["cards"]["admin"]["nationstates"]["logs"][number];

const HISTORY_REFRESH_MS = 10_000;

const STATUS: Readonly<Record<string, { label: string; variant: BadgeVariant }>> = {
  IN_PROGRESS: { label: "Running", variant: "info" },
  PAUSED: { label: "Paused", variant: "warning" },
  SUCCESS: { label: "Done", variant: "success" },
  FAILED: { label: "Failed", variant: "destructive" },
};

/** Runs that are not region syncs; any other type shows as stored. */
const RUN_LABELS: Readonly<Record<string, string>> = { NS_CTE_FILTER: "CTE filter" };

const statusOf = (status: string) =>
  (Object.hasOwn(STATUS, status) && STATUS[status]) || {
    label: status,
    variant: "default" as const,
  };

/** The cards of `log`, the run last opened, which stays shown while the sheet closes. */
function SyncCards({
  log,
  open,
  onClose,
}: {
  log: Log | null;
  open: boolean;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const query = useDebounce(search.trim(), 300);
  const cards = api.cards.admin.nationstates.logCards.useQuery(
    { syncLogId: log?.id ?? "", search: query || undefined, limit: 50, offset: 0 },
    { enabled: open && log !== null }
  );
  const rows = cards.data?.cards ?? [];
  const total = cards.data?.total ?? 0;
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent size="wide">
        <SheetHeader>
          <SheetTitle>Cards from {log?.region}</SheetTitle>
          <SheetDescription>
            {cards.data?.exact === false
              ? "This sync ran before syncs recorded their cards, so this is every card first synced from this region."
              : "The cards this sync created."}
            {rows.length < total && ` Showing ${rows.length} of ${total.toLocaleString()}.`}
          </SheetDescription>
        </SheetHeader>
        <Input
          aria-label="Search cards"
          placeholder="Search by nation"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {cards.data && total === 0 ? (
          <EmptyState
            compact
            title="No cards found"
            message={query ? "No card matches that search." : "This sync created no cards."}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Card</TableHead>
                <TableHead>Rarity</TableHead>
                <TableHead>Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((card) => (
                <TableRow key={card.id}>
                  <TableCell>
                    {card.title} <span className="text-label-secondary">· S{card.nsSeason}</span>
                  </TableCell>
                  <TableCell>{labelOf(RARITY_LABELS, card.rarity)}</TableCell>
                  <TableCell>{labelOf(REVIEW_STATE_LABELS, card.reviewState)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SheetContent>
    </Sheet>
  );
}

function RunCell({ log }: { log: Log }) {
  const checked = log.region === null && log.itemsProcessed > 0;
  return (
    <TableCell>
      {log.region ?? labelOf(RUN_LABELS, log.syncType)}
      {checked && (
        <p className="text-footnote text-label-secondary">
          {log.itemsProcessed.toLocaleString()} cards checked
        </p>
      )}
      {log.errorMessage && <p className="text-footnote text-destructive">{log.errorMessage}</p>}
    </TableCell>
  );
}

export function NsHistory() {
  const logs = api.cards.admin.nationstates.logs.useQuery(
    { limit: 50 },
    { refetchInterval: HISTORY_REFRESH_MS }
  );
  const viewing = useDialogTarget<Log>();
  const list = logs.data ?? [];
  return (
    <Card content="data">
      <CardHeader className="pt-5">
        <CardTitle icon={<ClockRotateRight />}>History</CardTitle>
      </CardHeader>
      <CardContent className="pb-5">
        {list.length === 0 ? (
          <EmptyState compact title="No NationStates syncs yet" message="Start one above." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead className="text-right">New</TableHead>
                <TableHead className="text-right">Updated</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((log) => (
                <TableRow key={log.id}>
                  <RunCell log={log} />
                  <TableCell>
                    <Badge variant={statusOf(log.status).variant}>
                      {statusOf(log.status).label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-label-secondary">
                    <time
                      dateTime={new Date(log.startedAt).toISOString()}
                      title={new Date(log.startedAt).toLocaleString()}
                    >
                      {timeAgo(log.startedAt)}
                    </time>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {log.region ? log.cardsCreated.toLocaleString() : "–"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {log.region ? log.cardsUpdated.toLocaleString() : "–"}
                  </TableCell>
                  <TableCell className="text-right">
                    {log.region && (
                      <Button size="xs" variant="ghost" onClick={() => viewing.open(log)}>
                        Cards
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {/* Keyed by the run, so another run's sheet opens with an empty search */}
      <SyncCards
        key={viewing.shown?.id}
        log={viewing.shown}
        open={viewing.target !== null}
        onClose={viewing.close}
      />
    </Card>
  );
}
