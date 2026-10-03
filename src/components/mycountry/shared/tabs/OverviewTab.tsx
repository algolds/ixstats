"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
import React from "react";
import {
  StatUp as TrendingUp,
  Activity,
  NavArrowRight as ChevronRight,
  OpenBook as BookOpen,
} from "iconoir-react";
import Link from "next/link";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import { cn } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import { assetUrl } from "~/lib/base-path";
import { smartNormalizeGrowthRate } from "~/lib/statecraft/growth-calculations";
import { OVERVIEW_IDENTITY_FIELDS } from "./overview-identity-fields";
import { GrowthBadge, MetricToggleGrid, ToggleMetric, toggleView } from "./tabParts";
import {
  extractWikiIntroHtml,
  findCoatOfArmsUrl,
  type WikiIntro,
} from "~/lib/wiki-os/adapters/ixstates/integration";
import type { CountryWithEconomicData } from "../primitives/CountryDataProvider";
import type { MyCountryMetricView } from "~/hooks/useMyCountryMetrics";
import { Card, CardContent } from "~/components/ui/card";

type MetricView = {
  gdp: "perCapita" | "total";
  population: "total" | "density";
  area: "km" | "mi";
};

const formatUS = (n: number | null | undefined) => Math.round(n ?? 0).toLocaleString("en-US");
const formatLocal = (n: number) => Math.round(n).toLocaleString();
const formatArea = (value: number | null | undefined, unit: string, fallback = "N/A") =>
  value ? `${formatLocal(value)} ${unit}` : fallback;

function WikiIntroBlock({
  country,
  wikiIntro,
  wikiImages,
  wikiLoading,
}: Pick<
  React.ComponentProps<typeof OverviewTab>,
  "country" | "wikiIntro" | "wikiImages" | "wikiLoading"
>) {
  const introHtml =
    (wikiIntro ? extractWikiIntroHtml(wikiIntro) : null) ||
    country?.wikiSummary ||
    country?.description ||
    null;
  // The Editor saves the seal to Country.coatOfArms; wiki images are the fallback.
  const coatOfArmsUrl =
    assetUrl(country?.coatOfArms) || findCoatOfArmsUrl(wikiImages) || wikiImages?.[0]?.url || null;
  const showLoadingSkeleton = wikiLoading && !introHtml;
  if (!introHtml && !coatOfArmsUrl && !showLoadingSkeleton) return null;

  return (
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
                <BookOpen aria-hidden="true" className="h-3.5 w-3.5" />
                <span>Read full page</span>
                <ChevronRight
                  aria-hidden="true"
                  className="h-3.5 w-3.5 transition-[translate] duration-200 motion-safe:group-hover/wikilink:translate-x-0.5 motion-safe:group-focus-visible/wikilink:translate-x-0.5"
                />
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
  );
}

function IdentityPills({
  identity,
}: {
  identity: NonNullable<CountryWithEconomicData["nationalIdentity"]>;
}) {
  const fields = OVERVIEW_IDENTITY_FIELDS.filter((f) => f.getValue(identity));
  if (fields.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {fields.map(({ key, icon: FieldIcon, color, label, getValue }) => (
        <div
          key={key}
          className="border-separator bg-surface rounded-control flex items-center gap-2 border px-3 py-2"
        >
          <FieldIcon className={cn("h-3.5 w-3.5 shrink-0", color)} />
          <div className="min-w-0">
            <Eyebrow className="block">{label}</Eyebrow>
            <p className="text-label text-caption truncate font-semibold">{getValue(identity)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function OverviewMetrics({
  country,
  metricView,
  setMetricViewAction,
}: Pick<
  React.ComponentProps<typeof OverviewTab>,
  "country" | "metricView" | "setMetricViewAction"
>) {
  const isPerCapita = metricView.gdp === "perCapita";
  const isTotalPopulation = metricView.population === "total";
  const isKm = metricView.area === "km";
  const density = formatLocal(country.populationDensity ?? 0);

  return (
    <MetricToggleGrid hint="Click any metric to toggle between views">
      <ToggleMetric
        animated={false}
        detailClassName=""
        label={isPerCapita ? "GDP per Capita" : "Total GDP"}
        valueKey={metricView.gdp}
        value={`$${formatUS(isPerCapita ? country.currentGdpPerCapita : country.currentTotalGdp)}`}
        aside={
          <GrowthBadge
            value={smartNormalizeGrowthRate(
              country.realGDPGrowthRate || country.adjustedGdpGrowth,
              0
            )}
          />
        }
        detail={
          isPerCapita
            ? `${country.economicTier || "Developing"} · $${formatUS(country.currentTotalGdp)} total`
            : `Per capita: $${formatUS(country.currentGdpPerCapita)}`
        }
        onToggle={() => toggleView(setMetricViewAction, "gdp", "perCapita", "total")}
      />
      <ToggleMetric
        animated={false}
        detailClassName=""
        label={isTotalPopulation ? "Population" : "Pop. Density"}
        valueKey={metricView.population}
        value={
          isTotalPopulation
            ? formatUS(country.currentPopulation)
            : country.populationDensity
              ? `${density} /km²`
              : "N/A"
        }
        aside={<GrowthBadge value={smartNormalizeGrowthRate(country.populationGrowthRate, 0)} />}
        detail={
          isTotalPopulation
            ? `Tier ${country.populationTier || "N/A"}${country.populationDensity ? ` · ${density}/km²` : ""}`
            : `Total: ${formatUS(country.currentPopulation)}`
        }
        onToggle={() => toggleView(setMetricViewAction, "population", "total", "density")}
      />
      <ToggleMetric
        animated={false}
        detailClassName=""
        label="Land area"
        valueKey={metricView.area}
        value={isKm ? formatArea(country.landArea, "km²") : formatArea(country.areaSqMi, "sq mi")}
        detail={
          isKm ? formatArea(country.areaSqMi, "sq mi", "") : formatArea(country.landArea, "km²", "")
        }
        onToggle={
          country.areaSqMi && country.landArea
            ? () => toggleView(setMetricViewAction, "area", "km", "mi")
            : undefined
        }
      />
    </MetricToggleGrid>
  );
}

function GrowthFooter({ country }: { country: CountryWithEconomicData }) {
  const localFactor = country.localGrowthFactor ?? 1;
  return (
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
            localFactor > 1 ? "text-green" : localFactor < 1 ? "text-destructive" : "text-label"
          )}
        >
          {((localFactor - 1) * 100).toFixed(2)}%
        </span>
      </span>
    </div>
  );
}

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
    <Card className="rounded-card overflow-hidden">
      <CardContent className="space-y-4 pt-4 pb-4">
        <OverviewMetrics
          country={country}
          metricView={metricView}
          setMetricViewAction={setMetricViewAction}
        />

        <GrowthFooter country={country} />

        {/* ── Identity & Lore (inline, no collapsible wrapper) ── */}
        <div className="border-separator space-y-3 border-t pt-3">
          {country.nationalIdentity?.motto && (
            <p className="text-label-secondary text-footnote italic">
              &ldquo;{country.nationalIdentity.motto}&rdquo;
            </p>
          )}

          <WikiIntroBlock
            country={country}
            wikiIntro={wikiIntro}
            wikiImages={wikiImages}
            wikiLoading={wikiLoading}
          />

          {country.nationalIdentity && <IdentityPills identity={country.nationalIdentity} />}
        </div>
      </CardContent>
    </Card>
  );
}
