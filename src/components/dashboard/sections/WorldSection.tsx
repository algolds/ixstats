"use client";

import { motion } from "motion/react";
import {
  AlertTriangle,
  Shield,
  Globe,
  Trophy,
  Clock,
  TrendingUp,
  DollarSign,
  Users,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { MetricCardGrid } from "~/components/mycountry/primitives/tabs/MetricCardGrid";
import {
  staggerContainer,
  staggerItem,
} from "~/components/mycountry/primitives/tabs/TabMotionConfig";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { api } from "~/trpc/react";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { cn } from "~/lib/utils";
import { WorldStatsBar } from "~/components/dashboard/WorldStatsBar";

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  critical: {
    bg: "bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-500/30",
  },
  high: {
    bg: "bg-orange-500/10",
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-500/30",
  },
  medium: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-600 dark:text-yellow-400",
    border: "border-yellow-500/30",
  },
  low: {
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/30",
  },
};

/**
 * Unified World section — merges the former Diplomacy & Crises and Trends sections
 * into a single global view: crises, influence, economics, and rankings.
 */
export function WorldSection() {
  // Crisis data
  const { data: activeCrises } = api.crisisEvents.getActive.useQuery({ limit: 10 });
  const { data: crisisStats } = api.crisisEvents.getStatistics.useQuery({ timeframe: "month" });
  const { data: leaderboard } = api.diplomaticCore.getInfluenceLeaderboard.useQuery();

  // Global economics
  const { data: globalStats } = api.countries.getGlobalStats.useQuery({});
  const { data: topByGdp } = api.countries.getTopCountriesByGdpPerCapita.useQuery({ limit: 10 });
  const { data: topByPop } = api.countries.getTopCountriesByPopulation.useQuery({ limit: 10 });

  const crises = activeCrises ?? [];
  const leaders = leaderboard ?? [];
  const gdpLeaders = topByGdp ?? [];
  const popLeaders = topByPop ?? [];

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-4 sm:space-y-6"
    >
      {/* World Economy Stats */}
      <motion.div variants={staggerItem}>
        <WorldStatsBar globalStats={globalStats} />
      </motion.div>

      {/* Crisis Metrics */}
      <motion.div variants={staggerItem}>
        <MetricCardGrid
          theme="labor"
          columns={4}
          title="Diplomacy & Crises"
          subtitle="Current global diplomatic landscape"
          metrics={[
            {
              id: "active-crises",
              title: "Active Crises",
              value: String(crisisStats?.activeEvents ?? crises.length),
              icon: AlertTriangle,
              status: (crisisStats?.criticalEvents ?? 0) > 0 ? "error" : "info",
              description: crisisStats?.criticalEvents
                ? `${crisisStats.criticalEvents} critical`
                : "No critical events",
            },
            {
              id: "resolved",
              title: "Resolved",
              value: String(crisisStats?.resolvedEvents ?? 0),
              icon: Shield,
              status: "success",
              description: `This ${crisisStats?.timeframe ?? "month"}`,
            },
            {
              id: "total-events",
              title: "Total Events",
              value: String(crisisStats?.totalEvents ?? 0),
              icon: Globe,
              description: "All severity levels",
            },
            {
              id: "economic-impact",
              title: "Economic Impact",
              value: crisisStats?.totalEconomicImpact
                ? `$${(crisisStats.totalEconomicImpact / 1e9).toFixed(1)}B`
                : "$0",
              icon: AlertTriangle,
              description: "Cumulative financial cost",
            },
          ]}
        />
      </motion.div>

      {/* Crisis Feed + Influence Leaderboard */}
      <motion.div variants={staggerItem}>
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Active Crises Feed */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Active Crises</CardTitle>
                <Badge
                  variant="outline"
                  className={cn(
                    "px-1.5 py-0 text-[10px]",
                    crises.length > 0 ? "border-red-500/30 text-red-500" : ""
                  )}
                >
                  {crises.length} active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="max-h-[350px] space-y-2.5 overflow-y-auto pr-1">
                {crises.length === 0 && (
                  <div className="py-8 text-center">
                    <Shield className="mx-auto mb-2 h-8 w-8 text-emerald-500/50" />
                    <p className="text-muted-foreground text-xs">
                      No active crises — the world is at peace
                    </p>
                  </div>
                )}
                {crises.map((crisis) => {
                  const severity = SEVERITY_STYLES[crisis.severity] ?? SEVERITY_STYLES.low!;
                  return (
                    <div
                      key={crisis.id}
                      className={cn(
                        "hover:bg-muted/30 rounded-lg border p-3 transition-colors",
                        severity.border
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={cn(
                            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                            severity.bg
                          )}
                        >
                          <AlertTriangle className={cn("h-3 w-3", severity.text)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-0.5 flex items-center gap-2">
                            <Badge
                              className={cn(
                                "px-1 py-0 text-[9px] font-bold uppercase",
                                severity.bg,
                                severity.text
                              )}
                            >
                              {crisis.severity}
                            </Badge>
                            <Badge variant="outline" className="px-1 py-0 text-[9px]">
                              {crisis.category ?? crisis.type}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs font-medium">{crisis.description}</p>
                          <div className="text-muted-foreground mt-1.5 flex items-center gap-3 text-[10px]">
                            <span className="flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              {new Date(crisis.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Diplomatic Influence Leaderboard */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Diplomatic Influence</CardTitle>
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1.5">
                {leaders.length === 0 && (
                  <p className="text-muted-foreground py-8 text-center text-xs">
                    No diplomatic data available
                  </p>
                )}
                {leaders.slice(0, 10).map((entry, i) => (
                  <div
                    key={entry.countryId}
                    className="hover:bg-muted/30 flex items-center gap-3 rounded-md px-2 py-2 transition-colors"
                  >
                    <span
                      className={cn(
                        "w-5 text-center text-xs font-bold",
                        i === 0
                          ? "text-amber-500"
                          : i === 1
                            ? "text-gray-400"
                            : i === 2
                              ? "text-orange-600"
                              : "text-muted-foreground"
                      )}
                    >
                      {i + 1}
                    </span>
                    <UnifiedCountryFlag
                      countryName={entry.countryName}
                      size="sm"
                      className="h-5 w-5 shrink-0"
                    />
                    <span className="flex-1 truncate text-xs font-medium">{entry.countryName}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-foreground text-[11px] font-semibold">
                        {Math.round(entry.totalInfluence).toLocaleString()}
                      </span>
                      <Badge variant="outline" className="px-1 py-0 text-[9px]">
                        {entry.activeEmbassies} embassies
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Global Economics */}
      <motion.div variants={staggerItem}>
        <MetricCardGrid
          theme="economy"
          columns={4}
          title="Global Economics"
          subtitle="Aggregate world economic indicators"
          metrics={[
            {
              id: "world-gdp",
              title: "World GDP",
              value: globalStats ? formatCurrency(globalStats.totalGdp ?? 0) : "—",
              icon: DollarSign,
              description: `${globalStats?.totalCountries ?? 0} nations combined`,
            },
            {
              id: "gdp-growth",
              title: "Global Growth",
              value: globalStats
                ? `${((globalStats.globalGrowthRate ?? 0) * 100).toFixed(2)}%`
                : "—",
              icon: TrendingUp,
              trend: globalStats?.globalGrowthRate
                ? {
                    direction:
                      globalStats.globalGrowthRate > 0 ? ("up" as const) : ("down" as const),
                    value: Math.abs(globalStats.globalGrowthRate * 100),
                  }
                : undefined,
              description: "Average compound growth rate",
            },
            {
              id: "avg-gdp-capita",
              title: "Avg GDP/Capita",
              value: globalStats ? formatCurrency(globalStats.averageGdpPerCapita ?? 0) : "—",
              icon: BarChart3,
              description: "Cross-nation average",
            },
            {
              id: "world-pop",
              title: "World Population",
              value: globalStats ? formatPopulation(globalStats.totalPopulation ?? 0) : "—",
              icon: Users,
              description: `Avg density: ${globalStats?.averagePopulationDensity ? Math.round(globalStats.averagePopulationDensity).toLocaleString() + "/km²" : "N/A"}`,
            },
          ]}
        />
      </motion.div>

      {/* GDP + Population Rankings */}
      <motion.div variants={staggerItem}>
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Top Economies */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Top Economies by GDP/Capita</CardTitle>
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                <div className="text-muted-foreground flex items-center gap-3 px-2 py-1 text-[10px] font-medium tracking-wider uppercase">
                  <span className="w-5">#</span>
                  <span className="flex-1">Country</span>
                  <span className="w-20 text-right">GDP/Cap</span>
                  <span className="hidden w-16 text-right sm:block">Tier</span>
                </div>
                {gdpLeaders.map((country, i) => (
                  <div
                    key={country.id}
                    className="hover:bg-muted/30 flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors"
                  >
                    <span
                      className={cn(
                        "w-5 text-center text-xs font-bold",
                        i === 0
                          ? "text-amber-500"
                          : i === 1
                            ? "text-gray-400"
                            : i === 2
                              ? "text-orange-600"
                              : "text-muted-foreground"
                      )}
                    >
                      {i + 1}
                    </span>
                    <UnifiedCountryFlag
                      countryName={country.name}
                      size="sm"
                      className="h-5 w-5 shrink-0"
                    />
                    <span className="flex-1 truncate text-xs font-medium">{country.name}</span>
                    <span className="w-20 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(country.currentGdpPerCapita)}
                    </span>
                    <span className="hidden w-16 text-right sm:block">
                      <Badge variant="outline" className="px-1 py-0 text-[9px]">
                        {country.economicTier}
                      </Badge>
                    </span>
                  </div>
                ))}
                {gdpLeaders.length === 0 && (
                  <p className="text-muted-foreground py-8 text-center text-xs">
                    No data available
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Largest Nations */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Largest Nations by Population</CardTitle>
                <Users className="h-3.5 w-3.5 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                <div className="text-muted-foreground flex items-center gap-3 px-2 py-1 text-[10px] font-medium tracking-wider uppercase">
                  <span className="w-5">#</span>
                  <span className="flex-1">Country</span>
                  <span className="w-20 text-right">Population</span>
                  <span className="hidden w-16 text-right sm:block">Growth</span>
                </div>
                {popLeaders.map((country, i) => (
                  <div
                    key={country.id}
                    className="hover:bg-muted/30 flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors"
                  >
                    <span
                      className={cn(
                        "w-5 text-center text-xs font-bold",
                        i === 0
                          ? "text-amber-500"
                          : i === 1
                            ? "text-gray-400"
                            : i === 2
                              ? "text-orange-600"
                              : "text-muted-foreground"
                      )}
                    >
                      {i + 1}
                    </span>
                    <UnifiedCountryFlag
                      countryName={country.name}
                      size="sm"
                      className="h-5 w-5 shrink-0"
                    />
                    <span className="flex-1 truncate text-xs font-medium">{country.name}</span>
                    <span className="w-20 text-right text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {formatPopulation(country.currentPopulation)}
                    </span>
                    <span className="hidden w-16 text-right sm:block">
                      <span
                        className={cn(
                          "text-[11px] font-medium",
                          (country.populationGrowthRate ?? 0) > 0
                            ? "text-emerald-500"
                            : (country.populationGrowthRate ?? 0) < 0
                              ? "text-red-500"
                              : "text-muted-foreground"
                        )}
                      >
                        {((country.populationGrowthRate ?? 0) * 100).toFixed(2)}%
                      </span>
                    </span>
                  </div>
                ))}
                {popLeaders.length === 0 && (
                  <p className="text-muted-foreground py-8 text-center text-xs">
                    No data available
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Tier Distribution */}
      {globalStats?.economicTierDistribution && (
        <motion.div variants={staggerItem}>
          <Card className="px-4 py-3">
            <div className="mb-2.5 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-semibold">Economic Tier Distribution</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {Object.entries(globalStats.economicTierDistribution).map(([tier, count]) => (
                <div
                  key={tier}
                  className="bg-muted/50 flex items-center gap-1.5 rounded-md px-2.5 py-1.5"
                >
                  <span className="text-xs font-medium">{tier}</span>
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-bold">
                    {count as number}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
