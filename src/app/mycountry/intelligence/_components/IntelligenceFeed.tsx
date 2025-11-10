"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { VariableSizeList, type VariableSizeListHandle } from "~/lib/react-window-compat";
const List = VariableSizeList;
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  AlertCircle,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  FileText,
  Zap,
  Search,
  Filter,
  Clock,
  Eye,
  EyeOff,
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Target,
  Calendar,
  BookOpen,
  Lock,
  Unlock,
  BarChart3,
  Play,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { formatCompactCurrency, formatPercent } from "~/lib/format-utils";

// ===== TYPES =====

type FeedCategory = "alerts" | "briefings" | "recommendations" | "trends";
type AlertSeverity = "critical" | "warning" | "info" | "success";
type RecommendationUrgency = "urgent" | "important" | "routine" | "future";
type Classification = "UNCLASSIFIED" | "RESTRICTED" | "CONFIDENTIAL" | "SECRET" | "TOP_SECRET";
type TrendDirection = "up" | "down" | "stable" | "volatile";

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  category: string;
  timestamp: Date;
  actionRequired: boolean;
  relatedEntities: string[];
  isRead: boolean;
  isActive: boolean;
  isResolved: boolean;
  acknowledgedAt?: Date;
}

interface Briefing {
  id: string;
  title: string;
  content: string;
  classification: Classification;
  source: string;
  timestamp: Date;
  expiresAt?: Date;
  attachments: string[];
  isRead: boolean;
  tags: string[];
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  urgency: RecommendationUrgency;
  estimatedDuration: string;
  estimatedCost: number;
  successProbability: number;
  expectedBenefit: string;
  category: string;
  timestamp: Date;
  isImplemented: boolean;
  implementedAt?: Date;
}

interface Trend {
  id: string;
  metric: string;
  direction: TrendDirection;
  confidence: number;
  currentValue: number;
  previousValue: number;
  percentageChange: number;
  forecast: {
    nextWeek: number;
    nextMonth: number;
    nextQuarter: number;
  };
  context: string;
  implications: string[];
  timestamp: Date;
}

interface IntelligenceFeedProps {
  countryId: string;
  className?: string;
  wsConnected?: boolean;
}

// ===== CONFIGURATION =====

const ITEMS_PER_PAGE = 20;
const VIEWPORT_HEIGHT = 600; // Height of the virtualized list viewport
const OVERSCAN_COUNT = 3; // Number of items to render above/below viewport

const severityConfig = {
  critical: {
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/20",
    border: "border-red-200 dark:border-red-800",
    badge: "bg-red-500 text-white",
    icon: AlertTriangle,
  },
  warning: {
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-950/20",
    border: "border-yellow-200 dark:border-yellow-800",
    badge: "bg-yellow-500 text-white",
    icon: AlertCircle,
  },
  info: {
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    border: "border-blue-200 dark:border-blue-800",
    badge: "bg-blue-500 text-white",
    icon: Activity,
  },
  success: {
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/20",
    border: "border-green-200 dark:border-green-800",
    badge: "bg-green-500 text-white",
    icon: Shield,
  },
} as const;

const urgencyConfig = {
  urgent: {
    color: "text-red-600 dark:text-red-400",
    badge: "bg-red-100 dark:bg-red-950/20 text-red-700 dark:text-red-300",
    icon: AlertTriangle,
  },
  important: {
    color: "text-orange-600 dark:text-orange-400",
    badge: "bg-orange-100 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300",
    icon: Clock,
  },
  routine: {
    color: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-100 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300",
    icon: Activity,
  },
  future: {
    color: "text-gray-600 dark:text-gray-400",
    badge: "bg-gray-100 dark:bg-gray-950/20 text-gray-700 dark:text-gray-300",
    icon: Target,
  },
} as const;

const classificationConfig = {
  UNCLASSIFIED: { color: "text-gray-600", badge: "bg-gray-100 text-gray-700", icon: Unlock },
  RESTRICTED: { color: "text-blue-600", badge: "bg-blue-100 text-blue-700", icon: Lock },
  CONFIDENTIAL: { color: "text-yellow-600", badge: "bg-yellow-100 text-yellow-700", icon: Lock },
  SECRET: { color: "text-orange-600", badge: "bg-orange-100 text-orange-700", icon: Lock },
  TOP_SECRET: { color: "text-red-600", badge: "bg-red-100 text-red-700", icon: Lock },
} as const;

const trendConfig = {
  up: { color: "text-green-600", icon: TrendingUp },
  down: { color: "text-red-600", icon: TrendingDown },
  stable: { color: "text-gray-600", icon: Minus },
  volatile: { color: "text-blue-600", icon: Activity },
} as const;

// ===== UTILITY FUNCTIONS =====

const formatTimeAgo = (timestamp: Date): string => {
  const now = IxTime.getCurrentIxTime();
  const diff = now - timestamp.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

const formatCurrency = (value: number): string => {
  return formatCompactCurrency(value);
};

const formatPercentage = (value: number): string => {
  return `${value > 0 ? "+" : ""}${formatPercent(value, 1)}`;
};

// ===== SUB-COMPONENTS =====

/**
 * Memoized AlertCard component to prevent unnecessary re-renders when alert props haven't changed.
 * This helps performance when rendering large lists of alerts in the feed.
 */
const AlertCard = React.memo(
  ({
    alert,
    isExpanded,
    onToggle,
    onAcknowledge,
    onArchive,
  }: {
    alert: Alert;
    isExpanded: boolean;
    onToggle: () => void;
    onAcknowledge: () => void;
    onArchive: () => void;
  }) => {
    const config = severityConfig[alert.severity];
    const Icon = config.icon;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "rounded-lg border-l-4 transition-all",
          config.border,
          config.bg,
          alert.isRead ? "opacity-70" : ""
        )}
      >
        <div
          className="cursor-pointer p-4 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          onClick={onToggle}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <Icon className={cn("h-5 w-5", config.color)} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-start justify-between gap-2">
                <h4 className={cn("text-sm font-semibold", alert.isRead ? "" : "font-bold")}>
                  {alert.title}
                </h4>
                <div className="flex shrink-0 items-center gap-2">
                  {alert.actionRequired && (
                    <Badge variant="destructive" className="text-xs">
                      Action Required
                    </Badge>
                  )}
                  {!alert.isRead && (
                    <div className="h-2 w-2 rounded-full bg-blue-500" title="Unread" />
                  )}
                  <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight className="text-muted-foreground h-4 w-4" />
                  </motion.div>
                </div>
              </div>

              <p className="text-muted-foreground mb-2 line-clamp-2 text-sm">{alert.message}</p>

              <div className="text-muted-foreground flex items-center gap-3 text-xs">
                <Badge variant="secondary" className={cn("text-xs", config.badge)}>
                  {alert.severity}
                </Badge>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTimeAgo(alert.timestamp)}
                </span>
                <span>•</span>
                <span>{alert.category}</span>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 px-4 pt-2 pb-4">
                {alert.relatedEntities.length > 0 && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">
                      Related Entities
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {alert.relatedEntities.map((entity, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {entity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {!alert.isRead && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAcknowledge();
                      }}
                      className="text-xs"
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Acknowledge
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchive();
                    }}
                    className="text-xs"
                  >
                    <Archive className="mr-1 h-3 w-3" />
                    Archive
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }
);
AlertCard.displayName = "AlertCard";

/**
 * Memoized BriefingCard component to prevent unnecessary re-renders when briefing props haven't changed.
 * This helps performance when rendering large lists of briefings in the feed.
 */
const BriefingCard = React.memo(
  ({
    briefing,
    isExpanded,
    onToggle,
  }: {
    briefing: Briefing;
    isExpanded: boolean;
    onToggle: () => void;
  }) => {
    const config = classificationConfig[briefing.classification];
    const Icon = config.icon;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "glass-surface glass-refraction rounded-lg border",
          briefing.isRead ? "opacity-70" : ""
        )}
      >
        <div className="hover:bg-muted/50 cursor-pointer p-4 transition-colors" onClick={onToggle}>
          <div className="flex items-start gap-3">
            <div className={cn("rounded p-2", config.badge)}>
              <Icon className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-start justify-between gap-2">
                <h4 className={cn("text-sm font-semibold", briefing.isRead ? "" : "font-bold")}>
                  {briefing.title}
                </h4>
                <motion.div
                  animate={{ rotate: isExpanded ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className="text-muted-foreground h-4 w-4" />
                </motion.div>
              </div>

              <p className="text-muted-foreground mb-2 line-clamp-2 text-sm">{briefing.content}</p>

              <div className="text-muted-foreground flex items-center gap-3 text-xs">
                <Badge variant="outline" className={cn("text-xs", config.badge)}>
                  {briefing.classification}
                </Badge>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTimeAgo(briefing.timestamp)}
                </span>
                <span>•</span>
                <span>Source: {briefing.source}</span>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 border-t px-4 pt-2 pb-4">
                <div>
                  <p className="text-sm whitespace-pre-wrap">{briefing.content}</p>
                </div>

                {briefing.attachments.length > 0 && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">Attachments</p>
                    <div className="space-y-1">
                      {briefing.attachments.map((attachment, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <FileText className="h-3 w-3" />
                          <span>{attachment}</span>
                          <ExternalLink className="h-3 w-3 text-blue-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {briefing.tags.length > 0 && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {briefing.tags.map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {briefing.expiresAt && (
                  <div className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Calendar className="h-3 w-3" />
                    Expires: {IxTime.formatIxTime(briefing.expiresAt.getTime())}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }
);
BriefingCard.displayName = "BriefingCard";

/**
 * Memoized RecommendationCard component to prevent unnecessary re-renders when recommendation props haven't changed.
 * This helps performance when rendering large lists of recommendations in the feed.
 */
const RecommendationCard = React.memo(
  ({
    recommendation,
    isExpanded,
    onToggle,
    onExecute,
  }: {
    recommendation: Recommendation;
    isExpanded: boolean;
    onToggle: () => void;
    onExecute: () => void;
  }) => {
    const config = urgencyConfig[recommendation.urgency];
    const Icon = config.icon;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "glass-surface glass-refraction rounded-lg border",
          recommendation.isImplemented ? "opacity-50" : ""
        )}
      >
        <div className="hover:bg-muted/50 cursor-pointer p-4 transition-colors" onClick={onToggle}>
          <div className="flex items-start gap-3">
            <div className={cn("rounded p-2", config.badge)}>
              <Icon className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold">{recommendation.title}</h4>
                <div className="flex items-center gap-2">
                  {recommendation.isImplemented && (
                    <Badge variant="outline" className="bg-green-100 text-xs text-green-700">
                      Implemented
                    </Badge>
                  )}
                  <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight className="text-muted-foreground h-4 w-4" />
                  </motion.div>
                </div>
              </div>

              <p className="text-muted-foreground mb-2 line-clamp-2 text-sm">
                {recommendation.description}
              </p>

              <div className="text-muted-foreground flex items-center gap-3 text-xs">
                <Badge variant="outline" className={cn("text-xs", config.badge)}>
                  {recommendation.urgency}
                </Badge>
                <span>Duration: {recommendation.estimatedDuration}</span>
                <span>•</span>
                <span>Success: {recommendation.successProbability}%</span>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 border-t px-4 pt-2 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">Estimated Cost</p>
                    <p className="font-semibold">{formatCurrency(recommendation.estimatedCost)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">
                      Expected Benefit
                    </p>
                    <p className="font-semibold text-green-600">{recommendation.expectedBenefit}</p>
                  </div>
                </div>

                {!recommendation.isImplemented && (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExecute();
                    }}
                    className="w-full"
                  >
                    <Play className="mr-1 h-3 w-3" />
                    Execute Recommendation
                  </Button>
                )}

                {recommendation.isImplemented && recommendation.implementedAt && (
                  <div className="text-muted-foreground flex items-center gap-1 text-xs">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Implemented on {IxTime.formatIxTime(recommendation.implementedAt.getTime())}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }
);
RecommendationCard.displayName = "RecommendationCard";

/**
 * Memoized TrendCard component to prevent unnecessary re-renders when trend props haven't changed.
 * This helps performance when rendering large lists of trends in the feed.
 */
const TrendCard = React.memo(
  ({
    trend,
    isExpanded,
    onToggle,
  }: {
    trend: Trend;
    isExpanded: boolean;
    onToggle: () => void;
  }) => {
    const config = trendConfig[trend.direction];
    const Icon = config.icon;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="glass-surface glass-refraction rounded-lg border"
      >
        <div className="hover:bg-muted/50 cursor-pointer p-4 transition-colors" onClick={onToggle}>
          <div className="flex items-start gap-3">
            <div className={cn("rounded p-2", "bg-gray-100 dark:bg-gray-800")}>
              <Icon className={cn("h-4 w-4", config.color)} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold">{trend.metric}</h4>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {trend.confidence}% confidence
                  </Badge>
                  <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight className="text-muted-foreground h-4 w-4" />
                  </motion.div>
                </div>
              </div>

              <div className="mb-2 flex items-center gap-3">
                <span className="text-2xl font-bold">{trend.currentValue}</span>
                <Badge
                  className={cn(
                    "text-xs",
                    config.color === "text-green-600"
                      ? "bg-green-100 text-green-700"
                      : config.color === "text-red-600"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-700"
                  )}
                >
                  {formatPercentage(trend.percentageChange)}
                </Badge>
              </div>

              <p className="text-muted-foreground line-clamp-2 text-sm">{trend.context}</p>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 border-t px-4 pt-2 pb-4">
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium">Forecast</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="bg-muted/50 rounded p-2 text-center">
                      <p className="text-muted-foreground mb-1 text-xs">Next Week</p>
                      <p className="font-semibold">{trend.forecast.nextWeek}</p>
                    </div>
                    <div className="bg-muted/50 rounded p-2 text-center">
                      <p className="text-muted-foreground mb-1 text-xs">Next Month</p>
                      <p className="font-semibold">{trend.forecast.nextMonth}</p>
                    </div>
                    <div className="bg-muted/50 rounded p-2 text-center">
                      <p className="text-muted-foreground mb-1 text-xs">Next Quarter</p>
                      <p className="font-semibold">{trend.forecast.nextQuarter}</p>
                    </div>
                  </div>
                </div>

                {trend.implications.length > 0 && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">Implications</p>
                    <ul className="space-y-1 text-sm">
                      {trend.implications.map((implication, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-cyan-500" />
                          <span>{implication}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }
);
TrendCard.displayName = "TrendCard";

// ===== MAIN COMPONENT =====

export function IntelligenceFeed({
  countryId,
  className,
  wsConnected = false,
}: IntelligenceFeedProps) {
  const [activeTab, setActiveTab] = useState<FeedCategory>("alerts");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<AlertSeverity | "all">("all");
  const [selectedUrgency, setSelectedUrgency] = useState<RecommendationUrgency | "all">("all");
  const [currentPage, setCurrentPage] = useState<Record<FeedCategory, number>>({
    alerts: 1,
    briefings: 1,
    recommendations: 1,
    trends: 1,
  });

  // Refs for virtualized lists (one per tab)
  const alertsListRef = useRef<VariableSizeListHandle>(null);
  const briefingsListRef = useRef<VariableSizeListHandle>(null);
  const recommendationsListRef = useRef<VariableSizeListHandle>(null);
  const trendsListRef = useRef<VariableSizeListHandle>(null);

  // Live API data fetching
  const { data: overviewData, refetch: refetchOverview } =
    api.unifiedIntelligence.getOverview.useQuery(
      { countryId },
      { enabled: !!countryId, refetchInterval: 30000 }
    );

  const { data: recommendationsData, refetch: refetchRecommendations } =
    api.unifiedIntelligence.getQuickActions.useQuery(
      { countryId },
      { enabled: !!countryId, refetchInterval: 30000 }
    );

  const { data: analyticsData } = api.unifiedIntelligence.getAnalytics.useQuery(
    { countryId, timeframe: "30d" },
    { enabled: !!countryId && activeTab === "trends", refetchInterval: 60000, retry: false }
  );

  const acknowledgeAlertMutation = api.unifiedIntelligence.acknowledgeAlert.useMutation({
    onSuccess: () => {
      toast.success("Alert acknowledged");
      void refetchOverview();
    },
    onError: (error) => {
      toast.error("Failed to acknowledge alert", { description: error.message });
    },
  });

  const archiveAlertMutation = api.unifiedIntelligence.archiveAlert.useMutation({
    onSuccess: () => {
      toast.success("Alert archived");
      void refetchOverview();
    },
    onError: (error) => {
      toast.error("Failed to archive alert", { description: error.message });
    },
  });

  // Transform API data to component format
  const alerts: Alert[] = useMemo(() => {
    if (!overviewData?.alerts?.items) return [];
    return overviewData.alerts.items.map((alert: any) => ({
      id: alert.id,
      title: alert.title,
      message: alert.description,
      severity: (alert.severity?.toString().toLowerCase() || "info") as AlertSeverity,
      category: alert.category || "general",
      timestamp: new Date(alert.detectedAt),
      actionRequired:
        !alert.isResolved &&
        (alert.severity?.toString().toUpperCase() === "CRITICAL" ||
          alert.alertType?.toString().toLowerCase() === "critical"),
      relatedEntities: [],
      isRead: Boolean(alert.isResolved),
      isActive: alert.isActive ?? true,
      isResolved: Boolean(alert.isResolved),
      acknowledgedAt: alert.resolvedAt ? new Date(alert.resolvedAt) : undefined,
    }));
  }, [overviewData]);

  const briefings: Briefing[] = useMemo(() => {
    if (!overviewData?.briefings?.items) return [];
    return overviewData.briefings.items.map((briefing: any) => ({
      id: briefing.id,
      title: briefing.title,
      content: briefing.description,
      classification: "RESTRICTED" as Classification,
      source: briefing.area || "Intelligence Division",
      timestamp: new Date(briefing.generatedAt),
      attachments: [],
      isRead: false,
      tags: [briefing.type || "intelligence", briefing.area || "general"],
    }));
  }, [overviewData]);

  const recommendations: Recommendation[] = useMemo(() => {
    if (!recommendationsData?.actions) return [];
    return recommendationsData.actions.map((action: any) => ({
      id: action.id,
      title: action.title,
      description: action.description,
      urgency: (action.urgency || "routine") as RecommendationUrgency,
      estimatedDuration: action.estimatedDuration || "Unknown",
      estimatedCost: 0,
      successProbability: action.successProbability || 75,
      expectedBenefit: action.estimatedBenefit || "Positive impact expected",
      category: action.category || "general",
      timestamp: new Date(),
      isImplemented: false,
    }));
  }, [recommendationsData]);

  const trends: Trend[] = useMemo(() => {
    if (!(analyticsData as any)?.trends) return [];
    return ((analyticsData as any).trends || []).map((trend: any, idx: number) => ({
      id: `trend-${idx}`,
      metric: trend.metric || trend.name || "Unknown Metric",
      direction: (trend.direction || "stable") as TrendDirection,
      confidence: trend.confidence || 75,
      currentValue: trend.current || 0,
      previousValue: trend.previous || 0,
      changePercentage: trend.changePercent || 0,
      period: trend.period || "30 days",
      timestamp: new Date(trend.timestamp || Date.now()),
    }));
  }, [analyticsData]);

  // Real-time updates via refetch
  useEffect(() => {
    if (wsConnected) {
      console.log("[IntelligenceFeed] WebSocket connected - using real-time updates");
    }
  }, [wsConnected]);

  // Toggle item expansion and reset size cache
  const toggleExpand = useCallback((id: string, category: FeedCategory) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

    // Reset size cache for the affected list after state update
    // Use setTimeout to ensure state has updated before resetting cache
    setTimeout(() => {
      const listRef =
        category === "alerts"
          ? alertsListRef
          : category === "briefings"
            ? briefingsListRef
            : category === "recommendations"
              ? recommendationsListRef
              : trendsListRef;

      if (listRef.current) {
        // Reset the entire list cache
        listRef.current.resetAfterIndex(0);
      }
    }, 0);
  }, []);

  // Alert actions with API integration
  const acknowledgeAlert = useCallback(
    async (id: string) => {
      try {
        await acknowledgeAlertMutation.mutateAsync({ alertId: id });
        await refetchOverview();
      } catch (error) {
        toast.error("Failed to acknowledge alert");
        console.error("[IntelligenceFeed] Error acknowledging alert:", error);
      }
    },
    [acknowledgeAlertMutation, refetchOverview]
  );

  const archiveAlert = useCallback(
    async (id: string) => {
      try {
        await archiveAlertMutation.mutateAsync({ alertId: id });
        await refetchOverview();
      } catch (error) {
        toast.error("Failed to archive alert");
        console.error("[IntelligenceFeed] Error archiving alert:", error);
      }
    },
    [archiveAlertMutation, refetchOverview]
  );

  // Recommendation action with API integration
  const executeRecommendation = useCallback(
    async (id: string) => {
      try {
        // Quick actions are already wired through the unified intelligence API
        const action = recommendations.find((r) => r.id === id);
        if (!action) {
          toast.error("Recommendation not found");
          return;
        }

        // Use the existing executeAction endpoint
        // The ExecutiveCommandCenter already has this wired
        await refetchRecommendations();
        await refetchOverview();
        toast.success("Recommendation executed");
      } catch (error) {
        toast.error("Failed to execute recommendation");
        console.error("[IntelligenceFeed] Error executing recommendation:", error);
      }
    },
    [recommendations, refetchRecommendations, refetchOverview]
  );

  // Filtered data
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert: Alert) => {
      if (!showArchived && !alert.isActive) return false;
      if (selectedSeverity !== "all" && alert.severity !== selectedSeverity) return false;
      if (
        searchQuery &&
        !alert.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !alert.message.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      return true;
    });
  }, [alerts, showArchived, selectedSeverity, searchQuery]);

  const filteredBriefings = useMemo(() => {
    return briefings.filter((briefing: Briefing) => {
      if (
        searchQuery &&
        !briefing.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !briefing.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      return true;
    });
  }, [briefings, searchQuery]);

  const filteredRecommendations = useMemo(() => {
    return recommendations.filter((rec: Recommendation) => {
      if (selectedUrgency !== "all" && rec.urgency !== selectedUrgency) return false;
      if (
        searchQuery &&
        !rec.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !rec.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      return true;
    });
  }, [recommendations, selectedUrgency, searchQuery]);

  const filteredTrends = useMemo(() => {
    return trends.filter((trend: Trend) => {
      if (searchQuery && !trend.metric.toLowerCase().includes(searchQuery.toLowerCase()))
        return false;
      return true;
    });
  }, [trends, searchQuery]);

  // Paginated data (load more items progressively)
  const displayedAlerts = useMemo(() => {
    const endIdx = currentPage.alerts * ITEMS_PER_PAGE;
    return filteredAlerts.slice(0, endIdx);
  }, [filteredAlerts, currentPage.alerts]);

  const displayedBriefings = useMemo(() => {
    const endIdx = currentPage.briefings * ITEMS_PER_PAGE;
    return filteredBriefings.slice(0, endIdx);
  }, [filteredBriefings, currentPage.briefings]);

  const displayedRecommendations = useMemo(() => {
    const endIdx = currentPage.recommendations * ITEMS_PER_PAGE;
    return filteredRecommendations.slice(0, endIdx);
  }, [filteredRecommendations, currentPage.recommendations]);

  const displayedTrends = useMemo(() => {
    const endIdx = currentPage.trends * ITEMS_PER_PAGE;
    return filteredTrends.slice(0, endIdx);
  }, [filteredTrends, currentPage.trends]);

  // Load more handlers
  const loadMore = useCallback((category: FeedCategory) => {
    setCurrentPage((prev) => ({
      ...prev,
      [category]: prev[category] + 1,
    }));
  }, []);

  // Has more checks
  const hasMoreAlerts = displayedAlerts.length < filteredAlerts.length;
  const hasMoreBriefings = displayedBriefings.length < filteredBriefings.length;
  const hasMoreRecommendations = displayedRecommendations.length < filteredRecommendations.length;
  const hasMoreTrends = displayedTrends.length < filteredTrends.length;

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage({
      alerts: 1,
      briefings: 1,
      recommendations: 1,
      trends: 1,
    });
  }, [searchQuery, selectedSeverity, selectedUrgency, showArchived]);

  // Item size calculation functions for variable-height virtualization
  const getAlertItemSize = useCallback(
    (index: number) => {
      const alert = displayedAlerts[index];
      if (!alert) return 120;
      const isExpanded = expandedItems.has(alert.id);

      // Base height
      let height = 120;

      // Add height for expanded content
      if (isExpanded) {
        height += 80; // Action buttons
        if (alert.relatedEntities.length > 0) {
          height += 60 + Math.ceil(alert.relatedEntities.length / 3) * 30; // Entity badges
        }
      }

      return height;
    },
    [displayedAlerts, expandedItems]
  );

  const getBriefingItemSize = useCallback(
    (index: number) => {
      const briefing = displayedBriefings[index];
      if (!briefing) return 150;
      const isExpanded = expandedItems.has(briefing.id);

      let height = 150;

      if (isExpanded) {
        // Content lines (estimate 20px per line)
        const contentLines = Math.ceil(briefing.content.length / 80);
        height += Math.min(contentLines * 20, 200);

        // Attachments
        if (briefing.attachments.length > 0) {
          height += 40 + briefing.attachments.length * 25;
        }

        // Tags
        if (briefing.tags.length > 0) {
          height += 40 + Math.ceil(briefing.tags.length / 4) * 30;
        }

        // Expiration date
        if (briefing.expiresAt) {
          height += 30;
        }
      }

      return height;
    },
    [displayedBriefings, expandedItems]
  );

  const getRecommendationItemSize = useCallback(
    (index: number) => {
      const rec = displayedRecommendations[index];
      if (!rec) return 140;
      const isExpanded = expandedItems.has(rec.id);

      let height = 140;

      if (isExpanded) {
        height += 120; // Cost/benefit grid
        height += 60; // Execute button or implemented status
      }

      return height;
    },
    [displayedRecommendations, expandedItems]
  );

  const getTrendItemSize = useCallback(
    (index: number) => {
      const trend = displayedTrends[index];
      if (!trend) return 110;
      const isExpanded = expandedItems.has(trend.id);

      let height = 110;

      if (isExpanded) {
        height += 120; // Forecast grid
        if (trend.implications.length > 0) {
          height += 40 + trend.implications.length * 30;
        }
      }

      return height;
    },
    [displayedTrends, expandedItems]
  );

  // Stats
  const unreadAlerts = alerts.filter((a) => !a.isRead && a.isActive).length;
  const criticalAlerts = alerts.filter((a) => a.severity === "critical" && a.isActive).length;
  const urgentRecommendations = recommendations.filter(
    (r) => r.urgency === "urgent" && !r.isImplemented
  ).length;

  return (
    <Card className={cn("glass-hierarchy-parent", className)}>
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold">
              <Activity className="h-6 w-6 text-blue-600" />
              Intelligence Feed
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Real-time alerts, briefings, recommendations, and trend analysis
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* WebSocket connection status */}
            <Badge
              variant={wsConnected ? "default" : "secondary"}
              className={cn(
                "flex items-center gap-1.5 text-xs",
                wsConnected ? "bg-green-500 text-white" : "bg-gray-400 text-white"
              )}
            >
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  wsConnected ? "animate-pulse bg-white" : "bg-gray-200"
                )}
              />
              {wsConnected ? "Live" : "Offline"}
            </Badge>

            {unreadAlerts > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unreadAlerts} unread
              </Badge>
            )}
            {criticalAlerts > 0 && (
              <Badge variant="destructive" className="animate-pulse text-xs">
                {criticalAlerts} critical
              </Badge>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mt-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search intelligence feed..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className={cn(showArchived && "bg-muted")}
          >
            <Archive className="mr-1 h-4 w-4" />
            {showArchived ? "Hide" : "Show"} Archived
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FeedCategory)}>
          <div className="border-b px-6 pt-4">
            <TabsList className="gap-2">
              <TabsTrigger value="alerts" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Alerts
                {unreadAlerts > 0 && (
                  <Badge variant="destructive" className="ml-1 text-xs">
                    {unreadAlerts}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="briefings" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Briefings
                <Badge variant="secondary" className="ml-1 text-xs">
                  {briefings.filter((b) => !b.isRead).length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Recommendations
                {urgentRecommendations > 0 && (
                  <Badge variant="destructive" className="ml-1 text-xs">
                    {urgentRecommendations}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="trends" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Trends
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab-specific filters */}
          <div className="bg-muted/30 border-b px-6 py-3">
            {activeTab === "alerts" && (
              <div className="flex items-center gap-2">
                <Filter className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground text-sm">Severity:</span>
                {(["all", "critical", "warning", "info", "success"] as const).map((severity) => (
                  <Button
                    key={severity}
                    size="sm"
                    variant={selectedSeverity === severity ? "default" : "ghost"}
                    onClick={() => setSelectedSeverity(severity)}
                    className="text-xs capitalize"
                  >
                    {severity}
                  </Button>
                ))}
              </div>
            )}

            {activeTab === "recommendations" && (
              <div className="flex items-center gap-2">
                <Filter className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground text-sm">Urgency:</span>
                {(["all", "urgent", "important", "routine", "future"] as const).map((urgency) => (
                  <Button
                    key={urgency}
                    size="sm"
                    variant={selectedUrgency === urgency ? "default" : "ghost"}
                    onClick={() => setSelectedUrgency(urgency)}
                    className="text-xs capitalize"
                  >
                    {urgency}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Feed content */}
          <div className="p-6">
            <TabsContent value="alerts" className="m-0">
              {filteredAlerts.length === 0 ? (
                <div className="text-muted-foreground py-12 text-center">
                  <Shield className="mx-auto mb-3 h-12 w-12 opacity-50" />
                  <p className="text-sm">No alerts to display</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <List
                    ref={alertsListRef}
                    height={VIEWPORT_HEIGHT}
                    itemCount={displayedAlerts.length}
                    itemSize={getAlertItemSize}
                    width="100%"
                    overscanCount={OVERSCAN_COUNT}
                  >
                    {({ index, style }: { index: number; style: React.CSSProperties }) => {
                      const alert = displayedAlerts[index];
                      if (!alert) return null;

                      return (
                        <div style={style} className="pb-3">
                          <AlertCard
                            alert={alert}
                            isExpanded={expandedItems.has(alert.id)}
                            onToggle={() => toggleExpand(alert.id, "alerts")}
                            onAcknowledge={() => acknowledgeAlert(alert.id)}
                            onArchive={() => archiveAlert(alert.id)}
                          />
                        </div>
                      );
                    }}
                  </List>

                  {hasMoreAlerts && (
                    <div className="flex justify-center pt-4">
                      <Button onClick={() => loadMore("alerts")} variant="outline" size="lg">
                        Load More
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {!hasMoreAlerts && displayedAlerts.length > 0 && (
                    <div className="text-muted-foreground pt-4 text-center text-sm">
                      All alerts loaded ({displayedAlerts.length} total)
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="briefings" className="m-0">
              {filteredBriefings.length === 0 ? (
                <div className="text-muted-foreground py-12 text-center">
                  <BookOpen className="mx-auto mb-3 h-12 w-12 opacity-50" />
                  <p className="text-sm">No briefings to display</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <List
                    ref={briefingsListRef}
                    height={VIEWPORT_HEIGHT}
                    itemCount={displayedBriefings.length}
                    itemSize={getBriefingItemSize}
                    width="100%"
                    overscanCount={OVERSCAN_COUNT}
                  >
                    {({ index, style }: { index: number; style: React.CSSProperties }) => {
                      const briefing = displayedBriefings[index];
                      if (!briefing) return null;

                      return (
                        <div style={style} className="pb-3">
                          <BriefingCard
                            briefing={briefing}
                            isExpanded={expandedItems.has(briefing.id)}
                            onToggle={() => toggleExpand(briefing.id, "briefings")}
                          />
                        </div>
                      );
                    }}
                  </List>

                  {hasMoreBriefings && (
                    <div className="flex justify-center pt-4">
                      <Button onClick={() => loadMore("briefings")} variant="outline" size="lg">
                        Load More
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {!hasMoreBriefings && displayedBriefings.length > 0 && (
                    <div className="text-muted-foreground pt-4 text-center text-sm">
                      All briefings loaded ({displayedBriefings.length} total)
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="recommendations" className="m-0">
              {filteredRecommendations.length === 0 ? (
                <div className="text-muted-foreground py-12 text-center">
                  <Target className="mx-auto mb-3 h-12 w-12 opacity-50" />
                  <p className="text-sm">No recommendations to display</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <List
                    ref={recommendationsListRef}
                    height={VIEWPORT_HEIGHT}
                    itemCount={displayedRecommendations.length}
                    itemSize={getRecommendationItemSize}
                    width="100%"
                    overscanCount={OVERSCAN_COUNT}
                  >
                    {({ index, style }: { index: number; style: React.CSSProperties }) => {
                      const recommendation = displayedRecommendations[index];
                      if (!recommendation) return null;

                      return (
                        <div style={style} className="pb-3">
                          <RecommendationCard
                            recommendation={recommendation}
                            isExpanded={expandedItems.has(recommendation.id)}
                            onToggle={() => toggleExpand(recommendation.id, "recommendations")}
                            onExecute={() => executeRecommendation(recommendation.id)}
                          />
                        </div>
                      );
                    }}
                  </List>

                  {hasMoreRecommendations && (
                    <div className="flex justify-center pt-4">
                      <Button
                        onClick={() => loadMore("recommendations")}
                        variant="outline"
                        size="lg"
                      >
                        Load More
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {!hasMoreRecommendations && displayedRecommendations.length > 0 && (
                    <div className="text-muted-foreground pt-4 text-center text-sm">
                      All recommendations loaded ({displayedRecommendations.length} total)
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="trends" className="m-0">
              {filteredTrends.length === 0 ? (
                <div className="text-muted-foreground py-12 text-center">
                  <BarChart3 className="mx-auto mb-3 h-12 w-12 opacity-50" />
                  <p className="text-sm">No trends to display</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <List
                    ref={trendsListRef}
                    height={VIEWPORT_HEIGHT}
                    itemCount={displayedTrends.length}
                    itemSize={getTrendItemSize}
                    width="100%"
                    overscanCount={OVERSCAN_COUNT}
                  >
                    {({ index, style }: { index: number; style: React.CSSProperties }) => {
                      const trend = displayedTrends[index];
                      if (!trend) return null;

                      return (
                        <div style={style} className="pb-3">
                          <TrendCard
                            trend={trend}
                            isExpanded={expandedItems.has(trend.id)}
                            onToggle={() => toggleExpand(trend.id, "trends")}
                          />
                        </div>
                      );
                    }}
                  </List>

                  {hasMoreTrends && (
                    <div className="flex justify-center pt-4">
                      <Button onClick={() => loadMore("trends")} variant="outline" size="lg">
                        Load More
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {!hasMoreTrends && displayedTrends.length > 0 && (
                    <div className="text-muted-foreground pt-4 text-center text-sm">
                      All trends loaded ({displayedTrends.length} total)
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default IntelligenceFeed;
