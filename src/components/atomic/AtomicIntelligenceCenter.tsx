"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  AlertCircle,
  TrendingUp,
  Target,
  Lightbulb,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";
import { useAtomicIntelligence, useAtomicState } from "./AtomicStateProvider";

interface AtomicIntelligenceCenterProps {
  variant?: "compact" | "detailed" | "dashboard";
  className?: string;
}

interface IntelligenceFeedItemProps {
  feed: {
    id: string;
    type: "opportunity" | "risk" | "trend" | "alert";
    title: string;
    description: string;
    impact: "low" | "medium" | "high" | "critical";
    source: "atomic_analysis" | "economic_model" | "comparative_analysis";
    timestamp: number;
    actionable: boolean;
  };
  onDismiss?: (id: string) => void;
}

function IntelligenceFeedItem({ feed, onDismiss }: IntelligenceFeedItemProps) {
  const typeConfig = {
    opportunity: {
      icon: <TrendingUp className="h-4 w-4" />,
      color: "text-green-600",
      bgColor: "bg-green-50 border-green-200",
      label: "Opportunity",
    },
    risk: {
      icon: <AlertCircle className="h-4 w-4" />,
      color: "text-red-600",
      bgColor: "bg-red-50 border-red-200",
      label: "Risk Alert",
    },
    trend: {
      icon: <Activity className="h-4 w-4" />,
      color: "text-blue-600",
      bgColor: "bg-blue-50 border-blue-200",
      label: "Trend Analysis",
    },
    alert: {
      icon: <Zap className="h-4 w-4" />,
      color: "text-orange-600",
      bgColor: "bg-orange-50 border-orange-200",
      label: "System Alert",
    },
  };

  const impactConfig = {
    low: "bg-gray-100 text-gray-700",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-orange-100 text-orange-800",
    critical: "bg-red-100 text-red-800",
  };

  const config = typeConfig[feed.type];
  const timeAgo = Math.floor((Date.now() - feed.timestamp) / 1000 / 60); // minutes ago

  return (
    <motion.div
      className={cn("rounded-lg border p-4 transition-all", config.bgColor)}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      whileHover={{ scale: 1.01 }}
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center space-x-2">
          <div className={cn("rounded p-1", config.color)}>{config.icon}</div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              {config.label}
            </Badge>
            <Badge className={cn("text-xs", impactConfig[feed.impact])}>
              {feed.impact.toUpperCase()}
            </Badge>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <div className="text-muted-foreground flex items-center space-x-1 text-xs">
            <Clock className="h-3 w-3" />
            <span>{timeAgo}m ago</span>
          </div>
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDismiss(feed.id)}
              className="h-6 w-6 p-0"
            >
              <XCircle className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-foreground font-medium">{feed.title}</h4>
        <p className="text-muted-foreground text-sm">{feed.description}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-muted-foreground">Source:</span>
            <span className="font-medium capitalize">{feed.source.replace("_", " ")}</span>
          </div>

          {feed.actionable && (
            <Badge
              variant="outline"
              className="bg-primary/5 border-primary/20 text-primary text-xs"
            >
              <Target className="mr-1 h-3 w-3" />
              Actionable
            </Badge>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function AtomicIntelligenceCenter({
  variant = "detailed",
  className,
}: AtomicIntelligenceCenterProps) {
  const { intelligenceFeeds, realTimeMetrics } = useAtomicIntelligence();
  const { state, getSystemHealth } = useAtomicState();
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [dismissedFeeds, setDismissedFeeds] = useState<Set<string>>(new Set());

  const systemHealth = getSystemHealth();

  // Filter and sort intelligence feeds
  const filteredFeeds = useMemo(() => {
    let filtered = intelligenceFeeds.filter((feed) => !dismissedFeeds.has(feed.id));

    if (activeFilter !== "all") {
      filtered = filtered.filter((feed) => feed.type === activeFilter);
    }

    return filtered.sort((a, b) => {
      // Sort by impact first (critical -> high -> medium -> low)
      const impactOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const impactDiff = impactOrder[b.impact] - impactOrder[a.impact];
      if (impactDiff !== 0) return impactDiff;

      // Then by timestamp (most recent first)
      return b.timestamp - a.timestamp;
    });
  }, [intelligenceFeeds, activeFilter, dismissedFeeds]);

  const feedCounts = useMemo(() => {
    const counts = { all: 0, opportunity: 0, risk: 0, trend: 0, alert: 0 };
    intelligenceFeeds.forEach((feed) => {
      if (!dismissedFeeds.has(feed.id)) {
        counts.all++;
        counts[feed.type]++;
      }
    });
    return counts;
  }, [intelligenceFeeds, dismissedFeeds]);

  const handleDismissFeed = (feedId: string) => {
    setDismissedFeeds((prev) => new Set([...prev, feedId]));
  };

  if (variant === "compact") {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Brain className="text-primary h-5 w-5" />
            Intelligence
          </h3>
          <Badge variant={systemHealth.overall === "excellent" ? "default" : "secondary"}>
            {systemHealth.overall.toUpperCase()}
          </Badge>
        </div>

        <div className="space-y-2">
          {filteredFeeds.slice(0, 3).map((feed) => (
            <IntelligenceFeedItem key={feed.id} feed={feed} />
          ))}
        </div>

        {filteredFeeds.length > 3 && (
          <Button variant="outline" size="sm" className="w-full">
            View {filteredFeeds.length - 3} More Updates
          </Button>
        )}
      </div>
    );
  }

  if (variant === "dashboard") {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="text-primary h-5 w-5" />
            <h2 className="text-xl font-semibold">Intelligence Center</h2>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary">
              Real-time Analysis
            </Badge>
            <Badge variant={systemHealth.overall === "excellent" ? "default" : "secondary"}>
              System: {systemHealth.overall.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Quick metrics */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card className="p-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div>
                <div className="text-lg font-bold text-green-600">{feedCounts.opportunity}</div>
                <div className="text-muted-foreground text-xs">Opportunities</div>
              </div>
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <div>
                <div className="text-lg font-bold text-red-600">{feedCounts.risk}</div>
                <div className="text-muted-foreground text-xs">Risk Alerts</div>
              </div>
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-blue-600" />
              <div>
                <div className="text-lg font-bold text-blue-600">{feedCounts.trend}</div>
                <div className="text-muted-foreground text-xs">Trends</div>
              </div>
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-orange-600" />
              <div>
                <div className="text-lg font-bold text-orange-600">{feedCounts.alert}</div>
                <div className="text-muted-foreground text-xs">System Alerts</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Intelligence feeds */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Live Intelligence Feed</CardTitle>
              <div className="flex items-center space-x-2">
                <Filter className="text-muted-foreground h-4 w-4" />
                <Tabs value={activeFilter} onValueChange={setActiveFilter}>
                  <TabsList className="h-8">
                    <TabsTrigger value="all" className="text-xs">
                      All ({feedCounts.all})
                    </TabsTrigger>
                    <TabsTrigger value="opportunity" className="text-xs">
                      Opportunities
                    </TabsTrigger>
                    <TabsTrigger value="risk" className="text-xs">
                      Risks
                    </TabsTrigger>
                    <TabsTrigger value="trend" className="text-xs">
                      Trends
                    </TabsTrigger>
                    <TabsTrigger value="alert" className="text-xs">
                      Alerts
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 space-y-3 overflow-y-auto">
              <AnimatePresence>
                {filteredFeeds.length > 0 ? (
                  filteredFeeds.map((feed) => (
                    <IntelligenceFeedItem key={feed.id} feed={feed} onDismiss={handleDismissFeed} />
                  ))
                ) : (
                  <div className="text-muted-foreground py-8 text-center">
                    <Brain className="mx-auto mb-2 h-12 w-12 opacity-50" />
                    <p>No intelligence feeds available</p>
                    <p className="text-sm">
                      Intelligence will appear as your atomic components generate insights
                    </p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Detailed view (default)
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <Brain className="text-primary h-6 w-6" />
            Atomic Intelligence Center
          </h2>
          <p className="text-muted-foreground">
            AI-powered insights from your atomic government components
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary">
            {state.selectedComponents.length} Components Active
          </Badge>
          <Badge variant={systemHealth.overall === "excellent" ? "default" : "secondary"}>
            System Health: {systemHealth.overall.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* System health overview */}
      <Card className="from-primary/5 to-purple/5 border-primary/20 bg-gradient-to-r">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckCircle className="text-primary h-5 w-5" />
            System Health Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-primary text-2xl font-bold">
                {systemHealth.scores.effectiveness}%
              </div>
              <div className="text-muted-foreground text-xs">Effectiveness</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {systemHealth.scores.economicPerformance.toFixed(0)}%
              </div>
              <div className="text-muted-foreground text-xs">Economic Performance</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {systemHealth.scores.governmentCapacity}%
              </div>
              <div className="text-muted-foreground text-xs">Government Capacity</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {systemHealth.scores.stability}%
              </div>
              <div className="text-muted-foreground text-xs">Stability</div>
            </div>
          </div>

          {/* Issues and recommendations */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {systemHealth.issues.length > 0 && (
              <div>
                <h4 className="mb-2 font-medium text-red-600">System Issues</h4>
                <ul className="space-y-1">
                  {systemHealth.issues.map((issue, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <AlertCircle className="h-3 w-3 text-red-600" />
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {systemHealth.recommendations.length > 0 && (
              <div>
                <h4 className="mb-2 font-medium text-blue-600">Recommendations</h4>
                <ul className="space-y-1">
                  {systemHealth.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <Lightbulb className="h-3 w-3 text-blue-600" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Intelligence feeds with tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Live Intelligence Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeFilter} onValueChange={setActiveFilter}>
            <TabsList>
              <TabsTrigger value="all">All Feeds ({feedCounts.all})</TabsTrigger>
              <TabsTrigger value="opportunity">
                Opportunities ({feedCounts.opportunity})
              </TabsTrigger>
              <TabsTrigger value="risk">Risks ({feedCounts.risk})</TabsTrigger>
              <TabsTrigger value="trend">Trends ({feedCounts.trend})</TabsTrigger>
              <TabsTrigger value="alert">Alerts ({feedCounts.alert})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeFilter} className="mt-4">
              <div className="max-h-[600px] space-y-4 overflow-y-auto">
                <AnimatePresence>
                  {filteredFeeds.length > 0 ? (
                    filteredFeeds.map((feed) => (
                      <IntelligenceFeedItem
                        key={feed.id}
                        feed={feed}
                        onDismiss={handleDismissFeed}
                      />
                    ))
                  ) : (
                    <div className="text-muted-foreground py-12 text-center">
                      <Brain className="mx-auto mb-4 h-16 w-16 opacity-50" />
                      <h3 className="mb-2 text-lg font-medium">No Intelligence Available</h3>
                      <p className="mx-auto max-w-md">
                        Your atomic components will generate intelligence insights as they analyze
                        your government's performance and identify opportunities for improvement.
                      </p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
