"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import { bondHref, companyHref } from "~/lib/exchange/routes";
import type { FrontPage as FrontPageData } from "~/lib/exchange/terminal";
import { ChangeLabel, Figure, SectionTitle, formatSovereignFigure } from "./brand";
import { IndexChart, RANGES, pointsIn, rangeOf, type Range } from "./IndexChart";
import { NewsList } from "./NewsList";

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

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
    <Card content="visualization" padding="lg" className="space-y-3">
      <div>
        <p className="text-footnote text-label-secondary">{data.realm.name} realm index</p>
        <Figure size="hero" value={formatSovereignFigure(data.index.value)} />
        {data.index.changePct !== null && (
          <p className="text-footnote">
            <ChangeLabel pct={data.index.changePct} />{" "}
            <span className="text-label-secondary">today</span>
          </p>
        )}
      </div>
      <IndexChart series={pointsIn(data.index.series, range)} />
      <SegmentedControl
        size="sm"
        aria-label="Time range"
        value={range}
        onValueChange={setRange}
        options={RANGES.map((r) => ({ value: r, label: r }))}
      />
    </Card>
  );
}

function SideList<T>({
  title,
  rows,
  empty,
  row,
}: {
  title: string;
  rows: readonly T[];
  empty: string;
  row: (item: T) => React.ReactNode;
}) {
  return (
    <Card content="data" padding="md" className="space-y-2">
      <SectionTitle>{title}</SectionTitle>
      {rows.length === 0 ? (
        <p className="text-footnote text-label-secondary">{empty}</p>
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
        rows={data.sectors}
        empty="No sector data yet"
        row={(s) => (
          <li key={s.sectorKey} className="text-footnote flex justify-between py-1.5">
            <span>{s.label}</span>
            <ChangeLabel pct={s.changePct} />
          </li>
        )}
      />
      <SideList
        title="Movers"
        rows={data.movers}
        empty="Nothing has moved yet"
        row={(m) => (
          <li key={m.companyId}>
            <Link
              href={companyHref(m.companyId)}
              className="text-footnote hover:text-tint flex justify-between py-1.5"
            >
              <span className="truncate">{m.name}</span>
              <ChangeLabel pct={m.changePct} />
            </Link>
          </li>
        )}
      />
      <SideList
        title="Nation bonds"
        rows={data.bonds}
        empty="No bonds on the board yet"
        row={(b) => (
          <li key={b.bondId}>
            <Link
              href={bondHref(b.bondId)}
              className="text-footnote hover:text-tint flex justify-between py-1.5"
            >
              <span className="truncate">
                {b.nation} {b.termWeeks}w · {b.rating}
              </span>
              <span className="tabular-nums">{pct(b.yield)}</span>
            </Link>
          </li>
        )}
      />
      <Card content="feed" padding="md" className="space-y-2">
        <SectionTitle>Live activity</SectionTitle>
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
        <Card content="feed" padding="lg" className="space-y-2">
          <SectionTitle>Today in business</SectionTitle>
          <NewsList items={data.news} emphasis="headline" empty="No stories yet" />
        </Card>
      </div>
      <SideColumn data={data} />
    </div>
  );
}
