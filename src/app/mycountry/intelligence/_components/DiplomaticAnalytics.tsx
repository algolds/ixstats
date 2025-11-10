"use client";

/**
 * Diplomatic Analytics Component
 *
 * Comprehensive diplomatic intelligence dashboard showing:
 * - Relationship strength trends over time (real historical data)
 * - Network power growth metrics (real historical data)
 * - Embassy network visualization
 * - Influence distribution analysis
 * - Diplomatic events timeline
 *
 * Uses real time-series data from HistoricalDataCollectionService
 * collected every 3 hours and stored in the database.
 *
 * @module DiplomaticAnalytics
 */

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Globe,
  TrendingUp,
  Network,
  PieChart as PieChartIcon,
  Calendar,
  Activity,
} from "lucide-react";
import { api } from "~/trpc/react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { EmbassyNetworkChart, GlassTooltip } from "~/components/analytics/charts";

interface DiplomaticAnalyticsProps {
  countryId: string;
  countryName: string;
}

export function DiplomaticAnalytics({ countryId, countryName }: DiplomaticAnalyticsProps) {
  // Fetch diplomatic relationships
  const { data: relationships, isLoading: relationshipsLoading } =
    api.diplomatic.getRelationships.useQuery({ countryId });

  // Fetch recent diplomatic changes
  const { data: recentChanges, isLoading: changesLoading } =
    api.diplomatic.getRecentChanges.useQuery({ countryId, hours: 720 }); // Last 30 days

  // Fetch embassy network
  const { data: embassies } = api.diplomatic.getEmbassies.useQuery({ countryId });

  // Fetch historical relationship data (real data from database)
  const { data: relationshipHistory } = api.historical.getRelationshipHistory.useQuery({
    countryId,
    days: 30,
  });

  // Transform historical relationships for time-series visualization
  const relationshipTrends = useMemo(() => {
    if (!relationships || !relationshipHistory || relationshipHistory.length === 0) {
      return { data: [], countries: [] };
    }

    // Get top 5 relationships by current strength
    const topRelationships = relationships
      .slice(0, 5)
      .map((r) => r.targetCountry);

    // Group historical data by date
    const dataByDate = new Map<string, Record<string, number>>();

    relationshipHistory.forEach((entry) => {
      const dateKey = new Date(entry.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      });

      if (!dataByDate.has(dateKey)) {
        dataByDate.set(dateKey, {});
      }

      const dateData = dataByDate.get(dateKey)!;
      if (topRelationships.includes(entry.targetCountry)) {
        dateData[entry.targetCountry] = entry.strength;
      }
    });

    // Convert to chart data format
    const data = Array.from(dataByDate.entries()).map(([date, values]) => ({
      date,
      ...values,
    }));

    return { data, countries: topRelationships };
  }, [relationships, relationshipHistory]);

  // Fetch historical network growth data (real data from database)
  const { data: networkGrowthHistory } = api.historical.getNetworkGrowthHistory.useQuery({
    countryId,
    days: 30,
  });

  // Transform network growth data for visualization
  const networkGrowth = useMemo(() => {
    if (!networkGrowthHistory || networkGrowthHistory.length === 0) {
      return [];
    }

    return networkGrowthHistory.map((entry, index) => ({
      date: new Date(entry.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      }),
      embassies: entry.embassyCount,
      relationships: entry.relationshipCount,
      influence: entry.influence,
      // Add required EconomicChartDataPoint fields (not used by chart but required by type)
      gdp: 0,
      gdpPerCapita: 0,
      population: 0,
      index: index,
    }));
  }, [networkGrowthHistory]);

  // Influence distribution by relationship status
  const influenceDistribution = useMemo(() => {
    if (!relationships) return [];

    const distribution = relationships.reduce((acc: any, rel) => {
      const status = rel.relationship || "neutral";
      if (!acc[status]) {
        acc[status] = { name: status, value: 0, count: 0 };
      }
      acc[status].value += rel.strength;
      acc[status].count += 1;
      return acc;
    }, {});

    return Object.values(distribution);
  }, [relationships]);

  // Diplomatic events timeline
  const diplomaticTimeline = useMemo(() => {
    if (!recentChanges) return [];

    return recentChanges
      .slice(0, 10)
      .map((change) => ({
        id: change.id,
        country: change.targetCountry,
        status: change.currentStatus,
        changeType: change.changeType,
        date: new Date(change.updatedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        description: change.description || `${change.changeType} with ${change.targetCountry}`,
      }));
  }, [recentChanges]);

  // Chart colors
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
  const STATUS_COLORS: Record<string, string> = {
    allied: "#10b981",
    friendly: "#3b82f6",
    neutral: "#6b7280",
    tense: "#f59e0b",
    hostile: "#ef4444",
  };

  if (relationshipsLoading || changesLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="space-y-4 text-center">
          <Activity className="mx-auto h-12 w-12 animate-spin text-blue-600" />
          <p className="text-muted-foreground">Loading diplomatic analytics...</p>
        </div>
      </div>
    );
  }

  if (!relationships || relationships.length === 0) {
    return (
      <Card className="glass-hierarchy-child">
        <CardContent className="flex min-h-[300px] items-center justify-center">
          <div className="text-center space-y-4">
            <Globe className="mx-auto h-16 w-16 text-muted-foreground opacity-50" />
            <div>
              <h3 className="text-lg font-semibold">No Diplomatic Relations</h3>
              <p className="text-muted-foreground text-sm mt-2">
                Establish embassies and build relationships to unlock analytics
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        <Card className="glass-hierarchy-child">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Active Relationships</p>
                <p className="text-3xl font-bold">{relationships.length}</p>
              </div>
              <Globe className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-hierarchy-child">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Avg. Strength</p>
                <p className="text-3xl font-bold">
                  {Math.round(
                    relationships.reduce((sum, r) => sum + r.strength, 0) / relationships.length
                  )}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-hierarchy-child">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Active Embassies</p>
                <p className="text-3xl font-bold">{embassies?.length || 0}</p>
              </div>
              <Network className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-hierarchy-child">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Recent Activity</p>
                <p className="text-3xl font-bold">{recentChanges?.length || 0}</p>
              </div>
              <Calendar className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1">
          <TabsTrigger value="trends" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Trends</span>
          </TabsTrigger>
          <TabsTrigger value="growth" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
            <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Growth</span>
          </TabsTrigger>
          <TabsTrigger value="network" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
            <Network className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Network</span>
          </TabsTrigger>
          <TabsTrigger value="distribution" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
            <PieChartIcon className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Distrib</span>
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Timeline</span>
          </TabsTrigger>
        </TabsList>

        {/* Relationship Strength Trends */}
        <TabsContent value="trends">
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Relationship Strength Trends
              </CardTitle>
              <CardDescription>
                Historical relationship scores with top 5 diplomatic partners (last 30 days)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300} className="sm:h-[350px] lg:h-[400px]">
                <LineChart data={relationshipTrends.data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} className="text-xs" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  {relationshipTrends.countries.map((country, idx) => (
                    <Line
                      key={country}
                      type="monotone"
                      dataKey={country}
                      stroke={COLORS[idx % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Network Power Growth */}
        <TabsContent value="growth">
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-600" />
                Network Power Growth
              </CardTitle>
              <CardDescription>
                Diplomatic influence and network expansion over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300} className="sm:h-[350px] lg:h-[400px]">
                <AreaChart data={networkGrowth}>
                  <defs>
                    <linearGradient id="colorEmbassies" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="colorRelationships" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="colorInfluence" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Area
                    type="monotone"
                    dataKey="embassies"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorEmbassies)"
                    name="Embassies"
                  />
                  <Area
                    type="monotone"
                    dataKey="relationships"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorRelationships)"
                    name="Relationships"
                  />
                  <Area
                    type="monotone"
                    dataKey="influence"
                    stroke="#8b5cf6"
                    fillOpacity={1}
                    fill="url(#colorInfluence)"
                    name="Total Influence"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Embassy Network Map */}
        <TabsContent value="network">
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-purple-600" />
                Embassy Network Visualization
              </CardTitle>
              <CardDescription>
                Visual representation of your diplomatic connections and their strength
              </CardDescription>
            </CardHeader>
            <CardContent>
              {networkGrowth && networkGrowth.length > 0 ? (
                <EmbassyNetworkChart
                  data={networkGrowth}
                  GlassTooltip={GlassTooltip}
                />
              ) : (
                <div className="flex min-h-[400px] items-center justify-center text-muted-foreground">
                  <div className="text-center space-y-2">
                    <Network className="mx-auto h-12 w-12 opacity-50" />
                    <p>No embassy network data available yet</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Influence Distribution */}
        <TabsContent value="distribution">
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-orange-600" />
                Influence Distribution by Relationship Status
              </CardTitle>
              <CardDescription>
                Breakdown of diplomatic influence across relationship categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={250} className="sm:h-[300px] lg:h-[350px]">
                  <PieChart>
                    <Pie
                      data={influenceDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      className="sm:outerRadius-[100px] lg:outerRadius-[120px]"
                    >
                      {influenceDistribution.map((entry: any, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(255, 255, 255, 0.95)",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="space-y-4">
                  <h4 className="font-semibold">Distribution Breakdown</h4>
                  {influenceDistribution.map((item: any) => (
                    <div key={item.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{
                            backgroundColor: STATUS_COLORS[item.name] || "#6b7280",
                          }}
                        />
                        <div>
                          <p className="font-medium capitalize">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{item.count} countries</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{item.value.toFixed(0)}</p>
                        <p className="text-xs text-muted-foreground">influence points</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Diplomatic Events Timeline */}
        <TabsContent value="timeline">
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Diplomatic Events Timeline
              </CardTitle>
              <CardDescription>
                Recent diplomatic milestones and relationship changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {diplomaticTimeline.length > 0 ? (
                <div className="space-y-4">
                  {diplomaticTimeline.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-2 h-2 rounded-full bg-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold">{event.country}</p>
                          <Badge variant="outline" className="text-xs">
                            {event.changeType}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {event.description}
                        </p>
                        <p className="text-xs text-muted-foreground">{event.date}</p>
                      </div>
                      <div className="flex-shrink-0">
                        <Badge
                          className={`${
                            event.status === "allied" || event.status === "friendly"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                              : event.status === "hostile" || event.status === "tense"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
                          }`}
                        >
                          {event.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[300px] items-center justify-center text-muted-foreground">
                  <div className="text-center space-y-2">
                    <Calendar className="mx-auto h-12 w-12 opacity-50" />
                    <p>No recent diplomatic events</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
