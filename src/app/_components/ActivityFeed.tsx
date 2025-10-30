"use client";

import React, { useState, useEffect } from "react";
import { formatCurrency, formatPopulation, formatGrowthRateFromDecimal } from "~/lib/chart-utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Activity, TrendingUp, Star, Users, DollarSign, Clock, ArrowUp } from "lucide-react";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";

interface Country {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
  populationTier: string;
  landArea: number | null;
  populationDensity: number | null;
  gdpDensity: number | null;
  adjustedGdpGrowth: number;
  populationGrowthRate: number;
}

interface ActivityFeedProps {
  countries: Country[];
  isLoading: boolean;
}

interface ActivityItem {
  id: string;
  type: "milestone" | "tier_change" | "growth" | "new_country";
  title: string;
  description: string;
  country?: string;
  countryId?: string;
  countrySlug?: string;
  value?: number;
  previousValue?: number;
  timestamp: Date;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  priority: number;
}

export function ActivityFeed({ countries, isLoading }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (countries.length === 0) return;

    const generateActivities = (): ActivityItem[] => {
      const newActivities: ActivityItem[] = [];
      const now = new Date();

      try {
        // Find top performers for milestones (using spread to avoid mutating original array)
        const topGdp = [...countries].sort((a, b) => b.currentTotalGdp - a.currentTotalGdp)[0];
        const topPerCapita = [...countries].sort(
          (a, b) => b.currentGdpPerCapita - a.currentGdpPerCapita
        )[0];
        const topGrowth = [...countries].sort(
          (a, b) => b.adjustedGdpGrowth - a.adjustedGdpGrowth
        )[0];
        const topPopulation = [...countries].sort(
          (a, b) => b.currentPopulation - a.currentPopulation
        )[0];

        // Milestones
        if (topGdp && topGdp.currentTotalGdp > 1000000000000) {
          // 1 trillion
          newActivities.push({
            id: "milestone-gdp",
            type: "milestone",
            title: "Economic Powerhouse",
            description: `${topGdp.name} reaches ${formatCurrency(topGdp.currentTotalGdp)} GDP`,
            country: topGdp.name,
            countryId: topGdp.id,
            value: topGdp.currentTotalGdp,
            timestamp: new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000), // Random time in last 24h
            icon: DollarSign,
            color: "text-green-600",
            priority: 1,
          });
        }

        if (topPerCapita && topPerCapita.currentGdpPerCapita > 50000) {
          newActivities.push({
            id: "milestone-percapita",
            type: "milestone",
            title: "High Standard of Living",
            description: `${topPerCapita.name} achieves ${formatCurrency(topPerCapita.currentGdpPerCapita)} per capita`,
            country: topPerCapita.name,
            countryId: topPerCapita.id,
            value: topPerCapita.currentGdpPerCapita,
            timestamp: new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000),
            icon: Star,
            color: "text-yellow-600",
            priority: 2,
          });
        }

        if (topGrowth && topGrowth.adjustedGdpGrowth > 0.05) {
          // 5% growth
          newActivities.push({
            id: "milestone-growth",
            type: "growth",
            title: "Rapid Growth",
            description: `${topGrowth.name} growing at ${formatGrowthRateFromDecimal(topGrowth.adjustedGdpGrowth)}`,
            country: topGrowth.name,
            countryId: topGrowth.id,
            value: topGrowth.adjustedGdpGrowth,
            timestamp: new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000),
            icon: TrendingUp,
            color: "text-blue-600",
            priority: 3,
          });
        }

        if (topPopulation && topPopulation.currentPopulation > 100000000) {
          // 100 million
          newActivities.push({
            id: "milestone-population",
            type: "milestone",
            title: "Population Giant",
            description: `${topPopulation.name} reaches ${formatPopulation(topPopulation.currentPopulation)}`,
            country: topPopulation.name,
            countryId: topPopulation.id,
            value: topPopulation.currentPopulation,
            timestamp: new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000),
            icon: Users,
            color: "text-purple-600",
            priority: 4,
          });
        }

        // Tier changes (simulated)
        const tierChangeCandidates = countries
          .filter((c) => c.economicTier === "Developing" || c.economicTier === "Developed")
          .slice(0, 2);

        tierChangeCandidates.forEach((country, index) => {
          const newTier = country.economicTier === "Developing" ? "Developed" : "Healthy";
          newActivities.push({
            id: `tier-change-${country.id}`,
            type: "tier_change",
            title: "Tier Advancement",
            description: `${country.name} advances to ${newTier} tier`,
            country: country.name,
            countryId: country.id,
            previousValue: country.currentGdpPerCapita,
            timestamp: new Date(now.getTime() - (index + 1) * 2 * 60 * 60 * 1000), // 2 hours apart
            icon: ArrowUp,
            color: "text-emerald-600",
            priority: 5,
          });
        });

        // Sort by timestamp (most recent first)
        return newActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      } catch (error) {
        console.error("Error generating activities:", error);
        return [];
      }
    };

    setActivities(generateActivities());
  }, [countries]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getActivityIcon = (activity: ActivityItem) => {
    try {
      const Icon = activity.icon;
      if (!Icon || typeof Icon !== "function") {
        return <Activity className="text-muted-foreground h-4 w-4" />;
      }
      return <Icon className={`h-4 w-4 ${activity.color}`} />;
    } catch (error) {
      console.error("Error rendering activity icon:", error);
      return <Activity className="text-muted-foreground h-4 w-4" />;
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    try {
      const now = new Date();
      const diffMs = now.getTime() - timestamp.getTime();

      // Handle invalid dates
      if (isNaN(diffMs) || diffMs < 0) {
        return "Recently";
      }

      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      if (diffMinutes < 1) return "Just now";
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return timestamp.toLocaleDateString();
    } catch (error) {
      console.error("Error formatting timestamp:", error);
      return "Recently";
    }
  };

  const getActivityBadge = (type: ActivityItem["type"]) => {
    const badges = {
      milestone: {
        label: "Milestone",
        color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      },
      tier_change: {
        label: "Tier Change",
        color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      },
      growth: {
        label: "Growth",
        color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      },
      new_country: {
        label: "New",
        color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      },
    };
    return (
      badges[type] || {
        label: "Activity",
        color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
      }
    );
  };

  return (
    <Card
      className="group/card transition-all duration-300 hover:scale-[1.01] hover:shadow-xl"
      style={{
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: `
          0 4px 16px rgba(0, 0, 0, 0.1),
          0 1px 4px rgba(0, 0, 0, 0.05),
          0 0 0 1px rgba(34, 197, 94, 0.1)
        `,
      }}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-green-500 transition-colors group-hover/card:text-green-400" />
          Recent Activity
          <Badge variant="secondary" className="ml-auto">
            Live
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              <Clock className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">No recent activity</p>
              <p className="text-xs">Activity will appear here as countries reach milestones</p>
            </div>
          ) : (
            activities.slice(0, 8).map((activity) => (
              <div
                key={activity.id}
                className="group flex items-start gap-3 rounded-lg p-3 transition-all duration-300 hover:scale-[1.02] hover:shadow-md"
              >
                <div className="bg-muted group-hover:bg-muted/80 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300 group-hover:scale-110">
                  {getActivityIcon(activity)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h4 className="text-foreground text-sm font-medium">{activity.title}</h4>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${getActivityBadge(activity.type).color}`}
                    >
                      {getActivityBadge(activity.type).label}
                    </Badge>
                  </div>

                  <p className="text-muted-foreground mb-1 text-sm">{activity.description}</p>

                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">
                      {formatTimestamp(activity.timestamp)}
                    </span>
                    {activity.country && activity.countryId && (
                      <Link
                        href={createUrl(`/countries/${activity.countrySlug || activity.countryId}`)}
                        className="text-primary text-xs hover:underline"
                      >
                        View {activity.country}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {activities.length > 8 && (
          <div className="mt-4 border-t pt-4">
            <button className="text-muted-foreground hover:text-foreground text-sm transition-all duration-300 hover:scale-105 hover:underline">
              View all activity →
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
