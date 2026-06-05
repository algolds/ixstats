"use client";

import React from "react";
import { motion } from "motion/react";
import {
  TrendingUp,
  TrendingDown,
  Building,
  Target,
  DollarSign,
  Users,
  Globe,
  Crown,
  CheckCircle2,
  Circle,
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
import { WikiLoreBlock } from "../primitives/WikiLoreBlock";
import type { MetricType } from "~/hooks/useMetricDetailsModal";

/**
 * Inner content of the "Government" tab. Extracted from MyCountryTabSystem
 * during modular decomposition. Behavior preserved exactly. The keyed
 * `<TabsContent value="government">` wrapper remains in the orchestrator.
 */
export function GovernmentTab({
  country,
  economyData,
  countryImageData,
  governmentStructure,
  setImageUploadModal,
  openMetricModal,
}: {
  country: any;
  economyData: any;
  countryImageData: any;
  governmentStructure: any;
  setImageUploadModal: (state: { isOpen: boolean; cardType: CardImageType }) => void;
  openMetricModal: (metricType: MetricType, countryId: string) => void;
}) {
  return (
    <ThemedTabContent theme="government" className="space-y-4">
      <TabHeroBanner
        context="overview_government"
        title="Government & Fiscal"
        subtitle="Structure, spending, and fiscal policy"
        icon={Building}
        accentColor="amber"
      />
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-4">
        {/* Editor Navigation Card */}
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50/50 to-yellow-50/50 p-3 dark:border-amber-700/40 dark:from-amber-950/20 dark:to-yellow-950/20">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <p className="text-muted-foreground text-sm">
              Edit your tax system, government structure, and budgets in the{" "}
              <strong>MyCountry Editor</strong>
            </p>
          </div>
          <Link href={createUrl("/mycountry/editor")}>
            <Button
              size="sm"
              className="gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white hover:from-amber-600 hover:to-yellow-600"
            >
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
              <div className="mb-2 flex justify-center">
                <TabsList className="subtab-pills subtab-pills-government">
                  <TabsTrigger value="structure" className="subtab-pill subtab-pill-government">
                    <Crown className="subtab-icon h-4 w-4" />
                    <span>Structure</span>
                  </TabsTrigger>
                  <TabsTrigger value="spending" className="subtab-pill subtab-pill-government">
                    <DollarSign className="subtab-icon h-4 w-4" />
                    <span>Budget</span>
                  </TabsTrigger>
                  <TabsTrigger value="fiscal" className="subtab-pill subtab-pill-government">
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
                        onEditClick: () =>
                          setImageUploadModal({ isOpen: true, cardType: "head_of_state" }),
                        autoFallback: true,
                        countryImageData: countryImageData ?? undefined,
                      }}
                      metrics={[
                        ...(governmentStructure?.headOfState
                          ? [
                              {
                                id: "head-of-state",
                                title: "Head of State",
                                value: governmentStructure.headOfState,
                                icon: Crown,
                                description: governmentStructure.governmentType || "State leader",
                                tooltip:
                                  "The chief public representative and ceremonial leader of the nation.",
                              },
                            ]
                          : []),
                        ...(governmentStructure?.headOfGovernment
                          ? [
                              {
                                id: "head-of-gov",
                                title: "Head of Government",
                                value: governmentStructure.headOfGovernment,
                                icon: Building,
                                description: "Executive leader",
                                tooltip:
                                  "The chief executive who directs government operations and policy.",
                              },
                            ]
                          : []),
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
                        onEditClick: () =>
                          setImageUploadModal({ isOpen: true, cardType: "government" }),
                        autoFallback: true,
                        countryImageData: countryImageData ?? undefined,
                      }}
                      metrics={[
                        ...(governmentStructure?.legislatureName
                          ? [
                              {
                                id: "legislature",
                                title: "Legislature",
                                value: governmentStructure.legislatureName,
                                icon: Building,
                                description:
                                  governmentStructure.legislatureType || "Legislative body",
                                tooltip:
                                  "The primary lawmaking body responsible for enacting and amending legislation.",
                              },
                            ]
                          : []),
                        ...(governmentStructure?.executiveName
                          ? [
                              {
                                id: "executive",
                                title: "Executive",
                                value: governmentStructure.executiveName,
                                icon: Building,
                                description: "Executive branch",
                                tooltip:
                                  "The branch responsible for implementing and enforcing laws and policies.",
                              },
                            ]
                          : []),
                        ...(governmentStructure?.judicialName
                          ? [
                              {
                                id: "judicial",
                                title: "Judiciary",
                                value: governmentStructure.judicialName,
                                icon: Building,
                                description: "Judicial branch",
                                tooltip:
                                  "The branch responsible for interpreting laws and administering justice.",
                              },
                            ]
                          : []),
                      ]}
                    />
                  </motion.div>

                  {/* Government Type Info */}
                  <motion.div variants={staggerItem}>
                    <Card className="glass-surface glass-refraction border-border">
                      <CardContent className="p-4">
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                          <div className="rounded-lg bg-white/50 p-3 dark:bg-black/20">
                            <p className="text-muted-foreground mb-1 text-xs tracking-wide uppercase">
                              Government Type
                            </p>
                            <p className="font-semibold text-amber-700 dark:text-amber-400">
                              {governmentStructure?.governmentType ||
                                country.nationalIdentity?.governmentType ||
                                "N/A"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-white/50 p-3 dark:bg-black/20">
                            <p className="text-muted-foreground mb-1 text-xs tracking-wide uppercase">
                              Official Name
                            </p>
                            <p className="font-semibold text-amber-700 dark:text-amber-400">
                              {governmentStructure?.governmentName ||
                                country.nationalIdentity?.officialName ||
                                country.name}
                            </p>
                          </div>
                          <div className="rounded-lg bg-white/50 p-3 dark:bg-black/20">
                            <p className="text-muted-foreground mb-1 text-xs tracking-wide uppercase">
                              Capital
                            </p>
                            <p className="font-semibold text-amber-700 dark:text-amber-400">
                              {country.nationalIdentity?.capitalCity || "N/A"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-white/50 p-3 dark:bg-black/20">
                            <p className="text-muted-foreground mb-1 text-xs tracking-wide uppercase">
                              Currency
                            </p>
                            <p className="font-semibold text-amber-700 dark:text-amber-400">
                              {country.nationalIdentity?.currency || "N/A"}
                            </p>
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
                          value: (economyData?.spending?.totalSpending ?? 0).toLocaleString(
                            "en-US",
                            {
                              style: "currency",
                              currency: "USD",
                              notation: "compact",
                              maximumFractionDigits: 1,
                            }
                          ),
                          icon: DollarSign,
                          description: "Annual government expenditure",
                          onClick: () => openMetricModal("government-spending", country.id),
                          tooltip:
                            "Total annual government spending across all departments, programs, and transfers.",
                        },
                        {
                          id: "spending-gdp",
                          title: "Spending % of GDP",
                          value: `${(economyData?.spending?.spendingGDPPercent ?? 0).toFixed(1)}%`,
                          icon: TrendingUp,
                          description: "Government share of economy",
                          onClick: () => openMetricModal("government-spending", country.id),
                          tooltip:
                            "Government expenditure as a share of total GDP. Indicates the size of the public sector.",
                        },
                        {
                          id: "spending-capita",
                          title: "Per Capita",
                          value: (economyData?.spending?.spendingPerCapita ?? 0).toLocaleString(
                            "en-US",
                            {
                              style: "currency",
                              currency: "USD",
                              maximumFractionDigits: 0,
                            }
                          ),
                          icon: Users,
                          description: "Spending per person",
                          onClick: () => openMetricModal("government-spending", country.id),
                          tooltip:
                            "Total government spending divided by population. Shows per-person public investment.",
                        },
                        {
                          id: "balance",
                          title: "Budget Balance",
                          value: (economyData?.spending?.deficitSurplus ?? 0).toLocaleString(
                            "en-US",
                            {
                              style: "currency",
                              currency: "USD",
                              notation: "compact",
                              maximumFractionDigits: 1,
                            }
                          ),
                          icon:
                            (economyData?.spending?.deficitSurplus ?? 0) >= 0
                              ? TrendingUp
                              : TrendingDown,
                          trend: {
                            direction:
                              (economyData?.spending?.deficitSurplus ?? 0) >= 0 ? "up" : "down",
                          },
                          description:
                            (economyData?.spending?.deficitSurplus ?? 0) >= 0
                              ? "Surplus"
                              : "Deficit",
                          onClick: () => openMetricModal("government-spending", country.id),
                          tooltip:
                            "Revenue minus spending. Positive = budget surplus, negative = budget deficit.",
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
                          percentage:
                            ((economyData?.spending?.education ?? 0) /
                              (economyData?.spending?.totalSpending || 1)) *
                            100,
                          color: "blue",
                        },
                        {
                          id: "healthcare",
                          name: "Healthcare",
                          value: economyData?.spending?.healthcare ?? 0,
                          percentage:
                            ((economyData?.spending?.healthcare ?? 0) /
                              (economyData?.spending?.totalSpending || 1)) *
                            100,
                          color: "emerald",
                        },
                        {
                          id: "social",
                          name: "Social Safety",
                          value: economyData?.spending?.socialSafety ?? 0,
                          percentage:
                            ((economyData?.spending?.socialSafety ?? 0) /
                              (economyData?.spending?.totalSpending || 1)) *
                            100,
                          color: "purple",
                        },
                        ...(economyData?.spending?.spendingCategories ?? [])
                          .filter(
                            (cat: any) =>
                              ![
                                "education",
                                "healthcare",
                                "social services",
                                "social safety",
                              ].includes(cat.category?.toLowerCase())
                          )
                          .slice(0, 5)
                          .map((cat: any, idx: number) => ({
                            id: cat.category?.toLowerCase().replace(/\s+/g, "-") ?? `cat-${idx}`,
                            name: cat.category ?? "Other",
                            value: cat.amount ?? 0,
                            percentage: cat.gdpPercent ?? 0,
                            color: ["amber", "cyan", "rose", "indigo", "teal"][idx % 5],
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
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                          <div
                            className={`glass-hierarchy-child flex items-center gap-2 rounded-lg p-3 ${economyData?.spending?.performanceBasedBudgeting ? "border-emerald-300 dark:border-emerald-700/50" : ""} border`}
                          >
                            {economyData?.spending?.performanceBasedBudgeting ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                            ) : (
                              <Circle className="text-muted-foreground h-4 w-4 shrink-0" />
                            )}
                            <p className="text-sm font-medium">Performance Budgeting</p>
                          </div>
                          <div
                            className={`glass-hierarchy-child flex items-center gap-2 rounded-lg p-3 ${economyData?.spending?.universalBasicServices ? "border-emerald-300 dark:border-emerald-700/50" : ""} border`}
                          >
                            {economyData?.spending?.universalBasicServices ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                            ) : (
                              <Circle className="text-muted-foreground h-4 w-4 shrink-0" />
                            )}
                            <p className="text-sm font-medium">Universal Services</p>
                          </div>
                          <div
                            className={`glass-hierarchy-child flex items-center gap-2 rounded-lg p-3 ${economyData?.spending?.greenInvestmentPriority ? "border-emerald-300 dark:border-emerald-700/50" : ""} border`}
                          >
                            {economyData?.spending?.greenInvestmentPriority ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                            ) : (
                              <Circle className="text-muted-foreground h-4 w-4 shrink-0" />
                            )}
                            <p className="text-sm font-medium">Green Investment</p>
                          </div>
                          <div
                            className={`glass-hierarchy-child flex items-center gap-2 rounded-lg p-3 ${economyData?.spending?.digitalGovernmentInitiative ? "border-emerald-300 dark:border-emerald-700/50" : ""} border`}
                          >
                            {economyData?.spending?.digitalGovernmentInitiative ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                            ) : (
                              <Circle className="text-muted-foreground h-4 w-4 shrink-0" />
                            )}
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
                          value: (economyData?.fiscal?.governmentRevenueTotal ?? 0).toLocaleString(
                            "en-US",
                            {
                              style: "currency",
                              currency: "USD",
                              notation: "compact",
                              maximumFractionDigits: 1,
                            }
                          ),
                          icon: DollarSign,
                          description: "Annual government revenue",
                          tooltip:
                            "Total annual government income from taxes, fees, and other sources.",
                        },
                        {
                          id: "tax-gdp",
                          title: "Tax Revenue % GDP",
                          value: `${(economyData?.fiscal?.taxRevenueGDPPercent ?? 0).toFixed(1)}%`,
                          icon: TrendingUp,
                          description: "Tax burden as share of GDP",
                          tooltip:
                            "Total tax revenue as a percentage of GDP. Indicates the overall tax burden on the economy.",
                        },
                        {
                          id: "tax-capita",
                          title: "Tax per Capita",
                          value: (economyData?.fiscal?.taxRevenuePerCapita ?? 0).toLocaleString(
                            "en-US",
                            {
                              style: "currency",
                              currency: "USD",
                              maximumFractionDigits: 0,
                            }
                          ),
                          icon: Users,
                          description: "Average tax per person",
                          tooltip:
                            "Total tax revenue divided by population. Shows the average tax contribution per citizen.",
                        },
                        {
                          id: "budget-balance",
                          title: "Budget Balance",
                          value: (economyData?.fiscal?.budgetDeficitSurplus ?? 0).toLocaleString(
                            "en-US",
                            {
                              style: "currency",
                              currency: "USD",
                              notation: "compact",
                              maximumFractionDigits: 1,
                            }
                          ),
                          icon:
                            (economyData?.fiscal?.budgetDeficitSurplus ?? 0) >= 0
                              ? TrendingUp
                              : TrendingDown,
                          trend: {
                            direction:
                              (economyData?.fiscal?.budgetDeficitSurplus ?? 0) >= 0 ? "up" : "down",
                          },
                          description:
                            (economyData?.fiscal?.budgetDeficitSurplus ?? 0) >= 0
                              ? "Surplus"
                              : "Deficit",
                          tooltip:
                            "Revenue minus expenditure. Positive = surplus, negative = deficit.",
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
                          trend: {
                            direction:
                              (economyData?.fiscal?.totalDebtGDPRatio ?? 0) < 60 ? "up" : "down",
                          },
                          description: "Public debt ratio",
                          onClick: () => openMetricModal("debt", country.id),
                          tooltip:
                            "Total government debt as a percentage of GDP. Below 60% is generally considered sustainable.",
                        },
                        {
                          id: "internal-debt",
                          title: "Internal Debt",
                          value: `${(economyData?.fiscal?.internalDebtGDPPercent ?? 0).toFixed(1)}%`,
                          icon: Building,
                          description: "Domestic debt % GDP",
                          onClick: () => openMetricModal("debt", country.id),
                          tooltip:
                            "Debt owed to domestic creditors (banks, citizens, institutions) as a share of GDP.",
                        },
                        {
                          id: "external-debt",
                          title: "External Debt",
                          value: `${(economyData?.fiscal?.externalDebtGDPPercent ?? 0).toFixed(1)}%`,
                          icon: Globe,
                          description: "Foreign debt % GDP",
                          onClick: () => openMetricModal("debt", country.id),
                          tooltip:
                            "Debt owed to foreign creditors and international institutions as a share of GDP.",
                        },
                        {
                          id: "debt-capita",
                          title: "Debt per Capita",
                          value: (economyData?.fiscal?.debtPerCapita ?? 0).toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                            maximumFractionDigits: 0,
                          }),
                          icon: Users,
                          description: "Public debt per person",
                          onClick: () => openMetricModal("debt", country.id),
                          tooltip:
                            "Total public debt divided by population. Shows each citizen's theoretical share of national debt.",
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
                          value: economyData?.fiscal?.taxRates?.salesTaxRate ?? 0,
                          percentage: economyData?.fiscal?.taxRates?.salesTaxRate ?? 0,
                          color: "blue",
                          description: "VAT/Sales tax rate",
                        },
                        {
                          id: "property-tax",
                          name: "Property Tax",
                          value: economyData?.fiscal?.taxRates?.propertyTaxRate ?? 0,
                          percentage: economyData?.fiscal?.taxRates?.propertyTaxRate ?? 0,
                          color: "emerald",
                          description: "Real estate tax rate",
                        },
                        {
                          id: "payroll-tax",
                          name: "Payroll Tax",
                          value: economyData?.fiscal?.taxRates?.payrollTaxRate ?? 0,
                          percentage: economyData?.fiscal?.taxRates?.payrollTaxRate ?? 0,
                          color: "amber",
                          description: "Social security contributions",
                        },
                        {
                          id: "wealth-tax",
                          name: "Wealth Tax",
                          value: economyData?.fiscal?.taxRates?.wealthTaxRate ?? 0,
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
                          tooltip:
                            "Weighted average interest rate the government pays on its outstanding debt.",
                        },
                        {
                          id: "debt-service",
                          title: "Debt Service Costs",
                          value: (economyData?.fiscal?.debtServiceCosts ?? 0).toLocaleString(
                            "en-US",
                            {
                              style: "currency",
                              currency: "USD",
                              notation: "compact",
                              maximumFractionDigits: 1,
                            }
                          ),
                          icon: DollarSign,
                          description: "Annual interest payments",
                          tooltip:
                            "Annual cost of servicing government debt, including interest and principal payments.",
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
  );
}
