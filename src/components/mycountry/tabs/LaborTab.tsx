"use client";

import React from "react";
import { motion } from "motion/react";
import { TrendingUp, TrendingDown, Briefcase, Activity, DollarSign, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import { ThemedTabContent } from "~/components/ui/themed-tab-content";
import {
  staggerContainer,
  staggerItem,
  SectorBreakdownCard,
  MetricCardGrid,
  TabHeroBanner,
  type CardImageType,
} from "../primitives";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";
import { WikiLoreBlock } from "../primitives/WikiLoreBlock";
import type { MetricType } from "~/hooks/useMetricDetailsModal";

/**
 * Inner content of the "Labor" tab. Extracted from MyCountryTabSystem during
 * modular decomposition. Behavior preserved exactly. The keyed
 * `<TabsContent value="labor">` wrapper remains in the orchestrator.
 */
export function LaborTab({
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
    <ThemedTabContent theme="labor" className="space-y-4">
      <TabHeroBanner
        context="overview_labor"
        title="Labor & Workforce"
        subtitle="Employment, wages, and human capital"
        icon={Briefcase}
        accentColor="red"
      />
      {/* Editor Navigation Card */}
      <div className="flex items-center justify-between rounded-lg border border-red-200 bg-gradient-to-r from-red-50/50 to-orange-50/50 p-3 dark:border-red-700/40 dark:from-red-950/20 dark:to-orange-950/20">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-red-600 dark:text-red-400" />
          <p className="text-muted-foreground text-sm">
            Adjust labor laws, minimum wages, and education policies in the{" "}
            <strong>MyCountry Editor</strong>
          </p>
        </div>
        <Link href={createUrl("/mycountry/editor")}>
          <Button
            size="sm"
            className="gap-1.5 bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-red-600 hover:to-orange-600"
          >
            <Briefcase className="h-3 w-3" />
            Open Editor
          </Button>
        </Link>
      </div>
      <Tabs defaultValue="workforce" className="space-y-4">
        <div className="mb-2 flex justify-center">
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
                    trend: {
                      direction:
                        (economyData?.labor?.laborForceParticipationRate ?? 0) > 60 ? "up" : "down",
                    },
                    description: "Working age population in workforce",
                    onClick: () => openMetricModal("labor-force", country.id),
                    tooltip:
                      "Percentage of working-age population (15-64) participating in the labor force.",
                  },
                  {
                    id: "employment",
                    title: "Employment Rate",
                    value: `${(economyData?.labor?.employmentRate ?? 0).toFixed(1)}%`,
                    icon: TrendingUp,
                    trend: {
                      direction: (economyData?.labor?.employmentRate ?? 0) > 90 ? "up" : "stable",
                    },
                    description: "Of labor force employed",
                    onClick: () => openMetricModal("employment", country.id),
                    tooltip:
                      "Percentage of the labor force that is currently employed in any capacity.",
                  },
                  {
                    id: "unemployment",
                    title: "Unemployment Rate",
                    value: `${(economyData?.labor?.unemploymentRate ?? 0).toFixed(1)}%`,
                    icon: TrendingDown,
                    trend: {
                      direction: (economyData?.labor?.unemploymentRate ?? 0) < 5 ? "up" : "down",
                    },
                    description: "Seeking employment",
                    onClick: () => openMetricModal("unemployment", country.id),
                    tooltip:
                      "Percentage of the labor force that is actively seeking but unable to find work.",
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
                    value:
                      (economyData?.labor?.totalWorkforce ?? 0) *
                      ((economyData?.labor?.employmentBySector?.agriculture ?? 0) / 100),
                    percentage: economyData?.labor?.employmentBySector?.agriculture ?? 0,
                    color: "green",
                    trend: "stable",
                    description: "Farming, forestry, fishing",
                    imageKeyword: "sector_agriculture",
                  },
                  {
                    id: "industry",
                    name: "Industry",
                    value:
                      (economyData?.labor?.totalWorkforce ?? 0) *
                      ((economyData?.labor?.employmentBySector?.industry ?? 0) / 100),
                    percentage: economyData?.labor?.employmentBySector?.industry ?? 0,
                    color: "blue",
                    trend: "stable",
                    description: "Manufacturing, construction",
                    imageKeyword: "sector_industry",
                  },
                  {
                    id: "services",
                    name: "Services",
                    value:
                      (economyData?.labor?.totalWorkforce ?? 0) *
                      ((economyData?.labor?.employmentBySector?.services ?? 0) / 100),
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
                    value: (economyData?.labor?.averageAnnualIncome ?? 0).toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    }),
                    icon: DollarSign,
                    description: "Mean annual earnings",
                    tooltip: "Mean annual gross earnings across all employed workers before taxes.",
                  },
                  {
                    id: "min-wage",
                    title: "Minimum Wage",
                    value: (economyData?.labor?.minimumWage ?? 0).toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    }),
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
                    trend: {
                      direction:
                        (economyData?.labor?.skillsAndProductivity?.productivityGrowthRate ?? 0) > 0
                          ? "up"
                          : "stable",
                      value: economyData?.labor?.skillsAndProductivity?.productivityGrowthRate ?? 0,
                    },
                    description: "Labor output efficiency",
                    tooltip:
                      "Economic output per worker-hour. Higher values indicate greater labor efficiency.",
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
                    value: economyData?.labor?.employmentByType?.fullTime ?? 0,
                    percentage: economyData?.labor?.employmentByType?.fullTime ?? 0,
                    color: "emerald",
                  },
                  {
                    id: "parttime",
                    name: "Part-Time",
                    value: economyData?.labor?.employmentByType?.partTime ?? 0,
                    percentage: economyData?.labor?.employmentByType?.partTime ?? 0,
                    color: "blue",
                  },
                  {
                    id: "selfemployed",
                    name: "Self-Employed",
                    value: economyData?.labor?.employmentByType?.selfEmployed ?? 0,
                    percentage: economyData?.labor?.employmentByType?.selfEmployed ?? 0,
                    color: "amber",
                  },
                  {
                    id: "temporary",
                    name: "Temporary",
                    value: economyData?.labor?.employmentByType?.temporary ?? 0,
                    percentage: economyData?.labor?.employmentByType?.temporary ?? 0,
                    color: "purple",
                  },
                  {
                    id: "informal",
                    name: "Informal",
                    value: economyData?.labor?.employmentByType?.informal ?? 0,
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
                    tooltip:
                      "Average number of years of formal education completed by working-age adults.",
                  },
                  {
                    id: "tertiary",
                    title: "Tertiary Education",
                    value: `${(economyData?.labor?.skillsAndProductivity?.tertiaryEducationRate ?? 0).toFixed(1)}%`,
                    icon: Users,
                    description: "University/college graduates",
                    tooltip:
                      "Share of the workforce holding a university degree or equivalent qualification.",
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
                    trend: {
                      direction:
                        (economyData?.labor?.demographicsAndConditions?.youthUnemploymentRate ??
                          0) < 15
                          ? "up"
                          : "down",
                    },
                    description: "Ages 15-24",
                    tooltip:
                      "Unemployment rate among people aged 15-24. High rates signal structural labor market issues.",
                  },
                  {
                    id: "female-participation",
                    title: "Female Participation",
                    value: `${(economyData?.labor?.demographicsAndConditions?.femaleParticipationRate ?? 0).toFixed(1)}%`,
                    icon: Users,
                    description: "Women in workforce",
                    tooltip:
                      "Percentage of working-age women who are employed or actively seeking employment.",
                  },
                  {
                    id: "unionization",
                    title: "Unionization Rate",
                    value: `${(economyData?.labor?.demographicsAndConditions?.unionizationRate ?? 0).toFixed(1)}%`,
                    icon: Users,
                    description: "Union membership",
                    tooltip:
                      "Share of the workforce that belongs to a labor union or trade association.",
                  },
                  {
                    id: "safety",
                    title: "Workplace Safety",
                    value: `${(economyData?.labor?.demographicsAndConditions?.workplaceSafetyIndex ?? 0).toFixed(0)}/100`,
                    icon: Activity,
                    trend: {
                      direction:
                        (economyData?.labor?.demographicsAndConditions?.workplaceSafetyIndex ?? 0) >
                        70
                          ? "up"
                          : "stable",
                    },
                    description: "Safety index score",
                    tooltip:
                      "Composite index measuring occupational safety standards and incident rates. 100 = safest.",
                  },
                ]}
              />
            </motion.div>
          </motion.div>
        </TabsContent>
      </Tabs>
      <WikiLoreBlock context="labor" themeColor="blue" title="Labor & Education Lore" />
    </ThemedTabContent>
  );
}
