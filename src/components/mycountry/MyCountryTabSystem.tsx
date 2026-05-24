"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart3,
  TrendingUp,
  Briefcase,
  Building,
  PieChart,
  Target,
  Sparkles,
  ArrowUp,
  Lock,
  Activity,
  DollarSign,
  Users,
  Globe,
  Globe2,
  TrendingDown,
  Crown,
  Bell,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Circle,
  Scroll,
  BookOpen,
  Clock,
  Shield,
  Landmark,
  MapPin,
  Loader2,
  ExternalLink,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from "~/components/ui/icons";
// EconomicSummaryWidget removed - using MetricCardGrid primitives instead
import { ThemedTabContent } from "~/components/ui/themed-tab-content";
import {
  useCountryData,
  AnimatedTabContent,
  staggerContainer,
  staggerItem,
  cardEntrance,
  SectorBreakdownCard,
  StatGaugeGrid,
  MetricCardGrid,
  CardImageUploadModal,
  TabHeroBanner,
  SectionHeaderBackground,
  type MetricGridItem,
  type SectorData,
  type CardImageType,
} from "./primitives";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";
// GovernmentStructureDisplay removed - using custom primitives instead
import { InlineHelpIcon } from "~/components/ui/help-icon";
import { extractCountryImageData } from "~/lib/country-image-engine";
import { WikiLoreBlock } from "./primitives/WikiLoreBlock";
import { useMetricDetailsModal, type MetricType } from "~/hooks/useMetricDetailsModal";
import { useIssueCount } from "~/hooks/useNationalIssues";
import { GdpDetailsModal } from "~/components/modals/GdpDetailsModal";
import { PopulationDetailsModal } from "~/components/modals/PopulationDetailsModal";
import { LaborDetailsModal, GovernmentSpendingModal, DebtAnalysisModal, DemographicsHealthModal } from "~/components/modals/metric-details";

// Animated card wrapper for staggered entrance
const MotionCard = motion.create(Card);

interface MyCountryTabSystemProps {
  variant?: "unified" | "standard" | "premium";
}

// Smart normalization helper
function smartNormalizeGrowthRate(value: number | null | undefined, fallback = 3.0): number {
  if (!value || !isFinite(value)) return fallback;

  let normalizedValue = value;
  while (Math.abs(normalizedValue) > 50) {
    normalizedValue = normalizedValue / 100;
  }

  if (Math.abs(normalizedValue) > 20) {
    return normalizedValue > 0 ? 20 : -20;
  }

  return normalizedValue;
}

function MyCountryTabSystemComponent({ variant = "unified" }: MyCountryTabSystemProps) {
  const { user } = useUser();
  const { country, economyData, currentIxTime } = useCountryData();
  const countryImageData = useMemo(() => extractCountryImageData(country), [country]);

  // Fetch government structure for dynamic spending data
  const { data: governmentStructure } = api.government.getByCountryId.useQuery(
    { countryId: country?.id || "" },
    { enabled: !!country?.id }
  );
  const [activeTab, setActiveTab] = useState("overview");
  const [tabDirection, setTabDirection] = useState(0);
  const [wikiSectionsOpen, setWikiSectionsOpen] = useState(false);

  // Toggle state for At a Glance metrics (overview tab)
  const [metricView, setMetricView] = useState({
    gdp: "perCapita" as "perCapita" | "total",
    population: "total" as "total" | "density",
    area: "km" as "km" | "mi",
  });

  // Wiki data for overview tab (fetched by country name, no wikiPageTitle gate)
  const { data: wikiIntro, isLoading: wikiLoading } = api.countries.getWikiRichIntro.useQuery(
    { countryName: country?.name || "" },
    { staleTime: 24 * 60 * 60_000, enabled: !!country?.name }
  );
  const { data: wikiImages } = api.countries.getWikiPageImages.useQuery(
    { countryName: country?.name || "" },
    { staleTime: 24 * 60 * 60_000, enabled: !!country?.name }
  );
  const { data: wikiSections, isLoading: sectionsLoading } = api.countries.getWikiSections.useQuery(
    { countryName: country?.name || "" },
    { staleTime: 60 * 60_000, enabled: !!country?.name && activeTab === "overview" }
  );

  // Card image upload modal state
  const [imageUploadModal, setImageUploadModal] = useState<{
    isOpen: boolean;
    cardType: CardImageType;
  }>({ isOpen: false, cardType: "national_identity" });

  // Metric details modal state for clickable cards
  const {
    isOpen: isMetricModalOpen,
    metricType,
    countryId: modalCountryId,
    openModal: openMetricModal,
    closeModal: closeMetricModal,
  } = useMetricDetailsModal();

  // Tab order for directional animations
  const tabOrder = ["overview", "economy", "labor", "government", "demographics", "analytics"];

  // Handle tab change with direction tracking
  const handleTabChange = (newTab: string) => {
    const oldIndex = tabOrder.indexOf(activeTab);
    const newIndex = tabOrder.indexOf(newTab);
    setTabDirection(newIndex > oldIndex ? 1 : -1);
    setActiveTab(newTab);
    // Update URL hash
    window.history.replaceState(null, "", "#" + newTab);
  };

  // Handle URL hash navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      const validTabs = [
        "overview",
        "economy",
        "labor",
        "government",
        "demographics",
        "analytics",
      ];
      if (hash && validTabs.includes(hash)) {
        setActiveTab(hash);
      }
    };

    // Check hash on mount
    handleHashChange();

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  if (!country) return null;

  const renderTabsList = () => {
    const govComponentCount = governmentStructure?.components?.length ?? 0;
    const govBadge = govComponentCount === 0 ? 1 : 0; // Needs setup

    const tabs = [
      { value: "overview", icon: BarChart3, label: "At a Glance", shortLabel: "Glance", badge: 0 },
      { value: "economy", icon: TrendingUp, label: "Economy", shortLabel: "Econ", badge: 0 },
      { value: "labor", icon: Briefcase, label: "Labor", shortLabel: "Lab", badge: 0 },
      { value: "government", icon: Building, label: "Government", shortLabel: "Gov", badge: govBadge },
    ];

    return (
      <div className="overflow-x-auto">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 min-w-fit gap-1">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={`data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3 ${
                ["economy", "labor", "government"].includes(tab.value)
                  ? `tab-trigger-${tab.value}`
                  : ""
              }`}
            >
              <tab.icon className="tab-icon h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
              {tab.badge > 0 && (
                <span className="inline-flex items-center justify-center rounded-full text-[9px] font-bold leading-none min-w-[14px] h-3.5 px-1 bg-amber-500 text-white">
                  {tab.badge}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    );
  };

  const renderPremiumUpgradeTeaser = () => {
    if (variant === "premium") return null;

    return (
      <>
        {/* Upgrade Banner for Standard */}
        {variant === "standard" && (
          <div className="mb-3 flex items-center justify-between rounded-lg border border-purple-200/30 bg-gradient-to-r from-purple-50/80 to-blue-50/80 p-3 dark:from-purple-950/30 dark:to-blue-950/30">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-semibold">Unlock Premium Features</span>
              <span className="text-muted-foreground text-xs hidden sm:inline">— Command Center, Intelligence, Analytics</span>
            </div>
            <Link href={"/mycountry/premium"}>
              <Button size="sm" className="gap-1.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600">
                <ArrowUp className="h-3 w-3" />
                Upgrade
              </Button>
            </Link>
          </div>
        )}

        {/* Premium Features Teaser */}
        {variant === "standard" && (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent" />
              <CardHeader className="relative pb-2">
                <div className="flex items-center justify-between">
                  <Crown className="h-5 w-5 text-purple-500" />
                  <Lock className="text-muted-foreground h-3.5 w-3.5" />
                </div>
                <CardTitle className="text-sm">Premium Command Center</CardTitle>
              </CardHeader>
              <CardContent className="relative pt-0">
                <div className="text-muted-foreground space-y-1 text-xs">
                  <div>• Real-time crisis monitoring</div>
                  <div>• Strategic decision recommendations</div>
                  <div>• Premium briefings & alerts</div>
                </div>
                <Link href={"/mycountry/premium"} className="mt-3 block">
                  <Button variant="outline" size="sm" className="w-full">
                    <ArrowUp className="mr-1.5 h-3 w-3" />
                    Upgrade
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent" />
              <CardHeader className="relative pb-2">
                <div className="flex items-center justify-between">
                  <Activity className="h-5 w-5 text-blue-500" />
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      PREVIEW
                    </Badge>
                    <Lock className="text-muted-foreground h-3.5 w-3.5" />
                  </div>
                </div>
                <CardTitle className="text-sm">Intelligence Briefings</CardTitle>
              </CardHeader>
              <CardContent className="relative pt-0">
                <div className="text-muted-foreground space-y-1 text-xs">
                  <div>• National performance analysis</div>
                  <div>• Forward-looking intelligence</div>
                  <div>• Risk assessment & mitigation</div>
                </div>
                <Link href={"/mycountry/premium"} className="mt-3 block">
                  <Button variant="outline" size="sm" className="w-full">
                    <ArrowUp className="mr-1.5 h-3 w-3" />
                    Upgrade
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent" />
              <CardHeader className="relative pb-2">
                <div className="flex items-center justify-between">
                  <BarChart3 className="h-5 w-5 text-green-500" />
                  <Lock className="text-muted-foreground h-3.5 w-3.5" />
                </div>
                <CardTitle className="text-sm">Advanced Analytics</CardTitle>
              </CardHeader>
              <CardContent className="relative pt-0">
                <div className="text-muted-foreground space-y-1 text-xs">
                  <div>• Multi-year projections</div>
                  <div>• Policy impact simulation</div>
                  <div>• Comparative benchmarking</div>
                </div>
                <Link href={"/mycountry/premium"} className="mt-3 block">
                  <Button variant="outline" size="sm" className="w-full">
                    <ArrowUp className="mr-1.5 h-3 w-3" />
                    Upgrade
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        )}
      </>
    );
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
      {renderTabsList()}

      {/* Animated tab content wrapper */}
      <AnimatedTabContent activeTab={activeTab} direction={tabDirection} mode="slide">
        {/* Overview Tab — single unified card */}
        <TabsContent value="overview" className="space-y-2" id="overview">
          <Card className="glass-surface glass-refraction border-border overflow-hidden">
            <CardContent className="pt-4 pb-4 space-y-4">

              {/* ── Metrics Grid (GDP / Population / Land Area) ── */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setMetricView(v => ({ ...v, gdp: v.gdp === "perCapita" ? "total" : "perCapita" }))}
                      className="rounded-xl bg-white/40 dark:bg-white/[0.04] p-3 text-left transition-all hover:bg-white/60 dark:hover:bg-white/[0.07] active:scale-[0.98]"
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                        {metricView.gdp === "perCapita" ? "GDP per Capita" : "Total GDP"}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <p className="text-lg font-bold tracking-tight text-foreground">
                          ${metricView.gdp === "perCapita"
                            ? Math.round(country.currentGdpPerCapita ?? 0).toLocaleString("en-US")
                            : Math.round(country.currentTotalGdp ?? 0).toLocaleString("en-US")}
                        </p>
                        {(() => {
                          const gdpGrowth = smartNormalizeGrowthRate(country.realGDPGrowthRate || country.adjustedGdpGrowth, 0);
                          if (gdpGrowth > 0) return (
                            <span className="flex items-center gap-0.5 text-emerald-500">
                              <ArrowTrendingUpIcon size={14} className="inline-flex" />
                              <span className="text-[10px] font-semibold">+{gdpGrowth.toFixed(1)}%</span>
                            </span>
                          );
                          if (gdpGrowth < 0) return (
                            <span className="flex items-center gap-0.5 text-red-500">
                              <ArrowTrendingDownIcon size={14} className="inline-flex" />
                              <span className="text-[10px] font-semibold">{gdpGrowth.toFixed(1)}%</span>
                            </span>
                          );
                          return <span className="text-[10px] text-muted-foreground">0.0%</span>;
                        })()}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {metricView.gdp === "perCapita"
                          ? `${country.economicTier || "Developing"} · $${Math.round(country.currentTotalGdp ?? 0).toLocaleString("en-US")} total`
                          : `Per capita: $${Math.round(country.currentGdpPerCapita ?? 0).toLocaleString("en-US")}`}
                      </p>
                    </button>
                    <button
                      onClick={() => setMetricView(v => ({ ...v, population: v.population === "total" ? "density" : "total" }))}
                      className="rounded-xl bg-white/40 dark:bg-white/[0.04] p-3 text-left transition-all hover:bg-white/60 dark:hover:bg-white/[0.07] active:scale-[0.98]"
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                        {metricView.population === "total" ? "Population" : "Pop. Density"}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <p className="text-lg font-bold tracking-tight text-foreground">
                          {metricView.population === "total"
                            ? Math.round(country.currentPopulation ?? 0).toLocaleString("en-US")
                            : country.populationDensity ? `${Math.round(country.populationDensity).toLocaleString()} /km²` : "N/A"}
                        </p>
                        {(() => {
                          const popGrowth = smartNormalizeGrowthRate(country.populationGrowthRate, 0);
                          if (popGrowth > 0) return (
                            <span className="flex items-center gap-0.5 text-emerald-500">
                              <ArrowTrendingUpIcon size={14} className="inline-flex" />
                              <span className="text-[10px] font-semibold">+{popGrowth.toFixed(1)}%</span>
                            </span>
                          );
                          if (popGrowth < 0) return (
                            <span className="flex items-center gap-0.5 text-red-500">
                              <ArrowTrendingDownIcon size={14} className="inline-flex" />
                              <span className="text-[10px] font-semibold">{popGrowth.toFixed(1)}%</span>
                            </span>
                          );
                          return <span className="text-[10px] text-muted-foreground">0.0%</span>;
                        })()}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {metricView.population === "total"
                          ? `Tier ${country.populationTier || "N/A"}${country.populationDensity ? ` · ${Math.round(country.populationDensity).toLocaleString()}/km²` : ""}`
                          : `Total: ${Math.round(country.currentPopulation ?? 0).toLocaleString("en-US")}`}
                      </p>
                    </button>
                    <button
                      onClick={country.areaSqMi && country.landArea ? () => setMetricView(v => ({ ...v, area: v.area === "km" ? "mi" : "km" })) : undefined}
                      className={cn(
                        "rounded-xl bg-white/40 dark:bg-white/[0.04] p-3 text-left transition-all",
                        country.areaSqMi && country.landArea && "hover:bg-white/60 dark:hover:bg-white/[0.07] active:scale-[0.98] cursor-pointer",
                      )}
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">Land Area</p>
                      <p className="mt-0.5 text-lg font-bold tracking-tight text-foreground">
                        {metricView.area === "km"
                          ? country.landArea ? `${country.landArea.toLocaleString()} km²` : "N/A"
                          : country.areaSqMi ? `${country.areaSqMi.toLocaleString()} sq mi` : "N/A"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {metricView.area === "km"
                          ? country.areaSqMi ? `${country.areaSqMi.toLocaleString()} sq mi` : ""
                          : country.landArea ? `${country.landArea.toLocaleString()} km²` : ""}
                      </p>
                    </button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Click any metric to toggle between views</TooltipContent>
              </Tooltip>

              {/* Growth footer */}
              <div className="flex items-center gap-4 border-t border-border/40 pt-2.5 text-[11px] text-muted-foreground">
                <span>
                  <TrendingUp className="mr-1 inline h-3 w-3 text-pink-500" />
                  Max GDP Growth <span className="font-semibold text-foreground">{((country.maxGdpGrowthRate ?? 0) * 100).toFixed(1)}%</span>
                  <span className="ml-1 opacity-60">({country.economicTier || "N/A"} cap)</span>
                </span>
                <span>
                  <Activity className="mr-1 inline h-3 w-3 text-pink-500" />
                  Local Factor <span className={cn("font-semibold", (country.localGrowthFactor ?? 1) > 1 ? "text-emerald-500" : (country.localGrowthFactor ?? 1) < 1 ? "text-red-500" : "text-foreground")}>{(((country.localGrowthFactor ?? 1) - 1) * 100).toFixed(2)}%</span>
                </span>
              </div>

              {/* ── Identity & Lore (inline, no collapsible wrapper) ── */}
              <div className="border-t border-border/30 pt-3 space-y-3">
                {country.nationalIdentity?.motto && (
                  <p className="text-xs italic text-muted-foreground/80">&ldquo;{country.nationalIdentity.motto}&rdquo;</p>
                )}

                {/* Wiki intro + coat of arms */}
                {(() => {
                  const introObj = wikiIntro as { paragraphs?: string[]; wikiUrl?: string } | string | string[] | null | undefined;
                  let introHtml: string | null = null;
                  if (introObj && typeof introObj === "object" && "paragraphs" in introObj && Array.isArray(introObj.paragraphs) && introObj.paragraphs.length > 0) {
                    introHtml = introObj.paragraphs[0] ?? null;
                  } else if (typeof introObj === "string") {
                    introHtml = introObj;
                  } else if (Array.isArray(introObj) && introObj.length > 0) {
                    introHtml = String(introObj[0]);
                  }
                  const coatOfArmsUrl = wikiImages?.find((img: { title: string; url: string }) =>
                    /coat.?of.?arms|coa|seal|emblem|escudo|wappen/i.test(img.title)
                  )?.url ?? null;
                  return (introHtml || coatOfArmsUrl || wikiLoading) ? (
                    <div className="flex gap-3">
                      {coatOfArmsUrl && (
                        <img src={coatOfArmsUrl} alt={`Coat of arms of ${country.name}`} className="h-20 w-auto flex-shrink-0 rounded-lg border border-border/30 bg-white/50 object-contain p-1.5 dark:bg-white/10" />
                      )}
                      <div className="min-w-0 flex-1">
                        {introHtml ? (
                          <div
                            className="line-clamp-4 text-[13px] leading-relaxed text-foreground/80 [&_a]:text-blue-600 [&_a]:underline dark:[&_a]:text-blue-400 [&_a]:hover:text-blue-500"
                            dangerouslySetInnerHTML={{ __html: introHtml }}
                          />
                        ) : wikiLoading ? (
                          <div className="space-y-1.5">
                            <div className="h-3 w-full animate-pulse rounded bg-muted/50" />
                            <div className="h-3 w-4/5 animate-pulse rounded bg-muted/50" />
                            <div className="h-3 w-3/5 animate-pulse rounded bg-muted/50" />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Identity field pills */}
                {country.nationalIdentity && (() => {
                  const ni = country.nationalIdentity;
                  const fields = OVERVIEW_IDENTITY_FIELDS.filter(f => f.getValue(ni));
                  if (fields.length === 0) return null;
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {fields.map(f => {
                        const FieldIcon = f.icon;
                        return (
                          <div key={f.key} className="flex items-center gap-2 rounded-lg bg-white/40 dark:bg-white/[0.04] px-3 py-2">
                            <FieldIcon className={cn("h-3.5 w-3.5 flex-shrink-0", f.color)} />
                            <div className="min-w-0">
                              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">{f.label}</p>
                              <p className="truncate text-xs font-semibold text-foreground">{f.getValue(ni)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* ── Wiki Sections (collapsible) ── */}
              {(() => {
                const wikiSource = (country as any).wikiSource;
                const wikiUrl = `https://${wikiSource === "iiwiki" ? "iiwiki.com" : "ixwiki.com"}/wiki/${encodeURIComponent(country.name.replace(/ /g, "_"))}`;
                const sections = (wikiSections ?? [])
                  .filter((s: any) => s.level === 2)
                  .map((s: any, i: number) => ({ title: s.line || s.title || "", key: `${i}-${s.anchor || s.line || i}` }));

                if (sectionsLoading) return (
                  <div className="flex items-center gap-2 py-2 border-t border-border/30 pt-3">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />
                    <span className="text-xs text-muted-foreground">Loading wiki sections...</span>
                  </div>
                );

                if (sections.length === 0) return null;

                return (
                  <div className="border-t border-border/30 pt-3">
                    <button
                      onClick={() => setWikiSectionsOpen(!wikiSectionsOpen)}
                      className="flex w-full items-center gap-2 text-left"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                      <span className="text-xs font-semibold text-foreground">Wiki Sections</span>
                      <span className="text-[10px] text-muted-foreground">{sections.length} sections</span>
                      <a
                        href={wikiUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto mr-1 flex items-center gap-0.5 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-600 hover:bg-purple-500/20 dark:text-purple-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Wiki <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                      <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform flex-shrink-0", !wikiSectionsOpen && "-rotate-90")} />
                    </button>
                    <AnimatePresence initial={false}>
                      {wikiSectionsOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 space-y-1">
                            {sections.map(section => (
                              <WikiSectionRow key={section.key} title={section.title} countryName={country.name} wikiUrl={wikiUrl} />
                            ))}
                          </div>
                          <a href={wikiUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center justify-center gap-1 text-xs font-medium text-purple-600 hover:underline dark:text-purple-400">
                            Read full article on IxWiki <ExternalLink className="h-3 w-3" />
                          </a>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })()}

            </CardContent>
          </Card>
        </TabsContent>

        {/* Economy Tab */}
        <TabsContent value="economy" className="space-y-4" id="economy">
          <ThemedTabContent theme="economy" className="space-y-4">
            <TabHeroBanner context="overview_economy" title="Economic Overview" subtitle="GDP, trade, and sector analysis" icon={TrendingUp} accentColor="emerald" />
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="space-y-4"
            >
              {/* Economic Summary - Core Metrics */}
              <motion.div variants={staggerItem}>
                <MetricCardGrid
                  theme="economy"
                  columns={4}
                  title="Economic Summary"
                  subtitle={`Key economic indicators for ${country.name}`}
                  backgroundImage={{
                    countryId: country.id,
                    cardType: "economic_indicators",
                    showEditButton: true,
                    onEditClick: () => setImageUploadModal({ isOpen: true, cardType: "economic_indicators" }),
                    autoFallback: true,
                    countryImageData: countryImageData ?? undefined,
                  }}
                  metrics={[
                    {
                      id: "gdp",
                      title: "Total GDP",
                      value: (economyData?.core.nominalGDP ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }),
                      icon: DollarSign,
                      description: `${country.economicTier || "Developing"} economy`,
                      tooltip: "Gross Domestic Product — the total monetary value of all goods and services produced within the country.",
                      onClick: () => openMetricModal("total-gdp", country.id),
                    },
                    {
                      id: "gdp-capita",
                      title: "GDP per Capita",
                      value: (economyData?.core.gdpPerCapita ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
                      icon: TrendingUp,
                      trend: smartNormalizeGrowthRate(country.realGDPGrowthRate || country.adjustedGdpGrowth, 0) > 0 ? "up" : "stable",
                      trendValue: smartNormalizeGrowthRate(country.realGDPGrowthRate || country.adjustedGdpGrowth, 0),
                      description: "Economic output per person",
                      tooltip: "GDP divided by total population. Indicates average economic productivity per citizen.",
                      onClick: () => openMetricModal("gdp-per-capita", country.id),
                    },
                    {
                      id: "population",
                      title: "Population",
                      value: (economyData?.core.totalPopulation ?? 0).toLocaleString("en-US"),
                      icon: Users,
                      trend: smartNormalizeGrowthRate(country.populationGrowthRate, 0) > 0 ? "up" : "stable",
                      trendValue: smartNormalizeGrowthRate(country.populationGrowthRate, 0),
                      description: "Total population",
                      tooltip: "Total number of citizens residing in the country. Growth rate reflects annual change.",
                      onClick: () => openMetricModal("population", country.id),
                    },
                    {
                      id: "unemployment",
                      title: "Unemployment",
                      value: `${(economyData?.labor?.unemploymentRate ?? 0).toFixed(1)}%`,
                      icon: Briefcase,
                      trend: (economyData?.labor?.unemploymentRate ?? 0) < 5 ? "up" : "down",
                      description: "Labor force unemployed",
                      tooltip: "Percentage of the labor force actively seeking but unable to find employment.",
                      onClick: () => openMetricModal("unemployment", country.id),
                    },
                  ]}
                />
              </motion.div>

              {/* Economic Ratios */}
              <motion.div variants={staggerItem}>
                <MetricCardGrid
                  theme="economy"
                  columns={4}
                  title="Economic Ratios & Fiscal Health"
                  subtitle="Key financial indicators and government metrics"
                  metrics={[
                    {
                      id: "labor-participation",
                      title: "Labor Participation",
                      value: `${(economyData?.labor?.laborForceParticipationRate ?? 0).toFixed(1)}%`,
                      icon: Users,
                      description: "Working-age population in workforce",
                      tooltip: "Share of the working-age population (15-64) that is either employed or actively seeking work.",
                      onClick: () => openMetricModal("labor-force", country.id),
                    },
                    {
                      id: "tax-revenue",
                      title: "Tax Revenue",
                      value: `${(economyData?.fiscal?.taxRevenueGDPPercent ?? 0).toFixed(1)}%`,
                      icon: Building,
                      description: "Percent of GDP",
                      tooltip: "Total government tax revenue expressed as a percentage of GDP. Indicates the tax burden on the economy.",
                      onClick: () => openMetricModal("government-spending", country.id),
                    },
                    {
                      id: "budget-balance",
                      title: "Budget Balance",
                      value: (economyData?.fiscal?.budgetDeficitSurplus ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }),
                      icon: (economyData?.fiscal?.budgetDeficitSurplus ?? 0) >= 0 ? TrendingUp : TrendingDown,
                      trend: (economyData?.fiscal?.budgetDeficitSurplus ?? 0) >= 0 ? "up" : "down",
                      description: (economyData?.fiscal?.budgetDeficitSurplus ?? 0) >= 0 ? "Surplus" : "Deficit",
                      tooltip: "Difference between government revenue and spending. Positive = surplus, negative = deficit.",
                      onClick: () => openMetricModal("government-spending", country.id),
                    },
                    {
                      id: "debt-gdp",
                      title: "Debt to GDP",
                      value: `${(economyData?.fiscal?.totalDebtGDPRatio ?? 0).toFixed(1)}%`,
                      icon: BarChart3,
                      trend: (economyData?.fiscal?.totalDebtGDPRatio ?? 0) < 60 ? "up" : "down",
                      description: "Public debt ratio",
                      tooltip: "Total public debt as a percentage of GDP. Below 60% is generally considered healthy.",
                      onClick: () => openMetricModal("debt", country.id),
                    },
                  ]}
                />
              </motion.div>

              {/* Comprehensive Economic Analysis */}
              <motion.div variants={staggerItem}>
                <Card className="glass-surface glass-refraction border-border overflow-hidden">
                  <SectionHeaderBackground context="overview_economy" overlayOpacity={0.88}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        Comprehensive Economic Analysis
                        <InlineHelpIcon
                          title="Economic Analysis"
                          content="View detailed breakdowns of economic sectors, trade relationships, productivity metrics, income distribution, and business climate indicators for comprehensive economic planning."
                        />
                      </CardTitle>
                    </CardHeader>
                  </SectionHeaderBackground>
                  <CardContent>
              {/* Economic Sub-Tabs with Pill Styling */}
              <Tabs defaultValue="sectors" className="space-y-4">
                <div className="flex justify-center mb-2">
                  <TabsList className="subtab-pills subtab-pills-economy">
                    <TabsTrigger
                      value="sectors"
                      className="subtab-pill subtab-pill-economy"
                    >
                      <Building className="subtab-icon h-4 w-4" />
                      <span>Sectors</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="trade"
                      className="subtab-pill subtab-pill-economy"
                    >
                      <Globe className="subtab-icon h-4 w-4" />
                      <span>Trade</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="productivity"
                      className="subtab-pill subtab-pill-economy"
                    >
                      <Activity className="subtab-icon h-4 w-4" />
                      <span>Productivity</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="income"
                      className="subtab-pill subtab-pill-economy"
                    >
                      <DollarSign className="subtab-icon h-4 w-4" />
                      <span>Income</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="business"
                      className="subtab-pill subtab-pill-economy"
                    >
                      <Briefcase className="subtab-icon h-4 w-4" />
                      <span>Business</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Economic Sectors Tab */}
                <TabsContent value="sectors" className="space-y-4">
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                    className="space-y-4"
                  >
                    {/* Economic Structure - Grid Layout */}
                    <motion.div variants={staggerItem}>
                      <SectorBreakdownCard
                        title="Economic Structure"
                        subtitle="GDP distribution across major economic sectors"
                        layout="grid"
                        showTrends={true}
                        showSectorImages={true}
                        sectors={[
                          {
                            id: "primary",
                            name: "Primary Sector",
                            value: (economyData?.core.nominalGDP ?? 0) * 0.05,
                            percentage: 5.0,
                            color: "green",
                            trend: "stable",
                            description: "Agriculture, Mining",
                            imageKeyword: "sector_agriculture",
                          },
                          {
                            id: "secondary",
                            name: "Secondary Sector",
                            value: (economyData?.core.nominalGDP ?? 0) * 0.25,
                            percentage: 25.0,
                            color: "blue",
                            trend: "up",
                            trendValue: 1.2,
                            description: "Manufacturing",
                            imageKeyword: "sector_industry",
                          },
                          {
                            id: "tertiary",
                            name: "Tertiary Sector",
                            value: (economyData?.core.nominalGDP ?? 0) * 0.55,
                            percentage: 55.0,
                            color: "purple",
                            trend: "up",
                            trendValue: 2.1,
                            description: "Services",
                            imageKeyword: "sector_services",
                          },
                          {
                            id: "quaternary",
                            name: "Quaternary Sector",
                            value: (economyData?.core.nominalGDP ?? 0) * 0.15,
                            percentage: 15.0,
                            color: "cyan",
                            trend: "up",
                            trendValue: 3.5,
                            description: "Knowledge, Tech",
                            imageKeyword: "sector_technology",
                          },
                        ]}
                        totalValue={economyData?.core.nominalGDP ?? 0}
                      />
                    </motion.div>
                  </motion.div>
                </TabsContent>

                {/* Trade & International Tab */}
                <TabsContent value="trade" className="space-y-4">
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                    className="space-y-4"
                  >
                    {/* Trade Summary Metrics */}
                    <motion.div variants={staggerItem}>
                      <MetricCardGrid
                        theme="economy"
                        columns={3}
                        metrics={[
                          {
                            id: "exports",
                            title: "Total Exports",
                            value: ((economyData?.core.nominalGDP ?? 0) * 0.35).toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                              notation: "compact",
                              maximumFractionDigits: 1,
                            }),
                            description: "35% of GDP",
                            icon: TrendingUp,
                            trend: { direction: "up", value: 2.3, label: "YoY" },
                            status: "success",
                            tooltip: "Total value of goods and services sold to foreign countries.",
                          },
                          {
                            id: "imports",
                            title: "Total Imports",
                            value: ((economyData?.core.nominalGDP ?? 0) * 0.32).toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                              notation: "compact",
                              maximumFractionDigits: 1,
                            }),
                            description: "32% of GDP",
                            icon: TrendingDown,
                            trend: { direction: "up", value: 1.8, label: "YoY" },
                            status: "info",
                            tooltip: "Total value of goods and services purchased from foreign countries.",
                          },
                          {
                            id: "balance",
                            title: "Trade Balance",
                            value: ((economyData?.core.nominalGDP ?? 0) * 0.03).toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                              notation: "compact",
                              maximumFractionDigits: 1,
                            }),
                            description: "Surplus +3% GDP",
                            icon: Target,
                            trend: { direction: "up", value: 0.5, label: "YoY" },
                            status: "success",
                            badge: { label: "Surplus", variant: "default" },
                            tooltip: "Exports minus imports. Positive = trade surplus, negative = trade deficit.",
                          },
                        ]}
                      />
                    </motion.div>

                    {/* Trade Composition Cards */}
                    <motion.div variants={staggerItem} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <SectorBreakdownCard
                        title="Export Composition"
                        subtitle="Distribution of goods and services exported"
                        layout="list"
                        showProgressBars={true}
                        sectors={[
                          { id: "manufactured", name: "Manufactured Goods", value: 0, percentage: 45, color: "blue", trend: "up", trendValue: 1.5 },
                          { id: "tech", name: "Technology Products", value: 0, percentage: 25, color: "cyan", trend: "up", trendValue: 3.2 },
                          { id: "services", name: "Services", value: 0, percentage: 15, color: "purple", trend: "stable" },
                          { id: "agri", name: "Agricultural Products", value: 0, percentage: 10, color: "green", trend: "down", trendValue: -0.8 },
                          { id: "raw", name: "Raw Materials", value: 0, percentage: 5, color: "amber", trend: "stable" },
                        ]}
                      />

                      <SectorBreakdownCard
                        title="Import Composition"
                        subtitle="Distribution of goods and services imported"
                        layout="list"
                        showProgressBars={true}
                        sectors={[
                          { id: "energy", name: "Energy & Fuels", value: 0, percentage: 30, color: "red", trend: "down", trendValue: -2.1 },
                          { id: "manufactured", name: "Manufactured Goods", value: 0, percentage: 25, color: "blue", trend: "stable" },
                          { id: "tech", name: "Technology Products", value: 0, percentage: 20, color: "cyan", trend: "up", trendValue: 1.8 },
                          { id: "raw", name: "Raw Materials", value: 0, percentage: 15, color: "amber", trend: "stable" },
                          { id: "food", name: "Food & Agricultural", value: 0, percentage: 10, color: "green", trend: "up", trendValue: 0.5 },
                        ]}
                      />
                    </motion.div>
                  </motion.div>
                </TabsContent>

                {/* Productivity Tab */}
                <TabsContent value="productivity" className="space-y-4">
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                    className="space-y-4"
                  >
                    <motion.div variants={staggerItem}>
                      <MetricCardGrid
                        theme="economy"
                        columns={4}
                        metrics={[
                          {
                            id: "labor-prod",
                            title: "Labor Productivity",
                            value: "125.0",
                            description: "Index (100 = baseline)",
                            icon: TrendingUp,
                            trend: { direction: "up", value: 2.5, label: "annually" },
                            status: "success",
                            tooltip: "Output per worker relative to a baseline of 100. Higher values indicate greater efficiency.",
                          },
                          {
                            id: "innovation",
                            title: "Innovation Index",
                            value: "72/100",
                            description: "Global ranking",
                            icon: Target,
                            trend: { direction: "up", value: 3, label: "positions" },
                            status: "success",
                            tooltip: "Composite score measuring R&D output, patents, and technological adoption.",
                          },
                          {
                            id: "rnd",
                            title: "R&D Investment",
                            value: "2.8%",
                            description: "Of GDP",
                            icon: Sparkles,
                            trend: { direction: "up", value: 0.2, label: "YoY" },
                            status: "info",
                            tooltip: "Research and development spending as a share of GDP. OECD average is ~2.5%.",
                          },
                          {
                            id: "competitiveness",
                            title: "Competitiveness",
                            value: "68/100",
                            description: "Global index",
                            icon: Activity,
                            trend: { direction: "stable" },
                            status: "info",
                            tooltip: "Global competitiveness score based on institutions, infrastructure, and market efficiency.",
                          },
                        ]}
                      />
                    </motion.div>

                    {/* Productivity Breakdown with animated progress bars */}
                    <motion.div variants={staggerItem}>
                      <SectorBreakdownCard
                        title="Productivity Metrics"
                        subtitle="Key performance indicators for economic efficiency"
                        layout="list"
                        showProgressBars={true}
                        showTrends={true}
                        sectors={[
                          { id: "infrastructure", name: "Infrastructure Quality", value: 0, percentage: 75, color: "blue", trend: "up", trendValue: 1.5 },
                          { id: "human-capital", name: "Human Capital Index", value: 0, percentage: 82, color: "purple", trend: "up", trendValue: 2.1 },
                          { id: "tech-adoption", name: "Technology Adoption", value: 0, percentage: 70, color: "emerald", trend: "up", trendValue: 3.8 },
                          { id: "business-env", name: "Business Environment", value: 0, percentage: 78, color: "amber", trend: "stable" },
                          { id: "digital-infra", name: "Digital Infrastructure", value: 0, percentage: 85, color: "cyan", trend: "up", trendValue: 4.2 },
                        ]}
                      />
                    </motion.div>
                  </motion.div>
                </TabsContent>

                {/* Income & Wealth Tab */}
                <TabsContent value="income" className="space-y-4">
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                    className="space-y-4"
                  >
                    {/* Income Summary Metrics */}
                    <motion.div variants={staggerItem}>
                      <MetricCardGrid
                        theme="economy"
                        columns={3}
                        metrics={[
                          {
                            id: "median-income",
                            title: "Median Income",
                            value: ((economyData?.core.gdpPerCapita ?? 0) * 0.75).toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                              maximumFractionDigits: 0,
                            }),
                            description: "Per year",
                            icon: DollarSign,
                            trend: { direction: "up", value: 2.8, label: "YoY" },
                            status: "success",
                            tooltip: "The middle-point annual income — half the population earns more, half earns less.",
                          },
                          {
                            id: "gini",
                            title: "Gini Coefficient",
                            value: "0.38",
                            description: "Moderate inequality",
                            icon: PieChart,
                            trend: { direction: "down", value: 0.02, label: "Improving" },
                            status: "success",
                            badge: { label: "Moderate", variant: "outline" },
                            tooltip: "Measures income inequality on a 0-1 scale. 0 = perfect equality, 1 = maximum inequality.",
                          },
                          {
                            id: "poverty",
                            title: "Poverty Rate",
                            value: "8.5%",
                            description: "Below poverty line",
                            icon: Users,
                            trend: { direction: "down", value: 0.3, label: "YoY" },
                            status: "warning",
                            tooltip: "Percentage of the population living below the national poverty line.",
                          },
                        ]}
                      />
                    </motion.div>

                    {/* Income Distribution with animated bars */}
                    <motion.div variants={staggerItem}>
                      <SectorBreakdownCard
                        title="Income Distribution"
                        subtitle="Population breakdown by income class"
                        layout="list"
                        showProgressBars={true}
                        showTrends={true}
                        sectors={[
                          { id: "lower", name: "Lower Class", value: (economyData?.core.gdpPerCapita ?? 0) * 0.3, percentage: 15, color: "red", trend: "down", trendValue: -0.5 },
                          { id: "lower-middle", name: "Lower Middle Class", value: (economyData?.core.gdpPerCapita ?? 0) * 0.6, percentage: 25, color: "amber", trend: "stable" },
                          { id: "middle", name: "Middle Class", value: (economyData?.core.gdpPerCapita ?? 0) * 0.9, percentage: 35, color: "green", trend: "up", trendValue: 1.2 },
                          { id: "upper-middle", name: "Upper Middle Class", value: (economyData?.core.gdpPerCapita ?? 0) * 1.5, percentage: 20, color: "blue", trend: "up", trendValue: 0.8 },
                          { id: "upper", name: "Upper Class", value: (economyData?.core.gdpPerCapita ?? 0) * 4.0, percentage: 5, color: "purple", trend: "stable" },
                        ]}
                      />
                    </motion.div>
                  </motion.div>
                </TabsContent>

                {/* Business Climate Tab */}
                <TabsContent value="business" className="space-y-4">
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                    className="space-y-4"
                  >
                    {/* Business Climate Metrics */}
                    <motion.div variants={staggerItem}>
                      <MetricCardGrid
                        theme="economy"
                        columns={4}
                        metrics={[
                          {
                            id: "ease-business",
                            title: "Ease of Doing Business",
                            value: "Rank #45",
                            description: "Out of 190 countries",
                            icon: Building,
                            trend: { direction: "up", value: 3, label: "positions" },
                            status: "success",
                            tooltip: "World Bank ranking of regulatory environment for starting and operating a business.",
                          },
                          {
                            id: "startups",
                            title: "Startup Formation",
                            value: "12.5",
                            description: "Per 1000 people",
                            icon: Sparkles,
                            trend: { direction: "up", value: 1.2, label: "YoY" },
                            status: "success",
                            tooltip: "New business registrations per 1,000 working-age population annually.",
                          },
                          {
                            id: "fdi",
                            title: "FDI Inflow",
                            value: ((economyData?.core.nominalGDP ?? 0) * 0.025).toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                              notation: "compact",
                              maximumFractionDigits: 1,
                            }),
                            description: "2.5% of GDP",
                            icon: Globe,
                            trend: { direction: "up", value: 8.5, label: "YoY" },
                            status: "success",
                            tooltip: "Foreign Direct Investment — capital invested by foreign entities into domestic businesses.",
                          },
                          {
                            id: "credit",
                            title: "Credit to Private Sector",
                            value: "85%",
                            description: "Of GDP",
                            icon: DollarSign,
                            trend: { direction: "up", value: 2.1, label: "YoY" },
                            status: "info",
                            tooltip: "Total domestic credit provided to the private sector as a share of GDP. Indicates financial depth.",
                          },
                        ]}
                      />
                    </motion.div>

                    {/* Business Environment & Demographics */}
                    <motion.div variants={staggerItem} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <SectorBreakdownCard
                        title="Business Environment"
                        subtitle="Key regulatory and operational metrics"
                        layout="list"
                        showProgressBars={true}
                        sectors={[
                          { id: "time", name: "Time to Start a Business", value: 0, percentage: 92, color: "green", description: "8 days" },
                          { id: "cost", name: "Cost to Start (% of income)", value: 0, percentage: 97.5, color: "blue", description: "2.5%" },
                          { id: "regulatory", name: "Regulatory Quality", value: 0, percentage: 72, color: "purple", trend: "up", trendValue: 2.3 },
                          { id: "finance", name: "Access to Finance", value: 0, percentage: 68, color: "amber", trend: "up", trendValue: 1.5 },
                        ]}
                      />

                      <SectorBreakdownCard
                        title="Business Demographics"
                        subtitle="Distribution of business by size"
                        layout="list"
                        showProgressBars={true}
                        sectors={[
                          { id: "small", name: "Small Businesses (0-50)", value: 0, percentage: 85, color: "green" },
                          { id: "medium", name: "Medium Businesses (50-250)", value: 0, percentage: 12, color: "blue" },
                          { id: "large", name: "Large Businesses (250+)", value: 0, percentage: 3, color: "purple" },
                          { id: "entrepreneurship", name: "Entrepreneurship Rate", value: 0, percentage: 15.2, color: "amber", trend: "up", trendValue: 0.8 },
                        ]}
                      />
                    </motion.div>
                  </motion.div>
                </TabsContent>
              </Tabs>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
            <WikiLoreBlock context="economy" themeColor="emerald" title="Economic Lore" />
          </ThemedTabContent>
        </TabsContent>

        {/* Labor Tab */}
        <TabsContent value="labor" id="labor">
          <ThemedTabContent theme="labor" className="space-y-4">
            <TabHeroBanner context="overview_labor" title="Labor & Workforce" subtitle="Employment, wages, and human capital" icon={Briefcase} accentColor="red" />
            <Tabs defaultValue="workforce" className="space-y-4">
              <div className="flex justify-center mb-2">
                <TabsList className="subtab-pills subtab-pills-labor">
                  <TabsTrigger value="workforce" className="subtab-pill subtab-pill-labor">
                    <Users className="subtab-icon h-4 w-4" />
                    <span>Workforce</span>
                  </TabsTrigger>
                  <TabsTrigger value="compensation" className="subtab-pill subtab-pill-labor">
                    <DollarSign className="subtab-icon h-4 w-4" />
                    <span>Compensation</span>
                  </TabsTrigger>
                  <TabsTrigger value="human-capital" className="subtab-pill subtab-pill-labor">
                    <TrendingUp className="subtab-icon h-4 w-4" />
                    <span>Human Capital</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Workforce Sub-Tab */}
              <TabsContent value="workforce" className="space-y-4">
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="space-y-4"
                >
                  {/* Labor Force Overview */}
                  <motion.div variants={staggerItem}>
                    <MetricCardGrid
                      theme="labor"
                      columns={4}
                      title="Labor Force Overview"
                      subtitle={`Workforce statistics for ${country.name}`}
                      backgroundImage={{
                        countryId: country.id,
                        cardType: "labor",
                        showEditButton: true,
                        onEditClick: () => setImageUploadModal({ isOpen: true, cardType: "labor" }),
                        autoFallback: true,
                        countryImageData: countryImageData ?? undefined,
                      }}
                      metrics={[
                        {
                          id: "labor-force",
                          title: "Labor Force",
                          value: (economyData?.labor?.totalWorkforce ?? 0).toLocaleString(),
                          icon: Users,
                          description: "Active workforce",
                          onClick: () => openMetricModal("labor-force", country.id),
                          tooltip: "Total number of people employed or actively seeking employment.",
                        },
                        {
                          id: "participation",
                          title: "Participation Rate",
                          value: `${(economyData?.labor?.laborForceParticipationRate ?? 0).toFixed(1)}%`,
                          icon: Briefcase,
                          trend: (economyData?.labor?.laborForceParticipationRate ?? 0) > 60 ? "up" : "down",
                          description: "Working age population in workforce",
                          onClick: () => openMetricModal("labor-force", country.id),
                          tooltip: "Percentage of working-age population (15-64) participating in the labor force.",
                        },
                        {
                          id: "employment",
                          title: "Employment Rate",
                          value: `${(economyData?.labor?.employmentRate ?? 0).toFixed(1)}%`,
                          icon: TrendingUp,
                          trend: (economyData?.labor?.employmentRate ?? 0) > 90 ? "up" : "stable",
                          description: "Of labor force employed",
                          onClick: () => openMetricModal("employment", country.id),
                          tooltip: "Percentage of the labor force that is currently employed in any capacity.",
                        },
                        {
                          id: "unemployment",
                          title: "Unemployment Rate",
                          value: `${(economyData?.labor?.unemploymentRate ?? 0).toFixed(1)}%`,
                          icon: TrendingDown,
                          trend: (economyData?.labor?.unemploymentRate ?? 0) < 5 ? "up" : "down",
                          description: "Seeking employment",
                          onClick: () => openMetricModal("unemployment", country.id),
                          tooltip: "Percentage of the labor force that is actively seeking but unable to find work.",
                        },
                      ]}
                    />
                  </motion.div>

                  {/* Employment by Sector */}
                  <motion.div variants={staggerItem}>
                    <SectorBreakdownCard
                      title="Employment by Sector"
                      subtitle="Distribution of workforce across economic sectors"
                      layout="grid"
                      showTrends={true}
                      showSectorImages={true}
                      valueAsPeople={true}
                      sectors={[
                        {
                          id: "agriculture",
                          name: "Agriculture",
                          value: (economyData?.labor?.totalWorkforce ?? 0) * ((economyData?.labor?.employmentBySector?.agriculture ?? 0) / 100),
                          percentage: economyData?.labor?.employmentBySector?.agriculture ?? 0,
                          color: "green",
                          trend: "stable",
                          description: "Farming, forestry, fishing",
                          imageKeyword: "sector_agriculture",
                        },
                        {
                          id: "industry",
                          name: "Industry",
                          value: (economyData?.labor?.totalWorkforce ?? 0) * ((economyData?.labor?.employmentBySector?.industry ?? 0) / 100),
                          percentage: economyData?.labor?.employmentBySector?.industry ?? 0,
                          color: "blue",
                          trend: "stable",
                          description: "Manufacturing, construction",
                          imageKeyword: "sector_industry",
                        },
                        {
                          id: "services",
                          name: "Services",
                          value: (economyData?.labor?.totalWorkforce ?? 0) * ((economyData?.labor?.employmentBySector?.services ?? 0) / 100),
                          percentage: economyData?.labor?.employmentBySector?.services ?? 0,
                          color: "purple",
                          trend: "up",
                          trendValue: 1.5,
                          description: "Trade, finance, healthcare",
                          imageKeyword: "sector_services",
                        },
                      ]}
                      totalValue={economyData?.labor?.totalWorkforce ?? 0}
                    />
                  </motion.div>
                </motion.div>
              </TabsContent>

              {/* Compensation Sub-Tab */}
              <TabsContent value="compensation" className="space-y-4">
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="space-y-4"
                >
                  {/* Income & Work Conditions */}
                  <motion.div variants={staggerItem}>
                    <MetricCardGrid
                      theme="labor"
                      columns={4}
                      title="Income & Work Conditions"
                      subtitle="Wages and working standards"
                      metrics={[
                        {
                          id: "avg-income",
                          title: "Average Annual Income",
                          value: (economyData?.labor?.averageAnnualIncome ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
                          icon: DollarSign,
                          description: "Mean annual earnings",
                          tooltip: "Mean annual gross earnings across all employed workers before taxes.",
                        },
                        {
                          id: "min-wage",
                          title: "Minimum Wage",
                          value: (economyData?.labor?.minimumWage ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
                          icon: DollarSign,
                          description: "Per year",
                          tooltip: "Legally mandated minimum annual wage for full-time employment.",
                        },
                        {
                          id: "work-week",
                          title: "Average Work Week",
                          value: `${economyData?.labor?.averageWorkweekHours ?? 0}h`,
                          icon: Activity,
                          description: "Hours per week",
                          tooltip: "Average number of hours worked per week by full-time employees.",
                        },
                        {
                          id: "productivity",
                          title: "Productivity Index",
                          value: `${(economyData?.labor?.skillsAndProductivity?.laborProductivityIndex ?? 0).toFixed(0)}`,
                          icon: TrendingUp,
                          trend: (economyData?.labor?.skillsAndProductivity?.productivityGrowthRate ?? 0) > 0 ? "up" : "stable",
                          trendValue: economyData?.labor?.skillsAndProductivity?.productivityGrowthRate ?? 0,
                          description: "Labor output efficiency",
                          tooltip: "Economic output per worker-hour. Higher values indicate greater labor efficiency.",
                        },
                      ]}
                    />
                  </motion.div>

                  {/* Employment Types */}
                  <motion.div variants={staggerItem}>
                    <SectorBreakdownCard
                      title="Employment Types"
                      subtitle="Breakdown by employment arrangement"
                      layout="list"
                      showProgressBars={true}
                      sectors={[
                        {
                          id: "fulltime",
                          name: "Full-Time",
                          percentage: economyData?.labor?.employmentByType?.fullTime ?? 0,
                          color: "emerald",
                        },
                        {
                          id: "parttime",
                          name: "Part-Time",
                          percentage: economyData?.labor?.employmentByType?.partTime ?? 0,
                          color: "blue",
                        },
                        {
                          id: "selfemployed",
                          name: "Self-Employed",
                          percentage: economyData?.labor?.employmentByType?.selfEmployed ?? 0,
                          color: "amber",
                        },
                        {
                          id: "temporary",
                          name: "Temporary",
                          percentage: economyData?.labor?.employmentByType?.temporary ?? 0,
                          color: "purple",
                        },
                        {
                          id: "informal",
                          name: "Informal",
                          percentage: economyData?.labor?.employmentByType?.informal ?? 0,
                          color: "red",
                        },
                      ]}
                    />
                  </motion.div>
                </motion.div>
              </TabsContent>

              {/* Human Capital Sub-Tab */}
              <TabsContent value="human-capital" className="space-y-4">
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="space-y-4"
                >
                  {/* Skills & Education */}
                  <motion.div variants={staggerItem}>
                    <MetricCardGrid
                      theme="labor"
                      columns={3}
                      title="Skills & Education"
                      subtitle="Workforce qualifications"
                      metrics={[
                        {
                          id: "education-years",
                          title: "Avg Education Years",
                          value: `${(economyData?.labor?.skillsAndProductivity?.averageEducationYears ?? 0).toFixed(1)} years`,
                          icon: Users,
                          description: "Mean schooling duration",
                          tooltip: "Average number of years of formal education completed by working-age adults.",
                        },
                        {
                          id: "tertiary",
                          title: "Tertiary Education",
                          value: `${(economyData?.labor?.skillsAndProductivity?.tertiaryEducationRate ?? 0).toFixed(1)}%`,
                          icon: Users,
                          description: "University/college graduates",
                          tooltip: "Share of the workforce holding a university degree or equivalent qualification.",
                        },
                        {
                          id: "vocational",
                          title: "Vocational Training",
                          value: `${(economyData?.labor?.skillsAndProductivity?.vocationalTrainingRate ?? 0).toFixed(1)}%`,
                          icon: Users,
                          description: "Technical certification",
                          tooltip: "Share of the workforce with vocational or technical certifications.",
                        },
                      ]}
                    />
                  </motion.div>

                  {/* Labor Demographics */}
                  <motion.div variants={staggerItem}>
                    <MetricCardGrid
                      theme="labor"
                      columns={4}
                      title="Labor Demographics"
                      subtitle="Workforce composition and conditions"
                      metrics={[
                        {
                          id: "youth-unemployment",
                          title: "Youth Unemployment",
                          value: `${(economyData?.labor?.demographicsAndConditions?.youthUnemploymentRate ?? 0).toFixed(1)}%`,
                          icon: Users,
                          trend: (economyData?.labor?.demographicsAndConditions?.youthUnemploymentRate ?? 0) < 15 ? "up" : "down",
                          description: "Ages 15-24",
                          tooltip: "Unemployment rate among people aged 15-24. High rates signal structural labor market issues.",
                        },
                        {
                          id: "female-participation",
                          title: "Female Participation",
                          value: `${(economyData?.labor?.demographicsAndConditions?.femaleParticipationRate ?? 0).toFixed(1)}%`,
                          icon: Users,
                          description: "Women in workforce",
                          tooltip: "Percentage of working-age women who are employed or actively seeking employment.",
                        },
                        {
                          id: "unionization",
                          title: "Unionization Rate",
                          value: `${(economyData?.labor?.demographicsAndConditions?.unionizationRate ?? 0).toFixed(1)}%`,
                          icon: Users,
                          description: "Union membership",
                          tooltip: "Share of the workforce that belongs to a labor union or trade association.",
                        },
                        {
                          id: "safety",
                          title: "Workplace Safety",
                          value: `${(economyData?.labor?.demographicsAndConditions?.workplaceSafetyIndex ?? 0).toFixed(0)}/100`,
                          icon: Activity,
                          trend: (economyData?.labor?.demographicsAndConditions?.workplaceSafetyIndex ?? 0) > 70 ? "up" : "stable",
                          description: "Safety index score",
                          tooltip: "Composite index measuring occupational safety standards and incident rates. 100 = safest.",
                        },
                      ]}
                    />
                  </motion.div>
                </motion.div>
              </TabsContent>
            </Tabs>
            <WikiLoreBlock context="labor" themeColor="blue" title="Labor & Education Lore" />
          </ThemedTabContent>
        </TabsContent>

        {/* Government Tab */}
        <TabsContent value="government" className="space-y-4" id="government">
          <ThemedTabContent theme="government" className="space-y-4">
            <TabHeroBanner context="overview_government" title="Government & Fiscal" subtitle="Structure, spending, and fiscal policy" icon={Building} accentColor="amber" />
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="space-y-4"
            >
              {/* Editor Navigation Card */}
              <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50/50 to-yellow-50/50 p-3 dark:border-amber-700/40 dark:from-amber-950/20 dark:to-yellow-950/20">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <p className="text-muted-foreground text-sm">
                    Edit your tax system, government structure, and budgets in the <strong>MyCountry Editor</strong>
                  </p>
                </div>
                <Link href={"/mycountry/editor"}>
                  <Button size="sm" className="gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white hover:from-amber-600 hover:to-yellow-600">
                    <DollarSign className="h-3 w-3" />
                    Open Editor
                  </Button>
                </Link>
              </div>

              <Card className="glass-surface glass-refraction border-border overflow-hidden">
                <SectionHeaderBackground context="overview_government" overlayOpacity={0.88}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <Building className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      Government Structure & Overview
                    </CardTitle>
                  </CardHeader>
                </SectionHeaderBackground>
                <CardContent>
              {/* Government Sub-Tabs with Pill Styling */}
              <Tabs defaultValue="structure" className="space-y-4">
                <div className="flex justify-center mb-2">
                  <TabsList className="subtab-pills subtab-pills-government">
                    <TabsTrigger
                      value="structure"
                      className="subtab-pill subtab-pill-government"
                    >
                      <Crown className="subtab-icon h-4 w-4" />
                      <span>Structure</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="spending"
                      className="subtab-pill subtab-pill-government"
                    >
                      <DollarSign className="subtab-icon h-4 w-4" />
                      <span>Budget</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="fiscal"
                      className="subtab-pill subtab-pill-government"
                    >
                      <Building className="subtab-icon h-4 w-4" />
                      <span>Fiscal</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Structure & Branches Tab */}
                <TabsContent value="structure" className="space-y-4">
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                    className="space-y-4"
                  >
                    {/* Government Leadership */}
                    <motion.div variants={staggerItem}>
                      <MetricCardGrid
                        theme="government"
                        columns={2}
                        title="Government Leadership"
                        subtitle="Executive leadership and offices"
                        backgroundImage={{
                          countryId: country.id,
                          cardType: "head_of_state",
                          showEditButton: true,
                          onEditClick: () => setImageUploadModal({ isOpen: true, cardType: "head_of_state" }),
                          autoFallback: true,
                          countryImageData: countryImageData ?? undefined,
                        }}
                        metrics={[
                          ...(governmentStructure?.headOfState ? [{
                            id: "head-of-state",
                            title: "Head of State",
                            value: governmentStructure.headOfState,
                            icon: Crown,
                            description: governmentStructure.governmentType || "State leader",
                            tooltip: "The chief public representative and ceremonial leader of the nation.",
                          }] : []),
                          ...(governmentStructure?.headOfGovernment ? [{
                            id: "head-of-gov",
                            title: "Head of Government",
                            value: governmentStructure.headOfGovernment,
                            icon: Building,
                            description: "Executive leader",
                            tooltip: "The chief executive who directs government operations and policy.",
                          }] : []),
                        ]}
                      />
                    </motion.div>

                    {/* Government Branches */}
                    <motion.div variants={staggerItem}>
                      <MetricCardGrid
                        theme="government"
                        columns={3}
                        title="Government Branches"
                        subtitle="Legislative, Executive, and Judicial institutions"
                        backgroundImage={{
                          countryId: country.id,
                          cardType: "government",
                          showEditButton: true,
                          onEditClick: () => setImageUploadModal({ isOpen: true, cardType: "government" }),
                          autoFallback: true,
                          countryImageData: countryImageData ?? undefined,
                        }}
                        metrics={[
                          ...(governmentStructure?.legislatureName ? [{
                            id: "legislature",
                            title: "Legislature",
                            value: governmentStructure.legislatureName,
                            icon: Building,
                            description: governmentStructure.legislatureType || "Legislative body",
                            tooltip: "The primary lawmaking body responsible for enacting and amending legislation.",
                          }] : []),
                          ...(governmentStructure?.executiveName ? [{
                            id: "executive",
                            title: "Executive",
                            value: governmentStructure.executiveName,
                            icon: Building,
                            description: "Executive branch",
                            tooltip: "The branch responsible for implementing and enforcing laws and policies.",
                          }] : []),
                          ...(governmentStructure?.judicialName ? [{
                            id: "judicial",
                            title: "Judiciary",
                            value: governmentStructure.judicialName,
                            icon: Building,
                            description: "Judicial branch",
                            tooltip: "The branch responsible for interpreting laws and administering justice.",
                          }] : []),
                        ]}
                      />
                    </motion.div>

                    {/* Government Type Info */}
                    <motion.div variants={staggerItem}>
                      <Card className="glass-surface glass-refraction border-border">
                        <CardContent className="p-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="p-3 rounded-lg bg-white/50 dark:bg-black/20">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Government Type</p>
                              <p className="font-semibold text-amber-700 dark:text-amber-400">{governmentStructure?.governmentType || country.nationalIdentity?.governmentType || "N/A"}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-white/50 dark:bg-black/20">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Official Name</p>
                              <p className="font-semibold text-amber-700 dark:text-amber-400">{governmentStructure?.governmentName || country.nationalIdentity?.officialName || country.name}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-white/50 dark:bg-black/20">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Capital</p>
                              <p className="font-semibold text-amber-700 dark:text-amber-400">{country.nationalIdentity?.capitalCity || "N/A"}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-white/50 dark:bg-black/20">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Currency</p>
                              <p className="font-semibold text-amber-700 dark:text-amber-400">{country.nationalIdentity?.currency || "N/A"}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </motion.div>
                </TabsContent>

                {/* Spending & Budget Tab */}
                <TabsContent value="spending" className="space-y-4">
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                    className="space-y-4"
                  >
                    {/* Budget Overview */}
                    <motion.div variants={staggerItem}>
                      <MetricCardGrid
                        theme="government"
                        columns={4}
                        title="Budget Overview"
                        subtitle="Government spending metrics"
                        metrics={[
                          {
                            id: "total-spending",
                            title: "Total Spending",
                            value: (economyData?.spending?.totalSpending ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }),
                            icon: DollarSign,
                            description: "Annual government expenditure",
                            onClick: () => openMetricModal("government-spending", country.id),
                            tooltip: "Total annual government spending across all departments, programs, and transfers.",
                          },
                          {
                            id: "spending-gdp",
                            title: "Spending % of GDP",
                            value: `${(economyData?.spending?.spendingGDPPercent ?? 0).toFixed(1)}%`,
                            icon: TrendingUp,
                            description: "Government share of economy",
                            onClick: () => openMetricModal("government-spending", country.id),
                            tooltip: "Government expenditure as a share of total GDP. Indicates the size of the public sector.",
                          },
                          {
                            id: "spending-capita",
                            title: "Per Capita",
                            value: (economyData?.spending?.spendingPerCapita ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
                            icon: Users,
                            description: "Spending per person",
                            onClick: () => openMetricModal("government-spending", country.id),
                            tooltip: "Total government spending divided by population. Shows per-person public investment.",
                          },
                          {
                            id: "balance",
                            title: "Budget Balance",
                            value: (economyData?.spending?.deficitSurplus ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }),
                            icon: (economyData?.spending?.deficitSurplus ?? 0) >= 0 ? TrendingUp : TrendingDown,
                            trend: (economyData?.spending?.deficitSurplus ?? 0) >= 0 ? "up" : "down",
                            description: (economyData?.spending?.deficitSurplus ?? 0) >= 0 ? "Surplus" : "Deficit",
                            onClick: () => openMetricModal("government-spending", country.id),
                            tooltip: "Revenue minus spending. Positive = budget surplus, negative = budget deficit.",
                          },
                        ]}
                      />
                    </motion.div>

                    {/* Spending Categories */}
                    <motion.div variants={staggerItem}>
                      <SectorBreakdownCard
                        title="Spending by Category"
                        subtitle="Budget allocation across government functions"
                        layout="list"
                        showProgressBars={true}
                        sectors={[
                          {
                            id: "education",
                            name: "Education",
                            value: economyData?.spending?.education ?? 0,
                            percentage: ((economyData?.spending?.education ?? 0) / (economyData?.spending?.totalSpending || 1)) * 100,
                            color: "blue",
                          },
                          {
                            id: "healthcare",
                            name: "Healthcare",
                            value: economyData?.spending?.healthcare ?? 0,
                            percentage: ((economyData?.spending?.healthcare ?? 0) / (economyData?.spending?.totalSpending || 1)) * 100,
                            color: "emerald",
                          },
                          {
                            id: "social",
                            name: "Social Safety",
                            value: economyData?.spending?.socialSafety ?? 0,
                            percentage: ((economyData?.spending?.socialSafety ?? 0) / (economyData?.spending?.totalSpending || 1)) * 100,
                            color: "purple",
                          },
                          ...(economyData?.spending?.spendingCategories ?? [])
                            .filter((cat: any) => !['education', 'healthcare', 'social services', 'social safety'].includes(cat.category?.toLowerCase()))
                            .slice(0, 5).map((cat: any, idx: number) => ({
                            id: cat.category?.toLowerCase().replace(/\s+/g, '-') ?? `cat-${idx}`,
                            name: cat.category ?? 'Other',
                            value: cat.amount ?? 0,
                            percentage: cat.gdpPercent ?? 0,
                            color: ['amber', 'cyan', 'rose', 'indigo', 'teal'][idx % 5],
                          })),
                        ]}
                        totalValue={economyData?.spending?.totalSpending ?? 0}
                      />
                    </motion.div>

                    {/* Policy Initiatives */}
                    <motion.div variants={staggerItem}>
                      <Card className="glass-surface glass-refraction border-border">
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                            <Target className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            Policy Initiatives
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className={`p-3 rounded-lg glass-hierarchy-child flex items-center gap-2 ${economyData?.spending?.performanceBasedBudgeting ? 'border-emerald-300 dark:border-emerald-700/50' : ''} border`}>
                              {economyData?.spending?.performanceBasedBudgeting ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" /> : <Circle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
                              <p className="text-sm font-medium">Performance Budgeting</p>
                            </div>
                            <div className={`p-3 rounded-lg glass-hierarchy-child flex items-center gap-2 ${economyData?.spending?.universalBasicServices ? 'border-emerald-300 dark:border-emerald-700/50' : ''} border`}>
                              {economyData?.spending?.universalBasicServices ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" /> : <Circle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
                              <p className="text-sm font-medium">Universal Services</p>
                            </div>
                            <div className={`p-3 rounded-lg glass-hierarchy-child flex items-center gap-2 ${economyData?.spending?.greenInvestmentPriority ? 'border-emerald-300 dark:border-emerald-700/50' : ''} border`}>
                              {economyData?.spending?.greenInvestmentPriority ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" /> : <Circle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
                              <p className="text-sm font-medium">Green Investment</p>
                            </div>
                            <div className={`p-3 rounded-lg glass-hierarchy-child flex items-center gap-2 ${economyData?.spending?.digitalGovernmentInitiative ? 'border-emerald-300 dark:border-emerald-700/50' : ''} border`}>
                              {economyData?.spending?.digitalGovernmentInitiative ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" /> : <Circle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
                              <p className="text-sm font-medium">Digital Government</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </motion.div>
                </TabsContent>

                {/* Fiscal System Tab */}
                <TabsContent value="fiscal" className="space-y-4">
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                    className="space-y-4"
                  >
                    {/* Revenue Overview */}
                    <motion.div variants={staggerItem}>
                      <MetricCardGrid
                        theme="government"
                        columns={4}
                        title="Revenue & Taxation"
                        subtitle="Government revenue metrics"
                        metrics={[
                          {
                            id: "total-revenue",
                            title: "Total Revenue",
                            value: (economyData?.fiscal?.governmentRevenueTotal ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }),
                            icon: DollarSign,
                            description: "Annual government revenue",
                            tooltip: "Total annual government income from taxes, fees, and other sources.",
                          },
                          {
                            id: "tax-gdp",
                            title: "Tax Revenue % GDP",
                            value: `${(economyData?.fiscal?.taxRevenueGDPPercent ?? 0).toFixed(1)}%`,
                            icon: TrendingUp,
                            description: "Tax burden as share of GDP",
                            tooltip: "Total tax revenue as a percentage of GDP. Indicates the overall tax burden on the economy.",
                          },
                          {
                            id: "tax-capita",
                            title: "Tax per Capita",
                            value: (economyData?.fiscal?.taxRevenuePerCapita ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
                            icon: Users,
                            description: "Average tax per person",
                            tooltip: "Total tax revenue divided by population. Shows the average tax contribution per citizen.",
                          },
                          {
                            id: "budget-balance",
                            title: "Budget Balance",
                            value: (economyData?.fiscal?.budgetDeficitSurplus ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }),
                            icon: (economyData?.fiscal?.budgetDeficitSurplus ?? 0) >= 0 ? TrendingUp : TrendingDown,
                            trend: (economyData?.fiscal?.budgetDeficitSurplus ?? 0) >= 0 ? "up" : "down",
                            description: (economyData?.fiscal?.budgetDeficitSurplus ?? 0) >= 0 ? "Surplus" : "Deficit",
                            tooltip: "Revenue minus expenditure. Positive = surplus, negative = deficit.",
                          },
                        ]}
                      />
                    </motion.div>

                    {/* Debt Overview */}
                    <motion.div variants={staggerItem}>
                      <MetricCardGrid
                        theme="government"
                        columns={4}
                        title="Government Debt"
                        subtitle="Public debt indicators"
                        metrics={[
                          {
                            id: "total-debt",
                            title: "Total Debt/GDP",
                            value: `${(economyData?.fiscal?.totalDebtGDPRatio ?? 0).toFixed(1)}%`,
                            icon: TrendingUp,
                            trend: (economyData?.fiscal?.totalDebtGDPRatio ?? 0) < 60 ? "up" : "down",
                            description: "Public debt ratio",
                            onClick: () => openMetricModal("debt", country.id),
                            tooltip: "Total government debt as a percentage of GDP. Below 60% is generally considered sustainable.",
                          },
                          {
                            id: "internal-debt",
                            title: "Internal Debt",
                            value: `${(economyData?.fiscal?.internalDebtGDPPercent ?? 0).toFixed(1)}%`,
                            icon: Building,
                            description: "Domestic debt % GDP",
                            onClick: () => openMetricModal("debt", country.id),
                            tooltip: "Debt owed to domestic creditors (banks, citizens, institutions) as a share of GDP.",
                          },
                          {
                            id: "external-debt",
                            title: "External Debt",
                            value: `${(economyData?.fiscal?.externalDebtGDPPercent ?? 0).toFixed(1)}%`,
                            icon: Globe,
                            description: "Foreign debt % GDP",
                            onClick: () => openMetricModal("debt", country.id),
                            tooltip: "Debt owed to foreign creditors and international institutions as a share of GDP.",
                          },
                          {
                            id: "debt-capita",
                            title: "Debt per Capita",
                            value: (economyData?.fiscal?.debtPerCapita ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
                            icon: Users,
                            description: "Public debt per person",
                            onClick: () => openMetricModal("debt", country.id),
                            tooltip: "Total public debt divided by population. Shows each citizen's theoretical share of national debt.",
                          },
                        ]}
                      />
                    </motion.div>

                    {/* Tax Rates */}
                    <motion.div variants={staggerItem}>
                      <SectorBreakdownCard
                        title="Tax Rates"
                        subtitle="Key taxation rates and levies"
                        layout="grid"
                        showTrends={false}
                        sectors={[
                          {
                            id: "sales-tax",
                            name: "Sales Tax",
                            percentage: economyData?.fiscal?.taxRates?.salesTaxRate ?? 0,
                            color: "blue",
                            description: "VAT/Sales tax rate",
                          },
                          {
                            id: "property-tax",
                            name: "Property Tax",
                            percentage: economyData?.fiscal?.taxRates?.propertyTaxRate ?? 0,
                            color: "emerald",
                            description: "Real estate tax rate",
                          },
                          {
                            id: "payroll-tax",
                            name: "Payroll Tax",
                            percentage: economyData?.fiscal?.taxRates?.payrollTaxRate ?? 0,
                            color: "amber",
                            description: "Social security contributions",
                          },
                          {
                            id: "wealth-tax",
                            name: "Wealth Tax",
                            percentage: economyData?.fiscal?.taxRates?.wealthTaxRate ?? 0,
                            color: "purple",
                            description: "Tax on net worth",
                          },
                        ]}
                      />
                    </motion.div>

                    {/* Interest & Debt Service */}
                    <motion.div variants={staggerItem}>
                      <MetricCardGrid
                        theme="government"
                        columns={2}
                        title="Debt Servicing"
                        subtitle="Interest and repayment obligations"
                        metrics={[
                          {
                            id: "interest-rate",
                            title: "Interest Rate",
                            value: `${(economyData?.fiscal?.interestRates ?? 0).toFixed(2)}%`,
                            icon: TrendingUp,
                            description: "Avg borrowing rate",
                            tooltip: "Weighted average interest rate the government pays on its outstanding debt.",
                          },
                          {
                            id: "debt-service",
                            title: "Debt Service Costs",
                            value: (economyData?.fiscal?.debtServiceCosts ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }),
                            icon: DollarSign,
                            description: "Annual interest payments",
                            tooltip: "Annual cost of servicing government debt, including interest and principal payments.",
                          },
                        ]}
                      />
                    </motion.div>
                  </motion.div>
                </TabsContent>
              </Tabs>
                </CardContent>
              </Card>
            </motion.div>
            <WikiLoreBlock context="government" themeColor="amber" title="Government Lore" />
          </ThemedTabContent>
        </TabsContent>

        {/* Demographics and Analytics tabs removed — demographics belongs in Intelligence (premium),
            analytics belongs in Dashboard World section. See cross-pillar refactor plan. */}
      </AnimatedTabContent>

      {/* Render premium upgrade teaser */}
      {renderPremiumUpgradeTeaser()}

      {/* Card Image Upload Modal */}
      <CardImageUploadModal
        isOpen={imageUploadModal.isOpen}
        onClose={() => setImageUploadModal({ ...imageUploadModal, isOpen: false })}
        countryId={country?.id || ""}
        cardType={imageUploadModal.cardType}
      />

      {/* Metric Detail Modals */}
      {(metricType === "gdp" || metricType === "gdp-per-capita" || metricType === "total-gdp") && (
        <GdpDetailsModal
          isOpen={isMetricModalOpen}
          onClose={closeMetricModal}
          countryId={modalCountryId || country?.id || ""}
          countryName={country?.name}
        />
      )}

      {(metricType === "population" || metricType === "population-density") && (
        <PopulationDetailsModal
          isOpen={isMetricModalOpen}
          onClose={closeMetricModal}
          countryId={modalCountryId || country?.id || ""}
          countryName={country?.name}
        />
      )}

      {(metricType === "labor-force" || metricType === "employment" || metricType === "unemployment") && (
        <LaborDetailsModal
          isOpen={isMetricModalOpen}
          onClose={closeMetricModal}
          countryId={modalCountryId || country?.id || ""}
          countryName={country?.name}
        />
      )}

      {metricType === "government-spending" && (
        <GovernmentSpendingModal
          isOpen={isMetricModalOpen}
          onClose={closeMetricModal}
          countryId={modalCountryId || country?.id || ""}
          countryName={country?.name}
        />
      )}

      {metricType === "debt" && (
        <DebtAnalysisModal
          isOpen={isMetricModalOpen}
          onClose={closeMetricModal}
          countryId={modalCountryId || country?.id || ""}
          countryName={country?.name}
        />
      )}

      {(metricType === "demographics-health" || metricType === "life-expectancy") && (
        <DemographicsHealthModal
          isOpen={isMetricModalOpen}
          onClose={closeMetricModal}
          countryId={modalCountryId || country?.id || ""}
          countryName={country?.name}
        />
      )}
    </Tabs>
  );
}

MyCountryTabSystemComponent.displayName = "MyCountryTabSystem";


// Compact issues banner for the Overview tab
export function OverviewIssuesBanner({ countryId }: { countryId: string }) {
  const { total, urgent } = useIssueCount(countryId);

  if (total === 0) return null;

  const navigateToIssues = () => {
    window.history.pushState({}, "", "/mycountry/executive");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <motion.div variants={staggerItem}>
      <button
        onClick={navigateToIssues}
        className={cn(
          "w-full rounded-xl border p-3 text-left transition-all hover:shadow-md",
          urgent > 0
            ? "border-red-500/30 bg-red-500/5 hover:border-red-500/50"
            : "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              urgent > 0 ? "bg-red-500/15" : "bg-amber-500/15"
            )}>
              {urgent > 0 ? (
                <AlertTriangle className="h-4.5 w-4.5 text-red-500" />
              ) : (
                <Bell className="h-4.5 w-4.5 text-amber-500" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {total} National Issue{total !== 1 ? "s" : ""} Pending
                </span>
                {urgent > 0 && (
                  <Badge variant="outline" className="border-red-500/30 bg-red-500/10 px-1.5 py-0 text-[10px] font-bold text-red-500">
                    {urgent} URGENT
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {urgent > 0
                  ? "Urgent issues require your immediate attention"
                  : "Review and respond to pending national issues"}
              </p>
            </div>
          </div>
          <ChevronRight className={cn(
            "h-4 w-4",
            urgent > 0 ? "text-red-500" : "text-amber-500"
          )} />
        </div>
      </button>
    </motion.div>
  );
}

// ─── Overview Identity Field Config ──────────────────────────────────────────

const OVERVIEW_IDENTITY_FIELDS: Array<{
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  getValue: (ni: any) => string | null;
}> = [
  { key: "governmentType", label: "Government", icon: Landmark, color: "text-amber-600 dark:text-amber-400", getValue: (ni) => ni.governmentType },
  { key: "capitalCity", label: "Capital", icon: MapPin, color: "text-blue-600 dark:text-blue-400", getValue: (ni) => ni.capitalCity },
  { key: "officialLanguages", label: "Languages", icon: Globe2, color: "text-purple-600 dark:text-purple-400", getValue: (ni) => ni.officialLanguages },
  { key: "currency", label: "Currency", icon: DollarSign, color: "text-emerald-600 dark:text-emerald-400", getValue: (ni) => ni.currency ? `${ni.currency}${ni.currencySymbol ? ` (${ni.currencySymbol})` : ""}` : null },
  { key: "demonym", label: "Demonym", icon: Users, color: "text-rose-600 dark:text-rose-400", getValue: (ni) => ni.demonym },
  { key: "callingCode", label: "Calling Code", icon: Globe, color: "text-indigo-600 dark:text-indigo-400", getValue: (ni) => ni.callingCode },
  { key: "timeZone", label: "Time Zone", icon: Clock, color: "text-cyan-600 dark:text-cyan-400", getValue: (ni) => ni.timeZone },
  { key: "internetTLD", label: "Internet TLD", icon: Globe, color: "text-orange-600 dark:text-orange-400", getValue: (ni) => ni.internetTLD },
];

// ─── Wiki Section Classification ─────────────────────────────────────────────

const WIKI_SECTION_TYPES: Array<{ pattern: RegExp; label: string; icon: LucideIcon; color: string }> = [
  { pattern: /^history|^early|^medieval|^modern|^ancient|^prehistory|^contemporary|^classical/i, label: "History", icon: Clock, color: "text-amber-600" },
  { pattern: /^military|^army|^navy|^defense|^armed/i, label: "Military", icon: Shield, color: "text-red-600" },
  { pattern: /^government|^politics|^executive|^legislature|^judicial|^constitution/i, label: "Government", icon: Landmark, color: "text-indigo-600" },
  { pattern: /^economy|^trade|^industry|^agriculture|^energy|^currency|^labor/i, label: "Economy", icon: Globe2, color: "text-emerald-600" },
  { pattern: /^culture|^cuisine|^music|^art|^sport|^education|^language|^religion|^ethnic/i, label: "Culture", icon: Scroll, color: "text-purple-600" },
  { pattern: /^demograph|^population|^society|^social|^health/i, label: "Society", icon: Users, color: "text-blue-600" },
  { pattern: /^geography|^climate|^environment|^natural|^transport/i, label: "Geography", icon: Globe2, color: "text-teal-600" },
];

function classifyWikiSection(title: string): { label: string; icon: LucideIcon; color: string } {
  for (const type of WIKI_SECTION_TYPES) {
    if (type.pattern.test(title)) return type;
  }
  return { label: "General", icon: BookOpen, color: "text-muted-foreground" };
}

// ─── Wiki Section Row (expandable) ───────────────────────────────────────────

function WikiSectionRow({ title, countryName, wikiUrl }: { title: string; countryName: string; wikiUrl: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const { label, icon: Icon, color } = classifyWikiSection(title);

  const { data: sectionContent, isLoading: contentLoading } = api.wiki.getSectionContent.useQuery(
    { title: countryName, section: title, source: "ixwiki" },
    { enabled: expanded, staleTime: 10 * 60_000 }
  );

  const rawContent = sectionContent
    ? (typeof sectionContent === "object" && "content" in sectionContent
        ? (sectionContent as { content: string }).content
        : String(sectionContent))
    : null;
  const cleanContent = rawContent
    ? rawContent
        .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
        .replace(/\{\{[^}]*\}\}/g, "")
        .replace(/<[^>]*>/g, "")
        .replace(/'{2,3}/g, "")
        .trim()
        .slice(0, 600)
    : null;

  return (
    <div className="rounded-lg bg-white/30 dark:bg-white/[0.03] transition-colors hover:bg-white/50 dark:hover:bg-white/[0.06]">
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left">
        <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", color)} />
        <span className="flex-1 text-xs font-medium text-foreground">{title}</span>
        <span className={cn("text-[9px] font-medium uppercase tracking-wider", color)}>{label}</span>
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5">
              {contentLoading && (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Loading...</span>
                </div>
              )}
              {cleanContent && (
                <p className="text-[11px] leading-relaxed text-foreground/70">
                  {cleanContent}{cleanContent.length >= 600 ? "..." : ""}
                </p>
              )}
              {!contentLoading && !cleanContent && (
                <p className="py-1 text-[10px] italic text-muted-foreground">No content available.</p>
              )}
              <a
                href={`${wikiUrl}#${encodeURIComponent(title.replace(/ /g, "_"))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[10px] text-purple-500 hover:underline"
              >
                Read more <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const MyCountryTabSystem = React.memo(MyCountryTabSystemComponent);
