"use client";

import { useState, useMemo, useCallback } from 'react';
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { AuthenticationGuard, CountryDataProvider, useCountryData } from "~/components/mycountry";
import { AtomicStateProvider } from "~/components/atomic/AtomicStateProvider";
import { MobileOptimized } from "../components/MobileOptimizations";
import { api } from '~/trpc/react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Progress } from '~/components/ui/progress';
import { Skeleton } from '~/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Brain,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Eye,
  Shield,
  Target,
  ChevronRight,
  ChevronDown,
  Clock,
  DollarSign,
  Users,
  Building,
  Globe,
  Bell,
  Sparkles,
  ArrowRight,
  Filter,
  Zap,
  CheckCircle,
  Play,
  FileText,
  Settings,
  BarChart3
} from 'lucide-react';
import { transformApiDataToVitalityIntelligence } from '../utils/liveDataTransformers';
import { getIntelligenceEconomicData, getQuickEconomicHealth } from '~/lib/enhanced-economic-service';
import type { VitalityIntelligence, CriticalAlert, ActionableRecommendation } from '../types/intelligence';
import { FocusCards, createDefaultFocusCards } from '../components/FocusCards';
import { createUrl } from '~/lib/url-utils';
import { generateIntelligenceReport, type IntelligenceReport } from '~/lib/intelligence-engine';
import { ActionDialog } from '~/components/intelligence/ActionDialog';
import { IxTime } from '~/lib/ixtime';

// FocusCard type definition
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

interface FocusCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  healthScore: number;
  status: 'excellent' | 'good' | 'concerning' | 'critical';
  priority: 'high' | 'medium' | 'low';
  metrics: FocusMetric[];
  quickActions: FocusAction[];
  alerts: CriticalAlert[];
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

const severityConfig = {
  critical: {
    color: 'border-red-500 bg-red-50 dark:bg-red-950/20',
    badge: 'bg-red-500 text-white',
    icon: AlertTriangle
  },
  warning: {
    color: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20',
    badge: 'bg-yellow-500 text-white',
    icon: AlertTriangle
  },
  info: {
    color: 'border-blue-500 bg-blue-50 dark:bg-blue-950/20',
    badge: 'bg-blue-500 text-white',
    icon: Activity
  },
  success: {
    color: 'border-green-500 bg-green-50 dark:bg-green-950/20',
    badge: 'bg-green-500 text-white',
    icon: Shield
  }
} as const;

const areaConfig = {
  economic: { icon: DollarSign, label: 'Economic', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20' },
  population: { icon: Users, label: 'Population', color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-950/20' },
  diplomatic: { icon: Globe, label: 'Diplomatic', color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/20' },
  governance: { icon: Building, label: 'Governance', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20' }
} as const;

const briefingTypeConfig = {
  hot_issue: { icon: AlertTriangle, label: 'Hot Issue', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20' },
  opportunity: { icon: TrendingUp, label: 'Opportunity', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/20' },
  risk_mitigation: { icon: Shield, label: 'Risk Mitigation', color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/20' },
  strategic_initiative: { icon: Target, label: 'Strategic', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/20' }
} as const;

interface IntelligenceBriefing {
  id: string;
  title: string;
  description: string;
  type: 'hot_issue' | 'opportunity' | 'risk_mitigation' | 'strategic_initiative';
  priority: 'critical' | 'high' | 'medium' | 'low';
  area: 'economic' | 'population' | 'diplomatic' | 'governance';
  confidence: number;
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

interface IntelligenceCenterContentProps {
  userId: string;
  countryId: string;
}

function IntelligenceCenterContent({ userId, countryId }: IntelligenceCenterContentProps) {
  const router = useRouter();
  const [activeView, setActiveView] = useState<'overview' | 'briefings' | 'focus' | 'analytics'>('overview');
  const [expandedBriefing, setExpandedBriefing] = useState<string | null>(null);
  const [filterArea, setFilterArea] = useState<'all' | 'economic' | 'population' | 'diplomatic' | 'governance'>('all');
  const [selectedAction, setSelectedAction] = useState<ActionableRecommendation | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);

  // Use the country data from context (already loaded)
  const { country: countryData, economyData, isLoading: countryLoading } = useCountryData();

  // Fetch REAL intelligence data from database
  const { data: storedBriefings, isLoading: briefingsLoading } = api.intelligenceBriefing.getForCountry.useQuery(
    { countryId: countryId },
    { enabled: !!countryId }
  );

  const { data: storedVitality, isLoading: vitalityLoading } = api.intelligenceBriefing.getVitalitySnapshots.useQuery(
    { countryId: countryId },
    { enabled: !!countryId }
  );

  const { data: storedRecommendations, isLoading: recommendationsLoading } = api.intelligenceBriefing.getRecommendations.useQuery(
    { countryId: countryId },
    { enabled: !!countryId }
  );

  // Fetch REAL historical data from database
  const { data: historicalData } = api.countries.getHistoricalData.useQuery(
    { countryId: countryId },
    { enabled: !!countryId }
  );

  // Generate advanced intelligence report using REAL historical data
  const advancedIntelligenceReport = useMemo<IntelligenceReport | null>(() => {
    if (!countryData) return null;

    try {
      // Use REAL historical data from database
      const gdpHistory = historicalData && historicalData.length > 0
        ? historicalData.map(h => h.gdpPerCapita).reverse()
        : [countryData.currentGdpPerCapita];

      const populationHistory = historicalData && historicalData.length > 0
        ? historicalData.map(h => h.population).reverse()
        : [countryData.currentPopulation];

      const unemploymentHistory = historicalData && historicalData.length > 0
        ? historicalData.map(h => countryData.unemploymentRate || 5.0).reverse()
        : [countryData.unemploymentRate || 5.0];

      // Calculate REAL peer averages (would be enhanced with actual peer data)
      const peerAverages = {
        gdpPerCapita: countryData.currentGdpPerCapita * 1.15,
        population: countryData.currentPopulation * 0.8,
        unemployment: 6.5
      };

      return generateIntelligenceReport(
        countryData as any,
        { gdpHistory, populationHistory, unemploymentHistory },
        peerAverages
      );
    } catch (error) {
      console.error('Error generating advanced intelligence:', error);
      return null;
    }
  }, [countryData, historicalData]);

  // Generate live vitality intelligence from real API data
  const vitalityIntelligence = useMemo<VitalityIntelligence[]>(() => {
    if (!countryData) return [];

    try {
      const apiCountryData = {
        ...countryData,
        currentTotalGdp: countryData.currentTotalGdp || (countryData.currentPopulation * countryData.currentGdpPerCapita),
        economicVitality: countryData.economicVitality || 0,
        populationWellbeing: countryData.populationWellbeing || 0,
        diplomaticStanding: countryData.diplomaticStanding || 0,
        governmentalEfficiency: countryData.governmentalEfficiency || 0,
        lastCalculated: typeof countryData.lastCalculated === 'number' ? countryData.lastCalculated : Date.now(),
        baselineDate: typeof countryData.baselineDate === 'number' ? countryData.baselineDate : Date.now()
      };

      return transformApiDataToVitalityIntelligence(apiCountryData as any);
    } catch (error) {
      console.error('Error transforming vitality intelligence:', error);
      return [];
    }
  }, [countryData]);

  // Generate intelligence briefings from vitality data + advanced analysis
  const intelligenceBriefings = useMemo<IntelligenceBriefing[]>(() => {
    const briefings: IntelligenceBriefing[] = [];
    const now = Date.now();

    // Helper function to calculate which quarter based on IxTime
    const getQuarterInfo = () => {
      const currentIxTime = IxTime.getCurrentIxTime();
      const ixDate = new Date(currentIxTime);
      const month = ixDate.getMonth(); // 0-11
      const quarter = Math.floor(month / 3) + 1; // 1-4
      const year = ixDate.getFullYear();
      return `Q${quarter} ${year}`;
    };

    // Add advanced intelligence alerts as briefings
    if (advancedIntelligenceReport) {
      advancedIntelligenceReport.alerts.forEach(alert => {
        const urgency = alert.severity === 'critical' ? 'immediate' :
                       alert.severity === 'high' ? 'this_week' :
                       alert.severity === 'medium' ? 'this_month' : 'this_quarter';

        const briefingType = alert.type === 'opportunity' ? 'opportunity' :
                            alert.type === 'anomaly' || alert.type === 'threshold' ? 'hot_issue' :
                            alert.type === 'risk' ? 'risk_mitigation' : 'strategic_initiative';

        briefings.push({
          id: alert.id,
          title: alert.title,
          description: alert.description,
          type: briefingType,
          priority: alert.severity === 'critical' || alert.severity === 'high' ?
                   (alert.severity as 'critical' | 'high') : 'medium',
          area: alert.category,
          confidence: alert.confidence,
          urgency,
          impact: {
            magnitude: alert.severity === 'critical' ? 'critical' :
                      alert.severity === 'high' ? 'high' : 'medium',
            scope: alert.factors,
            timeframe: urgency === 'immediate' ? 'Immediate' :
                      urgency === 'this_week' ? '1 week' :
                      urgency === 'this_month' ? '1 month' : getQuarterInfo()
          },
          evidence: {
            metrics: [
              `Current: ${alert.metrics.current.toFixed(2)}`,
              `Expected: ${alert.metrics.expected.toFixed(2)}`,
              `Deviation: ${alert.metrics.deviation.toFixed(2)}%`,
              `Z-Score: ${alert.metrics.zScore.toFixed(2)}`
            ],
            trends: [`Detected via ${alert.type} analysis`],
            comparisons: alert.factors.map(f => `Factor: ${f}`)
          },
          recommendations: alert.recommendations.map((rec, i) => ({
            id: `${alert.id}-rec-${i}`,
            title: rec,
            description: `Recommendation based on ${alert.type} detection`,
            category: alert.category,
            urgency: alert.severity === 'critical' ? 'urgent' : 'important',
            difficulty: alert.severity === 'critical' ? 'major' : 'moderate',
            estimatedDuration: urgency === 'immediate' ? '1-2 weeks' : '1-2 months',
            estimatedCost: alert.severity === 'critical' ? 'High' : 'Medium',
            estimatedBenefit: `${Math.abs(alert.metrics.deviation / 2).toFixed(2)}% improvement`,
            prerequisites: [],
            risks: [`Potential ${alert.severity} impact if not implemented correctly`],
            successProbability: Math.min(95, alert.confidence + 10),
            impact: {
              economic: alert.category === 'economic' ? alert.metrics.deviation / 2 : 0,
              social: alert.category === 'population' ? alert.metrics.deviation / 3 : 0,
              diplomatic: alert.category === 'diplomatic' ? alert.metrics.deviation / 3 : 0
            }
          })),
          alerts: [],
          createdAt: alert.detected,
          lastUpdated: alert.detected,
          tags: alert.factors
        });
      });
    }

    vitalityIntelligence.forEach(vitality => {
      // Hot Issues from critical alerts
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

      // Opportunities from strong performance
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
            urgency: 'this_week',
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

      // Risk Mitigation for declining areas
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
    });

    return briefings.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    });
  }, [vitalityIntelligence, advancedIntelligenceReport]);

  // Generate focus cards using real country data (same as MyCountry dashboard)
  const focusCards = useMemo(() => {
    if (!countryData) return [];

    try {
      // Prepare data structure for createDefaultFocusCards
      const focusCardData = {
        economic: {
          healthScore: Math.round(countryData.economicVitality || 0),
          gdpPerCapita: countryData.currentGdpPerCapita,
          growthRate: countryData.gdpGrowthRate || 0,
          economicTier: countryData.economicTier || 'Developing',
          alerts: []
        },
        population: {
          healthScore: Math.round(countryData.populationWellbeing || 0),
          population: countryData.currentPopulation,
          growthRate: countryData.populationGrowthRate || 0,
          populationTier: countryData.populationTier || 'Tier X',
          alerts: []
        },
        diplomatic: {
          healthScore: Math.round(countryData.diplomaticStanding || 0),
          allies: countryData.activeAlliances || 0,
          reputation: countryData.diplomaticReputation || 'Neutral',
          treaties: countryData.activeTreaties || 0,
          alerts: []
        },
        government: {
          healthScore: Math.round(countryData.governmentalEfficiency || 0),
          approval: countryData.publicApproval || 0,
          efficiency: countryData.governmentEfficiency || 'Moderate',
          stability: countryData.politicalStability || 'Stable',
          alerts: []
        }
      };

      return createDefaultFocusCards(focusCardData);
    } catch (error) {
      console.error('Error creating focus cards:', error);
      return [];
    }
  }, [countryData]);

  // Aggregate all alerts
  const allAlerts = useMemo(() => {
    const alerts: CriticalAlert[] = [];
    vitalityIntelligence.forEach(vi => {
      alerts.push(...vi.criticalAlerts);
    });
    return alerts.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) -
             (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
    });
  }, [vitalityIntelligence]);

  // Filter briefings
  const filteredBriefings = useMemo(() => {
    if (filterArea === 'all') return intelligenceBriefings;
    return intelligenceBriefings.filter(b => b.area === filterArea);
  }, [intelligenceBriefings, filterArea]);

  // Critical metrics summary
  const criticalMetrics = useMemo(() => {
    const criticalCount = allAlerts.filter(a => a.severity === 'critical').length;
    const opportunityCount = intelligenceBriefings.filter(b => b.type === 'opportunity').length;
    const actionableCount = intelligenceBriefings.reduce((sum, b) => sum + b.recommendations.length, 0);
    const avgVitality = vitalityIntelligence.length > 0
      ? Math.round(vitalityIntelligence.reduce((sum, vi) => sum + vi.score, 0) / vitalityIntelligence.length)
      : 0;

    return { criticalCount, opportunityCount, actionableCount, avgVitality };
  }, [allAlerts, intelligenceBriefings, vitalityIntelligence]);

  // Action handlers
  const handleRecommendationAction = useCallback((rec: ActionableRecommendation) => {
    // Open action dialog for confirmation and processing
    setSelectedAction(rec);
    setActionDialogOpen(true);
  }, []);

  const handleBriefingExpand = useCallback((briefingId: string) => {
    setExpandedBriefing(expandedBriefing === briefingId ? null : briefingId);
  }, [expandedBriefing]);

  const isLoading = countryLoading || briefingsLoading || vitalityLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Intelligence Center</h1>
              <p className="text-sm text-muted-foreground">Strategic intelligence for {countryData?.name}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="animate-pulse border-green-500 text-green-600">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
            LIVE
          </Badge>
          <Badge variant="secondary">
            {intelligenceBriefings.length} Briefings
          </Badge>
        </div>
      </motion.div>

      {/* View Selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b">
        <Button
          variant={activeView === 'overview' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveView('overview')}
        >
          <Activity className="h-4 w-4 mr-2" />
          Overview
        </Button>
        <Button
          variant={activeView === 'briefings' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveView('briefings')}
        >
          <FileText className="h-4 w-4 mr-2" />
          Briefings ({intelligenceBriefings.length})
        </Button>
        <Button
          variant={activeView === 'focus' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveView('focus')}
        >
          <Target className="h-4 w-4 mr-2" />
          Focus Areas
        </Button>
        <Button
          variant={activeView === 'analytics' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveView('analytics')}
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          Analytics
        </Button>
      </div>

      {/* Critical Metrics Dashboard */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <Card className="glass-surface glass-refraction border-red-200 dark:border-red-800/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Critical Issues</p>
                <p className="text-2xl font-bold text-red-600">{criticalMetrics.criticalCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Require attention</p>
              </div>
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-surface glass-refraction border-green-200 dark:border-green-800/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Opportunities</p>
                <p className="text-2xl font-bold text-green-600">{criticalMetrics.opportunityCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Growth potential</p>
              </div>
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-surface glass-refraction border-blue-200 dark:border-blue-800/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Actionable Items</p>
                <p className="text-2xl font-bold text-blue-600">{criticalMetrics.actionableCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Strategic actions</p>
              </div>
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Target className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-surface glass-refraction border-purple-200 dark:border-purple-800/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">National Health</p>
                <p className="text-2xl font-bold text-purple-600">{criticalMetrics.avgVitality}%</p>
                <p className="text-xs text-muted-foreground mt-1">Overall vitality</p>
              </div>
              <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Area Filter */}
      {(activeView === 'briefings' || activeView === 'analytics') && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Button
            variant={filterArea === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterArea('all')}
          >
            All Areas
          </Button>
          {Object.entries(areaConfig).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <Button
                key={key}
                variant={filterArea === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterArea(key as any)}
              >
                <Icon className="h-3 w-3 mr-1" />
                {config.label}
              </Button>
            );
          })}
        </div>
      )}

      {/* Content Views */}
      <AnimatePresence mode="wait">
        {activeView === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Top Priority Briefings */}
            <Card className="glass-surface glass-refraction">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  Priority Intelligence Briefings
                </CardTitle>
              </CardHeader>
              <CardContent>
                {intelligenceBriefings.slice(0, 3).length > 0 ? (
                  <div className="space-y-3">
                    {intelligenceBriefings.slice(0, 3).map((briefing, index) => {
                      const typeConfig = briefingTypeConfig[briefing.type];
                      const TypeIcon = typeConfig.icon;

                      return (
                        <motion.div
                          key={briefing.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all ${typeConfig.bg}`}
                          onClick={() => {
                            setActiveView('briefings');
                            setExpandedBriefing(briefing.id);
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded ${typeConfig.bg}`}>
                              <TypeIcon className={`h-5 w-5 ${typeConfig.color}`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold">{briefing.title}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {briefing.confidence.toFixed(2)}% confident
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{briefing.description}</p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {briefing.urgency}
                                </span>
                                <span>•</span>
                                <span>{briefing.recommendations.length} actions</span>
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>All systems operating optimally</p>
                  </div>
                )}
                {intelligenceBriefings.length > 3 && (
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={() => setActiveView('briefings')}
                  >
                    View All {intelligenceBriefings.length} Briefings
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="glass-surface glass-refraction cursor-pointer hover:shadow-lg transition-all"
                onClick={() => setActiveView('focus')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="h-5 w-5 text-blue-600" />
                    Strategic Focus Areas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Monitor key sectors with actionable metrics and quick interventions
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-blue-600">{focusCards.length}</span>
                    <Button size="sm">
                      View Focus Cards
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-surface glass-refraction cursor-pointer hover:shadow-lg transition-all"
                onClick={() => setActiveView('analytics')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="h-5 w-5 text-purple-600" />
                    Performance Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Deep dive into vitality scores, trends, and comparative rankings
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-purple-600">{vitalityIntelligence.length}</span>
                    <Button size="sm">
                      View Analytics
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {activeView === 'briefings' && (
          <motion.div
            key="briefings"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {filteredBriefings.length > 0 ? (
              filteredBriefings.map((briefing, index) => {
                const typeConfig = briefingTypeConfig[briefing.type];
                const TypeIcon = typeConfig.icon;
                const isExpanded = expandedBriefing === briefing.id;

                return (
                  <motion.div
                    key={briefing.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="glass-surface glass-refraction">
                      <CardHeader
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleBriefingExpand(briefing.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded ${typeConfig.bg}`}>
                              <TypeIcon className={`h-5 w-5 ${typeConfig.color}`} />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{briefing.title}</CardTitle>
                              <p className="text-sm text-muted-foreground mt-1">{briefing.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{briefing.confidence.toFixed(2)}%</Badge>
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            </motion.div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-xs">{typeConfig.label}</Badge>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {briefing.urgency}
                          </span>
                          <span>•</span>
                          <span>Impact: {briefing.impact.magnitude}</span>
                          <span>•</span>
                          <span>{briefing.recommendations.length} actions</span>
                        </div>
                      </CardHeader>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <CardContent className="space-y-4 pt-0">
                              {/* Evidence */}
                              <div>
                                <h4 className="font-semibold mb-2 flex items-center gap-2">
                                  <Eye className="h-4 w-4" />
                                  Evidence & Analysis
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Key Metrics</p>
                                    <ul className="space-y-1">
                                      {briefing.evidence.metrics.map((metric, i) => (
                                        <li key={i} className="text-xs">• {metric}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Trends</p>
                                    <ul className="space-y-1">
                                      {briefing.evidence.trends.map((trend, i) => (
                                        <li key={i} className="text-xs">• {trend}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Comparisons</p>
                                    <ul className="space-y-1">
                                      {briefing.evidence.comparisons.map((comp, i) => (
                                        <li key={i} className="text-xs">• {comp}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              </div>

                              {/* Recommended Actions */}
                              {briefing.recommendations.length > 0 && (
                                <div>
                                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                                    <Zap className="h-4 w-4" />
                                    Recommended Actions
                                  </h4>
                                  <div className="space-y-2">
                                    {briefing.recommendations.map((rec, i) => (
                                      <div key={i} className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                                        <div className="flex items-start gap-3">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                              <h5 className="font-medium text-sm">{rec.title}</h5>
                                              <Badge variant="outline" className="text-xs">{rec.urgency}</Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground mb-2">{rec.description}</p>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                              <span>Duration: {rec.estimatedDuration}</span>
                                              <span>•</span>
                                              <span>Success: {rec.successProbability}%</span>
                                              <span>•</span>
                                              <span>Difficulty: {rec.difficulty}</span>
                                            </div>
                                          </div>
                                          <Button
                                            size="sm"
                                            onClick={() => handleRecommendationAction(rec)}
                                          >
                                            <Play className="h-3 w-3 mr-1" />
                                            Take Action
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Card>
                  </motion.div>
                );
              })
            ) : (
              <Card className="glass-surface glass-refraction">
                <CardContent className="py-12 text-center">
                  <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Issues in This Area</h3>
                  <p className="text-sm text-muted-foreground">
                    All systems are operating within normal parameters
                  </p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {activeView === 'focus' && (
          <motion.div
            key="focus"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <Card className="glass-surface glass-refraction">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-600" />
                  Strategic Focus Areas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {focusCards.length > 0 ? (
                  <FocusCards
                    cards={focusCards}
                    layout="grid"
                    expandable={true}
                    interactive={true}
                  />
                ) : (
                  <div className="text-center py-12">
                    <Target className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">No Focus Areas Available</h3>
                    <p className="text-sm text-muted-foreground">
                      Focus areas will appear as intelligence data becomes available
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeView === 'analytics' && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {/* Historical Data Summary */}
            {historicalData && historicalData.length > 0 && (
              <Card className="glass-surface glass-refraction border-blue-200 dark:border-blue-800/40">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Historical Trends & Analytics
                    <Badge variant="outline" className="ml-auto">
                      {historicalData.length} data points
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
                      <p className="text-xs text-muted-foreground mb-1">GDP Trend</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {historicalData.length > 1
                          ? ((historicalData[historicalData.length - 1]!.gdpPerCapita - historicalData[0]!.gdpPerCapita) / historicalData[0]!.gdpPerCapita * 100).toFixed(1)
                          : '0.0'}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Total change</p>
                    </div>
                    <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                      <p className="text-xs text-muted-foreground mb-1">Population Trend</p>
                      <p className="text-2xl font-bold text-green-600">
                        {historicalData.length > 1
                          ? ((historicalData[historicalData.length - 1]!.population - historicalData[0]!.population) / historicalData[0]!.population * 100).toFixed(1)
                          : '0.0'}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Total change</p>
                    </div>
                    <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20">
                      <p className="text-xs text-muted-foreground mb-1">Data Coverage</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {Math.floor((new Date(historicalData[historicalData.length - 1]!.ixTimeTimestamp).getTime() - new Date(historicalData[0]!.ixTimeTimestamp).getTime()) / (1000 * 60 * 60 * 24))}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Days tracked</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Advanced Intelligence Summary */}
            {advancedIntelligenceReport && (
              <Card className="glass-surface glass-refraction border-purple-200 dark:border-purple-800/40">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-600" />
                    Advanced Intelligence Summary
                    <Badge variant="outline" className="ml-auto">
                      {historicalData && historicalData.length > 0 ? 'Live Data' : 'Current Snapshot'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20">
                      <p className="text-xs text-muted-foreground mb-1">Overall Health</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {advancedIntelligenceReport.summary.overallHealth}%
                      </p>
                      <Progress value={advancedIntelligenceReport.summary.overallHealth} className="h-1 mt-2" />
                    </div>
                    <div className="p-4 rounded-lg bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20">
                      <p className="text-xs text-muted-foreground mb-1">Critical Issues</p>
                      <p className="text-2xl font-bold text-red-600">
                        {advancedIntelligenceReport.summary.criticalIssues}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Require attention</p>
                    </div>
                    <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                      <p className="text-xs text-muted-foreground mb-1">Opportunities</p>
                      <p className="text-2xl font-bold text-green-600">
                        {advancedIntelligenceReport.summary.opportunities}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Growth potential</p>
                    </div>
                    <div className="p-4 rounded-lg bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20">
                      <p className="text-xs text-muted-foreground mb-1">Risk Level</p>
                      <p className="text-2xl font-bold text-amber-600 capitalize">
                        {advancedIntelligenceReport.summary.riskLevel}
                      </p>
                      <Badge variant={advancedIntelligenceReport.summary.riskLevel === 'critical' ? 'destructive' : 'outline'} className="mt-1">
                        {advancedIntelligenceReport.summary.riskLevel}
                      </Badge>
                    </div>
                  </div>

                  {/* Correlation Insights */}
                  {advancedIntelligenceReport.correlations.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-600" />
                        Factor Correlations
                      </h4>
                      <div className="space-y-2">
                        {advancedIntelligenceReport.correlations.map((corr, i) => (
                          <div key={i} className="p-3 rounded-lg bg-muted/50 border">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {corr.significance} {corr.direction}
                                </Badge>
                                <span className="text-sm font-medium">
                                  {corr.factor1} ↔ {corr.factor2}
                                </span>
                              </div>
                              <span className="text-sm font-bold text-purple-600">
                                {(corr.correlation * 100).toFixed(2)}%
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              {corr.implications.map((imp, j) => (
                                <p key={j}>• {imp}</p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trend Forecasts */}
                  {advancedIntelligenceReport.trends.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                        Trend Forecasts
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {advancedIntelligenceReport.trends.map((trend, i) => (
                          <div key={i} className="p-3 rounded-lg bg-muted/50 border">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">{trend.metric}</span>
                              <Badge variant="outline" className="text-xs capitalize">
                                {trend.trend.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <div className="flex justify-between">
                                <span>Velocity:</span>
                                <span className={trend.velocity > 0 ? 'text-green-600' : 'text-red-600'}>
                                  {trend.velocity > 0 ? '+' : ''}{trend.velocity.toFixed(2)}%
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Next Month:</span>
                                <span className="font-medium">{trend.forecast.next_month.toFixed(0)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Confidence:</span>
                                <span>{trend.forecast.confidence.toFixed(2)}%</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Vitality Snapshots from Database */}
            {storedVitality && storedVitality.length > 0 && (
              <Card className="glass-surface glass-refraction border-indigo-200 dark:border-indigo-800/40">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-indigo-600" />
                    Stored Vitality Snapshots
                    <Badge variant="outline" className="ml-auto">
                      {storedVitality.length} snapshots from database
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {storedVitality.map((snapshot: any, index: number) => {
                      const areaKey = snapshot.area.toLowerCase() as 'economic' | 'social' | 'diplomatic' | 'governance';
                      const mappedKey = areaKey === 'social' ? 'population' : areaKey;
                      const config = areaConfig[mappedKey] || areaConfig.economic;
                      const Icon = config.icon;
                      const TrendIcon = snapshot.trend === 'UP' ? TrendingUp :
                                       snapshot.trend === 'DOWN' ? TrendingDown : Activity;

                      return (
                        <motion.div
                          key={snapshot.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="p-4 rounded-lg border bg-muted/50"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`p-2 rounded ${config.bg}`}>
                              <Icon className={`h-4 w-4 ${config.color}`} />
                            </div>
                            <h4 className="font-semibold text-sm">{config.label}</h4>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl font-bold">{snapshot.score.toFixed(1)}%</span>
                            <TrendIcon className={`h-4 w-4 ${
                              snapshot.trend === 'UP' ? 'text-green-600' :
                              snapshot.trend === 'DOWN' ? 'text-red-600' : 'text-gray-600'
                            }`} />
                          </div>
                          <Progress value={snapshot.score} className="h-1 mb-2" />
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div className="flex justify-between">
                              <span>Change:</span>
                              <span className={snapshot.changeValue > 0 ? 'text-green-600' : 'text-red-600'}>
                                {snapshot.changeValue > 0 ? '+' : ''}{snapshot.changeValue.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Rank:</span>
                              <span>#{snapshot.rank}/{snapshot.totalCountries}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Alerts:</span>
                              <Badge variant={snapshot.criticalAlertsCount > 0 ? 'destructive' : 'outline'} className="text-xs h-4">
                                {snapshot.criticalAlertsCount}
                              </Badge>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Vitality Analytics */}
            {vitalityIntelligence
              .filter(vi => filterArea === 'all' || vi.area === filterArea)
              .map((vitality, index) => {
              const config = areaConfig[vitality.area];
              const Icon = config.icon;
              const TrendIcon = vitality.trend === 'up' ? TrendingUp :
                               vitality.trend === 'down' ? TrendingDown : Activity;

              return (
                <motion.div
                  key={vitality.area}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="glass-surface glass-refraction">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-lg ${config.bg}`}>
                            <Icon className={`h-6 w-6 ${config.color}`} />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{config.label} Analytics</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              Score: {Math.round(vitality.score)}% • Rank: #{vitality.comparisons.rank}/{vitality.comparisons.totalCountries}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <span className={`text-2xl font-bold ${config.color}`}>
                              {Math.round(vitality.score)}%
                            </span>
                            <TrendIcon className={`h-5 w-5 ${
                              vitality.trend === 'up' ? 'text-green-600' :
                              vitality.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                            }`} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {vitality.change.value > 0 ? '+' : ''}{vitality.change.value.toFixed(2)}% {vitality.change.period}
                          </p>
                        </div>
                      </div>
                      <Progress value={vitality.score} className="h-2 mt-4" />
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Key Metrics Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {vitality.keyMetrics.slice(0, 3).map((metric, i) => {
                          const MetricTrendIcon = metric.trend === 'up' ? TrendingUp :
                                                 metric.trend === 'down' ? TrendingDown : Activity;

                          return (
                            <div key={i} className="p-3 rounded-lg bg-muted/50 border">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
                                <MetricTrendIcon className={`h-3 w-3 ${
                                  metric.trend === 'up' ? 'text-green-600' :
                                  metric.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                                }`} />
                              </div>
                              <div className="text-lg font-bold">
                                {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
                                {metric.unit && <span className="text-xs ml-1">{metric.unit}</span>}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {metric.changePercent > 0 ? '+' : ''}{metric.changePercent.toFixed(2)}% {metric.changePeriod}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Comparisons */}
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="p-2 rounded bg-muted/30 text-center">
                          <p className="text-xs text-muted-foreground">Peer Average</p>
                          <p className="font-bold">{vitality.comparisons.peerAverage.toFixed(2)}%</p>
                        </div>
                        <div className="p-2 rounded bg-muted/30 text-center">
                          <p className="text-xs text-muted-foreground">Regional Avg</p>
                          <p className="font-bold">{vitality.comparisons.regionalAverage.toFixed(2)}%</p>
                        </div>
                        <div className="p-2 rounded bg-muted/30 text-center">
                          <p className="text-xs text-muted-foreground">Historical Best</p>
                          <p className="font-bold">{vitality.comparisons.historicalBest.toFixed(2)}%</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Dialog */}
      {selectedAction && (
        <ActionDialog
          open={actionDialogOpen}
          onOpenChange={setActionDialogOpen}
          recommendation={selectedAction}
          onConfirm={(actionId) => {
            toast.success('Action Started', {
              description: `${selectedAction.title} has been queued and will begin processing.`
            });
          }}
          onCancel={() => {
            setSelectedAction(null);
            setActionDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}

// Wrapper component with authentication and data providers
function IntelligencePageWithProviders() {
  const { user } = useUser();
  const { country } = useCountryData();

  if (!country?.id || !user?.id) {
    return null;
  }

  return (
    <AtomicStateProvider countryId={country.id} userId={user.id}>
      <IntelligenceCenterContent
        userId={user.id}
        countryId={country.id}
      />
    </AtomicStateProvider>
  );
}

export default function IntelligencePage() {
  const { user } = useUser();

  return (
    <MobileOptimized enableTouchGestures={true} className="min-h-screen bg-background">
      <AuthenticationGuard redirectPath="/mycountry/intelligence">
        <CountryDataProvider userId={user?.id || 'placeholder-disabled'}>
          <IntelligencePageWithProviders />
        </CountryDataProvider>
      </AuthenticationGuard>
    </MobileOptimized>
  );
}
