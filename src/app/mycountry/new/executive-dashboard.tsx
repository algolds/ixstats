"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Crown,
  Settings,
  Bell,
  Shield,
  Globe2,
  TrendingUp,
  Users,
  Building2,
  MessageSquare,
  Calendar,
  Zap,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Briefcase,
  FileText,
  Activity,
  Eye,
  Search,
  Filter,
  MoreHorizontal,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Input } from '~/components/ui/input';
import { ActivityRings, createDefaultActivityRings } from './components/ActivityRings';
import { FocusCards, createDefaultFocusCards } from './components/FocusCards';
import { ExecutiveSummary } from './components/ExecutiveSummary';
import { useFlag } from '~/hooks/useFlag';
import type { QuickAction } from '~/types/actions';
import type { IconReference } from '~/types/base';

// Icon lookup system for IconReference resolution
const icons = {
  Crown, Settings, Bell, Shield, Globe2, TrendingUp, Users, Building2,
  MessageSquare, Calendar, Zap, BarChart3, AlertTriangle, CheckCircle,
  Clock, Target, Briefcase, FileText, Activity, Eye, Search, Filter,
  MoreHorizontal, ChevronRight, Sparkles
} as const;

// Helper function to resolve IconReference to React component
function resolveIcon(iconRef: IconReference | string) {
  if (typeof iconRef === 'string') {
    return icons[iconRef as keyof typeof icons] || icons.Activity;
  }
  return icons[iconRef.name as keyof typeof icons] || icons.Activity;
}

interface IntelligenceFeedItem {
  id: string;
  type: 'alert' | 'opportunity' | 'update' | 'prediction';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  category: 'economic' | 'diplomatic' | 'social' | 'security' | 'governance';
  timestamp: number;
  actionable: boolean;
  source: string;
}

interface CountryData {
  id: string;
  name: string;
  flag?: string;
  
  // Core metrics
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
  populationTier: string;
  
  // Vitality scores (0-100)
  economicVitality: number;
  populationWellbeing: number;
  diplomaticStanding: number;
  governmentalEfficiency: number;
  
  // Growth rates
  populationGrowthRate: number;
  realGDPGrowthRate: number;
  adjustedGdpGrowth: number;
  
  // Additional data
  region: string;
  continent: string;
  landArea?: number;
  lastCalculated: number;
  baselineDate: number;
}

interface ExecutiveDashboardProps {
  country: CountryData;
  intelligenceFeed: IntelligenceFeedItem[];
  quickActions: QuickAction[];
  currentIxTime: number;
  timeAcceleration: number;
  isLoading?: boolean;
  onActionClick?: (actionId: string) => void;
  onFocusAreaClick?: (areaId: string) => void;
  onSettingsClick?: () => void;
  className?: string;
}

function IntelligenceFeedCard({ items }: { items: IntelligenceFeedItem[] }) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'actionable'>('all');
  
  const filteredItems = items
    .filter(item => {
      if (filter === 'critical') return item.severity === 'critical';
      if (filter === 'actionable') return item.actionable;
      return true;
    })
    .slice(0, 8);

  const getSeverityColor = (severity: IntelligenceFeedItem['severity']) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 dark:bg-red-950/20';
      case 'high': return 'text-orange-600 bg-orange-50 dark:bg-orange-950/20';
      case 'medium': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20';
      case 'low': return 'text-blue-600 bg-blue-50 dark:bg-blue-950/20';
    }
  };

  const getTypeIcon = (type: IntelligenceFeedItem['type']) => {
    switch (type) {
      case 'alert': return <AlertTriangle className="h-4 w-4" />;
      case 'opportunity': return <Target className="h-4 w-4" />;
      case 'update': return <Activity className="h-4 w-4" />;
      case 'prediction': return <TrendingUp className="h-4 w-4" />;
    }
  };

  return (
    <Card className="glass-hierarchy-child h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Intelligence Feed
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'critical' ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setFilter('critical')}
            >
              Critical
            </Button>
            <Button
              variant={filter === 'actionable' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setFilter('actionable')}
            >
              Actionable
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 max-h-96 overflow-y-auto">
        <AnimatePresence>
          {filteredItems.map((item, index) => (
            <motion.div
              key={item.id ? `item-${item.id}` : `item-fallback-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className={`p-3 rounded-lg border-l-4 cursor-pointer hover:scale-102 transition-transform ${
                item.severity === 'critical' ? 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20' :
                item.severity === 'high' ? 'border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20' :
                item.severity === 'medium' ? 'border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20' :
                'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-1 rounded ${getSeverityColor(item.severity)}`}>
                  {getTypeIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{item.title}</span>
                    {item.actionable && (
                      <Badge variant="outline" className="text-xs">
                        Action Required
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {item.description}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{item.source}</span>
                    <span>•</span>
                    <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                    <span>•</span>
                    <Badge variant="outline" className="text-xs capitalize px-1 py-0">
                      {item.category}
                    </Badge>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

function QuickActionsPanel({ actions, onActionClick }: { 
  actions: QuickAction[];
  onActionClick?: (actionId: string) => void;
}) {
  const getUrgencyColor = (urgency: QuickAction['urgency']) => {
    switch (urgency) {
      case 'critical': return 'border-red-500 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300';
      case 'high': return 'border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300';
      case 'medium': return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-300';
      case 'low': return 'border-green-500 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300';
    }
  };

  const urgentActions = actions.filter(a => a.urgency === 'critical' || a.urgency === 'high').slice(0, 6);

  return (
    <Card className="glass-hierarchy-child">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-600" />
          Executive Actions
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          High-priority actions requiring your attention
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {urgentActions.map((action, index) => {
          const Icon = resolveIcon(action.icon);
          return (
            <motion.div
              key={action.id ? `action-${action.id}` : `action-fallback-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Button
                variant="outline"
                className={`w-full justify-start p-4 h-auto border-l-4 ${getUrgencyColor(action.urgency)}`}
                disabled={!action.enabled}
                onClick={() => onActionClick?.(action.id)}
              >
                <div className="flex items-start gap-3 flex-1 text-left">
                  <Icon className="h-5 w-5 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-sm mb-1">{action.title}</div>
                    <div className="text-xs opacity-80 mb-2">{action.description}</div>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-xs capitalize">
                        {action.category}
                      </Badge>
                      <span>•</span>
                      <span>{action.estimatedTime}</span>
                      <span>•</span>
                      <span className="font-medium">{action.impact}</span>
                    </div>
                  </div>
                </div>
              </Button>
            </motion.div>
          );
        })}
        
        <Button variant="ghost" className="w-full mt-4">
          <MoreHorizontal className="h-4 w-4 mr-2" />
          View All Actions
        </Button>
      </CardContent>
    </Card>
  );
}

export function ExecutiveDashboard({
  country,
  intelligenceFeed,
  quickActions,
  currentIxTime,
  timeAcceleration,
  isLoading = false,
  onActionClick,
  onFocusAreaClick,
  onSettingsClick,
  className = '',
}: ExecutiveDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  
  // Load country flag
  const { flagUrl, isLoading: flagLoading } = useFlag(country.name);
  
  // Convert intelligence feed to notifications format
  const notifications = intelligenceFeed.map(item => ({
    ...item,
    read: false,
  }));

  // Create sample data for components
  const executiveSummaryData = {
    nationalHealth: {
      overallScore: Math.round((country.economicVitality + country.populationWellbeing + country.diplomaticStanding + country.governmentalEfficiency) / 4),
      trendDirection: 'up' as const,
      criticalAlerts: intelligenceFeed.filter(item => item.severity === 'critical').slice(0, 3).map(item => ({
        id: item.id,
        createdAt: item.timestamp,
        category: item.category as any,
        source: 'intelligence-feed',
        confidence: 85,
        actionable: item.actionable,
        title: item.title,
        message: item.description,
        severity: item.severity as any,
        actionRequired: item.actionable,
        timeframe: 'immediate' as const,
        estimatedImpact: {
          magnitude: item.severity as any,
          areas: [item.category],
        },
        recommendedActions: ['Review details', 'Take action'],
      })),
      keyOpportunities: [
        {
          id: '1',
          title: 'Economic Diversification Initiative',
          description: 'Expand into renewable energy sector',
          impact: 'high' as const,
          timeframe: '2-3 years',
          category: 'economic' as const,
        },
        {
          id: '2',
          title: 'Educational Reform Program',
          description: 'Modernize curriculum and infrastructure',
          impact: 'high' as const,
          timeframe: '3-5 years',
          category: 'social' as const,
        },
      ],
    },
    leadershipMetrics: [
      {
        id: 'pending-decisions',
        label: 'Decisions Pending',
        value: intelligenceFeed.filter(item => item.actionable).length,
        trend: 'stable' as const,
        change: '3 new today',
        icon: Clock,
        format: 'number' as const,
      },
      {
        id: 'active-policies',
        label: 'Active Policies',
        value: 42,
        trend: 'up' as const,
        change: '+2 this month',
        icon: FileText,
        format: 'number' as const,
      },
      {
        id: 'diplomatic-messages',
        label: 'Diplomatic Messages',
        value: 7,
        trend: 'up' as const,
        change: '5 unread',
        icon: MessageSquare,
        format: 'number' as const,
      },
      {
        id: 'approval-rating',
        label: 'Approval Rating',
        value: 73,
        trend: 'up' as const,
        change: '+2% this week',
        icon: TrendingUp,
        format: 'percentage' as const,
      },
    ],
    temporalContext: {
      currentGameYear: new Date().getFullYear() + Math.floor(currentIxTime / (365 * 24 * 60 * 60 * 1000)),
      currentIxTime,
      nextMajorEvent: {
        title: 'Quarterly Economic Review',
        description: 'Comprehensive assessment of economic policies and their effectiveness',
        timeUntil: '15 days',
        type: 'economic' as const,
      },
      recentChanges: [
        {
          id: '1',
          title: 'Tax Policy Adjustment',
          impact: '+0.5% GDP growth projected',
          timestamp: Date.now() - 86400000,
          type: 'policy' as const,
        },
        {
          id: '2',
          title: 'Trade Agreement Signed',
          impact: 'Enhanced diplomatic relations',
          timestamp: Date.now() - 172800000,
          type: 'diplomatic' as const,
        },
      ],
      timeAcceleration,
    },
  };

  const activityRingsData = createDefaultActivityRings({
    economicVitality: country.economicVitality,
    populationWellbeing: country.populationWellbeing,
    diplomaticStanding: country.diplomaticStanding,
    governmentalEfficiency: country.governmentalEfficiency,
    economicMetrics: {
      gdpPerCapita: `$${(country.currentGdpPerCapita / 1000).toFixed(0)}k`,
      growthRate: `${(country.realGDPGrowthRate * 100).toFixed(1)}%`,
      tier: country.economicTier,
    },
    populationMetrics: {
      population: `${(country.currentPopulation / 1000000).toFixed(1)}M`,
      growthRate: `${(country.populationGrowthRate * 100).toFixed(1)}%`,
      tier: country.populationTier,
    },
    diplomaticMetrics: {
      allies: '12',
      reputation: 'Rising',
      treaties: '8',
    },
    governmentMetrics: {
      approval: '73%',
      efficiency: 'High',
      stability: 'Stable',
    },
  });

  const focusCardsData = createDefaultFocusCards({
    economic: {
      healthScore: country.economicVitality,
      gdpPerCapita: country.currentGdpPerCapita,
      growthRate: country.realGDPGrowthRate * 100,
      economicTier: country.economicTier,
      alerts: [],
    },
    population: {
      healthScore: country.populationWellbeing,
      population: country.currentPopulation,
      growthRate: country.populationGrowthRate * 100,
      populationTier: country.populationTier,
      alerts: [],
    },
    diplomatic: {
      healthScore: country.diplomaticStanding,
      allies: 12,
      reputation: 'Rising',
      treaties: 8,
      alerts: [],
    },
    government: {
      healthScore: country.governmentalEfficiency,
      approval: 73,
      efficiency: 'High',
      stability: 'Stable',
      alerts: [],
    },
  });

  return (
    <div className={`space-y-6 ${className} relative`}>
      {/* Notifications now handled by global command palette */}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          {flagUrl && (
            <div className="w-12 h-8 rounded overflow-hidden border shadow-sm">
              <img src={flagUrl} alt={`${country.name} flag`} className="w-full h-full object-cover" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Crown className="h-8 w-8 text-amber-600" />
              Executive Command Center
            </h1>
            <p className="text-muted-foreground">
              {country.name} • Real-time National Intelligence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Globe2 className="h-4 w-4 mr-2" />
            Public View
          </Button>
          <Button variant="outline" size="sm" onClick={onSettingsClick}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </motion.div>

      {/* Main Dashboard */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="intelligence" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Intelligence</span>
          </TabsTrigger>
          <TabsTrigger value="management" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Management</span>
          </TabsTrigger>
          <TabsTrigger value="communications" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Communications</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Executive Summary */}
          <ExecutiveSummary
            nationalHealth={executiveSummaryData.nationalHealth}
            leadershipMetrics={executiveSummaryData.leadershipMetrics}
            temporalContext={executiveSummaryData.temporalContext}
            countryName={country.name}
            countryFlag={country.flag}
            isOwner={true}
          />

          {/* Activity Rings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="glass-hierarchy-child">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-600" />
                  National Vitality Monitor
                </CardTitle>
                <p className="text-muted-foreground">
                  Real-time health indicators across all management areas
                </p>
              </CardHeader>
              <CardContent className="py-8">
                <ActivityRings
                  rings={activityRingsData}
                  size="md"
                  interactive={true}
                  onRingClick={onFocusAreaClick}
                  className="justify-center"
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* Intelligence Feed and Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <IntelligenceFeedCard items={intelligenceFeed} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <QuickActionsPanel 
                actions={quickActions} 
                onActionClick={onActionClick}
              />
            </motion.div>
          </div>
        </TabsContent>

        <TabsContent value="intelligence" className="space-y-6">
          <Card className="glass-hierarchy-parent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                National Intelligence Center
              </CardTitle>
              <p className="text-muted-foreground">
                Comprehensive intelligence analysis and threat assessment
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <Input placeholder="Search intelligence reports..." className="flex-1" />
                  <Button variant="outline">
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                  <Button variant="outline">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </div>
                
                <IntelligenceFeedCard items={intelligenceFeed} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="management" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <FocusCards
              cards={focusCardsData}
              layout="grid"
              expandable={true}
              interactive={true}
              onCardClick={onFocusAreaClick}
              onActionClick={(cardId, actionId) => onActionClick?.(actionId)}
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="communications" className="space-y-6">
          <Card className="glass-hierarchy-parent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-green-600" />
                Secure Communications Hub
              </CardTitle>
              <p className="text-muted-foreground">
                Diplomatic communications and international correspondence
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Communications Center</h3>
                <p className="text-muted-foreground mb-6">
                  Secure diplomatic messaging and international communications
                </p>
                <Button>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Open Communications
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card className="glass-hierarchy-parent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-600" />
                Advanced Analytics Suite
              </CardTitle>
              <p className="text-muted-foreground">
                Predictive modeling and strategic intelligence analysis
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Analytics Dashboard</h3>
                <p className="text-muted-foreground mb-6">
                  Advanced predictive modeling and strategic analysis tools
                </p>
                <Button>
                  <Activity className="h-4 w-4 mr-2" />
                  Open Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card className="glass-hierarchy-parent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-gray-600" />
                Executive Settings
              </CardTitle>
              <p className="text-muted-foreground">
                Configure dashboard preferences and system settings
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Settings Panel</h3>
                <p className="text-muted-foreground mb-6">
                  Customize your executive dashboard experience
                </p>
                <Button>
                  <Settings className="h-4 w-4 mr-2" />
                  Open Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ExecutiveDashboard;