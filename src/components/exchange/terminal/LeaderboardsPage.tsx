"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { companyHref, nationHref } from "~/lib/exchange/routes";
import { Figure, SectionTitle, formatSovereignFigure } from "./brand";

function Board({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: React.ReactNode; value: number; note?: string }[];
}) {
  return (
    <Card content="data" padding="md" className="space-y-2">
      <SectionTitle>{title}</SectionTitle>
      {rows.length === 0 ? (
        <p className="text-footnote text-label-secondary">Nobody on this board yet.</p>
      ) : (
        <ol className="divide-separator divide-y">
          {rows.map((r, i) => (
            <li key={r.key} className="text-footnote flex items-center gap-3 py-2">
              <span className="text-label-secondary w-5 tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
              {r.note && <span className="text-label-secondary">{r.note}</span>}
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
        rows={data.companies.map((c) => ({
          key: c.id,
          label: (
            <Link href={companyHref(c.id)} className="hover:text-tint">
              {c.name}
            </Link>
          ),
          value: c.marketCap,
        }))}
      />
      <Board
        title="Nations by treasury"
        rows={data.nations.map((n) => ({
          key: n.id,
          label: (
            <Link href={nationHref(n.id)} className="hover:text-tint">
              {n.name}
            </Link>
          ),
          value: n.balance,
          note: n.rating,
        }))}
      />
      <Board
        title="Investors by portfolio"
        rows={data.investors.map((v) => ({ key: v.label, label: v.label, value: v.value }))}
      />
    </div>
  );
}
