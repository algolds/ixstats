"use client";

import React from "react";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Progress } from "~/components/ui/progress";
import { Globe } from "iconoir-react";
import { InlineHelpIcon } from "~/components/ui/help-icon";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

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
  const kpis = [
    { label: "Embassies", value: String(networkMetrics.totalEmbassies) },
    { label: "Power", value: String(networkMetrics.networkPower) },
    { label: "Synergy", value: `${networkMetrics.avgSynergyScore.toFixed(0)}%` },
    { label: "Econ bonus", value: `+${networkMetrics.totalEconomicBonus.toFixed(1)}%` },
  ];
  const bonuses = [
    { label: "Economic", value: networkMetrics.totalEconomicBonus },
    { label: "Diplomatic", value: networkMetrics.totalDiplomaticBonus },
    { label: "Cultural", value: networkMetrics.totalCulturalBonus },
  ];

  return (
    <Card className="rounded-card">
      <CardHeader className="p-4 pb-2">
        <h3 className="text-label text-headline flex items-center gap-2">
          <Globe className="text-cyan h-4 w-4" />
          Embassy Network Power
          <InlineHelpIcon
            title="Embassy Network"
            content="Your total diplomatic influence calculated from active embassies and atomic government synergies. Shared atomic components between nations amplify economic, diplomatic, and cultural benefits."
          />
        </h3>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="space-y-0.5">
              <div className="text-label text-title-3 tabular-nums">{k.value}</div>
              <Eyebrow>{k.label}</Eyebrow>
            </div>
          ))}
        </div>

        <div className="border-separator grid grid-cols-3 gap-2 border-t pt-3">
          {bonuses.map((b) => (
            <div key={b.label} className="space-y-1">
              <div className="text-footnote flex items-center justify-between">
                <span className="text-label-secondary">{b.label}</span>
                <span className="text-label font-semibold tabular-nums">
                  +{b.value.toFixed(1)}%
                </span>
              </div>
              <Progress value={Math.min(100, b.value * 5)} className="h-1.5" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});
