"use client";

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
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
import { useMetricDetailsModal, type MetricType } from "~/hooks/useMetricDetailsModal";
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
    { enabled: activeTab === "analytics" }
  );

  const now = new Date();
  const forecastStartTime = now.getTime();
  const forecastEndTime = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate()).getTime();

  const { data: forecast, isLoading: forecastLoading } = api.countries.getForecast.useQuery(
    { id: country?.id || "", startTime: forecastStartTime, endTime: forecastEndTime },
    { enabled: !!country?.id && activeTab === "analytics" }
  );

  if (!country) return null;

  const renderTabsList = () => {
    const baseTabs = [
      { value: "overview", icon: BarChart3, label: "Overview", shortLabel: "Over" },
      { value: "economy", icon: TrendingUp, label: "Economy", shortLabel: "Econ" },
      { value: "labor", icon: Briefcase, label: "Labor", shortLabel: "Lab" },
      { value: "government", icon: Building, label: "Government", shortLabel: "Gov" },
      { value: "demographics", icon: PieChart, label: "Demographics", shortLabel: "Demo" },
    ];

    const tabs = [...baseTabs];

    // Add analytics for premium and unified
    if (variant === "premium" || variant === "unified") {
      tabs.push({ value: "analytics", icon: Target, label: "Analytics", shortLabel: "Analyze" });
    }

    const colCount = tabs.length <= 5 ? 5 : Math.min(8, tabs.length);

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
                  }}
                  metrics={[
                    ...(governmentStructure.headOfState ? [{
                      id: "head-of-state",
                      title: "Head of State",
                      value: governmentStructure.headOfState,
                      icon: Crown,
                      description: governmentStructure.governmentType || "Leader",
                    }] : []),
                    ...(governmentStructure.headOfGovernment ? [{
                      id: "head-of-gov",
                      title: "Head of Government",
                      value: governmentStructure.headOfGovernment,
                      icon: Building,
                      description: "Executive leader",
                    }] : []),
                    ...(governmentStructure.legislatureName ? [{
                      id: "legislature",
                      title: "Legislature",
                      value: governmentStructure.legislatureName,
                      icon: Building,
                      description: "Legislative body",
                    }] : []),
                    ...(governmentStructure.totalBudget ? [{
                      id: "budget",
                      title: "Government Budget",
                      value: governmentStructure.totalBudget.toLocaleString("en-US", { style: "currency", currency: governmentStructure.budgetCurrency || "USD", notation: "compact", maximumFractionDigits: 1 }),
                      icon: DollarSign,
                      description: "Annual budget",
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
                  }}
                  metrics={[
                    {
                      id: "gdp",
                      title: "Total GDP",
                      value: (economyData?.core.nominalGDP ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }),
                      icon: DollarSign,
                      description: `${country.economicTier || "Developing"} economy`,
                    },
                    {
                      id: "gdp-capita",
                      title: "GDP per Capita",
                      value: (economyData?.core.gdpPerCapita ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
                      icon: TrendingUp,
                      trend: smartNormalizeGrowthRate(country.realGDPGrowthRate || country.adjustedGdpGrowth, 0) > 0 ? "up" : "stable",
                      trendValue: smartNormalizeGrowthRate(country.realGDPGrowthRate || country.adjustedGdpGrowth, 0),
                      description: "Economic output per person",
                    },
                    {
                      id: "population",
                      title: "Population",
                      value: (economyData?.core.totalPopulation ?? 0).toLocaleString("en-US"),
                      icon: Users,
                      trend: smartNormalizeGrowthRate(country.populationGrowthRate, 0) > 0 ? "up" : "stable",
                      trendValue: smartNormalizeGrowthRate(country.populationGrowthRate, 0),
                      description: "Total population",
                    },
                    {
                      id: "unemployment",
                      title: "Unemployment",
                      value: `${(economyData?.labor?.unemploymentRate ?? 0).toFixed(1)}%`,
                      icon: Briefcase,
                      trend: (economyData?.labor?.unemploymentRate ?? 0) < 5 ? "up" : "down",
                      description: "Labor force unemployed",
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
                    },
                    {
                      id: "tax-revenue",
                      title: "Tax Revenue",
                      value: `${(economyData?.fiscal?.taxRevenueGDPPercent ?? 0).toFixed(1)}%`,
                      icon: Building,
                      description: "Percent of GDP",
                    },
                    {
                      id: "budget-balance",
                      title: "Budget Balance",
                      value: (economyData?.fiscal?.budgetDeficitSurplus ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }),
                      icon: (economyData?.fiscal?.budgetDeficitSurplus ?? 0) >= 0 ? TrendingUp : TrendingDown,
                      trend: (economyData?.fiscal?.budgetDeficitSurplus ?? 0) >= 0 ? "up" : "down",
                      description: (economyData?.fiscal?.budgetDeficitSurplus ?? 0) >= 0 ? "Surplus" : "Deficit",
                    },
                    {
                      id: "debt-gdp",
                      title: "Debt to GDP",
                      value: `${(economyData?.fiscal?.totalDebtGDPRatio ?? 0).toFixed(1)}%`,
                      icon: BarChart3,
                      trend: (economyData?.fiscal?.totalDebtGDPRatio ?? 0) < 60 ? "up" : "down",
                      description: "Public debt ratio",
                    },
                  ]}
                />
              </motion.div>

              {/* Comprehensive Economic Analysis */}
              <motion.div variants={staggerItem}>
                <Card className="glass-surface glass-refraction border-border">
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
                        sectors={[
                          {
                            id: "primary",
                            name: "Primary Sector",
                            value: (economyData?.core.nominalGDP ?? 0) * 0.05,
                            percentage: 5.0,
                            color: "green",
                            trend: "stable",
                            description: "Agriculture, Mining",
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
                          },
                        ]}
                        totalValue={economyData?.core.nominalGDP ?? 0}
                      />
                    </motion.div>

                    {/* Detailed Sector Breakdown - List Layout */}
                    <motion.div variants={staggerItem}>
                      <SectorBreakdownCard
                        title="Major Economic Sectors"
                        subtitle="Detailed breakdown with animated progress visualization"
                        layout="list"
                        showProgressBars={true}
                        showTrends={true}
                        sectors={[
                          {
                            id: "services",
                            name: "Services",
                            value: (economyData?.core.nominalGDP ?? 0) * 0.35,
                            percentage: 35,
                            color: "purple",
                            trend: "up",
                            trendValue: 1.8,
                          },
                          {
                            id: "manufacturing",
                            name: "Manufacturing",
                            value: (economyData?.core.nominalGDP ?? 0) * 0.25,
                            percentage: 25,
                            color: "blue",
                            trend: "stable",
                          },
                          {
                            id: "finance",
                            name: "Finance & Business",
                            value: (economyData?.core.nominalGDP ?? 0) * 0.2,
                            percentage: 20,
                            color: "emerald",
                            trend: "up",
                            trendValue: 2.3,
                          },
                          {
                            id: "tech",
                            name: "Technology & Information",
                            value: (economyData?.core.nominalGDP ?? 0) * 0.15,
                            percentage: 15,
                            color: "cyan",
                            trend: "up",
                            trendValue: 4.2,
                          },
                          {
                            id: "agriculture",
                            name: "Agriculture & Mining",
                            value: (economyData?.core.nominalGDP ?? 0) * 0.05,
                            percentage: 5,
                            color: "green",
                            trend: "down",
                            trendValue: -0.5,
                          },
                        ]}
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
                          },
                          {
                            id: "innovation",
                            title: "Innovation Index",
                            value: "72/100",
                            description: "Global ranking",
                            icon: Target,
                            trend: { direction: "up", value: 3, label: "positions" },
                            status: "success",
                          },
                          {
                            id: "rnd",
                            title: "R&D Investment",
                            value: "2.8%",
                            description: "Of GDP",
                            icon: Sparkles,
                            trend: { direction: "up", value: 0.2, label: "YoY" },
                            status: "info",
                          },
                          {
                            id: "competitiveness",
                            title: "Competitiveness",
                            value: "68/100",
                            description: "Global index",
                            icon: Activity,
                            trend: { direction: "stable" },
                            status: "info",
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
                          },
                          {
                            id: "poverty",
                            title: "Poverty Rate",
                            value: "8.5%",
                            description: "Below poverty line",
                            icon: Users,
                            trend: { direction: "down", value: 0.3, label: "YoY" },
                            status: "warning",
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
                          },
                          {
                            id: "startups",
                            title: "Startup Formation",
                            value: "12.5",
                            description: "Per 1000 people",
                            icon: Sparkles,
                            trend: { direction: "up", value: 1.2, label: "YoY" },
                            status: "success",
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
                          },
                          {
                            id: "credit",
                            title: "Credit to Private Sector",
                            value: "85%",
                            description: "Of GDP",
                            icon: DollarSign,
                            trend: { direction: "up", value: 2.1, label: "YoY" },
                            status: "info",
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
          <ThemedTabContent theme="labor">
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
                  }}
                  metrics={[
                    {
                      id: "labor-force",
                      title: "Labor Force",
                      value: (economyData?.labor?.totalWorkforce ?? 0).toLocaleString(),
                      icon: Users,
                      description: "Active workforce",
                      onClick: () => openMetricModal("labor-force", country.id),
                    },
                    {
                      id: "participation",
                      title: "Participation Rate",
                      value: `${(economyData?.labor?.laborForceParticipationRate ?? 0).toFixed(1)}%`,
                      icon: Briefcase,
                      trend: (economyData?.labor?.laborForceParticipationRate ?? 0) > 60 ? "up" : "down",
                      description: "Working age population in workforce",
                      onClick: () => openMetricModal("labor-force", country.id),
                    },
                    {
                      id: "employment",
                      title: "Employment Rate",
                      value: `${(economyData?.labor?.employmentRate ?? 0).toFixed(1)}%`,
                      icon: TrendingUp,
                      trend: (economyData?.labor?.employmentRate ?? 0) > 90 ? "up" : "stable",
                      description: "Of labor force employed",
                      onClick: () => openMetricModal("employment", country.id),
                    },
                    {
                      id: "unemployment",
                      title: "Unemployment Rate",
                      value: `${(economyData?.labor?.unemploymentRate ?? 0).toFixed(1)}%`,
                      icon: TrendingDown,
                      trend: (economyData?.labor?.unemploymentRate ?? 0) < 5 ? "up" : "down",
                      description: "Seeking employment",
                      onClick: () => openMetricModal("unemployment", country.id),
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
                  sectors={[
                    {
                      id: "agriculture",
                      name: "Agriculture",
                      value: (economyData?.labor?.totalWorkforce ?? 0) * ((economyData?.labor?.employmentBySector?.agriculture ?? 0) / 100),
                      percentage: economyData?.labor?.employmentBySector?.agriculture ?? 0,
                      color: "green",
                      trend: "stable",
                      description: "Farming, forestry, fishing",
                    },
                    {
                      id: "industry",
                      name: "Industry",
                      value: (economyData?.labor?.totalWorkforce ?? 0) * ((economyData?.labor?.employmentBySector?.industry ?? 0) / 100),
                      percentage: economyData?.labor?.employmentBySector?.industry ?? 0,
                      color: "blue",
                      trend: "stable",
                      description: "Manufacturing, construction",
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
                    },
                  ]}
                  totalValue={economyData?.labor?.totalWorkforce ?? 0}
                />
              </motion.div>

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
                    },
                    {
                      id: "min-wage",
                      title: "Minimum Wage",
                      value: (economyData?.labor?.minimumWage ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
                      icon: DollarSign,
                      description: "Per year",
                    },
                    {
                      id: "work-week",
                      title: "Average Work Week",
                      value: `${economyData?.labor?.averageWorkweekHours ?? 0}h`,
                      icon: Activity,
                      description: "Hours per week",
                    },
                    {
                      id: "productivity",
                      title: "Productivity Index",
                      value: `${(economyData?.labor?.skillsAndProductivity?.laborProductivityIndex ?? 0).toFixed(0)}`,
                      icon: TrendingUp,
                      trend: (economyData?.labor?.skillsAndProductivity?.productivityGrowthRate ?? 0) > 0 ? "up" : "stable",
                      trendValue: economyData?.labor?.skillsAndProductivity?.productivityGrowthRate ?? 0,
                      description: "Labor output efficiency",
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
                    },
                    {
                      id: "tertiary",
                      title: "Tertiary Education",
                      value: `${(economyData?.labor?.skillsAndProductivity?.tertiaryEducationRate ?? 0).toFixed(1)}%`,
                      icon: Users,
                      description: "University/college graduates",
                    },
                    {
                      id: "vocational",
                      title: "Vocational Training",
                      value: `${(economyData?.labor?.skillsAndProductivity?.vocationalTrainingRate ?? 0).toFixed(1)}%`,
                      icon: Users,
                      description: "Technical certification",
                    },
                  ]}
                />
              </motion.div>

              {/* Demographics & Social */}
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
                    },
                    {
                      id: "female-participation",
                      title: "Female Participation",
                      value: `${(economyData?.labor?.demographicsAndConditions?.femaleParticipationRate ?? 0).toFixed(1)}%`,
                      icon: Users,
                      description: "Women in workforce",
                    },
                    {
                      id: "unionization",
                      title: "Unionization Rate",
                      value: `${(economyData?.labor?.demographicsAndConditions?.unionizationRate ?? 0).toFixed(1)}%`,
                      icon: Users,
                      description: "Union membership",
                    },
                    {
                      id: "safety",
                      title: "Workplace Safety",
                      value: `${(economyData?.labor?.demographicsAndConditions?.workplaceSafetyIndex ?? 0).toFixed(0)}/100`,
                      icon: Activity,
                      trend: (economyData?.labor?.demographicsAndConditions?.workplaceSafetyIndex ?? 0) > 70 ? "up" : "stable",
                      description: "Safety index score",
                    },
                  ]}
                />
              </motion.div>
            </motion.div>
          </ThemedTabContent>
        </TabsContent>

        {/* Government Tab */}
        <TabsContent value="government" className="space-y-4" id="government">
          <ThemedTabContent theme="government" className="space-y-4">
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

              <Card className="glass-surface glass-refraction border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Building className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    Government Structure & Overview
                  </CardTitle>
                </CardHeader>
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
                        metrics={[
                          ...(governmentStructure?.headOfState ? [{
                            id: "head-of-state",
                            title: "Head of State",
                            value: governmentStructure.headOfState,
                            icon: Crown,
                            description: governmentStructure.governmentType || "State leader",
                          }] : []),
                          ...(governmentStructure?.headOfGovernment ? [{
                            id: "head-of-gov",
                            title: "Head of Government",
                            value: governmentStructure.headOfGovernment,
                            icon: Building,
                            description: "Executive leader",
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
                        metrics={[
                          ...(governmentStructure?.legislatureName ? [{
                            id: "legislature",
                            title: "Legislature",
                            value: governmentStructure.legislatureName,
                            icon: Building,
                            description: governmentStructure.legislatureType || "Legislative body",
                          }] : []),
                          ...(governmentStructure?.executiveName ? [{
                            id: "executive",
                            title: "Executive",
                            value: governmentStructure.executiveName,
                            icon: Building,
                            description: "Executive branch",
                          }] : []),
                          ...(governmentStructure?.judicialName ? [{
                            id: "judicial",
                            title: "Judiciary",
                            value: governmentStructure.judicialName,
                            icon: Building,
                            description: "Judicial branch",
                          }] : []),
                        ]}
                      />
                    </motion.div>

                    {/* Government Type Info */}
                    <motion.div variants={staggerItem}>
                      <Card className="bg-gradient-to-br from-amber-50/50 to-yellow-50/50 dark:from-amber-950/20 dark:to-yellow-950/20 border border-amber-200/50 dark:border-amber-700/30">
                        <CardContent className="p-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="p-2.5 rounded-lg bg-white/50 dark:bg-black/20">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Government Type</p>
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
                          },
                          {
                            id: "spending-gdp",
                            title: "Spending % of GDP",
                            value: `${(economyData?.spending?.spendingGDPPercent ?? 0).toFixed(1)}%`,
                            icon: TrendingUp,
                            description: "Government share of economy",
                            onClick: () => openMetricModal("government-spending", country.id),
                          },
                          {
                            id: "spending-capita",
                            title: "Per Capita",
                            value: (economyData?.spending?.spendingPerCapita ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
                            icon: Users,
                            description: "Spending per person",
                            onClick: () => openMetricModal("government-spending", country.id),
                          },
                          {
                            id: "balance",
                            title: "Budget Balance",
                            value: (economyData?.spending?.deficitSurplus ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }),
                            icon: (economyData?.spending?.deficitSurplus ?? 0) >= 0 ? TrendingUp : TrendingDown,
                            trend: (economyData?.spending?.deficitSurplus ?? 0) >= 0 ? "up" : "down",
                            description: (economyData?.spending?.deficitSurplus ?? 0) >= 0 ? "Surplus" : "Deficit",
                            onClick: () => openMetricModal("government-spending", country.id),
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
                          ...(economyData?.spending?.spendingCategories ?? []).slice(0, 5).map((cat: any, idx: number) => ({
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
                      <Card className="bg-gradient-to-br from-amber-50/50 to-yellow-50/50 dark:from-amber-950/20 dark:to-yellow-950/20 border border-amber-200/50 dark:border-amber-700/30">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold">Policy Initiatives</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className={`p-3 rounded-lg ${economyData?.spending?.performanceBasedBudgeting ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300' : 'bg-gray-100 dark:bg-gray-800'} border`}>
                              <p className="text-sm font-medium">{economyData?.spending?.performanceBasedBudgeting ? '✓' : '○'} Performance Budgeting</p>
                            </div>
                            <div className={`p-3 rounded-lg ${economyData?.spending?.universalBasicServices ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300' : 'bg-gray-100 dark:bg-gray-800'} border`}>
                              <p className="text-sm font-medium">{economyData?.spending?.universalBasicServices ? '✓' : '○'} Universal Services</p>
                            </div>
                            <div className={`p-3 rounded-lg ${economyData?.spending?.greenInvestmentPriority ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300' : 'bg-gray-100 dark:bg-gray-800'} border`}>
                              <p className="text-sm font-medium">{economyData?.spending?.greenInvestmentPriority ? '✓' : '○'} Green Investment</p>
                            </div>
                            <div className={`p-3 rounded-lg ${economyData?.spending?.digitalGovernmentInitiative ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300' : 'bg-gray-100 dark:bg-gray-800'} border`}>
                              <p className="text-sm font-medium">{economyData?.spending?.digitalGovernmentInitiative ? '✓' : '○'} Digital Government</p>
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
                          },
                          {
                            id: "tax-gdp",
                            title: "Tax Revenue % GDP",
                            value: `${(economyData?.fiscal?.taxRevenueGDPPercent ?? 0).toFixed(1)}%`,
                            icon: TrendingUp,
                            description: "Tax burden as share of GDP",
                          },
                          {
                            id: "tax-capita",
                            title: "Tax per Capita",
                            value: (economyData?.fiscal?.taxRevenuePerCapita ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
                            icon: Users,
                            description: "Average tax per person",
                          },
                          {
                            id: "budget-balance",
                            title: "Budget Balance",
                            value: (economyData?.fiscal?.budgetDeficitSurplus ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }),
                            icon: (economyData?.fiscal?.budgetDeficitSurplus ?? 0) >= 0 ? TrendingUp : TrendingDown,
                            trend: (economyData?.fiscal?.budgetDeficitSurplus ?? 0) >= 0 ? "up" : "down",
                            description: (economyData?.fiscal?.budgetDeficitSurplus ?? 0) >= 0 ? "Surplus" : "Deficit",
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
                          },
                          {
                            id: "internal-debt",
                            title: "Internal Debt",
                            value: `${(economyData?.fiscal?.internalDebtGDPPercent ?? 0).toFixed(1)}%`,
                            icon: Building,
                            description: "Domestic debt % GDP",
                            onClick: () => openMetricModal("debt", country.id),
                          },
                          {
                            id: "external-debt",
                            title: "External Debt",
                            value: `${(economyData?.fiscal?.externalDebtGDPPercent ?? 0).toFixed(1)}%`,
                            icon: Globe,
                            description: "Foreign debt % GDP",
                            onClick: () => openMetricModal("debt", country.id),
                          },
                          {
                            id: "debt-capita",
                            title: "Debt per Capita",
                            value: (economyData?.fiscal?.debtPerCapita ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
                            icon: Users,
                            description: "Public debt per person",
                            onClick: () => openMetricModal("debt", country.id),
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
                          },
                          {
                            id: "debt-service",
                            title: "Debt Service Costs",
                            value: (economyData?.fiscal?.debtServiceCosts ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }),
                            icon: DollarSign,
                            description: "Annual interest payments",
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
          <ThemedTabContent theme="demographics">
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
                    },
                    {
                      id: "life-expectancy",
                      title: "Life Expectancy",
                      value: `${(economyData?.demographics?.lifeExpectancy ?? 0).toFixed(1)} years`,
                      icon: Activity,
                      description: "Average lifespan",
                      onClick: () => openMetricModal("demographics-health", country.id),
                    },
                    {
                      id: "literacy",
                      title: "Literacy Rate",
                      value: `${(economyData?.demographics?.literacyRate ?? 0).toFixed(1)}%`,
                      icon: Users,
                      trend: (economyData?.demographics?.literacyRate ?? 0) > 90 ? "up" : "stable",
                      description: "Adult literacy",
                    },
                    {
                      id: "urbanization",
                      title: "Urbanization",
                      value: `${(economyData?.demographics?.urbanRuralSplit?.urban ?? 0).toFixed(1)}%`,
                      icon: Building,
                      description: "Urban population",
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
                      description: `${((age.percentage ?? 0) / 100 * (economyData?.core?.totalPopulation ?? 0)).toLocaleString()} people`,
                    }))
                  }
                />
              </motion.div>

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
                    },
                    {
                      id: "dependency-ratio",
                      title: "Dependency Ratio",
                      value: `${(economyData?.demographics?.dependencyRatio ?? 0).toFixed(1)}%`,
                      icon: Users,
                      description: "Non-working age population",
                    },
                    {
                      id: "growth-rate",
                      title: "Population Growth",
                      value: `${smartNormalizeGrowthRate(country.populationGrowthRate, 0).toFixed(2)}%`,
                      icon: TrendingUp,
                      trend: (country.populationGrowthRate ?? 0) > 0 ? "up" : (country.populationGrowthRate ?? 0) < 0 ? "down" : "stable",
                      description: "Annual growth rate",
                    },
                  ]}
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
          </ThemedTabContent>
        </TabsContent>

        {/* Advanced Analytics Tab */}
        {(variant === "premium" || variant === "unified") && (
          <TabsContent value="analytics" className="space-y-4" id="analytics">
            <ThemedTabContent theme="detailed" className="space-y-4">
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="space-y-4"
              >
                <motion.div variants={staggerItem}>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <TrendingUp className="h-4 w-4" />
                        Economic Trends & Projections
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {historicalLoading || forecastLoading ? (
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

                          {forecast && (
                            <div>
                              <h4 className="mb-3 text-sm font-medium">10-Year Projections</h4>
                              <div className="rounded-lg border p-4">
                                <p className="text-muted-foreground">
                                  Advanced forecasting models available in Executive tier.
                                </p>
                              </div>
                            </div>
                          )}
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
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <Activity className="h-4 w-4" />
                        Economic Health & Risk Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <SimplifiedTrendRiskAnalytics countryId={country.id} userId={user?.id} />
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={staggerItem}>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <BarChart3 className="h-4 w-4" />
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
                        allCountries={allCountries.countries.map((c) => ({
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
                        }))}
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

// National Identity Card with background image support
interface NationalIdentityCardProps {
  country: NonNullable<ReturnType<typeof useCountryData>["country"]>;
  onEditImage: () => void;
}

function NationalIdentityCard({ country, onEditImage }: NationalIdentityCardProps) {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);
  
  // Fetch the card image from database
  const { data: cardImage, isLoading } = api.cardImages.getByCountryAndType.useQuery(
    { countryId: country.id, cardType: "national_identity" },
    { enabled: !!country.id }
  );

  const imageUrl = cardImage?.imageUrl || null;
  const hasImage = !!imageUrl && !imageError;

  return (
    <Card className="glass-surface glass-refraction border-border overflow-hidden relative">
      {/* Background Image */}
      {hasImage && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: imageLoaded ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl!}
            alt="National Identity"
            className="h-full w-full object-cover"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
          {/* Gradient overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/80 to-background/40" />
        </motion.div>
      )}

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
        <TooltipContent>
          {hasImage ? "Change background image" : "Add background image"}
        </TooltipContent>
      </Tooltip>

      {/* Content */}
      <div className="relative z-[5]">
        <CardHeader className={hasImage 
          ? "border-b border-amber-200/30 dark:border-amber-700/30" 
          : "bg-gradient-to-r from-amber-50/50 to-yellow-50/50 dark:from-amber-950/20 dark:to-yellow-950/20 border-b border-amber-200/30 dark:border-amber-700/30"
        }>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            National Identity
            <span className="text-muted-foreground text-xs font-normal">{country.nationalIdentity?.officialName || country.name}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {country.nationalIdentity?.governmentType && (
              <motion.div 
                className="p-3 rounded-lg bg-gradient-to-br from-amber-50/80 to-yellow-50/80 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200/50 dark:border-amber-700/30"
                whileHover={{ scale: 1.02 }}
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Government</p>
                <p className="font-semibold text-amber-700 dark:text-amber-400">{country.nationalIdentity.governmentType}</p>
              </motion.div>
            )}
            {country.nationalIdentity?.capitalCity && (
              <motion.div 
                className="p-3 rounded-lg bg-gradient-to-br from-blue-50/80 to-cyan-50/80 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200/50 dark:border-blue-700/30"
                whileHover={{ scale: 1.02 }}
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Capital</p>
                <p className="font-semibold text-blue-700 dark:text-blue-400">{country.nationalIdentity.capitalCity}</p>
              </motion.div>
            )}
            {country.nationalIdentity?.officialLanguages && (
              <motion.div 
                className="p-3 rounded-lg bg-gradient-to-br from-purple-50/80 to-violet-50/80 dark:from-purple-900/20 dark:to-violet-900/20 border border-purple-200/50 dark:border-purple-700/30"
                whileHover={{ scale: 1.02 }}
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Languages</p>
                <p className="font-semibold text-purple-700 dark:text-purple-400">{country.nationalIdentity.officialLanguages}</p>
              </motion.div>
            )}
            {country.nationalIdentity?.currency && (
              <motion.div 
                className="p-3 rounded-lg bg-gradient-to-br from-emerald-50/80 to-green-50/80 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-200/50 dark:border-emerald-700/30"
                whileHover={{ scale: 1.02 }}
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Currency</p>
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {country.nationalIdentity.currency}
                  {country.nationalIdentity.currencySymbol && ` (${country.nationalIdentity.currencySymbol})`}
                </p>
              </motion.div>
            )}
            {country.nationalIdentity?.demonym && (
              <motion.div 
                className="p-3 rounded-lg bg-gradient-to-br from-rose-50/80 to-pink-50/80 dark:from-rose-900/20 dark:to-pink-900/20 border border-rose-200/50 dark:border-rose-700/30"
                whileHover={{ scale: 1.02 }}
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Demonym</p>
                <p className="font-semibold text-rose-700 dark:text-rose-400">{country.nationalIdentity.demonym}</p>
              </motion.div>
            )}
            {country.nationalIdentity?.callingCode && (
              <motion.div 
                className="p-3 rounded-lg bg-gradient-to-br from-indigo-50/80 to-blue-50/80 dark:from-indigo-900/20 dark:to-blue-900/20 border border-indigo-200/50 dark:border-indigo-700/30"
                whileHover={{ scale: 1.02 }}
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Calling Code</p>
                <p className="font-semibold text-indigo-700 dark:text-indigo-400">{country.nationalIdentity.callingCode}</p>
              </motion.div>
            )}
            {country.nationalIdentity?.timeZone && (
              <motion.div 
                className="p-3 rounded-lg bg-gradient-to-br from-cyan-50/80 to-teal-50/80 dark:from-cyan-900/20 dark:to-teal-900/20 border border-cyan-200/50 dark:border-cyan-700/30"
                whileHover={{ scale: 1.02 }}
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Time Zone</p>
                <p className="font-semibold text-cyan-700 dark:text-cyan-400">{country.nationalIdentity.timeZone}</p>
              </motion.div>
            )}
            {country.nationalIdentity?.internetTLD && (
              <motion.div 
                className="p-3 rounded-lg bg-gradient-to-br from-orange-50/80 to-amber-50/80 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200/50 dark:border-orange-700/30"
                whileHover={{ scale: 1.02 }}
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Internet TLD</p>
                <p className="font-semibold text-orange-700 dark:text-orange-400">{country.nationalIdentity.internetTLD}</p>
              </motion.div>
            )}
          </div>
          {country.nationalIdentity?.motto && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">National Motto</p>
              <p className="text-sm italic text-muted-foreground border-l-4 border-amber-400/50 pl-3">
                "{country.nationalIdentity.motto}"
              </p>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
}

export const MyCountryTabSystem = React.memo(MyCountryTabSystemComponent);
