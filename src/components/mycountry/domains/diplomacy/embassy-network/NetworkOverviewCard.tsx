"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Globe } from "iconoir-react";
import { InlineHelpIcon } from "~/components/ui/help-icon";

/**
 * Network metrics for the embassy network
 */
interface NetworkMetrics {
  totalEmbassies: number;
  avgSynergyScore: number;
  totalEconomicBonus: number;
  totalDiplomaticBonus: number;
  totalCulturalBonus: number;
  networkPower: number;
}

/**
 * Props for NetworkOverviewCard component
 */
interface NetworkOverviewCardProps {
  /** Aggregated metrics for the entire embassy network */
  networkMetrics: NetworkMetrics;
}

/**
 * NetworkOverviewCard Component
 *
 * Displays aggregated metrics for the embassy network including network power,
 * active embassies, average synergy, and bonuses across economic, diplomatic,
 * and cultural dimensions.
 *
 * Features:
 * - Intel-themed gradient background (blue to purple)
 * - Grid layout for key metrics
 * - Progress bars for bonus breakdown
 * - Help tooltip for network explanation
 *
 * @example
 * ```tsx
 * <NetworkOverviewCard networkMetrics={metrics} />
 * ```
 */
export const NetworkOverviewCard = React.memo(function NetworkOverviewCard({
  networkMetrics,
}: NetworkOverviewCardProps) {
  return (
    <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-purple-500/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Globe className="h-4 w-4 text-blue-500" />
          Embassy Network Power
          <InlineHelpIcon
            title="Embassy Network"
            content="Your total diplomatic influence calculated from active embassies and atomic government synergies. Shared atomic components between nations amplify economic, diplomatic, and cultural benefits."
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-0.5">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {networkMetrics.totalEmbassies}
            </div>
            <div className="text-muted-foreground text-[11px]">Embassies</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
              {networkMetrics.networkPower}
            </div>
            <div className="text-muted-foreground text-[11px]">Power</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {networkMetrics.avgSynergyScore.toFixed(0)}%
            </div>
            <div className="text-muted-foreground text-[11px]">Synergy</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
              +{networkMetrics.totalEconomicBonus.toFixed(1)}%
            </div>
            <div className="text-muted-foreground text-[11px]">Econ Bonus</div>
          </div>
        </div>

        {/* Bonus Breakdown with Progress Bars */}
        <div className="grid grid-cols-3 gap-2 border-t pt-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Economic</span>
              <span className="font-semibold text-green-600">
                +{networkMetrics.totalEconomicBonus.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={Math.min(100, networkMetrics.totalEconomicBonus * 5)}
              className="h-1.5"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Diplomatic</span>
              <span className="font-semibold text-blue-600">
                +{networkMetrics.totalDiplomaticBonus.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={Math.min(100, networkMetrics.totalDiplomaticBonus * 5)}
              className="h-1.5"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Cultural</span>
              <span className="font-semibold text-purple-600">
                +{networkMetrics.totalCulturalBonus.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={Math.min(100, networkMetrics.totalCulturalBonus * 5)}
              className="h-1.5"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
