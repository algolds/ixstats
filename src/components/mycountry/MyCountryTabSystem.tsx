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
  TrendingDown,
  Crown,
  ImageIcon,
  Bell,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
// EconomicSummaryWidget removed - using MetricCardGrid primitives instead
import { SimplifiedTrendRiskAnalytics } from "~/components/analytics/SimplifiedTrendRiskAnalytics";
import { ComparativeAnalysis } from "~/app/countries/_components/economy/ComparativeAnalysis";
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
import { useMetricDetailsModal, type MetricType } from "~/hooks/useMetricDetailsModal";
import { useIssueCount } from "~/hooks/useNationalIssues";
import { useFlag } from "~/hooks/useFlag";
import { AnimatedFlagBackground } from "~/components/ui/animated-flag-background";
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

  // Toggle state for Key Metrics cards (overview tab)
  const [metricView, setMetricView] = useState({
    gdp: "perCapita" as "perCapita" | "total",
    population: "total" as "total" | "density",
    area: "km" as "km" | "mi",
  });

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

  // Data queries for analytics tab
  const { data: historicalData, isLoading: historicalLoading } =
    api.countries.getHistoricalData.useQuery(
      { countryId: country?.id || "" },
      { enabled: !!country?.id && activeTab === "analytics" }
    );

  const { data: allCountries, isLoading: allCountriesLoading } = api.countries.getAll.useQuery(
    { limit: 200 },
    { enabled: activeTab === "analytics", staleTime: 5 * 60 * 1000 }
  );

  // Memoize the country mapping for analytics tab to avoid re-computing on every render
  const mappedAllCountries = useMemo(() => {
    if (!allCountries?.countries || !country) return [];
    return allCountries.countries.map((c) => ({
      id: c.id,
      name: c.name,
      region: c.region || "Unknown",
      tier: c.economicTier || "Developing",
      gdp: c.currentTotalGdp || c.currentPopulation * c.currentGdpPerCapita,
      gdpPerCapita: c.currentGdpPerCapita || 0,
      population: c.currentPopulation || 0,
      growthRate: smartNormalizeGrowthRate(c.adjustedGdpGrowth),
      unemployment: c.unemploymentRate || 5.0,
      inflation: c.inflationRate || 2.5,
      taxRevenue: c.taxRevenueGDPPercent || 25.0,
      debtToGdp: c.totalDebtGDPRatio || 60.0,
      competitivenessIndex: 50 + ((c as any).economicVitality || 0) / 5,
      innovationIndex: 50 + ((c as any).governmentalEfficiency || 0) / 5,
      color: c.id === country.id ? "#FF6B6B" : "#8884d8",
    }));
  }, [allCountries?.countries, country?.id]);

  if (!country) return null;

  const renderTabsList = () => {
    const govComponentCount = governmentStructure?.components?.length ?? 0;
    const govBadge = govComponentCount === 0 ? 1 : 0; // Needs setup

    const baseTabs = [
      { value: "overview", icon: BarChart3, label: "Overview", shortLabel: "Over", badge: 0 },
      { value: "economy", icon: TrendingUp, label: "Economy", shortLabel: "Econ", badge: 0 },
      { value: "labor", icon: Briefcase, label: "Labor", shortLabel: "Lab", badge: 0 },
      { value: "government", icon: Building, label: "Government", shortLabel: "Gov", badge: govBadge },
      { value: "demographics", icon: PieChart, label: "Demographics", shortLabel: "Demo", badge: 0 },
    ];

    const tabs = [...baseTabs];

    // Add analytics for premium and unified
    if (variant === "premium" || variant === "unified") {
      tabs.push({ value: "analytics", icon: Target, label: "Analytics", shortLabel: "Analyze", badge: 0 });
    }

    return (
      <div className="overflow-x-auto">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 min-w-fit gap-1">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={`data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3 ${
                [
                  "economy",
                  "labor",
                  "government",
                  "demographics",
                ].includes(tab.value)
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
            <Link href={createUrl("/mycountry/premium")}>
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
                <Link href={createUrl("/mycountry/premium")} className="mt-3 block">
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
                <Link href={createUrl("/mycountry/premium")} className="mt-3 block">
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
                <Link href={createUrl("/mycountry/premium")} className="mt-3 block">
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
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4" id="overview">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="space-y-4"
          >
            {/* Key Metrics - Click cards to toggle between views */}
            <motion.div variants={staggerItem}>
              <MetricCardGrid
                theme="overview"
                columns={3}
                title="Key Metrics"
                subtitle={`Core indicators for ${country.name} · click to toggle`}
                metrics={[
                  {
                    id: "metric-gdp",
                    title: metricView.gdp === "perCapita" ? "GDP per Capita" : "Total GDP",
                    value: metricView.gdp === "perCapita"
                      ? (country.currentGdpPerCapita ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
                      : (country.currentTotalGdp ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }),
                    icon: metricView.gdp === "perCapita" ? DollarSign : TrendingUp,
                    description: metricView.gdp === "perCapita"
                      ? `${country.economicTier || "Developing"} · Total: ${(country.currentTotalGdp ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 })}`
                      : `Per capita: ${(country.currentGdpPerCapita ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`,
                    trend: (country.adjustedGdpGrowth ?? 0) !== 0 ? {
                      direction: (country.adjustedGdpGrowth ?? 0) > 0 ? "up" as const : "down" as const,
                      value: smartNormalizeGrowthRate(country.adjustedGdpGrowth, 0),
                    } : undefined,
                    onClick: () => setMetricView(v => ({ ...v, gdp: v.gdp === "perCapita" ? "total" : "perCapita" })),
                    tooltip: "Gross Domestic Product measures total economic output. Per capita divides by population. Click to toggle view.",
                  },
                  {
                    id: "metric-population",
                    title: metricView.population === "total" ? "Population" : "Population Density",
                    value: metricView.population === "total"
                      ? (country.currentPopulation ?? 0).toLocaleString("en-US")
                      : (country.populationDensity ? `${Math.round(country.populationDensity).toLocaleString()} /km²` : "N/A"),
                    icon: Users,
                    description: metricView.population === "total"
                      ? `Tier ${country.populationTier || "N/A"}${country.populationDensity ? ` · ${Math.round(country.populationDensity).toLocaleString()}/km²` : ""}`
                      : `Total: ${(country.currentPopulation ?? 0).toLocaleString("en-US")} · Tier ${country.populationTier || "N/A"}`,
                    trend: metricView.population === "total" && (country.populationGrowthRate ?? 0) !== 0 ? {
                      direction: (country.populationGrowthRate ?? 0) > 0 ? "up" as const : "down" as const,
                      value: smartNormalizeGrowthRate(country.populationGrowthRate, 0),
                    } : undefined,
                    onClick: () => setMetricView(v => ({ ...v, population: v.population === "total" ? "density" : "total" })),
                    tooltip: "Total number of citizens. Density measures people per square kilometer. Click to toggle view.",
                  },
                  {
                    id: "metric-area",
                    title: "Land Area",
                    value: metricView.area === "km"
                      ? (country.landArea ? `${country.landArea.toLocaleString()} km²` : "N/A")
                      : (country.areaSqMi ? `${country.areaSqMi.toLocaleString()} sq mi` : "N/A"),
                    icon: Globe,
                    description: metricView.area === "km"
                      ? (country.areaSqMi ? `${country.areaSqMi.toLocaleString()} sq mi` : "")
                      : (country.landArea ? `${country.landArea.toLocaleString()} km²` : ""),
                    onClick: (country.areaSqMi && country.landArea) ? () => setMetricView(v => ({ ...v, area: v.area === "km" ? "mi" : "km" })) : undefined,
                    tooltip: "Total sovereign territory. Click to switch between square kilometers and square miles.",
                  },
                ]}
                cardFooter={
                  <div className="mt-3 flex items-center gap-4 border-t border-border/40 pt-2.5 text-[11px] text-muted-foreground">
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
                }
              />
            </motion.div>

            {/* National Identity - With background image support */}
            {country.nationalIdentity && (
              <motion.div variants={staggerItem}>
                <NationalIdentityCard 
                  country={country}
                  onEditImage={() => setImageUploadModal({ isOpen: true, cardType: "national_identity" })}
                />
              </motion.div>
            )}

            {/* Government Structure - Quick Overview */}
            {governmentStructure && (
              <motion.div variants={staggerItem}>
                <MetricCardGrid
                  theme="government"
                  columns={4}
                  title="Government Structure"
                  subtitle="Current leadership and institutions"
                  backgroundImage={{
                    countryId: country.id,
                    cardType: "government",
                    showEditButton: true,
                    onEditClick: () => setImageUploadModal({ isOpen: true, cardType: "government" }),
                    autoFallback: true,
                    countryImageData: countryImageData ?? undefined,
                  }}
                  metrics={[
                    ...(governmentStructure.headOfState ? [{
                      id: "head-of-state",
                      title: "Head of State",
                      value: governmentStructure.headOfState,
                      icon: Crown,
                      description: governmentStructure.governmentType || "Leader",
                      tooltip: "The chief public representative and ceremonial leader of the nation.",
                    }] : []),
                    ...(governmentStructure.headOfGovernment ? [{
                      id: "head-of-gov",
                      title: "Head of Government",
                      value: governmentStructure.headOfGovernment,
                      icon: Building,
                      description: "Executive leader",
                      tooltip: "The chief executive who directs government operations and policy.",
                    }] : []),
                    ...(governmentStructure.legislatureName ? [{
                      id: "legislature",
                      title: "Legislature",
                      value: governmentStructure.legislatureName,
                      icon: Building,
                      description: "Legislative body",
                      tooltip: "The primary lawmaking body responsible for enacting legislation.",
                    }] : []),
                    ...(governmentStructure.totalBudget ? [{
                      id: "budget",
                      title: "Government Budget",
                      value: governmentStructure.totalBudget.toLocaleString("en-US", { style: "currency", currency: governmentStructure.budgetCurrency || "USD", notation: "compact", maximumFractionDigits: 1 }),
                      icon: DollarSign,
                      description: "Annual budget",
                      tooltip: "Total annual government expenditure across all departments and programs.",
                    }] : []),
                  ]}
                />
              </motion.div>
            )}



          </motion.div>
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
                <Link href={createUrl("/mycountry/editor")}>
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
          </ThemedTabContent>
        </TabsContent>

        {/* Demographics Tab */}
        <TabsContent value="demographics" id="demographics">
          <ThemedTabContent theme="demographics" className="space-y-4">
            <TabHeroBanner context="overview_demographics" title="Population & Society" subtitle="Demographics, health, and social indicators" icon={PieChart} accentColor="cyan" />
            <Tabs defaultValue="population" className="space-y-4">
              <div className="flex justify-center mb-2">
                <TabsList className="subtab-pills subtab-pills-demographics">
                  <TabsTrigger value="population" className="subtab-pill subtab-pill-demographics">
                    <Users className="subtab-icon h-4 w-4" />
                    <span>Population</span>
                  </TabsTrigger>
                  <TabsTrigger value="settlement" className="subtab-pill subtab-pill-demographics">
                    <Building className="subtab-icon h-4 w-4" />
                    <span>Settlement</span>
                  </TabsTrigger>
                  <TabsTrigger value="development" className="subtab-pill subtab-pill-demographics">
                    <TrendingUp className="subtab-icon h-4 w-4" />
                    <span>Development</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Population Sub-Tab */}
              <TabsContent value="population" className="space-y-4">
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="space-y-4"
                >
                  {/* Population Overview */}
                  <motion.div variants={staggerItem}>
                    <MetricCardGrid
                      theme="demographics"
                      columns={4}
                      title="Population Overview"
                      subtitle={`Demographic indicators for ${country.name}`}
                      backgroundImage={{
                        countryId: country.id,
                        cardType: "demographics",
                        showEditButton: true,
                        onEditClick: () => setImageUploadModal({ isOpen: true, cardType: "demographics" }),
                        autoFallback: true,
                        countryImageData: countryImageData ?? undefined,
                      }}
                      metrics={[
                        {
                          id: "total-pop",
                          title: "Total Population",
                          value: (economyData?.core?.totalPopulation ?? 0).toLocaleString(),
                          icon: Users,
                          trend: (country.populationGrowthRate ?? 0) > 0 ? "up" : "stable",
                          trendValue: smartNormalizeGrowthRate(country.populationGrowthRate, 0),
                          description: `Tier ${country.populationTier || "N/A"}`,
                          tooltip: "Total number of citizens. Population tier determines economic modeling parameters.",
                        },
                        {
                          id: "life-expectancy",
                          title: "Life Expectancy",
                          value: `${(economyData?.demographics?.lifeExpectancy ?? 0).toFixed(1)} years`,
                          icon: Activity,
                          description: "Average lifespan",
                          onClick: () => openMetricModal("demographics-health", country.id),
                          tooltip: "Average number of years a newborn is expected to live given current mortality rates.",
                        },
                        {
                          id: "literacy",
                          title: "Literacy Rate",
                          value: `${(economyData?.demographics?.literacyRate ?? 0).toFixed(1)}%`,
                          icon: Users,
                          trend: (economyData?.demographics?.literacyRate ?? 0) > 90 ? "up" : "stable",
                          description: "Adult literacy",
                          tooltip: "Percentage of adults (15+) who can read and write. Key indicator of human development.",
                        },
                        {
                          id: "urbanization",
                          title: "Urbanization",
                          value: `${(economyData?.demographics?.urbanRuralSplit?.urban ?? 0).toFixed(1)}%`,
                          icon: Building,
                          description: "Urban population",
                          tooltip: "Share of the total population living in urban areas (cities and towns).",
                        },
                      ]}
                    />
                  </motion.div>

                  {/* Age Distribution */}
                  <motion.div variants={staggerItem}>
                    <SectorBreakdownCard
                      title="Age Distribution"
                      subtitle="Population breakdown by age groups"
                      layout="grid"
                      showTrends={false}
                      sectors={
                        (economyData?.demographics?.ageDistribution ?? []).map((age: any) => ({
                          id: age.group?.toLowerCase().replace(/\s+/g, '-') ?? 'unknown',
                          name: age.group ?? 'Unknown',
                          percentage: age.percentage ?? 0,
                          color: age.group?.includes('0-14') ? 'cyan' :
                                 age.group?.includes('15-24') ? 'blue' :
                                 age.group?.includes('25-54') ? 'emerald' :
                                 age.group?.includes('55-64') ? 'amber' : 'purple',
                          description: `${Math.round((age.percentage ?? 0) / 100 * (economyData?.core?.totalPopulation ?? 0)).toLocaleString()} people`,
                        }))
                      }
                    />
                  </motion.div>
                </motion.div>
              </TabsContent>

              {/* Settlement Sub-Tab */}
              <TabsContent value="settlement" className="space-y-4">
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="space-y-4"
                >
                  {/* Urban/Rural Distribution */}
                  <motion.div variants={staggerItem}>
                    <SectorBreakdownCard
                      title="Urban/Rural Distribution"
                      subtitle="Geographic population distribution"
                      layout="list"
                      showProgressBars={true}
                      sectors={[
                        {
                          id: "urban",
                          name: "Urban Population",
                          value: ((economyData?.demographics?.urbanRuralSplit?.urban ?? 0) / 100) * (economyData?.core?.totalPopulation ?? 0),
                          percentage: economyData?.demographics?.urbanRuralSplit?.urban ?? 0,
                          color: "blue",
                          description: "Living in cities and towns",
                        },
                        {
                          id: "rural",
                          name: "Rural Population",
                          value: ((economyData?.demographics?.urbanRuralSplit?.rural ?? 0) / 100) * (economyData?.core?.totalPopulation ?? 0),
                          percentage: economyData?.demographics?.urbanRuralSplit?.rural ?? 0,
                          color: "green",
                          description: "Living in rural areas",
                        },
                      ]}
                      totalValue={economyData?.core?.totalPopulation ?? 0}
                    />
                  </motion.div>

                  {/* Regional Distribution */}
                  {economyData?.demographics?.regionalDistribution && economyData.demographics.regionalDistribution.length > 0 && (
                    <motion.div variants={staggerItem}>
                      <SectorBreakdownCard
                        title="Regional Distribution"
                        subtitle="Population by administrative region"
                        layout="list"
                        showProgressBars={true}
                        showTrends={false}
                        sectors={
                          (economyData.demographics.regionalDistribution ?? []).slice(0, 8).map((region: any) => ({
                            id: region.region?.toLowerCase().replace(/\s+/g, '-') ?? 'unknown',
                            name: region.region ?? 'Unknown',
                            percentage: region.percentage ?? 0,
                            color: ['blue', 'emerald', 'purple', 'amber', 'cyan', 'rose', 'indigo', 'teal'][
                              (economyData?.demographics?.regionalDistribution ?? []).indexOf(region) % 8
                            ],
                            description: region.urbanPercent ? `${region.urbanPercent.toFixed(0)}% urban` : undefined,
                          }))
                        }
                      />
                    </motion.div>
                  )}
                </motion.div>
              </TabsContent>

              {/* Development Sub-Tab */}
              <TabsContent value="development" className="space-y-4">
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="space-y-4"
                >
                  {/* Education Levels */}
                  <motion.div variants={staggerItem}>
                    <SectorBreakdownCard
                      title="Education Levels"
                      subtitle="Population by educational attainment"
                      layout="list"
                      showProgressBars={true}
                      sectors={
                        (economyData?.demographics?.educationLevels ?? []).map((edu: any) => ({
                          id: edu.level?.toLowerCase().replace(/\s+/g, '-') ?? 'unknown',
                          name: edu.level ?? 'Unknown',
                          percentage: edu.percentage ?? 0,
                          color: edu.level?.toLowerCase().includes('tertiary') ? 'purple' :
                                 edu.level?.toLowerCase().includes('secondary') ? 'blue' :
                                 edu.level?.toLowerCase().includes('primary') ? 'emerald' : 'amber',
                        }))
                      }
                    />
                  </motion.div>

                  {/* Health & Social Indicators */}
                  <motion.div variants={staggerItem}>
                    <MetricCardGrid
                      theme="demographics"
                      columns={3}
                      title="Health & Social Indicators"
                      subtitle="Quality of life metrics"
                      metrics={[
                        {
                          id: "median-age",
                          title: "Median Age",
                          value: `${(economyData?.demographics?.medianAge ?? 0).toFixed(1)} years`,
                          icon: Users,
                          description: "Population median age",
                          tooltip: "The age that divides the population into two equal halves — half younger, half older.",
                        },
                        {
                          id: "dependency-ratio",
                          title: "Dependency Ratio",
                          value: `${(economyData?.demographics?.dependencyRatio ?? 0).toFixed(1)}%`,
                          icon: Users,
                          description: "Non-working age population",
                          tooltip: "Ratio of dependents (under 15 and over 64) to the working-age population (15-64).",
                        },
                        {
                          id: "growth-rate",
                          title: "Population Growth",
                          value: `${smartNormalizeGrowthRate(country.populationGrowthRate, 0).toFixed(2)}%`,
                          icon: TrendingUp,
                          trend: (country.populationGrowthRate ?? 0) > 0 ? "up" : (country.populationGrowthRate ?? 0) < 0 ? "down" : "stable",
                          description: "Annual growth rate",
                          tooltip: "Annual rate of population change from births, deaths, and migration.",
                        },
                      ]}
                    />
                  </motion.div>
                </motion.div>
              </TabsContent>
            </Tabs>
          </ThemedTabContent>
        </TabsContent>

        {/* Advanced Analytics Tab */}
        {(variant === "premium" || variant === "unified") && (
          <TabsContent value="analytics" className="space-y-4" id="analytics">
            <ThemedTabContent theme="detailed" className="space-y-4">
              <TabHeroBanner context="overview_analytics" title="Advanced Analytics" subtitle="Trends, risk analysis, and comparative metrics" icon={Target} accentColor="pink" />
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="space-y-4"
              >
                <motion.div variants={staggerItem}>
                  <Card className="glass-surface glass-refraction border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        Economic Trends & Projections
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {historicalLoading ? (
                        <div className="space-y-4">
                          <div className="bg-muted h-4 animate-pulse rounded" />
                          <div className="bg-muted h-64 animate-pulse rounded" />
                          <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
                        </div>
                      ) : historicalData && historicalData.length > 0 ? (
                        <div className="space-y-4">
                          <div>
                            <h4 className="mb-3 text-sm font-medium">GDP Growth Over Time</h4>
                            <div className="mb-2 grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 md:grid-cols-3">
                              <div className="rounded-lg border p-2.5 text-center">
                                <div className="text-lg font-bold text-blue-600">
                                  {historicalData.length}
                                </div>
                                <div className="text-muted-foreground text-xs">Data Points</div>
                              </div>
                              <div className="rounded-lg border p-2.5 text-center">
                                <div className="text-lg font-bold text-green-600">
                                  $
                                  {(
                                    (historicalData[historicalData.length - 1]?.gdpPerCapita || 0) /
                                    1000
                                  ).toFixed(0)}
                                  k
                                </div>
                                <div className="text-muted-foreground text-xs">Latest GDP/Capita</div>
                              </div>
                              <div className="rounded-lg border p-2.5 text-center">
                                <div className="text-lg font-bold text-purple-600">
                                  {(
                                    (historicalData[historicalData.length - 1]?.population || 0) /
                                    1000000
                                  ).toFixed(1)}
                                  M
                                </div>
                                <div className="text-muted-foreground text-xs">Latest Population</div>
                              </div>
                            </div>

                            {/* Simple GDP Trend Visualization */}
                            <div className="mt-4">
                              <div className="mb-2 flex items-center gap-2">
                                {historicalData.length >= 2 && (
                                  <>
                                    {historicalData[historicalData.length - 1]!.gdpPerCapita >
                                    historicalData[0]!.gdpPerCapita ? (
                                      <TrendingUp className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <TrendingDown className="h-4 w-4 text-red-600" />
                                    )}
                                    <span className="text-sm font-medium">
                                      {(
                                        ((historicalData[historicalData.length - 1]!.gdpPerCapita -
                                          historicalData[0]!.gdpPerCapita) /
                                          historicalData[0]!.gdpPerCapita) *
                                        100
                                      ).toFixed(1)}
                                      % total change
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="bg-muted h-2 overflow-hidden rounded-full">
                                <div
                                  className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all"
                                  style={{
                                    width: `${Math.min(100, Math.max(0, ((historicalData.length - 1) / 30) * 100))}%`,
                                  }}
                                />
                              </div>
                              <div className="text-muted-foreground mt-1 flex justify-between text-xs">
                                <span>
                                  Start: ${(historicalData[0]!.gdpPerCapita / 1000).toFixed(1)}k
                                </span>
                                <span>
                                  Current: $
                                  {(
                                    (historicalData[historicalData.length - 1]!.gdpPerCapita || 0) /
                                    1000
                                  ).toFixed(1)}
                                  k
                                </span>
                              </div>
                            </div>
                          </div>

                        </div>
                      ) : (
                        <div className="text-muted-foreground py-6 text-center">
                          <BarChart3 className="mx-auto mb-2 h-8 w-8 opacity-50" />
                          <p className="mb-1 text-sm">No Historical Data Available</p>
                          <p className="text-xs">
                            Historical data will appear once the country has been calculated over
                            time.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={staggerItem}>
                  <Card className="glass-surface glass-refraction border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        Economic Health & Risk Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <SimplifiedTrendRiskAnalytics countryId={country.id} userId={user?.id} />
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={staggerItem}>
                  <Card className="glass-surface glass-refraction border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <BarChart3 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        Comparative Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                    {allCountriesLoading ? (
                      <div className="space-y-4">
                        <div className="bg-muted h-4 animate-pulse rounded" />
                        <div className="bg-muted h-32 animate-pulse rounded" />
                        <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
                      </div>
                    ) : allCountries && allCountries.countries ? (
                      <ComparativeAnalysis
                        userCountry={{
                          id: country.id,
                          name: country.name,
                          region: country.region || "Unknown",
                          tier: country.economicTier || "Developing",
                          gdp:
                            country.currentTotalGdp ||
                            country.currentPopulation * country.currentGdpPerCapita,
                          gdpPerCapita: country.currentGdpPerCapita || 0,
                          population: country.currentPopulation || 0,
                          growthRate: smartNormalizeGrowthRate(
                            country.realGDPGrowthRate || country.adjustedGdpGrowth
                          ),
                          unemployment:
                            country.unemploymentRate || economyData?.labor?.unemploymentRate || 5.0,
                          inflation:
                            country.inflationRate || economyData?.core?.inflationRate || 2.5,
                          taxRevenue:
                            country.taxRevenueGDPPercent ||
                            economyData?.fiscal?.taxRevenueGDPPercent ||
                            25.0,
                          debtToGdp:
                            country.totalDebtGDPRatio ||
                            economyData?.fiscal?.totalDebtGDPRatio ||
                            60.0,
                          competitivenessIndex: 50 + (country.economicVitality || 0) / 5,
                          innovationIndex: 50 + (country.governmentalEfficiency || 0) / 5,
                          color: "#3B82F6",
                        }}
                        allCountries={mappedAllCountries}
                      />
                    ) : (
                      <div className="text-muted-foreground py-6 text-center">
                        <BarChart3 className="mx-auto mb-2 h-8 w-8 opacity-50" />
                        <p className="mb-1 text-sm">Comparative Analysis Unavailable</p>
                        <p className="text-xs">
                          Unable to load country comparison data at this time.
                        </p>
                      </div>
                    )}
                    </CardContent>
                  </Card>
                </motion.div>

              </motion.div>
            </ThemedTabContent>
          </TabsContent>
        )}
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

// National Identity field config (data-driven rendering)
const IDENTITY_FIELDS: {
  key: string;
  label: string;
  bg: string;
  text: string;
  border: string;
  getValue: (ni: any) => string | null;
}[] = [
  { key: "governmentType", label: "Government", bg: "from-amber-50/80 to-yellow-50/80 dark:from-amber-900/20 dark:to-yellow-900/20", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200/50 dark:border-amber-700/30", getValue: (ni) => ni.governmentType },
  { key: "capitalCity", label: "Capital", bg: "from-blue-50/80 to-cyan-50/80 dark:from-blue-900/20 dark:to-cyan-900/20", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200/50 dark:border-blue-700/30", getValue: (ni) => ni.capitalCity },
  { key: "officialLanguages", label: "Languages", bg: "from-purple-50/80 to-violet-50/80 dark:from-purple-900/20 dark:to-violet-900/20", text: "text-purple-700 dark:text-purple-400", border: "border-purple-200/50 dark:border-purple-700/30", getValue: (ni) => ni.officialLanguages },
  { key: "currency", label: "Currency", bg: "from-emerald-50/80 to-green-50/80 dark:from-emerald-900/20 dark:to-green-900/20", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200/50 dark:border-emerald-700/30", getValue: (ni) => ni.currency ? `${ni.currency}${ni.currencySymbol ? ` (${ni.currencySymbol})` : ""}` : null },
  { key: "demonym", label: "Demonym", bg: "from-rose-50/80 to-pink-50/80 dark:from-rose-900/20 dark:to-pink-900/20", text: "text-rose-700 dark:text-rose-400", border: "border-rose-200/50 dark:border-rose-700/30", getValue: (ni) => ni.demonym },
  { key: "callingCode", label: "Calling Code", bg: "from-indigo-50/80 to-blue-50/80 dark:from-indigo-900/20 dark:to-blue-900/20", text: "text-indigo-700 dark:text-indigo-400", border: "border-indigo-200/50 dark:border-indigo-700/30", getValue: (ni) => ni.callingCode },
  { key: "timeZone", label: "Time Zone", bg: "from-cyan-50/80 to-teal-50/80 dark:from-cyan-900/20 dark:to-cyan-900/20", text: "text-cyan-700 dark:text-cyan-400", border: "border-cyan-200/50 dark:border-cyan-700/30", getValue: (ni) => ni.timeZone },
  { key: "internetTLD", label: "Internet TLD", bg: "from-orange-50/80 to-amber-50/80 dark:from-orange-900/20 dark:to-amber-900/20", text: "text-orange-700 dark:text-orange-400", border: "border-orange-200/50 dark:border-orange-700/30", getValue: (ni) => ni.internetTLD },
];

// National Identity Card with background image support
interface NationalIdentityCardProps {
  country: NonNullable<ReturnType<typeof useCountryData>["country"]>;
  onEditImage: () => void;
}

function NationalIdentityCard({ country, onEditImage }: NationalIdentityCardProps) {
  const [flagLoaded, setFlagLoaded] = React.useState(false);
  const [showAllFields, setShowAllFields] = React.useState(false);
  const { flagUrl } = useFlag(country.name);

  return (
    <Card className="glass-surface glass-refraction border-border overflow-hidden relative">
      {/* Flag Background with Canvas Sine-Wave Animation */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: flagLoaded ? 1 : 0 }}
        transition={{ duration: 0.6 }}
      >
        <AnimatedFlagBackground
          flagUrl={flagUrl ?? undefined}
          intensity="subtle"
          blur={3}
          onLoad={() => setFlagLoaded(true)}
          className="absolute inset-0"
        />
        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background/95" />
      </motion.div>

      {/* Edit Button with Tooltip */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 z-10 h-8 w-8 bg-black/30 hover:bg-black/50 text-white"
            onClick={onEditImage}
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Customize background image</TooltipContent>
      </Tooltip>

      {/* Content */}
      <div className="relative z-[5]">
        <CardHeader className="border-b border-amber-200/30 dark:border-amber-700/30">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            National Identity
            <span className="text-muted-foreground text-xs font-normal">{country.nationalIdentity?.officialName || country.name}</span>
          </CardTitle>
          {country.nationalIdentity?.motto && (
            <p className="text-xs italic text-muted-foreground mt-1">
              &ldquo;{country.nationalIdentity.motto}&rdquo;
            </p>
          )}
        </CardHeader>
        <CardContent className="p-4">
          {(() => {
            const filteredFields = IDENTITY_FIELDS.filter((field) => field.getValue(country.nationalIdentity));
            const visibleFields = filteredFields.slice(0, 4);
            const extraFields = filteredFields.slice(4);
            const renderField = (field: typeof IDENTITY_FIELDS[number]) => (
              <motion.div
                key={field.key}
                className={`p-3 rounded-lg bg-gradient-to-br ${field.bg} border ${field.border} backdrop-blur-sm`}
                whileHover={{ scale: 1.02 }}
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{field.label}</p>
                <p className={`font-semibold ${field.text}`}>{field.getValue(country.nationalIdentity)}</p>
              </motion.div>
            );
            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                  {visibleFields.map(renderField)}
                </div>
                <AnimatePresence>
                  {showAllFields && extraFields.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 mt-2">
                        {extraFields.map(renderField)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {extraFields.length > 0 && (
                  <button
                    onClick={() => setShowAllFields(!showAllFields)}
                    className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
                  >
                    {showAllFields ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showAllFields ? "See less" : `See ${extraFields.length} more`}
                  </button>
                )}
              </>
            );
          })()}
        </CardContent>
      </div>
    </Card>
  );
}

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

export const MyCountryTabSystem = React.memo(MyCountryTabSystemComponent);
