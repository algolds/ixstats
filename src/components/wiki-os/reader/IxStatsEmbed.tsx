// @ts-nocheck — Suppressed due to Zod v4 extended type inference gaps
// src/components/wiki-os/reader/IxStatsEmbed.tsx
// Inline IxStats country data card for wiki articles.
// Shows key metrics (GDP, population, economic tier) in a glass-physics card.

"use client";

import { api } from "~/trpc/react";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { IxTime } from "~/lib/ixtime";

interface IxStatsEmbedProps {
  /** Country ID from IxStats database */
  countryId: string;
  /** Compact mode (single row) vs full card */
  compact?: boolean;
}

export function IxStatsEmbed({ countryId, compact = false }: IxStatsEmbedProps) {
  const { data, isLoading } = api.countries.getMapSummary.useQuery(
    { countryId },
    { staleTime: 30 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <div className="wikios-ixstats-embed wikios-ixstats-embed--loading">
        <div className="wikios-loading-spinner" style={{ width: 16, height: 16 }} />
      </div>
    );
  }

  if (!data) return null;

  const gameYear = IxTime.getCurrentGameYear();

  if (compact) {
    return (
      <span className="wikios-ixstats-inline">
        <Link href={withBasePath(`/countries/${countryId}`)} className="wikios-ixstats-inline-link">
          {data.name}
        </Link>
        {" — "}
        Pop: {formatNumber(data.population)} | GDP/c: ${formatNumber(data.gdpPerCapita)} | Tier:{" "}
        {data.economicTier}
        <span className="wikios-ixstats-year">({gameYear})</span>
      </span>
    );
  }

  return (
    <div className="wikios-ixstats-embed glass-hierarchy-child">
      <div className="wikios-ixstats-header">
        {data.flagUrl && (
          <img src={data.flagUrl} alt="" className="wikios-ixstats-flag" loading="lazy" />
        )}
        <div>
          <Link href={withBasePath(`/countries/${countryId}`)} className="wikios-ixstats-name">
            {data.name}
          </Link>
          <div className="wikios-ixstats-subtitle">
            {data.continent} · {data.governmentType || "Government"}
          </div>
        </div>
      </div>

      <div className="wikios-ixstats-grid">
        <StatCell label="Population" value={formatNumber(data.population)} />
        <StatCell label="GDP per Capita" value={`$${formatNumber(data.gdpPerCapita)}`} />
        <StatCell label="Total GDP" value={`$${formatNumber(data.totalGdp)}`} />
        <StatCell label="GDP Growth" value={`${(data.gdpGrowth * 100).toFixed(1)}%`} />
        <StatCell label="Land Area" value={`${Math.round(data.landArea).toLocaleString()} km²`} />
        <StatCell label="Economic Tier" value={data.economicTier} />
      </div>

      <div className="wikios-ixstats-footer">
        <span>IxStats data as of {gameYear}</span>
        <Link href={withBasePath(`/countries/${countryId}`)} className="wikios-ixstats-viewmore">
          View full profile →
        </Link>
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="wikios-ixstats-cell">
      <div className="wikios-ixstats-cell-label">{label}</div>
      <div className="wikios-ixstats-cell-value">{value}</div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
