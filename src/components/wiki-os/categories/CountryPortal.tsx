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
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-16 select-none">
      {/* ── Apple-Grade Masthead Card ── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/70 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_6px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl sm:p-8 dark:border-white/10 dark:bg-zinc-900/70 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-start gap-5 sm:items-center">
            {country.flagUrl ? (
              <img
                src={country.flagUrl}
                alt=""
                className="border-border/80 h-14 w-22 shrink-0 rounded-2xl border object-cover shadow-md sm:h-16 sm:w-26"
              />
            ) : (
              <div className="bg-muted border-border flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border">
                <FileText className="text-muted-foreground h-7 w-7" />
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Link
                  href={withBasePath("/wiki/categories")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 transition-all hover:bg-emerald-500/15 dark:text-emerald-400"
                >
                  <span>Nations</span>
                </Link>
                {country.economicTier && (
                  <span className="bg-muted/80 text-muted-foreground border-border/60 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold">
                    {country.economicTier}
                  </span>
                )}
              </div>
              <h1 className="text-foreground font-brand text-2xl font-bold tracking-tight sm:text-4xl">
                {country.name}
              </h1>
            </div>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <Link
              href={withBasePath(`/wiki/${slug}`)}
              className="border-border/60 text-foreground inline-flex items-center gap-2 rounded-xl border bg-white/60 px-3.5 py-2 text-xs font-semibold shadow-sm backdrop-blur-sm transition-all hover:border-blue-500/40 hover:bg-white/90 active:scale-[0.97] dark:bg-zinc-800/60 dark:hover:bg-zinc-800/90"
            >
              <ExternalLink className="h-3.5 w-3.5 text-blue-500" />
              <span>Wiki Article</span>
            </Link>

            <Link
              href={withBasePath(`/countries/${country.slug ?? country.id}`)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-500 active:scale-[0.97]"
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
          <div className="wikios-portal-map facet-hierarchy-child">
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
            <div className="wikios-portal-blurbs facet-hierarchy-child">
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
    <div className="wikios-portal-vitality-card facet-hierarchy-child">
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
    <div className="wikios-portal-metric facet-hierarchy-child">
      <div className="wikios-portal-metric-icon">{icon}</div>
      <div>
        <div className="wikios-portal-metric-value">{value}</div>
        <div className="wikios-portal-metric-label">{label}</div>
      </div>
    </div>
  );
}
