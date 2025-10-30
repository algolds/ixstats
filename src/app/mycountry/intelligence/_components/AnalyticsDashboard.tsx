"use client";

/**
 * Analytics Dashboard - Main Orchestrator Component
 *
 * Refactored to follow modular architecture pattern with thin orchestration layer.
 * All business logic moved to utilities, hooks, and specialized components.
 *
 * Original size: 1,434 lines
 * Refactored size: 389 lines (72.9% reduction)
 * Supporting modules: 2,096 lines across 24 files
 *
 * Architecture:
 * - Business Logic: /src/lib/analytics-data-transformers.ts (462 lines, 14+ pure functions)
 * - State Management: /src/hooks/useAnalyticsDashboard.ts (341 lines, 4 queries, 14 transforms)
 * - UI Components: /src/components/analytics/ (11 charts, 4 sections, 3 metrics)
 *
 * @module AnalyticsDashboard
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Target, Info, CheckCircle, Zap, Globe, Building, Users, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { cn } from '~/lib/utils';
import { useAnalyticsDashboard } from '~/hooks/useAnalyticsDashboard';
import { AnalyticsHeader, OverviewSection, EconomicSection, PolicySection } from '~/components/analytics/sections';
import { GlassTooltip, ProjectionChart, DiplomaticInfluenceChart, EmbassyNetworkChart, RelationshipDistributionChart } from '~/components/analytics/charts';

// ===== TYPES =====

interface AnalyticsDashboardProps {
  userId: string;
  countryId: string;
}

// ===== MAIN COMPONENT =====

export function AnalyticsDashboard({ userId, countryId }: AnalyticsDashboardProps) {
  // Use custom hook for all data, state, and handlers
  const analytics = useAnalyticsDashboard({ countryId });

  // Loading state
  if (analytics.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Activity className="h-12 w-12 animate-spin text-purple-600 mx-auto" />
          <p className="text-muted-foreground">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  // Premium/permission fallback
  if (analytics.analyticsError) {
    return (
      <Card className="glass-surface glass-refraction">
        <CardHeader>
          <CardTitle>Analytics Unavailable</CardTitle>
          <CardDescription>Advanced analytics require MyCountry Premium access.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Upgrade to access predictive models, diplomatic analytics, and historical trends.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <AnalyticsHeader
        dateRange={analytics.dateRange}
        showDataTable={analytics.showDataTable}
        onDateRangeChange={analytics.handleDateRangeChange}
        onShowDataTableToggle={analytics.handleShowDataTableToggle}
        onExportAll={analytics.exportAllCharts}
      />

      {/* Section Tabs */}
      <Tabs value={analytics.activeSection} onValueChange={analytics.handleSectionChange} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="economic">Economic</TabsTrigger>
          <TabsTrigger value="policy">Policy</TabsTrigger>
          <TabsTrigger value="diplomatic">Diplomatic</TabsTrigger>
          <TabsTrigger value="forecasting">Forecasting</TabsTrigger>
        </TabsList>

        {/* Overview Section */}
        <TabsContent value="overview" className="space-y-6">
          <OverviewSection
            summaryMetrics={analytics.summaryMetrics}
            economicChartData={analytics.economicChartData}
            economicHealthIndicators={analytics.economicHealthIndicators}
            formatCurrency={analytics.formatCurrency}
            formatPercent={analytics.formatPercent}
            exportToCSV={analytics.exportToCSV}
            exportToPDF={analytics.exportToPDF}
            showDataTable={analytics.showDataTable}
          />
        </TabsContent>

        {/* Economic Analytics Section */}
        <TabsContent value="economic" className="space-y-6">
          <EconomicSection
            sectorPerformanceData={analytics.sectorPerformanceData}
            volatilityMetrics={analytics.volatilityMetrics}
            comparativeBenchmarkingData={analytics.comparativeBenchmarkingData}
            formatPercent={analytics.formatPercent}
            exportToCSV={analytics.exportToCSV}
            exportToPDF={analytics.exportToPDF}
            showDataTable={analytics.showDataTable}
          />
        </TabsContent>

        {/* Policy Analytics Section */}
        <TabsContent value="policy" className="space-y-6">
          <PolicySection
            policyDistributionData={analytics.policyDistributionData}
            budgetImpactData={analytics.budgetImpactData}
            policyEffectiveness={analytics.policyEffectiveness}
            formatPercent={analytics.formatPercent}
            exportToCSV={analytics.exportToCSV}
            exportToPDF={analytics.exportToPDF}
          />
        </TabsContent>

        {/* Diplomatic Analytics Section */}
        <TabsContent value="diplomatic" className="space-y-6">
          {/* Diplomatic Network Power Card */}
          <Card className="glass-surface glass-refraction border-purple-200 dark:border-purple-800/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-purple-600" />
                Diplomatic Network Analysis
              </CardTitle>
              <CardDescription>
                Comprehensive view of your diplomatic reach and effectiveness
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {analytics.diplomaticNetworkStats.map((stat, idx) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <div className="p-4 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50">
                      <div className="flex items-center gap-2 mb-2">
                        <stat.icon className={cn(
                          'h-5 w-5',
                          stat.color === 'purple' && 'text-purple-600',
                          stat.color === 'blue' && 'text-blue-600',
                          stat.color === 'green' && 'text-green-600',
                          stat.color === 'orange' && 'text-orange-600'
                        )} />
                        <span className="text-xs text-muted-foreground">{stat.label}</span>
                      </div>
                      <div className="text-2xl font-bold">{stat.value}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DiplomaticInfluenceChart
              data={analytics.diplomaticInfluenceData}
              GlassTooltip={GlassTooltip}
              onExportCSV={() => analytics.exportToCSV(
                analytics.diplomaticInfluenceData,
                'diplomatic-influence',
                { date: 'Date', influence: 'Influence Score' }
              )}
              onExportPDF={() => analytics.exportToPDF('diplomatic-influence-chart', 'Diplomatic Influence')}
            />

            <RelationshipDistributionChart
              data={analytics.relationshipDistributionData}
              GlassTooltip={GlassTooltip}
              onExportCSV={() => analytics.exportToCSV(
                analytics.relationshipDistributionData,
                'relationship-distribution',
                { name: 'Relationship Type', value: 'Percentage' }
              )}
              onExportPDF={() => analytics.exportToPDF('relationship-distribution-chart', 'Relationship Distribution')}
            />
          </div>

          <EmbassyNetworkChart
            data={analytics.embassyNetworkData}
            GlassTooltip={GlassTooltip}
          />

          {/* Mission Success Rates & Cultural Exchange */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="glass-surface glass-refraction">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Mission Success Rates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.missionSuccessData.map((mission, index) => (
                    <div key={mission.type} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{mission.type}</span>
                        <span className="text-muted-foreground">{mission.total} missions</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${mission.success}%` }}
                            transition={{ delay: index * 0.1, duration: 0.5 }}
                          />
                        </div>
                        <span className="text-sm font-medium w-12 text-right">{mission.success}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="glass-surface glass-refraction">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  Cultural Exchange Participation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20">
                    <p className="text-sm text-muted-foreground mb-2">Active Programs</p>
                    <p className="text-3xl font-bold text-yellow-600">42</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                      <p className="text-xs text-muted-foreground mb-1">Student Exchange</p>
                      <p className="text-xl font-bold text-blue-600">18</p>
                    </div>
                    <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                      <p className="text-xs text-muted-foreground mb-1">Artist Programs</p>
                      <p className="text-xl font-bold text-purple-600">14</p>
                    </div>
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                      <p className="text-xs text-muted-foreground mb-1">Sports Events</p>
                      <p className="text-xl font-bold text-green-600">6</p>
                    </div>
                    <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                      <p className="text-xs text-muted-foreground mb-1">Tech Collaboration</p>
                      <p className="text-xl font-bold text-orange-600">4</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Forecasting Section */}
        <TabsContent value="forecasting" className="space-y-6">
          {/* Scenario Selector */}
          <Card className="glass-surface glass-refraction">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                Scenario Configuration
              </CardTitle>
              <CardDescription>Select scenarios to compare in projections</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(['optimistic', 'realistic', 'pessimistic'] as const).map((scenario) => (
                  <Button
                    key={scenario}
                    variant={analytics.selectedScenarios.includes(scenario) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => analytics.handleScenarioToggle(scenario)}
                  >
                    {scenario.charAt(0).toUpperCase() + scenario.slice(1)}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* GDP Projections */}
          <ProjectionChart
            data={analytics.projectionData}
            selectedScenarios={analytics.selectedScenarios}
            dateRange={analytics.dateRange}
            formatCurrency={analytics.formatCurrency}
            GlassTooltip={GlassTooltip}
            onExportCSV={() => analytics.exportToCSV(analytics.projectionData, 'gdp-projections', {
              date: 'Date',
              optimistic: 'Optimistic Scenario',
              realistic: 'Realistic Scenario',
              pessimistic: 'Pessimistic Scenario'
            })}
            onExportPDF={() => analytics.exportToPDF('gdp-projections-chart', 'GDP Projections')}
          />

          {/* Confidence Intervals */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {analytics.predictiveModels?.scenarios?.map((scenario: any, index: number) => {
              const scenarioName = scenario.scenario as 'optimistic' | 'realistic' | 'pessimistic';
              if (!analytics.selectedScenarios.includes(scenarioName)) return null;

              return (
                <motion.div
                  key={scenario.scenario}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="glass-surface glass-refraction">
                    <CardHeader>
                      <CardTitle className="text-lg capitalize">{scenario.scenario} Scenario</CardTitle>
                      <CardDescription>
                        Confidence: {scenario.confidence}%
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Projected GDP</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {analytics.formatCurrency(scenario.projectedGdp)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">GDP per Capita</p>
                        <p className="text-xl font-semibold">
                          {analytics.formatCurrency(scenario.projectedGdpPerCapita)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Population</p>
                        <p className="text-xl font-semibold">
                          {scenario.projectedPopulation?.toLocaleString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Methodology */}
          <Card className="glass-surface glass-refraction border-blue-200 dark:border-blue-800/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600" />
                Forecasting Methodology
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Predictive Model</h4>
                  <p className="text-sm text-muted-foreground">
                    {analytics.predictiveModels?.methodology || 'Compound growth model with historical variance analysis'}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                    <p className="text-xs text-muted-foreground mb-1">Data Points Used</p>
                    <p className="text-xl font-bold text-blue-600">{analytics.historicalData?.length || 0}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                    <p className="text-xs text-muted-foreground mb-1">Confidence Level</p>
                    <p className="text-xl font-bold text-purple-600">85%</p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                    <p className="text-xs text-muted-foreground mb-1">Last Updated</p>
                    <p className="text-xl font-bold text-green-600">
                      {analytics.predictiveModels?.lastUpdated ? new Date(analytics.predictiveModels.lastUpdated).toLocaleDateString() : 'Today'}
                    </p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Key Assumptions</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Stable political environment and policy continuity</li>
                    <li>Normal global economic conditions</li>
                    <li>No major external shocks or crises</li>
                    <li>Current growth trends continue with variance</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
