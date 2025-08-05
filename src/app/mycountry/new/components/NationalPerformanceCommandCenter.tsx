"use client";

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  ArrowUp,
  ArrowDown,
  Zap,
  AlertTriangle,
  CheckCircle,
  Activity,
  BarChart3,
  Users,
  Globe,
  Building2,
  DollarSign,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import type { 
  VitalityIntelligence, 
  IntelligenceMetric,
  ActionableRecommendation,
  IntelligenceComponentProps 
} from '../types/intelligence';

interface NationalPerformanceCommandCenterProps extends IntelligenceComponentProps {
  vitalityData: VitalityIntelligence[];
  onActionClick?: (action: ActionableRecommendation) => void;
  onMetricClick?: (metric: IntelligenceMetric, area: string) => void;
  compact?: boolean;
}

const areaConfig = {
  economic: {
    title: 'Economic Vitality',
    icon: TrendingUp,
    color: 'emerald',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    textColor: 'text-emerald-600',
    progressColor: 'bg-emerald-500'
  },
  population: {
    title: 'Population Wellbeing',
    icon: Users,
    color: 'cyan',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/20',
    borderColor: 'border-cyan-200 dark:border-cyan-800',
    textColor: 'text-cyan-600',
    progressColor: 'bg-cyan-500'
  },
  diplomatic: {
    title: 'Diplomatic Standing',
    icon: Globe,
    color: 'violet',
    bgColor: 'bg-violet-50 dark:bg-violet-950/20',
    borderColor: 'border-violet-200 dark:border-violet-800',
    textColor: 'text-violet-600',
    progressColor: 'bg-violet-500'
  },
  governance: {
    title: 'Governmental Efficiency',
    icon: Building2,
    color: 'red',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
    borderColor: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-600',
    progressColor: 'bg-red-500'
  }
} as const;

const statusConfig = {
  excellent: { 
    color: 'text-green-600', 
    bg: 'bg-green-100 dark:bg-green-950/20',
    label: 'Excellent' 
  },
  good: { 
    color: 'text-blue-600', 
    bg: 'bg-blue-100 dark:bg-blue-950/20',
    label: 'Good' 
  },
  concerning: { 
    color: 'text-yellow-600', 
    bg: 'bg-yellow-100 dark:bg-yellow-950/20',
    label: 'Needs Attention' 
  },
  critical: { 
    color: 'text-red-600', 
    bg: 'bg-red-100 dark:bg-red-950/20',
    label: 'Critical' 
  }
} as const;

function TrendIndicator({ trend, value }: { trend: 'up' | 'down' | 'stable'; value: number }) {
  const Icon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : Minus;
  const colorClass = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600';
  
  const displayValue = value != null && !isNaN(value) ? value : 0;
  
  return (
    <div className={`flex items-center gap-1 ${colorClass}`}>
      <Icon className="h-3 w-3" />
      <span className="text-sm font-medium">
        {trend === 'stable' ? '0' : `${displayValue > 0 ? '+' : ''}${displayValue.toFixed(1)}`}
      </span>
    </div>
  );
}

function PerformanceTile({ 
  vitality, 
  index, 
  compact = false,
  onActionClick,
  onMetricClick 
}: {
  vitality: VitalityIntelligence;
  index: number;
  compact?: boolean;
  onActionClick?: (action: ActionableRecommendation) => void;
  onMetricClick?: (metric: IntelligenceMetric, area: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = areaConfig[vitality.area];
  const statusConf = statusConfig[vitality.status];
  const Icon = config.icon;
  
  const topAction = vitality.recommendations[0];
  const criticalAlertsCount = vitality.criticalAlerts.length;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group"
    >
      <Card className={`glass-hierarchy-child transition-all duration-300 hover:shadow-lg ${config.borderColor} border-l-4`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${config.bgColor} group-hover:scale-110 transition-transform`}>
                <Icon className={`h-6 w-6 ${config.textColor}`} />
              </div>
              
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  {config.title}
                  <Badge className={`text-xs ${statusConf.bg} ${statusConf.color} border-0`}>
                    {statusConf.label}
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-3xl font-bold ${config.textColor}`}>
                      {vitality.score}
                    </span>
                    <span className="text-muted-foreground text-sm">/100</span>
                  </div>
                  <TrendIndicator trend={vitality.trend} value={vitality.change.value} />
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              {criticalAlertsCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {criticalAlertsCount} Alert{criticalAlertsCount !== 1 ? 's' : ''}
                </Badge>
              )}
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Global Rank</div>
                <div className={`text-sm font-bold ${config.textColor}`}>
                  #{vitality.comparisons.rank} / {vitality.comparisons.totalCountries}
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4">
            <Progress value={vitality.score} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Change: {vitality.change.reason}</span>
              <span>{vitality.change.period}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            {vitality.keyMetrics.slice(0, compact ? 2 : 4).map((metric, metricIndex) => (
              <motion.div
                key={`${vitality.area}-metric-${metricIndex}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: (index * 0.1) + (metricIndex * 0.05) }}
                className="p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                onClick={() => onMetricClick?.(metric, vitality.area)}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-medium text-muted-foreground truncate">
                    {metric.label}
                  </span>
                  <TrendIndicator trend={metric.trend} value={metric.changePercent} />
                </div>
                <div className="text-sm font-bold">
                  {typeof metric.value === 'string' ? metric.value : `${metric.value}${metric.unit || ''}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  {metric.changePeriod}
                </div>
                {metric.rank && (
                  <div className="text-xs text-blue-600 mt-1">
                    Rank #{metric.rank.global}
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Forecasts */}
          {!compact && (
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Forecasts</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">3 Months</div>
                  <div className="font-medium">
                    {vitality.forecast?.shortTerm?.projected?.toFixed(0) ?? 'N/A'}/100
                    <span className="text-xs text-muted-foreground ml-1">
                      ({vitality.forecast?.shortTerm?.confidence ?? 0}% confidence)
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">1 Year</div>
                  <div className="font-medium">
                    {vitality.forecast?.longTerm?.projected?.toFixed(0) ?? 'N/A'}/100
                    <span className="text-xs text-muted-foreground ml-1">
                      ({vitality.forecast?.longTerm?.confidence ?? 0}% confidence)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top Action */}
          {topAction && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.15 }}
              className="p-3 rounded-lg border border-dashed border-muted-foreground/30 hover:border-solid hover:border-muted-foreground/60 cursor-pointer transition-all"
              onClick={() => onActionClick?.(topAction)}
            >
              <div className="flex items-start gap-2">
                <Zap className={`h-4 w-4 mt-0.5 ${config.textColor}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">🎯 RECOMMENDED ACTION</span>
                    <Badge variant="outline" className="text-xs">
                      {topAction.urgency}
                    </Badge>
                  </div>
                  <h4 className="font-medium text-sm mb-1">{topAction.title}</h4>
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                    {topAction.description}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Duration: {topAction.estimatedDuration}</span>
                    <span>•</span>
                    <span>Success: {topAction.successProbability}%</span>
                    <span>•</span>
                    <span className="text-green-600 font-medium">{topAction.estimatedBenefit}</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </motion.div>
          )}

          {/* Comparison Context */}
          {!compact && (
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
              <span>Peer Avg: {vitality.comparisons?.peerAverage?.toFixed(0) ?? 'N/A'}</span>
              <span>Regional Avg: {vitality.comparisons?.regionalAverage?.toFixed(0) ?? 'N/A'}</span>
              <span>Personal Best: {vitality.comparisons?.historicalBest?.toFixed(0) ?? 'N/A'}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function NationalPerformanceCommandCenter({
  vitalityData,
  onActionClick,
  onMetricClick,
  compact = false,
  className = '',
  loading = false
}: NationalPerformanceCommandCenterProps) {
  const [viewMode, setViewMode] = useState<'overview' | 'detailed'>('overview');
  
  const overallStats = useMemo(() => {
    const averageScore = vitalityData.reduce((sum, v) => sum + v.score, 0) / vitalityData.length;
    const trendingUp = vitalityData.filter(v => v.trend === 'up').length;
    const criticalAreas = vitalityData.filter(v => v.status === 'critical').length;
    const totalActions = vitalityData.reduce((sum, v) => sum + v.recommendations.length, 0);
    
    return { averageScore, trendingUp, criticalAreas, totalActions };
  }, [vitalityData]);

  if (loading) {
    return (
      <Card className={`glass-hierarchy-child ${className}`}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-3/4"></div>
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className={className}
    >
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                National Performance Command Center
              </CardTitle>
              <p className="text-muted-foreground mt-1">
                Real-time assessment with actionable intelligence
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold">{overallStats.averageScore.toFixed(0)}</div>
                <div className="text-xs text-muted-foreground">Overall Score</div>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <div className="flex items-center gap-1">
                  <ArrowUp className="h-3 w-3 text-green-600" />
                  <span>{overallStats.trendingUp} improving</span>
                </div>
                {overallStats.criticalAreas > 0 && (
                  <div className="flex items-center gap-1 text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    <span>{overallStats.criticalAreas} critical</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className={`grid gap-6 ${
            compact ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'
          }`}>
            {vitalityData.map((vitality, index) => (
              <PerformanceTile
                key={vitality.area}
                vitality={vitality}
                index={index}
                compact={compact}
                onActionClick={onActionClick}
                onMetricClick={onMetricClick}
              />
            ))}
          </div>
          
          {overallStats.totalActions > 4 && (
            <div className="mt-6 text-center">
              <Button variant="outline">
                <Target className="h-4 w-4 mr-2" />
                View All {overallStats.totalActions} Recommendations
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default NationalPerformanceCommandCenter;