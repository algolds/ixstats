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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
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
  ScatterChart,
  Scatter,
  ComposedChart,
  Area,
  AreaChart,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  Users,
  Globe,
  Calendar,
  Activity,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Equal,
} from "lucide-react";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { IxTime } from "~/lib/ixtime";

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
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const {
    data: economicData,
    isLoading: isEconomicLoading,
  } = api.countries.getEconomicData.useQuery(
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
  } = api.countries.getHistoricalData.useQuery(
    { countryId },
    {
      enabled: isOpen,
      staleTime: 5 * 60 * 1000,
    }
  );

  const {
    data: globalStats,
    isLoading: isGlobalLoading,
  } = api.countries.getGlobalStats.useQuery(
    undefined,
    {
      enabled: isOpen,
      staleTime: 5 * 60 * 1000,
    }
  );

  // Get top countries for comparison
  const {
    data: topCountries,
    isLoading: isTopCountriesLoading,
  } = api.countries.getTopCountriesByGdpPerCapita.useQuery(
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
      "all": Infinity
    };
    
    const monthsToShow = rangeMap[timeRange as keyof typeof rangeMap] || 12;
    const cutoffDate = monthsToShow === Infinity ? 
      new Date(0) : 
      new Date(Date.now() - monthsToShow * 30 * 24 * 60 * 60 * 1000);
    
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
      const growthFactor = economicData && typeof economicData === 'object' && economicData !== null && 'adjustedGdpGrowth' in economicData ? Math.pow(1 + (economicData as any).adjustedGdpGrowth, yearsFromNow) : 1;
      
      data.push({
        year,
        gdpPerCapita: economicData && typeof economicData === 'object' && economicData !== null && 'currentGdpPerCapita' in economicData ? (economicData as any).currentGdpPerCapita * growthFactor : 0,
        isProjection: i > 0,
      });
    }
    
    return data;
  }, [economicData]);

  const comparisonData = useMemo(() => {
    if (!topCountries || !Array.isArray(topCountries) || !economicData) return [];
    
    return topCountries.map((country: any) => ({
      name: country.name.length > 15 ? country.name.substring(0, 12) + "..." : country.name,
      fullName: country.name,
      gdpPerCapita: country.currentGdpPerCapita,
      economicTier: country.economicTier,
      isCurrentCountry: country.id === countryId,
    })).sort((a: any, b: any) => b.gdpPerCapita - a.gdpPerCapita);
  }, [topCountries, economicData, countryId]);

  const economicTierInfo = useMemo(() => {
    if (!economicData) return null;
    
    const tiers = [
      { name: "Impoverished", min: 0, max: 9999, color: "bg-red-100 text-red-800", icon: "📉" },
      { name: "Developing", min: 10000, max: 24999, color: "bg-orange-100 text-orange-800", icon: "📈" },
      { name: "Developed", min: 25000, max: 34999, color: "bg-yellow-100 text-yellow-800", icon: "🏭" },
      { name: "Healthy", min: 35000, max: 44999, color: "bg-green-100 text-green-800", icon: "💰" },
      { name: "Strong", min: 45000, max: 54999, color: "bg-blue-100 text-blue-800", icon: "🚀" },
      { name: "Very Strong", min: 55000, max: 64999, color: "bg-indigo-100 text-indigo-800", icon: "🌟" },
      { name: "Extravagant", min: 65000, max: Infinity, color: "bg-purple-100 text-purple-800", icon: "👑" }
    ];
    
    const currentTierIndex = economicData && typeof economicData === 'object' && economicData !== null && 'currentGdpPerCapita' in economicData ? tiers.findIndex(tier => 
      (economicData as any).currentGdpPerCapita >= tier.min && (economicData as any).currentGdpPerCapita <= tier.max
    ) : -1;
    
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
    const globalComparison = globalStats && typeof globalStats === 'object' && globalStats !== null && 'averageGdpPerCapita' in globalStats && typeof (globalStats as any).averageGdpPerCapita === 'number' ? 
      ((current.gdpPerCapita - (globalStats as any).averageGdpPerCapita) / (globalStats as any).averageGdpPerCapita) * 100 : 0;
    
    return {
      currentValue: current.gdpPerCapita,
      growth,
      globalComparison,
      globalAverage: globalStats && typeof globalStats === 'object' && globalStats !== null && 'averageGdpPerCapita' in globalStats ? (globalStats as any).averageGdpPerCapita : 0,
      rank: comparisonData.findIndex(c => c.isCurrentCountry) + 1,
      totalCountries: comparisonData.length,
    };
  }, [chartData, globalStats, comparisonData]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-4rem)] w-[calc(100vw-2rem)] sm:w-[calc(100vw-4rem)] max-h-[90vh] overflow-y-auto z-[9999] shadow-2xl border-2 border-white/10 backdrop-blur-xl bg-background/95">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              GDP per Capita Analysis - {countryName}
            </DialogTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="h-8 w-8 p-0 rounded-full hover:bg-destructive/20 hover:text-destructive"
            >
              ✕
            </Button>
          </div>
          <DialogDescription>
            Detailed GDP per capita analysis with global comparisons and economic tier insights
          </DialogDescription>
          <div className="text-xs text-muted-foreground mt-1">Press ESC or click outside to close</div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {isEconomicLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))
            ) : economicData ? (
              <>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Current GDP/Capita</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    {economicData && typeof economicData === 'object' && economicData !== null && 'currentGdpPerCapita' in economicData ? formatCurrency((economicData as any).currentGdpPerCapita) : 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {economicData && typeof economicData === 'object' && economicData !== null && 'economicTier' in economicData ? (economicData as any).economicTier : 'N/A'}
                  </p>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Growth Rate</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">
                    {economicData && typeof economicData === 'object' && economicData !== null && 'adjustedGdpGrowth' in economicData ? ((economicData as any).adjustedGdpGrowth * 100).toFixed(2) : 'N/A'}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    annually
                  </p>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium">Global Ranking</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-600">
                    {performanceMetrics?.rank || "N/A"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    of {performanceMetrics?.totalCountries || "N/A"} countries
                  </p>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium">Tier Progress</span>
                  </div>
                  <p className="text-lg font-bold text-orange-600">
                    {economicTierInfo?.currentTier?.icon} {economicTierInfo?.currentIndex !== undefined ? economicTierInfo.currentIndex + 1 : "N/A"}/7
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {economicTierInfo?.currentTier?.name}
                  </p>
                </div>
              </>
            ) : null}
          </div>

          <Separator />

          {/* Historical Trends */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5" />
                GDP per Capita Trends
              </h3>
              <div className="flex items-center gap-4">
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-32">
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
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => void refetch()}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
            
            {isHistoricalLoading ? (
              <Skeleton className="h-80" />
            ) : chartData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp"
                      domain={['dataMin', 'dataMax']}
                      type="number"
                      scale="time"
                      name="Time"
                      tickFormatter={(ts) => String(IxTime.getCurrentGameYear(ts as number))}
                    />
                    <YAxis 
                      label={{ value: 'GDP per Capita ($)', angle: -90, position: 'insideLeft' }}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip 
                      formatter={(value: any) => [formatCurrency(value), 'GDP per Capita']}
                      labelFormatter={(label) => `Year ${IxTime.getCurrentGameYear(label as number)}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="gdpPerCapita" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                No historical data available
              </div>
            )}
          </div>

          <Separator />

          {/* GDP per Capita Projections */}
          {economicData && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                10-Year GDP per Capita Projections
                <Badge variant="outline" className="ml-2">
                  {economicData && typeof economicData === 'object' && economicData !== null && 'adjustedGdpGrowth' in economicData ? ((economicData as any).adjustedGdpGrowth * 100).toFixed(2) : 'N/A'}% growth
                </Badge>
              </h3>
              
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={projectionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis 
                      label={{ value: 'GDP per Capita ($)', angle: -90, position: 'insideLeft' }}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip 
                      formatter={(value: any) => [formatCurrency(value), 'GDP per Capita']}
                      labelFormatter={(label) => `Year ${label}`}
                    />
                    <Area
                      type="monotone" 
                      dataKey="gdpPerCapita" 
                      stroke="#ff7300" 
                      fill="#ff7300"
                      fillOpacity={0.3}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>* Projections assume constant growth rates and current economic policies</p>
                <p>* Economic tier advancements may affect actual growth rates</p>
              </div>
            </div>
          )}

          <Separator />

          {/* Global Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Global Rankings
              </h3>
              
              {isTopCountriesLoading ? (
                <Skeleton className="h-80" />
              ) : comparisonData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        type="number" 
                        tickFormatter={(value) => formatCurrency(value)}
                      />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={80}
                      />
                      <Tooltip 
                        formatter={(value: any, name, props) => [
                          formatCurrency(value), 
                          'GDP per Capita'
                        ]}
                        labelFormatter={(label, payload) => {
                          const item = payload?.[0]?.payload;
                          return item?.fullName || label;
                        }}
                      />
                      <Bar 
                        dataKey="gdpPerCapita" 
                        fill="#94a3b8"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  No comparison data available
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Economic Tier System</h3>
              
              {economicTierInfo && (
                <div className="space-y-3">
                  {economicTierInfo.allTiers.map((tier, index) => (
                    <div 
                      key={tier.name}
                      className={`p-3 rounded-lg border-2 ${
                        index === economicTierInfo.currentIndex 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{tier.icon}</span>
                          <span className="font-medium">{tier.name}</span>
                          {index === economicTierInfo.currentIndex && (
                            <Badge variant="default">Current</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(tier.min)} - {tier.max === Infinity ? '∞' : formatCurrency(tier.max)}
                        </div>
                      </div>
                      
                      {index === economicTierInfo.currentIndex && economicData && (
                        <div className="mt-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span>Current: {economicData && typeof economicData === 'object' && economicData !== null && 'currentGdpPerCapita' in economicData ? formatCurrency((economicData as any).currentGdpPerCapita) : 'N/A'}</span>
                            {economicTierInfo.nextTier && economicData && typeof economicData === 'object' && economicData !== null && 'currentGdpPerCapita' in economicData && (
                              <span className="text-muted-foreground">
                                (Need {formatCurrency(economicTierInfo.nextTier.min - (economicData as any).currentGdpPerCapita)} for {economicTierInfo.nextTier.name})
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Performance Summary */}
          {performanceMetrics && globalStats && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Performance Summary</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      {performanceMetrics.growth > 0 ? (
                        <ArrowUp className="h-4 w-4 text-green-600" />
                      ) : performanceMetrics.growth < 0 ? (
                        <ArrowDown className="h-4 w-4 text-red-600" />
                      ) : (
                        <Equal className="h-4 w-4 text-gray-600" />
                      )}
                      <span className="font-medium">Recent Growth</span>
                    </div>
                    <p className={`text-2xl font-bold ${
                      performanceMetrics.growth > 0 ? 'text-green-600' : 
                      performanceMetrics.growth < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {performanceMetrics.growth > 0 ? '+' : ''}{performanceMetrics.growth.toFixed(2)}%
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">vs Global Average</span>
                    </div>
                    <p className={`text-2xl font-bold ${
                      performanceMetrics.globalComparison > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {performanceMetrics.globalComparison > 0 ? '+' : ''}{performanceMetrics.globalComparison.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Global avg: {typeof performanceMetrics.globalAverage === 'number' ? formatCurrency(performanceMetrics.globalAverage) : 'N/A'}
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-4 w-4 text-purple-600" />
                      <span className="font-medium">World Ranking</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-600">
                      #{performanceMetrics.rank}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      of {performanceMetrics.totalCountries} countries
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}