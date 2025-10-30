// src/components/economy/historical-charts/EventDistributionCard.tsx
/**
 * Event Distribution Card Component
 *
 * Displays breakdown of events by type with visual progress bars
 */

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Zap, FileText, TrendingUp, AlertCircle } from "lucide-react";
import type { EconomicEvent } from "~/lib/historical-economic-data-transformers";

interface EventDistributionCardProps {
  allEvents: EconomicEvent[];
}

const eventTypes = [
  { value: "dm_input", label: "DM Input", icon: Zap },
  { value: "policy_change", label: "Policy Change", icon: FileText },
  { value: "economic_shift", label: "Economic Shift", icon: TrendingUp },
  { value: "external_event", label: "External Event", icon: AlertCircle },
];

export const EventDistributionCard = React.memo(function EventDistributionCard({
  allEvents,
}: EventDistributionCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Distribution</CardTitle>
        <CardDescription>Breakdown by type and frequency</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {eventTypes.map((type) => {
            const count = allEvents.filter((e) => e.type === type.value).length;
            const percentage = allEvents.length > 0 ? (count / allEvents.length) * 100 : 0;
            const TypeIcon = type.icon;

            return (
              <div key={type.value} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TypeIcon className="h-4 w-4" />
                  <span className="text-sm">{type.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-muted h-2 w-20 overflow-hidden rounded-full">
                    <div className="bg-primary h-full" style={{ width: `${percentage}%` }} />
                  </div>
                  <span className="w-8 text-sm font-medium">{count}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});
