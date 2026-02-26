"use client";

/**
 * Diplomatic Analytics Component
 *
 * Thin orchestrator composing the useDiplomaticAnalytics hook with
 * extracted sub-components. Provides comprehensive diplomatic intelligence
 * across five tabs: trends, growth, network, distribution, and timeline.
 *
 * @module DiplomaticAnalytics
 */

import React, { useState } from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Globe,
  TrendingUp,
  Network,
  PieChart as PieChartIcon,
  Calendar,
  Activity,
} from "lucide-react";
import { useDiplomaticAnalytics } from "~/hooks/useDiplomaticAnalytics";
import {
  OverviewStats,
  RelationshipTrendsChart,
  NetworkGrowthChart,
  EmbassyNetworkVisualization,
  InfluenceDistributionChart,
  DiplomaticTimeline,
} from "~/components/intelligence/diplomatic-analysis";

interface DiplomaticAnalyticsProps {
  countryId: string;
  countryName: string;
}

export function DiplomaticAnalytics({ countryId }: DiplomaticAnalyticsProps) {
  const [activeTab, setActiveTab] = useState("trends");

  const {
    isLoading,
    hasRelationships,
    overviewStats,
    relationshipTrends,
    networkGrowth,
    influenceDistribution,
    diplomaticTimeline,
  } = useDiplomaticAnalytics({ countryId });

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="space-y-4 text-center">
          <Activity className="mx-auto h-12 w-12 animate-spin text-blue-600" />
          <p className="text-muted-foreground">Loading diplomatic analytics...</p>
        </div>
      </div>
    );
  }

  if (!hasRelationships) {
    return (
      <Card className="glass-hierarchy-child">
        <CardContent className="flex min-h-[300px] items-center justify-center">
          <div className="text-center space-y-4">
            <Globe className="mx-auto h-16 w-16 text-muted-foreground opacity-50" />
            <div>
              <h3 className="text-lg font-semibold">No Diplomatic Relations</h3>
              <p className="text-muted-foreground text-sm mt-2">
                Establish embassies and build relationships to unlock analytics
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {overviewStats && <OverviewStats stats={overviewStats} />}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1">
          <TabsTrigger value="trends" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Trends</span>
          </TabsTrigger>
          <TabsTrigger value="growth" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
            <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Growth</span>
          </TabsTrigger>
          <TabsTrigger value="network" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
            <Network className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Network</span>
          </TabsTrigger>
          <TabsTrigger value="distribution" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
            <PieChartIcon className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Distrib</span>
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Timeline</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trends">
          <RelationshipTrendsChart trends={relationshipTrends} />
        </TabsContent>

        <TabsContent value="growth">
          <NetworkGrowthChart data={networkGrowth} />
        </TabsContent>

        <TabsContent value="network">
          <EmbassyNetworkVisualization data={networkGrowth} />
        </TabsContent>

        <TabsContent value="distribution">
          <InfluenceDistributionChart data={influenceDistribution} />
        </TabsContent>

        <TabsContent value="timeline">
          <DiplomaticTimeline events={diplomaticTimeline} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
