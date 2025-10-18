"use client";

import React, { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { GlassCard } from "~/components/ui/enhanced-card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Switch } from "~/components/ui/switch";
import { Slider } from "~/components/ui/slider";
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
  BarChart,
  Bar,
  ComposedChart,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  RefreshCw,
  Download,
  Filter,
  Search,
  Zap,
  Target,
  Users,
  DollarSign,
  Globe,
  Shield,
  Lightbulb,
  Eye,
  BarChart4,
  PieChart as PieChartIcon,
  ScatterChart as ScatterChartIcon,
  Radar as RadarChartIcon,
} from "lucide-react";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";

interface AdvancedAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  countryId: string;
  countryName: string;
}

const CHART_COLORS = [
  "#8b5cf6", "#06b6d4", "#84cc16", "#f97316", 
  "#ec4899", "#14b8a6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4"
];

const VOLATILITY_COLORS = {
  stable: "#10b981",
  moderate: "#f59e0b",
  high: "#ef4444",
  extreme: "#dc2626"
};

export function AdvancedAnalyticsModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: AdvancedAnalyticsModalProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [timeRange, setTimeRange] = useState("1y");
  const [chartType, setChartType] = useState("line");
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["gdp", "population"]);
  const [showProjections, setShowProjections] = useState(true);
  const [volatilityThreshold, setVolatilityThreshold] = useState(0.15);

  // Get country data
  const { data: countryData, isLoading: countryLoading } = 
    api.countries.getByIdWithEconomicData.useQuery(
      { id: countryId },
      { enabled: isOpen }
    );

  // Get historical data
  const { data: historicalData, isLoading: historicalLoading } = 
    api.countries.getHistoricalData.useQuery(
      { countryId },
      { enabled: isOpen }
    );

  // Get advanced analytics
  const { data: advancedAnalytics, isLoading: analyticsLoading } =
    api.unifiedIntelligence.getAdvancedAnalytics.useQuery(
      { countryId: countryId || 'disabled' },
      { enabled: isOpen && !!countryId }
    );

  // Get global comparison data
  const { data: globalStats, isLoading: globalLoading } = 
    api.countries.getGlobalStats.useQuery(
      undefined,
      { enabled: isOpen }
    );

  const isLoading = countryLoading || historicalLoading || analyticsLoading || globalLoading;

  // Process historical data for charts
  const processedData = useMemo(() => {
    if (!historicalData || historicalData.length === 0) return [];
    
    return historicalData
      .slice(-50) // Last 50 data points
      .map((point: any, index: number) => ({
        period: index + 1,
        timestamp: point.ixTimeTimestamp,
        gdp: (point.totalGdp / 1e12), // Convert to trillions
        gdpPerCapita: point.gdpPerCapita,
        population: (point.population / 1e6), // Convert to millions
        gdpGrowth: (point.gdpGrowthRate || 0) * 100,
        popGrowth: (point.populationGrowthRate || 0) * 100,
        density: point.populationDensity || 0,
        gdpDensity: point.gdpDensity || 0,
      }));
  }, [historicalData]);

  // Calculate volatility metrics
  const volatilityMetrics = useMemo(() => {
    if (!processedData || processedData.length < 2) return null;
    
    const gdpValues = processedData.map(d => d.gdp);
    const popValues = processedData.map(d => d.population);
    
    const gdpVolatility = calculateVolatility(gdpValues);
    const popVolatility = calculateVolatility(popValues);
    
    return {
      gdp: {
        value: gdpVolatility,
        level: getVolatilityLevel(gdpVolatility),
        trend: getTrendDirection(gdpValues)
      },
      population: {
        value: popVolatility,
        level: getVolatilityLevel(popVolatility),
        trend: getTrendDirection(popValues)
      }
    };
  }, [processedData]);

  // Calculate correlation matrix
  const correlationMatrix = useMemo(() => {
    if (!processedData || processedData.length < 10) return null;
    
    const metrics = {
      gdp: processedData.map(d => d.gdp),
      population: processedData.map(d => d.population),
      gdpPerCapita: processedData.map(d => d.gdpPerCapita),
      gdpGrowth: processedData.map(d => d.gdpGrowth),
      popGrowth: processedData.map(d => d.popGrowth),
    };
    
    const correlations: Record<string, Record<string, number>> = {};
    const metricNames = Object.keys(metrics);
    
    metricNames.forEach(metric1 => {
      correlations[metric1] = {};
      metricNames.forEach(metric2 => {
        if (metric1 === metric2) {
          correlations[metric1]![metric2] = 1;
        } else {
          correlations[metric1]![metric2] = calculateCorrelation(
            metrics[metric1 as keyof typeof metrics],
            metrics[metric2 as keyof typeof metrics]
          );
        }
      });
    });
    
    return correlations;
  }, [processedData]);

  // Generate insights
  const insights = useMemo(() => {
    if (!volatilityMetrics || !correlationMatrix || !countryData) return [];
    
    const insightsList = [];
    
    // Volatility insights
    if (volatilityMetrics?.gdp?.level === 'high' || volatilityMetrics?.gdp?.level === 'extreme') {
      insightsList.push({
        type: 'warning',
        title: 'High GDP Volatility',
        description: `GDP shows ${volatilityMetrics.gdp.level} volatility (${(volatilityMetrics.gdp.value * 100).toFixed(1)}%). Consider economic stabilization measures.`,
        icon: AlertTriangle
      });
    }
    
    if (volatilityMetrics?.population?.level === 'high' || volatilityMetrics?.population?.level === 'extreme') {
      insightsList.push({
        type: 'warning',
        title: 'Population Volatility',
        description: `Population growth shows ${volatilityMetrics.population.level} volatility. Review demographic policies.`,
        icon: Users
      });
    }
    
    // Correlation insights
    const gdpPopCorrelation = correlationMatrix?.gdp?.population;
    if (gdpPopCorrelation && Math.abs(gdpPopCorrelation) > 0.8) {
      insightsList.push({
        type: 'info',
        title: 'Strong GDP-Population Correlation',
        description: `GDP and population are ${gdpPopCorrelation > 0 ? 'positively' : 'negatively'} correlated (${(gdpPopCorrelation * 100).toFixed(1)}%).`,
        icon: TrendingUp
      });
    }
    
    // Growth insights
    if (countryData?.adjustedGdpGrowth && countryData.adjustedGdpGrowth > 0.05) {
      insightsList.push({
        type: 'success',
        title: 'Strong Economic Growth',
        description: `GDP growth rate of ${(countryData.adjustedGdpGrowth * 100).toFixed(1)}% indicates healthy economic expansion.`,
        icon: CheckCircle
      });
    }
    
    return insightsList;
  }, [volatilityMetrics, correlationMatrix, countryData]);

  // Helper functions
  function calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
    return Math.sqrt(variance) / mean; // Coefficient of variation
  }

  function getVolatilityLevel(volatility: number): 'stable' | 'moderate' | 'high' | 'extreme' {
    if (volatility < 0.1) return 'stable';
    if (volatility < 0.2) return 'moderate';
    if (volatility < 0.4) return 'high';
    return 'extreme';
  }

  function getTrendDirection(values: number[]): 'up' | 'down' | 'stable' {
    if (values.length < 2) return 'stable';
    
    const recent = values.slice(-5);
    const older = values.slice(0, 5);
    
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
    
    const change = (recentAvg - olderAvg) / olderAvg;
    
    if (change > 0.05) return 'up';
    if (change < -0.05) return 'down';
    return 'stable';
  }

  function calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;
    
    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * (y[i] ?? 0), 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.reduce((sum, val) => sum + val * val, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'error': return 'text-red-500';
      default: return 'text-blue-500';
    }
  };

  const getInsightBgColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-500/10 border-green-500/20';
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/20';
      case 'error': return 'bg-red-500/10 border-red-500/20';
      default: return 'bg-blue-500/10 border-blue-500/20';
    }
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              Advanced Analytics - {countryName}
            </DialogTitle>
            <DialogDescription>
              Loading comprehensive analytics and data exploration tools...
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            Advanced Analytics - {countryName}
          </DialogTitle>
          <DialogDescription>
            Comprehensive data analysis, volatility metrics, trend detection, and correlation studies
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="volatility">Volatility</TabsTrigger>
            <TabsTrigger value="correlations">Correlations</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <GlassCard>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">GDP Volatility</p>
                      <p className="text-2xl font-bold">
                        {volatilityMetrics ? `${(volatilityMetrics.gdp.value * 100).toFixed(1)}%` : 'N/A'}
                      </p>
                    </div>
                    <div className={`p-2 rounded-full ${
                      volatilityMetrics?.gdp.level === 'stable' ? 'bg-green-500/20' :
                      volatilityMetrics?.gdp.level === 'moderate' ? 'bg-yellow-500/20' :
                      volatilityMetrics?.gdp.level === 'high' ? 'bg-orange-500/20' : 'bg-red-500/20'
                    }`}>
                      <Activity className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {volatilityMetrics?.gdp.level} volatility
                  </p>
                </div>
              </GlassCard>

              <GlassCard>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Population Volatility</p>
                      <p className="text-2xl font-bold">
                        {volatilityMetrics ? `${(volatilityMetrics.population.value * 100).toFixed(1)}%` : 'N/A'}
                      </p>
                    </div>
                    <div className={`p-2 rounded-full ${
                      volatilityMetrics?.population.level === 'stable' ? 'bg-green-500/20' :
                      volatilityMetrics?.population.level === 'moderate' ? 'bg-yellow-500/20' :
                      volatilityMetrics?.population.level === 'high' ? 'bg-orange-500/20' : 'bg-red-500/20'
                    }`}>
                      <Users className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {volatilityMetrics?.population.level} volatility
                  </p>
                </div>
              </GlassCard>

              <GlassCard>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Data Points</p>
                      <p className="text-2xl font-bold">{processedData.length}</p>
                    </div>
                    <div className="p-2 rounded-full bg-blue-500/20">
                      <BarChart4 className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Historical records
                  </p>
                </div>
              </GlassCard>

              <GlassCard>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Growth Trend</p>
                      <p className="text-2xl font-bold">
                        {volatilityMetrics?.gdp.trend === 'up' ? '↗' : 
                         volatilityMetrics?.gdp.trend === 'down' ? '↘' : '→'}
                      </p>
                    </div>
                    <div className="p-2 rounded-full bg-purple-500/20">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {volatilityMetrics?.gdp.trend} trend
                  </p>
                </div>
              </GlassCard>
            </div>

            {/* Main Chart */}
            <GlassCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Economic Indicators Over Time</h3>
                  <div className="flex items-center gap-2">
                    <Select value={chartType} onValueChange={setChartType}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="line">Line</SelectItem>
                        <SelectItem value="area">Area</SelectItem>
                        <SelectItem value="bar">Bar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'line' ? (
                      <LineChart data={processedData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="gdp" stroke="#8b5cf6" name="GDP (Trillions)" />
                        <Line type="monotone" dataKey="population" stroke="#06b6d4" name="Population (Millions)" />
                      </LineChart>
                    ) : chartType === 'area' ? (
                      <AreaChart data={processedData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Area type="monotone" dataKey="gdp" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} name="GDP (Trillions)" />
                        <Area type="monotone" dataKey="population" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} name="Population (Millions)" />
                      </AreaChart>
                    ) : (
                      <BarChart data={processedData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="gdp" fill="#8b5cf6" name="GDP (Trillions)" />
                        <Bar dataKey="population" fill="#06b6d4" name="Population (Millions)" />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          <TabsContent value="volatility" className="space-y-6">
            <GlassCard>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Volatility Analysis</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">GDP Volatility</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Current Level:</span>
                        <Badge variant={volatilityMetrics?.gdp.level === 'stable' ? 'default' : 
                                       volatilityMetrics?.gdp.level === 'moderate' ? 'secondary' : 'destructive'}>
                          {volatilityMetrics?.gdp.level || 'N/A'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Coefficient:</span>
                        <span className="font-medium">
                          {volatilityMetrics ? `${(volatilityMetrics.gdp.value * 100).toFixed(2)}%` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Trend:</span>
                        <span className="font-medium">
                          {volatilityMetrics?.gdp.trend || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3">Population Volatility</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Current Level:</span>
                        <Badge variant={volatilityMetrics?.population.level === 'stable' ? 'default' : 
                                       volatilityMetrics?.population.level === 'moderate' ? 'secondary' : 'destructive'}>
                          {volatilityMetrics?.population.level || 'N/A'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Coefficient:</span>
                        <span className="font-medium">
                          {volatilityMetrics ? `${(volatilityMetrics.population.value * 100).toFixed(2)}%` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Trend:</span>
                        <span className="font-medium">
                          {volatilityMetrics?.population.trend || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          <TabsContent value="correlations" className="space-y-6">
            <GlassCard>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Correlation Matrix</h3>
                
                {correlationMatrix ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="text-left p-2">Metric</th>
                          <th className="text-center p-2">GDP</th>
                          <th className="text-center p-2">Population</th>
                          <th className="text-center p-2">GDP/Capita</th>
                          <th className="text-center p-2">GDP Growth</th>
                          <th className="text-center p-2">Pop Growth</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(correlationMatrix).map(([metric, correlations]) => (
                          <tr key={metric} className="border-t">
                            <td className="p-2 font-medium">{metric}</td>
                            {Object.entries(correlations).map(([corrMetric, value]) => (
                              <td key={corrMetric} className="p-2 text-center">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  Math.abs(value) > 0.8 ? 'bg-green-500/20 text-green-700' :
                                  Math.abs(value) > 0.6 ? 'bg-yellow-500/20 text-yellow-700' :
                                  Math.abs(value) > 0.4 ? 'bg-orange-500/20 text-orange-700' :
                                  'bg-gray-500/20 text-gray-700'
                                }`}>
                                  {value.toFixed(2)}
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Insufficient data for correlation analysis</p>
                )}
              </div>
            </GlassCard>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <GlassCard>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Growth Rate Trends</h3>
                
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={processedData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="gdpGrowth" stroke="#8b5cf6" name="GDP Growth (%)" />
                      <Line type="monotone" dataKey="popGrowth" stroke="#06b6d4" name="Population Growth (%)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <div className="space-y-4">
              {insights.map((insight, index) => {
                const IconComponent = insight.icon;
                return (
                  <GlassCard key={index} className={getInsightBgColor(insight.type)}>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <IconComponent className={`h-5 w-5 mt-0.5 ${getInsightColor(insight.type)}`} />
                        <div className="flex-1">
                          <h4 className="font-medium mb-1">{insight.title}</h4>
                          <p className="text-sm text-muted-foreground">{insight.description}</p>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
              
              {insights.length === 0 && (
                <GlassCard>
                  <div className="p-6 text-center">
                    <Lightbulb className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">No insights available yet. Continue collecting data for automated insights.</p>
                  </div>
                </GlassCard>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
} 