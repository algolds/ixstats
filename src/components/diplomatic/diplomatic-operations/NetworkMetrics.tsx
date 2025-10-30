/**
 * Network Metrics Component
 *
 * Displays network-wide metrics for diplomatic operations.
 *
 * @module components/diplomatic/diplomatic-operations/NetworkMetrics
 */

"use client";

import React from 'react';
import { Building2, CheckCircle, TrendingUp, Star, Zap } from 'lucide-react';
import type { NetworkMetrics as NetworkMetricsType } from '~/lib/diplomatic-operations-utils';

export interface NetworkMetricsProps {
  metrics: NetworkMetricsType;
}

/**
 * Network Metrics - Displays aggregate diplomatic network statistics
 */
export const NetworkMetrics = React.memo(function NetworkMetrics({ metrics }: NetworkMetricsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div className="p-3 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-4 w-4 text-blue-600" />
          <span className="text-xs text-muted-foreground">Embassies</span>
        </div>
        <p className="text-2xl font-bold text-blue-600">{metrics.totalEmbassies}</p>
      </div>

      <div className="p-3 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-xs text-muted-foreground">Active</span>
        </div>
        <p className="text-2xl font-bold text-green-600">{metrics.activeCount}</p>
      </div>

      <div className="p-3 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-4 w-4 text-purple-600" />
          <span className="text-xs text-muted-foreground">Avg Influence</span>
        </div>
        <p className="text-2xl font-bold text-purple-600">{Math.round(metrics.avgInfluence)}%</p>
      </div>

      <div className="p-3 rounded-lg bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20">
        <div className="flex items-center gap-2 mb-1">
          <Star className="h-4 w-4 text-amber-600" />
          <span className="text-xs text-muted-foreground">Total Levels</span>
        </div>
        <p className="text-2xl font-bold text-amber-600">{metrics.totalLevel}</p>
      </div>

      <div className="p-3 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="h-4 w-4 text-indigo-600" />
          <span className="text-xs text-muted-foreground">Network Power</span>
        </div>
        <p className="text-2xl font-bold text-indigo-600">{metrics.networkPower}</p>
      </div>
    </div>
  );
});
