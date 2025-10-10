"use client";

import React from "react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Progress } from "~/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  BarChart3,
  PieChart,
  Eye
} from "lucide-react";

interface SimplifiedTrendRiskAnalyticsProps {
  countryId: string;
  userId?: string;
}

export function SimplifiedTrendRiskAnalytics({ countryId }: SimplifiedTrendRiskAnalyticsProps) {
  const [activeTab, setActiveTab] = React.useState("overview");

  // Get historical data for trend analysis
  const { data: historicalData, isLoading: historicalLoading } =
    api.countries.getHistoricalData.useQuery(
      { countryId },
      { enabled: !!countryId }
    );

  // Get country data
  const { data: countryData } =
    api.countries.getByIdWithEconomicData.useQuery({ id: countryId });

  const isLoading = historicalLoading;

  // Calculate volatility from historical data
  const volatility = React.useMemo(() => {
    if (!historicalData || historicalData.length < 2) {
      return { gdp: 0, population: 0, overall: 0 };
    }

    const gdpChanges = [];
    const popChanges = [];

    for (let i = 1; i < historicalData.length; i++) {
      const gdpChange = Math.abs(
        (historicalData[i]!.gdpPerCapita - historicalData[i - 1]!.gdpPerCapita) /
        historicalData[i - 1]!.gdpPerCapita
      );
      const popChange = Math.abs(
        (historicalData[i]!.population - historicalData[i - 1]!.population) /
        historicalData[i - 1]!.population
      );

      gdpChanges.push(gdpChange);
      popChanges.push(popChange);
    }

    const avgGdpVolatility = gdpChanges.reduce((a, b) => a + b, 0) / gdpChanges.length;
    const avgPopVolatility = popChanges.reduce((a, b) => a + b, 0) / popChanges.length;

    return {
      gdp: avgGdpVolatility * 100,
      population: avgPopVolatility * 100,
      overall: (avgGdpVolatility + avgPopVolatility) * 50
    };
  }, [historicalData]);

  // Calculate risk factors
  const riskFactors = React.useMemo(() => {
    if (!countryData) return [];

    const factors = [
      {
        name: "Economic Volatility",
        value: Math.min(100, Math.round(volatility.gdp * 10)),
        risk: volatility.gdp > 5 ? 'high' : volatility.gdp > 2 ? 'medium' : 'low',
        description: "GDP per capita volatility"
      },
      {
        name: "Economic Development",
        value: countryData.economicTier === 'Impoverished' ? 80 :
               countryData.economicTier === 'Developing' ? 50 :
               countryData.economicTier === 'Developed' ? 30 : 15,
        risk: countryData.economicTier === 'Impoverished' ? 'high' :
              countryData.economicTier === 'Developing' ? 'medium' : 'low',
        description: "Development stage risk factor"
      },
      {
        name: "Population Stability",
        value: Math.min(100, Math.round(volatility.population * 20)),
        risk: volatility.population > 2 ? 'medium' : 'low',
        description: "Population change volatility"
      },
      {
        name: "Growth Sustainability",
        value: Math.abs(countryData.realGDPGrowthRate || 0) > 0.1 ? 80 :
               Math.abs(countryData.realGDPGrowthRate || 0) > 0.05 ? 50 : 30,
        risk: Math.abs(countryData.realGDPGrowthRate || 0) > 0.1 ? 'high' :
              Math.abs(countryData.realGDPGrowthRate || 0) > 0.05 ? 'medium' : 'low',
        description: "Economic growth rate sustainability"
      }
    ];

    return factors;
  }, [countryData, volatility]);

  const riskDistribution = React.useMemo(() => {
    const distribution = {
      low: riskFactors.filter(f => f.risk === 'low').length,
      medium: riskFactors.filter(f => f.risk === 'medium').length,
      high: riskFactors.filter(f => f.risk === 'high').length,
      critical: riskFactors.filter(f => f.risk === 'critical').length
    };

    return [
      { name: 'Low', value: distribution.low, color: '#10b981' },
      { name: 'Medium', value: distribution.medium, color: '#f59e0b' },
      { name: 'High', value: distribution.high, color: '#ef4444' },
      { name: 'Critical', value: distribution.critical, color: '#dc2626' }
    ];
  }, [riskFactors]);

  const healthScore = React.useMemo(() => {
    const maxScore = riskFactors.length * 100;
    const currentScore = riskFactors.reduce((sum, f) => sum + (100 - f.value), 0);
    return Math.round((currentScore / maxScore) * 100);
  }, [riskFactors]);

  const activeThreats = riskFactors.filter(f => f.risk === 'high' || f.risk === 'critical').length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="trends">Trend Analysis</TabsTrigger>
        <TabsTrigger value="risks">Risk Assessment</TabsTrigger>
        <TabsTrigger value="volatility">Volatility</TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Risk Distribution
              </CardTitle>
              <p className="text-xs text-muted-foreground">Distribution of risk factors by severity</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {riskDistribution.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <Badge variant="outline">{item.value}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Key Performance Indicators
              </CardTitle>
              <p className="text-xs text-muted-foreground">Critical metrics at a glance</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {historicalData?.length || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Data Points</div>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{healthScore}%</div>
                  <div className="text-xs text-muted-foreground">Health Score</div>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{activeThreats}</div>
                  <div className="text-xs text-muted-foreground">Active Threats</div>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{volatility.overall.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">Avg Volatility</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Trend Analysis Tab */}
      <TabsContent value="trends" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Historical Trends</CardTitle>
          </CardHeader>
          <CardContent>
            {historicalData && historicalData.length >= 2 ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">GDP Per Capita Trend</span>
                    <Badge variant={
                      historicalData[historicalData.length - 1]!.gdpPerCapita > historicalData[0]!.gdpPerCapita
                        ? "default" : "destructive"
                    }>
                      {historicalData[historicalData.length - 1]!.gdpPerCapita > historicalData[0]!.gdpPerCapita
                        ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    </Badge>
                  </div>
                  <Progress
                    value={Math.min(100, (historicalData[historicalData.length - 1]!.gdpPerCapita / historicalData[0]!.gdpPerCapita - 1) * 100 + 50)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {((historicalData[historicalData.length - 1]!.gdpPerCapita - historicalData[0]!.gdpPerCapita) / historicalData[0]!.gdpPerCapita * 100).toFixed(2)}% change over {historicalData.length} periods
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Population Trend</span>
                    <Badge variant={
                      historicalData[historicalData.length - 1]!.population > historicalData[0]!.population
                        ? "default" : "destructive"
                    }>
                      {historicalData[historicalData.length - 1]!.population > historicalData[0]!.population
                        ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    </Badge>
                  </div>
                  <Progress
                    value={Math.min(100, (historicalData[historicalData.length - 1]!.population / historicalData[0]!.population - 1) * 100 + 50)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {((historicalData[historicalData.length - 1]!.population - historicalData[0]!.population) / historicalData[0]!.population * 100).toFixed(2)}% change over {historicalData.length} periods
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Insufficient data for trend analysis. More historical data needed.
              </p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Risk Assessment Tab */}
      <TabsContent value="risks" className="space-y-4">
        <div className="space-y-3">
          {riskFactors.map((factor) => (
            <Card key={factor.name}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 ${
                      factor.risk === 'high' ? 'text-red-600' :
                      factor.risk === 'medium' ? 'text-amber-600' : 'text-green-600'
                    }`} />
                    <span className="font-medium">{factor.name}</span>
                  </div>
                  <Badge variant={
                    factor.risk === 'high' ? 'destructive' :
                    factor.risk === 'medium' ? 'outline' : 'default'
                  }>
                    {factor.risk}
                  </Badge>
                </div>
                <Progress value={factor.value} className="mb-2" />
                <p className="text-xs text-muted-foreground">{factor.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      {/* Volatility Tab */}
      <TabsContent value="volatility" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Volatility Analysis
            </CardTitle>
            <p className="text-sm text-muted-foreground">Economic stability and volatility measurements</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">GDP Volatility</span>
                  <span className="text-sm">{volatility.gdp.toFixed(2)}%</span>
                </div>
                <Progress value={Math.min(100, volatility.gdp * 10)} />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Population Volatility</span>
                  <span className="text-sm">{volatility.population.toFixed(2)}%</span>
                </div>
                <Progress value={Math.min(100, volatility.population * 20)} />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Overall Stability</span>
                  <span className="text-sm">{(100 - volatility.overall).toFixed(1)}%</span>
                </div>
                <Progress value={100 - volatility.overall} />
              </div>
              <div className="p-3 border rounded-lg bg-muted/50 mt-4">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Eye className="h-3 w-3" />
                  Volatility measures the degree of variation in economic indicators over time. Higher volatility indicates less predictable economic conditions and increased risk.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
