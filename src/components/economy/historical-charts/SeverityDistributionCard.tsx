// src/components/economy/historical-charts/SeverityDistributionCard.tsx
/**
 * Severity Distribution Card Component
 *
 * Displays breakdown of events by severity level
 */

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import type { EconomicEvent } from "~/lib/historical-economic-data-transformers";

interface SeverityDistributionCardProps {
  allEvents: EconomicEvent[];
}

const severityConfig = {
  minor: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Minor' },
  moderate: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Moderate' },
  major: { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Major' },
  critical: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Critical' },
};

export const SeverityDistributionCard = React.memo(function SeverityDistributionCard({
  allEvents,
}: SeverityDistributionCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Severity Distribution</CardTitle>
        <CardDescription>Impact assessment breakdown</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Object.entries(severityConfig).map(([severity, config]) => {
            const count = allEvents.filter(e => e.severity === severity).length;
            const percentage = allEvents.length > 0 ? (count / allEvents.length) * 100 : 0;

            return (
              <div key={severity} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={`${config.color} text-xs`}>
                    {config.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8">{count}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});
