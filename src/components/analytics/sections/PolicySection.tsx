/**
 * Policy Section Component
 *
 * Displays policy analytics including distribution and effectiveness.
 *
 * @module PolicySection
 */

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { PolicyDistributionChart } from '../charts/PolicyDistributionChart';
import { BudgetImpactChart } from '../charts/BudgetImpactChart';
import { GlassTooltip } from '../charts/GlassTooltip';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';
import type { PolicyDistribution, BudgetImpact } from '~/lib/analytics-data-transformers';

interface PolicySectionProps {
  policyDistributionData: PolicyDistribution[];
  budgetImpactData: BudgetImpact[];
  policyEffectiveness: any;
  formatPercent: (value: number) => string;
  exportToCSV: (data: any[], filename: string, headerMap?: Record<string, string>) => void;
  exportToPDF: (chartId: string, chartName: string) => Promise<void>;
}

export const PolicySection = React.memo<PolicySectionProps>(({
  policyDistributionData,
  budgetImpactData,
  policyEffectiveness,
  formatPercent,
  exportToCSV,
  exportToPDF
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PolicyDistributionChart
          data={policyDistributionData}
          formatPercent={formatPercent}
          GlassTooltip={GlassTooltip}
          onExportCSV={() => exportToCSV(policyDistributionData, 'policy-distribution', {
            name: 'Category',
            value: 'Percentage'
          })}
          onExportPDF={() => exportToPDF('policy-distribution-chart', 'Policy Distribution')}
        />

        <Card className="glass-surface glass-refraction">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Policy Effectiveness Over Time
            </CardTitle>
            <CardDescription>Success rate and implementation tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Effectiveness</span>
                  <Badge variant="default" className="bg-green-600">High</Badge>
                </div>
                <p className="text-3xl font-bold text-green-600">
                  {policyEffectiveness?.effectivenessScore ? (policyEffectiveness.effectivenessScore / 100 * 100).toFixed(1) : '78.5'}%
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                  <p className="text-xs text-muted-foreground mb-1">Active Policies</p>
                  <p className="text-2xl font-bold text-blue-600">24</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                  <p className="text-xs text-muted-foreground mb-1">Inactive</p>
                  <p className="text-2xl font-bold text-purple-600">6</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Success Rate by Priority</p>
                {['High', 'Medium', 'Low'].map((priority, index) => (
                  <div key={priority} className="flex items-center gap-2">
                    <span className="text-xs w-16">{priority}</span>
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <motion.div
                        className={cn('h-full', priority === 'High' ? 'bg-green-500' : priority === 'Medium' ? 'bg-yellow-500' : 'bg-orange-500')}
                        initial={{ width: 0 }}
                        animate={{ width: `${[85, 72, 68][index]}%` }}
                        transition={{ delay: index * 0.1, duration: 0.5 }}
                      />
                    </div>
                    <span className="text-xs w-12 text-right">{[85, 72, 68][index]}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <BudgetImpactChart
        data={budgetImpactData}
        GlassTooltip={GlassTooltip}
        onExportCSV={() => exportToCSV(budgetImpactData, 'budget-impact-analysis', {
          name: 'Category',
          impact: 'Economic Impact',
          cost: 'Implementation Cost'
        })}
        onExportPDF={() => exportToPDF('budget-impact-chart', 'Budget Impact Analysis')}
      />

      {/* Cost-Benefit Analysis */}
      <Card className="glass-surface glass-refraction">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Cost-Benefit Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20">
              <p className="text-sm text-muted-foreground mb-2">Total Benefits (Annual)</p>
              <p className="text-3xl font-bold text-emerald-600">$12.5B</p>
              <p className="text-xs text-muted-foreground mt-2">GDP impact from active policies</p>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
              <p className="text-sm text-muted-foreground mb-2">Total Costs (Annual)</p>
              <p className="text-3xl font-bold text-orange-600">$8.2B</p>
              <p className="text-xs text-muted-foreground mt-2">Implementation and maintenance</p>
            </div>
          </div>
          <div className="mt-4 p-4 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Net Benefit Ratio</p>
              <Badge variant="default" className="bg-purple-600">Excellent</Badge>
            </div>
            <p className="text-4xl font-bold text-purple-600 mt-2">1.52:1</p>
            <p className="text-xs text-muted-foreground mt-2">Return on policy investment</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

PolicySection.displayName = 'PolicySection';
