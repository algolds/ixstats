/**
 * Summary Metrics Card Component
 *
 * Displays a summary metric with icon, trend indicator, and value.
 *
 * @module SummaryMetricsCard
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { cn } from '~/lib/utils';
import type { SummaryMetric } from '~/lib/analytics-data-transformers';

interface SummaryMetricsCardProps {
  metric: SummaryMetric;
  index: number;
}

export const SummaryMetricsCard = React.memo<SummaryMetricsCardProps>(({ metric, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="glass-surface glass-refraction">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <div className={cn('p-2 rounded-lg', metric.bg)}>
              <metric.icon className={cn('h-5 w-5', metric.color)} />
            </div>
            {metric.trend === 'up' ? (
              <ArrowUpRight className="h-5 w-5 text-green-600" />
            ) : metric.trend === 'down' ? (
              <ArrowDownRight className="h-5 w-5 text-red-600" />
            ) : (
              <Minus className="h-5 w-5 text-gray-600" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">{metric.title}</p>
          <p className="text-2xl font-bold mt-1">
            {typeof metric.value === 'number' && metric.value < 100 ? `${metric.value.toFixed(1)}%` : metric.value}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
});

SummaryMetricsCard.displayName = 'SummaryMetricsCard';
