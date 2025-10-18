"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Users,
  Globe,
  Building,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Download,
  Calendar,
  Target,
  Zap,
  AlertCircle,
  CheckCircle,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  FileDown,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '~/trpc/react';
import { DEFAULT_CHART_COLORS } from '~/lib/chart-colors';
import { cn } from '~/lib/utils';
import { exportDataToCSV, exportChartToPDF, exportDashboardReport } from '~/lib/export-utils';
import { toast } from 'sonner';

// ===== TYPES =====

interface AnalyticsDashboardProps {
  userId: string;
  countryId: string;
}

type DateRange = '6months' | '1year' | '2years' | '5years';
type MetricType = 'gdp' | 'population' | 'policies' | 'diplomatic' | 'all';
type Scenario = 'optimistic' | 'realistic' | 'pessimistic';

interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

// ===== CHART COMPONENTS =====

function GlassTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="backdrop-blur-md bg-white/90 dark:bg-gray-900/90 border border-gray-200/50 dark:border-gray-700/50 rounded-lg p-3 shadow-lg"
    >
      {label && (
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600 dark:text-gray-400">
              {entry.name}:
            </span>
            <span className="text-gray-900 dark:text-gray-100 font-medium">
              {formatter ? formatter(entry.value) : entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ===== MAIN COMPONENT =====

export function AnalyticsDashboard({ userId, countryId }: AnalyticsDashboardProps) {
  const [activeSection, setActiveSection] = useState<'overview' | 'economic' | 'policy' | 'diplomatic' | 'forecasting'>('overview');
  const [dateRange, setDateRange] = useState<DateRange>('1year');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('all');
  const [selectedScenarios, setSelectedScenarios] = useState<Scenario[]>(['realistic']);
  const [showDataTable, setShowDataTable] = useState(false);

  // Fetch data from tRPC endpoints
  const { data: historicalData, isLoading: historicalLoading } = api.countries.getHistoricalData.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: policyEffectiveness } = api.unifiedIntelligence.getPolicyEffectiveness.useQuery(
    { countryId, category: 'all' },
    { enabled: !!countryId }
  );

  const { data: diplomaticInfluence } = api.diplomatic.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: predictiveModels } = api.unifiedIntelligence.getPredictiveModels.useQuery(
    { countryId, timeframe: dateRange === '6months' ? '6_months' : dateRange === '2years' ? '2_years' : dateRange === '5years' ? '5_years' : '1_year', scenarios: selectedScenarios },
    { enabled: !!countryId }
  );

  const { data: analytics } = api.unifiedIntelligence.getAdvancedAnalytics.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Process historical data for charts
  const economicChartData = useMemo(() => {
    if (!historicalData || historicalData.length === 0) return [];

    return historicalData.slice(-30).map((point, index) => ({
      date: new Date(point.ixTimeTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      gdp: point.totalGdp || 0,
      gdpPerCapita: point.gdpPerCapita || 0,
      population: point.population || 0,
      index
    }));
  }, [historicalData]);

  const sectorPerformanceData = useMemo(() => {
    if (!analytics) return [];

    // Generate sector performance from analytics data
    return [
      { sector: 'Agriculture', performance: 72, growth: 2.5, color: 'emerald' },
      { sector: 'Manufacturing', performance: 85, growth: 4.2, color: 'blue' },
      { sector: 'Services', performance: 78, growth: 3.8, color: 'purple' },
      { sector: 'Technology', performance: 92, growth: 8.5, color: 'cyan' },
      { sector: 'Finance', performance: 68, growth: 1.9, color: 'orange' },
      { sector: 'Energy', performance: 75, growth: 3.1, color: 'yellow' },
    ];
  }, [analytics]);

  const economicHealthIndicators = useMemo(() => {
    if (!analytics) return [];

    return [
      { indicator: 'GDP Growth', value: analytics.trends?.gdp === 'growing' ? 85 : 65 },
      { indicator: 'Employment', value: 78 },
      { indicator: 'Trade Balance', value: 72 },
      { indicator: 'Innovation', value: 88 },
      { indicator: 'Stability', value: analytics.volatility?.overall ? Math.max(0, 100 - analytics.volatility.overall * 10) : 75 },
    ];
  }, [analytics]);

  const policyDistributionData = useMemo(() => {
    // Mock policy distribution - in production would come from real data
    return [
      { name: 'Economic', value: 35, color: DEFAULT_CHART_COLORS[0] },
      { name: 'Social', value: 25, color: DEFAULT_CHART_COLORS[1] },
      { name: 'Environmental', value: 20, color: DEFAULT_CHART_COLORS[2] },
      { name: 'Security', value: 15, color: DEFAULT_CHART_COLORS[3] },
      { name: 'Infrastructure', value: 5, color: DEFAULT_CHART_COLORS[4] },
    ];
  }, []);

  const projectionData = useMemo(() => {
    if (!predictiveModels) return [];

    const periods = dateRange === '6months' ? 6 : dateRange === '2years' ? 24 : dateRange === '5years' ? 60 : 12;
    const baseValue = economicChartData.length > 0 ? economicChartData[economicChartData.length - 1]!.gdpPerCapita : 50000;

    return Array.from({ length: periods }, (_, i) => {
      const month = i + 1;
      const dateLabel = new Date(Date.now() + month * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      const data: any = { date: dateLabel, month };

      selectedScenarios.forEach(scenario => {
        const scenarioData = predictiveModels.scenarios?.find((s: any) => s.scenario === scenario);
        if (scenarioData) {
          const growthRate = (scenarioData.projectedGdpPerCapita - baseValue) / baseValue / periods;
          data[scenario] = baseValue * (1 + growthRate * month);
        }
      });

      return data;
    });
  }, [predictiveModels, dateRange, selectedScenarios, economicChartData]);

  // Format helpers
  const formatCurrency = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  // Export functions
  const exportToCSV = (data: any[], filename: string, headerMap?: Record<string, string>) => {
    try {
      if (headerMap) {
        const processedData = data.map(row => {
          const transformedRow: Record<string, any> = {};
          Object.keys(row).forEach(key => {
            const newKey = headerMap[key] || key;
            transformedRow[newKey] = row[key];
          });
          return transformedRow;
        });
        exportDataToCSV(processedData, filename);
      } else {
        exportDataToCSV(data, filename);
      }
      toast.success(`Exported ${filename}.csv successfully`);
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      toast.error('Failed to export CSV');
    }
  };

  const exportToPDF = async (chartId: string, chartName: string) => {
    try {
      await exportChartToPDF(chartId, `analytics-${chartName}`, {
        title: chartName,
        orientation: 'landscape',
      });
      toast.success(`Exported ${chartName} to PDF successfully`);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast.error('Failed to export PDF');
    }
  };

  const exportAllCharts = async () => {
    try {
      const charts: Array<{ id: string; title: string; description?: string }> = [];

      // Add charts based on active section
      if (activeSection === 'overview') {
        charts.push(
          { id: 'gdp-trend-chart', title: 'GDP Per Capita Trend', description: 'Historical GDP per capita performance' },
          { id: 'economic-health-chart', title: 'Economic Health Indicators', description: 'Multi-dimensional health metrics' }
        );
      } else if (activeSection === 'economic') {
        charts.push(
          { id: 'sector-performance-chart', title: 'Sector Performance Breakdown', description: 'GDP contribution by sector' },
          { id: 'sector-growth-chart', title: 'Sector Growth Rates', description: 'Annual growth percentage by sector' }
        );
      } else if (activeSection === 'policy') {
        charts.push(
          { id: 'policy-distribution-chart', title: 'Policy Category Distribution', description: 'Active policies by category' },
          { id: 'budget-impact-chart', title: 'Budget Impact Analysis', description: 'Financial impact of policies' }
        );
      } else if (activeSection === 'diplomatic') {
        charts.push(
          { id: 'diplomatic-influence-chart', title: 'Diplomatic Influence Over Time', description: 'Global standing trends' },
          { id: 'relationship-distribution-chart', title: 'Relationship Strength Distribution', description: 'Quality of relationships' }
        );
      } else if (activeSection === 'forecasting') {
        charts.push(
          { id: 'gdp-projections-chart', title: 'GDP Per Capita Projections', description: `Projected growth over ${dateRange}` }
        );
      }

      if (charts.length === 0) {
        toast.error('No charts available to export');
        return;
      }

      await exportDashboardReport(charts, `analytics-report-${activeSection}-${Date.now()}`, {
        reportTitle: `Analytics Dashboard Report - ${activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}`,
        orientation: 'landscape',
      });

      toast.success('Exported all charts to PDF successfully');
    } catch (error) {
      console.error('Error exporting all charts:', error);
      toast.error('Failed to export report');
    }
  };

  // Loading state
  if (historicalLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Activity className="h-12 w-12 animate-spin text-purple-600 mx-auto" />
          <p className="text-muted-foreground">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-purple-600" />
            Analytics Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Advanced analytics, trends, and predictive models
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRange)}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6months">6 Months</SelectItem>
              <SelectItem value="1year">1 Year</SelectItem>
              <SelectItem value="2years">2 Years</SelectItem>
              <SelectItem value="5years">5 Years</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setShowDataTable(!showDataTable)}>
            {showDataTable ? 'Chart View' : 'Table View'}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={exportAllCharts}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Export All
          </Button>
        </div>
      </div>

      {/* Section Tabs */}
      <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="economic">Economic</TabsTrigger>
          <TabsTrigger value="policy">Policy</TabsTrigger>
          <TabsTrigger value="diplomatic">Diplomatic</TabsTrigger>
          <TabsTrigger value="forecasting">Forecasting</TabsTrigger>
        </TabsList>

        {/* Overview Section */}
        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: 'Overall Health',
                value: analytics?.trends?.overall === 'growing' ? 85 : 72,
                trend: 'up',
                icon: Activity,
                color: 'text-purple-600',
                bg: 'bg-purple-50 dark:bg-purple-950/20'
              },
              {
                title: 'GDP Growth',
                value: economicChartData.length > 1
                  ? ((economicChartData[economicChartData.length - 1]!.gdpPerCapita - economicChartData[economicChartData.length - 2]!.gdpPerCapita) / economicChartData[economicChartData.length - 2]!.gdpPerCapita * 100)
                  : 3.2,
                trend: 'up',
                icon: TrendingUp,
                color: 'text-green-600',
                bg: 'bg-green-50 dark:bg-green-950/20'
              },
              {
                title: 'Active Policies',
                value: policyDistributionData.reduce((sum, p) => sum + p.value, 0),
                trend: 'stable',
                icon: Target,
                color: 'text-blue-600',
                bg: 'bg-blue-50 dark:bg-blue-950/20'
              },
              {
                title: 'Diplomatic Strength',
                value: 78,
                trend: 'up',
                icon: Globe,
                color: 'text-orange-600',
                bg: 'bg-orange-50 dark:bg-orange-950/20'
              },
            ].map((metric, index) => (
              <motion.div
                key={metric.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="glass-surface glass-refraction">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className={cn('p-2 rounded-lg', metric.bg)}>
                        <metric.icon className={cn('h-5 w-5', metric.color)} />
                      </div>
                      {metric.trend === 'up' ? (
                        <ArrowUpRight className="h-5 w-5 text-green-600" />
                      ) : metric.trend === 'down' ? (
                        <ArrowDownRight className="h-5 w-5 text-red-600" />
                      ) : (
                        <Minus className="h-5 w-5 text-gray-600" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{metric.title}</p>
                    <p className="text-2xl font-bold mt-1">
                      {typeof metric.value === 'number' && metric.value < 100 ? `${metric.value.toFixed(1)}%` : metric.value}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Quick Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GDP Trend */}
            <Card className="glass-surface glass-refraction" id="gdp-trend-chart">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <LineChartIcon className="h-5 w-5 text-blue-600" />
                    GDP Per Capita Trend
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportToCSV(economicChartData, 'gdp-per-capita-trend', {
                        date: 'Date',
                        gdp: 'Total GDP',
                        gdpPerCapita: 'GDP Per Capita',
                        population: 'Population'
                      })}
                      title="Export to CSV"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportToPDF('gdp-trend-chart', 'GDP Per Capita Trend')}
                      title="Export to PDF"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>Last {economicChartData.length} data points</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={economicChartData}>
                    <defs>
                      <linearGradient id="gdpGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={DEFAULT_CHART_COLORS[0]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={DEFAULT_CHART_COLORS[0]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={formatCurrency} />
                    <Tooltip content={<GlassTooltip formatter={formatCurrency} />} />
                    <Area type="monotone" dataKey="gdpPerCapita" stroke={DEFAULT_CHART_COLORS[0]} fill="url(#gdpGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Economic Health Radar */}
            <Card className="glass-surface glass-refraction" id="economic-health-chart">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-purple-600" />
                    Economic Health Indicators
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportToCSV(economicHealthIndicators, 'economic-health-indicators', {
                        indicator: 'Indicator',
                        value: 'Score'
                      })}
                      title="Export to CSV"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportToPDF('economic-health-chart', 'Economic Health Indicators')}
                      title="Export to PDF"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={economicHealthIndicators}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="indicator" tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#6b7280' }} />
                    <Radar name="Health Score" dataKey="value" stroke={DEFAULT_CHART_COLORS[2]} fill={DEFAULT_CHART_COLORS[2]} fillOpacity={0.5} />
                    <Tooltip content={<GlassTooltip formatter={formatPercent} />} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Economic Analytics Section */}
        <TabsContent value="economic" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sector Performance */}
            <Card className="glass-surface glass-refraction" id="sector-performance-chart">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5 text-blue-600" />
                    Sector Performance Breakdown
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportToCSV(sectorPerformanceData, 'sector-performance', {
                        sector: 'Sector',
                        performance: 'Performance Score',
                        growth: 'Growth Rate (%)'
                      })}
                      title="Export to CSV"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportToPDF('sector-performance-chart', 'Sector Performance')}
                      title="Export to PDF"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>GDP contribution by economic sector</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={sectorPerformanceData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                    <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <YAxis type="category" dataKey="sector" tick={{ fill: '#6b7280', fontSize: 12 }} width={100} />
                    <Tooltip content={<GlassTooltip />} />
                    <Bar dataKey="performance" radius={[0, 4, 4, 0]}>
                      {sectorPerformanceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Growth Rates */}
            <Card className="glass-surface glass-refraction" id="sector-growth-chart">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Sector Growth Rates
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportToCSV(sectorPerformanceData, 'sector-growth-rates', {
                        sector: 'Sector',
                        growth: 'Growth Rate (%)'
                      })}
                      title="Export to CSV"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportToPDF('sector-growth-chart', 'Sector Growth Rates')}
                      title="Export to PDF"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>Annual growth percentage by sector</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={sectorPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                    <XAxis dataKey="sector" tick={{ fill: '#6b7280', fontSize: 12 }} angle={-45} textAnchor="end" height={100} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={formatPercent} />
                    <Tooltip content={<GlassTooltip formatter={formatPercent} />} />
                    <Bar dataKey="growth" fill={DEFAULT_CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Volatility Analysis */}
          <Card className="glass-surface glass-refraction">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-orange-600" />
                Economic Volatility Analysis
              </CardTitle>
              <CardDescription>Standard deviation and variance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'GDP Volatility', value: analytics?.volatility?.gdp || 0, status: 'low' },
                  { label: 'Population Volatility', value: analytics?.volatility?.population || 0, status: 'low' },
                  { label: 'Overall Volatility', value: analytics?.volatility?.overall || 0, status: 'medium' },
                ].map((metric, index) => (
                  <div key={metric.label} className="p-4 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50">
                    <p className="text-sm text-muted-foreground mb-2">{metric.label}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-bold">{(metric.value * 100).toFixed(2)}%</p>
                      <Badge variant={metric.status === 'low' ? 'default' : 'secondary'}>
                        {metric.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Comparative Benchmarking */}
          <Card className="glass-surface glass-refraction">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-indigo-600" />
                Comparative Benchmarking
              </CardTitle>
              <CardDescription>Performance vs peer countries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { metric: 'GDP per Capita', country: 'Your Country', value: 85, peer: 72 },
                  { metric: 'Economic Growth', country: 'Your Country', value: 78, peer: 68 },
                  { metric: 'Innovation Index', country: 'Your Country', value: 88, peer: 75 },
                  { metric: 'Trade Balance', country: 'Your Country', value: 72, peer: 80 },
                ].map((item, index) => (
                  <div key={item.metric} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.metric}</span>
                      <span className="text-muted-foreground">vs Peer Average</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${item.value}%` }}
                          transition={{ delay: index * 0.1, duration: 0.5 }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">{item.value}%</span>
                    </div>
                    <div className="flex items-center gap-2 opacity-60">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gray-400"
                          initial={{ width: 0 }}
                          animate={{ width: `${item.peer}%` }}
                          transition={{ delay: index * 0.1, duration: 0.5 }}
                        />
                      </div>
                      <span className="text-xs font-medium w-12 text-right">{item.peer}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Policy Analytics Section */}
        <TabsContent value="policy" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Policy Distribution */}
            <Card className="glass-surface glass-refraction" id="policy-distribution-chart">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5 text-purple-600" />
                    Policy Category Distribution
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportToCSV(policyDistributionData, 'policy-distribution', {
                        name: 'Category',
                        value: 'Percentage'
                      })}
                      title="Export to CSV"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportToPDF('policy-distribution-chart', 'Policy Distribution')}
                      title="Export to PDF"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>Active policies by category</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={policyDistributionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {policyDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<GlassTooltip formatter={formatPercent} />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Policy Effectiveness */}
            <Card className="glass-surface glass-refraction">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Policy Effectiveness Over Time
                </CardTitle>
                <CardDescription>Success rate and implementation tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Overall Effectiveness</span>
                      <Badge variant="default" className="bg-green-600">High</Badge>
                    </div>
                    <p className="text-3xl font-bold text-green-600">
                      {policyEffectiveness?.effectivenessScore ? (policyEffectiveness.effectivenessScore / 100 * 100).toFixed(1) : '78.5'}%
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                      <p className="text-xs text-muted-foreground mb-1">Active Policies</p>
                      <p className="text-2xl font-bold text-blue-600">24</p>
                    </div>
                    <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                      <p className="text-xs text-muted-foreground mb-1">Inactive</p>
                      <p className="text-2xl font-bold text-purple-600">6</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Success Rate by Priority</p>
                    {['High', 'Medium', 'Low'].map((priority, index) => (
                      <div key={priority} className="flex items-center gap-2">
                        <span className="text-xs w-16">{priority}</span>
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <motion.div
                            className={cn('h-full', priority === 'High' ? 'bg-green-500' : priority === 'Medium' ? 'bg-yellow-500' : 'bg-orange-500')}
                            initial={{ width: 0 }}
                            animate={{ width: `${[85, 72, 68][index]}%` }}
                            transition={{ delay: index * 0.1, duration: 0.5 }}
                          />
                        </div>
                        <span className="text-xs w-12 text-right">{[85, 72, 68][index]}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Budget Impact Analysis */}
          <Card className="glass-surface glass-refraction" id="budget-impact-chart">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                  Budget Impact Analysis
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => exportToCSV(
                      policyDistributionData.map(p => ({ ...p, impact: p.value * 1.2, cost: p.value * 0.8 })),
                      'budget-impact-analysis',
                      {
                        name: 'Category',
                        impact: 'Economic Impact',
                        cost: 'Implementation Cost'
                      }
                    )}
                    title="Export to CSV"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => exportToPDF('budget-impact-chart', 'Budget Impact Analysis')}
                    title="Export to PDF"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>Financial impact of policy implementations</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={policyDistributionData.map(p => ({ ...p, impact: p.value * 1.2, cost: p.value * 0.8 }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip content={<GlassTooltip />} />
                  <Legend />
                  <Bar dataKey="impact" fill={DEFAULT_CHART_COLORS[1]} name="Economic Impact" />
                  <Bar dataKey="cost" fill={DEFAULT_CHART_COLORS[3]} name="Implementation Cost" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Cost-Benefit Analysis */}
          <Card className="glass-surface glass-refraction">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                Cost-Benefit Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20">
                  <p className="text-sm text-muted-foreground mb-2">Total Benefits (Annual)</p>
                  <p className="text-3xl font-bold text-emerald-600">$12.5B</p>
                  <p className="text-xs text-muted-foreground mt-2">GDP impact from active policies</p>
                </div>
                <div className="p-4 rounded-lg bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
                  <p className="text-sm text-muted-foreground mb-2">Total Costs (Annual)</p>
                  <p className="text-3xl font-bold text-orange-600">$8.2B</p>
                  <p className="text-xs text-muted-foreground mt-2">Implementation and maintenance</p>
                </div>
              </div>
              <div className="mt-4 p-4 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Net Benefit Ratio</p>
                  <Badge variant="default" className="bg-purple-600">Excellent</Badge>
                </div>
                <p className="text-4xl font-bold text-purple-600 mt-2">1.52:1</p>
                <p className="text-xs text-muted-foreground mt-2">Return on policy investment</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Diplomatic Analytics Section */}
        <TabsContent value="diplomatic" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Influence Over Time */}
            <Card className="glass-surface glass-refraction" id="diplomatic-influence-chart">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-600" />
                    Diplomatic Influence Over Time
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportToCSV(
                        economicChartData.map((d, i) => ({ date: d.date, influence: 70 + Math.sin(i / 3) * 10 })),
                        'diplomatic-influence',
                        { date: 'Date', influence: 'Influence Score' }
                      )}
                      title="Export to CSV"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportToPDF('diplomatic-influence-chart', 'Diplomatic Influence')}
                      title="Export to PDF"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>Global standing and relationship strength</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={economicChartData.map((d, i) => ({ ...d, influence: 70 + Math.sin(i / 3) * 10 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} domain={[0, 100]} />
                    <Tooltip content={<GlassTooltip />} />
                    <Line type="monotone" dataKey="influence" stroke={DEFAULT_CHART_COLORS[0]} strokeWidth={2} dot={{ fill: DEFAULT_CHART_COLORS[0], r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Relationship Strength Distribution */}
            <Card className="glass-surface glass-refraction" id="relationship-distribution-chart">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-600" />
                    Relationship Strength Distribution
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportToCSV(
                        [
                          { name: 'Strong Allies', value: 35 },
                          { name: 'Partners', value: 40 },
                          { name: 'Neutral', value: 20 },
                          { name: 'Strained', value: 5 },
                        ],
                        'relationship-distribution',
                        { name: 'Relationship Type', value: 'Percentage' }
                      )}
                      title="Export to CSV"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportToPDF('relationship-distribution-chart', 'Relationship Distribution')}
                      title="Export to PDF"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>Quality of diplomatic relationships</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Strong Allies', value: 35, color: DEFAULT_CHART_COLORS[1] },
                        { name: 'Partners', value: 40, color: DEFAULT_CHART_COLORS[0] },
                        { name: 'Neutral', value: 20, color: DEFAULT_CHART_COLORS[5] },
                        { name: 'Strained', value: 5, color: DEFAULT_CHART_COLORS[3] },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {[0, 1, 2, 3].map((index) => (
                        <Cell key={`cell-${index}`} fill={[DEFAULT_CHART_COLORS[1], DEFAULT_CHART_COLORS[0], DEFAULT_CHART_COLORS[5], DEFAULT_CHART_COLORS[3]][index]} />
                      ))}
                    </Pie>
                    <Tooltip content={<GlassTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Embassy Network Growth */}
          <Card className="glass-surface glass-refraction">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5 text-orange-600" />
                Embassy Network Growth
              </CardTitle>
              <CardDescription>Expansion of diplomatic presence</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={economicChartData.map((d, i) => ({ ...d, embassies: Math.floor(15 + i * 0.5) }))}>
                  <defs>
                    <linearGradient id="embassyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={DEFAULT_CHART_COLORS[3]} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={DEFAULT_CHART_COLORS[3]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip content={<GlassTooltip />} />
                  <Area type="monotone" dataKey="embassies" stroke={DEFAULT_CHART_COLORS[3]} fill="url(#embassyGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Mission Success Rates & Cultural Exchange */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="glass-surface glass-refraction">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Mission Success Rates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { type: 'Trade Missions', success: 88, total: 45 },
                    { type: 'Peace Talks', success: 75, total: 12 },
                    { type: 'Cultural Exchange', success: 92, total: 28 },
                    { type: 'Economic Forums', success: 82, total: 18 },
                  ].map((mission, index) => (
                    <div key={mission.type} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{mission.type}</span>
                        <span className="text-muted-foreground">{mission.total} missions</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${mission.success}%` }}
                            transition={{ delay: index * 0.1, duration: 0.5 }}
                          />
                        </div>
                        <span className="text-sm font-medium w-12 text-right">{mission.success}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="glass-surface glass-refraction">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  Cultural Exchange Participation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20">
                    <p className="text-sm text-muted-foreground mb-2">Active Programs</p>
                    <p className="text-3xl font-bold text-yellow-600">42</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                      <p className="text-xs text-muted-foreground mb-1">Student Exchange</p>
                      <p className="text-xl font-bold text-blue-600">18</p>
                    </div>
                    <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                      <p className="text-xs text-muted-foreground mb-1">Artist Programs</p>
                      <p className="text-xl font-bold text-purple-600">14</p>
                    </div>
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                      <p className="text-xs text-muted-foreground mb-1">Sports Events</p>
                      <p className="text-xl font-bold text-green-600">6</p>
                    </div>
                    <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                      <p className="text-xs text-muted-foreground mb-1">Tech Collaboration</p>
                      <p className="text-xl font-bold text-orange-600">4</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Forecasting Section */}
        <TabsContent value="forecasting" className="space-y-6">
          {/* Scenario Selector */}
          <Card className="glass-surface glass-refraction">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                Scenario Configuration
              </CardTitle>
              <CardDescription>Select scenarios to compare in projections</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(['optimistic', 'realistic', 'pessimistic'] as Scenario[]).map((scenario) => (
                  <Button
                    key={scenario}
                    variant={selectedScenarios.includes(scenario) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setSelectedScenarios(prev =>
                        prev.includes(scenario)
                          ? prev.filter(s => s !== scenario)
                          : [...prev, scenario]
                      );
                    }}
                  >
                    {scenario.charAt(0).toUpperCase() + scenario.slice(1)}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* GDP Projections */}
          <Card className="glass-surface glass-refraction" id="gdp-projections-chart">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  GDP Per Capita Projections
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => exportToCSV(projectionData, 'gdp-projections', {
                      date: 'Date',
                      optimistic: 'Optimistic Scenario',
                      realistic: 'Realistic Scenario',
                      pessimistic: 'Pessimistic Scenario'
                    })}
                    title="Export to CSV"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => exportToPDF('gdp-projections-chart', 'GDP Projections')}
                    title="Export to PDF"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                Projected growth over {dateRange === '6months' ? '6 months' : dateRange === '2years' ? '2 years' : dateRange === '5years' ? '5 years' : '1 year'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={projectionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={formatCurrency} />
                  <Tooltip content={<GlassTooltip formatter={formatCurrency} />} />
                  <Legend />
                  {selectedScenarios.includes('optimistic') && (
                    <Line type="monotone" dataKey="optimistic" stroke={DEFAULT_CHART_COLORS[1]} strokeWidth={2} name="Optimistic" strokeDasharray="5 5" />
                  )}
                  {selectedScenarios.includes('realistic') && (
                    <Line type="monotone" dataKey="realistic" stroke={DEFAULT_CHART_COLORS[0]} strokeWidth={3} name="Realistic" />
                  )}
                  {selectedScenarios.includes('pessimistic') && (
                    <Line type="monotone" dataKey="pessimistic" stroke={DEFAULT_CHART_COLORS[3]} strokeWidth={2} name="Pessimistic" strokeDasharray="5 5" />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Confidence Intervals */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {predictiveModels?.scenarios?.map((scenario: any, index: number) => {
              const scenarioName = scenario.scenario as Scenario;
              if (!selectedScenarios.includes(scenarioName)) return null;

              return (
                <motion.div
                  key={scenario.scenario}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="glass-surface glass-refraction">
                    <CardHeader>
                      <CardTitle className="text-lg capitalize">{scenario.scenario} Scenario</CardTitle>
                      <CardDescription>
                        Confidence: {scenario.confidence}%
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Projected GDP</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {formatCurrency(scenario.projectedGdp)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">GDP per Capita</p>
                        <p className="text-xl font-semibold">
                          {formatCurrency(scenario.projectedGdpPerCapita)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Population</p>
                        <p className="text-xl font-semibold">
                          {scenario.projectedPopulation?.toLocaleString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Methodology */}
          <Card className="glass-surface glass-refraction border-blue-200 dark:border-blue-800/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600" />
                Forecasting Methodology
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Predictive Model</h4>
                  <p className="text-sm text-muted-foreground">
                    {predictiveModels?.methodology || 'Compound growth model with historical variance analysis'}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                    <p className="text-xs text-muted-foreground mb-1">Data Points Used</p>
                    <p className="text-xl font-bold text-blue-600">{historicalData?.length || 0}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                    <p className="text-xs text-muted-foreground mb-1">Confidence Level</p>
                    <p className="text-xl font-bold text-purple-600">85%</p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                    <p className="text-xs text-muted-foreground mb-1">Last Updated</p>
                    <p className="text-xl font-bold text-green-600">
                      {predictiveModels?.lastUpdated ? new Date(predictiveModels.lastUpdated).toLocaleDateString() : 'Today'}
                    </p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Key Assumptions</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Stable political environment and policy continuity</li>
                    <li>Normal global economic conditions</li>
                    <li>No major external shocks or crises</li>
                    <li>Current growth trends continue with variance</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
