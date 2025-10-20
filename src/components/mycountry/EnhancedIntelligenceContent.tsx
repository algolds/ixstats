"use client";

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Shield, Activity, AlertTriangle, Users, Globe } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Alert, AlertDescription } from '~/components/ui/alert';
import {
  CountryHeader,
  CountryMetricsGrid,
  VitalityRings,
  useCountryData
} from './primitives';
import { IntelligenceTabSystem } from './IntelligenceTabSystem';
import { CrisisStatusBanner } from "~/app/countries/_components/CrisisStatusBanner";
import { useFlag } from "~/hooks/useFlag";
import { api } from '~/trpc/react';
import { useUser } from '~/context/auth-context';
import { useUnifiedIntelligence } from '~/hooks/useUnifiedIntelligence';

interface EnhancedIntelligenceContentProps {
  variant?: 'unified' | 'standard' | 'premium';
  title?: string;
}

export function EnhancedIntelligenceContent({ variant = 'unified', title }: EnhancedIntelligenceContentProps) {
  const { user } = useUser();
  const { country, activityRingsData, isLoading } = useCountryData();
  const [vitalityCollapsed, setVitalityCollapsed] = useState(false);
  const { flagUrl } = useFlag(country?.name || '');

  // Unified intelligence hook for metrics
  const {
    metrics: intelligenceMetrics,
    isLoading: intelligenceLoading
  } = useUnifiedIntelligence({
    countryId: country?.id || '',
    userId: user?.id || '',
    autoRefresh: false
  });

  // Fetch government components for atomic integration
  const { data: existingComponents } = api.government.getComponents.useQuery(
    { countryId: country?.id || '' },
    { enabled: !!country?.id }
  );

  // Fetch Defense overview metrics
  const { data: defenseOverview } = api.security.getDefenseOverview.useQuery(
    { countryId: country?.id || '' },
    { enabled: !!country?.id }
  );

  useEffect(() => {
    if (title) {
      document.title = title;
    }
  }, [title]);

  if (isLoading || !country) {
    return null; // Loading handled by AuthenticationGuard
  }

  // Prepare intelligence-specific metrics for the grid
  const metrics = [
    {
      label: 'Security Score',
      value: defenseOverview?.overallScore ? `${defenseOverview.overallScore}/100` : 'N/A',
      subtext: defenseOverview?.securityLevel?.replace('_', ' ') || 'Unknown',
      colorClass: defenseOverview?.overallScore && defenseOverview.overallScore >= 75
        ? 'bg-green-50 dark:bg-green-950/50 text-green-600'
        : defenseOverview?.overallScore && defenseOverview.overallScore >= 50
        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600'
        : 'bg-yellow-50 dark:bg-yellow-950/50 text-yellow-600',
      tooltip: {
        title: 'National Security Status',
        details: [
          `Overall Score: ${defenseOverview?.overallScore || 0}/100`,
          `Security Level: ${defenseOverview?.securityLevel?.replace('_', ' ') || 'Unknown'}`,
          `Military Strength: ${defenseOverview?.militaryStrength || 0}%`
        ]
      }
    },
    {
      label: 'Intelligence Health',
      value: intelligenceMetrics ? `${intelligenceMetrics.overallHealth}%` : 'N/A',
      subtext: 'Overall intelligence operations',
      colorClass: intelligenceMetrics && intelligenceMetrics.overallHealth >= 80
        ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600'
        : intelligenceMetrics && intelligenceMetrics.overallHealth >= 60
        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600'
        : 'bg-yellow-50 dark:bg-yellow-950/50 text-yellow-600',
      tooltip: {
        title: 'Intelligence Operations Health',
        details: [
          `Overall Health: ${intelligenceMetrics?.overallHealth || 0}%`,
          'Composite score across all intelligence systems',
          'Includes security, diplomatic, and economic intelligence'
        ]
      }
    },
    {
      label: 'Active Alerts',
      value: `${intelligenceMetrics?.criticalAlerts || 0}`,
      subtext: `${intelligenceMetrics?.totalAlerts || 0} total alerts`,
      colorClass: intelligenceMetrics && intelligenceMetrics.criticalAlerts > 0
        ? 'bg-red-50 dark:bg-red-950/50 text-red-600'
        : 'bg-green-50 dark:bg-green-950/50 text-green-600',
      tooltip: {
        title: 'Intelligence Alerts',
        details: [
          `Critical Alerts: ${intelligenceMetrics?.criticalAlerts || 0}`,
          `Total Alerts: ${intelligenceMetrics?.totalAlerts || 0}`,
          'Requires immediate attention from leadership'
        ]
      }
    },
    {
      label: 'Active Policies',
      value: `${intelligenceMetrics?.pendingDecisions || 0}`,
      subtext: 'Pending decisions',
      colorClass: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600',
      tooltip: {
        title: 'Policy Status',
        details: [
          `Pending Decisions: ${intelligenceMetrics?.pendingDecisions || 0}`,
          'Active policy initiatives requiring review'
        ]
      }
    }
  ];

  // Add diplomatic channels metric
  metrics.push({
    label: 'Diplomatic Channels',
    value: `${defenseOverview?.activeThreats || 0}`,
    subtext: 'Active diplomatic relations',
    colorClass: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600',
    tooltip: {
      title: 'Diplomatic Operations',
      details: [
        `Active Channels: ${defenseOverview?.activeThreats || 0}`,
        'International diplomatic relationships',
        'Includes embassies and missions'
      ]
    }
  });

  // Add government effectiveness if atomic components exist
  if (existingComponents && existingComponents.length > 0) {
    const avgEffectiveness = existingComponents.reduce((sum, c) => sum + c.effectivenessScore, 0) / existingComponents.length;

    metrics.push({
      label: 'Gov Effectiveness',
      value: `${avgEffectiveness.toFixed(0)}%`,
      subtext: `${existingComponents.length} components`,
      colorClass: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600',
      tooltip: {
        title: 'Government Effectiveness',
        details: [
          `Average Effectiveness: ${avgEffectiveness.toFixed(1)}%`,
          `${existingComponents.length} atomic components active`,
          'Impacts intelligence coordination'
        ]
      }
    });
  }

  // Calculate vitality data with intelligence focus
  const vitalityData = activityRingsData || {
    economicVitality: 0,
    populationWellbeing: 0,
    diplomaticStanding: 0,
    governmentalEfficiency: 0
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Intelligence Header */}
      <div id="overview">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">Intelligence: {country.name}</h1>
                <Badge className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
                  <Activity className="h-3 w-3 mr-1" />
                  {variant.toUpperCase()}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {variant === 'unified' ? 'Unified Intelligence Dashboard & Operations Center' :
                 variant === 'premium' ? 'Executive Intelligence Suite & Command Center' :
                 'Intelligence Dashboard & Analytics'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Crisis Status Banner */}
      <CrisisStatusBanner countryId={country.id} />

      {/* Atomic Government Integration Alert */}
      {existingComponents && existingComponents.length > 0 && (
        <Alert className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <strong>Enhanced Intelligence Operations:</strong> {existingComponents.length} atomic government components
                provide {(existingComponents.reduce((sum, c) => sum + c.effectivenessScore, 0) / existingComponents.length).toFixed(0)}%
                coordination effectiveness.
              </div>
              <Badge variant="secondary" className="ml-2">
                <Activity className="h-3 w-3 mr-1" />
                Active Integration
              </Badge>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Intelligence Status Alert */}
      {intelligenceMetrics && intelligenceMetrics.criticalAlerts > 0 && (
        <Alert className="border-red-200 bg-gradient-to-r from-red-50 to-orange-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <strong>Critical Intelligence Alerts:</strong> {intelligenceMetrics.criticalAlerts} high-priority
                alerts require immediate attention.
              </div>
              <Badge variant="destructive" className="ml-2">
                Urgent Action Required
              </Badge>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

        {/* Left Sidebar - Intelligence Vitality Index */}
        {variant === 'unified' && (
          <div className="xl:col-span-1" id="vitality">
            <Card className="overflow-hidden glass-hierarchy-parent border-purple-200 dark:border-purple-700/40 dark:shadow-purple-900/10 sticky top-6">
              {/* Flag Background with Subtle Depth */}
              <div className="absolute inset-0">
                {flagUrl ? (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/20 z-[1]" />
                    <div className="relative w-full h-full overflow-hidden group ripple-effect">
                      <img
                        src={flagUrl}
                        alt={`${country.name} flag`}
                        className="w-full h-full object-cover opacity-35 scale-125 shadow-inner transition-transform duration-300 group-hover:scale-110"
                        onError={(e) => {
                          console.log('Flag failed to load:', flagUrl);
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-50/85 via-indigo-50/85 to-violet-50/85 dark:from-purple-900/15 dark:via-indigo-900/10 dark:to-violet-800/8 dark:backdrop-blur-[2px] z-[2] group-hover:opacity-90 transition-opacity duration-300" />
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/12 dark:to-indigo-800/8 dark:backdrop-blur-[1px]" />
                )}
              </div>

              <div className="relative z-20">
                <CardHeader className={vitalityCollapsed ? "py-2 px-4" : ""}>
                  <div className="flex items-center justify-between">
                    <CardTitle className={vitalityCollapsed ? "text-sm font-medium" : ""}>
                      {vitalityCollapsed ? "Intelligence Status" : "Intelligence Vitality Index"}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setVitalityCollapsed(!vitalityCollapsed)}
                      className={vitalityCollapsed ? "h-4 w-4 p-0" : "h-8 w-8 p-0"}
                    >
                      {vitalityCollapsed ? (
                        <ChevronDown className="h-2 w-2" />
                      ) : (
                        <ChevronUp className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {!vitalityCollapsed && (
                    <>
                      <Badge variant="outline" className="text-xs w-fit">
                        {intelligenceMetrics ? 'LIVE INTELLIGENCE' : 'INITIALIZING'}
                      </Badge>
                    </>
                  )}
                </CardHeader>

                <CardContent className={vitalityCollapsed ? "px-4 py-2" : ""}>
                  {!vitalityCollapsed && (
                    <>
                      <CountryMetricsGrid
                        metrics={metrics.slice(0, 4)}
                        variant="compact"
                      />
                      <div className="mt-6">
                        <VitalityRings
                          data={vitalityData}
                          variant="sidebar"
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </div>
            </Card>
          </div>
        )}

        {/* Main Content Area */}
        <div className={variant === 'unified' ? "xl:col-span-3" : "col-span-full"}>
          {/* Metrics Grid for non-unified variants */}
          {variant !== 'unified' && (
            <CountryMetricsGrid
              metrics={metrics}
              variant={variant === 'premium' ? 'executive' : 'standard'}
            />
          )}

          {/* Vitality Rings for non-unified variants */}
          {variant !== 'unified' && activityRingsData && (
            <VitalityRings
              data={vitalityData}
              variant="grid"
            />
          )}

          {/* Intelligence Tab System */}
          <div id="tabs">
            <IntelligenceTabSystem variant={variant} />
          </div>
        </div>
      </div>
    </div>
  );
}
