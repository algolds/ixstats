"use client";

import Link from "next/link";
import { Building, Crown, Trophy } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { LensCard } from "~/components/ui/lens-card";
import { Skeleton } from "~/components/ui/skeleton";
import { companyHref, nationHref } from "~/lib/exchange/routes";
import { cn } from "~/lib/utils";
import { CreditRatingBadge } from "../shared";
import {
  DATA_ROW_ITEM,
  DATA_ROW_LINK,
  ExchangeIconWell,
  Figure,
  SectionTitle,
  formatSovereignFigure,
} from "./brand";

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <ExchangeIconWell
        size="sm"
        className={cn(
          rank === 1 && "bg-yellow/15 text-yellow",
          rank === 2 && "bg-fill-2 text-label",
          rank === 3 && "bg-orange/15 text-orange"
        )}
      >
        {rank}
      </ExchangeIconWell>
    );
  }
  return (
    <span className="facet-recess rounded-control text-label-secondary flex size-7 shrink-0 items-center justify-center font-mono text-caption font-semibold tabular-nums">
      {rank}
    </span>
  );
}

function Board({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { key: string; href?: string; label: string; value: number; rating?: string }[];
}) {
  return (
    <LensCard app="exchange" content="data" padding="md" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle icon={icon}>{title}</SectionTitle>
        <Badge variant="secondary" className="font-mono tabular-nums">
          Top {rows.length}
        </Badge>
      </div>
      {rows.length === 0 ? (
        <p className="text-footnote text-label-secondary py-4">
          Nobody on this board yet.
        </p>
      ) : (
        <ol className="divide-separator divide-y">
          {rows.map((r, i) => {
            const inner = (
              <>
                <span className="flex min-w-0 items-center gap-2.5">
                  <RankBadge rank={i + 1} />
                  <span className="min-w-0 truncate font-medium">{r.label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {r.rating && <CreditRatingBadge rating={r.rating} />}
                  <Figure value={`₷${formatSovereignFigure(r.value)}`} />
                </span>
              </>
            );
            return (
              <li key={r.key}>
                {r.href ? (
                  <Link href={r.href} data-row className={DATA_ROW_LINK}>
                    {inner}
                  </Link>
                ) : (
                  <div data-row className={DATA_ROW_ITEM}>
                    {inner}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </LensCard>
  );
}

/** The realm's biggest companies, richest treasuries and largest portfolios. */
export function LeaderboardsPage({
  realmId,
  embedded = false,
}: {
  realmId: string;
  embedded?: boolean;
}) {
  const query = api.exchange.leaderboards?.useQuery({ realmId });
  if (!query) return null;
  const { data, isLoading } = query;
  if (isLoading || !data) {
    return embedded ? null : <Skeleton className="h-64 w-full" />;
  }
  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <Board
        title="Companies by market cap"
        icon={<Building />}
        rows={data.companies.map((c) => ({
          key: c.id,
          href: companyHref(c.id),
          label: c.name,
          value: c.marketCap,
        }))}
      />
      <Board
        title="Nations by treasury"
        icon={<Crown />}
        rows={data.nations.map((n) => ({
          key: n.id,
          href: nationHref(n.id),
          label: n.name,
          value: n.balance,
          rating: n.rating,
        }))}
      />
      <Board
        title="Investors by portfolio"
        icon={<Trophy />}
        rows={data.investors.map((v) => ({ key: v.label, label: v.label, value: v.value }))}
      />
    </div>
  );
}
