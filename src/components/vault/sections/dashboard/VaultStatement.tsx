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
      <ul className="border-separator mb-2 ml-9 space-y-1 border-l pl-3">
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

/** Where the credits came from, as a tinted icon in a small well. */
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

/** One compact data row: icon, description with its detail, the signed amount and the running balance. */
function StatementRowItem({ row }: { row: StatementRow }) {
  const info = describeRow(row);
  const earned = row.credits > 0;
  return (
    <li data-row className="border-separator border-t first:border-t-0">
      <Collapsible>
        <div className="flex min-h-9 items-center gap-3 py-1">
          <RowIcon row={row} />
          <div className="text-callout min-w-0 flex-1 truncate">
            <RowTitle info={info} />
            {info.detail && (
              <span className="text-label-secondary text-footnote ml-2">{info.detail}</span>
            )}
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
          <div className="flex shrink-0 flex-col items-end sm:flex-row sm:items-center sm:gap-3">
            <span
              className={cn("text-callout text-right", earned ? "text-success-ink" : "text-label")}
            >
              {earned ? "+" : "-"}
              <Credits value={Math.abs(row.credits)} />
            </span>
            <span
              data-slot="statement-balance"
              className="text-label-secondary text-footnote text-right tabular-nums sm:w-24"
            >
              {formatAmount(row.balanceAfter)}
            </span>
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
export function VaultStatement({ pageSize = 10 }: { pageSize?: number }) {
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
    <Card content="data" padding="md">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
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
        <div className="space-y-1">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="rounded-row h-9 w-full" />
          ))}
        </div>
      ) : first.isError ? (
        <p role="alert" className="text-label-secondary text-footnote py-8 text-center">
          The statement could not be loaded.
        </p>
      ) : days.length === 0 ? (
        <p className="text-label-secondary text-footnote py-8 text-center">{EMPTY[filter]}</p>
      ) : (
        <div className="space-y-2">
          {days.map((day) => (
            <section key={day.key} aria-labelledby={`statement-${day.key}`}>
              <h3 id={`statement-${day.key}`} className="text-label-secondary text-caption pt-1">
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
        <div className="mt-3 flex justify-center">
          <Button variant="ghost" size="sm" disabled={loadingMore} onClick={showEarlier}>
            {loadingMore ? "Loading" : "Show earlier"}
          </Button>
        </div>
      )}
    </Card>
  );
}
