"use client";

import React from "react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { GlassCard } from "~/components/ui/enhanced-card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Progress } from "~/components/ui/progress";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from "~/components/ui/chart";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Activity, 
  BarChart3,
  LineChart,
  PieChart,
  Target,
  Shield,
  DollarSign,
  Users,
  Zap,
  Eye,
  RefreshCw
} from "lucide-react";
import { 
  LineChart as RechartsLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Cell,
  RadialBarChart,
  RadialBar,
  Legend
} from "recharts";

interface TrendRiskAnalyticsProps {
  countryId: string;
  userId?: string;
}

const RISK_COLORS = {
  low: "#10b981",
  medium: "#f59e0b", 
  high: "#ef4444",
  critical: "#dc2626"
};

const VOLATILITY_COLORS = {
  stable: "#10b981",
  moderate: "#f59e0b",
  high: "#ef4444",
  extreme: "#dc2626"
};

export function TrendRiskAnalytics({ countryId, userId }: TrendRiskAnalyticsProps) {
  // Get advanced analytics data
  const { data: analytics, isLoading: analyticsLoading, refetch: refetchAnalytics } =
    api.unifiedIntelligence.getAdvancedAnalytics.useQuery(
      { countryId },
      { enabled: !!countryId }
    );

  // Get historical data for trend analysis
  const { data: historicalData, isLoading: historicalLoading } =
    api.countries.getHistoricalData.useQuery(
      { countryId },
      { enabled: !!countryId }
    );

  // Get security dashboard for risk assessment
  const { data: securityDashboard, isLoading: securityLoading } =
    api.eci.getSecurityDashboard.useQuery(
      { userId: userId ?? "" },
      { enabled: !!userId }
    );

  // Get country data for context
  const { data: countryData, isLoading: countryLoading } = 
    api.countries.getByIdWithEconomicData.useQuery({ id: countryId });

  const isLoading = analyticsLoading || historicalLoading || securityLoading || countryLoading;

  // Process data for charts
  const processedHistoricalData = React.useMemo(() => {
    if (!historicalData || historicalData.length === 0) return [];
    
    return historicalData
      .slice(-30) // Last 30 data points
      .map((point: any, index: number) => ({
        period: index + 1,
        gdp: (point.totalGdp / 1e12), // Convert to trillions
        gdpPerCapita: point.gdpPerCapita,
        population: (point.population / 1e6), // Convert to millions
        timestamp: point.ixTimeTimestamp
      }));
  }, [historicalData]);

  const riskFactors = React.useMemo(() => {
    if (!analytics || !securityDashboard || !countryData) return [];

    const factors = [
      {
        name: "Economic Volatility",
        value: Math.round((analytics.volatility?.gdp || 0) * 100),
        risk: analytics.volatility?.gdp > 0.15 ? 'high' : analytics.volatility?.gdp > 0.1 ? 'medium' : 'low',
        description: "GDP growth volatility over time"
      },
      {
        name: "Security Threats",
        value: securityDashboard.activeThreats * 10,
        risk: securityDashboard.criticalThreats > 0 ? 'critical' : 
              securityDashboard.activeThreats > 3 ? 'high' : 
              securityDashboard.activeThreats > 1 ? 'medium' : 'low',
        description: "Active security threats assessment"
      },
      {
        name: "Economic Dependency",
        value: countryData.economicTier === 'Impoverished' ? 80 : 
               countryData.economicTier === 'Developing' ? 60 :
               countryData.economicTier === 'Developed' ? 40 : 20,
        risk: countryData.economicTier === 'Impoverished' ? 'high' : 
              countryData.economicTier === 'Developing' ? 'medium' : 'low',
        description: "Economic development stage risk"
      },
      {
        name: "Population Stability",
        value: Math.round((analytics.volatility?.population || 0) * 100),
        risk: analytics.volatility?.population > 0.05 ? 'medium' : 'low',
        description: "Population growth volatility"
      }
    ];

    return factors;
  }, [analytics, securityDashboard, countryData]);

  const trendData = React.useMemo(() => {
    if (!analytics?.trends) return {};
    
    return {
      gdp: {
        direction: analytics.trends.gdp,
        confidence: analytics.trends.gdp === 'growing' ? 85 : 
                   analytics.trends.gdp === 'declining' ? 75 : 90
      },
      population: {
        direction: analytics.trends.population,
        confidence: 80
      },
      overall: {
        direction: analytics.trends.overall,
        confidence: analytics.trends.overall === 'stable' ? 90 : 80
      }
    };
  }, [analytics]);

  const volatilityData = React.useMemo(() => {
    if (!analytics?.volatility) return [];
    
    return [
      { name: 'GDP', value: Math.round((analytics.volatility.gdp || 0) * 100), fill: '#8884d8' },
      { name: 'Population', value: Math.round((analytics.volatility.population || 0) * 100), fill: '#82ca9d' },
      { name: 'Overall', value: Math.round((analytics.volatility.overall || 0) * 100), fill: '#ffc658' }
    ];
  }, [analytics]);

  const riskDistribution = React.useMemo(() => {
    const distribution = riskFactors.reduce((acc, factor) => {
      acc[factor.risk] = (acc[factor.risk] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(distribution).map(([risk, count]) => ({
      name: risk.charAt(0).toUpperCase() + risk.slice(1),
      value: count,
      fill: RISK_COLORS[risk as keyof typeof RISK_COLORS]
    }));
  }, [riskFactors]);

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'growing': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getRiskColor = (risk: string) => {
    return RISK_COLORS[risk as keyof typeof RISK_COLORS] || '#6b7280';
  };

  const chartConfig = {
    gdp: { label: "GDP (Trillions)", color: "#2563eb" },
    gdpPerCapita: { label: "GDP per Capita", color: "#dc2626" },
    population: { label: "Population (Millions)", color: "#16a34a" }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Trend & Risk Analytics</h2>
          <p className="text-muted-foreground">Advanced analysis of economic trends and risk factors</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Last Updated: {analytics?.lastUpdated ? new Date(analytics.lastUpdated).toLocaleString() : 'N/A'}
          </Badge>
          <button 
            onClick={() => void refetchAnalytics()}
            className="p-2 hover:bg-gray-100 rounded-md"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trend Analysis</TabsTrigger>
          <TabsTrigger value="risks">Risk Assessment</TabsTrigger>
          <TabsTrigger value="volatility">Volatility</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Summary */}
            <GlassCard variant="social">
              <div className="p-6 pb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-500" />
                  Risk Assessment Summary
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Current risk factors and overall assessment</p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {riskFactors.map((factor, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{factor.name}</span>
                        <Badge 
                          style={{ backgroundColor: getRiskColor(factor.risk), color: 'white' }}
                          className="text-xs"
                        >
                          {factor.risk.toUpperCase()}
                        </Badge>
                      </div>
                      <Progress value={factor.value} className="h-2" />
                      <p className="text-xs text-muted-foreground">{factor.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>

            {/* Trend Summary */}
            <GlassCard variant="social">
              <div className="p-6 pb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <LineChart className="h-5 w-5 text-green-500" />
                  Trend Analysis Summary
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Key economic trend indicators</p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {Object.entries(trendData).map(([key, data]) => (
                    <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getTrendIcon(data.direction)}
                        <div>
                          <p className="font-medium capitalize">{key} Trend</p>
                          <p className="text-sm text-muted-foreground capitalize">{data.direction}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{data.confidence}%</p>
                        <p className="text-xs text-muted-foreground">Confidence</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>

            {/* Risk Distribution */}
            <GlassCard variant="social">
              <div className="p-6 pb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-purple-500" />
                  Risk Distribution
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Distribution of risk factors by severity</p>
              </div>
              <div className="p-6">
                {riskDistribution.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[200px]">
                    <RechartsPieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <RechartsPieChart data={riskDistribution}>
                        {riskDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </RechartsPieChart>
                      <Legend />
                    </RechartsPieChart>
                  </ChartContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <PieChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No risk data available</p>
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Key Metrics */}
            <GlassCard variant="social">
              <div className="p-6 pb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-orange-500" />
                  Key Performance Indicators
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Critical metrics at a glance</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {analytics?.dataPoints || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Data Points</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {analytics?.correlations?.overallHealth ? Math.round(analytics.correlations.overallHealth * 100) : 0}%
                    </div>
                    <div className="text-sm text-muted-foreground">Health Score</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {securityDashboard?.activeThreats || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Active Threats</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {volatilityData.reduce((acc, item) => acc + item.value, 0) / volatilityData.length || 0}%
                    </div>
                    <div className="text-sm text-muted-foreground">Avg Volatility</div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="mt-6">
          <div className="space-y-6">
            {/* Historical Trends Chart */}
            <GlassCard variant="social">
              <div className="p-6 pb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <LineChart className="h-5 w-5 text-blue-500" />
                  Historical Economic Trends
                </h3>
                <p className="text-sm text-muted-foreground mt-1">GDP, population, and economic indicators over time</p>
              </div>
              <div className="p-6">
                {processedHistoricalData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[400px]">
                    <RechartsLineChart data={processedHistoricalData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line 
                        type="monotone" 
                        dataKey="gdp" 
                        stroke={chartConfig.gdp.color} 
                        strokeWidth={2}
                        name="GDP (Trillions)"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="population" 
                        stroke={chartConfig.population.color} 
                        strokeWidth={2}
                        name="Population (Millions)"
                      />
                    </RechartsLineChart>
                  </ChartContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <LineChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No historical data available for trend analysis</p>
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Trend Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(trendData).map(([key, data]) => (
                <GlassCard key={key} variant="social">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        {getTrendIcon(data.direction)}
                        <h3 className="font-semibold capitalize">{key} Trend</h3>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {data.direction}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Confidence</span>
                        <span>{data.confidence}%</span>
                      </div>
                      <Progress value={data.confidence} className="h-2" />
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="risks" className="mt-6">
          <div className="space-y-6">
            {/* Risk Factor Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {riskFactors.map((factor, index) => (
                <GlassCard key={index} variant="social">
                  <div className="p-6 pb-4">
                    <h3 className="text-lg font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" style={{ color: getRiskColor(factor.risk) }} />
                        {factor.name}
                      </span>
                      <Badge style={{ backgroundColor: getRiskColor(factor.risk), color: 'white' }}>
                        {factor.risk.toUpperCase()}
                      </Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">{factor.description}</p>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Risk Level</span>
                          <span>{factor.value}%</span>
                        </div>
                        <Progress value={factor.value} className="h-3" />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        This factor contributes to the overall risk assessment based on current conditions and historical patterns.
                      </div>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="volatility" className="mt-6">
          <GlassCard variant="social">
            <div className="p-6 pb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-red-500" />
                Volatility Analysis
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Economic stability and volatility measurements</p>
            </div>
            <div className="p-6">
              {volatilityData.length > 0 ? (
                <div className="space-y-6">
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <BarChart data={volatilityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                  
                  <Alert>
                    <Eye className="h-4 w-4" />
                    <AlertDescription>
                      Volatility measures the degree of variation in economic indicators over time. 
                      Higher volatility indicates less predictable economic conditions and increased risk.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No volatility data available</p>
                </div>
              )}
            </div>
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}