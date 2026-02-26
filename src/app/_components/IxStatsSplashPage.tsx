"use client";

import React, { useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { useUser } from "~/context/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "~/trpc/react";

// UI Components
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Carousel, Card as CarouselCard } from "~/components/ui/apple-cards-carousel";



// Icons
import {
  Globe,
  TrendingUp,
  Users,
  BarChart3,
  Crown,
  Activity,
  MessageSquare,
  MessageCircle,
  Shield,
  ArrowRight,
  Sparkles,
  Brain,
  Network,
  Building2,
  Blocks,
  Vote,
  Layers,
} from "lucide-react";

// Components
import { InteractiveGridPattern } from "~/components/magicui/interactive-grid-pattern";
import { Marquee } from "~/components/magicui/marquee";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import {
  ATOMIC_COMPONENTS,
  ComponentType,
} from "~/components/government/atoms/AtomicGovernmentComponents";
import { ExternalLink } from "lucide-react";
import { createUrl } from "~/lib/url-utils";

// Country showcase card for carousel with vitality rings and wiki intro
function CountryShowcaseCard({ country }: { country: any }) {
  const { flagUrl } = useFlag(country.name);
  const [wikiIntro, setWikiIntro] = React.useState<string>("");
  const [coatOfArmsUrl, setCoatOfArmsUrl] = React.useState<string>("");

  // Fetch wiki intro and coat of arms - first paragraph and a half
  React.useEffect(() => {
    const fetchWikiData = async () => {
      try {
        // Fetch extract and page images
        const apiUrl = `https://ixwiki.com/api.php?action=query&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=original&format=json&titles=${encodeURIComponent(country.name)}`;
        const resp = await fetch(apiUrl, {
          headers: {
            "User-Agent": "IxStats-Platform",
            Accept: "application/json",
          },
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data?.query?.pages) {
            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0];
            const page = pages[pageId];

            if (page && !page.missing) {
              // Extract intro text
              if (page.extract) {
                const paragraphs = page.extract.split("\n\n");
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
                    setWikiIntro(firstParagraph);
                  }
                }
              }

              // Try to get coat of arms from page images
              if (page.original?.source) {
                // Check if it might be a coat of arms
                const imageUrl = page.original.source;
                if (
                  imageUrl.toLowerCase().includes("coat") ||
                  imageUrl.toLowerCase().includes("coa") ||
                  imageUrl.toLowerCase().includes("emblem")
                ) {
                  setCoatOfArmsUrl(imageUrl);
                }
              }
            }
          }
        }

        // Fallback: Try to fetch coat of arms specifically
        if (!coatOfArmsUrl) {
          const coaApiUrl = `https://ixwiki.com/api.php?action=query&prop=images&format=json&titles=${encodeURIComponent(country.name)}`;
          const coaResp = await fetch(coaApiUrl, {
            headers: {
              "User-Agent": "IxStats-Platform",
              Accept: "application/json",
            },
          });

          if (coaResp.ok) {
            const coaData = await coaResp.json();
            if (coaData?.query?.pages) {
              const pages = coaData.query.pages;
              const pageId = Object.keys(pages)[0];
              const page = pages[pageId];

              if (page?.images) {
                // Look for coat of arms in images
                const coaImage = page.images.find(
                  (img: any) =>
                    img.title?.toLowerCase().includes("coat") ||
                    img.title?.toLowerCase().includes("coa") ||
                    img.title?.toLowerCase().includes("emblem")
                );

                if (coaImage) {
                  const imageTitle = coaImage.title.replace("File:", "");
                  setCoatOfArmsUrl(
                    `https://ixwiki.com/wiki/Special:Filepath/${encodeURIComponent(imageTitle)}`
                  );
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching wiki data:", error);
      }
    };

    fetchWikiData();
  }, [country.name]);

  const wikiUrl = `https://ixwiki.com/wiki/${encodeURIComponent(country.name.replace(/ /g, "_"))}`;
  const ixstatsUrl = `/countries/${country.slug}`;

  const identity = country.nationalIdentity;
  const growthRate = country.adjustedGdpGrowth ?? 0;
  const growthPositive = growthRate >= 0;

  return (
    <div className="relative h-full w-full overflow-y-auto p-6 md:p-8">
      {/* Flag background */}
      {flagUrl && (
        <div className="absolute inset-0 opacity-10">
          <img src={flagUrl} alt={country.name} className="h-full w-full object-cover" />
        </div>
      )}

      <div className="relative z-10 space-y-5">
        {/* Header with COA */}
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h3 className="mb-1.5 text-3xl font-bold text-white md:text-4xl">
              {identity?.officialName || country.name.replace(/_/g, " ")}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border border-yellow-500/40 bg-yellow-500/20 text-yellow-300">
                {country.economicTier}
              </Badge>
              {country.governmentType && (
                <Badge className="border border-purple-500/40 bg-purple-500/20 text-purple-300">
                  {country.governmentType}
                </Badge>
              )}
              {country.continent && (
                <Badge className="border border-blue-500/40 bg-blue-500/20 text-blue-300">
                  {country.continent}
                </Badge>
              )}
            </div>
          </div>
          {coatOfArmsUrl && (
            <div className="glass-hierarchy-child flex h-20 w-20 shrink-0 items-center justify-center rounded-xl p-2">
              <img
                src={coatOfArmsUrl}
                alt={`${country.name} coat of arms`}
                className="h-full w-full object-contain"
              />
            </div>
          )}
        </div>

        {/* National Identity Quick Facts */}
        {identity && (identity.capitalCity || identity.currency || identity.demonym) && (
          <div className="glass-hierarchy-child grid grid-cols-3 gap-3 rounded-xl p-3">
            {identity.capitalCity && (
              <div className="text-center">
                <div className="mb-0.5 text-[10px] uppercase tracking-wider text-gray-500">Capital</div>
                <div className="text-xs font-medium text-gray-200">{identity.capitalCity}</div>
              </div>
            )}
            {identity.currency && (
              <div className="text-center">
                <div className="mb-0.5 text-[10px] uppercase tracking-wider text-gray-500">Currency</div>
                <div className="text-xs font-medium text-gray-200">
                  {identity.currencySymbol ? `${identity.currency} (${identity.currencySymbol})` : identity.currency}
                </div>
              </div>
            )}
            {identity.demonym && (
              <div className="text-center">
                <div className="mb-0.5 text-[10px] uppercase tracking-wider text-gray-500">Demonym</div>
                <div className="text-xs font-medium text-gray-200">{identity.demonym}</div>
              </div>
            )}
          </div>
        )}

        {/* Wiki Intro */}
        {wikiIntro && (
          <div className="glass-hierarchy-child space-y-3 rounded-xl p-4">
            <p className="text-sm leading-relaxed whitespace-pre-line text-gray-200">{wikiIntro}</p>
            <div className="flex items-center gap-4">
              <a
                href={wikiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-blue-400 transition-colors hover:text-blue-300"
              >
                <ExternalLink className="h-3 w-3" />
                Read more on IxWiki
              </a>
              <Link
                href={ixstatsUrl}
                className="inline-flex items-center gap-2 text-xs text-yellow-400 transition-colors hover:text-yellow-300"
              >
                <BarChart3 className="h-3 w-3" />
                View in IxStats
              </Link>
            </div>
          </div>
        )}

        {/* Economic Dashboard - MyCountry Style */}
        <div className="space-y-3">
          {/* Primary Metrics - 2x2 grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-hierarchy-child rounded-xl p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3 text-green-400" />
                <span className="text-[10px] uppercase tracking-wider text-gray-500">Total GDP</span>
              </div>
              <div className="text-lg font-bold text-green-400">
                {formatCurrency(country.currentTotalGdp)}
              </div>
            </div>
            <div className="glass-hierarchy-child rounded-xl p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <Users className="h-3 w-3 text-blue-400" />
                <span className="text-[10px] uppercase tracking-wider text-gray-500">Population</span>
              </div>
              <div className="text-lg font-bold text-blue-400">
                {formatPopulation(country.currentPopulation)}
              </div>
            </div>
            <div className="glass-hierarchy-child rounded-xl p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <BarChart3 className="h-3 w-3 text-yellow-400" />
                <span className="text-[10px] uppercase tracking-wider text-gray-500">Per Capita</span>
              </div>
              <div className="text-lg font-bold text-yellow-400">
                {formatCurrency(country.currentGdpPerCapita)}
              </div>
            </div>
            <div className="glass-hierarchy-child rounded-xl p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <Activity className={`h-3 w-3 ${growthPositive ? "text-emerald-400" : "text-red-400"}`} />
                <span className="text-[10px] uppercase tracking-wider text-gray-500">Growth</span>
              </div>
              <div className={`text-lg font-bold ${growthPositive ? "text-emerald-400" : "text-red-400"}`}>
                {growthPositive ? "+" : ""}{(growthRate * 100).toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Secondary Metrics - horizontal row */}
          <div className="glass-hierarchy-child grid grid-cols-4 gap-2 rounded-xl p-3">
            {country.landArea && (
              <div className="text-center">
                <div className="text-[10px] text-gray-500">Land Area</div>
                <div className="text-xs font-semibold text-gray-300">
                  {country.landArea > 1000000
                    ? `${(country.landArea / 1000000).toFixed(2)}M km²`
                    : country.landArea > 1000
                      ? `${(country.landArea / 1000).toFixed(0)}K km²`
                      : `${country.landArea.toLocaleString()} km²`}
                </div>
              </div>
            )}
            {country.populationDensity && (
              <div className="text-center">
                <div className="text-[10px] text-gray-500">Density</div>
                <div className="text-xs font-semibold text-gray-300">
                  {country.populationDensity.toFixed(0)}/km²
                </div>
              </div>
            )}
            {country.unemploymentRate != null && (
              <div className="text-center">
                <div className="text-[10px] text-gray-500">Unemployment</div>
                <div className="text-xs font-semibold text-gray-300">
                  {(country.unemploymentRate * 100).toFixed(1)}%
                </div>
              </div>
            )}
            {country.lifeExpectancy != null && (
              <div className="text-center">
                <div className="text-[10px] text-gray-500">Life Exp.</div>
                <div className="text-xs font-semibold text-gray-300">
                  {country.lifeExpectancy.toFixed(1)} yrs
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Leader & Motto */}
        {(country.leader || identity?.motto) && (
          <div className="glass-hierarchy-child rounded-xl p-3">
            {country.leader && (
              <div className="flex items-center gap-2">
                <Crown className="h-3.5 w-3.5 text-yellow-500" />
                <span className="text-xs text-gray-400">Leader:</span>
                <span className="text-xs font-medium text-gray-200">{country.leader}</span>
              </div>
            )}
            {identity?.motto && (
              <div className={`flex items-start gap-2 ${country.leader ? "mt-2" : ""}`}>
                <Sparkles className="mt-0.5 h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs italic text-gray-300">&ldquo;{identity.motto}&rdquo;</span>
              </div>
            )}
          </div>
        )}

        {/* Country Health Score */}
        {(() => {
          const economicHealth = Math.min(100, ((country.currentGdpPerCapita || 0) / 50000) * 100);
          const developmentIndex =
            country.economicTier === "Extravagant" ? 100
            : country.economicTier === "Very Strong" ? 85
            : country.economicTier === "Strong" ? 70
            : country.economicTier === "Healthy" ? 55
            : country.economicTier === "Developed" ? 40
            : country.economicTier === "Developing" ? 25 : 10;
          const economicGrowth = Math.min(100, Math.max(0, (((country.adjustedGdpGrowth ?? 0) * 100 + 3) * 20)));
          const globalRelevance = Math.min(100, Math.log10((country.currentTotalGdp || 0) / 1000000000 + 1) * 25);
          const overallHealth = Math.round((economicHealth + developmentIndex + economicGrowth + globalRelevance) / 4);
          const healthColor = overallHealth >= 70 ? "text-emerald-400" : overallHealth >= 45 ? "text-yellow-400" : "text-red-400";
          const healthBorder = overallHealth >= 70 ? "border-emerald-500/30" : overallHealth >= 45 ? "border-yellow-500/30" : "border-red-500/30";
          const healthGrade = overallHealth >= 85 ? "A+" : overallHealth >= 75 ? "A" : overallHealth >= 65 ? "B+" : overallHealth >= 55 ? "B" : overallHealth >= 45 ? "C+" : overallHealth >= 35 ? "C" : "D";

          const indicators = [
            { label: "Economy", value: economicHealth, color: "text-green-400" },
            { label: "Development", value: developmentIndex, color: "text-blue-400" },
            { label: "Growth", value: economicGrowth, color: "text-emerald-400" },
            { label: "Global Impact", value: globalRelevance, color: "text-amber-400" },
          ];

          return (
            <div className={`glass-hierarchy-child rounded-xl border ${healthBorder} p-4`}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-gray-400" />
                  <span className="text-xs font-medium uppercase tracking-wider text-gray-400">Country Health</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-2xl font-bold ${healthColor}`}>{overallHealth}</span>
                  <span className="text-xs text-gray-500">/100</span>
                  <span className={`ml-1.5 rounded-md border ${healthBorder} px-1.5 py-0.5 text-xs font-bold ${healthColor}`}>
                    {healthGrade}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {indicators.map((ind) => (
                  <div key={ind.label} className="flex items-center gap-3">
                    <span className="w-20 text-[10px] text-gray-500">{ind.label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, ind.value)}%`,
                          backgroundColor: ind.value >= 70 ? "#34d399" : ind.value >= 45 ? "#fbbf24" : "#f87171",
                        }}
                      />
                    </div>
                    <span className={`w-8 text-right text-[10px] font-medium ${ind.color}`}>
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

export function IxStatsSplashPage() {
  const { user } = useUser();
  const router = useRouter();

  // Fetch live data
  const { data: countriesData } = api.countries.getAll.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const { data: globalStats } = api.countries.getGlobalStats.useQuery();

  // Prefetch flags for top countries in the background
  useEffect(() => {
    if (countriesData?.countries && countriesData.countries.length > 0) {
      const topCountryNames = countriesData.countries
        .slice(0, 20) // Just prefetch top 20 for splash page
        .map((c: { name: any }) => c.name);
      console.log(`[SplashPage] Prefetching ${topCountryNames.length} top country flags`);
      import("~/lib/unified-flag-service").then(({ unifiedFlagService }) => {
        unifiedFlagService.prefetchFlags(topCountryNames);
      });
    }
  }, [countriesData]);

  // Prepare top countries for carousel
  const topCountries = useMemo(() => {
    if (!countriesData?.countries) return [];
    return [...countriesData.countries]
      .sort((a, b) => (b.currentTotalGdp || 0) - (a.currentTotalGdp || 0))
      .slice(0, 6);
  }, [countriesData]);

  // Country card component that uses the flag hook
  const CountryCarouselCard = ({ country, index }: { country: any; index: number }) => {
    const { flagUrl } = useFlag(country.name);

    return (
      <CarouselCard
        card={{
          src: flagUrl || "/images/placeholder-flag.svg",
          title: country.name.replace(/_/g, " "),
          category: `#${index + 1} Global Ranking`,
          content: <CountryShowcaseCard country={country} />,
        }}
        index={index}
      />
    );
  };

  // Prepare carousel cards with flag backgrounds
  const carouselCards = useMemo(() => {
    return topCountries.map((country, idx) => (
      <CountryCarouselCard key={country.id} country={country} index={idx} />
    ));
  }, [topCountries]);

  // Showcase atomic components
  const showcaseComponents = useMemo(() => {
    return [
      ATOMIC_COMPONENTS[ComponentType.DEMOCRATIC_PROCESS],
      ATOMIC_COMPONENTS[ComponentType.FEDERAL_SYSTEM],
      ATOMIC_COMPONENTS[ComponentType.INDEPENDENT_JUDICIARY],
    ].filter(Boolean);
  }, []);

  // Shuffled marquee components - memoized to prevent re-shuffling on each render
  const shuffledMarqueeComponents = useMemo(() => {
    const allComponents = [
      // Government Components (Purple)
      { type: ComponentType.DEMOCRATIC_PROCESS, color: "purple" },
      { type: ComponentType.FEDERAL_SYSTEM, color: "purple" },
      { type: ComponentType.INDEPENDENT_JUDICIARY, color: "purple" },
      { type: ComponentType.RULE_OF_LAW, color: "purple" },
      { type: ComponentType.PROFESSIONAL_BUREAUCRACY, color: "purple" },
      { type: ComponentType.TECHNOCRATIC_PROCESS, color: "purple" },
      { type: ComponentType.ELECTORAL_LEGITIMACY, color: "purple" },
      { type: ComponentType.AUTOCRATIC_PROCESS, color: "purple" },

      // Economy Components (Green)
      { type: ComponentType.FREE_MARKET_SYSTEM, color: "green" },
      { type: ComponentType.KNOWLEDGE_ECONOMY, color: "green" },
      { type: ComponentType.INNOVATION_ECOSYSTEM, color: "green" },
      { type: ComponentType.DIGITAL_GOVERNMENT, color: "green" },
      { type: ComponentType.RESEARCH_AND_DEVELOPMENT, color: "green" },
      { type: ComponentType.ENTREPRENEURSHIP_SUPPORT, color: "green" },
      { type: ComponentType.MIXED_ECONOMY, color: "green" },
      { type: ComponentType.SOCIAL_MARKET_ECONOMY, color: "green" },

      // Administrative Components (Blue)
      { type: ComponentType.MERIT_BASED_SYSTEM, color: "blue" },
      { type: ComponentType.TRANSPARENCY_INITIATIVE, color: "blue" },
      { type: ComponentType.ANTI_CORRUPTION, color: "blue" },
      { type: ComponentType.E_GOVERNANCE, color: "blue" },
      { type: ComponentType.PERFORMANCE_MANAGEMENT, color: "blue" },
      { type: ComponentType.ACCOUNTABILITY_FRAMEWORK, color: "blue" },
      { type: ComponentType.STRATEGIC_PLANNING, color: "blue" },
      { type: ComponentType.QUALITY_ASSURANCE, color: "blue" },

      // Social & International (Cyan)
      { type: ComponentType.UNIVERSAL_HEALTHCARE, color: "cyan" },
      { type: ComponentType.PUBLIC_EDUCATION, color: "cyan" },
      { type: ComponentType.MULTILATERAL_DIPLOMACY, color: "cyan" },
      { type: ComponentType.INTERNATIONAL_LAW, color: "cyan" },
      { type: ComponentType.WELFARE_STATE, color: "cyan" },
      { type: ComponentType.ENVIRONMENTAL_PROTECTION, color: "cyan" },
    ];
    // Shuffle the array
    return [...allComponents].sort(() => Math.random() - 0.5);
  }, []);

  // Type guard for globalStats
  const isValidGlobalStats = (
    stats: unknown
  ): stats is {
    totalCountries: number;
    totalGdp: number;
    totalPopulation: number;
    globalGrowthRate: number;
  } => {
    return typeof stats === "object" && stats !== null && "totalCountries" in stats;
  };

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user) {
      router.push(createUrl("/dashboard"));
    }
  }, [user, router]);

  // Show loading state while checking auth
  if (user) {
    return (
      <div className="bg-background relative flex min-h-screen items-center justify-center">
        <InteractiveGridPattern
          width={40}
          height={40}
          squares={[50, 40]}
          className="fixed inset-0 z-0 opacity-30 dark:opacity-20"
          squaresClassName="fill-slate-200/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30"
        />
        <div className="relative z-10 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-yellow-500" />
          <p className="text-muted-foreground">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background relative min-h-screen overflow-hidden">
      {/* Interactive Grid Background - IxStats Design Language */}
      <InteractiveGridPattern
        width={40}
        height={40}
        squares={[50, 40]}
        className="fixed inset-0 z-0 opacity-30 dark:opacity-20"
        squaresClassName="fill-slate-200/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30 [&:nth-child(4n+1):hover]:fill-yellow-600/40 [&:nth-child(4n+1):hover]:stroke-yellow-600/60 [&:nth-child(4n+2):hover]:fill-blue-600/40 [&:nth-child(4n+2):hover]:stroke-blue-600/60 [&:nth-child(4n+3):hover]:fill-indigo-600/40 [&:nth-child(4n+3):hover]:stroke-indigo-600/60 [&:nth-child(4n+4):hover]:fill-red-600/40 [&:nth-child(4n+4):hover]:stroke-red-600/60 transition-all duration-200"
      />

      <div className="relative z-10 container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Hero Section - MyCountry Gold Theme */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mx-auto mt-16 mb-20 max-w-6xl text-center"
        >
          {/* Dynamic Island-inspired status badge */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-hierarchy-parent mb-8 inline-flex items-center gap-3 rounded-full border border-yellow-500/30 px-6 py-3"
          >
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span className="text-foreground text-sm font-medium">
              {isValidGlobalStats(globalStats) ? globalStats.totalCountries : 0} Nations Active
            </span>
            <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 px-2 py-0.5 text-xs text-white">
              v2.0
            </Badge>
          </motion.div>

          {/* IxStats Logo */}
          <div className="mb-6 flex items-center justify-center gap-4">
            <div className="relative h-20 w-20 md:h-24 md:w-24">
              {/* Outer ring - represents global/world */}
              <div className="absolute inset-0 rounded-full border-4 border-yellow-500/30"></div>
              {/* Inner elements - stats/analytics symbols */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative h-full w-full">
                  {/* Rising bar chart representation */}
                  <TrendingUp
                    className="absolute top-1/2 left-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-yellow-500 md:h-12 md:w-12"
                    strokeWidth={2.5}
                  />
                  {/* Crown symbol overlay for nation/leadership */}
                  <Crown
                    className="absolute top-0 right-0 h-5 w-5 text-orange-500 md:h-6 md:w-6"
                    strokeWidth={2}
                  />
                  {/* Globe symbol for international */}
                  <Globe
                    className="absolute bottom-0 left-0 h-5 w-5 text-yellow-600 md:h-6 md:w-6"
                    strokeWidth={2}
                  />
                </div>
              </div>
              {/* Animated pulse effect */}
              <div className="absolute inset-0 animate-ping rounded-full border-4 border-yellow-500 opacity-20"></div>
            </div>
            <h1 className="bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-600 bg-clip-text text-6xl font-bold text-transparent md:text-8xl">
              IxStats™
            </h1>
          </div>

          <p className="text-muted-foreground mx-auto mb-4 max-w-4xl text-2xl font-light md:text-3xl">
            Build Your Nation. Tell Its Story. Shape a Living World.
          </p>

          <p className="text-muted-foreground/80 mx-auto mb-10 max-w-3xl text-lg">
            The most comprehensive nation simulation platform. Design your government with total freedom. Run elections, conduct diplomacy, and collect trading cards. Roleplay through immersive systems that respond to your choices. Experience a persistent world where economies grow, politics shift, and every decision shapes history.
          </p>

          {/* Live Global Stats - Dynamic Island Colors */}
          {isValidGlobalStats(globalStats) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mx-auto mb-10 grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4"
            >
              <div className="glass-hierarchy-child rounded-xl border border-blue-500/20 p-4">
                <div className="text-3xl font-bold text-blue-500">{globalStats.totalCountries}</div>
                <div className="text-muted-foreground text-sm">Active Nations</div>
              </div>
              <div className="glass-hierarchy-child rounded-xl border border-green-500/20 p-4">
                <div className="text-3xl font-bold text-green-500">
                  {formatCurrency(globalStats.totalGdp)}
                </div>
                <div className="text-muted-foreground text-sm">World GDP</div>
              </div>
              <div className="glass-hierarchy-child rounded-xl border border-purple-500/20 p-4">
                <div className="text-3xl font-bold text-purple-500">
                  {formatPopulation(globalStats.totalPopulation)}
                </div>
                <div className="text-muted-foreground text-sm">Total Population</div>
              </div>
              <div className="glass-hierarchy-child rounded-xl border border-yellow-500/20 p-4">
                <div className="text-3xl font-bold text-yellow-500">
                  {(globalStats.globalGrowthRate * 100).toFixed(3)}%
                </div>
                <div className="text-muted-foreground text-sm">Global Growth</div>
              </div>
            </motion.div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/countries">
              <Button
                size="lg"
                variant="outline"
                className="border-yellow-500/30 px-10 py-6 text-lg hover:border-yellow-500/50 hover:bg-yellow-500/10"
              >
                Explore Countries
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Top Nations Carousel - Apple Cards Style */}
        {carouselCards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mb-20"
          >
            <div className="mb-10 text-center">
              <h2 className="text-foreground mb-3 text-4xl font-bold">Global Leaders</h2>
              <p className="text-muted-foreground">
                Explore the world's most powerful nations with live data
              </p>
            </div>
            <Carousel items={carouselCards} />
          </motion.div>
        )}

        {/* MyCountry Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mx-auto mb-32 max-w-7xl"
        >
          <div className="glass-hierarchy-parent relative overflow-hidden rounded-2xl border border-yellow-500/30 p-6 md:p-8">
            <div className="pointer-events-none absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-yellow-500/10 to-transparent" />

            <div className="relative z-10">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 shadow-xl shadow-yellow-500/30">
                  <Crown className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h2 className="bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-600 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
                    MyCountry©
                  </h2>
                  <p className="text-muted-foreground text-xl">Your Nation Management Hub</p>
                </div>
              </div>

              <p className="text-muted-foreground mb-8 max-w-3xl text-lg">
                Your nation, your rules, your data—all in one command center. Real-time intelligence feeds track threats and opportunities. Dynamic economic projections show where you're headed. Crisis alerts demand immediate decisions. This isn't a dashboard—it's your nation's nerve center.
              </p>

              <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="glass-hierarchy-child rounded-xl border border-yellow-500/20 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-base font-semibold">Country Builder</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    7-step guided setup from national identity to economic indicators. Import from
                    IIWiki or build from scratch with 100+ customizable data points.
                  </p>
                </div>

                <div className="glass-hierarchy-child rounded-xl border border-blue-500/20 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                      <Crown className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-base font-semibold">Executive Dashboard</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    8 specialized tabs covering economy, labor, demographics, and government.
                    Critical alerts, policy management, cabinet meetings, and activity scheduling
                    all in one place.
                  </p>
                </div>

                <div className="glass-hierarchy-child rounded-xl border border-purple-500/20 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-base font-semibold">Defense System</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Build and manage your military with 8 branch types (Army, Navy, Air Force, Cyber
                    Command, etc.). Organize units, track assets, monitor readiness, and assess
                    security threats.
                  </p>
                </div>

                <div className="glass-hierarchy-child rounded-xl border border-green-500/20 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-500">
                      <Brain className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-base font-semibold">Intelligence & Insights</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Real-time alerts, trend analysis, risk assessment, and forward-looking
                    predictions. Vitality scoring across 5 dimensions helps you understand your
                    nation&apos;s health at a glance.
                  </p>
                </div>

                <div className="glass-hierarchy-child rounded-xl border border-violet-500/20 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
                      <Vote className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-base font-semibold">Politics & Elections</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Run elections with D&apos;Hondt proportional representation or first-past-the-post.
                    Manage political parties, configure your legislature, and visualize seat
                    distributions in an interactive hemicycle.
                  </p>
                </div>

                <div className="glass-hierarchy-child rounded-xl border border-amber-500/20 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-yellow-500">
                      <Layers className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-base font-semibold">IxCards & MyVault</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Collect nation cards, open packs, and trade with other players. Craft new cards,
                    bid on the marketplace, and build a vault of lore cards generated from wiki
                    articles.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ThinkPages Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mx-auto mb-32 max-w-7xl"
        >
          <div className="glass-hierarchy-parent relative overflow-hidden rounded-2xl border border-blue-500/30 p-6 md:p-8">
            <div className="pointer-events-none absolute top-0 left-0 h-full w-1/2 bg-gradient-to-r from-blue-500/10 to-transparent" />

            <div className="relative z-10">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-xl shadow-blue-500/30">
                  <MessageSquare className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h2 className="bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
                    ThinkPages
                  </h2>
                  <p className="text-muted-foreground text-xl">25 Voices, One Nation</p>
                </div>
              </div>

              <p className="text-muted-foreground mb-8 max-w-3xl text-lg">
                Your nation isn't a spreadsheet—it's a society. Create 25 unique voices: the prime minister defending controversial reforms, opposition leaders demanding change, journalists breaking scandals, citizens protesting in the streets. Each character shapes your story. This is worldbuilding that breathes.
              </p>

              <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="glass-hierarchy-child rounded-xl border border-blue-500/20 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-base font-semibold">Create Your Society</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Design unique characters - from prime ministers to street activists. Give each
                    one personality, political views, and a distinct voice. Watch your national
                    story unfold through their interactions.
                  </p>
                </div>

                <div className="glass-hierarchy-child rounded-xl border border-cyan-500/20 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-400">
                      <MessageSquare className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-base font-semibold">Share & Collaborate</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Post updates on the social feed, message other nations privately, or join
                    collaborative think tanks. Connect with other players to build shared storylines
                    and regional politics.
                  </p>
                </div>

                <div className="glass-hierarchy-child rounded-xl border border-indigo-500/20 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-base font-semibold">Canon Worldbuilding</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    ThinkPages is{" "}
                    <a
                      href="https://ixwiki.com/wiki/ThinkPages"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 underline hover:text-indigo-300"
                    >
                      part of the Ixnay universe, meaning it's not just gameplay mechanics, but part of the lore and story of the world.
                    </a>
                    . Your posts contribute to a shared, persistent world with deep lore and
                    interconnected stories.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
                <p className="text-muted-foreground text-sm leading-relaxed">
                  <strong className="text-blue-300">Roleplay with Depth:</strong> Create opposition
                  parties that challenge your government. Write news articles covering your
                  elections. Have citizens protest controversial policies. Your worldbuilding
                  becomes interactive storytelling.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Atomic Design System Showcase */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.0 }}
          className="mx-auto mb-32 max-w-7xl"
        >
          <div className="mb-12 text-center">
            <h2 className="text-foreground mb-3 text-4xl font-bold">
              106 Building Blocks. Zero Presets. Infinite Possibilities.
            </h2>
            <p className="text-muted-foreground mx-auto max-w-3xl">
              Forget simple presets that hinder your creativity. Mix 24 government structures, 40+ economic policies, and 42 tax systems however you want to create your own unique government. Create a technocratic federation with democratic oversight. Build a centralized state with free markets. Your nation, your rules. Components synergize naturally for growth, or create conflicts that create story tension.
            </p>
          </div>

          <div className="mx-auto mb-8 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
            <div className="glass-hierarchy-child rounded-xl border border-purple-500/30 p-4 text-center">
              <div className="mb-1 text-3xl font-bold text-purple-400">24</div>
              <div className="text-muted-foreground text-sm">Government & Structure</div>
            </div>
            <div className="glass-hierarchy-child rounded-xl border border-green-500/30 p-4 text-center">
              <div className="mb-1 text-3xl font-bold text-green-400">40+</div>
              <div className="text-muted-foreground text-sm">Economic & Social Policy</div>
            </div>
            <div className="glass-hierarchy-child rounded-xl border border-blue-500/30 p-4 text-center">
              <div className="mb-1 text-3xl font-bold text-blue-400">42</div>
              <div className="text-muted-foreground text-sm">Administration & Systems</div>
            </div>
          </div>

          <div className="relative overflow-hidden">
            <Marquee pauseOnHover className="[--duration:50s]">
              {shuffledMarqueeComponents.map((item, idx) => {
                const component = ATOMIC_COMPONENTS[item.type];
                if (!component) return null;

                const colorConfigs = {
                  purple: {
                    border: "border-purple-500/20 hover:border-purple-500/40",
                    gradient: "from-purple-500 to-pink-500",
                    badge: "bg-purple-500/20 text-purple-600 border-purple-500/30",
                  },
                  green: {
                    border: "border-green-500/20 hover:border-green-500/40",
                    gradient: "from-green-500 to-emerald-500",
                    badge: "bg-green-500/20 text-green-600 border-green-500/30",
                  },
                  blue: {
                    border: "border-blue-500/20 hover:border-blue-500/40",
                    gradient: "from-blue-500 to-cyan-500",
                    badge: "bg-blue-500/20 text-blue-600 border-blue-500/30",
                  },
                  cyan: {
                    border: "border-cyan-500/20 hover:border-cyan-500/40",
                    gradient: "from-cyan-500 to-teal-500",
                    badge: "bg-cyan-500/20 text-cyan-600 border-cyan-500/30",
                  },
                };
                const colorConfig =
                  colorConfigs[item.color as keyof typeof colorConfigs] || colorConfigs.purple;

                return (
                  <Card
                    key={`${component.id}-${idx}`}
                    className={`glass-hierarchy-child border ${colorConfig.border} w-80 flex-shrink-0 transition-all`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-10 w-10 rounded-lg bg-gradient-to-br ${colorConfig.gradient} flex items-center justify-center`}
                        >
                          <Blocks className="h-5 w-5 text-white" />
                        </div>
                        <CardTitle className="text-base">{component.name}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-muted-foreground line-clamp-2 text-xs">
                        {component.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`${colorConfig.badge} text-xs`}>
                          {component.effectiveness}% effective
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {component.synergies.length} synergies
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </Marquee>

            <div className="from-background pointer-events-none absolute inset-y-0 left-0 w-1/12 bg-gradient-to-r to-transparent"></div>
            <div className="from-background pointer-events-none absolute inset-y-0 right-0 w-1/12 bg-gradient-to-l to-transparent"></div>
          </div>

          <div className="mx-auto mt-10 max-w-4xl space-y-4">
            <div className="glass-hierarchy-child rounded-xl border border-purple-500/20 p-4">
              <p className="text-muted-foreground text-sm leading-relaxed">
                <strong className="text-purple-300">Natural Interactions:</strong> Components work
                together realistically - choose a Technocratic Process with Professional Bureaucracy
                and watch them enhance each other. Or create conflicts by mixing contradictory
                elements for interesting storytelling.
              </p>
            </div>
            <div className="glass-hierarchy-child rounded-xl border border-green-500/20 p-4">
              <p className="text-muted-foreground text-sm leading-relaxed">
                <strong className="text-green-300">Shape Your Economy:</strong> Your choices matter.
                A Free Market System with Innovation support grows differently than a Planned
                Economy with Social Welfare. Watch your selections influence GDP, employment, and
                quality of life over time.
              </p>
            </div>
            <div className="glass-hierarchy-child rounded-xl border border-blue-500/20 p-4">
              <p className="text-muted-foreground text-sm leading-relaxed">
                <strong className="text-blue-300">Everything Connects:</strong> Your government
                structure affects how efficiently you can collect taxes. Your economic model
                influences which social programs work best. Build a nation that makes sense for your
                story.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Real Economic Simulation Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="mx-auto mb-32 max-w-7xl"
        >
          <div className="glass-hierarchy-parent relative overflow-hidden rounded-2xl border border-green-500/30 p-6 md:p-8">
            <div className="pointer-events-none absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-green-500/10 to-transparent" />

            <div className="relative z-10">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-xl shadow-green-500/30">
                  <Globe className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h2 className="bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
                    Dynamic World
                  </h2>
                  <p className="text-muted-foreground text-xl">Where Every Choice Matters</p>
                </div>
              </div>

              <p className="text-muted-foreground mb-8 max-w-3xl text-lg">
                Experience a living, breathing world where time moves forward, economies grow and
                contract, and your decisions have lasting consequences. Your nation exists alongside
                others on a shared timeline, creating opportunities for coordinated storytelling and
                authentic international relations.
              </p>

              <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="glass-hierarchy-child rounded-xl border border-green-500/20 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-500">
                      <Activity className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-base font-semibold">Shared Timeline</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Everyone plays on the same clock. Schedule cabinet meetings with specific dates,
                    coordinate regional summits, and watch events unfold simultaneously across all
                    nations for authentic geopolitical storytelling.
                  </p>
                </div>

                <div className="glass-hierarchy-child rounded-xl border border-emerald-500/20 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500">
                      <TrendingUp className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-base font-semibold">Growing Nations</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Watch your economy grow over months and years. Face national issues that demand
                    real decisions with lasting consequences. Track meaningful progress as your
                    policies reshape your nation&apos;s trajectory.
                  </p>
                </div>

                <div className="glass-hierarchy-child rounded-xl border border-teal-500/20 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500">
                      <Network className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-base font-semibold">Real Impact</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Your choices matter. Trade agreements strengthen economies. Elections shift
                    political power. Diplomatic missions succeed or fail based on relationships.
                    Crisis events demand immediate responses with real consequences.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Diplomatic & Intelligence Operations Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.4 }}
          className="mx-auto mb-32 max-w-7xl"
        >
          <div className="glass-hierarchy-parent relative overflow-hidden rounded-2xl border border-indigo-500/30 p-6 md:p-8">
            <div className="pointer-events-none absolute top-0 left-0 h-full w-1/2 bg-gradient-to-r from-indigo-500/10 to-transparent" />

            <div className="relative z-10">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 shadow-xl shadow-indigo-500/30">
                  <Globe className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h2 className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
                    Diplomacy & Relations
                  </h2>
                  <p className="text-muted-foreground text-xl">Connect with the World</p>
                </div>
              </div>

              <p className="text-muted-foreground mb-8 max-w-3xl text-lg">
                Build relationships with other nations. Establish embassies, conduct diplomatic
                missions, form alliances, and set foreign policy. Navigate the complexities of
                international relations and shape your region&apos;s story.
              </p>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="glass-hierarchy-child rounded-xl border border-indigo-500/20 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-base font-semibold">Embassies & Missions</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Open embassies, run diplomatic missions, and form alliances. Negotiate trade
                    deals, organize cultural exchanges, coordinate during crises, or pursue economic
                    cooperation projects.
                  </p>
                </div>

                <div className="glass-hierarchy-child rounded-xl border border-purple-500/20 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                      <MessageSquare className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-base font-semibold">Private Communications</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Send secure messages to other nations&apos; leaders. Negotiate treaties, share
                    intelligence, coordinate regional events, or simply build friendships behind the
                    scenes.
                  </p>
                </div>

                <div className="glass-hierarchy-child rounded-xl border border-pink-500/20 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-rose-500">
                      <Network className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-base font-semibold">Track Relationships</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    See your diplomatic ties at a glance. Monitor relationship strength, manage
                    foreign policy stances, review alliance commitments, and understand the web of
                    relationships shaping your region.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Discord CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="mx-auto mb-16 max-w-4xl text-center"
        >
          <div className="glass-hierarchy-parent rounded-2xl border border-[#5865F2]/30 p-6 md:p-8">
            <h2 className="mb-4 bg-gradient-to-r from-[#5865F2] via-[#7289DA] to-[#5865F2] bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
              Join Our Community
            </h2>
            <p className="text-muted-foreground mx-auto mb-6 max-w-2xl text-base md:text-lg">
              IxStats is live and growing. Join our Discord to follow updates, suggest
              features, and connect with the community.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a href="https://discord.gg/mgXAEYdqkd" target="_blank" rel="noopener noreferrer">
                <Button
                  size="lg"
                  className="bg-[#5865F2] px-12 py-6 text-lg text-white shadow-xl shadow-[#5865F2]/30 hover:bg-[#4752C4]"
                >
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Join our Discord
                </Button>
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
