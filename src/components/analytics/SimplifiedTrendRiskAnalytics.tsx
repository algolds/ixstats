"use client";

import React from "react";
import { motion } from "motion/react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Progress } from "~/components/ui/progress";
import { TrendingUp, TrendingDown, AlertTriangle, Activity, BarChart3, Eye } from "lucide-react";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

const cardHover = {
  scale: 1.01,
  transition: { type: "spring" as const, stiffness: 400, damping: 10 },
};

interface SimplifiedTrendRiskAnalyticsProps {
  countryId: string;
  userId?: string;
}

export function SimplifiedTrendRiskAnalytics({ countryId }: SimplifiedTrendRiskAnalyticsProps) {
  const [activeTab, setActiveTab] = React.useState("overview");

  // Get historical data for trend analysis
  const { data: historicalData, isLoading: historicalLoading } =
    api.historical.getCountryHistory.useQuery({ countryId }, { enabled: !!countryId });

  // Get country data
  const { data: countryData } = api.countries.getByIdWithEconomicData.useQuery({ id: countryId });

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
      overall: (avgGdpVolatility + avgPopVolatility) * 50,
    };
  }, [historicalData]);

  // Calculate risk factors
  const riskFactors = React.useMemo(() => {
    if (!countryData) return [];

    const factors = [
      {
        name: "Economic Volatility",
        value: Math.min(100, Math.round(volatility.gdp * 10)),
        risk: volatility.gdp > 5 ? "high" : volatility.gdp > 2 ? "medium" : "low",
        description: "GDP per capita volatility",
      },
      {
        name: "Economic Development",
        value:
          countryData.economicTier === "Impoverished"
            ? 80
            : countryData.economicTier === "Developing"
              ? 50
              : countryData.economicTier === "Developed"
                ? 30
                : 15,
        risk:
          countryData.economicTier === "Impoverished"
            ? "high"
            : countryData.economicTier === "Developing"
              ? "medium"
              : "low",
        description: "Development stage risk factor",
      },
      {
        name: "Population Stability",
        value: Math.min(100, Math.round(volatility.population * 20)),
        risk: volatility.population > 2 ? "medium" : "low",
        description: "Population change volatility",
      },
      {
        name: "Growth Sustainability",
        value:
          Math.abs(countryData.realGDPGrowthRate || 0) > 0.1
            ? 80
            : Math.abs(countryData.realGDPGrowthRate || 0) > 0.05
              ? 50
              : 30,
        risk:
          Math.abs(countryData.realGDPGrowthRate || 0) > 0.1
            ? "high"
            : Math.abs(countryData.realGDPGrowthRate || 0) > 0.05
              ? "medium"
              : "low",
        description: "Economic growth rate sustainability",
      },
    ];

    return factors;
  }, [countryData, volatility]);

  const riskDistribution = React.useMemo(() => {
    const distribution = {
      low: riskFactors.filter((f) => f.risk === "low").length,
      medium: riskFactors.filter((f) => f.risk === "medium").length,
      high: riskFactors.filter((f) => f.risk === "high").length,
      critical: riskFactors.filter((f) => f.risk === "critical").length,
    };

    return [
      { name: "Low", value: distribution.low, color: "#10b981" },
      { name: "Medium", value: distribution.medium, color: "#f59e0b" },
      { name: "High", value: distribution.high, color: "#ef4444" },
      { name: "Critical", value: distribution.critical, color: "#dc2626" },
    ];
  }, [riskFactors]);

  const healthScore = React.useMemo(() => {
    const maxScore = riskFactors.length * 100;
    const currentScore = riskFactors.reduce((sum, f) => sum + (100 - f.value), 0);
    return Math.round((currentScore / maxScore) * 100);
  }, [riskFactors]);

  const activeThreats = riskFactors.filter(
    (f) => f.risk === "high" || f.risk === "critical"
  ).length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="bg-muted h-32 animate-pulse rounded" />
        <div className="bg-muted h-64 animate-pulse rounded" />
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
        <motion.div
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={itemVariants} whileHover={cardHover}>
            <Card className="h-full border-indigo-200/50 bg-gradient-to-br from-indigo-50/80 to-purple-50/80 dark:border-indigo-700/30 dark:from-indigo-900/20 dark:to-purple-900/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Eye className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Risk Distribution
                </CardTitle>
                <p className="text-muted-foreground text-xs">
                  Distribution of risk factors by severity
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {riskDistribution.map((item, idx) => (
                    <motion.div
                      key={item.name}
                      className="flex items-center justify-between rounded-lg bg-white/50 p-2 dark:bg-black/20"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full shadow-sm"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <Badge variant="outline" className="font-bold">
                        {item.value}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants} whileHover={cardHover}>
            <Card className="h-full border-cyan-200/50 bg-gradient-to-br from-cyan-50/80 to-blue-50/80 dark:border-cyan-700/30 dark:from-cyan-900/20 dark:to-blue-900/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <BarChart3 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  Key Performance Indicators
                </CardTitle>
                <p className="text-muted-foreground text-xs">Critical metrics at a glance</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <motion.div
                    className="rounded-xl border border-blue-200/50 bg-gradient-to-br from-blue-100 to-blue-50 p-3 text-center shadow-sm dark:border-blue-700/30 dark:from-blue-900/30 dark:to-blue-800/20"
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      {historicalData?.length || 0}
                    </div>
                    <div className="text-muted-foreground text-xs">Data Points</div>
                  </motion.div>
                  <motion.div
                    className="rounded-xl border border-green-200/50 bg-gradient-to-br from-green-100 to-emerald-50 p-3 text-center shadow-sm dark:border-green-700/30 dark:from-green-900/30 dark:to-emerald-800/20"
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="text-xl font-bold text-green-600 dark:text-green-400">
                      {healthScore}%
                    </div>
                    <div className="text-muted-foreground text-xs">Health Score</div>
                  </motion.div>
                  <motion.div
                    className="rounded-xl border border-purple-200/50 bg-gradient-to-br from-purple-100 to-violet-50 p-3 text-center shadow-sm dark:border-purple-700/30 dark:from-purple-900/30 dark:to-violet-800/20"
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                      {activeThreats}
                    </div>
                    <div className="text-muted-foreground text-xs">Active Threats</div>
                  </motion.div>
                  <motion.div
                    className="rounded-xl border border-red-200/50 bg-gradient-to-br from-red-100 to-rose-50 p-3 text-center shadow-sm dark:border-red-700/30 dark:from-red-900/30 dark:to-rose-800/20"
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="text-xl font-bold text-red-600 dark:text-red-400">
                      {volatility.overall.toFixed(1)}%
                    </div>
                    <div className="text-muted-foreground text-xs">Avg Volatility</div>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </TabsContent>

      {/* Trend Analysis Tab */}
      <TabsContent value="trends" className="space-y-4">
        <motion.div variants={containerVariants} initial="hidden" animate="show">
          <motion.div variants={itemVariants} whileHover={cardHover}>
            <Card className="border-emerald-200/50 bg-gradient-to-br from-emerald-50/80 to-teal-50/80 dark:border-emerald-700/30 dark:from-emerald-900/20 dark:to-teal-900/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Historical Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                {historicalData && historicalData.length >= 2 ? (
                  <div className="space-y-4">
                    <motion.div
                      className="rounded-xl border border-blue-200/50 bg-gradient-to-br from-blue-50 to-cyan-50 p-4 dark:border-blue-700/30 dark:from-blue-900/20 dark:to-cyan-900/20"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                          GDP Per Capita Trend
                        </span>
                        <Badge
                          variant={
                            historicalData[historicalData.length - 1]!.gdpPerCapita >
                            historicalData[0]!.gdpPerCapita
                              ? "default"
                              : "destructive"
                          }
                          className="gap-1"
                        >
                          {historicalData[historicalData.length - 1]!.gdpPerCapita >
                          historicalData[0]!.gdpPerCapita ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          <span className="text-xs">
                            {(
                              ((historicalData[historicalData.length - 1]!.gdpPerCapita -
                                historicalData[0]!.gdpPerCapita) /
                                historicalData[0]!.gdpPerCapita) *
                              100
                            ).toFixed(1)}
                            %
                          </span>
                        </Badge>
                      </div>
                      <Progress
                        value={Math.min(
                          100,
                          (historicalData[historicalData.length - 1]!.gdpPerCapita /
                            historicalData[0]!.gdpPerCapita -
                            1) *
                            100 +
                            50
                        )}
                        className="h-3"
                      />
                      <p className="text-muted-foreground mt-2 text-xs">
                        Over {historicalData.length} periods
                      </p>
                    </motion.div>
                    <motion.div
                      className="rounded-xl border border-purple-200/50 bg-gradient-to-br from-purple-50 to-violet-50 p-4 dark:border-purple-700/30 dark:from-purple-900/20 dark:to-violet-900/20"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-purple-700 dark:text-purple-400">
                          Population Trend
                        </span>
                        <Badge
                          variant={
                            historicalData[historicalData.length - 1]!.population >
                            historicalData[0]!.population
                              ? "default"
                              : "destructive"
                          }
                          className="gap-1"
                        >
                          {historicalData[historicalData.length - 1]!.population >
                          historicalData[0]!.population ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          <span className="text-xs">
                            {(
                              ((historicalData[historicalData.length - 1]!.population -
                                historicalData[0]!.population) /
                                historicalData[0]!.population) *
                              100
                            ).toFixed(1)}
                            %
                          </span>
                        </Badge>
                      </div>
                      <Progress
                        value={Math.min(
                          100,
                          (historicalData[historicalData.length - 1]!.population /
                            historicalData[0]!.population -
                            1) *
                            100 +
                            50
                        )}
                        className="h-3"
                      />
                      <p className="text-muted-foreground mt-2 text-xs">
                        Over {historicalData.length} periods
                      </p>
                    </motion.div>
                  </div>
                ) : (
                  <p className="text-muted-foreground py-4 text-center text-sm">
                    Insufficient data for trend analysis. More historical data needed.
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </TabsContent>

      {/* Risk Assessment Tab */}
      <TabsContent value="risks" className="space-y-4">
        <motion.div
          className="space-y-3"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          // eslint-disable-next-line unused-imports/no-unused-vars
          {riskFactors.map((factor, _idx) => (
            <motion.div key={factor.name} variants={itemVariants} whileHover={cardHover}>
              <Card
                className={`${
                  factor.risk === "high"
                    ? "border-red-200/50 bg-gradient-to-br from-red-50/80 to-rose-50/80 dark:border-red-700/30 dark:from-red-900/20 dark:to-rose-900/20"
                    : factor.risk === "medium"
                      ? "border-amber-200/50 bg-gradient-to-br from-amber-50/80 to-yellow-50/80 dark:border-amber-700/30 dark:from-amber-900/20 dark:to-yellow-900/20"
                      : "border-green-200/50 bg-gradient-to-br from-green-50/80 to-emerald-50/80 dark:border-green-700/30 dark:from-green-900/20 dark:to-emerald-900/20"
                }`}
              >
                <CardContent className="pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        className={`h-4 w-4 ${
                          factor.risk === "high"
                            ? "text-red-600 dark:text-red-400"
                            : factor.risk === "medium"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-green-600 dark:text-green-400"
                        }`}
                      />
                      <span className="font-semibold">{factor.name}</span>
                    </div>
                    <Badge
                      variant={
                        factor.risk === "high"
                          ? "destructive"
                          : factor.risk === "medium"
                            ? "outline"
                            : "default"
                      }
                    >
                      {factor.risk.toUpperCase()}
                    </Badge>
                  </div>
                  <Progress value={factor.value} className="mb-2 h-2" />
                  <p className="text-muted-foreground text-xs">{factor.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </TabsContent>

      {/* Volatility Tab */}
      <TabsContent value="volatility" className="space-y-4">
        <motion.div variants={containerVariants} initial="hidden" animate="show">
          <motion.div variants={itemVariants} whileHover={cardHover}>
            <Card className="border-orange-200/50 bg-gradient-to-br from-orange-50/80 to-amber-50/80 dark:border-orange-700/30 dark:from-orange-900/20 dark:to-amber-900/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  Volatility Analysis
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  Economic stability and volatility measurements
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <motion.div
                    className="rounded-xl border border-blue-200/50 bg-gradient-to-br from-blue-50 to-cyan-50 p-4 dark:border-blue-700/30 dark:from-blue-900/20 dark:to-cyan-900/20"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                        GDP Volatility
                      </span>
                      <Badge variant="outline" className="font-bold">
                        {volatility.gdp.toFixed(2)}%
                      </Badge>
                    </div>
                    <Progress value={Math.min(100, volatility.gdp * 10)} className="h-3" />
                  </motion.div>
                  <motion.div
                    className="rounded-xl border border-purple-200/50 bg-gradient-to-br from-purple-50 to-violet-50 p-4 dark:border-purple-700/30 dark:from-purple-900/20 dark:to-violet-900/20"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-purple-700 dark:text-purple-400">
                        Population Volatility
                      </span>
                      <Badge variant="outline" className="font-bold">
                        {volatility.population.toFixed(2)}%
                      </Badge>
                    </div>
                    <Progress value={Math.min(100, volatility.population * 20)} className="h-3" />
                  </motion.div>
                  <motion.div
                    className="rounded-xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-green-50 p-4 dark:border-emerald-700/30 dark:from-emerald-900/20 dark:to-green-900/20"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                        Overall Stability
                      </span>
                      <Badge variant="default" className="bg-emerald-500 font-bold">
                        {(100 - volatility.overall).toFixed(1)}%
                      </Badge>
                    </div>
                    <Progress value={100 - volatility.overall} className="h-3" />
                  </motion.div>
                  <motion.div
                    className="bg-muted/50 mt-4 rounded-lg border p-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <p className="text-muted-foreground flex items-center gap-2 text-xs">
                      <Eye className="h-3 w-3" />
                      Volatility measures the degree of variation in economic indicators over time.
                      Higher volatility indicates less predictable economic conditions and increased
                      risk.
                    </p>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </TabsContent>
    </Tabs>
  );
}
