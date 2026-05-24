"use client";

/**
 * Overview Stats Grid
 *
 * 4-card summary showing active relationships, average strength,
 * active embassies, and recent activity count.
 *
 * @module OverviewStats
 */

import React from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Globe, TrendingUp, Network, Calendar } from "lucide-react";
import type { OverviewStatsData } from "~/hooks/useDiplomaticAnalytics";

interface OverviewStatsProps {
  stats: OverviewStatsData;
}

export const OverviewStats = React.memo<OverviewStatsProps>(({ stats }) => {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
      <Card className="glass-hierarchy-child">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Active Relationships</p>
              <p className="text-3xl font-bold">{stats.relationshipsCount}</p>
            </div>
            <Globe className="h-8 w-8 text-blue-600" />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-hierarchy-child">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Avg. Strength</p>
              <p className="text-3xl font-bold">{stats.avgStrength}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-hierarchy-child">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Active Embassies</p>
              <p className="text-3xl font-bold">{stats.embassiesCount}</p>
            </div>
            <Network className="h-8 w-8 text-purple-600" />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-hierarchy-child">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Recent Activity</p>
              <p className="text-3xl font-bold">{stats.recentActivityCount}</p>
            </div>
            <Calendar className="h-8 w-8 text-orange-600" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

OverviewStats.displayName = "OverviewStats";
