"use client";

/**
 * Embassy Network Visualization
 *
 * Wraps the shared EmbassyNetworkChart component inside a Card with a
 * header. Falls back to an empty-state message when no data is available.
 *
 * @module EmbassyNetworkVisualization
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Network } from "lucide-react";
import { EmbassyNetworkChart, GlassTooltip } from "~/components/analytics/charts";
import type { NetworkGrowthEntry } from "~/hooks/useDiplomaticAnalytics";

interface EmbassyNetworkVisualizationProps {
  data: NetworkGrowthEntry[];
}

export const EmbassyNetworkVisualization = React.memo<EmbassyNetworkVisualizationProps>(
  ({ data }) => {
    return (
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-purple-600" />
            Embassy Network Visualization
          </CardTitle>
          <CardDescription>
            Visual representation of your diplomatic connections and their strength
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data && data.length > 0 ? (
            <EmbassyNetworkChart data={data} GlassTooltip={GlassTooltip} />
          ) : (
            <div className="flex min-h-[400px] items-center justify-center text-muted-foreground">
              <div className="text-center space-y-2">
                <Network className="mx-auto h-12 w-12 opacity-50" />
                <p>No embassy network data available yet</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
);

EmbassyNetworkVisualization.displayName = "EmbassyNetworkVisualization";
