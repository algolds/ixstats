"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Crown,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Zap,
  Calendar,
  Globe2,
  BarChart3,
  Users,
  DollarSign,
  Shield,
  Building2,
  Activity,
} from "lucide-react";

// Icon lookup for string-based icon resolution
const icons: Record<string, any> = {
  Crown,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Zap,
  Calendar,
  Globe2,
  BarChart3,
  Users,
  DollarSign,
  Shield,
  Building: Building2,
  Activity,
  TrendingUp2: TrendingUp,
};

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Separator } from "~/components/ui/separator";

// Use standardized CriticalAlert from unified interfaces
import type { CriticalAlert } from "~/types/intelligence-unified";

interface Opportunity {
  id: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  timeframe: string;
  category: "economic" | "diplomatic" | "social" | "governance";
}

interface LeadershipMetric {
  id: string;
  label: string;
  value: number | string;
  trend: "up" | "down" | "stable";
  change: string;
  icon: React.ElementType;
  format: "number" | "percentage" | "currency" | "text";
}

interface Opportunity {
  id: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  timeframe: string;
  category: "economic" | "social" | "diplomatic" | "governance";
}

interface TemporalContext {
  currentGameYear: number;
  currentIxTime: number;
  nextMajorEvent: {
    title: string;
    description: string;
    timeUntil: string;
    type: "economic" | "diplomatic" | "crisis" | "opportunity";
  } | null;
  recentChanges: Array<{
    id: string;
    title: string;
    impact: string;
    timestamp: number;
    type: "policy" | "economic" | "diplomatic" | "crisis";
  }>;
  timeAcceleration: number; // IxTime multiplier
}

interface ExecutiveSummaryProps {
  nationalHealth: {
    overallScore: number; // 0-100 composite score
    trendDirection: "up" | "down" | "stable";
    criticalAlerts: CriticalAlert[];
    keyOpportunities: Opportunity[];
  };
  leadershipMetrics: LeadershipMetric[];
  temporalContext: TemporalContext;
  countryName: string;
  countryFlag?: string;
  isOwner?: boolean;
  className?: string;
}

function getTrendIcon(trend: "up" | "down" | "stable", size = 16) {
  const props = {
    size,
    className:
      trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-yellow-600",
  };

  switch (trend) {
    case "up":
      return <TrendingUp {...props} />;
    case "down":
      return <TrendingDown {...props} />;
    case "stable":
      return <Minus {...props} />;
  }
}

function getAlertIcon(severity: "critical" | "high" | "medium" | "low") {
  switch (severity) {
    case "critical":
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    case "high":
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case "medium":
      return <Zap className="h-4 w-4 text-blue-600" />;
    case "low":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
  }
}

function getOpportunityIcon(category: Opportunity["category"]) {
  switch (category) {
    case "economic":
      return <DollarSign className="h-4 w-4 text-green-600" />;
    case "diplomatic":
      return <Globe2 className="h-4 w-4 text-blue-600" />;
    case "social":
      return <Users className="h-4 w-4 text-purple-600" />;
    case "governance":
      return <Shield className="h-4 w-4 text-orange-600" />;
  }
}

interface ExecutiveSummaryProps {
  nationalHealth: {
    overallScore: number;
    trendDirection: "up" | "down" | "stable";
    criticalAlerts: CriticalAlert[];
    keyOpportunities: Opportunity[];
  };
  leadershipMetrics: LeadershipMetric[];
  temporalContext: TemporalContext;
  countryName: string;
  countryFlag?: string;
  isOwner?: boolean;
  className?: string;
}

function formatMetricValue(value: number | string, format: LeadershipMetric["format"]) {
  if (typeof value === "string") return value;

  switch (format) {
    case "currency":
      return `$${value.toLocaleString()}`;
    case "percentage":
      return `${value}%`;
    case "number":
      return value.toLocaleString();
    default:
      return value.toString();
  }
}

export function ExecutiveSummary({
  nationalHealth,
  leadershipMetrics,
  temporalContext,
  countryName,
  countryFlag,
  isOwner = false,
  className = "",
}: ExecutiveSummaryProps) {
  const getHealthStatus = (score: number) => {
    if (score >= 85)
      return {
        label: "Excellent",
        color: "text-green-600",
        bg: "bg-green-50 dark:bg-green-950/20",
      };
    if (score >= 70)
      return { label: "Good", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" };
    if (score >= 50)
      return {
        label: "Moderate",
        color: "text-yellow-600",
        bg: "bg-yellow-50 dark:bg-yellow-950/20",
      };
    if (score >= 30)
      return {
        label: "Concerning",
        color: "text-orange-600",
        bg: "bg-orange-50 dark:bg-orange-950/20",
      };
    return { label: "Critical", color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20" };
  };

  const healthStatus = getHealthStatus(nationalHealth.overallScore);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      className={className}
    >
      <Card className="glass-hierarchy-parent overflow-hidden border-0 border-l-4 border-l-amber-600 bg-gradient-to-br from-amber-700/15 via-amber-600/10 to-amber-400/5">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {countryFlag && (
                <div className="h-8 w-12 overflow-hidden rounded border shadow-sm">
                  <img
                    src={countryFlag}
                    alt={`${countryName} flag`}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div>
                <CardTitle className="flex items-center gap-3 text-2xl font-bold">
                  <Crown className="h-6 w-6 text-amber-600" />
                  {isOwner ? `MyCountry: ${countryName}` : countryName}
                  <Badge variant="outline" className="text-xs">
                    Executive Dashboard
                  </Badge>
                </CardTitle>
                <p className="text-muted-foreground mt-1">
                  National Command Interface • Real-time Intelligence
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="mb-2 flex items-center gap-2">
                <div className={`text-3xl font-bold text-amber-700`}>
                  {nationalHealth.overallScore}%
                </div>
                {getTrendIcon(nationalHealth.trendDirection, 24)}
              </div>
              <Badge className={`${healthStatus.bg} ${healthStatus.color} border-0`}>
                {healthStatus.label}
              </Badge>
            </div>
          </div>

          {/* Overall Health Progress */}
          <div className="mt-4">
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-muted-foreground">National Health Score</span>
              <span className="font-medium">{nationalHealth.overallScore}/100</span>
            </div>
            <Progress
              value={nationalHealth.overallScore}
              className="h-3 bg-amber-100 dark:bg-amber-950/20"
              style={{
                background: "linear-gradient(90deg, #FEF3C7 0%, #FDE68A 100%)",
              }}
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Critical Alerts */}
          {nationalHealth.criticalAlerts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                Critical Alerts ({nationalHealth.criticalAlerts.length})
              </div>
              <div className="space-y-2">
                {nationalHealth.criticalAlerts.slice(0, 3).map((alert, index) => (
                  <div
                    key={
                      alert.id && alert.id.trim()
                        ? `alert-${alert.id.trim()}`
                        : `alert-fallback-${index}`
                    }
                    className={`glass-hierarchy-child rounded-lg border-l-4 p-3 ${
                      alert.severity === "critical"
                        ? "border-l-red-500 bg-red-50/50 dark:bg-red-950/20"
                        : alert.severity === "high"
                          ? "border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20"
                          : "border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {getAlertIcon(alert.severity)}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{alert.title}</div>
                        <div className="text-muted-foreground mt-1 text-xs">{alert.message}</div>
                        {alert.actionRequired && (
                          <Badge variant="destructive" className="mt-2 text-xs">
                            Action Required
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Leadership Metrics */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4 text-amber-600" />
              Leadership Dashboard
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {leadershipMetrics.map((metric, index) => {
                const iconName = typeof metric.icon === "string" ? metric.icon : "BarChart3";
                const Icon = icons[iconName] || icons.BarChart3;
                return (
                  <motion.div
                    key={
                      metric.id && metric.id.trim()
                        ? `metric-${metric.id.trim()}`
                        : `metric-fallback-${index}`
                    }
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="glass-hierarchy-child cursor-pointer rounded-lg p-3 text-center transition-transform hover:scale-105"
                  >
                    <div className="mb-2 flex items-center justify-center gap-2">
                      <Icon className="h-4 w-4 text-amber-600" />
                      {getTrendIcon(metric.trend, 14)}
                    </div>
                    <div className="text-lg font-bold">
                      {formatMetricValue(metric.value, metric.format)}
                    </div>
                    <div className="text-muted-foreground text-xs">{metric.label}</div>
                    <div className="mt-1 text-xs text-amber-600">{metric.change}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Temporal Context */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4 text-amber-600" />
              Temporal Intelligence
            </div>
            <div className="glass-hierarchy-child space-y-3 rounded-lg p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-amber-700">
                    {temporalContext.currentGameYear}
                  </div>
                  <div className="text-muted-foreground text-xs">Game Year</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-amber-700">
                    {temporalContext.timeAcceleration}x
                  </div>
                  <div className="text-muted-foreground text-xs">Time Acceleration</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-amber-700">
                    {Math.floor(temporalContext.currentIxTime / (1000 * 60 * 60 * 24))}d
                  </div>
                  <div className="text-muted-foreground text-xs">Days Elapsed</div>
                </div>
              </div>

              {temporalContext.nextMajorEvent && (
                <div className="border-border border-t pt-3">
                  <div className="flex items-start gap-3">
                    <Target className="mt-0.5 h-4 w-4 text-amber-600" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {temporalContext.nextMajorEvent.title}
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">
                        {temporalContext.nextMajorEvent.description}
                      </div>
                      <Badge variant="outline" className="mt-2 text-xs">
                        {temporalContext.nextMajorEvent.timeUntil}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Key Opportunities */}
          {nationalHealth.keyOpportunities.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Zap className="h-4 w-4 text-amber-600" />
                Strategic Opportunities
              </div>
              <div className="space-y-2">
                {nationalHealth.keyOpportunities.slice(0, 3).map((opportunity, index) => (
                  <div
                    key={
                      opportunity.id && opportunity.id.trim()
                        ? `opportunity-${opportunity.id.trim()}`
                        : `opportunity-fallback-${index}`
                    }
                    className="glass-hierarchy-child cursor-pointer rounded-lg p-3 transition-transform hover:scale-102"
                  >
                    <div className="flex items-start gap-3">
                      {getOpportunityIcon(opportunity.category)}
                      <div className="flex-1">
                        <div className="text-sm font-medium">{opportunity.title}</div>
                        <div className="text-muted-foreground mt-1 text-xs">
                          {opportunity.description}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {opportunity.impact} impact
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {opportunity.timeframe}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Changes */}
          {temporalContext.recentChanges.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-amber-600" />
                Recent Changes
              </div>
              <div className="space-y-2">
                {temporalContext.recentChanges.slice(0, 3).map((change, index) => (
                  <div
                    key={
                      change.id && change.id.trim()
                        ? `change-${change.id.trim()}`
                        : `change-fallback-${index}`
                    }
                    className="bg-muted/30 flex items-center gap-3 rounded p-2 text-sm"
                  >
                    <div className="h-2 w-2 rounded-full bg-amber-600" />
                    <div className="flex-1">
                      <span className="font-medium">{change.title}</span>
                      <span className="text-muted-foreground ml-2">• {change.impact}</span>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {new Date(change.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default ExecutiveSummary;
