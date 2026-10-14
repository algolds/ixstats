"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { NavArrowDown, NavArrowRight, Wallet } from "iconoir-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";
import {
  describeRow,
  groupStatement,
  type RowDescription,
  type StatementRow,
} from "~/lib/vault/statement";
import type { DividendLine } from "~/lib/vault/vault-dividend";

type Filter = "all" | "earned" | "spent";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "earned", label: "Earned" },
  { value: "spent", label: "Spent" },
] as const;

const EMPTY: Record<Filter, string> = {
  all: "No transactions yet",
  earned: "No earnings yet",
  spent: "No spending yet",
};

const LINE_LABELS: Record<DividendLine["key"], string> = {
  interest: "Collection interest",
  wiki: "Wiki activity",
  posts: "Posts",
  cards: "Card activity",
  streak: "Streak bonus",
  boost: "Dividend boost",
};

const toDirection = (filter: Filter) => (filter === "all" ? undefined : filter);

/** `rows` followed by `more`, each id once (a new transaction shifts later pages by one). */
function mergeRows(rows: StatementRow[], more: StatementRow[]): StatementRow[] {
  const known = new Set(rows.map((row) => row.id));
  return [...rows, ...more.filter((row) => !known.has(row.id))];
}

function Credits({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 tabular-nums", className)}>
      <IxCreditsSymbol aria-hidden className="h-3 w-3 shrink-0" />
      {value.toLocaleString()}
    </span>
  );
}

function DividendBreakdown({ lines }: { lines: DividendLine[] }) {
  return (
    <CollapsibleContent>
      <ul className="border-separator mt-2 space-y-1 border-l pl-3">
        {lines.map((line) => (
          <li key={line.key} className="text-footnote flex justify-between gap-4">
            <span className="text-label-secondary">{LINE_LABELS[line.key]}</span>
            <Credits value={line.amount} />
          </li>
        ))}
      </ul>
    </CollapsibleContent>
  );
}

function RowTitle({ info }: { info: RowDescription }) {
  return info.href ? (
    <Link href={info.href} className="text-label font-semibold underline-offset-4 hover:underline">
      {info.title}
    </Link>
  ) : (
    <span className="text-label font-semibold">{info.title}</span>
  );
}

function StatementRowItem({ row }: { row: StatementRow }) {
  const info = describeRow(row);
  const earned = row.credits > 0;
  return (
    <li data-row className="border-separator border-b py-3 last:border-b-0">
      <Collapsible>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p>
              <RowTitle info={info} />
            </p>
            {info.detail && <p className="text-label-secondary text-footnote">{info.detail}</p>}
            {info.lines && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="xs" className="group mt-1 -ml-2 px-2">
                  <NavArrowRight aria-hidden className="size-3 group-data-[state=open]:hidden" />
                  <NavArrowDown aria-hidden className="size-3 group-data-[state=closed]:hidden" />
                  Breakdown
                </Button>
              </CollapsibleTrigger>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p
              className={cn("text-body font-semibold", earned ? "text-green-ink" : "text-red-ink")}
            >
              {earned ? "+" : "-"}
              <Credits value={Math.abs(row.credits)} />
            </p>
            <p className="text-label-secondary text-footnote tabular-nums">
              Balance {row.balanceAfter.toLocaleString()}
            </p>
          </div>
        </div>
        {info.lines && <DividendBreakdown lines={info.lines} />}
      </Collapsible>
    </li>
  );
}

/**
 * The Wallet's bank statement: ledger rows grouped by UTC day, each with its signed amount and the
 * running balance. Pages load by offset; "Show earlier" fetches the next one.
 */
export function VaultStatement({ pageSize = 25 }: { pageSize?: number }) {
  const utils = api.useUtils();
  const [now] = useState(() => new Date());
  const [filter, setFilter] = useState<Filter>("all");
  const [earlier, setEarlier] = useState<StatementRow[]>([]);
  const [earlierHasMore, setEarlierHasMore] = useState<boolean | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const direction = toDirection(filter);
  const first = api.vault.getTransactions.useQuery({ limit: pageSize, offset: 0, direction });

  const rows = useMemo(
    () => mergeRows(first.data?.transactions ?? [], earlier),
    [first.data, earlier]
  );
  const days = useMemo(() => groupStatement(rows, now), [rows, now]);
  const hasMore = earlierHasMore ?? first.data?.hasMore ?? false;

  // Bumped on every filter change so a page still in flight for the old filter is dropped on arrival.
  const filterRun = useRef(0);

  const changeFilter = (next: Filter) => {
    filterRun.current += 1;
    setFilter(next);
    setLoadingMore(false);
    setEarlier([]);
    setEarlierHasMore(null);
    setLoadFailed(false);
  };

  const showEarlier = async () => {
    const run = filterRun.current;
    setLoadingMore(true);
    setLoadFailed(false);
    try {
      const page = await utils.vault.getTransactions.fetch({
        limit: pageSize,
        offset: rows.length,
        direction,
      });
      if (run !== filterRun.current) return;
      setEarlier((current) => mergeRows(current, page.transactions));
      setEarlierHasMore(page.hasMore);
    } catch {
      if (run === filterRun.current) setLoadFailed(true);
    } finally {
      if (run === filterRun.current) setLoadingMore(false);
    }
  };

  return (
    <Card content="data" padding="lg">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <CardTitle icon={<Wallet />}>Statement</CardTitle>
        <SegmentedControl
          aria-label="Filter the statement"
          size="sm"
          options={FILTERS}
          value={filter}
          onValueChange={changeFilter}
        />
      </div>

      {first.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="rounded-card h-12 w-full" />
          ))}
        </div>
      ) : first.isError ? (
        <p role="alert" className="text-label-secondary text-footnote py-8 text-center">
          The statement could not be loaded.
        </p>
      ) : days.length === 0 ? (
        <p className="text-label-secondary text-footnote py-8 text-center">{EMPTY[filter]}</p>
      ) : (
        <div className="space-y-4">
          {days.map((day) => (
            <section key={day.key} aria-labelledby={`statement-${day.key}`}>
              <h3 id={`statement-${day.key}`} className="text-label-secondary text-footnote mb-1">
                {day.label}
              </h3>
              <ul>
                {day.rows.map((row) => (
                  <StatementRowItem key={row.id} row={row} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {loadFailed && (
        <p role="alert" className="text-label-secondary text-footnote mt-3 text-center">
          Earlier transactions could not be loaded.
        </p>
      )}
      {hasMore && !first.isLoading && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" disabled={loadingMore} onClick={showEarlier}>
            {loadingMore ? "Loading" : "Show earlier"}
          </Button>
        </div>
      )}
    </Card>
  );
}
