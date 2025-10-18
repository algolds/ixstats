"use client";

import React, { useState, useEffect } from 'react';
import {
  Shield, Activity, Calendar, FileText, Send, Globe, BarChart3, Eye
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { ThemedTabContent } from '~/components/ui/themed-tab-content';
import { useCountryData } from './primitives';
import { useUser } from "@clerk/nextjs";

// Import intelligence components
import { ExecutiveCommandCenter } from "~/app/mycountry/components/ExecutiveCommandCenter";
import { MeetingScheduler } from "~/app/mycountry/intelligence/_components/MeetingScheduler";
import { PolicyCreator } from "~/app/mycountry/intelligence/_components/PolicyCreator";
import { SecureCommunications } from "~/app/mycountry/intelligence/_components/SecureCommunications";
import { IntelligenceFeed } from "~/app/mycountry/intelligence/_components/IntelligenceFeed";
import { AnalyticsDashboard } from "~/app/mycountry/intelligence/_components/AnalyticsDashboard";
import { DiplomaticOperationsHub } from "~/app/mycountry/intelligence/_components/DiplomaticOperationsHub";
import { AlertThresholdSettings } from "~/app/mycountry/intelligence/_components/AlertThresholdSettings";

// Import hooks
import { useUnifiedIntelligence, type IntelligenceTab } from '~/hooks/useUnifiedIntelligence';
import { api } from '~/trpc/react';

interface IntelligenceTabSystemProps {
  variant?: 'unified' | 'standard' | 'premium';
}

export function IntelligenceTabSystem({ variant = 'unified' }: IntelligenceTabSystemProps) {
  const { user } = useUser();
  // TypeScript fixes applied - all errors resolved
  const { country } = useCountryData();

  // Unified intelligence hook
  const {
    activeTab,
    setActiveTab,
    metrics,
    overview,
    quickActions,
    wsConnected
  } = useUnifiedIntelligence({
    countryId: country?.id || '',
    userId: user?.id || '',
    autoRefresh: false
  });

  // Get country stats
  const { data: countryStats } = api.countries.getByIdWithEconomicData.useQuery(
    { id: country?.id || '' },
    { enabled: !!country?.id }
  );

  // Fetch real diplomatic data
  const { data: diplomaticRelations } = api.diplomatic.getRelationships.useQuery(
    { countryId: country?.id || '' },
    { enabled: !!country?.id }
  );

  // Calculate diplomatic metrics from real data
  const diplomaticMetrics = React.useMemo(() => {
    if (!diplomaticRelations) {
      return { treatyCount: 0, tradePartnerCount: 0, relationshipsCount: 0 };
    }

    const treatyCount = diplomaticRelations.filter(rel =>
      rel.treaties && rel.treaties.length > 0
    ).length;

    const tradePartnerCount = diplomaticRelations.filter(rel =>
      rel.tradeVolume > 0
    ).length;

    return {
      treatyCount,
      tradePartnerCount,
      relationshipsCount: diplomaticRelations.length
    };
  }, [diplomaticRelations]);

  // Transform overview data for ExecutiveCommandCenter
  const executiveIntelligence = React.useMemo(() => {
    if (!overview) {
      return {
        countryId: country?.id || '',
        generatedAt: Date.now(),
        nextUpdate: Date.now() + 30 * 60 * 1000, // 30 minutes
        forwardIntelligence: {
          predictions: [],
          opportunities: [],
          risks: [],
          competitiveIntelligence: []
        },
        lastMajorChange: {
          date: Date.now(),
          description: 'Initial intelligence generation',
          impact: 'neutral'
        },
        viewMode: 'executive' as const,
        priorityThreshold: 'medium' as const,
        overallStatus: 'good' as const,
        confidenceLevel: 75,
        vitalityIntelligence: [],
        criticalAlerts: [],
        trendingInsights: [],
        urgentActions: []
      };
    }

    const vitalityIntelligence = [
      {
        area: 'economic' as const,
        score: overview?.vitality?.economic || 0,
        trend: 'stable' as const,
        change: { 
          value: 0, 
          period: 'week' as const,
          reason: 'No significant changes detected'
        },
        status: 'good' as const,
        keyMetrics: [
          { 
            id: 'gdp-growth',
            label: 'GDP Growth', 
            value: '3.2', 
            unit: '%',
            trend: 'stable' as const,
            changeValue: 0,
            changePercent: 0,
            changePeriod: 'week',
            status: 'good' as const
          },
          { 
            id: 'economic-tier',
            label: 'Economic Tier', 
            value: overview?.country?.economicTier || 'N/A', 
            unit: '',
            trend: 'stable' as const,
            changeValue: 0,
            changePercent: 0,
            changePeriod: 'week',
            status: 'good' as const
          }
        ],
        criticalAlerts: [],
        recommendations: [],
        forecast: {
          shortTerm: {
            projected: overview?.vitality?.economic || 0,
            confidence: 70,
            factors: ['Current economic indicators', 'Historical trends']
          },
          longTerm: {
            projected: overview?.vitality?.economic || 0,
            confidence: 50,
            factors: ['Long-term growth patterns', 'Global economic outlook']
          }
        },
        comparisons: {
          peerAverage: 75,
          regionalAverage: 70,
          historicalBest: 85,
          rank: 0,
          totalCountries: 0
        }
      },
      {
        area: 'population' as const,
        score: overview?.vitality?.social || 0,
        trend: 'stable' as const,
        change: { 
          value: 0, 
          period: 'week' as const,
          reason: 'No significant changes detected'
        },
        status: 'good' as const,
        keyMetrics: [
          { 
            id: 'population-tier',
            label: 'Population Tier', 
            value: overview?.country?.populationTier || 'N/A', 
            unit: '',
            trend: 'stable' as const,
            changeValue: 0,
            changePercent: 0,
            changePeriod: 'week',
            status: 'good' as const
          },
          { 
            id: 'wellbeing',
            label: 'Wellbeing', 
            value: String(overview?.country?.overallNationalHealth || 0), 
            unit: '/100',
            trend: 'stable' as const,
            changeValue: 0,
            changePercent: 0,
            changePeriod: 'week',
            status: 'good' as const
          }
        ],
        criticalAlerts: [],
        recommendations: [],
        forecast: {
          shortTerm: {
            projected: overview?.vitality?.social || 0,
            confidence: 70,
            factors: ['Social indicators', 'Population trends']
          },
          longTerm: {
            projected: overview?.vitality?.social || 0,
            confidence: 50,
            factors: ['Demographic projections', 'Social policy impact']
          }
        },
        comparisons: {
          peerAverage: 75,
          regionalAverage: 70,
          historicalBest: 85,
          rank: 0,
          totalCountries: 0
        }
      },
      {
        area: 'diplomatic' as const,
        score: overview?.vitality?.diplomatic || 0,
        trend: 'stable' as const,
        change: {
          value: 0,
          period: 'week' as const,
          reason: 'No significant changes detected'
        },
        status: 'good' as const,
        keyMetrics: [
          {
            id: 'active-treaties',
            label: 'Active Treaties',
            value: String(diplomaticMetrics.treatyCount),
            unit: '',
            trend: diplomaticMetrics.treatyCount > 5 ? 'up' as const :
                   diplomaticMetrics.treatyCount < 3 ? 'down' as const :
                   'stable' as const,
            changeValue: 0,
            changePercent: 0,
            changePeriod: 'week',
            status: diplomaticMetrics.treatyCount >= 8 ? 'excellent' as const :
                    diplomaticMetrics.treatyCount >= 5 ? 'good' as const :
                    diplomaticMetrics.treatyCount >= 2 ? 'concerning' as const :
                    'critical' as const
          },
          {
            id: 'trade-partners',
            label: 'Trade Partners',
            value: String(diplomaticMetrics.tradePartnerCount),
            unit: '',
            trend: diplomaticMetrics.tradePartnerCount > 15 ? 'up' as const :
                   diplomaticMetrics.tradePartnerCount < 8 ? 'down' as const :
                   'stable' as const,
            changeValue: 0,
            changePercent: 0,
            changePeriod: 'week',
            status: diplomaticMetrics.tradePartnerCount >= 20 ? 'excellent' as const :
                    diplomaticMetrics.tradePartnerCount >= 10 ? 'good' as const :
                    diplomaticMetrics.tradePartnerCount >= 5 ? 'concerning' as const :
                    'critical' as const
          }
        ],
        criticalAlerts: [],
        recommendations: [],
        forecast: {
          shortTerm: {
            projected: overview?.vitality?.diplomatic || 0,
            confidence: 70,
            factors: ['Current diplomatic relations', 'International standing']
          },
          longTerm: {
            projected: overview?.vitality?.diplomatic || 0,
            confidence: 50,
            factors: ['Geopolitical trends', 'Alliance developments']
          }
        },
        comparisons: {
          peerAverage: 75,
          regionalAverage: 70,
          historicalBest: 85,
          rank: 0,
          totalCountries: 0
        }
      },
      {
        area: 'governance' as const,
        score: overview?.vitality?.governance || 0,
        trend: 'stable' as const,
        change: { 
          value: 0, 
          period: 'week' as const,
          reason: 'No significant changes detected'
        },
        status: 'good' as const,
        keyMetrics: [
          { 
            id: 'active-policies',
            label: 'Active Policies', 
            value: String(overview?.activity?.activePolicies || 0), 
            unit: '',
            trend: 'stable' as const,
            changeValue: 0,
            changePercent: 0,
            changePeriod: 'week',
            status: 'good' as const
          },
          { 
            id: 'pending-decisions',
            label: 'Pending Decisions', 
            value: String(overview?.activity?.pendingDecisions || 0), 
            unit: '',
            trend: 'stable' as const,
            changeValue: 0,
            changePercent: 0,
            changePeriod: 'week',
            status: 'good' as const
          }
        ],
        criticalAlerts: [],
        recommendations: [],
        forecast: {
          shortTerm: {
            projected: overview?.vitality?.governance || 0,
            confidence: 70,
            factors: ['Policy effectiveness', 'Administrative efficiency']
          },
          longTerm: {
            projected: overview?.vitality?.governance || 0,
            confidence: 50,
            factors: ['Institutional stability', 'Reform initiatives']
          }
        },
        comparisons: {
          peerAverage: 75,
          regionalAverage: 70,
          historicalBest: 85,
          rank: 0,
          totalCountries: 0
        }
      }
    ];

    type AlertItem = { id: string; title: string; description: string; severity: string; category: string; detectedAt: Date | string };
    const criticalAlerts = (overview?.alerts?.items || []).slice(0, 5).map((alert: AlertItem) => ({
      id: alert.id,
      title: alert.title,
      message: alert.description,
      severity: alert.severity.toLowerCase() as 'critical' | 'warning' | 'info' | 'success',
      priority: alert.severity.toUpperCase() as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL',
      category: alert.category as 'economic' | 'population' | 'diplomatic' | 'governance' | 'crisis',
      actionRequired: true,
      timeframe: 'THIS_WEEK' as const,
      estimatedImpact: {
        magnitude: 'medium' as const,
        areas: [alert.category || 'general']
      },
      recommendedActions: ['Review and take appropriate action'],
      createdAt: new Date(alert.detectedAt).getTime(),
      expiresAt: new Date(alert.detectedAt).getTime() + (7 * 24 * 60 * 60 * 1000) // 7 days
    }));

    type BriefingItem = { id: string; title: string; description: string; priority: string; urgency: string; confidence: number; generatedAt: Date | string };
    const trendingInsights = (overview?.briefings?.items || []).slice(0, 3).map((briefing: BriefingItem) => ({
      id: briefing.id,
      title: briefing.title,
      description: briefing.description,
      category: 'performance' as const,
      icon: Activity,
      trend: 'up' as const,
      significance: briefing.priority.toLowerCase() as 'major' | 'moderate' | 'minor',
      metrics: [],
      context: {
        comparison: 'historical' as const,
        timeframe: briefing.urgency || 'THIS_WEEK',
        confidence: briefing.confidence || 75
      },
      actionable: true,
      nextReview: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    }));

    type QuickAction = { id: string; title: string; description: string; category: string; urgency: string; difficulty?: string; estimatedDuration: string; estimatedCost?: number; estimatedBenefit: string; requirements?: string[]; risks?: string[]; successProbability: number };
    const urgentActions = ((quickActions?.actions as QuickAction[]) || []).slice(0, 3).map((action: QuickAction) => ({
      id: action.id,
      title: action.title,
      description: action.description,
      category: action.category as 'economic' | 'population' | 'diplomatic' | 'governance',
      urgency: action.urgency as 'urgent' | 'important' | 'routine' | 'future',
      difficulty: (action.difficulty as 'easy' | 'moderate' | 'complex' | 'major') || 'moderate',
      estimatedDuration: action.estimatedDuration,
      estimatedCost: String(action.estimatedCost || 0),
      estimatedBenefit: action.estimatedBenefit,
      prerequisites: action.requirements || [],
      risks: action.risks || [],
      successProbability: action.successProbability,
      impact: {
        economic: action.category === 'economic' ? 50 : undefined,
        social: action.category === 'population' ? 50 : undefined,
        diplomatic: action.category === 'diplomatic' ? 50 : undefined,
        governance: action.category === 'governance' ? 50 : undefined
      }
    }));

    return {
      countryId: country?.id || '',
      generatedAt: Date.now(),
      nextUpdate: Date.now() + 30 * 60 * 1000, // 30 minutes
      forwardIntelligence: {
        predictions: [],
        opportunities: [],
        risks: [],
        competitiveIntelligence: []
      },
      lastMajorChange: {
        date: Date.now(),
        description: 'Intelligence data processed',
        impact: 'neutral'
      },
      viewMode: 'executive' as const,
      priorityThreshold: 'medium' as const,
      overallStatus: metrics?.overallHealth
        ? (metrics.overallHealth >= 80 ? 'excellent' as const :
           metrics.overallHealth >= 60 ? 'good' as const :
           metrics.overallHealth >= 40 ? 'concerning' as const : 'critical' as const)
        : 'good' as const,
      confidenceLevel: 85,
      vitalityIntelligence,
      criticalAlerts,
      trendingInsights,
      urgentActions
    };
  }, [overview, quickActions, metrics, country?.id, diplomaticMetrics]);

  if (!country) return null;

  const renderTabsList = () => {
    const baseTabs = [
      { value: "overview", icon: Eye, label: "Overview", shortLabel: "Over" },
      { value: "meetings", icon: Calendar, label: "Meetings", shortLabel: "Meet" },
      { value: "policies", icon: FileText, label: "Policies", shortLabel: "Policy" },
      { value: "communications", icon: Send, label: "Communications", shortLabel: "Comms" }
    ];

    let tabs = [...baseTabs];

    // Add premium/unified tabs
    if (variant === 'premium' || variant === 'unified') {
      tabs.push(
        { value: "diplomatic-ops", icon: Globe, label: "Diplomatic Ops", shortLabel: "Diplo" },
        { value: "intelligence-feed", icon: Activity, label: "Intel Feed", shortLabel: "Feed" },
        { value: "analytics", icon: BarChart3, label: "Analytics", shortLabel: "Stats" },
        { value: "settings", icon: Shield, label: "Settings", shortLabel: "Set" }
      );
    }

    const colCount = tabs.length <= 5 ? 5 : Math.min(8, tabs.length);

    return (
      <div className="overflow-x-auto">
        <TabsList className={`grid w-full grid-cols-4 lg:grid-cols-${colCount} min-w-fit`}>
          {tabs.map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-1 text-xs lg:text-sm data-[state=active]:bg-background data-[state=active]:text-foreground"
            >
              <tab.icon className="h-3 w-3 lg:h-4 lg:w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    );
  };

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as IntelligenceTab)} className="space-y-4">
      {renderTabsList()}

      {/* Overview Tab - Executive Command Center */}
      <TabsContent value="overview" id="overview">
        <ThemedTabContent theme="intelligence" className="tab-content-enter">
          <ExecutiveCommandCenter
            intelligence={executiveIntelligence}
            country={{
              name: country.name,
              flag: country.flagUrl || '/flags/default.png',
              leader: country.headOfGovernment || 'Unknown'
            }}
            isOwner={true}
            countryStats={countryStats}
            economyData={countryStats as any}
            onNavigateToIntelligence={() => setActiveTab('intelligence-feed')}
            onNavigateToMeetings={() => setActiveTab('meetings')}
            onNavigateToPolicy={() => setActiveTab('policies')}
          />
        </ThemedTabContent>
      </TabsContent>

      {/* Meetings Tab */}
      <TabsContent value="meetings" id="meetings">
        <ThemedTabContent theme="intelligence" className="tab-content-enter">
          <Card className="glass-hierarchy-child border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Meeting Scheduler
              </CardTitle>
              <CardDescription>
                Schedule and manage intelligence briefings and strategic meetings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MeetingScheduler countryId={country.id} userId={user?.id || ''} />
            </CardContent>
          </Card>
        </ThemedTabContent>
      </TabsContent>

      {/* Policies Tab */}
      <TabsContent value="policies" id="policies">
        <ThemedTabContent theme="intelligence" className="tab-content-enter">
          <Card className="glass-hierarchy-child border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Policy Creator
              </CardTitle>
              <CardDescription>
                Create and manage intelligence policies and strategic initiatives
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PolicyCreator countryId={country.id} userId={user?.id || ''} />
            </CardContent>
          </Card>
        </ThemedTabContent>
      </TabsContent>

      {/* Communications Tab */}
      <TabsContent value="communications" id="communications">
        <ThemedTabContent theme="intelligence" className="tab-content-enter">
          <Card className="glass-hierarchy-child border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Secure Communications
              </CardTitle>
              <CardDescription>
                Encrypted diplomatic and intelligence communications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SecureCommunications countryId={country.id} countryName={country.name} />
            </CardContent>
          </Card>
        </ThemedTabContent>
      </TabsContent>

      {/* Diplomatic Operations Tab */}
      {(variant === 'premium' || variant === 'unified') && (
        <TabsContent value="diplomatic-ops" id="diplomatic-ops">
          <ThemedTabContent theme="intelligence" className="tab-content-enter">
            <Card className="glass-hierarchy-child border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  Diplomatic Operations Hub
                </CardTitle>
                <CardDescription>
                  Manage diplomatic missions, embassies, and international relationships
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DiplomaticOperationsHub
                  countryId={country.id}
                  countryName={country.name}
                />
              </CardContent>
            </Card>
          </ThemedTabContent>
        </TabsContent>
      )}

      {/* Intelligence Feed Tab */}
      {(variant === 'premium' || variant === 'unified') && (
        <TabsContent value="intelligence-feed" id="intelligence-feed">
          <ThemedTabContent theme="intelligence" className="tab-content-enter">
            <Card className="glass-hierarchy-child border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  Intelligence Feed
                </CardTitle>
                <CardDescription>
                  Real-time intelligence briefings, alerts, and recommendations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <IntelligenceFeed countryId={country.id} wsConnected={wsConnected} />
              </CardContent>
            </Card>
          </ThemedTabContent>
        </TabsContent>
      )}

      {/* Analytics Tab */}
      {(variant === 'premium' || variant === 'unified') && (
        <TabsContent value="analytics" id="analytics">
          <ThemedTabContent theme="intelligence" className="tab-content-enter">
            <Card className="glass-hierarchy-child border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  Intelligence Analytics
                </CardTitle>
                <CardDescription>
                  Advanced analytics and predictive intelligence modeling
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AnalyticsDashboard
                  userId={user?.id || ''}
                  countryId={country.id}
                />
              </CardContent>
            </Card>
          </ThemedTabContent>
        </TabsContent>
      )}

      {/* Settings Tab */}
      {(variant === 'premium' || variant === 'unified') && (
        <TabsContent value="settings" id="settings">
          <ThemedTabContent theme="intelligence" className="tab-content-enter">
            <AlertThresholdSettings countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>
      )}
    </Tabs>
  );
}
