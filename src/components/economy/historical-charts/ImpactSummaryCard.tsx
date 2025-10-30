// src/components/economy/historical-charts/ImpactSummaryCard.tsx
/**
 * Impact Summary Card Component
 *
 * Displays aggregate economic impact metrics
 */

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import type { EconomicEvent } from "~/lib/historical-economic-data-transformers";

interface ImpactSummaryCardProps {
  allEvents: EconomicEvent[];
}

export const ImpactSummaryCard = React.memo(function ImpactSummaryCard({
  allEvents,
}: ImpactSummaryCardProps) {
  const positiveGdpEvents = allEvents.filter(e => e.impact.gdp && e.impact.gdp > 0).length;
  const negativeGdpEvents = allEvents.filter(e => e.impact.gdp && e.impact.gdp < 0).length;
  const activeEvents = allEvents.filter(e => e.isActive).length;

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Economic Impact Summary</CardTitle>
        <CardDescription>Aggregate effects of tracked events</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {positiveGdpEvents}
            </div>
            <div className="text-sm text-muted-foreground">Positive GDP Events</div>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {negativeGdpEvents}
            </div>
            <div className="text-sm text-muted-foreground">Negative GDP Events</div>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {activeEvents}
            </div>
            <div className="text-sm text-muted-foreground">Active Events</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
