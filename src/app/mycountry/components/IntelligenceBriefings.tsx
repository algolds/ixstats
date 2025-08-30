"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle,
  TrendingUp,
  Target,
  Lightbulb,
  Shield,
  Zap,
  Clock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Info,
  ArrowRight,
  Filter,
  BarChart3,
  Users,
  Globe,
  Building2,
  DollarSign
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import type { 
  VitalityIntelligence,
  ActionableRecommendation,
  CriticalAlert,
  DataPriority,
  IntelligenceComponentProps
} from '../types/intelligence';
import { api } from '~/utils/api';
import { ComponentType } from '@prisma/client';

// Enhanced briefing types for focused intelligence display
interface IntelligenceBriefing {
  id: string;
  title: string;
  description: string;
  type: 'hot_issue' | 'opportunity' | 'risk_mitigation' | 'strategic_initiative';
  priority: DataPriority;
  area: 'economic' | 'population' | 'diplomatic' | 'governance';
  confidence: number; // 0-100
  urgency: 'immediate' | 'this_week' | 'this_month' | 'this_quarter';
  impact: {
    magnitude: 'low' | 'medium' | 'high' | 'critical';
    scope: string[];
    timeframe: string;
  };
  evidence: {
    metrics: string[];
    trends: string[];
    comparisons: string[];
  };
  recommendations: ActionableRecommendation[];
  alerts: CriticalAlert[];
  createdAt: number;
  lastUpdated: number;
  tags: string[];
}

interface IntelligenceBriefingsProps extends IntelligenceComponentProps {
  vitalityData: VitalityIntelligence[];
  onBriefingAction?: (briefing: IntelligenceBriefing, action: ActionableRecommendation) => void;
  onBriefingExpand?: (briefing: IntelligenceBriefing) => void;
  maxBriefings?: number;
  filterPriority?: DataPriority[];
  showFilters?: boolean;
}

// Configuration for briefing types
const briefingConfig = {
  hot_issue: {
    title: 'Hot Issues',
    description: 'Critical problems requiring immediate attention',
    icon: AlertTriangle,
    color: 'red',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
    borderColor: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-600',
    badgeColor: 'bg-red-500 text-white'
  },
  opportunity: {
    title: 'Growth Opportunities',
    description: 'Favorable conditions to capitalize on momentum',
    icon: TrendingUp,
    color: 'green',
    bgColor: 'bg-green-50 dark:bg-green-950/20',
    borderColor: 'border-green-200 dark:border-green-800',
    textColor: 'text-green-600',
    badgeColor: 'bg-green-500 text-white'
  },
  risk_mitigation: {
    title: 'Risk Mitigation',
    description: 'Emerging challenges requiring preventive action',
    icon: Shield,
    color: 'yellow',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    textColor: 'text-yellow-600',
    badgeColor: 'bg-yellow-500 text-white'
  },
  strategic_initiative: {
    title: 'Strategic Initiatives',
    description: 'Long-term projects for sustainable development',
    icon: Target,
    color: 'blue',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-600',
    badgeColor: 'bg-blue-500 text-white'
  }
} as const;

const areaConfig = {
  economic: { icon: DollarSign, label: 'Economic', color: 'text-emerald-600' },
  population: { icon: Users, label: 'Population', color: 'text-cyan-600' },
  diplomatic: { icon: Globe, label: 'Diplomatic', color: 'text-violet-600' },
  governance: { icon: Building2, label: 'Governance', color: 'text-red-600' }
} as const;

const urgencyConfig = {
  immediate: { label: 'Immediate', color: 'bg-red-500 text-white', priority: 4 },
  this_week: { label: 'This Week', color: 'bg-orange-500 text-white', priority: 3 },
  this_month: { label: 'This Month', color: 'bg-yellow-500 text-white', priority: 2 },
  this_quarter: { label: 'This Quarter', color: 'bg-blue-500 text-white', priority: 1 }
} as const;

// Smart briefing generator from vitality intelligence
const generateIntelligenceBriefings = (vitalityData: VitalityIntelligence[]): IntelligenceBriefing[] => {
  const briefings: IntelligenceBriefing[] = [];
  const now = Date.now();

  for (const vitality of vitalityData) {
    // Generate Hot Issues from critical alerts
    if (vitality.criticalAlerts.length > 0) {
      briefings.push({
        id: `hot-issue-${vitality.area}-${now}`,
        title: `Critical ${vitality.area.charAt(0).toUpperCase() + vitality.area.slice(1)} Issues`,
        description: `${vitality.criticalAlerts.length} critical alert${vitality.criticalAlerts.length !== 1 ? 's' : ''} requiring immediate action`,
        type: 'hot_issue',
        priority: 'critical',
        area: vitality.area,
        confidence: 95,
        urgency: 'immediate',
        impact: {
          magnitude: 'critical',
          scope: [vitality.area, 'overall stability'],
          timeframe: 'immediate'
        },
        evidence: {
          metrics: vitality.keyMetrics.slice(0, 3).map(m => `${m.label}: ${m.value}${m.unit || ''}`),
          trends: [`Score: ${vitality.score}/100 (${vitality.trend})`],
          comparisons: [`Rank: #${vitality.comparisons.rank}/${vitality.comparisons.totalCountries}`]
        },
        recommendations: vitality.recommendations.filter(r => r.urgency === 'urgent').slice(0, 2),
        alerts: vitality.criticalAlerts,
        createdAt: now,
        lastUpdated: now,
        tags: ['critical', vitality.area, 'urgent']
      });
    }

    // Generate Opportunities from strong performance
    if (vitality.score > 75 && vitality.trend === 'up') {
      const topRecommendations = vitality.recommendations
        .filter(r => r.urgency === 'important')
        .sort((a, b) => b.successProbability - a.successProbability)
        .slice(0, 2);

      if (topRecommendations.length > 0) {
        briefings.push({
          id: `opportunity-${vitality.area}-${now}`,
          title: `${vitality.area.charAt(0).toUpperCase() + vitality.area.slice(1)} Growth Opportunity`,
          description: `Strong performance and positive trends create favorable conditions for strategic advancement`,
          type: 'opportunity',
          priority: 'high',
          area: vitality.area,
          confidence: 85,
          urgency: 'this_month',
          impact: {
            magnitude: 'high',
            scope: [vitality.area, 'regional standing'],
            timeframe: '3-6 months'
          },
          evidence: {
            metrics: vitality.keyMetrics.slice(0, 2).map(m => `${m.label}: ${m.value}${m.unit || ''} (${m.trend})`),
            trends: [`Score improving: ${vitality.change.value > 0 ? '+' : ''}${vitality.change.value.toFixed(1)} points`],
            comparisons: [`Above peer average: ${vitality.comparisons.peerAverage.toFixed(0)}`]
          },
          recommendations: topRecommendations,
          alerts: [],
          createdAt: now,
          lastUpdated: now,
          tags: ['opportunity', vitality.area, 'growth']
        });
      }
    }

    // Generate Risk Mitigation for declining areas
    if (vitality.score < 60 && vitality.trend === 'down') {
      briefings.push({
        id: `risk-${vitality.area}-${now}`,
        title: `${vitality.area.charAt(0).toUpperCase() + vitality.area.slice(1)} Risk Assessment`,
        description: `Declining performance indicators suggest preventive measures are needed`,
        type: 'risk_mitigation',
        priority: 'high',
        area: vitality.area,
        confidence: 80,
        urgency: 'this_week',
        impact: {
          magnitude: 'medium',
          scope: [vitality.area],
          timeframe: '1-3 months'
        },
        evidence: {
          metrics: vitality.keyMetrics.filter(m => m.trend === 'down').map(m => `${m.label}: ${m.value}${m.unit || ''} (declining)`),
          trends: [`Score declining: ${vitality.change.value.toFixed(1)} points`],
          comparisons: [`Below peer average: ${vitality.comparisons.peerAverage.toFixed(0)}`]
        },
        recommendations: vitality.recommendations.filter(r => r.difficulty !== 'major').slice(0, 2),
        alerts: [],
        createdAt: now,
        lastUpdated: now,
        tags: ['risk', vitality.area, 'prevention']
      });
    }

    // Generate Strategic Initiatives for stable, high-performing areas
    if (vitality.score > 60 && vitality.score < 85 && vitality.trend === 'stable') {
      const strategicRecs = vitality.recommendations
        .filter(r => r.difficulty === 'complex' || r.difficulty === 'major')
        .slice(0, 1);

      if (strategicRecs.length > 0) {
        briefings.push({
          id: `strategic-${vitality.area}-${now}`,
          title: `${vitality.area.charAt(0).toUpperCase() + vitality.area.slice(1)} Strategic Development`,
          description: `Stable foundation enables investment in long-term strategic initiatives`,
          type: 'strategic_initiative',
          priority: 'medium',
          area: vitality.area,
          confidence: 70,
          urgency: 'this_quarter',
          impact: {
            magnitude: 'high',
            scope: [vitality.area, 'long-term development'],
            timeframe: '6-24 months'
          },
          evidence: {
            metrics: vitality.keyMetrics.slice(0, 2).map(m => `${m.label}: ${m.value}${m.unit || ''}`),
            trends: [`Stable performance: ${vitality.score}/100`],
            comparisons: [`Competitive position: #${vitality.comparisons.rank}`]
          },
          recommendations: strategicRecs,
          alerts: [],
          createdAt: now,
          lastUpdated: now,
          tags: ['strategic', vitality.area, 'long-term']
        });
      }
    }
  }

  // Sort by priority and urgency
  return briefings
    .sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      
      if (aPriority !== bPriority) return bPriority - aPriority;
      
      const aUrgency = urgencyConfig[a.urgency].priority;
      const bUrgency = urgencyConfig[b.urgency].priority;
      return bUrgency - aUrgency;
    })
    .slice(0, 8); // Limit to top 8 briefings
};

function BriefingCard({ 
  briefing, 
  index, 
  onAction, 
  onExpand 
}: { 
  briefing: IntelligenceBriefing;
  index: number;
  onAction?: (action: ActionableRecommendation) => void;
  onExpand?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = briefingConfig[briefing.type];
  const areaConf = areaConfig[briefing.area];
  const urgencyConf = urgencyConfig[briefing.urgency];
  const Icon = config.icon;
  const AreaIcon = areaConf.icon;

  const handleExpand = useCallback(() => {
    setExpanded(!expanded);
    onExpand?.();
  }, [expanded, onExpand]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group"
    >
      <Card className={`glass-hierarchy-child transition-all duration-300 hover:shadow-lg ${config.borderColor} border-l-4`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className={`p-2 rounded-lg ${config.bgColor} group-hover:scale-110 transition-transform`}>
                <Icon className={`h-5 w-5 ${config.textColor}`} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <CardTitle className="text-lg font-bold line-clamp-1">{briefing.title}</CardTitle>
                  <Badge className={`text-xs ${config.badgeColor}`}>
                    {config.title}
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {briefing.description}
                </p>
                
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <AreaIcon className={`h-3 w-3 ${areaConf.color}`} />
                    <span>{areaConf.label}</span>
                  </div>
                  <Badge className={`${urgencyConf.color} text-xs px-2 py-0`}>
                    {urgencyConf.label}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <BarChart3 className="h-3 w-3 text-muted-foreground" />
                    <span>{briefing.confidence}% confidence</span>
                  </div>
                </div>
              </div>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleExpand}
              className="p-1 hover:bg-muted"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <CardContent className="pt-0 space-y-4">
                {/* Impact Assessment */}
                <div className="bg-muted/30 rounded-lg p-3">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Impact Assessment
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Magnitude:</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {briefing.impact.magnitude}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Timeframe:</span>
                      <span>{briefing.impact.timeframe}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Scope:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {briefing.impact.scope.map((scope, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Evidence */}
                {briefing.evidence.metrics.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Supporting Evidence
                    </h4>
                    <div className="space-y-1 text-sm">
                      {briefing.evidence.metrics.map((metric, i) => (
                        <div key={i} className="text-muted-foreground">• {metric}</div>
                      ))}
                      {briefing.evidence.trends.map((trend, i) => (
                        <div key={i} className="text-muted-foreground">• {trend}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {briefing.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Recommended Actions
                    </h4>
                    <div className="space-y-2">
                      {briefing.recommendations.map((rec, i) => (
                        <div 
                          key={rec.id || `rec-${i}`}
                          className="p-2 rounded border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => onAction?.(rec)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{rec.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {rec.estimatedDuration} • {rec.successProbability}% success rate
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {briefing.tags.map((tag, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

export function IntelligenceBriefings({
  vitalityData,
  onBriefingAction,
  onBriefingExpand,
  maxBriefings = 6,
  filterPriority = ['critical', 'high', 'medium'],
  showFilters = true,
  className = '',
  loading = false,
  countryId
}: IntelligenceBriefingsProps & { countryId?: string }) {
  const [activeTab, setActiveTab] = useState<'all' | 'hot_issue' | 'opportunity' | 'risk_mitigation' | 'strategic_initiative'>('all');
  const [priorityFilter, setPriorityFilter] = useState<DataPriority[]>(filterPriority);

  // Fetch atomic intelligence recommendations
  const { data: atomicRecommendations, isLoading: atomicLoading } = api.countries.getAtomicIntelligenceRecommendations.useQuery(
    { countryId: countryId! },
    { 
      enabled: !!countryId,
      refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
    }
  );

  // Fetch atomic effectiveness
  const { data: atomicEffectiveness } = api.countries.getAtomicEffectiveness.useQuery(
    { countryId: countryId! },
    { enabled: !!countryId }
  );

  // Generate atomic briefings from recommendations
  const atomicBriefings = useMemo(() => {
    if (!atomicRecommendations || !atomicEffectiveness) return [];
    
    const briefings: IntelligenceBriefing[] = [];
    
    // Convert atomic recommendations to briefings
    atomicRecommendations.forEach((rec, index) => {
      let briefingType: IntelligenceBriefing['type'] = 'strategic_initiative';
      let urgency: IntelligenceBriefing['urgency'] = 'this_quarter';
      
      switch (rec.type) {
        case 'component_add':
          briefingType = 'opportunity';
          urgency = rec.priority === 'high' ? 'this_week' : 'this_month';
          break;
        case 'component_improve':
          briefingType = 'strategic_initiative';
          urgency = 'this_month';
          break;
        case 'synergy_opportunity':
          briefingType = 'opportunity';
          urgency = 'this_week';
          break;
        case 'conflict_resolution':
          briefingType = 'risk_mitigation';
          urgency = rec.priority === 'critical' ? 'immediate' : 'this_week';
          break;
      }

      briefings.push({
        id: `atomic-${rec.type}-${index}`,
        title: `🧬 ${rec.title}`,
        description: rec.description,
        type: briefingType,
        priority: rec.priority as DataPriority,
        area: 'governance',
        confidence: 85,
        urgency,
        impact: {
          magnitude: Math.abs(rec.expectedImpact.economic + rec.expectedImpact.stability + rec.expectedImpact.legitimacy),
          timeframe: urgency === 'immediate' ? 'immediate' : 'medium_term',
          sectors: ['governance', 'economic']
        },
        evidence: {
          metrics: [
            `Current effectiveness: ${atomicEffectiveness.overallScore}%`,
            `Components active: ${atomicEffectiveness.componentCount}`,
            rec.expectedImpact.economic > 0 ? `+${rec.expectedImpact.economic}% economic impact` : 
            rec.expectedImpact.economic < 0 ? `${rec.expectedImpact.economic}% economic impact` : '',
            rec.expectedImpact.stability > 0 ? `+${rec.expectedImpact.stability} stability points` : 
            rec.expectedImpact.stability < 0 ? `${rec.expectedImpact.stability} stability points` : '',
            rec.expectedImpact.legitimacy > 0 ? `+${rec.expectedImpact.legitimacy} legitimacy points` : 
            rec.expectedImpact.legitimacy < 0 ? `${rec.expectedImpact.legitimacy} legitimacy points` : ''
          ].filter(Boolean),
          trends: [`Atomic government effectiveness trend`],
          sources: ['Atomic Government Analysis', 'Component Effectiveness Calculator']
        },
        recommendations: [{
          id: `atomic-action-${index}`,
          title: rec.type === 'component_add' ? 'Implement Component' : 
                 rec.type === 'conflict_resolution' ? 'Resolve Conflict' : 'Optimize System',
          description: rec.description,
          priority: rec.priority as DataPriority,
          estimatedDuration: rec.priority === 'critical' ? '1-2 weeks' : 
                           rec.priority === 'high' ? '2-4 weeks' : '1-2 months',
          requiredResources: ['Policy Review', 'Administrative Changes'],
          successProbability: rec.priority === 'high' ? 85 : 
                            rec.priority === 'medium' ? 75 : 65,
          risks: rec.type === 'conflict_resolution' ? 
                 ['System disruption', 'Transition period'] : 
                 ['Implementation challenges', 'Resource allocation']
        }],
        metadata: {
          lastUpdated: new Date(),
          dataFreshness: 95,
          automationLevel: 'full',
          reviewStatus: 'pending'
        }
      });
    });

    return briefings;
  }, [atomicRecommendations, atomicEffectiveness]);

  // Generate briefings with memoization for performance
  const allBriefings = useMemo(() => {
    const vitalityBriefings = generateIntelligenceBriefings(vitalityData);
    return [...atomicBriefings, ...vitalityBriefings];
  }, [vitalityData, atomicBriefings]);

  // Filter briefings based on tab and priority
  const filteredBriefings = useMemo(() => {
    let filtered = allBriefings;
    
    if (activeTab !== 'all') {
      filtered = filtered.filter(b => b.type === activeTab);
    }
    
    filtered = filtered.filter(b => priorityFilter.includes(b.priority));
    
    return filtered.slice(0, maxBriefings);
  }, [allBriefings, activeTab, priorityFilter, maxBriefings]);

  // Count briefings by type for tab badges
  const briefingCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allBriefings.length };
    for (const type of ['hot_issue', 'opportunity', 'risk_mitigation', 'strategic_initiative'] as const) {
      counts[type] = allBriefings.filter(b => b.type === type).length;
    }
    return counts;
  }, [allBriefings]);

  if (loading) {
    return (
      <Card className={`glass-hierarchy-child ${className}`}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/2"></div>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-muted rounded"></div>
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
                <Lightbulb className="h-5 w-5 text-amber-600" />
                Intelligence Briefings
              </CardTitle>
              <p className="text-muted-foreground mt-1">
                Curated insights requiring your attention
              </p>
            </div>
            
            {showFilters && (
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className="text-xs">
                  {filteredBriefings.length} of {allBriefings.length}
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-5 mb-6">
              <TabsTrigger value="all" className="flex items-center gap-1">
                <span className="hidden sm:inline">All</span>
                <Badge variant="secondary" className="text-xs ml-1">
                  {briefingCounts.all}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="hot_issue" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                <span className="hidden sm:inline">Issues</span>
                <Badge variant="secondary" className="text-xs ml-1">
                  {briefingCounts.hot_issue}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="opportunity" className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                <span className="hidden sm:inline">Opportunities</span>
                <Badge variant="secondary" className="text-xs ml-1">
                  {briefingCounts.opportunity}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="risk_mitigation" className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                <span className="hidden sm:inline">Risks</span>
                <Badge variant="secondary" className="text-xs ml-1">
                  {briefingCounts.risk_mitigation}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="strategic_initiative" className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                <span className="hidden sm:inline">Strategic</span>
                <Badge variant="secondary" className="text-xs ml-1">
                  {briefingCounts.strategic_initiative}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-0">
              <div className="space-y-4">
                {filteredBriefings.length > 0 ? (
                  filteredBriefings.map((briefing, index) => (
                    <BriefingCard
                      key={briefing.id && briefing.id.trim() ? `briefing-${briefing.id.trim()}` : `briefing-fallback-${index}`}
                      briefing={briefing}
                      index={index}
                      onAction={(action) => onBriefingAction?.(briefing, action)}
                      onExpand={() => onBriefingExpand?.(briefing)}
                    />
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">No briefings found</p>
                    <p className="text-sm">
                      {activeTab === 'all' 
                        ? 'All areas are performing well with no urgent attention needed.'
                        : `No ${briefingConfig[activeTab as keyof typeof briefingConfig]?.title.toLowerCase()} requiring attention at this time.`
                      }
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default IntelligenceBriefings;