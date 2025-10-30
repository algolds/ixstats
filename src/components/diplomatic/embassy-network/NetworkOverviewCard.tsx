"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Globe } from "lucide-react";
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-500" />
          Embassy Network Power
          <InlineHelpIcon
            title="Embassy Network"
            content="Your total diplomatic influence calculated from active embassies and atomic government synergies. Shared atomic components between nations amplify economic, diplomatic, and cultural benefits."
          />
        </CardTitle>
        <CardDescription>Your diplomatic network strength and atomic synergies</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {networkMetrics.totalEmbassies}
            </div>
            <div className="text-muted-foreground text-xs">Active Embassies</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {networkMetrics.networkPower}
            </div>
            <div className="text-muted-foreground text-xs">Network Power</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {networkMetrics.avgSynergyScore.toFixed(0)}%
            </div>
            <div className="text-muted-foreground text-xs">Avg Synergy</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              +{networkMetrics.totalEconomicBonus.toFixed(1)}%
            </div>
            <div className="text-muted-foreground text-xs">Economic Bonus</div>
          </div>
        </div>

        {/* Bonus Breakdown with Progress Bars */}
        <div className="grid grid-cols-3 gap-3 border-t pt-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Economic</span>
              <span className="font-semibold text-green-600">
                +{networkMetrics.totalEconomicBonus.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={Math.min(100, networkMetrics.totalEconomicBonus * 5)}
              className="h-2"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Diplomatic</span>
              <span className="font-semibold text-blue-600">
                +{networkMetrics.totalDiplomaticBonus.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={Math.min(100, networkMetrics.totalDiplomaticBonus * 5)}
              className="h-2"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Cultural</span>
              <span className="font-semibold text-purple-600">
                +{networkMetrics.totalCulturalBonus.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={Math.min(100, networkMetrics.totalCulturalBonus * 5)}
              className="h-2"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
