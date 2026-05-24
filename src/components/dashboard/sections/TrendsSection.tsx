"use client";

import { motion } from "motion/react";
import { TrendingUp, DollarSign, Users, BarChart3, Globe } from "lucide-react";
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

export function TrendsSection() {
  const { data: globalStats } = api.countries.getGlobalStats.useQuery({});
  const { data: topByGdp } = api.countries.getTopCountriesByGdpPerCapita.useQuery({ limit: 10 });
  const { data: topByPop } = api.countries.getTopCountriesByPopulation.useQuery({ limit: 10 });

  const gdpLeaders = topByGdp ?? [];
  const popLeaders = topByPop ?? [];

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-4 sm:space-y-6"
    >
      {/* Global Economic Metrics */}
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

      {/* Two-column: GDP Rankings + Population Rankings */}
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
                {/* Table header */}
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
                      className="h-5 w-5 flex-shrink-0"
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
                {/* Table header */}
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
                      className="h-5 w-5 flex-shrink-0"
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
