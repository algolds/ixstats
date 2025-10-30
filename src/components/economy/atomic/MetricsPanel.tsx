/**
 * Metrics Panel
 *
 * Display comprehensive economic metrics for selected components.
 * Optimized with React.memo for performance.
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { BarChart3, DollarSign, TrendingUp, Users, Gauge } from 'lucide-react';
import type { EconomicMetrics } from '~/lib/atomic-economic-utils';
import { formatCurrency, formatPercentage, getEffectivenessColor } from '~/lib/atomic-economic-utils';

export interface MetricsPanelProps {
  metrics: EconomicMetrics;
}

/**
 * Metrics Panel Component
 */
function MetricsPanelComponent({ metrics }: MetricsPanelProps) {
  const effectivenessColor = getEffectivenessColor(metrics.effectiveness.totalEffectiveness);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Effectiveness */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Gauge className="w-4 h-4" />
            Effectiveness
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold text-${effectivenessColor}-600`}>
                {metrics.effectiveness.totalEffectiveness.toFixed(1)}
              </span>
              <span className="text-sm text-gray-500">/ 100</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Base:</span>
                <span className="font-medium">{metrics.effectiveness.baseEffectiveness.toFixed(1)}</span>
              </div>
              {metrics.effectiveness.synergyBonus > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Synergies:</span>
                  <span className="font-medium">+{metrics.effectiveness.synergyBonus}</span>
                </div>
              )}
              {metrics.effectiveness.conflictPenalty > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Conflicts:</span>
                  <span className="font-medium">-{metrics.effectiveness.conflictPenalty}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Costs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Costs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <div className="text-xs text-gray-600 mb-1">Implementation</div>
              <div className="text-lg font-bold text-gray-900">
                {formatCurrency(metrics.totalCost)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Annual Maintenance</div>
              <div className="text-sm font-medium text-gray-700">
                {formatCurrency(metrics.maintenanceCost)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tax Rates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Optimal Tax Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <div className="text-xs text-gray-600 mb-1">Corporate Tax</div>
              <div className="text-lg font-bold text-gray-900">
                {metrics.optimalTaxRates.corporate}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Income Tax</div>
              <div className="text-sm font-medium text-gray-700">
                {metrics.optimalTaxRates.income}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employment Impact */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4" />
            Employment Impact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Unemployment:</span>
              <Badge
                variant={metrics.employmentImpact.unemployment < 0 ? 'default' : 'destructive'}
                className="text-xs"
              >
                {metrics.employmentImpact.unemployment > 0 ? '+' : ''}
                {metrics.employmentImpact.unemployment.toFixed(1)}%
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Participation:</span>
              <Badge variant="secondary" className="text-xs">
                {metrics.employmentImpact.participation.toFixed(2)}x
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Wage Growth:</span>
              <Badge variant="secondary" className="text-xs">
                {metrics.employmentImpact.wageGrowth.toFixed(2)}x
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const MetricsPanel = React.memo(MetricsPanelComponent);
