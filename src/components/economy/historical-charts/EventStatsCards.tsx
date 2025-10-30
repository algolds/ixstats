// src/components/economy/historical-charts/EventStatsCards.tsx
/**
 * Event Statistics Cards Component
 *
 * Displays summary cards for total events, critical events, and active policies
 */

import React from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Calendar, AlertCircle, BarChart3 } from "lucide-react";
import type { EconomicEvent } from "~/lib/historical-economic-data-transformers";
import type { TimeRange } from "~/hooks/useHistoricalEconomicData";

interface EventStatsCardsProps {
  allEvents: EconomicEvent[];
  selectedTimeRange: TimeRange;
}

export const EventStatsCards = React.memo(function EventStatsCards({
  allEvents,
  selectedTimeRange,
}: EventStatsCardsProps) {
  const criticalEvents = allEvents.filter((e) => e.severity === "critical").length;
  const activePolicies = allEvents.filter((e) => e.isActive && e.type === "policy_change").length;

  const timeRangeLabel =
    selectedTimeRange === "ALL" ? "All time" : `Last ${selectedTimeRange.replace("Y", " year(s)")}`;

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="text-primary h-4 w-4" />
              <span className="text-sm font-medium">Total Events</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold">{allEvents.length}</div>
            <div className="text-muted-foreground text-xs">{timeRangeLabel}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="text-primary h-4 w-4" />
              <span className="text-sm font-medium">Critical Events</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-red-600">{criticalEvents}</div>
            <div className="text-muted-foreground text-xs">Requiring attention</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="text-primary h-4 w-4" />
              <span className="text-sm font-medium">Active Policies</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-blue-600">{activePolicies}</div>
            <div className="text-muted-foreground text-xs">Currently in effect</div>
          </div>
        </CardContent>
      </Card>
    </>
  );
});
