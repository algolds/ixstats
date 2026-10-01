"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
import React from "react";
import {
  StatUp as TrendingUp,
  StatDown as TrendingDown,
  Activity,
  NavArrowRight as ChevronRight,
  OpenBook as BookOpen,
} from "iconoir-react";
import Link from "next/link";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import { FacetCard, FacetCardContent } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import { assetUrl } from "~/lib/base-path";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { smartNormalizeGrowthRate } from "~/lib/statecraft/growth-calculations";
import { OVERVIEW_IDENTITY_FIELDS } from "./overview-identity-fields";
import {
  extractWikiIntroHtml,
  findCoatOfArmsUrl,
  type WikiIntro,
} from "~/lib/wiki-os/adapters/ixstates/integration";
import type { CountryWithEconomicData } from "../primitives/CountryDataProvider";
import type { MyCountryMetricView } from "~/hooks/useMyCountryMetrics";

type MetricView = {
  gdp: "perCapita" | "total";
  population: "total" | "density";
  area: "km" | "mi";
};

/**
 * Inner content of the "At a Glance" overview tab: metric toggle grid, growth
 * footer, identity details & wiki introduction, and identity pills.
 */
export function OverviewTab({
  country,
  wikiIntro,
  wikiImages,
  wikiLoading,
  metricView,
  setMetricViewAction,
}: {
  country: CountryWithEconomicData;
  wikiIntro: WikiIntro | null | undefined;
  wikiImages: Array<{ title: string; url: string }> | null | undefined;
  wikiLoading: boolean;
  metricView: MetricView;
  setMetricViewAction: React.Dispatch<React.SetStateAction<MyCountryMetricView>>;
}) {
  return (
    <FacetCard className="rounded-card overflow-hidden">
      <FacetCardContent className="space-y-4 pt-4 pb-4">
        {/* ── Metrics Grid (GDP / Population / Land Area) ── */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="grid grid-cols-3 gap-2">
              <FacetCard
                variant="inset"
                padding="sm"
                className="text-left"
                onClick={() =>
                  setMetricViewAction((v: MyCountryMetricView) => ({
                    ...v,
                    gdp: v.gdp === "perCapita" ? "total" : "perCapita",
                  }))
                }
              >
                <Eyebrow className="block">
                  {metricView.gdp === "perCapita" ? "GDP per Capita" : "Total GDP"}
                </Eyebrow>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="text-label text-title-3">
                    $
                    {metricView.gdp === "perCapita"
                      ? Math.round(country.currentGdpPerCapita ?? 0).toLocaleString("en-US")
                      : Math.round(country.currentTotalGdp ?? 0).toLocaleString("en-US")}
                  </p>
                  {(() => {
                    const gdpGrowth = smartNormalizeGrowthRate(
                      country.realGDPGrowthRate || country.adjustedGdpGrowth,
                      0
                    );
                    if (gdpGrowth > 0)
                      return (
                        <span className="text-green flex items-center gap-0.5">
                          <TrendingUp className="inline-flex h-3.5 w-3.5" />
                          <span className="text-caption font-semibold">
                            +{gdpGrowth.toFixed(1)}%
                          </span>
                        </span>
                      );
                    if (gdpGrowth < 0)
                      return (
                        <span className="text-destructive flex items-center gap-0.5">
                          <TrendingDown className="inline-flex h-3.5 w-3.5" />
                          <span className="text-caption font-semibold">
                            {gdpGrowth.toFixed(1)}%
                          </span>
                        </span>
                      );
                    return <span className="text-label-secondary text-footnote">0.0%</span>;
                  })()}
                </div>
                <p className="text-label-secondary text-footnote mt-0.5">
                  {metricView.gdp === "perCapita"
                    ? `${country.economicTier || "Developing"} · $${Math.round(country.currentTotalGdp ?? 0).toLocaleString("en-US")} total`
                    : `Per capita: $${Math.round(country.currentGdpPerCapita ?? 0).toLocaleString("en-US")}`}
                </p>
              </FacetCard>
              <FacetCard
                variant="inset"
                padding="sm"
                className="text-left"
                onClick={() =>
                  setMetricViewAction((v: MyCountryMetricView) => ({
                    ...v,
                    population: v.population === "total" ? "density" : "total",
                  }))
                }
              >
                <Eyebrow className="block">
                  {metricView.population === "total" ? "Population" : "Pop. Density"}
                </Eyebrow>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="text-label text-title-3">
                    {metricView.population === "total"
                      ? Math.round(country.currentPopulation ?? 0).toLocaleString("en-US")
                      : country.populationDensity
                        ? `${Math.round(country.populationDensity).toLocaleString()} /km²`
                        : "N/A"}
                  </p>
                  {(() => {
                    const popGrowth = smartNormalizeGrowthRate(country.populationGrowthRate, 0);
                    if (popGrowth > 0)
                      return (
                        <span className="text-green flex items-center gap-0.5">
                          <TrendingUp className="inline-flex h-3.5 w-3.5" />
                          <span className="text-caption font-semibold">
                            +{popGrowth.toFixed(1)}%
                          </span>
                        </span>
                      );
                    if (popGrowth < 0)
                      return (
                        <span className="text-destructive flex items-center gap-0.5">
                          <TrendingDown className="inline-flex h-3.5 w-3.5" />
                          <span className="text-caption font-semibold">
                            {popGrowth.toFixed(1)}%
                          </span>
                        </span>
                      );
                    return <span className="text-label-secondary text-footnote">0.0%</span>;
                  })()}
                </div>
                <p className="text-label-secondary text-footnote mt-0.5">
                  {metricView.population === "total"
                    ? `Tier ${country.populationTier || "N/A"}${country.populationDensity ? ` · ${Math.round(country.populationDensity).toLocaleString()}/km²` : ""}`
                    : `Total: ${Math.round(country.currentPopulation ?? 0).toLocaleString("en-US")}`}
                </p>
              </FacetCard>
              <FacetCard
                variant="inset"
                padding="sm"
                className="text-left"
                onClick={
                  country.areaSqMi && country.landArea
                    ? () =>
                        setMetricViewAction((v: MyCountryMetricView) => ({
                          ...v,
                          area: v.area === "km" ? "mi" : "km",
                        }))
                    : undefined
                }
              >
                <Eyebrow className="block">Land Area</Eyebrow>
                <p className="text-label text-title-3 mt-0.5">
                  {metricView.area === "km"
                    ? country.landArea
                      ? `${Math.round(country.landArea).toLocaleString()} km²`
                      : "N/A"
                    : country.areaSqMi
                      ? `${Math.round(country.areaSqMi).toLocaleString()} sq mi`
                      : "N/A"}
                </p>
                <p className="text-label-secondary text-footnote mt-0.5">
                  {metricView.area === "km"
                    ? country.areaSqMi
                      ? `${Math.round(country.areaSqMi).toLocaleString()} sq mi`
                      : ""
                    : country.landArea
                      ? `${Math.round(country.landArea).toLocaleString()} km²`
                      : ""}
                </p>
              </FacetCard>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-footnote">
            Click any metric to toggle between views
          </TooltipContent>
        </Tooltip>

        {/* Growth footer */}
        <div className="border-separator text-label-secondary text-footnote flex items-center gap-4 border-t pt-2">
          <span>
            <TrendingUp className="text-label-secondary mr-1 inline h-3 w-3" />
            Max GDP Growth{" "}
            <span className="text-label font-semibold">
              {((country.maxGdpGrowthRate ?? 0) * 100).toFixed(1)}%
            </span>
            <span className="ml-1 opacity-60">({country.economicTier || "N/A"} cap)</span>
          </span>
          <span>
            <Activity className="text-label-secondary mr-1 inline h-3 w-3" />
            Local Factor{" "}
            <span
              className={cn(
                "font-semibold",
                (country.localGrowthFactor ?? 1) > 1
                  ? "text-green"
                  : (country.localGrowthFactor ?? 1) < 1
                    ? "text-destructive"
                    : "text-label"
              )}
            >
              {(((country.localGrowthFactor ?? 1) - 1) * 100).toFixed(2)}%
            </span>
          </span>
        </div>

        {/* ── Identity & Lore (inline, no collapsible wrapper) ── */}
        <div className="border-separator space-y-3 border-t pt-3">
          {country.nationalIdentity?.motto && (
            <p className="text-label-secondary text-footnote italic">
              &ldquo;{country.nationalIdentity.motto}&rdquo;
            </p>
          )}

          {/* Wiki intro + coat of arms */}
          {(() => {
            const introHtml =
              (wikiIntro ? extractWikiIntroHtml(wikiIntro) : null) ||
              country?.wikiSummary ||
              country?.description ||
              null;
            // The Editor saves the seal to Country.coatOfArms; wiki images are the fallback.
            const coatOfArmsUrl =
              assetUrl(country?.coatOfArms) ||
              findCoatOfArmsUrl(wikiImages) ||
              wikiImages?.[0]?.url ||
              null;
            const showLoadingSkeleton = wikiLoading && !introHtml;
            return introHtml || coatOfArmsUrl || showLoadingSkeleton ? (
              <div className="flex gap-3">
                {coatOfArmsUrl && (
                  <img
                    src={coatOfArmsUrl}
                    alt={`Coat of arms of ${country.name}`}
                    className="border-separator bg-fill-3 rounded-control h-20 w-auto shrink-0 border object-contain p-2"
                  />
                )}
                <div className="min-w-0 flex-1">
                  {introHtml ? (
                    <div className="space-y-2">
                      <div
                        className="text-label-secondary [&_a]:text-tint text-body line-clamp-4 leading-relaxed [&_a]:underline"
                        dangerouslySetInnerHTML={{ __html: introHtml }}
                      />
                      <div className="flex items-center pt-0.5">
                        <Link
                          href={titleToWikiOSRoute(country.wikiPageTitle || country.name)}
                          className="group/wikilink text-tint text-caption inline-flex items-center gap-2 font-semibold transition-colors hover:underline"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>Read full page</span>
                          <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/wikilink:translate-x-0.5" />
                        </Link>
                      </div>
                    </div>
                  ) : showLoadingSkeleton ? (
                    <div className="space-y-2" role="status" aria-label="Loading summary">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-4/5" />
                      <Skeleton className="h-3 w-3/5" />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null;
          })()}

          {/* Identity field pills */}
          {country.nationalIdentity &&
            (() => {
              const ni = country.nationalIdentity;
              const fields = OVERVIEW_IDENTITY_FIELDS.filter((f) => f.getValue(ni));
              if (fields.length === 0) return null;
              return (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {fields.map((f) => {
                    const FieldIcon = f.icon;
                    return (
                      <div
                        key={f.key}
                        className="border-separator bg-surface rounded-control flex items-center gap-2 border px-3 py-2"
                      >
                        <FieldIcon className={cn("h-3.5 w-3.5 shrink-0", f.color)} />
                        <div className="min-w-0">
                          <Eyebrow className="block">{f.label}</Eyebrow>
                          <p className="text-label text-caption truncate font-semibold">
                            {f.getValue(ni)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
        </div>
      </FacetCardContent>
    </FacetCard>
  );
}
