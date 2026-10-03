"use client";

import React, { useMemo, useState } from "react";
import { Check, TriangleFlag } from "iconoir-react";
import { Button, focusRing } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useIxTimeStore } from "~/stores/ixtime-store";
import {
  type AgendaItem,
  type AgendaSourceElection,
  type AgendaSourceIntent,
  type AgendaSourceIssue,
  type ExecutiveAgendaProps,
  deriveAgendaItems,
  formatAgendaTime,
} from "./agenda";
import { STATUS_TEXT } from "./status-tone";

/**
 * The executive agenda: open national issues, active directives and upcoming elections, most
 * pressing first. Everything comes from live game state. "Done" hides an item until the page is
 * reloaded; it does not resolve anything.
 */
function ExecutiveAgendaComponent({
  countryId,
  onOpenDrill,
  onOpenIntent,
}: ExecutiveAgendaProps): React.JSX.Element {
  const [doneIds, setDoneIds] = useState<ReadonlySet<string>>(new Set());

  // IxTime "now", quantised so derivation does not re-run every tick.
  const nowIxTime = useIxTimeStore((s) => Math.floor(s.ixTimeTimestamp / 60_000) * 60_000);

  const intentTree = api.intent.getTree.useQuery({ countryId }, { enabled: !!countryId });
  const elections = api.elections.getElections.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !!countryId, staleTime: 60_000 }
  );
  const issuesData = api.nationalIssues.getMyIssues.useQuery(
    { countryId: countryId ?? "", status: "active" },
    { enabled: !!countryId, staleTime: 60_000 }
  );

  const isLoading = intentTree.isLoading || issuesData.isLoading;

  const items = useMemo<AgendaItem[]>(() => {
    const rawIntents = Array.isArray(intentTree.data)
      ? intentTree.data
      : (intentTree.data?.allIntents ?? []);
    return deriveAgendaItems({
      issues: (issuesData.data?.issues ?? []) as AgendaSourceIssue[],
      intents: rawIntents as AgendaSourceIntent[],
      elections: (elections.data ?? []) as AgendaSourceElection[],
      nowIxTime,
    });
  }, [intentTree.data, issuesData.data, elections.data, nowIxTime]);

  const visible = items.filter((item) => !doneIds.has(item.id));
  const nowMs = useMemo(() => Date.now(), [items]);

  const open = (item: AgendaItem) => {
    if (item.drillKind) onOpenDrill?.(item.drillKind);
    else if (item.intentId) onOpenIntent?.(item.intentId);
  };

  return (
    <Card id="executive-agenda" role="region" aria-labelledby="executive-agenda-title">
      <CardHeader className="p-4 pb-0 sm:p-5 sm:pb-0">
        <h2 id="executive-agenda-title" className="text-label text-title-3">
          Agenda
        </h2>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {isLoading ? (
          <div className="flex flex-col" aria-busy="true" aria-label="Loading agenda">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex min-h-14 items-center gap-3 py-2">
                <Skeleton className="size-4 shrink-0 rounded-xs" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/5" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length > 0 ? (
          <ul
            role="list"
            className="divide-separator flex max-h-[420px] flex-col divide-y overflow-y-auto"
          >
            {visible.map((item) => (
              <AgendaRow
                key={item.id}
                item={item}
                nowMs={nowMs}
                onOpen={() => open(item)}
                onDone={() => setDoneIds((prev) => new Set(prev).add(item.id))}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            title="Nothing on your agenda"
            message="There are no open issues, active directives or upcoming elections. Declare a Directive from the header to set a priority."
          />
        )}
      </CardContent>
    </Card>
  );
}

function AgendaRow({
  item,
  nowMs,
  onOpen,
  onDone,
}: {
  item: AgendaItem;
  nowMs: number;
  onOpen: () => void;
  onDone: () => void;
}) {
  const Icon = item.icon;
  const time = formatAgendaTime(item, nowMs);
  const pressing = item.urgency === "overdue" || item.urgency === "due-soon";

  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "hover:bg-fill-3 rounded-control-sm flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 text-left",
          focusRing
        )}
      >
        <Icon aria-hidden="true" className={cn("size-4 shrink-0", STATUS_TEXT[item.tone])} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="text-label line-clamp-1 min-w-0">{item.title}</span>
            {item.flagged ? (
              <TriangleFlag
                role="img"
                aria-label="Needs action"
                className={cn(
                  "size-3.5 shrink-0",
                  item.tone === "warning" ? STATUS_TEXT.warning : "text-destructive"
                )}
              />
            ) : null}
          </span>
          <span className="text-footnote line-clamp-1 block">
            <span className={cn("font-medium", STATUS_TEXT[item.tone])}>{item.statusLabel}</span>
            <span aria-hidden="true"> · </span>
            <span className="sr-only">. </span>
            <span className="text-label-secondary">{item.preview}</span>
          </span>
        </span>
        {time ? (
          <span
            className={cn(
              "text-footnote shrink-0 tabular-nums",
              pressing
                ? cn(
                    "font-medium",
                    item.urgency === "overdue" ? "text-destructive" : STATUS_TEXT.warning
                  )
                : "text-label-secondary"
            )}
          >
            {time}
          </span>
        ) : null}
      </button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onDone}
        aria-label={`Mark done: ${item.title}`}
      >
        <Check aria-hidden="true" />
        Done
      </Button>
    </li>
  );
}

export const ExecutiveAgenda = React.memo(ExecutiveAgendaComponent);
export type { ExecutiveAgendaProps } from "./agenda";
