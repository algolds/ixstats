"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Building,
  Coins,
  Cpu,
  Journal,
  StatUp,
  StatsReport,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { EmptyState } from "~/components/ui/empty-state";
import { LensCard } from "~/components/ui/lens-card";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import { EXCHANGE_PATHS, bondHref, companyHref } from "~/lib/exchange/routes";
import type { FrontPage as FrontPageData } from "~/lib/exchange/terminal";
import { CreditRatingBadge } from "../shared";
import {
  ChangeLabel,
  DATA_ROW_LINK,
  ExchangeIconWell,
  Figure,
  SectionTitle,
  TickerTile,
  formatSovereignFigure,
  symbolOf,
  toneOf,
} from "./brand";
import { IndexChart, RANGES, pointsIn, rangeOf, type Range } from "./IndexChart";
import { NewsList } from "./NewsList";

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

function sectorIcon(sectorKey: string) {
  if (sectorKey === "finance") return <Coins />;
  if (sectorKey === "industry") return <Building />;
  if (sectorKey === "technology") return <Cpu />;
  return <StatsReport />;
}

function IndexCard({ data }: { data: FrontPageData }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const range = rangeOf(params.get("range"));
  const setRange = (next: Range) => {
    const query = new URLSearchParams(params.toString());
    query.set("range", next);
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  };
  return (
    <LensCard app="exchange" content="visualization" padding="none" className="overflow-hidden">
      <div className="space-y-4 p-5 md:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ExchangeIconWell size="sm">
                <StatsReport />
              </ExchangeIconWell>
              <p className="text-footnote text-label-secondary font-medium">
                {data.realm.name} realm index
              </p>
              <Badge variant="outline" className="font-mono tabular-nums">
                ₷ composite
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <Figure size="hero" value={formatSovereignFigure(data.index.value)} />
              {data.index.changePct !== null && (
                <p className="text-footnote">
                  <ChangeLabel pct={data.index.changePct} />{" "}
                  <span className="text-label-secondary">today</span>
                </p>
              )}
            </div>
          </div>
          <SegmentedControl
            size="sm"
            aria-label="Time range"
            value={range}
            onValueChange={setRange}
            options={RANGES.map((r) => ({ value: r, label: r }))}
            className="w-full sm:w-auto"
          />
        </div>
        <IndexChart series={pointsIn(data.index.series, range)} height={196} />
      </div>
      {data.sectors.length > 0 && (
        <div className="border-separator divide-separator bg-surface-secondary/60 grid grid-cols-2 divide-x border-t sm:grid-cols-4">
          {data.sectors.map((s) => (
            <Link
              key={s.sectorKey}
              href={`${EXCHANGE_PATHS.markets}?kind=funds`}
              className="hover:bg-fill-4 flex items-center justify-between gap-2 px-4 py-3 transition-colors"
            >
              <span className="flex min-w-0 items-center gap-2">
                <ExchangeIconWell size="sm">{sectorIcon(s.sectorKey)}</ExchangeIconWell>
                <span className="text-footnote text-label truncate font-medium">{s.label}</span>
              </span>
              <ChangeLabel pct={s.changePct} className="text-caption" />
            </Link>
          ))}
        </div>
      )}
    </LensCard>
  );
}

/** Consolidated market pulse rail: Movers, Nation bonds and Live activity in one cohesive card. */
function MarketPulseRail({ data }: { data: FrontPageData }) {
  return (
    <LensCard app="exchange" content="data" padding="md" className="space-y-4 lg:col-span-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <SectionTitle icon={<StatUp />}>Movers</SectionTitle>
          <Link
            href={`${EXCHANGE_PATHS.markets}?kind=companies`}
            className="text-caption text-label-secondary hover:text-tint inline-flex items-center gap-1 transition-colors"
          >
            <span>All</span>
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        </div>
        {data.movers.length === 0 ? (
          <p className="text-footnote text-label-secondary py-1">Nothing has moved yet</p>
        ) : (
          <ul className="divide-separator divide-y">
            {data.movers.map((m) => {
              const moveTone =
                toneOf(m.changePct) === "gain"
                  ? "gain"
                  : toneOf(m.changePct) === "loss"
                    ? "loss"
                    : "tint";
              return (
                <li key={m.companyId}>
                  <Link href={companyHref(m.companyId)} data-row className={DATA_ROW_LINK}>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <TickerTile code={symbolOf(m.name)} tone={moveTone} />
                      <span className="min-w-0">
                        <span className="text-label block truncate font-medium">{m.name}</span>
                        <span className="text-caption text-label-secondary block font-mono tabular-nums">
                          ₷{formatSovereignFigure(m.price)}
                        </span>
                      </span>
                    </span>
                    <ChangeLabel pct={m.changePct} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-separator space-y-2 border-t pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <SectionTitle icon={<Coins />}>Nation bonds</SectionTitle>
          <Link
            href={`${EXCHANGE_PATHS.markets}?kind=bonds`}
            className="text-caption text-label-secondary hover:text-tint inline-flex items-center gap-1 transition-colors"
          >
            <span>All</span>
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        </div>
        {data.bonds.length === 0 ? (
          <p className="text-footnote text-label-secondary py-1">No bonds on the board yet</p>
        ) : (
          <ul className="divide-separator divide-y">
            {data.bonds.map((b) => (
              <li key={b.bondId}>
                <Link href={bondHref(b.bondId)} data-row className={DATA_ROW_LINK}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <TickerTile code={`${b.termWeeks}W`} tone="neutral" />
                    <span className="min-w-0">
                      <span className="text-label block truncate font-medium">
                        {b.nation} {b.termWeeks}w · {b.rating}
                      </span>
                      <span className="text-caption text-label-secondary block">
                        Sovereign yield
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <CreditRatingBadge rating={b.rating} />
                    <span className="font-mono font-semibold tabular-nums">{pct(b.yield)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-separator space-y-2 border-t pt-3.5">
        <SectionTitle icon={<Activity />}>Live activity</SectionTitle>
        <NewsList items={data.activity} emphasis="compact" empty="Nothing has traded yet" />
      </div>
    </LensCard>
  );
}

/** The front page (mockup B): the realm index, Today in business, market pulse and realm leaderboards. */
export function FrontPage({ realmId }: { realmId: string }) {
  const { data, isLoading, error } = api.exchange.frontPage.useQuery({ realmId });
  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!data)
    return (
      <EmptyState
        title="The Exchange didn't load"
        message={error?.message ?? "Try again in a moment."}
      />
    );
  return (
    <div className="grid items-start gap-4 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-8">
        <IndexCard data={data} />
        <LensCard app="exchange" padding="lg" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle icon={<Journal />}>Today in business</SectionTitle>
            {data.news.length > 0 && (
              <Badge variant="secondary" className="tabular-nums">
                {data.news.length}
              </Badge>
            )}
          </div>
          <NewsList items={data.news} emphasis="headline" empty="No stories yet" />
        </LensCard>
      </div>
      <MarketPulseRail data={data} />
    </div>
  );
}
