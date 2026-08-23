"use client";

/**
 * PolicyEffectivenessPanel
 *
 * Shows component effectiveness list with progress bars and an overall
 * performance summary badge. Handles the empty state when no components
 * are configured.
 *
 * @module PolicyEffectivenessPanel
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Archery as Target, Activity } from "iconoir-react";
import { cn } from "~/lib/utils";
import type { PolicyEffectivenessData } from "~/hooks/usePolicyAnalytics";

interface GovernmentComponent {
  id: string;
  componentType: string;
  effectivenessScore: number;
}

interface PolicyEffectivenessPanelProps {
  components: GovernmentComponent[] | undefined;
  policyEffectiveness: PolicyEffectivenessData | null;
}

export const PolicyEffectivenessPanel = React.memo(function PolicyEffectivenessPanel({
  components,
  policyEffectiveness,
}: PolicyEffectivenessPanelProps) {
  return (
    <Card className="facet-hierarchy-child">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-purple-600" />
          Current Policy Effectiveness
        </CardTitle>
        <CardDescription>Performance metrics for your active policies</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {components && components.length > 0 ? (
          <>
            <div className="space-y-4">
              {components.slice(0, 8).map((component) => (
                <div key={component.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {component.componentType.replace(/_/g, " ")}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        component.effectivenessScore >= 75
                          ? "bg-green-100 text-green-800 dark:bg-green-900/20"
                          : component.effectivenessScore >= 50
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20"
                      )}
                    >
                      {component.effectivenessScore}%
                    </Badge>
                  </div>
                  <Progress value={component.effectivenessScore} className="h-2" />
                </div>
              ))}
            </div>

            {policyEffectiveness && (
              <div className="mt-6 rounded-lg border bg-gradient-to-r from-indigo-50/50 to-purple-50/50 p-6 dark:from-indigo-950/20 dark:to-purple-950/20">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="font-semibold">Overall Policy Performance</h4>
                  <Badge variant="secondary" className="text-lg">
                    {policyEffectiveness.overall}%
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                  {policyEffectiveness.overall >= 75
                    ? "Excellent - Your policies are highly effective"
                    : policyEffectiveness.overall >= 60
                      ? "Good - Policies performing above average"
                      : policyEffectiveness.overall >= 45
                        ? "Fair - Room for improvement"
                        : "Needs Attention - Consider policy reforms"}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="text-muted-foreground py-12 text-center">
            <Activity className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>No active policies configured</p>
            <p className="mt-2 text-sm">Visit the MyCountry Editor to set up your government</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
