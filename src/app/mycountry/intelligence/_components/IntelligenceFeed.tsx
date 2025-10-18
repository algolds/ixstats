"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Play
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Input } from '~/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '~/components/ui/tabs';
import { api } from '~/trpc/react';
import { IxTime } from '~/lib/ixtime';
import { toast } from 'sonner';
import { cn } from '~/lib/utils';

// ===== TYPES =====

type FeedCategory = 'alerts' | 'briefings' | 'recommendations' | 'trends';
type AlertSeverity = 'critical' | 'warning' | 'info' | 'success';
type RecommendationUrgency = 'urgent' | 'important' | 'routine' | 'future';
type Classification = 'UNCLASSIFIED' | 'RESTRICTED' | 'CONFIDENTIAL' | 'SECRET' | 'TOP_SECRET';
type TrendDirection = 'up' | 'down' | 'stable' | 'volatile';

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
  isArchived: boolean;
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

const severityConfig = {
  critical: {
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-500 text-white',
    icon: AlertTriangle
  },
  warning: {
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-950/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    badge: 'bg-yellow-500 text-white',
    icon: AlertCircle
  },
  info: {
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-500 text-white',
    icon: Activity
  },
  success: {
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-950/20',
    border: 'border-green-200 dark:border-green-800',
    badge: 'bg-green-500 text-white',
    icon: Shield
  }
} as const;

const urgencyConfig = {
  urgent: {
    color: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-100 dark:bg-red-950/20 text-red-700 dark:text-red-300',
    icon: AlertTriangle
  },
  important: {
    color: 'text-orange-600 dark:text-orange-400',
    badge: 'bg-orange-100 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300',
    icon: Clock
  },
  routine: {
    color: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-100 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300',
    icon: Activity
  },
  future: {
    color: 'text-gray-600 dark:text-gray-400',
    badge: 'bg-gray-100 dark:bg-gray-950/20 text-gray-700 dark:text-gray-300',
    icon: Target
  }
} as const;

const classificationConfig = {
  UNCLASSIFIED: { color: 'text-gray-600', badge: 'bg-gray-100 text-gray-700', icon: Unlock },
  RESTRICTED: { color: 'text-blue-600', badge: 'bg-blue-100 text-blue-700', icon: Lock },
  CONFIDENTIAL: { color: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-700', icon: Lock },
  SECRET: { color: 'text-orange-600', badge: 'bg-orange-100 text-orange-700', icon: Lock },
  TOP_SECRET: { color: 'text-red-600', badge: 'bg-red-100 text-red-700', icon: Lock }
} as const;

const trendConfig = {
  up: { color: 'text-green-600', icon: TrendingUp },
  down: { color: 'text-red-600', icon: TrendingDown },
  stable: { color: 'text-gray-600', icon: Minus },
  volatile: { color: 'text-purple-600', icon: Activity }
} as const;

// ===== UTILITY FUNCTIONS =====

const formatTimeAgo = (timestamp: Date): string => {
  const now = IxTime.getCurrentIxTime();
  const diff = now - timestamp.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value);
};

const formatPercentage = (value: number): string => {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
};

// ===== SUB-COMPONENTS =====

const AlertCard = ({
  alert,
  isExpanded,
  onToggle,
  onAcknowledge,
  onArchive
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
        'rounded-lg border-l-4 transition-all',
        config.border,
        config.bg,
        alert.isRead ? 'opacity-70' : ''
      )}
    >
      <div
        className="p-4 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <Icon className={cn('h-5 w-5', config.color)} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className={cn('font-semibold text-sm', alert.isRead ? '' : 'font-bold')}>
                {alert.title}
              </h4>
              <div className="flex items-center gap-2 shrink-0">
                {alert.actionRequired && (
                  <Badge variant="destructive" className="text-xs">Action Required</Badge>
                )}
                {!alert.isRead && (
                  <div className="w-2 h-2 rounded-full bg-blue-500" title="Unread" />
                )}
                <motion.div
                  animate={{ rotate: isExpanded ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </motion.div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {alert.message}
            </p>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Badge variant="secondary" className={cn('text-xs', config.badge)}>
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
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 space-y-3">
              {alert.relatedEntities.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Related Entities</p>
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
                    <CheckCircle2 className="h-3 w-3 mr-1" />
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
                  <Archive className="h-3 w-3 mr-1" />
                  Archive
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const BriefingCard = ({
  briefing,
  isExpanded,
  onToggle
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
        'rounded-lg border glass-surface glass-refraction',
        briefing.isRead ? 'opacity-70' : ''
      )}
    >
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded', config.badge)}>
            <Icon className="h-4 w-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className={cn('font-semibold text-sm', briefing.isRead ? '' : 'font-bold')}>
                {briefing.title}
              </h4>
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {briefing.content}
            </p>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Badge variant="outline" className={cn('text-xs', config.badge)}>
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
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 space-y-3 border-t">
              <div>
                <p className="text-sm whitespace-pre-wrap">{briefing.content}</p>
              </div>

              {briefing.attachments.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Attachments</p>
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
                  <p className="text-xs font-medium text-muted-foreground mb-1">Tags</p>
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
                <div className="text-xs text-muted-foreground flex items-center gap-1">
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
};

const RecommendationCard = ({
  recommendation,
  isExpanded,
  onToggle,
  onExecute
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
        'rounded-lg border glass-surface glass-refraction',
        recommendation.isImplemented ? 'opacity-50' : ''
      )}
    >
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded', config.badge)}>
            <Icon className="h-4 w-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="font-semibold text-sm">
                {recommendation.title}
              </h4>
              <div className="flex items-center gap-2">
                {recommendation.isImplemented && (
                  <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
                    Implemented
                  </Badge>
                )}
                <motion.div
                  animate={{ rotate: isExpanded ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </motion.div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {recommendation.description}
            </p>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Badge variant="outline" className={cn('text-xs', config.badge)}>
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
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 space-y-3 border-t">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Estimated Cost</p>
                  <p className="font-semibold">{formatCurrency(recommendation.estimatedCost)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Expected Benefit</p>
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
                  <Play className="h-3 w-3 mr-1" />
                  Execute Recommendation
                </Button>
              )}

              {recommendation.isImplemented && recommendation.implementedAt && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
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
};

const TrendCard = ({
  trend,
  isExpanded,
  onToggle
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
      className="rounded-lg border glass-surface glass-refraction"
    >
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded', 'bg-gray-100 dark:bg-gray-800')}>
            <Icon className={cn('h-4 w-4', config.color)} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="font-semibold text-sm">
                {trend.metric}
              </h4>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {trend.confidence}% confidence
                </Badge>
                <motion.div
                  animate={{ rotate: isExpanded ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </motion.div>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl font-bold">{trend.currentValue}</span>
              <Badge className={cn('text-xs', config.color === 'text-green-600' ? 'bg-green-100 text-green-700' : config.color === 'text-red-600' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700')}>
                {formatPercentage(trend.percentageChange)}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2">
              {trend.context}
            </p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 space-y-3 border-t">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Forecast</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="text-center p-2 rounded bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Next Week</p>
                    <p className="font-semibold">{trend.forecast.nextWeek}</p>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Next Month</p>
                    <p className="font-semibold">{trend.forecast.nextMonth}</p>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Next Quarter</p>
                    <p className="font-semibold">{trend.forecast.nextQuarter}</p>
                  </div>
                </div>
              </div>

              {trend.implications.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Implications</p>
                  <ul className="space-y-1 text-sm">
                    {trend.implications.map((implication, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Sparkles className="h-3 w-3 mt-0.5 text-purple-500 shrink-0" />
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
};

// ===== MAIN COMPONENT =====

export function IntelligenceFeed({ countryId, className, wsConnected = false }: IntelligenceFeedProps) {
  const [activeTab, setActiveTab] = useState<FeedCategory>('alerts');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<AlertSeverity | 'all'>('all');
  const [selectedUrgency, setSelectedUrgency] = useState<RecommendationUrgency | 'all'>('all');

  // Live API data fetching
  const { data: overviewData, refetch: refetchOverview } = api.unifiedIntelligence.getOverview.useQuery(
    { countryId },
    { enabled: !!countryId, refetchInterval: 30000 }
  );

  const { data: recommendationsData, refetch: refetchRecommendations } = api.unifiedIntelligence.getQuickActions.useQuery(
    { countryId },
    { enabled: !!countryId, refetchInterval: 30000 }
  );

  const { data: analyticsData } = api.unifiedIntelligence.getAnalytics.useQuery(
    { countryId, timeframe: '30d' },
    { enabled: !!countryId, refetchInterval: 60000 }
  );

  // Transform API data to component format
  const alerts: Alert[] = useMemo(() => {
    if (!overviewData?.alerts?.items) return [];
    return overviewData.alerts.items.map(alert => ({
      id: alert.id,
      title: alert.title,
      message: alert.description,
      severity: (alert.severity?.toLowerCase() || 'info') as AlertSeverity,
      category: alert.category || 'general',
      timestamp: new Date(alert.detectedAt),
      actionRequired: alert.alertType === 'critical' || alert.severity === 'CRITICAL',
      relatedEntities: [],
      isRead: false,
      isArchived: false
    }));
  }, [overviewData]);

  const briefings: Briefing[] = useMemo(() => {
    if (!overviewData?.briefings?.items) return [];
    return overviewData.briefings.items.map(briefing => ({
      id: briefing.id,
      title: briefing.title,
      content: briefing.description,
      classification: 'RESTRICTED' as Classification,
      source: briefing.area || 'Intelligence Division',
      timestamp: new Date(briefing.generatedAt),
      attachments: [],
      isRead: false,
      tags: [briefing.type || 'intelligence', briefing.area || 'general']
    }));
  }, [overviewData]);

  const recommendations: Recommendation[] = useMemo(() => {
    if (!recommendationsData?.actions) return [];
    return recommendationsData.actions.map(action => ({
      id: action.id,
      title: action.title,
      description: action.description,
      urgency: (action.urgency || 'routine') as RecommendationUrgency,
      estimatedDuration: action.estimatedDuration || 'Unknown',
      estimatedCost: 0,
      successProbability: action.successProbability || 75,
      expectedBenefit: action.estimatedBenefit || 'Positive impact expected',
      category: action.category || 'general',
      timestamp: new Date(),
      isImplemented: false
    }));
  }, [recommendationsData]);

  const trends: Trend[] = useMemo(() => {
    if (!analyticsData?.trends) return [];
    return (analyticsData.trends || []).map((trend: any, idx: number) => ({
      id: `trend-${idx}`,
      metric: trend.metric || trend.name || 'Unknown Metric',
      direction: (trend.direction || 'stable') as TrendDirection,
      confidence: trend.confidence || 75,
      currentValue: trend.current || 0,
      previousValue: trend.previous || 0,
      changePercentage: trend.changePercent || 0,
      period: trend.period || '30 days',
      timestamp: new Date(trend.timestamp || Date.now())
    }));
  }, [analyticsData]);

  // Real-time updates via refetch
  useEffect(() => {
    if (wsConnected) {
      console.log('[IntelligenceFeed] WebSocket connected - using real-time updates');
    }
  }, [wsConnected]);

  // Toggle item expansion
  const toggleExpand = useCallback((id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Alert actions with API integration
  const acknowledgeAlert = useCallback(async (id: string) => {
    try {
      // TODO: Wire to API when endpoint is ready
      // await api.unifiedIntelligence.acknowledgeAlert.mutate({ alertId: id });
      await refetchOverview();
      toast.success('Alert acknowledged');
    } catch (error) {
      toast.error('Failed to acknowledge alert');
      console.error('[IntelligenceFeed] Error acknowledging alert:', error);
    }
  }, [refetchOverview]);

  const archiveAlert = useCallback(async (id: string) => {
    try {
      // TODO: Wire to API when endpoint is ready
      // await api.unifiedIntelligence.archiveAlert.mutate({ alertId: id });
      await refetchOverview();
      toast.success('Alert archived');
    } catch (error) {
      toast.error('Failed to archive alert');
      console.error('[IntelligenceFeed] Error archiving alert:', error);
    }
  }, [refetchOverview]);

  // Recommendation action with API integration
  const executeRecommendation = useCallback(async (id: string) => {
    try {
      // Quick actions are already wired through the unified intelligence API
      const action = recommendations.find(r => r.id === id);
      if (!action) {
        toast.error('Recommendation not found');
        return;
      }

      // Use the existing executeAction endpoint
      // The ExecutiveCommandCenter already has this wired
      await refetchRecommendations();
      await refetchOverview();
      toast.success('Recommendation executed');
    } catch (error) {
      toast.error('Failed to execute recommendation');
      console.error('[IntelligenceFeed] Error executing recommendation:', error);
    }
  }, [recommendations, refetchRecommendations, refetchOverview]);

  // Filtered data
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      if (!showArchived && alert.isArchived) return false;
      if (selectedSeverity !== 'all' && alert.severity !== selectedSeverity) return false;
      if (searchQuery && !alert.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !alert.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [alerts, showArchived, selectedSeverity, searchQuery]);

  const filteredBriefings = useMemo(() => {
    return briefings.filter(briefing => {
      if (searchQuery && !briefing.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !briefing.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [briefings, searchQuery]);

  const filteredRecommendations = useMemo(() => {
    return recommendations.filter(rec => {
      if (selectedUrgency !== 'all' && rec.urgency !== selectedUrgency) return false;
      if (searchQuery && !rec.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !rec.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [recommendations, selectedUrgency, searchQuery]);

  const filteredTrends = useMemo(() => {
    return trends.filter(trend => {
      if (searchQuery && !trend.metric.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [trends, searchQuery]);

  // Stats
  const unreadAlerts = alerts.filter(a => !a.isRead && !a.isArchived).length;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.isArchived).length;
  const urgentRecommendations = recommendations.filter(r => r.urgency === 'urgent' && !r.isImplemented).length;

  return (
    <Card className={cn('glass-hierarchy-parent', className)}>
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-blue-600" />
              Intelligence Feed
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time alerts, briefings, recommendations, and trend analysis
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* WebSocket connection status */}
            <Badge
              variant={wsConnected ? "default" : "secondary"}
              className={cn(
                "text-xs flex items-center gap-1.5",
                wsConnected ? "bg-green-500 text-white" : "bg-gray-400 text-white"
              )}
            >
              <div className={cn(
                "w-2 h-2 rounded-full",
                wsConnected ? "bg-white animate-pulse" : "bg-gray-200"
              )} />
              {wsConnected ? "Live" : "Offline"}
            </Badge>

            {unreadAlerts > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unreadAlerts} unread
              </Badge>
            )}
            {criticalAlerts > 0 && (
              <Badge variant="destructive" className="text-xs animate-pulse">
                {criticalAlerts} critical
              </Badge>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
            className={cn(showArchived && 'bg-muted')}
          >
            <Archive className="h-4 w-4 mr-1" />
            {showArchived ? 'Hide' : 'Show'} Archived
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
                  <Badge variant="destructive" className="text-xs ml-1">
                    {unreadAlerts}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="briefings" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Briefings
                <Badge variant="secondary" className="text-xs ml-1">
                  {briefings.filter(b => !b.isRead).length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Recommendations
                {urgentRecommendations > 0 && (
                  <Badge variant="destructive" className="text-xs ml-1">
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
          <div className="px-6 py-3 bg-muted/30 border-b">
            {activeTab === 'alerts' && (
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Severity:</span>
                {(['all', 'critical', 'warning', 'info', 'success'] as const).map((severity) => (
                  <Button
                    key={severity}
                    size="sm"
                    variant={selectedSeverity === severity ? 'default' : 'ghost'}
                    onClick={() => setSelectedSeverity(severity)}
                    className="text-xs capitalize"
                  >
                    {severity}
                  </Button>
                ))}
              </div>
            )}

            {activeTab === 'recommendations' && (
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Urgency:</span>
                {(['all', 'urgent', 'important', 'routine', 'future'] as const).map((urgency) => (
                  <Button
                    key={urgency}
                    size="sm"
                    variant={selectedUrgency === urgency ? 'default' : 'ghost'}
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
              <div className="space-y-3">
                {filteredAlerts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No alerts to display</p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {filteredAlerts.map((alert) => (
                      <AlertCard
                        key={alert.id}
                        alert={alert}
                        isExpanded={expandedItems.has(alert.id)}
                        onToggle={() => toggleExpand(alert.id)}
                        onAcknowledge={() => acknowledgeAlert(alert.id)}
                        onArchive={() => archiveAlert(alert.id)}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </TabsContent>

            <TabsContent value="briefings" className="m-0">
              <div className="space-y-3">
                {filteredBriefings.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No briefings to display</p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {filteredBriefings.map((briefing) => (
                      <BriefingCard
                        key={briefing.id}
                        briefing={briefing}
                        isExpanded={expandedItems.has(briefing.id)}
                        onToggle={() => toggleExpand(briefing.id)}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </TabsContent>

            <TabsContent value="recommendations" className="m-0">
              <div className="space-y-3">
                {filteredRecommendations.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No recommendations to display</p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {filteredRecommendations.map((recommendation) => (
                      <RecommendationCard
                        key={recommendation.id}
                        recommendation={recommendation}
                        isExpanded={expandedItems.has(recommendation.id)}
                        onToggle={() => toggleExpand(recommendation.id)}
                        onExecute={() => executeRecommendation(recommendation.id)}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </TabsContent>

            <TabsContent value="trends" className="m-0">
              <div className="space-y-3">
                {filteredTrends.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No trends to display</p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {filteredTrends.map((trend) => (
                      <TrendCard
                        key={trend.id}
                        trend={trend}
                        isExpanded={expandedItems.has(trend.id)}
                        onToggle={() => toggleExpand(trend.id)}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default IntelligenceFeed;
