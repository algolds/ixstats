"use client";

import Link from "next/link";
import { Building, Crown, Trophy } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { companyHref, nationHref } from "~/lib/exchange/routes";
import { cn } from "~/lib/utils";
import {
  DATA_ROW_ITEM,
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
    <span className="text-label-secondary flex size-7 shrink-0 items-center justify-center font-semibold tabular-nums">
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
  rows: { key: string; label: React.ReactNode; value: number; note?: string }[];
}) {
  return (
    <Card content="data" padding="md" className="relative space-y-3 overflow-hidden">
      <TextureOverlay
        texture="chevron"
        opacity={0.02}
        className="[--facet-texture-color:var(--tint)]"
      />
      <div className="relative flex items-center justify-between gap-2">
        <SectionTitle icon={icon}>{title}</SectionTitle>
        <Badge variant="secondary" className="tabular-nums">
          Top {rows.length}
        </Badge>
      </div>
      {rows.length === 0 ? (
        <p className="text-footnote text-label-secondary relative py-4">
          Nobody on this board yet.
        </p>
      ) : (
        <ol className="divide-separator relative divide-y">
          {rows.map((r, i) => (
            <li key={r.key} data-row className={DATA_ROW_ITEM}>
              <RankBadge rank={i + 1} />
              <span className="min-w-0 flex-1 truncate font-medium">{r.label}</span>
              {r.note && <Badge variant="secondary">{r.note}</Badge>}
              <Figure value={`₷${formatSovereignFigure(r.value)}`} />
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** The realm's biggest companies, richest treasuries and largest portfolios. */
export function LeaderboardsPage({ realmId }: { realmId: string }) {
  const { data, isLoading } = api.exchange.leaderboards.useQuery({ realmId });
  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <Board
        title="Companies by market cap"
        icon={<Building />}
        rows={data.companies.map((c) => ({
          key: c.id,
          label: (
            <Link href={companyHref(c.id)} className="hover:text-tint transition-colors">
              {c.name}
            </Link>
          ),
          value: c.marketCap,
        }))}
      />
      <Board
        title="Nations by treasury"
        icon={<Crown />}
        rows={data.nations.map((n) => ({
          key: n.id,
          label: (
            <Link href={nationHref(n.id)} className="hover:text-tint transition-colors">
              {n.name}
            </Link>
          ),
          value: n.balance,
          note: n.rating,
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
