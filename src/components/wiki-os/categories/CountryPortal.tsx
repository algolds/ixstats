"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import {
  OpenNewWindow as ExternalLink,
  GraphUp as TrendingUp,
  Group as Users,
  Coins,
  Page as FileText,
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
  imageUrl?: string | null;
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

import { formatNumber, formatCurrency } from "~/lib/utils/format-utils";

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
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-16 select-none">
      {/* ── Apple-Grade Masthead Card ── */}
      <div className="material-hero text-label relative isolate overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-start gap-5 sm:items-center">
            {country.flagUrl ? (
              <img
                src={country.flagUrl}
                alt=""
                className="border-separator rounded-card shadow-card h-14 w-22 shrink-0 border object-cover sm:h-16 sm:w-26"
              />
            ) : (
              <div className="bg-fill-3 border-separator rounded-card flex h-16 w-16 shrink-0 items-center justify-center border">
                <FileText className="text-label-secondary h-7 w-7" />
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Link
                  href={withBasePath("/wiki/categories")}
                  className="border-green/20 bg-green/10 text-caption text-green hover:bg-green/15 inline-flex items-center gap-2 rounded-full border px-3 py-0.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]"
                >
                  <span>Nations</span>
                </Link>
                {country.economicTier && (
                  <span className="bg-fill-2 text-label-secondary border-separator text-caption rounded-full border px-3 py-0.5 font-semibold">
                    {country.economicTier}
                  </span>
                )}
              </div>
              <h1 className="text-label font-brand text-title-1 sm:text-large-title">
                {country.name}
              </h1>
            </div>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href={withBasePath(`/wiki/${slug}`)}
              className="border-separator text-label rounded-row bg-surface text-caption shadow-card hover:border-tint/40 hover:bg-surface inline-flex items-center gap-2 border px-4 py-2 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
            >
              <ExternalLink className="text-tint h-3.5 w-3.5" />
              <span>Wiki Article</span>
            </Link>

            <Link
              href={withBasePath(`/countries/${country.slug ?? country.id}`)}
              className="rounded-row bg-tint text-caption text-on-tint shadow-card hover:bg-tint inline-flex items-center gap-2 px-4 py-2 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>National Dashboard</span>
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
                    className="wikios-portal-card group"
                  >
                    {m.imageUrl ? (
                      <img
                        src={m.imageUrl}
                        alt=""
                        className="wikios-portal-card-img"
                        loading="lazy"
                      />
                    ) : (
                      <FileText className="h-3.5 w-3.5 shrink-0 opacity-40" />
                    )}
                    <span className="wikios-portal-card-title">{m.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column (sidebar) */}
        <div className="wikios-portal-sidebar">
          {/* Map */}
          <div className="wikios-portal-map rounded-card border-separator bg-surface border">
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
            <div className="wikios-portal-blurbs rounded-card border-separator bg-surface border">
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

function VitalityCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | null;
  color: string;
}) {
  return (
    <div className="wikios-portal-vitality-card rounded-card border-separator bg-surface border">
      <span className="wikios-portal-vitality-value" style={{ color }}>
        {value === null ? "—" : Math.round(value)}
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
    <div className="wikios-portal-metric rounded-row border-separator bg-surface border">
      <div className="wikios-portal-metric-icon">{icon}</div>
      <div>
        <div className="wikios-portal-metric-value">{value}</div>
        <div className="wikios-portal-metric-label">{label}</div>
      </div>
    </div>
  );
}
