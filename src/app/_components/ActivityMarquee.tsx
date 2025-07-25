"use client";

import React, { useState, useEffect, useMemo, memo } from "react";
import { formatCurrency, formatPopulation, formatGrowthRateFromDecimal } from "~/lib/chart-utils";
import { Badge } from "~/components/ui/badge";
import { Marquee } from "~/components/ui/marquee";
import { 
  Activity, 
  TrendingUp, 
  Star, 
  Users, 
  DollarSign,
  ArrowUp
} from "lucide-react";
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

interface ActivityMarqueeProps {
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
  value?: number;
  previousValue?: number;
  timestamp: Date;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  priority: number;
}

export const ActivityMarquee = memo(function ActivityMarquee({ countries, isLoading }: ActivityMarqueeProps) {
  // Memoize activities generation to prevent unnecessary recalculations
  const activities = useMemo(() => {
    if (countries.length === 0) return [];

    const generateActivities = (): ActivityItem[] => {
      const newActivities: ActivityItem[] = [];
      const now = new Date();

      try {
        // Find top performers for milestones (using spread to avoid mutating original array)
        const topGdp = [...countries].sort((a, b) => b.currentTotalGdp - a.currentTotalGdp)[0];
        const topPerCapita = [...countries].sort((a, b) => b.currentGdpPerCapita - a.currentGdpPerCapita)[0];
        const topGrowth = [...countries].sort((a, b) => b.adjustedGdpGrowth - a.adjustedGdpGrowth)[0];
        const topPopulation = [...countries].sort((a, b) => b.currentPopulation - a.currentPopulation)[0];

        // Milestones
        if (topGdp && topGdp.currentTotalGdp > 1000000000000) { // 1 trillion
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

        if (topGrowth && topGrowth.adjustedGdpGrowth > 0.05) { // 5% growth
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

        if (topPopulation && topPopulation.currentPopulation > 100000000) { // 100 million
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
        const tierChangeCandidates = countries.filter(c => 
          c.economicTier === "Developing" || c.economicTier === "Developed"
        ).slice(0, 2);

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

    return generateActivities();
  }, [countries]);

  // Memoize icon rendering to prevent re-renders
  const getActivityIcon = useMemo(() => {
    const iconCache = new Map();
    return (activity: ActivityItem) => {
      const key = `${activity.id}-${activity.color}`;
      if (iconCache.has(key)) {
        return iconCache.get(key);
      }
      
      try {
        const Icon = activity.icon;
        if (!Icon || typeof Icon !== 'function') {
          const fallback = <Activity className="h-4 w-4 text-muted-foreground" />;
          iconCache.set(key, fallback);
          return fallback;
        }
        const icon = <Icon className={`h-4 w-4 ${activity.color}`} />;
        iconCache.set(key, icon);
        return icon;
      } catch (error) {
        console.error("Error rendering activity icon:", error);
        const fallback = <Activity className="h-4 w-4 text-muted-foreground" />;
        iconCache.set(key, fallback);
        return fallback;
      }
    };
  }, []);

  // Memoize badge config to prevent recreating objects
  const badgeConfig = useMemo(() => ({
    milestone: { label: "Milestone", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
    tier_change: { label: "Tier Change", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
    growth: { label: "Growth", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
    new_country: { label: "New", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
    default: { label: "Activity", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200" }
  }), []);

  const getActivityBadge = (type: ActivityItem["type"]) => {
    return badgeConfig[type] || badgeConfig.default;
  };

  if (isLoading || activities.length === 0) {
    return (
      <div className="py-3 marquee-container">
        <div className="flex items-center justify-center h-10 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <span className="text-sm text-muted-foreground">
            {isLoading ? "Loading activities..." : "No recent activity"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="py-3 relative overflow-hidden marquee-container">
      <Marquee
        speed={40}
        pauseOnHover={true}
        className="bg-transparent relative z-[9999] marquee-content will-change-transform"
        gap="1.5rem"
        autoFill={true}
      >
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="marquee-item flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/70 rounded-lg border border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-w-0 whitespace-nowrap group"
          >
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 group-hover:border-primary/20 transition-colors flex-shrink-0">
              {getActivityIcon(activity)}
            </div>
            
            <div className="flex items-center gap-1.5">
              <Badge 
                variant="outline" 
                className={`text-xs border-0 px-1.5 py-0.5 ${getActivityBadge(activity.type).color}`}
              >
                {getActivityBadge(activity.type).label}
              </Badge>
              
              <span className="font-medium text-sm text-foreground">
                {activity.title}:
              </span>
              
              <span className="text-sm text-muted-foreground">
                {activity.description}
              </span>
              
              {activity.country && activity.countryId && (
                <Link
                  href={createUrl(`/countries/${activity.countryId}`)}
                  className="text-sm text-primary hover:text-primary/80 transition-colors ml-1 font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  →
                </Link>
              )}
            </div>
          </div>
        ))}
      </Marquee>
    </div>
  );
});