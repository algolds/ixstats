"use client";

import React from "react";
import { TrendingUp, Activity, ChevronRight, BookOpen } from "lucide-react";
import Link from "next/link";
import { titleToWikiOSRoute } from "~/lib/wiki-os/url-compat";
import { Card, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from "~/components/ui/icons";
import { smartNormalizeGrowthRate } from "~/lib/growth-calculations";
import { OVERVIEW_IDENTITY_FIELDS } from "./overview-identity-fields";
import { extractWikiIntroHtml, findCoatOfArmsUrl, type WikiIntro } from "~/lib/wiki-integration";

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
  country: any;
  wikiIntro: unknown;
  wikiImages: Array<{ title: string; url: string }> | null | undefined;
  wikiLoading: boolean;
  metricView: MetricView;
  setMetricViewAction: React.Dispatch<React.SetStateAction<MetricView>>;
}) {
  return (
    <Card className="glass-surface glass-refraction bg-gradient-overview border-border overflow-hidden">
      <CardContent className="space-y-4 pt-4 pb-4">
        {/* ── Metrics Grid (GDP / Population / Land Area) ── */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() =>
                  setMetricViewAction((v) => ({
                    ...v,
                    gdp: v.gdp === "perCapita" ? "total" : "perCapita",
                  }))
                }
                className="cursor-pointer rounded-xl border border-border-secondary/30 bg-bg-accent/5 p-3 text-left transition-colors duration-200 hover:bg-bg-accent/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
              >
                <p className="text-muted-foreground/80 text-[10px] font-semibold tracking-wide uppercase">
                  {metricView.gdp === "perCapita" ? "GDP per Capita" : "Total GDP"}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p className="text-foreground text-lg font-bold tracking-tight">
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
                        <span className="flex items-center gap-0.5 text-emerald-500">
                          <ArrowTrendingUpIcon size={14} className="inline-flex" />
                          <span className="text-[10px] font-semibold">
                            +{gdpGrowth.toFixed(1)}%
                          </span>
                        </span>
                      );
                    if (gdpGrowth < 0)
                      return (
                        <span className="flex items-center gap-0.5 text-red-500">
                          <ArrowTrendingDownIcon size={14} className="inline-flex" />
                          <span className="text-[10px] font-semibold">{gdpGrowth.toFixed(1)}%</span>
                        </span>
                      );
                    return <span className="text-muted-foreground text-[10px]">0.0%</span>;
                  })()}
                </div>
                <p className="text-muted-foreground mt-0.5 text-[11px]">
                  {metricView.gdp === "perCapita"
                    ? `${country.economicTier || "Developing"} · $${Math.round(country.currentTotalGdp ?? 0).toLocaleString("en-US")} total`
                    : `Per capita: $${Math.round(country.currentGdpPerCapita ?? 0).toLocaleString("en-US")}`}
                </p>
              </button>
              <button
                onClick={() =>
                  setMetricViewAction((v) => ({
                    ...v,
                    population: v.population === "total" ? "density" : "total",
                  }))
                }
                className="cursor-pointer rounded-xl border border-border-secondary/30 bg-bg-accent/5 p-3 text-left transition-colors duration-200 hover:bg-bg-accent/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
              >
                <p className="text-muted-foreground/80 text-[10px] font-semibold tracking-wide uppercase">
                  {metricView.population === "total" ? "Population" : "Pop. Density"}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p className="text-foreground text-lg font-bold tracking-tight">
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
                        <span className="flex items-center gap-0.5 text-emerald-500">
                          <ArrowTrendingUpIcon size={14} className="inline-flex" />
                          <span className="text-[10px] font-semibold">
                            +{popGrowth.toFixed(1)}%
                          </span>
                        </span>
                      );
                    if (popGrowth < 0)
                      return (
                        <span className="flex items-center gap-0.5 text-red-500">
                          <ArrowTrendingDownIcon size={14} className="inline-flex" />
                          <span className="text-[10px] font-semibold">{popGrowth.toFixed(1)}%</span>
                        </span>
                      );
                    return <span className="text-muted-foreground text-[10px]">0.0%</span>;
                  })()}
                </div>
                <p className="text-muted-foreground mt-0.5 text-[11px]">
                  {metricView.population === "total"
                    ? `Tier ${country.populationTier || "N/A"}${country.populationDensity ? ` · ${Math.round(country.populationDensity).toLocaleString()}/km²` : ""}`
                    : `Total: ${Math.round(country.currentPopulation ?? 0).toLocaleString("en-US")}`}
                </p>
              </button>
              <button
                onClick={
                  country.areaSqMi && country.landArea
                    ? () =>
                        setMetricViewAction((v) => ({ ...v, area: v.area === "km" ? "mi" : "km" }))
                    : undefined
                }
                className={cn(
                  "rounded-xl border border-border-secondary/30 bg-bg-accent/5 p-3 text-left transition-colors duration-200 dark:bg-white/[0.02]",
                  country.areaSqMi &&
                    country.landArea &&
                    "cursor-pointer hover:bg-bg-accent/10 dark:hover:bg-white/[0.05]"
                )}
              >
                <p className="text-muted-foreground/80 text-[10px] font-semibold tracking-wide uppercase">
                  Land Area
                </p>
                <p className="text-foreground mt-0.5 text-lg font-bold tracking-tight">
                  {metricView.area === "km"
                    ? country.landArea
                      ? `${Math.round(country.landArea).toLocaleString()} km²`
                      : "N/A"
                    : country.areaSqMi
                      ? `${Math.round(country.areaSqMi).toLocaleString()} sq mi`
                      : "N/A"}
                </p>
                <p className="text-muted-foreground mt-0.5 text-[11px]">
                  {metricView.area === "km"
                    ? country.areaSqMi
                      ? `${Math.round(country.areaSqMi).toLocaleString()} sq mi`
                      : ""
                    : country.landArea
                      ? `${Math.round(country.landArea).toLocaleString()} km²`
                      : ""}
                </p>
              </button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Click any metric to toggle between views
          </TooltipContent>
        </Tooltip>

        {/* Growth footer */}
        <div className="border-border/40 text-muted-foreground flex items-center gap-4 border-t pt-2.5 text-[11px]">
          <span>
            <TrendingUp className="mr-1 inline h-3 w-3 text-pink-500" />
            Max GDP Growth{" "}
            <span className="text-foreground font-semibold">
              {((country.maxGdpGrowthRate ?? 0) * 100).toFixed(1)}%
            </span>
            <span className="ml-1 opacity-60">({country.economicTier || "N/A"} cap)</span>
          </span>
          <span>
            <Activity className="mr-1 inline h-3 w-3 text-pink-500" />
            Local Factor{" "}
            <span
              className={cn(
                "font-semibold",
                (country.localGrowthFactor ?? 1) > 1
                  ? "text-emerald-500"
                  : (country.localGrowthFactor ?? 1) < 1
                    ? "text-red-500"
                    : "text-foreground"
              )}
            >
              {(((country.localGrowthFactor ?? 1) - 1) * 100).toFixed(2)}%
            </span>
          </span>
        </div>

        {/* ── Identity & Lore (inline, no collapsible wrapper) ── */}
        <div className="border-border/30 space-y-3 border-t pt-3">
          {country.nationalIdentity?.motto && (
            <p className="text-muted-foreground/80 text-xs italic">
              &ldquo;{country.nationalIdentity.motto}&rdquo;
            </p>
          )}

          {/* Wiki intro + coat of arms */}
          {(() => {
            const introHtml = extractWikiIntroHtml(wikiIntro as WikiIntro) || country?.wikiSummary || country?.description || null;
            const coatOfArmsUrl = findCoatOfArmsUrl(wikiImages) || wikiImages?.[0]?.url || null;
            const showLoadingSkeleton = wikiLoading && !introHtml;
            return introHtml || coatOfArmsUrl || showLoadingSkeleton ? (
              <div className="flex gap-3">
                {coatOfArmsUrl && (
                  <img
                    src={coatOfArmsUrl}
                    alt={`Coat of arms of ${country.name}`}
                    className="border-border/30 h-20 w-auto shrink-0 rounded-lg border bg-white/50 object-contain p-1.5 dark:bg-white/10"
                  />
                )}
                <div className="min-w-0 flex-1">
                  {introHtml ? (
                    <div className="space-y-2">
                      <div
                        className="text-foreground/80 line-clamp-4 text-[13px] leading-relaxed [&_a]:text-blue-600 [&_a]:underline [&_a]:hover:text-blue-500 dark:[&_a]:text-blue-400"
                        dangerouslySetInnerHTML={{ __html: introHtml }}
                      />
                      <div className="flex items-center pt-0.5">
                        <Link
                          href={titleToWikiOSRoute(country.wikiPageTitle || country.name)}
                          className="group/wikilink inline-flex items-center gap-1.5 text-xs font-semibold text-blue-500 hover:text-blue-400 transition-colors"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>Read full page</span>
                          <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/wikilink:translate-x-0.5" />
                        </Link>
                      </div>
                    </div>
                  ) : showLoadingSkeleton ? (
                    <div className="space-y-1.5">
                      <div className="bg-muted/50 h-3 w-full animate-pulse rounded" />
                      <div className="bg-muted/50 h-3 w-4/5 animate-pulse rounded" />
                      <div className="bg-muted/50 h-3 w-3/5 animate-pulse rounded" />
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
                        className="flex items-center gap-2 rounded-lg border border-border-secondary/20 bg-bg-accent/5 px-3 py-2 dark:bg-white/[0.02]"
                      >
                        <FieldIcon className={cn("h-3.5 w-3.5 shrink-0", f.color)} />
                        <div className="min-w-0">
                          <p className="text-muted-foreground/70 text-[9px] tracking-wide uppercase">
                            {f.label}
                          </p>
                          <p className="text-foreground truncate text-xs font-semibold">
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
      </CardContent>
    </Card>
  );
}
