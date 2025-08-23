"use client";

import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { 
  TrendingUp, 
  Users, 
  Globe, 
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  MoreHorizontal,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';

interface FocusMetric {
  label: string;
  value: string | number;
  trend: 'up' | 'down' | 'stable';
  change: string;
  target?: number;
  format: 'number' | 'percentage' | 'currency' | 'text';
}

interface FocusAction {
  id: string;
  label: string;
  type: 'policy' | 'budget' | 'diplomatic' | 'emergency';
  enabled: boolean;
  requiresConfirmation: boolean;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  estimatedImpact: {
    economic?: string;
    social?: string;
    diplomatic?: string;
    timeframe: string;
  };
}

interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  urgent: boolean;
}

interface FocusCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  healthScore: number; // 0-100
  status: 'excellent' | 'good' | 'concerning' | 'critical';
  priority: 'high' | 'medium' | 'low';
  metrics: FocusMetric[];
  actions: FocusAction[];
  alerts: Alert[];
  trends: {
    shortTerm: 'improving' | 'declining' | 'stable';
    longTerm: 'improving' | 'declining' | 'stable';
  };
  theme: {
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
  };
}

interface FocusCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  status: 'excellent' | 'good' | 'concerning' | 'critical';
  theme: {
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
  };
  metrics: FocusMetric[];
  quickActions: FocusAction[];
  alerts: Alert[];
  trends: {
    shortTerm: 'improving' | 'declining' | 'stable';
    longTerm: 'improving' | 'declining' | 'stable';
  };
}

interface FocusCardsProps {
  cards: FocusCard[];
  layout?: 'grid' | 'stack' | 'carousel';
  expandable?: boolean;
  interactive?: boolean;
  onCardClick?: (cardId: string) => void;
  onActionClick?: (cardId: string, actionId: string) => void;
  className?: string;
}

function getTrendIcon(trend: 'up' | 'down' | 'stable') {
  switch (trend) {
    case 'up':
      return <ArrowUpRight className="h-4 w-4 text-green-600" />;
    case 'down':
      return <ArrowDownRight className="h-4 w-4 text-red-600" />;
    case 'stable':
      return <Minus className="h-4 w-4 text-yellow-600" />;
  }
}

function getStatusBadge(status: FocusCard['status']) {
  const config = {
    excellent: { label: 'Excellent', variant: 'default' as const, color: 'text-green-600' },
    good: { label: 'Good', variant: 'secondary' as const, color: 'text-blue-600' },
    concerning: { label: 'Needs Attention', variant: 'outline' as const, color: 'text-yellow-600' },
    critical: { label: 'Critical', variant: 'destructive' as const, color: 'text-red-600' },
  };
  
  return (
    <Badge variant={config[status].variant} className={`text-xs ${config[status].color}`}>
      {config[status].label}
    </Badge>
  );
}

function getActionIcon(type: FocusAction['type']) {
  switch (type) {
    case 'policy':
      return <Building2 className="h-4 w-4" />;
    case 'budget':
      return <TrendingUp className="h-4 w-4" />;
    case 'diplomatic':
      return <Globe className="h-4 w-4" />;
    case 'emergency':
      return <AlertTriangle className="h-4 w-4" />;
  }
}

function getUrgencyIndicator(urgency: FocusAction['urgency']) {
  switch (urgency) {
    case 'critical':
      return <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />;
    case 'high':
      return <div className="w-2 h-2 bg-orange-500 rounded-full" />;
    case 'medium':
      return <div className="w-2 h-2 bg-yellow-500 rounded-full" />;
    case 'low':
      return <div className="w-2 h-2 bg-green-500 rounded-full" />;
  }
}

function FocusCardComponent({
  card,
  index,
  expandable = true,
  interactive = true,
  onCardClick,
  onActionClick,
}: {
  card: FocusCard;
  index: number;
  expandable?: boolean;
  interactive?: boolean;
  onCardClick?: (cardId: string) => void;
  onActionClick?: (cardId: string, actionId: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const Icon = card.icon;

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: {
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.4, 0, 0.2, 1],
      }
    },
    hover: {
      y: -4,
      scale: 1.02,
      transition: { duration: 0.2 }
    }
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={interactive ? "hover" : undefined}
      className="w-full"
    >
      <Card 
        className={`glass-hierarchy-child border-0 overflow-hidden cursor-pointer transition-all duration-300`}
        style={{
          background: `linear-gradient(135deg, ${card.theme.bg}15 0%, ${card.theme.primary}08 100%)`,
          borderLeft: `4px solid ${card.theme.primary}`,
        }}
        onClick={() => {
          if (expandable) setExpanded(!expanded);
          onCardClick?.(card.id);
        }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="p-2 rounded-lg"
                style={{ 
                  backgroundColor: `${card.theme.primary}20`,
                  color: card.theme.primary 
                }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  {card.title}
                  {getStatusBadge(card.status)}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {card.description}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-2xl font-bold" style={{ color: card.theme.primary }}>
                  {card.healthScore}%
                </div>
                <div className="text-xs text-muted-foreground">Health Score</div>
              </div>
              {expandable && (
                <Button variant="ghost" size="sm" className="p-1">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Health Score Progress */}
          <div className="mt-3">
            <Progress 
              value={card.healthScore} 
              className="h-2"
              style={{
                background: `${card.theme.primary}20`,
              }}
            />
          </div>

          {/* Alerts */}
          {card.alerts.length > 0 && (
            <div className="mt-3 space-y-2">
              {card.alerts.slice(0, expanded ? undefined : 2).map((alert, alertIndex) => (
                <div
                  key={`alert-${alert.id || 'fallback'}-${alertIndex}`}
                  className={`flex items-center gap-2 p-2 rounded-md text-sm ${
                    alert.type === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300' :
                    alert.type === 'warning' ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300' :
                    alert.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300' :
                    'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                  }`}
                >
                  {alert.type === 'error' && <AlertTriangle className="h-4 w-4" />}
                  {alert.type === 'warning' && <Clock className="h-4 w-4" />}
                  {alert.type === 'success' && <CheckCircle className="h-4 w-4" />}
                  {alert.type === 'info' && <Zap className="h-4 w-4" />}
                  <div>
                    <div className="font-medium">{alert.title}</div>
                    <div className="text-xs opacity-80">{alert.message}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {card.metrics.slice(0, expanded ? undefined : 4).map((metric, i) => (
              <div key={`metric-${card.id || 'fallback'}-${i}`} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {metric.label}
                  </span>
                  {getTrendIcon(metric.trend)}
                </div>
                <div className="text-sm font-semibold">
                  {typeof metric.value === 'number' 
                    ? metric.format === 'currency' 
                      ? `$${metric.value.toLocaleString()}`
                      : metric.format === 'percentage'
                      ? `${metric.value}%`
                      : metric.value.toLocaleString()
                    : metric.value
                  }
                </div>
                <div className="text-xs text-muted-foreground">
                  {metric.change}
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          {expanded && card.actions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
              className="border-t pt-4"
            >
              <div className="text-sm font-medium mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4" style={{ color: card.theme.primary }} />
                Quick Actions
              </div>
              <div className="space-y-2">
                {card.actions.slice(0, 4).map((action, actionIndex) => (
                  <Button
                    key={`action-${action.id || 'fallback'}-${actionIndex}`}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left"
                    disabled={!action.enabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      onActionClick?.(card.id, action.id);
                    }}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {getUrgencyIndicator(action.urgency)}
                      {getActionIcon(action.type)}
                      <div className="flex-1">
                        <div className="text-sm">{action.label}</div>
                        <div className="text-xs text-muted-foreground">
                          Impact: {action.estimatedImpact.economic || action.estimatedImpact.social || action.estimatedImpact.diplomatic} 
                          · {action.estimatedImpact.timeframe}
                        </div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Trend Summary */}
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="border-t pt-4 mt-4"
            >
              <div className="text-sm font-medium mb-2">Trend Analysis</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Short-term:</span>
                  <span className={`capitalize ${
                    card.trends.shortTerm === 'improving' ? 'text-green-600' :
                    card.trends.shortTerm === 'declining' ? 'text-red-600' :
                    'text-yellow-600'
                  }`}>
                    {card.trends.shortTerm}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Long-term:</span>
                  <span className={`capitalize ${
                    card.trends.longTerm === 'improving' ? 'text-green-600' :
                    card.trends.longTerm === 'declining' ? 'text-red-600' :
                    'text-yellow-600'
                  }`}>
                    {card.trends.longTerm}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function FocusCards({
  cards,
  layout = 'grid',
  expandable = true,
  interactive = true,
  onCardClick,
  onActionClick,
  className = '',
}: FocusCardsProps) {
  const layoutClasses = {
    grid: 'grid grid-cols-1 md:grid-cols-2 gap-6',
    stack: 'space-y-4',
    carousel: 'flex gap-4 overflow-x-auto scroll-snap-x snap-mandatory',
  };

  return (
    <div className={`${layoutClasses[layout]} ${className}`}>
      {cards.map((card, index) => (
        <FocusCardComponent
          key={card.id || `card-fallback-${index}`}
          card={card}
          index={index}
          expandable={expandable}
          interactive={interactive}
          onCardClick={onCardClick}
          onActionClick={onActionClick}
        />
      ))}
    </div>
  );
}

// Default focus cards for MyCountry
export function createDefaultFocusCards(countryData: {
  economic: {
    healthScore: number;
    gdpPerCapita: number;
    growthRate: number;
    economicTier: string;
    alerts: Alert[];
  };
  population: {
    healthScore: number;
    population: number;
    growthRate: number;
    populationTier: string;
    alerts: Alert[];
  };
  diplomatic: {
    healthScore: number;
    allies: number;
    reputation: string;
    treaties: number;
    alerts: Alert[];
  };
  government: {
    healthScore: number;
    approval: number;
    efficiency: string;
    stability: string;
    alerts: Alert[];
  };
}): FocusCard[] {
  return [
    {
      id: 'economic-command',
      title: 'Economic Command Center',
      description: 'Monitor and manage your nation\'s economic health and growth',
      icon: TrendingUp,
      healthScore: countryData.economic.healthScore,
      status: countryData.economic.healthScore >= 80 ? 'excellent' : 
              countryData.economic.healthScore >= 60 ? 'good' :
              countryData.economic.healthScore >= 40 ? 'concerning' : 'critical',
      priority: 'high',
      metrics: [
        {
          label: 'GDP per Capita',
          value: countryData.economic.gdpPerCapita,
          trend: 'up',
          change: '+3.2% this quarter',
          format: 'currency',
        },
        {
          label: 'Growth Rate',
          value: countryData.economic.growthRate,
          trend: 'up',
          change: 'Above target',
          format: 'percentage',
        },
        {
          label: 'Economic Tier',
          value: countryData.economic.economicTier,
          trend: 'stable',
          change: 'Next milestone: 2.3 years',
          format: 'text',
        },
        {
          label: 'Trade Balance',
          value: '+$2.1B',
          trend: 'up',
          change: 'Surplus expanding',
          format: 'text',
        },
      ],
      actions: [
        {
          id: 'adjust-tax-policy',
          label: 'Adjust Tax Policy',
          type: 'policy',
          enabled: true,
          requiresConfirmation: false,
          urgency: 'medium',
          estimatedImpact: { economic: '+2%', timeframe: '6 months' },
        },
        {
          id: 'infrastructure-investment',
          label: 'Infrastructure Investment',
          type: 'budget',
          enabled: true,
          requiresConfirmation: true,
          urgency: 'high',
          estimatedImpact: { economic: '+5%', timeframe: '2 years' },
        },
      ],
      quickActions: [
        {
          id: 'economic-boost',
          label: 'Quick Economic Boost',
          type: 'policy',
          enabled: true,
          requiresConfirmation: false,
          urgency: 'medium',
          estimatedImpact: { economic: '+1%', timeframe: '1 month' },
        },
      ],
      alerts: countryData.economic.alerts,
      trends: {
        shortTerm: 'improving',
        longTerm: 'improving',
      },
      theme: {
        primary: '#059669', // Emerald-600 - economy theme
        secondary: '#10B981', // Emerald-500
        accent: '#34D399', // Emerald-400
        bg: 'rgba(5, 150, 105, 0.08)',
      },
    },
    {
      id: 'population-management',
      title: 'Population & Demographics',
      description: 'Oversee population health, growth, and social wellbeing',
      icon: Users,
      healthScore: countryData.population.healthScore,
      status: countryData.population.healthScore >= 80 ? 'excellent' : 
              countryData.population.healthScore >= 60 ? 'good' :
              countryData.population.healthScore >= 40 ? 'concerning' : 'critical',
      priority: 'high',
      metrics: [
        {
          label: 'Population',
          value: (countryData.population.population / 1000000).toFixed(1) + 'M',
          trend: 'up',
          change: '+1.2% annually',
          format: 'text',
        },
        {
          label: 'Growth Rate',
          value: countryData.population.growthRate,
          trend: 'stable',
          change: 'Optimal range',
          format: 'percentage',
        },
        {
          label: 'Population Tier',
          value: `Tier ${countryData.population.populationTier}`,
          trend: 'stable',
          change: 'Stable classification',
          format: 'text',
        },
        {
          label: 'Quality of Life',
          value: '7.8/10',
          trend: 'up',
          change: 'Improving',
          format: 'text',
        },
      ],
      actions: [
        {
          id: 'education-reform',
          label: 'Education System Reform',
          type: 'policy',
          enabled: true,
          requiresConfirmation: true,
          urgency: 'medium',
          estimatedImpact: { social: '+15%', timeframe: '5 years' },
        },
        {
          id: 'healthcare-expansion',
          label: 'Healthcare Expansion',
          type: 'budget',
          enabled: true,
          requiresConfirmation: true,
          urgency: 'high',
          estimatedImpact: { social: '+20%', timeframe: '3 years' },
        },
      ],
      quickActions: [
        {
          id: 'population-initiative',
          label: 'Population Initiative',
          type: 'policy',
          enabled: true,
          requiresConfirmation: false,
          urgency: 'low',
          estimatedImpact: { social: '+2%', timeframe: '6 months' },
        },
      ],
      alerts: countryData.population.alerts,
      trends: {
        shortTerm: 'stable',
        longTerm: 'improving',
      },
      theme: {
        primary: '#0891B2', // Cyan-600 - demographics theme
        secondary: '#06B6D4', // Cyan-500
        accent: '#22D3EE', // Cyan-400
        bg: 'rgba(8, 145, 178, 0.08)',
      },
    },
    {
      id: 'diplomatic-relations',
      title: 'Diplomatic Relations',
      description: 'Manage international relationships and foreign affairs',
      icon: Globe,
      healthScore: countryData.diplomatic.healthScore,
      status: countryData.diplomatic.healthScore >= 80 ? 'excellent' : 
              countryData.diplomatic.healthScore >= 60 ? 'good' :
              countryData.diplomatic.healthScore >= 40 ? 'concerning' : 'critical',
      priority: 'medium',
      metrics: [
        {
          label: 'Active Allies',
          value: countryData.diplomatic.allies,
          trend: 'up',
          change: '+2 this year',
          format: 'number',
        },
        {
          label: 'Reputation',
          value: countryData.diplomatic.reputation,
          trend: 'up',
          change: 'Rising globally',
          format: 'text',
        },
        {
          label: 'Treaties',
          value: countryData.diplomatic.treaties,
          trend: 'stable',
          change: 'Active agreements',
          format: 'number',
        },
        {
          label: 'Trade Partners',
          value: '34',
          trend: 'up',
          change: '+5 new partners',
          format: 'text',
        },
      ],
      actions: [
        {
          id: 'new-trade-agreement',
          label: 'Negotiate Trade Agreement',
          type: 'diplomatic',
          enabled: true,
          requiresConfirmation: true,
          urgency: 'medium',
          estimatedImpact: { diplomatic: '+10%', timeframe: '1 year' },
        },
        {
          id: 'cultural-exchange',
          label: 'Cultural Exchange Program',
          type: 'diplomatic',
          enabled: true,
          requiresConfirmation: false,
          urgency: 'low',
          estimatedImpact: { diplomatic: '+5%', timeframe: '2 years' },
        },
      ],
      quickActions: [
        {
          id: 'diplomatic-outreach',
          label: 'Diplomatic Outreach',
          type: 'diplomatic',
          enabled: true,
          requiresConfirmation: false,
          urgency: 'medium',
          estimatedImpact: { diplomatic: '+3%', timeframe: '3 months' },
        },
      ],
      alerts: countryData.diplomatic.alerts,
      trends: {
        shortTerm: 'improving',
        longTerm: 'stable',
      },
      theme: {
        primary: '#7C3AED', // Violet-600 - government theme
        secondary: '#8B5CF6', // Violet-500
        accent: '#A78BFA', // Violet-400
        bg: 'rgba(124, 58, 237, 0.08)',
      },
    },
    {
      id: 'government-operations',
      title: 'Government Operations',
      description: 'Oversee internal governance and policy effectiveness',
      icon: Building2,
      healthScore: countryData.government.healthScore,
      status: countryData.government.healthScore >= 80 ? 'excellent' : 
              countryData.government.healthScore >= 60 ? 'good' :
              countryData.government.healthScore >= 40 ? 'concerning' : 'critical',
      priority: 'high',
      metrics: [
        {
          label: 'Public Approval',
          value: countryData.government.approval,
          trend: 'up',
          change: '+5% this month',
          format: 'percentage',
        },
        {
          label: 'Efficiency',
          value: countryData.government.efficiency,
          trend: 'stable',
          change: 'Consistent performance',
          format: 'text',
        },
        {
          label: 'Stability',
          value: countryData.government.stability,
          trend: 'stable',
          change: 'Secure governance',
          format: 'text',
        },
        {
          label: 'Policy Success',
          value: '73%',
          trend: 'up',
          change: 'Above average',
          format: 'text',
        },
      ],
      actions: [
        {
          id: 'policy-review',
          label: 'Comprehensive Policy Review',
          type: 'policy',
          enabled: true,
          requiresConfirmation: true,
          urgency: 'medium',
          estimatedImpact: { social: '+8%', timeframe: '1 year' },
        },
        {
          id: 'transparency-initiative',
          label: 'Government Transparency Initiative',
          type: 'policy',
          enabled: true,
          requiresConfirmation: false,
          urgency: 'low',
          estimatedImpact: { social: '+12%', timeframe: '6 months' },
        },
      ],
      quickActions: [
        {
          id: 'government-reform',
          label: 'Quick Reform',
          type: 'policy',
          enabled: true,
          requiresConfirmation: false,
          urgency: 'low',
          estimatedImpact: { social: '+1%', timeframe: '2 months' },
        },
      ],
      alerts: countryData.government.alerts,
      trends: {
        shortTerm: 'stable',
        longTerm: 'improving',
      },
      theme: {
        primary: '#DC2626', // Red-600 - labor theme
        secondary: '#EF4444', // Red-500
        accent: '#F87171', // Red-400
        bg: 'rgba(220, 38, 38, 0.08)',
      },
    },
  ];
}

export default FocusCards;