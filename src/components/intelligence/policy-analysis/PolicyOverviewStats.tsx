"use client";

/**
 * PolicyOverviewStats
 *
 * Displays a 4-card stats grid showing overall policy effectiveness,
 * component score, tax efficiency, and active component count.
 *
 * @module PolicyOverviewStats
 */

import React from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Target, Zap, TrendingUp, Activity } from "lucide-react";
import type { PolicyEffectivenessData } from "~/hooks/usePolicyAnalytics";

interface PolicyOverviewStatsProps {
  policyEffectiveness: PolicyEffectivenessData;
  componentCount: number;
}

export const PolicyOverviewStats = React.memo(function PolicyOverviewStats({
  policyEffectiveness,
  componentCount,
}: PolicyOverviewStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <Card className="glass-hierarchy-child">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Overall Effectiveness</p>
              <p className="text-3xl font-bold">{policyEffectiveness.overall}%</p>
            </div>
            <Target className="h-8 w-8 text-indigo-600" />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-hierarchy-child">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Component Score</p>
              <p className="text-3xl font-bold">{Math.round(policyEffectiveness.components)}%</p>
            </div>
            <Zap className="h-8 w-8 text-purple-600" />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-hierarchy-child">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Tax Efficiency</p>
              <p className="text-3xl font-bold">{policyEffectiveness.tax}%</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-hierarchy-child">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Active Components</p>
              <p className="text-3xl font-bold">{componentCount}</p>
            </div>
            <Activity className="h-8 w-8 text-blue-600" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
