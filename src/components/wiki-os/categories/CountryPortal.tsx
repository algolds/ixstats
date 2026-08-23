"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { Badge } from "~/components/ui/badge";
import {
  OpenNewWindow as ExternalLink,
  GraphUp as TrendingUp,
  Group as Users,
  Coins,
  GraphUp as BarChart3,
} from "iconoir-react";

const CountryMapEmbed = dynamic(
  () =>
    import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({
      default: m.CountryMapEmbed,
    })),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: 220, background: "rgba(255,255,255,0.02)", borderRadius: 8 }} />
    ),
  }
);

interface CategoryMember {
  title: string;
  ns: number;
}

interface CountryPortalProps {
  country: {
    id: string;
    name: string;
    slug?: string | null;
    flagUrl?: string | null;
    economicTier?: string | null;
  };
  subcategories: CategoryMember[];
  pages: CategoryMember[];
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function formatCurrency(n: number): string {
  return `$${formatNumber(n)}`;
}

export function CountryPortal({ country, subcategories, pages }: CountryPortalProps) {
  const { data: summary } = api.mycountry.getNationalSummary.useQuery(
    { countryId: country.id },
    { staleTime: 3 * 60 * 1000 }
  );

  const { data: blurbData } = api.blurbs.getResponsesForCountry.useInfiniteQuery(
    { countryId: country.id, limit: 3 },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );

  const blurbs = blurbData?.pages.flatMap((p) => p.responses) ?? [];
  const vitality = summary?.vitalityScores;
  const metrics = summary?.keyMetrics;
  const growth = summary?.growthRates;
  const slug = encodeURIComponent(country.name.replace(/ /g, "_"));

  return (
    <div className="wikios-portal">
      {/* Hero */}
      <div className="wikios-portal-hero">
        {country.flagUrl && <img src={country.flagUrl} alt="" className="wikios-portal-flag" />}
        <div className="wikios-portal-hero-text">
          <h1 className="wikios-portal-hero-name">{country.name}</h1>
          <div className="wikios-portal-hero-badges">
            {country.economicTier && (
              <Badge variant="secondary" className="text-[10px]">
                {country.economicTier}
              </Badge>
            )}
            <Link href={withBasePath(`/wiki/${slug}`)} className="wikios-portal-hero-link">
              <ExternalLink className="h-3 w-3" />
              Wiki article
            </Link>
            <Link
              href={withBasePath(`/countries/${country.slug ?? country.id}`)}
              className="wikios-portal-hero-link"
            >
              <BarChart3 className="h-3 w-3" />
              Full dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="wikios-portal-columns">
        {/* Left column */}
        <div className="wikios-portal-main">
          {/* Vitality scores */}
          {vitality && (
            <div className="wikios-portal-vitality">
              <VitalityCard label="Economic" value={vitality.economicVitality} color="#22c55e" />
              <VitalityCard
                label="Population"
                value={vitality.populationWellbeing}
                color="#3b82f6"
              />
              <VitalityCard
                label="Diplomatic"
                value={vitality.diplomaticStanding}
                color="#a855f7"
              />
              <VitalityCard
                label="Government"
                value={vitality.governmentalEfficiency}
                color="#f59e0b"
              />
            </div>
          )}

          {/* Key metrics */}
          {metrics && (
            <div className="wikios-portal-metrics">
              <MetricCard
                icon={<Coins className="h-3.5 w-3.5" />}
                label="GDP per Capita"
                value={formatCurrency(metrics.gdpPerCapita)}
              />
              <MetricCard
                icon={<Users className="h-3.5 w-3.5" />}
                label="Population"
                value={formatNumber(metrics.population)}
              />
              <MetricCard
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="GDP Growth"
                value={`${((growth?.economic ?? 0) * 100).toFixed(1)}%`}
              />
              <MetricCard
                icon={<Users className="h-3.5 w-3.5" />}
                label="Pop Growth"
                value={`${((growth?.population ?? 0) * 100).toFixed(2)}%`}
              />
            </div>
          )}

          {/* Subcategories */}
          {subcategories.length > 0 && (
            <div className="wikios-portal-section">
              <h2 className="wikios-portal-section-title">Topics</h2>
              <div className="wikios-portal-subcats">
                {subcategories.map((m) => {
                  const name = m.title.replace(/^Category:/, "");
                  return (
                    <Link
                      key={m.title}
                      href={withBasePath(
                        `/wiki/categories/${encodeURIComponent(name.replace(/ /g, "_"))}`
                      )}
                      className="wikios-portal-pill"
                    >
                      {name}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Articles */}
          {pages.length > 0 && (
            <div className="wikios-portal-section">
              <h2 className="wikios-portal-section-title">Articles ({pages.length})</h2>
              <div className="wikios-portal-articles">
                {pages.map((m) => (
                  <Link
                    key={m.title}
                    href={withBasePath(`/wiki/${encodeURIComponent(m.title.replace(/ /g, "_"))}`)}
                    className="wikios-portal-card"
                  >
                    {m.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column (sidebar) */}
        <div className="wikios-portal-sidebar">
          {/* Map */}
          <div className="wikios-portal-map glass-hierarchy-child">
            <CountryMapEmbed
              countryId={country.id}
              height="h-56"
              showNeighbors
              showCities
              interactive
            />
          </div>

          {/* Blurbs */}
          {blurbs.length > 0 && (
            <div className="wikios-portal-blurbs glass-hierarchy-child">
              <h3 className="wikios-portal-blurbs-title">Country Voices</h3>
              {blurbs.map((r) => (
                <Link
                  key={r.id}
                  href={withBasePath(`/blurbs/${r.prompt.slug}`)}
                  className="wikios-portal-blurb"
                >
                  <span className="wikios-portal-blurb-prompt">{r.prompt.title}</span>
                  <span className="wikios-portal-blurb-text">{r.content}</span>
                </Link>
              ))}
              <Link href={withBasePath("/blurbs")} className="wikios-portal-blurbs-more">
                All blurbs →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function VitalityCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="wikios-portal-vitality-card glass-hierarchy-child">
      <span className="wikios-portal-vitality-value" style={{ color }}>
        {Math.round(value)}
      </span>
      <span className="wikios-portal-vitality-label">{label}</span>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="wikios-portal-metric glass-hierarchy-child">
      <div className="wikios-portal-metric-icon">{icon}</div>
      <div>
        <div className="wikios-portal-metric-value">{value}</div>
        <div className="wikios-portal-metric-label">{label}</div>
      </div>
    </div>
  );
}
