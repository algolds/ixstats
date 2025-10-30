/**
 * Volatility Metrics Card Component
 *
 * Displays volatility analysis metrics.
 *
 * @module VolatilityMetricsCard
 */

import React from "react";
import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import type { VolatilityMetric } from "~/lib/analytics-data-transformers";

interface VolatilityMetricsCardProps {
  metrics: VolatilityMetric[];
}

export const VolatilityMetricsCard = React.memo<VolatilityMetricsCardProps>(({ metrics }) => {
  return (
    <Card className="glass-surface glass-refraction">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-orange-600" />
          Economic Volatility Analysis
        </CardTitle>
        <CardDescription>Standard deviation and variance metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 p-4 dark:from-gray-800/50 dark:to-gray-900/50"
            >
              <p className="text-muted-foreground mb-2 text-sm">{metric.label}</p>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold">{(metric.value * 100).toFixed(2)}%</p>
                <Badge variant={metric.status === "low" ? "default" : "secondary"}>
                  {metric.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

VolatilityMetricsCard.displayName = "VolatilityMetricsCard";
