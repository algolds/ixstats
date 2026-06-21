// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { api } from "~/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Area,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  Users,
  Globe,
  Activity,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Equal,
} from "lucide-react";
import { formatCurrency } from "~/lib/chart-utils";
import { IxTime } from "~/lib/ixtime";
import { MetricModalLayout } from "./metric-details/MetricModalLayout";

interface GdpPerCapitaDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  countryId: string;
  countryName: string;
}

export function GdpPerCapitaDetailsModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: GdpPerCapitaDetailsModalProps) {
  const [timeRange, setTimeRange] = useState("1y");

  // Enhanced escape functionality
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden"; // Prevent background scrolling
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const { data: economicData, isLoading: isEconomicLoading } =
    api.countries.getByIdWithEconomicData.useQuery(
      { countryId },
      {
        enabled: isOpen,
        staleTime: 5 * 60 * 1000,
      }
    );

  const {
    data: historicalData,
    isLoading: isHistoricalLoading,
    refetch,
  } = api.historical.getCountryHistory.useQuery(
    { countryId },
    {
      enabled: isOpen,
      staleTime: 5 * 60 * 1000,
    }
  );

  const { data: globalStats, isLoading: isGlobalLoading } = api.countries.getGlobalStats.useQuery(
    undefined,
    {
      enabled: isOpen,
      staleTime: 5 * 60 * 1000,
    }
  );

  // Get top countries for comparison
  const { data: topCountries, isLoading: isTopCountriesLoading } =
    api.countries.getTopCountriesByGdpPerCapita.useQuery(
      { limit: 10 },
      {
        enabled: isOpen,
        staleTime: 5 * 60 * 1000,
      }
    );

  const chartData = useMemo(() => {
    if (!historicalData?.length) return [];

    const rangeMap = {
      "3m": 3,
      "6m": 6,
      "1y": 12,
      "2y": 24,
      "5y": 60,
      all: Infinity,
    };

    const monthsToShow = rangeMap[timeRange as keyof typeof rangeMap] || 12;
    const cutoffDate =
      monthsToShow === Infinity
        ? new Date(0)
        : new Date(Date.now() - monthsToShow * 30 * 24 * 60 * 60 * 1000);

    return historicalData
      .filter((point) => new Date(point.ixTimeTimestamp) >= cutoffDate)
      .map((point) => ({
        year: IxTime.getCurrentGameYear(point.ixTimeTimestamp),
        gdpPerCapita: point.gdpPerCapita,
        population: point.population,
        totalGdp: point.totalGdp,
        timestamp: point.ixTimeTimestamp,
        date: IxTime.formatIxTime(point.ixTimeTimestamp, true),
      }))
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  }, [historicalData, timeRange]);

  const projectionData = useMemo(() => {
    if (!economicData) return [];

    const currentYear = IxTime.getCurrentGameYear();
    const data = [];

    for (let i = 0; i <= 10; i++) {
      const year = currentYear + i;
      const yearsFromNow = i;
      const growthFactor =
        economicData &&
        typeof economicData === "object" &&
        economicData !== null &&
        "adjustedGdpGrowth" in economicData
          ? Math.pow(1 + (economicData as any).adjustedGdpGrowth, yearsFromNow)
          : 1;

      data.push({
        year,
        gdpPerCapita:
          economicData &&
          typeof economicData === "object" &&
          economicData !== null &&
          "currentGdpPerCapita" in economicData
            ? (economicData as any).currentGdpPerCapita * growthFactor
            : 0,
        isProjection: i > 0,
      });
    }

    return data;
  }, [economicData]);

  const comparisonData = useMemo(() => {
    if (!topCountries || !Array.isArray(topCountries) || !economicData) return [];

    return topCountries
      .map((country: any) => ({
        name: country.name.length > 15 ? country.name.substring(0, 12) + "..." : country.name,
        fullName: country.name,
        gdpPerCapita: country.currentGdpPerCapita,
        economicTier: country.economicTier,
        isCurrentCountry: country.id === countryId,
      }))
      .sort((a: any, b: any) => b.gdpPerCapita - a.gdpPerCapita);
  }, [topCountries, economicData, countryId]);

  const economicTierInfo = useMemo(() => {
    if (!economicData) return null;

    const tiers = [
      { name: "Impoverished", min: 0, max: 9999, color: "bg-red-100 text-red-800", icon: "📉" },
      {
        name: "Developing",
        min: 10000,
        max: 24999,
        color: "bg-orange-100 text-orange-800",
        icon: "📈",
      },
      {
        name: "Developed",
        min: 25000,
        max: 34999,
        color: "bg-yellow-100 text-yellow-800",
        icon: "🏭",
      },
      { name: "Healthy", min: 35000, max: 44999, color: "bg-green-100 text-green-800", icon: "💰" },
      { name: "Strong", min: 45000, max: 54999, color: "bg-blue-100 text-blue-800", icon: "🚀" },
      {
        name: "Very Strong",
        min: 55000,
        max: 64999,
        color: "bg-indigo-100 text-indigo-800",
        icon: "🌟",
      },
      {
        name: "Extravagant",
        min: 65000,
        max: Infinity,
        color: "bg-purple-100 text-purple-800",
        icon: "👑",
      },
    ];

    const currentTierIndex =
      economicData &&
      typeof economicData === "object" &&
      economicData !== null &&
      "currentGdpPerCapita" in economicData
        ? tiers.findIndex(
            (tier) =>
              (economicData as any).currentGdpPerCapita >= tier.min &&
              (economicData as any).currentGdpPerCapita <= tier.max
          )
        : -1;

    return {
      currentTier: tiers[currentTierIndex],
      nextTier: tiers[currentTierIndex + 1],
      allTiers: tiers,
      currentIndex: currentTierIndex,
    };
  }, [economicData]);

  const performanceMetrics = useMemo(() => {
    if (!chartData.length || !globalStats) return null;

    const current = chartData[chartData.length - 1];
    const previous = chartData[chartData.length - 2];

    if (!current || !previous) return null;

    const growth = ((current.gdpPerCapita - previous.gdpPerCapita) / previous.gdpPerCapita) * 100;
    const globalComparison =
      globalStats &&
      typeof globalStats === "object" &&
      globalStats !== null &&
      "averageGdpPerCapita" in globalStats &&
      typeof (globalStats as any).averageGdpPerCapita === "number"
        ? ((current.gdpPerCapita - (globalStats as any).averageGdpPerCapita) /
            (globalStats as any).averageGdpPerCapita) *
          100
        : 0;

    return {
      currentValue: current.gdpPerCapita,
      growth,
      globalComparison,
      globalAverage:
        globalStats &&
        typeof globalStats === "object" &&
        globalStats !== null &&
        "averageGdpPerCapita" in globalStats
          ? (globalStats as any).averageGdpPerCapita
          : 0,
      rank: comparisonData.findIndex((c) => c.isCurrentCountry) + 1,
      totalCountries: comparisonData.length,
    };
  }, [chartData, globalStats, comparisonData]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="facet-modal facet-refraction !fixed max-h-[90vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto sm:w-[calc(100vw-4rem)] sm:max-w-[calc(100vw-4rem)] lg:max-w-5xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-500" />
              GDP per Capita Analysis - {countryName}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="hover:bg-destructive/20 hover:text-destructive h-8 w-8 rounded-full p-0"
            >
              ✕
            </Button>
          </div>
          <DialogDescription>
            Detailed GDP per capita analysis with global comparisons and economic tier insights
          </DialogDescription>
          <div className="text-muted-foreground mt-1 text-xs">
            Press ESC or click outside to close
          </div>
        </DialogHeader>

        <MetricModalLayout variant="economy">
          <MetricModalLayout.MainArea className="space-y-6">
            {/* Historical Trends */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-semibold">
                  <Activity className="h-5 w-5 text-amber-500" />
                  GDP per Capita Trends
                </h3>
                <div className="flex items-center gap-4">
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3m">3 Months</SelectItem>
                      <SelectItem value="6m">6 Months</SelectItem>
                      <SelectItem value="1y">1 Year</SelectItem>
                      <SelectItem value="2y">2 Years</SelectItem>
                      <SelectItem value="5y">5 Years</SelectItem>
                      <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => void refetch()} className="h-8">
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    Refresh
                  </Button>
                </div>
              </div>

              {isHistoricalLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : chartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                      <XAxis
                        dataKey="timestamp"
                        domain={["dataMin", "dataMax"]}
                        type="number"
                        scale="time"
                        name="Time"
                        tickFormatter={(ts) => String(IxTime.getCurrentGameYear(ts as number))}
                        stroke="rgba(255, 255, 255, 0.3)"
                      />
                      <YAxis
                        tickFormatter={(value) => formatCurrency(value)}
                        stroke="rgba(255, 255, 255, 0.3)"
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(18, 20, 24, 0.8)",
                          backdropFilter: "blur(8px)",
                          borderColor: "rgba(255, 255, 255, 0.1)",
                          borderRadius: "8px",
                        }}
                        formatter={(value: any) => [formatCurrency(value), "GDP per Capita"]}
                        labelFormatter={(label) =>
                          `Year ${IxTime.getCurrentGameYear(label as number)}`
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="gdpPerCapita"
                        stroke="#fbbf24"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-muted-foreground flex h-64 items-center justify-center">
                  No historical data available
                </div>
              )}
            </div>

            <Separator className="bg-white/5" />

            {/* GDP per Capita Projections */}
            {economicData && (
              <div className="space-y-4">
                <h3 className="flex items-center gap-2 text-base font-semibold">
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                  10-Year GDP per Capita Projections
                  <Badge variant="outline" className="ml-2 border-yellow-500/20 bg-yellow-500/5 text-yellow-500">
                    {economicData &&
                    typeof economicData === "object" &&
                    economicData !== null &&
                    "adjustedGdpGrowth" in economicData
                      ? ((economicData as any).adjustedGdpGrowth * 100).toFixed(2)
                      : "N/A"}
                    % growth
                  </Badge>
                </h3>

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={projectionData}>
                      <defs>
                        <linearGradient id="projColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                      <XAxis dataKey="year" stroke="rgba(255, 255, 255, 0.3)" />
                      <YAxis
                        tickFormatter={(value) => formatCurrency(value)}
                        stroke="rgba(255, 255, 255, 0.3)"
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(18, 20, 24, 0.8)",
                          backdropFilter: "blur(8px)",
                          borderColor: "rgba(255, 255, 255, 0.1)",
                          borderRadius: "8px",
                        }}
                        formatter={(value: any) => [formatCurrency(value), "GDP per Capita"]}
                        labelFormatter={(label) => `Year ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="gdpPerCapita"
                        stroke="#fbbf24"
                        fillOpacity={1}
                        fill="url(#projColor)"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div className="text-muted-foreground text-[10px] space-y-0.5">
                  <p>* Projections assume constant growth rates and current economic policies</p>
                  <p>* Economic tier advancements may affect actual growth rates</p>
                </div>
              </div>
            )}

            <Separator className="bg-white/5" />

            {/* Global Rankings */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <Globe className="h-5 w-5 text-amber-500" />
                Global Rankings
              </h3>

              {isTopCountriesLoading ? (
                <Skeleton className="h-64" />
              ) : comparisonData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                      <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} stroke="rgba(255, 255, 255, 0.3)" />
                      <YAxis dataKey="name" type="category" width={80} stroke="rgba(255, 255, 255, 0.3)" />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(18, 20, 24, 0.8)",
                          backdropFilter: "blur(8px)",
                          borderColor: "rgba(255, 255, 255, 0.1)",
                          borderRadius: "8px",
                        }}
                        formatter={(value: any) => [
                          formatCurrency(value),
                          "GDP per Capita",
                        ]}
                        labelFormatter={(label, payload) => {
                          const item = payload?.[0]?.payload;
                          return item?.fullName || label;
                        }}
                      />
                      <Bar dataKey="gdpPerCapita" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-muted-foreground flex h-64 items-center justify-center">
                  No comparison data available
                </div>
              )}
            </div>
          </MetricModalLayout.MainArea>

          <MetricModalLayout.Sidebar className="space-y-4">
            {economicData && (
              <>
                <MetricModalLayout.StatCard
                  label="Current GDP/Capita"
                  value={
                    economicData &&
                    typeof economicData === "object" &&
                    economicData !== null &&
                    "currentGdpPerCapita" in economicData
                      ? (economicData as any).currentGdpPerCapita
                      : 0
                  }
                  prefix="$"
                  icon={DollarSign}
                  variant="economy"
                />

                <MetricModalLayout.StatCard
                  label="Growth Rate"
                  value={
                    economicData &&
                    typeof economicData === "object" &&
                    economicData !== null &&
                    "adjustedGdpGrowth" in economicData
                      ? (economicData as any).adjustedGdpGrowth * 100
                      : 0
                  }
                  suffix="%"
                  decimalPlaces={2}
                  icon={TrendingUp}
                  variant="economy"
                />

                <MetricModalLayout.StatCard
                  label="Global Ranking"
                  value={performanceMetrics?.rank || 0}
                  prefix="#"
                  icon={Globe}
                  variant="economy"
                />

                <MetricModalLayout.StatCard
                  label="Tier Progress"
                  value={
                    economicTierInfo?.currentIndex !== undefined
                      ? economicTierInfo.currentIndex + 1
                      : 0
                  }
                  suffix="/7"
                  icon={Activity}
                  variant="economy"
                />
              </>
            )}

            {economicTierInfo && (
              <div className="facet-refraction p-4 rounded-xl border border-white/5 bg-white/5 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Economic Tier System</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {economicTierInfo.allTiers.map((tier, index) => (
                    <div
                      key={tier.name}
                      className={cn(
                        "rounded-lg border p-2 text-xs transition-all",
                        index === economicTierInfo.currentIndex
                          ? "border-yellow-500/40 bg-yellow-500/10 shadow-inner"
                          : "border-white/5 bg-black/10"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-medium">
                          <span>{tier.icon}</span>
                          <span className={cn(index === economicTierInfo.currentIndex && "text-yellow-500")}>
                            {tier.name}
                          </span>
                          {index === economicTierInfo.currentIndex && (
                            <Badge className="text-[9px] px-1 py-0 bg-yellow-500/20 text-yellow-500 border-none scale-90">
                              Current
                            </Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground text-[10px]">
                          {formatCurrency(tier.min)} -{" "}
                          {tier.max === Infinity ? "∞" : formatCurrency(tier.max)}
                        </div>
                      </div>

                      {index === economicTierInfo.currentIndex && economicData && (
                        <div className="mt-1 text-[10px] text-muted-foreground border-t border-white/5 pt-1">
                          Current:{" "}
                          {formatCurrency((economicData as any).currentGdpPerCapita)}
                          {economicTierInfo.nextTier && (
                            <span className="block text-[9px] mt-0.5 text-yellow-500/80">
                              (Need {formatCurrency(economicTierInfo.nextTier.min - (economicData as any).currentGdpPerCapita)} for {economicTierInfo.nextTier.name})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </MetricModalLayout.Sidebar>
        </MetricModalLayout>
      </DialogContent>
    </Dialog>
  );
}
