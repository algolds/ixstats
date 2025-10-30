/**
 * Metrics Panel
 *
 * Display key metrics: total components, costs, synergies, etc.
 * Optimized with React.memo for performance.
 *
 * @module MetricsPanel
 */

import React from 'react';
import { Card, CardContent } from '~/components/ui/card';
import { TrendingUp, DollarSign, Zap, AlertTriangle, Package, Target } from 'lucide-react';

export interface MetricsPanelProps {
  metrics: {
    totalComponents: number;
    totalEffectiveness: number;
    implementationCost: number;
    maintenanceCost: number;
    synergyCount: number;
    conflictCount: number;
  };
}

/**
 * Display government metrics in glass card layout
 */
export const MetricsPanel = React.memo<MetricsPanelProps>(({ metrics }) => {
  const metricItems = [
    {
      label: 'Components',
      value: metrics.totalComponents,
      icon: Package,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      label: 'Effectiveness',
      value: `${metrics.totalEffectiveness.toFixed(1)}%`,
      icon: Target,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    },
    {
      label: 'Implementation',
      value: `$${(metrics.implementationCost / 1000).toFixed(0)}k`,
      icon: DollarSign,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
    },
    {
      label: 'Maintenance',
      value: `$${(metrics.maintenanceCost / 1000).toFixed(0)}k/yr`,
      icon: TrendingUp,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    },
    {
      label: 'Synergies',
      value: metrics.synergyCount,
      icon: Zap,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
    },
    {
      label: 'Conflicts',
      value: metrics.conflictCount,
      icon: AlertTriangle,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {metricItems.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${item.bgColor}`}>
                  <Icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">
                    {item.label}
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                    {item.value}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
});

MetricsPanel.displayName = 'MetricsPanel';
