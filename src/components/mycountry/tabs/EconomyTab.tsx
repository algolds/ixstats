"use client";

import React from "react";
import { motion } from "motion/react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Briefcase,
  Building,
  PieChart,
  Target,
  Sparkles,
  Activity,
  DollarSign,
  Users,
  Globe,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { ThemedTabContent } from "~/components/ui/themed-tab-content";
import {
  staggerContainer,
  staggerItem,
  SectorBreakdownCard,
  MetricCardGrid,
  TabHeroBanner,
  SectionHeaderBackground,
  type CardImageType,
} from "../primitives";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";
import { InlineHelpIcon } from "~/components/ui/help-icon";
import { WikiLoreBlock } from "../primitives/WikiLoreBlock";
import { smartNormalizeGrowthRate } from "~/lib/growth-calculations";
import type { MetricType } from "~/hooks/useMetricDetailsModal";

/**
 * Inner content of the "Economy" tab. Extracted from MyCountryTabSystem during
 * modular decomposition. Behavior preserved exactly. The keyed
 * `<TabsContent value="economy">` wrapper remains in the orchestrator.
 */
export function EconomyTab({
  country,
  economyData,
  countryImageData,
  setImageUploadModal,
  openMetricModal,
}: {
  country: any;
  economyData: any;
  countryImageData: any;
  setImageUploadModal: (state: { isOpen: boolean; cardType: CardImageType }) => void;
  openMetricModal: (metricType: MetricType, countryId: string) => void;
}) {
  return (
    <ThemedTabContent theme="economy" className="space-y-4">
      <TabHeroBanner
        context="overview_economy"
        title="Economic Overview"
        subtitle="GDP, trade, and sector analysis"
        icon={TrendingUp}
        accentColor="emerald"
      />
      {/* Editor Navigation Card */}
      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 p-3 dark:border-emerald-700/40 dark:from-emerald-950/20 dark:to-teal-950/20">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <p className="text-muted-foreground text-sm">
            Manage policies, tax rates, and economic infrastructure in the{" "}
            <strong>MyCountry Editor</strong>
          </p>
        </div>
        <Link href={createUrl("/mycountry/editor")}>
          <Button
            size="sm"
            className="gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600"
          >
            <TrendingUp className="h-3 w-3" />
            Open Editor
          </Button>
        </Link>
      </div>
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-4">
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
              onEditClick: () =>
                setImageUploadModal({ isOpen: true, cardType: "economic_indicators" }),
              autoFallback: true,
              countryImageData: countryImageData ?? undefined,
            }}
            metrics={[
              {
                id: "gdp",
                title: "Total GDP",
                value: (economyData?.core.nominalGDP ?? 0).toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                  notation: "compact",
                  maximumFractionDigits: 1,
                }),
                icon: DollarSign,
                description: `${country.economicTier || "Developing"} economy`,
                tooltip:
                  "Gross Domestic Product — the total monetary value of all goods and services produced within the country.",
                onClick: () => openMetricModal("total-gdp", country.id),
              },
              {
                id: "gdp-capita",
                title: "GDP per Capita",
                value: (economyData?.core.gdpPerCapita ?? 0).toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                }),
                icon: TrendingUp,
                trend: {
                  direction:
                    smartNormalizeGrowthRate(
                      country.realGDPGrowthRate || country.adjustedGdpGrowth,
                      0
                    ) > 0
                      ? "up"
                      : "stable",
                  value: smartNormalizeGrowthRate(
                    country.realGDPGrowthRate || country.adjustedGdpGrowth,
                    0
                  ),
                },
                description: "Economic output per person",
                tooltip:
                  "GDP divided by total population. Indicates average economic productivity per citizen.",
                onClick: () => openMetricModal("gdp-per-capita", country.id),
              },
              {
                id: "population",
                title: "Population",
                value: (economyData?.core.totalPopulation ?? 0).toLocaleString("en-US"),
                icon: Users,
                trend: {
                  direction:
                    smartNormalizeGrowthRate(country.populationGrowthRate, 0) > 0 ? "up" : "stable",
                  value: smartNormalizeGrowthRate(country.populationGrowthRate, 0),
                },
                description: "Total population",
                tooltip:
                  "Total number of citizens residing in the country. Growth rate reflects annual change.",
                onClick: () => openMetricModal("population", country.id),
              },
              {
                id: "unemployment",
                title: "Unemployment",
                value: `${(economyData?.labor?.unemploymentRate ?? 0).toFixed(1)}%`,
                icon: Briefcase,
                trend: {
                  direction: (economyData?.labor?.unemploymentRate ?? 0) < 5 ? "up" : "down",
                },
                description: "Labor force unemployed",
                tooltip:
                  "Percentage of the labor force actively seeking but unable to find employment.",
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
                tooltip:
                  "Share of the working-age population (15-64) that is either employed or actively seeking work.",
                onClick: () => openMetricModal("labor-force", country.id),
              },
              {
                id: "tax-revenue",
                title: "Tax Revenue",
                value: `${(economyData?.fiscal?.taxRevenueGDPPercent ?? 0).toFixed(1)}%`,
                icon: Building,
                description: "Percent of GDP",
                tooltip:
                  "Total government tax revenue expressed as a percentage of GDP. Indicates the tax burden on the economy.",
                onClick: () => openMetricModal("government-spending", country.id),
              },
              {
                id: "budget-balance",
                title: "Budget Balance",
                value: (economyData?.fiscal?.budgetDeficitSurplus ?? 0).toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                  notation: "compact",
                  maximumFractionDigits: 1,
                }),
                icon:
                  (economyData?.fiscal?.budgetDeficitSurplus ?? 0) >= 0 ? TrendingUp : TrendingDown,
                trend: {
                  direction: (economyData?.fiscal?.budgetDeficitSurplus ?? 0) >= 0 ? "up" : "down",
                },
                description:
                  (economyData?.fiscal?.budgetDeficitSurplus ?? 0) >= 0 ? "Surplus" : "Deficit",
                tooltip:
                  "Difference between government revenue and spending. Positive = surplus, negative = deficit.",
                onClick: () => openMetricModal("government-spending", country.id),
              },
              {
                id: "debt-gdp",
                title: "Debt to GDP",
                value: `${(economyData?.fiscal?.totalDebtGDPRatio ?? 0).toFixed(1)}%`,
                icon: BarChart3,
                trend: {
                  direction: (economyData?.fiscal?.totalDebtGDPRatio ?? 0) < 60 ? "up" : "down",
                },
                description: "Public debt ratio",
                tooltip:
                  "Total public debt as a percentage of GDP. Below 60% is generally considered healthy.",
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
                <div className="mb-2 flex justify-center">
                  <TabsList className="subtab-pills subtab-pills-economy">
                    <TabsTrigger value="sectors" className="subtab-pill subtab-pill-economy">
                      <Building className="subtab-icon h-4 w-4" />
                      <span>Sectors</span>
                    </TabsTrigger>
                    <TabsTrigger value="trade" className="subtab-pill subtab-pill-economy">
                      <Globe className="subtab-icon h-4 w-4" />
                      <span>Trade</span>
                    </TabsTrigger>
                    <TabsTrigger value="productivity" className="subtab-pill subtab-pill-economy">
                      <Activity className="subtab-icon h-4 w-4" />
                      <span>Productivity</span>
                    </TabsTrigger>
                    <TabsTrigger value="income" className="subtab-pill subtab-pill-economy">
                      <DollarSign className="subtab-icon h-4 w-4" />
                      <span>Income</span>
                    </TabsTrigger>
                    <TabsTrigger value="business" className="subtab-pill subtab-pill-economy">
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
                            value: ((economyData?.core.nominalGDP ?? 0) * 0.35).toLocaleString(
                              "en-US",
                              {
                                style: "currency",
                                currency: "USD",
                                notation: "compact",
                                maximumFractionDigits: 1,
                              }
                            ),
                            description: "35% of GDP",
                            icon: TrendingUp,
                            trend: { direction: "up", value: 2.3, label: "YoY" },
                            status: "success",
                            tooltip: "Total value of goods and services sold to foreign countries.",
                          },
                          {
                            id: "imports",
                            title: "Total Imports",
                            value: ((economyData?.core.nominalGDP ?? 0) * 0.32).toLocaleString(
                              "en-US",
                              {
                                style: "currency",
                                currency: "USD",
                                notation: "compact",
                                maximumFractionDigits: 1,
                              }
                            ),
                            description: "32% of GDP",
                            icon: TrendingDown,
                            trend: { direction: "up", value: 1.8, label: "YoY" },
                            status: "info",
                            tooltip:
                              "Total value of goods and services purchased from foreign countries.",
                          },
                          {
                            id: "balance",
                            title: "Trade Balance",
                            value: ((economyData?.core.nominalGDP ?? 0) * 0.03).toLocaleString(
                              "en-US",
                              {
                                style: "currency",
                                currency: "USD",
                                notation: "compact",
                                maximumFractionDigits: 1,
                              }
                            ),
                            description: "Surplus +3% GDP",
                            icon: Target,
                            trend: { direction: "up", value: 0.5, label: "YoY" },
                            status: "success",
                            badge: { label: "Surplus", variant: "default" },
                            tooltip:
                              "Exports minus imports. Positive = trade surplus, negative = trade deficit.",
                          },
                        ]}
                      />
                    </motion.div>

                    {/* Trade Composition Cards */}
                    <motion.div
                      variants={staggerItem}
                      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
                    >
                      <SectorBreakdownCard
                        title="Export Composition"
                        subtitle="Distribution of goods and services exported"
                        layout="list"
                        showProgressBars={true}
                        sectors={[
                          {
                            id: "manufactured",
                            name: "Manufactured Goods",
                            value: 0,
                            percentage: 45,
                            color: "blue",
                            trend: "up",
                            trendValue: 1.5,
                          },
                          {
                            id: "tech",
                            name: "Technology Products",
                            value: 0,
                            percentage: 25,
                            color: "cyan",
                            trend: "up",
                            trendValue: 3.2,
                          },
                          {
                            id: "services",
                            name: "Services",
                            value: 0,
                            percentage: 15,
                            color: "purple",
                            trend: "stable",
                          },
                          {
                            id: "agri",
                            name: "Agricultural Products",
                            value: 0,
                            percentage: 10,
                            color: "green",
                            trend: "down",
                            trendValue: -0.8,
                          },
                          {
                            id: "raw",
                            name: "Raw Materials",
                            value: 0,
                            percentage: 5,
                            color: "amber",
                            trend: "stable",
                          },
                        ]}
                      />

                      <SectorBreakdownCard
                        title="Import Composition"
                        subtitle="Distribution of goods and services imported"
                        layout="list"
                        showProgressBars={true}
                        sectors={[
                          {
                            id: "energy",
                            name: "Energy & Fuels",
                            value: 0,
                            percentage: 30,
                            color: "red",
                            trend: "down",
                            trendValue: -2.1,
                          },
                          {
                            id: "manufactured",
                            name: "Manufactured Goods",
                            value: 0,
                            percentage: 25,
                            color: "blue",
                            trend: "stable",
                          },
                          {
                            id: "tech",
                            name: "Technology Products",
                            value: 0,
                            percentage: 20,
                            color: "cyan",
                            trend: "up",
                            trendValue: 1.8,
                          },
                          {
                            id: "raw",
                            name: "Raw Materials",
                            value: 0,
                            percentage: 15,
                            color: "amber",
                            trend: "stable",
                          },
                          {
                            id: "food",
                            name: "Food & Agricultural",
                            value: 0,
                            percentage: 10,
                            color: "green",
                            trend: "up",
                            trendValue: 0.5,
                          },
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
                            tooltip:
                              "Output per worker relative to a baseline of 100. Higher values indicate greater efficiency.",
                          },
                          {
                            id: "innovation",
                            title: "Innovation Index",
                            value: "72/100",
                            description: "Global ranking",
                            icon: Target,
                            trend: { direction: "up", value: 3, label: "positions" },
                            status: "success",
                            tooltip:
                              "Composite score measuring R&D output, patents, and technological adoption.",
                          },
                          {
                            id: "rnd",
                            title: "R&D Investment",
                            value: "2.8%",
                            description: "Of GDP",
                            icon: Sparkles,
                            trend: { direction: "up", value: 0.2, label: "YoY" },
                            status: "info",
                            tooltip:
                              "Research and development spending as a share of GDP. OECD average is ~2.5%.",
                          },
                          {
                            id: "competitiveness",
                            title: "Competitiveness",
                            value: "68/100",
                            description: "Global index",
                            icon: Activity,
                            trend: { direction: "stable" },
                            status: "info",
                            tooltip:
                              "Global competitiveness score based on institutions, infrastructure, and market efficiency.",
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
                          {
                            id: "infrastructure",
                            name: "Infrastructure Quality",
                            value: 0,
                            percentage: 75,
                            color: "blue",
                            trend: "up",
                            trendValue: 1.5,
                          },
                          {
                            id: "human-capital",
                            name: "Human Capital Index",
                            value: 0,
                            percentage: 82,
                            color: "purple",
                            trend: "up",
                            trendValue: 2.1,
                          },
                          {
                            id: "tech-adoption",
                            name: "Technology Adoption",
                            value: 0,
                            percentage: 70,
                            color: "emerald",
                            trend: "up",
                            trendValue: 3.8,
                          },
                          {
                            id: "business-env",
                            name: "Business Environment",
                            value: 0,
                            percentage: 78,
                            color: "amber",
                            trend: "stable",
                          },
                          {
                            id: "digital-infra",
                            name: "Digital Infrastructure",
                            value: 0,
                            percentage: 85,
                            color: "cyan",
                            trend: "up",
                            trendValue: 4.2,
                          },
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
                            value: ((economyData?.core.gdpPerCapita ?? 0) * 0.75).toLocaleString(
                              "en-US",
                              {
                                style: "currency",
                                currency: "USD",
                                maximumFractionDigits: 0,
                              }
                            ),
                            description: "Per year",
                            icon: DollarSign,
                            trend: { direction: "up", value: 2.8, label: "YoY" },
                            status: "success",
                            tooltip:
                              "The middle-point annual income — half the population earns more, half earns less.",
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
                            tooltip:
                              "Measures income inequality on a 0-1 scale. 0 = perfect equality, 1 = maximum inequality.",
                          },
                          {
                            id: "poverty",
                            title: "Poverty Rate",
                            value: "8.5%",
                            description: "Below poverty line",
                            icon: Users,
                            trend: { direction: "down", value: 0.3, label: "YoY" },
                            status: "warning",
                            tooltip:
                              "Percentage of the population living below the national poverty line.",
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
                          {
                            id: "lower",
                            name: "Lower Class",
                            value: (economyData?.core.gdpPerCapita ?? 0) * 0.3,
                            percentage: 15,
                            color: "red",
                            trend: "down",
                            trendValue: -0.5,
                          },
                          {
                            id: "lower-middle",
                            name: "Lower Middle Class",
                            value: (economyData?.core.gdpPerCapita ?? 0) * 0.6,
                            percentage: 25,
                            color: "amber",
                            trend: "stable",
                          },
                          {
                            id: "middle",
                            name: "Middle Class",
                            value: (economyData?.core.gdpPerCapita ?? 0) * 0.9,
                            percentage: 35,
                            color: "green",
                            trend: "up",
                            trendValue: 1.2,
                          },
                          {
                            id: "upper-middle",
                            name: "Upper Middle Class",
                            value: (economyData?.core.gdpPerCapita ?? 0) * 1.5,
                            percentage: 20,
                            color: "blue",
                            trend: "up",
                            trendValue: 0.8,
                          },
                          {
                            id: "upper",
                            name: "Upper Class",
                            value: (economyData?.core.gdpPerCapita ?? 0) * 4.0,
                            percentage: 5,
                            color: "purple",
                            trend: "stable",
                          },
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
                            tooltip:
                              "World Bank ranking of regulatory environment for starting and operating a business.",
                          },
                          {
                            id: "startups",
                            title: "Startup Formation",
                            value: "12.5",
                            description: "Per 1000 people",
                            icon: Sparkles,
                            trend: { direction: "up", value: 1.2, label: "YoY" },
                            status: "success",
                            tooltip:
                              "New business registrations per 1,000 working-age population annually.",
                          },
                          {
                            id: "fdi",
                            title: "FDI Inflow",
                            value: ((economyData?.core.nominalGDP ?? 0) * 0.025).toLocaleString(
                              "en-US",
                              {
                                style: "currency",
                                currency: "USD",
                                notation: "compact",
                                maximumFractionDigits: 1,
                              }
                            ),
                            description: "2.5% of GDP",
                            icon: Globe,
                            trend: { direction: "up", value: 8.5, label: "YoY" },
                            status: "success",
                            tooltip:
                              "Foreign Direct Investment — capital invested by foreign entities into domestic businesses.",
                          },
                          {
                            id: "credit",
                            title: "Credit to Private Sector",
                            value: "85%",
                            description: "Of GDP",
                            icon: DollarSign,
                            trend: { direction: "up", value: 2.1, label: "YoY" },
                            status: "info",
                            tooltip:
                              "Total domestic credit provided to the private sector as a share of GDP. Indicates financial depth.",
                          },
                        ]}
                      />
                    </motion.div>

                    {/* Business Environment & Demographics */}
                    <motion.div
                      variants={staggerItem}
                      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
                    >
                      <SectorBreakdownCard
                        title="Business Environment"
                        subtitle="Key regulatory and operational metrics"
                        layout="list"
                        showProgressBars={true}
                        sectors={[
                          {
                            id: "time",
                            name: "Time to Start a Business",
                            value: 0,
                            percentage: 92,
                            color: "green",
                            description: "8 days",
                          },
                          {
                            id: "cost",
                            name: "Cost to Start (% of income)",
                            value: 0,
                            percentage: 97.5,
                            color: "blue",
                            description: "2.5%",
                          },
                          {
                            id: "regulatory",
                            name: "Regulatory Quality",
                            value: 0,
                            percentage: 72,
                            color: "purple",
                            trend: "up",
                            trendValue: 2.3,
                          },
                          {
                            id: "finance",
                            name: "Access to Finance",
                            value: 0,
                            percentage: 68,
                            color: "amber",
                            trend: "up",
                            trendValue: 1.5,
                          },
                        ]}
                      />

                      <SectorBreakdownCard
                        title="Business Demographics"
                        subtitle="Distribution of business by size"
                        layout="list"
                        showProgressBars={true}
                        sectors={[
                          {
                            id: "small",
                            name: "Small Businesses (0-50)",
                            value: 0,
                            percentage: 85,
                            color: "green",
                          },
                          {
                            id: "medium",
                            name: "Medium Businesses (50-250)",
                            value: 0,
                            percentage: 12,
                            color: "blue",
                          },
                          {
                            id: "large",
                            name: "Large Businesses (250+)",
                            value: 0,
                            percentage: 3,
                            color: "purple",
                          },
                          {
                            id: "entrepreneurship",
                            name: "Entrepreneurship Rate",
                            value: 0,
                            percentage: 15.2,
                            color: "amber",
                            trend: "up",
                            trendValue: 0.8,
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
      </motion.div>
      <WikiLoreBlock context="economy" themeColor="emerald" title="Economic Lore" />
    </ThemedTabContent>
  );
}
