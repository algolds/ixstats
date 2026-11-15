"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Cart,
  Coins,
  DataTransferBoth,
  Gift,
  Medal,
  NavArrowDown,
  NavArrowRight,
  Package,
  ShoppingBag,
  Trophy,
  Wallet,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";
import { IconWell } from "./IconWell";
import {
  describeRow,
  formatAmount,
  groupStatement,
  rowIconKey,
  type RowDescription,
  type RowIconKey,
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

const ROW_ICONS: Record<RowIconKey, React.ComponentType> = {
  dividend: Coins,
  daily: Gift,
  achievement: Trophy,
  loreward: Medal,
  pack: Package,
  store: ShoppingBag,
  market: Cart,
  trade: DataTransferBoth,
  other: Wallet,
};

const toDirection = (filter: Filter) => (filter === "all" ? undefined : filter);

function formatRowUtcTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "00:00 UTC";
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes} UTC`;
}

/** `rows` followed by `more`, each id once (a new transaction shifts later pages by one). */
function mergeRows(rows: StatementRow[], more: StatementRow[]): StatementRow[] {
  const known = new Set(rows.map((row) => row.id));
  return [...rows, ...more.filter((row) => !known.has(row.id))];
}

function Credits({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 tabular-nums", className)}>
      <IxCreditsSymbol aria-hidden className="h-3 w-3 shrink-0" />
      {formatAmount(value)}
    </span>
  );
}

function DividendBreakdown({ lines }: { lines: DividendLine[] }) {
  return (
    <CollapsibleContent>
      <ul className="border-separator mb-2.5 ml-9 space-y-1 border-l pl-3">
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

function RowIcon({ row }: { row: StatementRow }) {
  const key = rowIconKey(row);
  const Icon = ROW_ICONS[key];
  return (
    <IconWell data-slot="statement-icon" data-icon={key}>
      <Icon />
    </IconWell>
  );
}

function RowTitle({ info }: { info: RowDescription }) {
  return info.href ? (
    <Link href={info.href} className="text-label underline-offset-4 hover:underline">
      {info.title}
    </Link>
  ) : (
    <span className="text-label">{info.title}</span>
  );
}

/**
 * Bank statement row: leading source icon outside an inset `border-separator` hairline,
 * description + detail, and right-aligned tabular amount, balance, and UTC timestamp.
 */
function StatementRowItem({ row }: { row: StatementRow }) {
  const info = describeRow(row);
  const earned = row.credits > 0;
  const timestamp = formatRowUtcTime(row.createdAt);

  return (
    <li data-row className="group/statement-row px-4 md:px-5">
      <Collapsible>
        <div className="flex items-center gap-3">
          <RowIcon row={row} />
          <div className="border-separator flex min-h-11 min-w-0 flex-1 items-center gap-3 border-t py-2.5 group-first/statement-row:border-t-0">
            <div className="min-w-0 flex-1">
              <div className="text-callout truncate">
                <RowTitle info={info} />
              </div>
              <div className="text-footnote text-label-secondary flex flex-wrap items-center gap-x-1.5 truncate tabular-nums">
                <time dateTime={new Date(row.createdAt).toISOString()}>{timestamp}</time>
                {info.detail && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="truncate">{info.detail}</span>
                  </>
                )}
              </div>
            </div>

            {info.lines && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="xs" className="group shrink-0 px-2">
                  <NavArrowRight aria-hidden className="size-3 group-data-[state=open]:hidden" />
                  <NavArrowDown aria-hidden className="size-3 group-data-[state=closed]:hidden" />
                  Breakdown
                </Button>
              </CollapsibleTrigger>
            )}

            <div className="flex shrink-0 flex-col items-end tabular-nums">
              <span
                className={cn(
                  "text-callout text-right font-medium tabular-nums",
                  earned ? "text-success-ink" : "text-label"
                )}
              >
                {earned ? "+" : "-"}
                <Credits value={Math.abs(row.credits)} />
              </span>
              <span
                data-slot="statement-balance"
                className="text-label-secondary text-footnote text-right tabular-nums"
              >
                {formatAmount(row.balanceAfter)}
              </span>
            </div>
          </div>
        </div>
        {info.lines && <DividendBreakdown lines={info.lines} />}
      </Collapsible>
    </li>
  );
}

interface StatementPageState {
  earlier: StatementRow[];
  earlierHasMore: boolean | null;
  loadingMore: boolean;
  loadFailed: boolean;
}

const INITIAL_PAGE_STATE: StatementPageState = {
  earlier: [],
  earlierHasMore: null,
  loadingMore: false,
  loadFailed: false,
};

/**
 * Full-width Wallet bank statement: ledger rows grouped by UTC day inside a flush `data` pane,
 * with filter pills, inset `border-separator` hairlines, source icons, and right-aligned figures.
 */
export function VaultStatement({ pageSize = 10 }: { pageSize?: number }) {
  const utils = api.useUtils();
  const [now] = useState(() => new Date());
  const [filter, setFilter] = useState<Filter>("all");
  const [pageState, setPageState] = useState<StatementPageState>(INITIAL_PAGE_STATE);
  const { earlier, earlierHasMore, loadingMore, loadFailed } = pageState;

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
    setPageState(INITIAL_PAGE_STATE);
  };

  const showEarlier = async () => {
    const run = filterRun.current;
    setPageState((prev) => ({ ...prev, loadingMore: true, loadFailed: false }));
    try {
      const page = await utils.vault.getTransactions.fetch({
        limit: pageSize,
        offset: rows.length,
        direction,
      });
      if (run !== filterRun.current) return;
      setPageState((prev) => ({
        ...prev,
        earlier: mergeRows(prev.earlier, page.transactions),
        earlierHasMore: page.hasMore,
      }));
    } catch {
      if (run === filterRun.current) {
        setPageState((prev) => ({ ...prev, loadFailed: true }));
      }
    } finally {
      if (run === filterRun.current) {
        setPageState((prev) => ({ ...prev, loadingMore: false }));
      }
    }
  };

  return (
    <Card content="data" padding="none" data-slot="vault-statement" className="overflow-hidden">
      <div className="border-separator flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5 md:px-5">
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
        <div className="space-y-2 p-4 md:p-5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="rounded-row h-11 w-full" />
          ))}
        </div>
      ) : first.isError ? (
        <p role="alert" className="text-label-secondary text-footnote px-4 py-8 text-center">
          The statement could not be loaded.
        </p>
      ) : days.length === 0 ? (
        <p className="text-label-secondary text-footnote px-4 py-8 text-center">{EMPTY[filter]}</p>
      ) : (
        <div className="divide-separator divide-y">
          {days.map((day) => (
            <section key={day.key} aria-labelledby={`statement-${day.key}`} className="py-1">
              <h3
                id={`statement-${day.key}`}
                className="text-label-secondary text-caption px-4 pt-2.5 pb-1 font-medium md:px-5"
              >
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

      {(loadFailed || (hasMore && !first.isLoading)) && (
        <div className="border-separator space-y-2 border-t px-4 py-3 md:px-5">
          {loadFailed && (
            <p role="alert" className="text-label-secondary text-footnote text-center">
              Earlier transactions could not be loaded.
            </p>
          )}
          {hasMore && !first.isLoading && (
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" disabled={loadingMore} onClick={showEarlier}>
                {loadingMore ? "Loading" : "Show earlier"}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
