"use client";

import React from "react";
import Link from "next/link";
import { TrendingUp, Users, BarChart3, Crown, Activity, Sparkles } from "lucide-react";
import { ExternalLink } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { splashGold } from "~/lib/splash/mycountry-gold";

/** Country row from getAll — intentionally loose for carousel display */
export function CountryShowcaseCard({ country }: { country: Record<string, unknown> }) {
  const name = String(country.name ?? "");
  const { flagUrl } = useFlag(name);
  const [wikiIntro, setWikiIntro] = React.useState<string>("");
  const [coatOfArmsUrl, setCoatOfArmsUrl] = React.useState<string>("");
  const trpcUtils = api.useUtils();

  const identity = country.nationalIdentity as
    | {
        officialName?: string;
        capitalCity?: string;
        currency?: string;
        currencySymbol?: string;
        demonym?: string;
        motto?: string;
      }
    | undefined;

  React.useEffect(() => {
    const fetchWikiData = async () => {
      try {
        const introResult = await trpcUtils.countries.getWikiIntro.fetch({
          countryName: name,
        });
        if (introResult?.extract) {
          const paragraphs = introResult.extract.split("\n\n");
          if (paragraphs.length > 0) {
            const firstParagraph = paragraphs[0];
            const secondParagraph = paragraphs[1];
            if (secondParagraph) {
              const sentences = secondParagraph.split(". ");
              const halfSecond =
                sentences.slice(0, Math.ceil(sentences.length / 2)).join(". ") +
                (sentences.length > 1 ? "." : "");
              setWikiIntro(firstParagraph + "\n\n" + halfSecond);
            } else {
              setWikiIntro(firstParagraph ?? "");
            }
          }
        }

        const imagesResult = await trpcUtils.countries.getWikiPageImages.fetch({
          countryName: name,
        });
        if (imagesResult && imagesResult.length > 0) {
          const coaImage = imagesResult.find(
            (img: { title: string; url: string }) =>
              img.title?.toLowerCase().includes("coat") ||
              img.title?.toLowerCase().includes("coa") ||
              img.title?.toLowerCase().includes("emblem")
          );
          if (coaImage) {
            setCoatOfArmsUrl(coaImage.url);
          }
        }
      } catch (error) {
        console.error("Error fetching wiki data:", error);
      }
    };

    fetchWikiData();
  }, [name, trpcUtils]);

  const slug = String(country.slug ?? "");
  const wikiUrl = `/w/${encodeURIComponent(name.replace(/ /g, "_"))}`;
  const ixstatsUrl = `/countries/${slug}`;

  const growthRate = (country.adjustedGdpGrowth as number | undefined) ?? 0;
  const growthPositive = growthRate >= 0;

  const currentTotalGdp = Number(country.currentTotalGdp ?? 0);
  const currentPopulation = Number(country.currentPopulation ?? 0);
  const currentGdpPerCapita = Number(country.currentGdpPerCapita ?? 0);
  const landArea = country.landArea != null ? Number(country.landArea) : undefined;
  const populationDensity =
    country.populationDensity != null ? Number(country.populationDensity) : undefined;
  const unemploymentRate =
    country.unemploymentRate != null ? Number(country.unemploymentRate) : undefined;
  const lifeExpectancy =
    country.lifeExpectancy != null ? Number(country.lifeExpectancy) : undefined;

  const economicTier = String(country.economicTier ?? "");
  const governmentType = country.governmentType ? String(country.governmentType) : "";
  const continent = country.continent ? String(country.continent) : "";
  const leader = country.leader ? String(country.leader) : "";

  const displayName = name.replace(/_/g, " ");

  return (
    <div className="relative h-full w-full overflow-y-auto p-6 md:p-8">
      {flagUrl && (
        <div className="absolute inset-0 opacity-10">
          <img
            src={flagUrl}
            alt={displayName}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="relative z-10 space-y-5">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h3 className="text-foreground mb-1.5 text-3xl font-bold md:text-4xl">
              {identity?.officialName || displayName}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={splashGold.badge}>{economicTier}</Badge>
              {governmentType && <Badge className={splashGold.badge}>{governmentType}</Badge>}
              {continent && <Badge className={splashGold.badge}>{continent}</Badge>}
            </div>
          </div>
          {coatOfArmsUrl && (
            <div className="glass-hierarchy-child flex h-20 w-20 shrink-0 items-center justify-center rounded-xl p-2">
              <img
                src={coatOfArmsUrl}
                alt={`${displayName} coat of arms`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-contain"
              />
            </div>
          )}
        </div>

        {identity && (identity.capitalCity || identity.currency || identity.demonym) && (
          <div className="glass-hierarchy-child grid grid-cols-3 gap-3 rounded-xl p-3">
            {identity.capitalCity && (
              <div className="text-center">
                <div className="text-muted-foreground mb-0.5 text-[10px] tracking-wider uppercase">
                  Capital
                </div>
                <div className="text-foreground text-xs font-medium">{identity.capitalCity}</div>
              </div>
            )}
            {identity.currency && (
              <div className="text-center">
                <div className="text-muted-foreground mb-0.5 text-[10px] tracking-wider uppercase">
                  Currency
                </div>
                <div className="text-foreground text-xs font-medium">
                  {identity.currencySymbol
                    ? `${identity.currency} (${identity.currencySymbol})`
                    : identity.currency}
                </div>
              </div>
            )}
            {identity.demonym && (
              <div className="text-center">
                <div className="text-muted-foreground mb-0.5 text-[10px] tracking-wider uppercase">
                  Demonym
                </div>
                <div className="text-foreground text-xs font-medium">{identity.demonym}</div>
              </div>
            )}
          </div>
        )}

        {wikiIntro && (
          <div className="glass-hierarchy-child space-y-3 rounded-xl p-4">
            <p className="text-foreground text-sm leading-relaxed whitespace-pre-line">
              {wikiIntro}
            </p>
            <div className="flex items-center gap-4">
              <Link
                href={wikiUrl}
                className={`inline-flex items-center gap-2 text-xs ${splashGold.link}`}
              >
                <ExternalLink className="h-3 w-3" />
                Read more on IxWiki
              </Link>
              <Link
                href={ixstatsUrl}
                className={`inline-flex items-center gap-2 text-xs ${splashGold.link}`}
              >
                <BarChart3 className="h-3 w-3" />
                View in IxStats
              </Link>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-hierarchy-child rounded-xl p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <TrendingUp className={`h-3 w-3 ${splashGold.text}`} />
                <span className="text-muted-foreground text-[10px] tracking-wider uppercase">
                  Total GDP
                </span>
              </div>
              <div className={`text-lg font-bold ${splashGold.text}`}>
                {formatCurrency(currentTotalGdp)}
              </div>
            </div>
            <div className="glass-hierarchy-child rounded-xl p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <Users className={`h-3 w-3 ${splashGold.text}`} />
                <span className="text-muted-foreground text-[10px] tracking-wider uppercase">
                  Population
                </span>
              </div>
              <div className={`text-lg font-bold ${splashGold.text}`}>
                {formatPopulation(currentPopulation)}
              </div>
            </div>
            <div className="glass-hierarchy-child rounded-xl p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <BarChart3 className={`h-3 w-3 ${splashGold.text}`} />
                <span className="text-muted-foreground text-[10px] tracking-wider uppercase">
                  Per Capita
                </span>
              </div>
              <div className={`text-lg font-bold ${splashGold.text}`}>
                {formatCurrency(currentGdpPerCapita)}
              </div>
            </div>
            <div className="glass-hierarchy-child rounded-xl p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <Activity
                  className={`h-3 w-3 ${growthPositive ? splashGold.text : "text-destructive"}`}
                />
                <span className="text-muted-foreground text-[10px] tracking-wider uppercase">
                  Growth
                </span>
              </div>
              <div
                className={`text-lg font-bold ${growthPositive ? splashGold.text : "text-destructive"}`}
              >
                {growthPositive ? "+" : ""}
                {(growthRate * 100).toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="glass-hierarchy-child grid grid-cols-4 gap-2 rounded-xl p-3">
            {landArea != null && (
              <div className="text-center">
                <div className="text-muted-foreground text-[10px]">Land Area</div>
                <div className="text-foreground text-xs font-semibold">
                  {landArea > 1000000
                    ? `${(landArea / 1000000).toFixed(2)}M km²`
                    : landArea > 1000
                      ? `${(landArea / 1000).toFixed(0)}K km²`
                      : `${landArea.toLocaleString()} km²`}
                </div>
              </div>
            )}
            {populationDensity != null && (
              <div className="text-center">
                <div className="text-muted-foreground text-[10px]">Density</div>
                <div className="text-foreground text-xs font-semibold">
                  {populationDensity.toFixed(0)}/km²
                </div>
              </div>
            )}
            {unemploymentRate != null && (
              <div className="text-center">
                <div className="text-muted-foreground text-[10px]">Unemployment</div>
                <div className="text-foreground text-xs font-semibold">
                  {(unemploymentRate * 100).toFixed(1)}%
                </div>
              </div>
            )}
            {lifeExpectancy != null && (
              <div className="text-center">
                <div className="text-muted-foreground text-[10px]">Life Exp.</div>
                <div className="text-foreground text-xs font-semibold">
                  {lifeExpectancy.toFixed(1)} yrs
                </div>
              </div>
            )}
          </div>
        </div>

        {(leader || identity?.motto) && (
          <div className="glass-hierarchy-child rounded-xl p-3">
            {leader && (
              <div className="flex items-center gap-2">
                <Crown className="text-muted-foreground h-3.5 w-3.5" />
                <span className="text-muted-foreground text-xs">Leader:</span>
                <span className="text-foreground text-xs font-medium">{leader}</span>
              </div>
            )}
            {identity?.motto && (
              <div className={`flex items-start gap-2 ${leader ? "mt-2" : ""}`}>
                <Sparkles className="text-muted-foreground mt-0.5 h-3.5 w-3.5" />
                <span className="text-muted-foreground text-xs italic">
                  &ldquo;{identity.motto}&rdquo;
                </span>
              </div>
            )}
          </div>
        )}

        {(() => {
          const economicHealth = Math.min(100, ((currentGdpPerCapita || 0) / 50000) * 100);
          const developmentIndex =
            economicTier === "Extravagant"
              ? 100
              : economicTier === "Very Strong"
                ? 85
                : economicTier === "Strong"
                  ? 70
                  : economicTier === "Healthy"
                    ? 55
                    : economicTier === "Developed"
                      ? 40
                      : economicTier === "Developing"
                        ? 25
                        : 10;
          const economicGrowth = Math.min(
            100,
            Math.max(0, (((country.adjustedGdpGrowth as number | undefined) ?? 0) * 100 + 3) * 20)
          );
          const globalRelevance = Math.min(
            100,
            Math.log10((currentTotalGdp || 0) / 1000000000 + 1) * 25
          );
          const overallHealth = Math.round(
            (economicHealth + developmentIndex + economicGrowth + globalRelevance) / 4
          );
          const healthColor = splashGold.text;
          const healthBorder = `${splashGold.border} ${splashGold.darkBorder}`;
          const healthGrade =
            overallHealth >= 85
              ? "A+"
              : overallHealth >= 75
                ? "A"
                : overallHealth >= 65
                  ? "B+"
                  : overallHealth >= 55
                    ? "B"
                    : overallHealth >= 45
                      ? "C+"
                      : overallHealth >= 35
                        ? "C"
                        : "D";

          const indicators = [
            { label: "Economy", value: economicHealth },
            { label: "Development", value: developmentIndex },
            { label: "Growth", value: economicGrowth },
            { label: "Global Impact", value: globalRelevance },
          ];

          return (
            <div className={`glass-hierarchy-child rounded-xl border ${healthBorder} p-4`}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    Country Health
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-2xl font-bold ${healthColor}`}>{overallHealth}</span>
                  <span className="text-muted-foreground text-xs">/100</span>
                  <span
                    className={`ml-1.5 rounded-md border ${healthBorder} px-1.5 py-0.5 text-xs font-bold ${healthColor}`}
                  >
                    {healthGrade}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {indicators.map((ind) => (
                  <div key={ind.label} className="flex items-center gap-3">
                    <span className="text-muted-foreground w-20 text-[10px]">{ind.label}</span>
                    <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-600 to-yellow-500 transition-all duration-500 dark:from-amber-500 dark:to-yellow-400"
                        style={{
                          width: `${Math.min(100, ind.value)}%`,
                          opacity: ind.value >= 70 ? 1 : ind.value >= 45 ? 0.85 : 0.65,
                        }}
                      />
                    </div>
                    <span className="text-foreground w-8 text-right text-[10px] font-medium">
                      {Math.round(ind.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
