"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Globe,
  Target,
  TrendingUp,
  TrendingDown,
  Users,
  Heart,
  Zap,
  AlertTriangle,
  CheckCircle,
  Star,
  Activity,
  ArrowUpRight,
  Shield,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
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
import { DEFAULT_CHART_COLORS } from "~/lib/chart-colors";

interface DiplomaticIntelligenceHubProps {
  countryId: string;
  countryName: string;
}

interface DiplomaticAlert {
  id: string;
  type: "warning" | "opportunity" | "info";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  timestamp: Date;
}

interface StrategicRecommendation {
  id: string;
  title: string;
  description: string;
  type: "treaty" | "trade" | "alliance" | "cultural" | "expansion";
  expectedBenefit: string;
  difficulty: "easy" | "medium" | "hard";
  action: string;
}

interface MissionSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  successChance?: number;
  progress?: number;
  completesAt?: string | Date;
  priority?: string;
  assignedTeam?: string;
  etaHours?: number;
}

export function DiplomaticIntelligenceHub({
  countryId,
  countryName,
}: DiplomaticIntelligenceHubProps) {
  const [activeTab, setActiveTab] = React.useState<
    "overview" | "network" | "missions" | "exchanges"
  >("overview");

  // Fetch diplomatic data with real-time refresh
  const { data: embassies, isLoading: embassiesLoading } = api.diplomatic.getEmbassies.useQuery(
    { countryId },
    {
      refetchInterval: 10000, // Refresh every 10 seconds
      enabled: !!countryId,
    }
  );

  const { data: relationships } = api.diplomatic.getRelationships.useQuery(
    { countryId },
    {
      refetchInterval: 15000,
      enabled: !!countryId,
    }
  );

  // Fetch all missions from all embassies
  const { data: missions } = api.diplomatic.getEmbassies.useQuery(
    { countryId },
    {
      refetchInterval: 12000,
      enabled: !!countryId,
      select: (data): MissionSummary[] => {
        // Extract missions from embassies - would need actual mission data
        // For now return empty array as missions are fetched per embassy
        return [];
      },
    }
  );

  const { data: exchanges } = api.diplomatic.getCulturalExchanges.useQuery(
    { countryId },
    {
      refetchInterval: 15000,
      enabled: !!countryId,
    }
  );

  const { data: recentChanges } = api.diplomatic.getRecentChanges.useQuery(
    { countryId, hours: 24 },
    {
      refetchInterval: 8000,
      enabled: !!countryId,
    }
  );

  const missionList = missions ?? [];

  const activeMissions = useMemo(
    () => missionList.filter((mission) => mission?.status === "active"),
    [missionList]
  );

  const completedMissions = useMemo(
    () => missionList.filter((mission) => mission?.status === "completed"),
    [missionList]
  );

  const averageActiveMissionSuccess = useMemo(() => {
    if (activeMissions.length === 0) {
      return 0;
    }
    const total = activeMissions.reduce((sum, mission) => sum + (mission.successChance ?? 70), 0);
    return Math.round(total / activeMissions.length);
  }, [activeMissions]);

  // Calculate network power metrics
  const networkMetrics = useMemo(() => {
    if (!embassies || !relationships || missions === undefined) {
      return {
        totalPower: 0,
        embassyContribution: 0,
        relationshipContribution: 0,
        missionContribution: 0,
        ranking: "Emerging" as const,
      };
    }

    // Embassy contribution: level * strength * 10
    const embassyContribution = embassies.reduce((sum, embassy) => {
      const level = (embassy as any).level || 1;
      const strength = embassy.strength || 50;
      return sum + level * (strength / 100) * 10;
    }, 0);

    // Relationship contribution: sum of (strength * multiplier based on type)
    const relationshipContribution = relationships.reduce((sum, rel) => {
      const multipliers: Record<string, number> = {
        alliance: 2.0,
        friendly: 1.5,
        neutral: 0.5,
        strained: -0.5,
        hostile: -1.0,
      };
      const multiplier = multipliers[rel.relationship] || 0.5;
      return sum + (rel.strength * multiplier) / 10;
    }, 0);

    // Mission contribution: active missions * average success rate
    const missionContribution = activeMissions.length * (averageActiveMissionSuccess / 10);

    const totalPower = embassyContribution + relationshipContribution + missionContribution;

    // Determine ranking
    let ranking: "Elite" | "Strong" | "Developing" | "Emerging" = "Emerging";
    if (totalPower > 150) ranking = "Elite";
    else if (totalPower > 100) ranking = "Strong";
    else if (totalPower > 50) ranking = "Developing";

    return {
      totalPower: Math.round(totalPower),
      embassyContribution: Math.round(embassyContribution),
      relationshipContribution: Math.round(relationshipContribution),
      missionContribution: Math.round(missionContribution),
      ranking,
    };
  }, [embassies, relationships, missions, activeMissions, averageActiveMissionSuccess]);

  // Generate diplomatic alerts
  const diplomaticAlerts = useMemo((): DiplomaticAlert[] => {
    const alerts: DiplomaticAlert[] = [];

    if (recentChanges && recentChanges.length > 0) {
      recentChanges.slice(0, 5).forEach((change, idx) => {
        const isPositive =
          change.changeType?.includes("improve") || change.changeType?.includes("strengthen");
        alerts.push({
          id: `change-${idx}`,
          type: isPositive ? "opportunity" : "warning",
          title: `Relationship Change: ${change.targetCountry}`,
          description:
            change.description ||
            `Status changed from ${change.previousStatus} to ${change.currentStatus}`,
          priority: change.changeType?.includes("significant") ? "high" : "medium",
          timestamp: new Date(change.updatedAt),
        });
      });
    }

    // Check for low-performing embassies
    if (embassies) {
      embassies.forEach((embassy, idx) => {
        if (embassy.strength < 40) {
          alerts.push({
            id: `weak-embassy-${idx}`,
            type: "warning",
            title: `Weak Embassy: ${embassy.country}`,
            description: `Embassy influence at ${embassy.strength}%. Consider budget allocation or staff expansion.`,
            priority: embassy.strength < 25 ? "high" : "medium",
            timestamp: new Date(),
          });
        }
      });
    }

    // Check for mission opportunities
    if (missions) {
      const completedMissions = missions.filter((m: any) => m.status === "completed");
      if (completedMissions.length > 0) {
        alerts.push({
          id: "missions-completed",
          type: "opportunity",
          title: `${completedMissions.length} Mission${completedMissions.length > 1 ? "s" : ""} Completed`,
          description:
            "Review completed missions and claim rewards to strengthen diplomatic standing.",
          priority: "medium",
          timestamp: new Date(),
        });
      }
    }

    return alerts.slice(0, 8);
  }, [recentChanges, embassies, missions]);

  // Generate strategic recommendations
  const strategicRecommendations = useMemo((): StrategicRecommendation[] => {
    const recommendations: StrategicRecommendation[] = [];

    // Recommend establishing embassies if count is low
    if (embassies && embassies.length < 5) {
      recommendations.push({
        id: "expand-network",
        title: "Expand Embassy Network",
        description: `You have ${embassies.length} embassies. Establishing more embassies increases diplomatic reach and unlocks new mission opportunities.`,
        type: "expansion",
        expectedBenefit: "+15-25 network power per embassy",
        difficulty: "medium",
        action: "Establish new embassy in strategic partner country",
      });
    }

    // Recommend upgrading high-performing embassies
    if (embassies && embassies.some((e) => e.strength > 75 && (e as any).level < 3)) {
      recommendations.push({
        id: "upgrade-embassy",
        title: "Upgrade High-Performing Embassies",
        description:
          "Strong embassies with high influence are ready for upgrades to unlock advanced missions and benefits.",
        type: "expansion",
        expectedBenefit: "+20% mission success rate, +10 network power",
        difficulty: "easy",
        action: "Upgrade embassy to next level",
      });
    }

    // Recommend cultural exchanges
    if (exchanges && exchanges.length < 3) {
      recommendations.push({
        id: "cultural-exchange",
        title: "Launch Cultural Exchange Program",
        description:
          "Cultural exchanges boost relationship strength and provide soft power benefits.",
        type: "cultural",
        expectedBenefit: "+5-10 relationship strength, +cultural influence",
        difficulty: "easy",
        action: "Create cultural exchange with partner country",
      });
    }

    // Recommend trade agreements
    if (
      relationships &&
      relationships.some((r) => r.strength > 70 && (!r.treaties || r.treaties.length === 0))
    ) {
      recommendations.push({
        id: "trade-treaty",
        title: "Formalize Trade Agreements",
        description: "Strong relationships without formal treaties miss economic benefits.",
        type: "trade",
        expectedBenefit: "+15% trade volume, +economic stability",
        difficulty: "medium",
        action: "Negotiate trade treaty with friendly nation",
      });
    }

    // Recommend alliance formation
    if (relationships && relationships.filter((r) => r.relationship === "alliance").length === 0) {
      const strongFriendly = relationships.filter(
        (r) => r.relationship === "friendly" && r.strength > 80
      );
      if (strongFriendly.length > 0) {
        recommendations.push({
          id: "form-alliance",
          title: "Form Strategic Alliance",
          description: `${strongFriendly.length} countries have excellent relations. Consider elevating to formal alliance.`,
          type: "alliance",
          expectedBenefit: "+30 network power, mutual defense pact, shared intelligence",
          difficulty: "hard",
          action: "Propose alliance to highest-strength friendly nation",
        });
      }
    }

    return recommendations.slice(0, 5);
  }, [embassies, relationships, exchanges]);

  // Relationship health matrix data
  const relationshipHealthData = useMemo(() => {
    if (!relationships) return [];

    const strengthBuckets = {
      strong: relationships.filter((r) => r.strength >= 75).length,
      moderate: relationships.filter((r) => r.strength >= 50 && r.strength < 75).length,
      weak: relationships.filter((r) => r.strength >= 25 && r.strength < 50).length,
      critical: relationships.filter((r) => r.strength < 25).length,
    };

    return [
      { name: "Strong (75+)", value: strengthBuckets.strong, color: DEFAULT_CHART_COLORS[1] },
      { name: "Moderate (50-74)", value: strengthBuckets.moderate, color: DEFAULT_CHART_COLORS[0] },
      { name: "Weak (25-49)", value: strengthBuckets.weak, color: DEFAULT_CHART_COLORS[4] },
      { name: "Critical (<25)", value: strengthBuckets.critical, color: DEFAULT_CHART_COLORS[3] },
    ];
  }, [relationships]);

  // Network power trend (mock data - would come from historical tracking)
  const networkPowerTrend = useMemo(() => {
    const now = Date.now();
    return Array.from({ length: 12 }, (_, i) => ({
      date: new Date(now - (11 - i) * 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      power: Math.max(0, networkMetrics.totalPower + Math.sin(i / 2) * 15 - 20 + i * 2),
    }));
  }, [networkMetrics.totalPower]);

  if (embassiesLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="space-y-4 text-center">
          <Activity className="mx-auto h-12 w-12 animate-spin text-purple-600" />
          <p className="text-muted-foreground">Loading diplomatic intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Network Power Overview */}
      <Card className="glass-hierarchy-parent border-purple-200 dark:border-purple-800/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-6 w-6 text-purple-600" />
                Diplomatic Network Power
              </CardTitle>
              <CardDescription>
                Overall strength and reach of your diplomatic operations
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-purple-600">{networkMetrics.totalPower}</div>
              <Badge
                variant="outline"
                className={cn(
                  "mt-1",
                  networkMetrics.ranking === "Elite" &&
                    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300",
                  networkMetrics.ranking === "Strong" &&
                    "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
                  networkMetrics.ranking === "Developing" &&
                    "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300",
                  networkMetrics.ranking === "Emerging" &&
                    "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-300"
                )}
              >
                {networkMetrics.ranking}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 p-4 dark:from-blue-950/20 dark:to-cyan-950/20">
              <div className="mb-2 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <span className="text-muted-foreground text-sm">Embassy Network</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {networkMetrics.embassyContribution}
              </div>
              <div className="text-muted-foreground mt-1 text-xs">
                {embassies?.length || 0} embassies
              </div>
            </div>

            <div className="rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 p-4 dark:from-purple-950/20 dark:to-indigo-950/20">
              <div className="mb-2 flex items-center gap-2">
                <Globe className="h-5 w-5 text-purple-600" />
                <span className="text-muted-foreground text-sm">Relationships</span>
              </div>
              <div className="text-2xl font-bold text-purple-600">
                {networkMetrics.relationshipContribution}
              </div>
              <div className="text-muted-foreground mt-1 text-xs">
                {relationships?.length || 0} connections
              </div>
            </div>

            <div className="rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 p-4 dark:from-green-950/20 dark:to-emerald-950/20">
              <div className="mb-2 flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" />
                <span className="text-muted-foreground text-sm">Active Missions</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {networkMetrics.missionContribution}
              </div>
              <div className="text-muted-foreground mt-1 text-xs">
                {activeMissions.length} in progress
              </div>
            </div>
          </div>

          {/* Network Power Trend Chart */}
          <div className="mt-4">
            <h4 className="mb-3 text-sm font-medium">Network Power Trend</h4>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={networkPowerTrend}>
                <defs>
                  <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9333ea" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#9333ea" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="power"
                  stroke="#9333ea"
                  fill="url(#powerGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for detailed views */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="network">Relationship Matrix</TabsTrigger>
          <TabsTrigger value="missions">Mission Dashboard</TabsTrigger>
          <TabsTrigger value="exchanges">Cultural Programs</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Diplomatic Alerts */}
            <Card className="glass-hierarchy-child">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  Diplomatic Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {diplomaticAlerts.length > 0 ? (
                    diplomaticAlerts.slice(0, 5).map((alert) => (
                      <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn(
                          "rounded-lg border-l-4 p-3",
                          alert.type === "warning" &&
                            "border-orange-500 bg-orange-50 dark:bg-orange-950/20",
                          alert.type === "opportunity" &&
                            "border-green-500 bg-green-50 dark:bg-green-950/20",
                          alert.type === "info" && "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="text-sm font-medium">{alert.title}</div>
                            <div className="text-muted-foreground mt-1 text-xs">
                              {alert.description}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {alert.priority}
                          </Badge>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-muted-foreground py-8 text-center">
                      <CheckCircle className="mx-auto mb-2 h-12 w-12 opacity-50" />
                      <p className="text-sm">No alerts - all systems stable</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Strategic Recommendations */}
            <Card className="glass-hierarchy-child">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  Strategic Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {strategicRecommendations.map((rec) => (
                    <motion.div
                      key={rec.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="cursor-pointer rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 p-3 transition-shadow hover:shadow-md dark:from-purple-950/20 dark:to-indigo-950/20"
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div className="text-sm font-medium">{rec.title}</div>
                        <Badge variant="outline" className="text-xs capitalize">
                          {rec.difficulty}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground mb-2 text-xs">{rec.description}</div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-green-600">{rec.expectedBenefit}</span>
                        <ArrowUpRight className="text-muted-foreground h-3 w-3" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: "Embassies", value: embassies?.length || 0, icon: Building2, color: "blue" },
              {
                label: "Active Missions",
                value: activeMissions.length,
                icon: Target,
                color: "green",
              },
              {
                label: "Cultural Exchanges",
                value: exchanges?.filter((e: any) => e.status === "active").length || 0,
                icon: Heart,
                color: "pink",
              },
              {
                label: "Relationships",
                value: relationships?.length || 0,
                icon: Users,
                color: "purple",
              },
            ].map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="glass-hierarchy-child">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "rounded-lg p-2",
                          stat.color === "blue" && "bg-blue-100 dark:bg-blue-900/20",
                          stat.color === "green" && "bg-green-100 dark:bg-green-900/20",
                          stat.color === "pink" && "bg-pink-100 dark:bg-pink-900/20",
                          stat.color === "purple" && "bg-purple-100 dark:bg-purple-900/20"
                        )}
                      >
                        <stat.icon
                          className={cn(
                            "h-5 w-5",
                            stat.color === "blue" && "text-blue-600",
                            stat.color === "green" && "text-green-600",
                            stat.color === "pink" && "text-pink-600",
                            stat.color === "purple" && "text-purple-600"
                          )}
                        />
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{stat.value}</div>
                        <div className="text-muted-foreground text-xs">{stat.label}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Relationship Matrix Tab */}
        <TabsContent value="network" className="mt-4">
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle>Relationship Health Matrix</CardTitle>
              <CardDescription>Visual distribution of relationship strengths</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={relationshipHealthData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {relationshipHealthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>

              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                {relationships?.slice(0, 6).map((rel) => (
                  <div
                    key={rel.id}
                    className="bg-muted/50 hover:bg-muted rounded-lg p-3 transition-colors"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm font-medium">{rel.targetCountry}</div>
                      <Badge variant="outline" className="text-xs capitalize">
                        {rel.relationship}
                      </Badge>
                    </div>
                    <Progress value={rel.strength} className="h-2" />
                    <div className="text-muted-foreground mt-1 flex items-center justify-between text-xs">
                      <span>Strength: {rel.strength}%</span>
                      <span>{rel.treaties?.length || 0} treaties</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Missions Tab */}
        <TabsContent value="missions" className="mt-4">
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle>Active Mission Dashboard</CardTitle>
              <CardDescription>Track ongoing diplomatic operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                  {
                    label: "In Progress",
                    value: activeMissions.length,
                    color: "blue",
                  },
                  {
                    label: "Avg Success Rate",
                    value: activeMissions.length > 0 ? `${averageActiveMissionSuccess}%` : "0%",
                    color: "green",
                  },
                  {
                    label: "Completed (24h)",
                    value: completedMissions.length,
                    color: "purple",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 p-4 dark:from-gray-800/50 dark:to-gray-900/50"
                  >
                    <div className="text-muted-foreground mb-1 text-sm">{stat.label}</div>
                    <div className="text-2xl font-bold">{stat.value}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {activeMissions.slice(0, 5).map((mission) => (
                  <div
                    key={mission.id}
                    className="border-border hover:bg-muted/50 rounded-lg border p-4 transition-colors"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <div className="font-medium">{mission.name}</div>
                        <div className="text-muted-foreground text-sm">{mission.type}</div>
                      </div>
                      <Badge variant="outline">{mission.successChance}% success</Badge>
                    </div>
                    <Progress value={mission.progress || 0} className="mb-2 h-2" />
                    <div className="text-muted-foreground flex items-center justify-between text-xs">
                      <span>Progress: {Math.round(mission.progress || 0)}%</span>
                      {mission.completesAt && (
                        <span>Completes: {new Date(mission.completesAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cultural Exchanges Tab */}
        <TabsContent value="exchanges" className="mt-4">
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle>Cultural Exchange Tracker</CardTitle>
              <CardDescription>Monitor active cultural programs and their impact</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                  {
                    label: "Active Programs",
                    value: exchanges?.filter((e: any) => e.status === "active").length || 0,
                  },
                  {
                    label: "Total Participants",
                    value:
                      exchanges?.reduce(
                        (sum: number, e: any) => sum + (e.metrics?.participants || 0),
                        0
                      ) || 0,
                  },
                  {
                    label: "Avg Impact",
                    value:
                      exchanges && exchanges.length > 0
                        ? Math.round(
                            exchanges.reduce(
                              (sum: number, e: any) => sum + (e.metrics?.culturalImpact || 0),
                              0
                            ) / exchanges.length
                          )
                        : 0,
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg bg-gradient-to-br from-pink-50 to-purple-50 p-4 dark:from-pink-950/20 dark:to-purple-950/20"
                  >
                    <div className="text-muted-foreground mb-1 text-sm">{stat.label}</div>
                    <div className="text-2xl font-bold">{stat.value}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {exchanges
                  ?.filter((e: any) => e.status === "active")
                  .slice(0, 5)
                  .map((exchange: any) => (
                    <div
                      key={exchange.id}
                      className="border-border hover:bg-muted/50 rounded-lg border p-4 transition-colors"
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div>
                          <div className="font-medium">{exchange.title}</div>
                          <div className="text-muted-foreground text-sm capitalize">
                            {exchange.type}
                          </div>
                        </div>
                        <Badge variant="outline">{exchange.metrics?.culturalImpact || 0}/100</Badge>
                      </div>
                      <div className="text-muted-foreground mb-2 text-xs">
                        {exchange.participatingCountries?.length || 0} countries •{" "}
                        {exchange.metrics?.participants || 0} participants
                      </div>
                      <Progress value={exchange.metrics?.culturalImpact || 0} className="h-2" />
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
