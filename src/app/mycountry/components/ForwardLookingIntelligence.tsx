"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp,
  TrendingDown,
  Sparkles,
  Target,
  Radar,
  Brain,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  BarChart3,
  Users,
  Globe,
  Building2,
  DollarSign,
  Calendar,
  Zap,
  Eye,
  ChevronRight,
  Activity,
  Award,
  Flag
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import type { 
  VitalityIntelligence,
  ForwardIntelligence,
  IntelligenceComponentProps
} from '../types/intelligence';

// Enhanced prediction types
interface PredictiveInsight {
  id: string;
  title: string;
  description: string;
  category: 'forecast' | 'scenario' | 'milestone' | 'competitive';
  area: 'economic' | 'population' | 'diplomatic' | 'governance' | 'global';
  timeHorizon: '3_months' | '6_months' | '1_year' | '2_years';
  probability: number; // 0-100
  impact: 'positive' | 'negative' | 'neutral';
  magnitude: 'low' | 'medium' | 'high' | 'transformative';
  confidence: number; // 0-100
  evidence: string[];
  implications: string[];
  preparationSteps: string[];
  createdAt: number;
  relevanceScore: number; // 0-100, how relevant to current situation
}

interface CompetitiveIntel {
  id: string;
  title: string;
  targetCountry: string;
  relationship: 'peer' | 'competitor' | 'ally' | 'regional_power';
  insights: string[];
  implications: string[];
  recommendedResponse: string;
  urgency: 'monitor' | 'respond' | 'immediate';
  lastUpdate: number;
}

interface MilestoneTracking {
  id: string;
  title: string;
  description: string;
  area: 'economic' | 'population' | 'diplomatic' | 'governance';
  targetDate: number;
  progress: number; // 0-100
  status: 'on_track' | 'at_risk' | 'delayed' | 'accelerated';
  requirements: string[];
  blockers: string[];
  nextMilestone: string;
}

interface ForwardLookingIntelligenceProps extends IntelligenceComponentProps {
  vitalityData: VitalityIntelligence[];
  forwardIntelligence?: ForwardIntelligence;
  timeHorizon?: '3_months' | '6_months' | '1_year' | '2_years';
  onInsightAction?: (insight: PredictiveInsight) => void;
  onMilestoneUpdate?: (milestone: MilestoneTracking) => void;
  compact?: boolean;
}

const horizonConfig = {
  '3_months': { label: '3 Months', days: 90, priority: 4 },
  '6_months': { label: '6 Months', days: 180, priority: 3 },
  '1_year': { label: '1 Year', days: 365, priority: 2 },
  '2_years': { label: '2+ Years', days: 730, priority: 1 }
} as const;

const impactConfig = {
  positive: { 
    color: 'text-green-600', 
    bg: 'bg-green-50 dark:bg-green-950/20',
    icon: TrendingUp
  },
  negative: { 
    color: 'text-red-600', 
    bg: 'bg-red-50 dark:bg-red-950/20',
    icon: TrendingDown
  },
  neutral: { 
    color: 'text-blue-600', 
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    icon: Activity
  }
} as const;

const areaIcons = {
  economic: DollarSign,
  population: Users,
  diplomatic: Globe,
  governance: Building2,
  global: Sparkles
} as const;

// Generate forward-looking insights from vitality data
const generatePredictiveInsights = (vitalityData: VitalityIntelligence[]): PredictiveInsight[] => {
  const insights: PredictiveInsight[] = [];
  const now = Date.now();

  for (const vitality of vitalityData) {
    const shortTermForecast = vitality.forecast?.shortTerm ?? { projected: 0, confidence: 0, factors: [] };
    const longTermForecast = vitality.forecast?.longTerm ?? { projected: 0, confidence: 0, factors: [] };

    // Generate short-term forecast
    if ((shortTermForecast.projected ?? 0) !== (vitality.score ?? 0)) {
      const difference = (shortTermForecast.projected ?? 0) - (vitality.score ?? 0);
      const isPositive = difference > 0;
      
      insights.push({
        id: `forecast-${vitality.area}-3m-${now}`,
        title: `${vitality.area.charAt(0).toUpperCase() + vitality.area.slice(1)} ${isPositive ? 'Growth' : 'Decline'} Projected`,
        description: `Models predict ${isPositive ? 'improvement' : 'deterioration'} to ${(shortTermForecast.projected ?? 0).toFixed(0)}/100 within 3 months`,
        category: 'forecast',
        area: vitality.area,
        timeHorizon: '3_months',
        probability: shortTermForecast.confidence ?? 0,
        impact: isPositive ? 'positive' : 'negative',
        magnitude: Math.abs(difference ?? 0) > 10 ? 'high' : Math.abs(difference ?? 0) > 5 ? 'medium' : 'low',
        confidence: shortTermForecast.confidence ?? 0,
        evidence: shortTermForecast.factors ?? [],
        implications: [
          `${isPositive ? 'Potential' : 'Risk of'} ${Math.abs(difference ?? 0).toFixed(0)} point ${isPositive ? 'gain' : 'loss'}`,
          `Global ranking ${isPositive ? 'improvement' : 'decline'} possible`,
          `${isPositive ? 'Opportunities' : 'Challenges'} in ${vitality.area} sector`
        ],
        preparationSteps: [
          `Monitor ${vitality.area} key metrics closely`,
          `Prepare ${isPositive ? 'expansion' : 'mitigation'} strategies`,
          `Review resource allocation for ${vitality.area}`
        ],
        createdAt: now,
        relevanceScore: Math.min(100, 50 + Math.abs(difference ?? 0) * 5 + (shortTermForecast.confidence ?? 0) / 2)
      });
    }

    // Generate long-term scenarios for significant changes
    if (Math.abs((longTermForecast.projected ?? 0) - (vitality.score ?? 0)) > 8) {
      const difference = (longTermForecast.projected ?? 0) - (vitality.score ?? 0);
      const isPositive = difference > 0;
      
      insights.push({
        id: `scenario-${vitality.area}-1y-${now}`,
        title: `Long-term ${vitality.area.charAt(0).toUpperCase() + vitality.area.slice(1)} Scenario`,
        description: `Current trends suggest ${isPositive ? 'significant advancement' : 'major challenges'} by next year`,
        category: 'scenario',
        area: vitality.area,
        timeHorizon: '1_year',
        probability: longTermForecast.confidence ?? 0,
        impact: isPositive ? 'positive' : 'negative',
        magnitude: Math.abs(difference ?? 0) > 20 ? 'transformative' : Math.abs(difference ?? 0) > 15 ? 'high' : 'medium',
        confidence: longTermForecast.confidence ?? 0,
        evidence: longTermForecast.factors ?? [],
        implications: [
          `Potential ${Math.abs(difference ?? 0).toFixed(0)} point ${isPositive ? 'improvement' : 'decline'}`,
          `${isPositive ? 'Leadership' : 'Recovery'} position in regional context`,
          `Strategic ${isPositive ? 'expansion' : 'restructuring'} opportunities`
        ],
        preparationSteps: [
          `Develop long-term ${vitality.area} strategy`,
          `Build institutional capacity`,
          `Secure stakeholder alignment`
        ],
        createdAt: now,
        relevanceScore: Math.min(100, 40 + Math.abs(difference ?? 0) * 3 + (longTermForecast.confidence ?? 0) / 3)
      });
    }
  }

  // Generate competitive intelligence
  insights.push({
    id: `competitive-regional-${now}`,
    title: 'Regional Competition Analysis',
    description: 'Peer nations are implementing similar strategies, requiring differentiation',
    category: 'competitive',
    area: 'global',
    timeHorizon: '6_months',
    probability: 85,
    impact: 'neutral',
    magnitude: 'medium',
    confidence: 75,
    evidence: [
      'Similar policy implementations across region',
      'Competitive economic initiatives launched',
      'Diplomatic partnerships being formed'
    ],
    implications: [
      'Need for unique value proposition',
      'Potential collaboration opportunities',
      'Risk of being left behind in regional initiatives'
    ],
    preparationSteps: [
      'Identify unique competitive advantages',
      'Explore partnership opportunities',
      'Monitor competitor strategies closely'
    ],
    createdAt: now,
    relevanceScore: 70
  });

  // Sort by relevance and time horizon
  return insights
    .sort((a, b) => {
      const aHorizonPriority = horizonConfig[a.timeHorizon].priority;
      const bHorizonPriority = horizonConfig[b.timeHorizon].priority;
      
      if (aHorizonPriority !== bHorizonPriority) {
        return bHorizonPriority - aHorizonPriority;
      }
      
      return b.relevanceScore - a.relevanceScore;
    })
    .slice(0, 12);
};

// Generate milestone tracking
const generateMilestoneTracking = (vitalityData: VitalityIntelligence[]): MilestoneTracking[] => {
  const milestones: MilestoneTracking[] = [];
  const now = Date.now();

  for (const vitality of vitalityData) {
    if ((vitality.score ?? 0) < 80) {
      milestones.push({
        id: `milestone-${vitality.area}-${now}`,
        title: `${vitality.area.charAt(0).toUpperCase() + vitality.area.slice(1)} Excellence Achievement`,
        description: `Reach top-tier performance (80+) in ${vitality.area}`,
        area: vitality.area,
        targetDate: now + (365 * 24 * 60 * 60 * 1000), // 1 year from now
        progress: ((vitality.score ?? 0) / 80) * 100,
        status: vitality.trend === 'up' ? 'on_track' : vitality.trend === 'down' ? 'at_risk' : 'on_track',
        requirements: [
          `Implement ${(vitality.recommendations ?? []).length} recommended actions`,
          `Maintain consistent improvement trend`,
          `Address all critical alerts`
        ],
        blockers: (vitality.criticalAlerts ?? []).map(alert => alert.title),
        nextMilestone: `Reach ${((vitality.score ?? 0) + 10).toFixed(0)}/100 score`
      });
    }
  }

  return milestones.slice(0, 4);
};

function PredictiveInsightCard({ 
  insight, 
  index, 
  onAction 
}: { 
  insight: PredictiveInsight;
  index: number;
  onAction?: (insight: PredictiveInsight) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const impactConf = impactConfig[insight.impact];
  const horizonConf = horizonConfig[insight.timeHorizon];
  const AreaIcon = areaIcons[insight.area];
  const ImpactIcon = impactConf.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`p-3 rounded-lg border border-border hover:shadow-sm transition-all cursor-pointer ${impactConf.bg}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-background/80`}>
          <AreaIcon className={`h-4 w-4 ${impactConf.color}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm line-clamp-1">{insight.title}</h4>
            <ImpactIcon className={`h-3 w-3 ${impactConf.color}`} />
          </div>
          
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
            {insight.description}
          </p>
          
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="px-1 py-0">
              {horizonConf.label}
            </Badge>
            <span className="text-muted-foreground">
              {insight.probability}% probability
            </span>
            <span className="text-muted-foreground">•</span>
            <span className={`capitalize ${impactConf.color}`}>
              {insight.magnitude} impact
            </span>
          </div>
        </div>
        
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-border space-y-2"
          >
            {insight.implications.length > 0 && (
              <div>
                <div className="font-medium text-xs mb-1">Key Implications:</div>
                {insight.implications.slice(0, 2).map((implication, i) => (
                  <div key={i} className="text-xs text-muted-foreground">• {implication}</div>
                ))}
              </div>
            )}
            
            {onAction && (
              <Button 
                size="sm" 
                variant="outline" 
                className="text-xs h-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onAction(insight);
                }}
              >
                <Zap className="h-3 w-3 mr-1" />
                Prepare Strategy
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MilestoneCard({ 
  milestone, 
  onUpdate 
}: { 
  milestone: MilestoneTracking;
  onUpdate?: (milestone: MilestoneTracking) => void;
}) {
  const statusConfig = {
    on_track: { color: 'text-green-600', bg: 'bg-green-100', label: 'On Track' },
    at_risk: { color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'At Risk' },
    delayed: { color: 'text-red-600', bg: 'bg-red-100', label: 'Delayed' },
    accelerated: { color: 'text-blue-600', bg: 'bg-blue-100', label: 'Accelerated' }
  };
  
  const config = statusConfig[milestone.status];
  const AreaIcon = areaIcons[milestone.area];

  return (
    <div className="p-3 rounded-lg border border-border bg-card">
      <div className="flex items-start gap-3 mb-3">
        <AreaIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm">{milestone.title}</h4>
            <Badge className={`text-xs ${config.bg} ${config.color} border-0`}>
              {config.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{milestone.description}</p>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span>Progress</span>
          <span>{(milestone.progress ?? 0).toFixed(0)}%</span>
        </div>
        <Progress value={milestone.progress ?? 0} className="h-2" />
        
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Target: {new Date(milestone.targetDate).toLocaleDateString()}</span>
          <span>{milestone.requirements.length} requirements</span>
        </div>
      </div>
      
      {milestone.blockers.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border">
          <div className="text-xs font-medium text-red-600 mb-1">Blockers:</div>
          <div className="text-xs text-muted-foreground">
            {milestone.blockers.slice(0, 2).join(', ')}
            {milestone.blockers.length > 2 && '...'}
          </div>
        </div>
      )}
    </div>
  );
}

export function ForwardLookingIntelligence({
  vitalityData,
  forwardIntelligence,
  timeHorizon = '6_months',
  onInsightAction,
  onMilestoneUpdate,
  compact = false,
  className = '',
  loading = false
}: ForwardLookingIntelligenceProps) {
  const [activeTab, setActiveTab] = useState<'predictions' | 'milestones' | 'competitive'>('predictions');

  // Generate insights with memoization
  const predictiveInsights = useMemo(() => 
    generatePredictiveInsights(vitalityData), 
    [vitalityData]
  );

  const milestones = useMemo(() => 
    generateMilestoneTracking(vitalityData),
    [vitalityData]
  );

  // Filter insights by time horizon
  const filteredInsights = useMemo(() => 
    predictiveInsights.filter(insight => 
      timeHorizon === '2_years' || 
      horizonConfig[insight.timeHorizon].days <= horizonConfig[timeHorizon].days
    ),
    [predictiveInsights, timeHorizon]
  );

  if (loading) {
    return (
      <Card className={`glass-hierarchy-child ${className}`}>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6 }}
      className={className}
    >
      <Card className="glass-hierarchy-child">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Forward Intelligence
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Predictive insights and strategic planning
          </p>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="predictions" className="flex items-center gap-1">
                <Brain className="h-3 w-3" />
                <span className="hidden sm:inline">Predictions</span>
                <Badge variant="secondary" className="text-xs ml-1">
                  {filteredInsights.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="milestones" className="flex items-center gap-1">
                <Flag className="h-3 w-3" />
                <span className="hidden sm:inline">Milestones</span>
                <Badge variant="secondary" className="text-xs ml-1">
                  {milestones.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="competitive" className="flex items-center gap-1">
                <Radar className="h-3 w-3" />
                <span className="hidden sm:inline">Intel</span>
                <Badge variant="secondary" className="text-xs ml-1">
                  2
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="predictions" className="mt-0">
              <div className="space-y-3">
                {filteredInsights.length > 0 ? (
                  filteredInsights.slice(0, compact ? 4 : 8).map((insight, index) => (
                    <PredictiveInsightCard
                      key={insight.id && insight.id.trim() ? `insight-${insight.id.trim()}` : `insight-fallback-${index}`}
                      insight={insight}
                      index={index}
                      onAction={onInsightAction}
                    />
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No significant predictions for this timeframe</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="milestones" className="mt-0">
              <div className="space-y-3">
                {milestones.map((milestone, index) => (
                  <MilestoneCard
                    key={milestone.id && milestone.id.trim() ? `milestone-${milestone.id.trim()}` : `milestone-fallback-${index}`}
                    milestone={milestone}
                    onUpdate={onMilestoneUpdate}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="competitive" className="mt-0">
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Radar className="h-4 w-4 text-blue-600" />
                    <h4 className="font-medium text-sm">Regional Power Dynamics</h4>
                    <Badge variant="outline" className="text-xs">Monitor</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Neighboring nations strengthening economic partnerships
                  </p>
                  <div className="text-xs text-muted-foreground">
                    • Trade bloc negotiations accelerating
                    • Infrastructure cooperation increasing
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="h-4 w-4 text-amber-600" />
                    <h4 className="font-medium text-sm">Policy Innovation Tracking</h4>
                    <Badge variant="outline" className="text-xs">Respond</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Peer nations implementing similar governance reforms
                  </p>
                  <div className="text-xs text-muted-foreground">
                    • Digital transformation initiatives
                    • Sustainable development programs
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default ForwardLookingIntelligence;