/**
 * Real-Time Intelligence Dashboard
 * Displays live intelligence updates from WebSocket connection
 */

"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Globe,
  Users,
  DollarSign,
  Zap,
  Brain,
  Shield,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { useRealTimeIntelligence } from "~/hooks/useRealTimeIntelligence";
import { formatTrendForIntelligence } from "~/lib/historical-trends";

interface RealTimeIntelligenceDashboardProps {
  countryId: string;
  className?: string;
}

const categoryIcons = {
  economic: DollarSign,
  diplomatic: Globe,
  government: Users,
  crisis: AlertTriangle,
  achievement: CheckCircle,
};

const priorityColors = {
  low: "text-blue-600 bg-blue-50 border-blue-200",
  medium: "text-orange-600 bg-orange-50 border-orange-200",
  high: "text-red-600 bg-red-50 border-red-200",
  critical: "text-red-700 bg-red-100 border-red-300",
};

export function RealTimeIntelligenceDashboard({
  countryId,
  className = "",
}: RealTimeIntelligenceDashboardProps) {
  const { connectionState, latestUpdate, updates, isConnected, clearUpdates } =
    useRealTimeIntelligence({ countryId });

  const [displayedUpdates, setDisplayedUpdates] = useState(updates.slice(0, 10));

  useEffect(() => {
    setDisplayedUpdates(updates.slice(0, 10));
  }, [updates]);

  const getTimeSince = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return `${seconds}s ago`;
    }
  };

  const formatUpdateMessage = (update: any) => {
    if (!update.category || !update.data) return "Intelligence update received";

    switch (update.category) {
      case "economic":
        return `Economic indicator changed: ${update.data.metric || "GDP"} ${update.data.change > 0 ? "increased" : "decreased"}`;
      case "diplomatic":
        return `Diplomatic update: ${update.data.type || "Relations"} status changed`;
      case "government":
        return `Government update: ${update.data.metric || "Approval"} rating updated`;
      case "crisis":
        return `Crisis alert: ${update.data.title || "Situation developing"}`;
      case "achievement":
        return `Achievement unlocked: ${update.data.title || "Goal reached"}`;
      default:
        return "Intelligence update received";
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Connection Status Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Real-Time Intelligence
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
                <div
                  className={`mr-1 h-2 w-2 rounded-full ${
                    isConnected ? "animate-pulse bg-green-400" : "bg-red-400"
                  }`}
                />
                {connectionState.status}
              </Badge>
              {updates.length > 0 && (
                <Button variant="outline" size="sm" onClick={clearUpdates} className="text-xs">
                  Clear ({updates.length})
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div className="text-center">
              <div className="font-mono text-lg">
                {connectionState.lastUpdate ? getTimeSince(connectionState.lastUpdate) : "--"}
              </div>
              <div className="text-muted-foreground">Last Update</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-lg">{updates.length}</div>
              <div className="text-muted-foreground">Total Updates</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-lg">
                {updates.filter((u) => u.priority === "critical").length}
              </div>
              <div className="text-muted-foreground">Critical</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-lg">{connectionState.reconnectAttempts}</div>
              <div className="text-muted-foreground">Reconnects</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Latest Update Highlight */}
      {latestUpdate && latestUpdate.type === "intelligence_update" && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="relative"
        >
          <Card className={`border-l-4 ${priorityColors[latestUpdate.priority || "medium"]}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {latestUpdate.category && (
                  <div className="flex-shrink-0">
                    {React.createElement(
                      categoryIcons[latestUpdate.category as keyof typeof categoryIcons] ||
                        Activity,
                      { className: "h-5 w-5 mt-0.5" }
                    )}
                  </div>
                )}
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium">Latest Update</span>
                    <Badge variant="secondary" className="text-xs">
                      {latestUpdate.category}
                    </Badge>
                    <Badge
                      variant={latestUpdate.priority === "critical" ? "destructive" : "outline"}
                      className="text-xs"
                    >
                      {latestUpdate.priority}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mb-2 text-sm">
                    {formatUpdateMessage(latestUpdate)}
                  </p>
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <Clock className="h-3 w-3" />
                    {latestUpdate.timestamp && getTimeSince(new Date(latestUpdate.timestamp))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Updates Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Intelligence Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 space-y-3 overflow-y-auto">
            <AnimatePresence>
              {displayedUpdates.length > 0 ? (
                displayedUpdates.map((update, index) => {
                  const Icon = update.category
                    ? categoryIcons[update.category as keyof typeof categoryIcons] || Activity
                    : Activity;

                  return (
                    <motion.div
                      key={`${update.timestamp}-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                      className={`rounded-lg border p-3 ${
                        priorityColors[update.priority || "medium"]
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {update.category}
                            </Badge>
                            <span className="text-muted-foreground text-xs">
                              {update.timestamp && getTimeSince(new Date(update.timestamp))}
                            </span>
                          </div>
                          <p className="text-sm">{formatUpdateMessage(update)}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="text-muted-foreground py-8 text-center">
                  <Brain className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p>No intelligence updates yet</p>
                  <p className="text-xs">
                    {isConnected ? "Monitoring for changes..." : "Connect to view updates"}
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
