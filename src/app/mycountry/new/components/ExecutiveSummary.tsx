"use client";

import React from 'react';
import { motion } from 'framer-motion';
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
  Shield
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Separator } from '~/components/ui/separator';

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  actionRequired: boolean;
  priority: 'high' | 'medium' | 'low';
}

interface Opportunity {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  timeframe: string;
  category: 'economic' | 'diplomatic' | 'social' | 'governance';
}

interface LeadershipMetric {
  id: string;
  label: string;
  value: number | string;
  trend: 'up' | 'down' | 'stable';
  change: string;
  icon: React.ElementType;
  format: 'number' | 'percentage' | 'currency' | 'text';
}

interface TemporalContext {
  currentGameYear: number;
  currentIxTime: number;
  nextMajorEvent: {
    title: string;
    description: string;
    timeUntil: string;
    type: 'economic' | 'diplomatic' | 'crisis' | 'opportunity';
  } | null;
  recentChanges: Array<{
    id: string;
    title: string;
    impact: string;
    timestamp: number;
    type: 'policy' | 'economic' | 'diplomatic' | 'crisis';
  }>;
  timeAcceleration: number; // IxTime multiplier
}

interface ExecutiveSummaryProps {
  nationalHealth: {
    overallScore: number; // 0-100 composite score
    trendDirection: 'up' | 'down' | 'stable';
    criticalAlerts: Alert[];
    keyOpportunities: Opportunity[];
  };
  leadershipMetrics: LeadershipMetric[];
  temporalContext: TemporalContext;
  countryName: string;
  countryFlag?: string;
  isOwner?: boolean;
  className?: string;
}

function getTrendIcon(trend: 'up' | 'down' | 'stable', size = 16) {
  const props = { size, className: trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-yellow-600' };
  
  switch (trend) {
    case 'up':
      return <TrendingUp {...props} />;
    case 'down':
      return <TrendingDown {...props} />;
    case 'stable':
      return <Minus {...props} />;
  }
}

function getAlertIcon(type: Alert['type']) {
  switch (type) {
    case 'critical':
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    case 'warning':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case 'info':
      return <Zap className="h-4 w-4 text-blue-600" />;
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
  }
}

function getOpportunityIcon(category: Opportunity['category']) {
  switch (category) {
    case 'economic':
      return <DollarSign className="h-4 w-4 text-green-600" />;
    case 'diplomatic':
      return <Globe2 className="h-4 w-4 text-blue-600" />;
    case 'social':
      return <Users className="h-4 w-4 text-purple-600" />;
    case 'governance':
      return <Shield className="h-4 w-4 text-orange-600" />;
  }
}

function formatMetricValue(value: number | string, format: LeadershipMetric['format']) {
  if (typeof value === 'string') return value;
  
  switch (format) {
    case 'currency':
      return `$${value.toLocaleString()}`;
    case 'percentage':
      return `${value}%`;
    case 'number':
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
  className = '',
}: ExecutiveSummaryProps) {
  const getHealthStatus = (score: number) => {
    if (score >= 85) return { label: 'Excellent', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/20' };
    if (score >= 70) return { label: 'Good', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/20' };
    if (score >= 50) return { label: 'Moderate', color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/20' };
    if (score >= 30) return { label: 'Concerning', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/20' };
    return { label: 'Critical', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20' };
  };

  const healthStatus = getHealthStatus(nationalHealth.overallScore);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      className={className}
    >
      <Card className="glass-hierarchy-parent border-0 overflow-hidden bg-gradient-to-br from-amber-700/15 via-amber-600/10 to-amber-400/5 border-l-4 border-l-amber-600">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {countryFlag && (
                <div className="w-12 h-8 rounded overflow-hidden border shadow-sm">
                  <img src={countryFlag} alt={`${countryName} flag`} className="w-full h-full object-cover" />
                </div>
              )}
              <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
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
              <div className="flex items-center gap-2 mb-2">
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
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">National Health Score</span>
              <span className="font-medium">{nationalHealth.overallScore}/100</span>
            </div>
            <Progress 
              value={nationalHealth.overallScore} 
              className="h-3 bg-amber-100 dark:bg-amber-950/20"
              style={{
                background: 'linear-gradient(90deg, #FEF3C7 0%, #FDE68A 100%)',
              }}
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Critical Alerts */}
          {nationalHealth.criticalAlerts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
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
                    key={alert.id && alert.id.trim() ? `alert-${alert.id.trim()}` : `alert-fallback-${index}`}
                    className={`glass-hierarchy-child p-3 rounded-lg border-l-4 ${
                      alert.type === 'critical' ? 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20' :
                      alert.type === 'warning' ? 'border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20' :
                      'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {getAlertIcon(alert.type)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{alert.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {alert.message}
                        </div>
                        {alert.actionRequired && (
                          <Badge variant="destructive" className="text-xs mt-2">
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {leadershipMetrics.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <motion.div
                    key={metric.id && metric.id.trim() ? `metric-${metric.id.trim()}` : `metric-fallback-${index}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="glass-hierarchy-child p-3 rounded-lg text-center hover:scale-105 transition-transform cursor-pointer"
                  >
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Icon className="h-4 w-4 text-amber-600" />
                      {getTrendIcon(metric.trend, 14)}
                    </div>
                    <div className="text-lg font-bold">
                      {formatMetricValue(metric.value, metric.format)}
                    </div>
                    <div className="text-xs text-muted-foreground">{metric.label}</div>
                    <div className="text-xs text-amber-600 mt-1">{metric.change}</div>
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
            <div className="glass-hierarchy-child p-4 rounded-lg space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-amber-700">
                    {temporalContext.currentGameYear}
                  </div>
                  <div className="text-xs text-muted-foreground">Game Year</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-amber-700">
                    {temporalContext.timeAcceleration}x
                  </div>
                  <div className="text-xs text-muted-foreground">Time Acceleration</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-amber-700">
                    {Math.floor(temporalContext.currentIxTime / (1000 * 60 * 60 * 24))}d
                  </div>
                  <div className="text-xs text-muted-foreground">Days Elapsed</div>
                </div>
              </div>

              {temporalContext.nextMajorEvent && (
                <div className="pt-3 border-t border-border">
                  <div className="flex items-start gap-3">
                    <Target className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {temporalContext.nextMajorEvent.title}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {temporalContext.nextMajorEvent.description}
                      </div>
                      <Badge variant="outline" className="text-xs mt-2">
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
                    key={opportunity.id && opportunity.id.trim() ? `opportunity-${opportunity.id.trim()}` : `opportunity-fallback-${index}`}
                    className="glass-hierarchy-child p-3 rounded-lg hover:scale-102 transition-transform cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      {getOpportunityIcon(opportunity.category)}
                      <div className="flex-1">
                        <div className="text-sm font-medium">{opportunity.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {opportunity.description}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
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
                    key={change.id && change.id.trim() ? `change-${change.id.trim()}` : `change-fallback-${index}`}
                    className="flex items-center gap-3 text-sm p-2 rounded bg-muted/30"
                  >
                    <div className="w-2 h-2 bg-amber-600 rounded-full" />
                    <div className="flex-1">
                      <span className="font-medium">{change.title}</span>
                      <span className="text-muted-foreground ml-2">• {change.impact}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
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