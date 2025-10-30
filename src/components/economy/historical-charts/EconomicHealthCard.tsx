// src/components/economy/historical-charts/EconomicHealthCard.tsx
/**
 * Economic Health Card Component
 *
 * Displays economic trend indicator with trend direction
 */

import React from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { Activity, HelpCircle } from "lucide-react";
import type { EconomicTrend } from "~/lib/historical-economic-data-transformers";

interface EconomicHealthCardProps {
  economicHealthTrend: EconomicTrend;
}

export const EconomicHealthCard = React.memo(function EconomicHealthCard({
  economicHealthTrend,
}: EconomicHealthCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="text-primary h-4 w-4" />
            <span className="text-sm font-medium">Economic Trend</span>
          </div>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="text-muted-foreground h-3 w-3" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Recent economic performance trend</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="space-y-1">
          <div
            className={`text-2xl font-bold ${
              economicHealthTrend.trend === "improving"
                ? "text-green-600"
                : economicHealthTrend.trend === "declining"
                  ? "text-red-600"
                  : "text-blue-600"
            }`}
          >
            {economicHealthTrend.trend === "improving"
              ? "↗"
              : economicHealthTrend.trend === "declining"
                ? "↘"
                : "→"}
          </div>
          <div className="text-muted-foreground text-xs capitalize">
            {economicHealthTrend.trend}
          </div>
          <div className="text-muted-foreground text-xs">
            {Math.abs(economicHealthTrend.value).toFixed(1)}% change
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
