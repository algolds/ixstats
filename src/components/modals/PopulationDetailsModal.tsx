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
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  BarChart,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Users,
  TrendingUp,
  Globe,
  Calendar,
  Activity,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Equal,
  MapPin,
  BarChart3,
} from "lucide-react";
import { formatPopulation, getGrowthColor } from "~/lib/chart-utils";
import { IxTime } from "~/lib/ixtime";

interface PopulationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  countryId: string;
  countryName: string;
}

export function PopulationDetailsModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: PopulationDetailsModalProps) {
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
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const {
    data: economicDataRaw,
    isLoading: isEconomicLoading,
  } = api.countries.getEconomicData.useQuery(
    { countryId },
    {
      enabled: isOpen,
      staleTime: 5 * 60 * 1000,
    }
  );

  const {
    data: historicalDataRaw,
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
    data: globalStatsRaw,
    isLoading: isGlobalLoading,
  } = api.countries.getGlobalStats.useQuery(
    undefined,
    {
      enabled: isOpen,
      staleTime: 5 * 60 * 1000,
    }
  );

  // Get top countries by population for comparison
  const {
    data: topCountriesByPopulationRaw,
    isLoading: isTopCountriesLoading,
  } = api.countries.getTopCountriesByPopulation.useQuery(
    { limit: 15 },
    {
      enabled: isOpen,
      staleTime: 5 * 60 * 1000,
    }
  );

  // Type assertions to access computed fields
  const economicData = economicDataRaw as any;
  const historicalData = historicalDataRaw as any;
  const globalStats = globalStatsRaw as any;
  const topCountriesByPopulation = topCountriesByPopulationRaw as any;

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
      .filter((point: any) => new Date(point.ixTimeTimestamp) >= cutoffDate)
      .map((point: any) => ({
        year: IxTime.getCurrentGameYear(point.ixTimeTimestamp),
        population: point.population,
        populationGrowthRate: (point.populationGrowthRate || 0) * 100,
        populationDensity: point.populationDensity,
        totalGdp: point.totalGdp,
        timestamp: point.ixTimeTimestamp,
        date: IxTime.formatIxTime(point.ixTimeTimestamp, true),
      }))
      .sort((a: any, b: any) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  }, [historicalData, timeRange]);

  const projectionData = useMemo(() => {
    if (!economicData) return [];
    
    const currentYear = IxTime.getCurrentGameYear();
    const data = [];
    
    for (let i = 0; i <= 20; i++) {
      const year = currentYear + i;
      const yearsFromNow = i;
      const growthFactor = Math.pow(1 + economicData.populationGrowthRate, yearsFromNow);
      
      data.push({
        year,
        population: economicData.currentPopulation * growthFactor,
        isProjection: i > 0,
      });
    }
    
    return data;
  }, [economicData]);

  const comparisonData = useMemo(() => {
    if (!topCountriesByPopulation || !economicData) return [];
    
    return topCountriesByPopulation.map((country: any) => ({
      name: country.name.length > 12 ? country.name.substring(0, 9) + "..." : country.name,
      fullName: country.name,
      population: country.currentPopulation,
      populationTier: country.populationTier,
      isCurrentCountry: country.id === countryId,
    })).sort((a: any, b: any) => b.population - a.population);
  }, [topCountriesByPopulation, economicData, countryId]);

  const populationTierInfo = useMemo(() => {
    if (!economicData) return null;
    
    const tiers = [
      { name: "Tier 1", min: 0, max: 9_999_999, color: "bg-red-100 text-red-800", icon: "🏘️", description: "0-9.99M" },
      { name: "Tier 2", min: 10_000_000, max: 29_999_999, color: "bg-orange-100 text-orange-800", icon: "🏙️", description: "10-29.99M" },
      { name: "Tier 3", min: 30_000_000, max: 49_999_999, color: "bg-yellow-100 text-yellow-800", icon: "🌆", description: "30-49.99M" },
      { name: "Tier 4", min: 50_000_000, max: 79_999_999, color: "bg-green-100 text-green-800", icon: "🏢", description: "50-79.99M" },
      { name: "Tier 5", min: 80_000_000, max: 119_999_999, color: "bg-blue-100 text-blue-800", icon: "🏬", description: "80-119.99M" },
      { name: "Tier 6", min: 120_000_000, max: 349_999_999, color: "bg-indigo-100 text-indigo-800", icon: "🌍", description: "120-349.99M" },
      { name: "Tier 7", min: 350_000_000, max: 499_999_999, color: "bg-purple-100 text-purple-800", icon: "🌎", description: "350-499.99M" },
      { name: "Tier X", min: 500_000_000, max: Infinity, color: "bg-pink-100 text-pink-800", icon: "🌏", description: "500M+" }
    ];
    
    const currentTierIndex = tiers.findIndex(tier => 
      economicData.currentPopulation >= tier.min && economicData.currentPopulation <= tier.max
    );
    
    return {
      currentTier: tiers[currentTierIndex],
      nextTier: tiers[currentTierIndex + 1],
      allTiers: tiers,
      currentIndex: currentTierIndex,
    };
  }, [economicData]);

  const demographicBreakdown = useMemo(() => {
    if (!economicData) return [];
    
    // Simulate demographic breakdown based on economic tier and population
    const urbanizationRate = economicData.economicTier === 'Extravagant' ? 0.85 :
                           economicData.economicTier === 'Very Strong' ? 0.75 :
                           economicData.economicTier === 'Strong' ? 0.65 :
                           economicData.economicTier === 'Healthy' ? 0.55 :
                           economicData.economicTier === 'Developed' ? 0.45 :
                           economicData.economicTier === 'Developing' ? 0.35 : 0.25;
    
    const urbanPop = economicData.currentPopulation * urbanizationRate;
    const ruralPop = economicData.currentPopulation * (1 - urbanizationRate);
    
    return [
      { name: "Urban Population", value: urbanPop, color: "#3b82f6", percentage: urbanizationRate * 100 },
      { name: "Rural Population", value: ruralPop, color: "#10b981", percentage: (1 - urbanizationRate) * 100 },
    ];
  }, [economicData]);

  const performanceMetrics = useMemo(() => {
    if (!chartData.length || !globalStats) return null;
    
    const current = chartData[chartData.length - 1];
    const previous = chartData[chartData.length - 2];
    
    if (!current || !previous) return null;
    
    const growth = ((current.population - previous.population) / previous.population) * 100;
    const globalComparison = ((current.population - globalStats.averagePopulation) / globalStats.averagePopulation) * 100;
    
    return {
      currentValue: current.population,
      growth,
      globalComparison,
      globalAverage: globalStats.averagePopulation,
      rank: comparisonData.findIndex((c: any) => c.isCurrentCountry) + 1,
      totalCountries: comparisonData.length,
      density: current.populationDensity,
    };
  }, [chartData, globalStats, comparisonData]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-4rem)] w-[calc(100vw-2rem)] sm:w-[calc(100vw-4rem)] max-h-[90vh] overflow-y-auto z-[9999] shadow-2xl border-2 border-white/10 backdrop-blur-xl bg-background/95">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Population Analysis - {countryName}
          </DialogTitle>
          <DialogDescription>
            Comprehensive population demographics, growth trends, and comparative analysis
          </DialogDescription>
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
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Current Population</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatPopulation(economicData.currentPopulation)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {populationTierInfo?.currentTier?.name}
                  </p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Growth Rate</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    {(economicData.populationGrowthRate * 100).toFixed(3)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    annually
                  </p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium">World Ranking</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-600">
                    #{performanceMetrics?.rank || "N/A"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    by population
                  </p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium">Population Density</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-600">
                    {performanceMetrics?.density ? 
                      `${performanceMetrics.density.toFixed(1)}/km²` : 
                      "N/A"
                    }
                  </p>
                  <p className="text-xs text-muted-foreground">
                    people per km²
                  </p>
                </Card>
              </>
            ) : null}
          </div>

          <Separator />

          {/* Historical Trends */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Population Growth Trends
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
            
            <Card>
              {isHistoricalLoading ? (
                <Skeleton className="h-80" />
              ) : chartData.length > 0 ? (
                <div className="h-80 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
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
                        yAxisId="population"
                        orientation="left"
                        label={{ value: 'Population', angle: -90, position: 'insideLeft' }}
                        tickFormatter={(value) => formatPopulation(value)}
                      />
                      <YAxis 
                        yAxisId="growth"
                        orientation="right"
                        label={{ value: 'Growth Rate (%)', angle: 90, position: 'insideRight' }}
                      />
                      <Tooltip 
                        formatter={(value: any, name: string) => {
                          if (name === 'population') {
                            return [formatPopulation(value), 'Population'];
                          }
                          if (name === 'populationGrowthRate') {
                            return [`${value.toFixed(3)}%`, 'Growth Rate'];
                          }
                          return [value, name];
                        }}
                        labelFormatter={(label) => `Year ${IxTime.getCurrentGameYear(label as number)}`}
                      />
                      <Area
                        yAxisId="population"
                        type="monotone" 
                        dataKey="population" 
                        stroke="#3b82f6" 
                        fill="#3b82f6"
                        fillOpacity={0.3}
                        strokeWidth={3}
                      />
                      <Bar
                        yAxisId="growth"
                        dataKey="populationGrowthRate"
                        fill="#10b981"
                        opacity={0.6}
                        radius={[2, 2, 0, 0]}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-muted-foreground p-4">
                  No historical data available
                </div>
              )}
            </Card>
          </div>

          <Separator />

          {/* Population Projections */}
          {economicData && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                20-Year Population Projections
                <Badge variant="outline" className="ml-2">
                  {(economicData.populationGrowthRate * 100).toFixed(3)}% growth
                </Badge>
              </h3>
              
              <Card>
                <div className="h-80 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={projectionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis 
                        label={{ value: 'Population', angle: -90, position: 'insideLeft' }}
                        tickFormatter={(value) => formatPopulation(value)}
                      />
                      <Tooltip 
                        formatter={(value: any) => [formatPopulation(value), 'Population']}
                        labelFormatter={(label) => `Year ${label}`}
                      />
                      <Area
                        type="monotone" 
                        dataKey="population" 
                        stroke="#ff7300" 
                        fill="#ff7300"
                        fillOpacity={0.4}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              
              <div className="text-sm text-muted-foreground">
                <p>* Projections assume constant growth rates and no major demographic changes</p>
                <p>* Actual results may vary based on economic development, migration, and policy changes</p>
              </div>
            </div>
          )}

          <Separator />

          {/* Global Comparison & Demographics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* World Rankings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Global Population Rankings
              </h3>
              
              <Card>
                {isTopCountriesLoading ? (
                  <Skeleton className="h-80" />
                ) : comparisonData.length > 0 ? (
                  <div className="h-80 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comparisonData.slice(0, 10)} layout="horizontal">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          type="number" 
                          tickFormatter={(value) => formatPopulation(value)}
                        />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          width={80}
                        />
                        <Tooltip 
                          formatter={(value: any, name, props) => [
                            formatPopulation(value), 
                            'Population'
                          ]}
                          labelFormatter={(label, payload) => {
                            const item = payload?.[0]?.payload;
                            return item?.fullName || label;
                          }}
                        />
                        <Bar 
                          dataKey="population" 
                          fill="#94a3b8"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-80 flex items-center justify-center text-muted-foreground p-4">
                    No comparison data available
                  </div>
                )}
              </Card>
            </div>

            {/* Demographics Breakdown */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Demographics Breakdown</h3>
              
              <Card>
                <div className="p-4 space-y-4">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={demographicBreakdown}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percentage }) => `${name} ${percentage.toFixed(1)}%`}
                        >
                          {demographicBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: any) => formatPopulation(value)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="space-y-2">
                    {demographicBreakdown.map((segment) => (
                      <div key={segment.name} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                        <span className="text-sm font-medium">{segment.name}</span>
                        <div className="text-right">
                          <div className="text-sm font-bold">{formatPopulation(segment.value)}</div>
                          <div className="text-xs text-muted-foreground">{segment.percentage.toFixed(1)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Population Tier System */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Population Tier System</h3>
            
            <Card className="p-4">
              {populationTierInfo && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {populationTierInfo.allTiers.map((tier, index) => (
                    <div 
                      key={tier.name}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        index === populationTierInfo.currentIndex 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-center space-y-2">
                        <div className="text-2xl">{tier.icon}</div>
                        <div className="font-medium">{tier.name}</div>
                        <div className="text-xs text-muted-foreground">{tier.description}</div>
                        {index === populationTierInfo.currentIndex && (
                          <Badge variant="default" className="text-xs">Current</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Performance Summary */}
          {performanceMetrics && globalStats && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Performance Summary</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4">
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
                      {performanceMetrics.growth > 0 ? '+' : ''}{performanceMetrics.growth.toFixed(3)}%
                    </p>
                  </Card>

                  <Card className="p-4">
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
                      Global avg: {formatPopulation(performanceMetrics.globalAverage)}
                    </p>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="h-4 w-4 text-purple-600" />
                      <span className="font-medium">World Ranking</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-600">
                      #{performanceMetrics.rank}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      of {performanceMetrics.totalCountries} countries
                    </p>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}