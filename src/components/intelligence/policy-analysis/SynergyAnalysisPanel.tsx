"use client";

/**
 * SynergyAnalysisPanel
 *
 * Displays a radar chart for category balance plus synergy and conflict
 * cards. Shows an empty state when no component data is available.
 *
 * @module SynergyAnalysisPanel
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Zap, CheckCircle, AlertCircle } from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { SynergyAnalysisData } from "~/hooks/usePolicyAnalytics";

interface SynergyAnalysisPanelProps {
  synergyAnalysis: SynergyAnalysisData | null;
}

export const SynergyAnalysisPanel = React.memo(function SynergyAnalysisPanel({
  synergyAnalysis,
}: SynergyAnalysisPanelProps) {
  return (
    <Card className="glass-hierarchy-child">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-600" />
          Component Synergy Analysis
        </CardTitle>
        <CardDescription>
          How your government components work together
        </CardDescription>
      </CardHeader>
      <CardContent>
        {synergyAnalysis ? (
          <div className="space-y-6">
            {/* Radar Chart */}
            <div>
              <h4 className="font-semibold mb-4">Category Balance</h4>
              <ResponsiveContainer width="100%" height={300} className="sm:h-[350px] lg:h-[400px]">
                <RadarChart data={synergyAnalysis.radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="category" className="text-xs" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar
                    name="Component Strength"
                    dataKey="score"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.6}
                  />
                  <Tooltip contentStyle={{ fontSize: "12px" }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Synergies */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h4 className="font-semibold">Positive Synergies</h4>
                <Badge variant="secondary">{synergyAnalysis.synergies.length}</Badge>
              </div>
              {synergyAnalysis.synergies.length > 0 ? (
                <div className="space-y-2">
                  {synergyAnalysis.synergies.map((synergy, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <span className="font-medium">{synergy.component1.replace(/_/g, " ")}</span>
                          <span className="text-muted-foreground"> + </span>
                          <span className="font-medium">{synergy.component2.replace(/_/g, " ")}</span>
                        </div>
                        <Badge className="bg-green-600 text-white">+{synergy.bonus}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No significant synergies detected</p>
              )}
            </div>

            {/* Conflicts */}
            {synergyAnalysis.conflicts.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <h4 className="font-semibold">Component Conflicts</h4>
                  <Badge variant="destructive">{synergyAnalysis.conflicts.length}</Badge>
                </div>
                <div className="space-y-2">
                  {synergyAnalysis.conflicts.map((conflict, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <span className="font-medium">{conflict.component1.replace(/_/g, " ")}</span>
                          <span className="text-muted-foreground"> ⚠️ </span>
                          <span className="font-medium">{conflict.component2.replace(/_/g, " ")}</span>
                        </div>
                        <Badge variant="destructive">-{conflict.penalty}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Zap className="mx-auto h-12 w-12 opacity-50 mb-4" />
            <p>No component data available for synergy analysis</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
