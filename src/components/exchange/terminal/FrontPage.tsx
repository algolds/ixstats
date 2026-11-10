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
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { EXCHANGE_PATHS, bondHref, companyHref } from "~/lib/exchange/routes";
import type { FrontPage as FrontPageData } from "~/lib/exchange/terminal";
import {
  ChangeLabel,
  DATA_ROW_ITEM,
  DATA_ROW_LINK,
  ExchangeIconWell,
  Figure,
  SectionTitle,
  formatSovereignFigure,
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
    <Card content="visualization" className="relative overflow-hidden">
      <TextureOverlay
        texture="chevron"
        opacity={0.025}
        className="[--facet-texture-color:var(--tint)]"
      />
      <div className="relative space-y-4 p-5 md:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <div className="flex items-center gap-2">
              <ExchangeIconWell size="sm">
                <StatsReport />
              </ExchangeIconWell>
              <p className="text-footnote text-label-secondary font-medium">
                {data.realm.name} realm index
              </p>
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
        {data.sectors.length > 0 && (
          <div className="border-separator grid grid-cols-2 gap-2.5 border-t pt-4 sm:grid-cols-4">
            {data.sectors.map((s) => (
              <Link
                key={s.sectorKey}
                href={`${EXCHANGE_PATHS.markets}?kind=funds`}
                className="bg-surface-secondary hover:bg-fill-3 rounded-row flex items-center justify-between gap-2 px-3 py-2.5 transition-colors"
              >
                <span className="text-footnote text-label truncate font-medium">{s.label}</span>
                <ChangeLabel pct={s.changePct} className="text-caption" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function SideList<T>({
  title,
  icon,
  href,
  rows,
  empty,
  row,
}: {
  title: string;
  icon: React.ReactNode;
  href?: string;
  rows: readonly T[];
  empty: string;
  row: (item: T) => React.ReactNode;
}) {
  return (
    <Card content="data" padding="md" className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle icon={icon}>{title}</SectionTitle>
        {href && (
          <Link
            href={href}
            className="text-caption text-label-secondary hover:text-tint inline-flex items-center gap-1 transition-colors"
          >
            <span>All</span>
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-footnote text-label-secondary py-2">{empty}</p>
      ) : (
        <ul className="divide-separator divide-y">{rows.map(row)}</ul>
      )}
    </Card>
  );
}

function SideColumn({ data }: { data: FrontPageData }) {
  return (
    <div className="space-y-4">
      <SideList
        title="Sectors"
        icon={<StatsReport />}
        href={`${EXCHANGE_PATHS.markets}?kind=funds`}
        rows={data.sectors}
        empty="No sector data yet"
        row={(s) => (
          <li key={s.sectorKey} data-row className={DATA_ROW_ITEM}>
            <span className="flex min-w-0 items-center gap-2.5">
              <ExchangeIconWell size="sm">{sectorIcon(s.sectorKey)}</ExchangeIconWell>
              <span className="truncate font-medium">{s.label}</span>
            </span>
            <ChangeLabel pct={s.changePct} />
          </li>
        )}
      />
      <SideList
        title="Movers"
        icon={<StatUp />}
        href={`${EXCHANGE_PATHS.markets}?kind=companies`}
        rows={data.movers}
        empty="Nothing has moved yet"
        row={(m) => (
          <li key={m.companyId}>
            <Link href={companyHref(m.companyId)} data-row className={DATA_ROW_LINK}>
              <span className="flex min-w-0 items-center gap-2.5">
                <ExchangeIconWell size="sm">
                  <Building />
                </ExchangeIconWell>
                <span className="min-w-0">
                  <span className="text-label block truncate font-medium">{m.name}</span>
                  <span className="text-caption text-label-secondary block tabular-nums">
                    ₷{formatSovereignFigure(m.price)}
                  </span>
                </span>
              </span>
              <ChangeLabel pct={m.changePct} />
            </Link>
          </li>
        )}
      />
      <SideList
        title="Nation bonds"
        icon={<Coins />}
        href={`${EXCHANGE_PATHS.markets}?kind=bonds`}
        rows={data.bonds}
        empty="No bonds on the board yet"
        row={(b) => (
          <li key={b.bondId}>
            <Link href={bondHref(b.bondId)} data-row className={DATA_ROW_LINK}>
              <span className="flex min-w-0 items-center gap-2.5">
                <ExchangeIconWell size="sm">
                  <Coins />
                </ExchangeIconWell>
                <span className="truncate font-medium">
                  {b.nation} {b.termWeeks}w · {b.rating}
                </span>
              </span>
              <span className="font-semibold tabular-nums">{pct(b.yield)}</span>
            </Link>
          </li>
        )}
      />
      <Card padding="md" className="space-y-2.5">
        <SectionTitle icon={<Activity />}>Live activity</SectionTitle>
        <NewsList items={data.activity} emphasis="compact" empty="Nothing has traded yet" />
      </Card>
    </div>
  );
}

/** The front page (mockup B): the realm index, Today in business, and the market at a glance. */
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
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <IndexCard data={data} />
        <Card padding="lg" className="space-y-3">
          <SectionTitle icon={<Journal />}>Today in business</SectionTitle>
          <NewsList items={data.news} emphasis="headline" empty="No stories yet" />
        </Card>
      </div>
      <SideColumn data={data} />
    </div>
  );
}
