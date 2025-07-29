"use client";

import React from "react";
import { motion } from "framer-motion";
import { Activity, TrendingUp, Users, Globe, Clock } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";

interface ProcessedCountryData {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
  populationTier: string;
  adjustedGdpGrowth: number;
  populationGrowthRate: number;
}

interface ActivityFeedProps {
  countries: ProcessedCountryData[];
  isLoading: boolean;
}

export function ActivityFeed({ countries, isLoading }: ActivityFeedProps) {
  // Generate recent activity from country data
  const generateRecentActivity = () => {
    if (!countries.length) return [];

    const activities = [];
    const now = new Date();

    // Sort countries by GDP growth for recent economic activity
    const topGrowthCountries = [...countries]
      .sort((a, b) => b.adjustedGdpGrowth - a.adjustedGdpGrowth)
      .slice(0, 3);

    // Sort by population for demographic activity
    const largestCountries = [...countries]
      .sort((a, b) => b.currentPopulation - a.currentPopulation)
      .slice(0, 2);

    // Economic growth activities
    topGrowthCountries.forEach((country, index) => {
      activities.push({
        id: `growth-${country.id}`,
        type: 'economic',
        title: `${country.name} Economic Surge`,
        description: `GDP growth of +${(country.adjustedGdpGrowth * 100).toFixed(1)}%`,
        timestamp: new Date(now.getTime() - (index + 1) * 3600000), // Hours ago
        icon: TrendingUp,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        country: country.name,
        value: formatCurrency(country.currentGdpPerCapita)
      });
    });

    // Population activities
    largestCountries.forEach((country, index) => {
      activities.push({
        id: `pop-${country.id}`,
        type: 'demographic',
        title: `${country.name} Population Update`,
        description: `Current population: ${formatPopulation(country.currentPopulation)}`,
        timestamp: new Date(now.getTime() - (index + 4) * 3600000),
        icon: Users,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        country: country.name,
        value: `${(country.populationGrowthRate * 100).toFixed(1)}% growth`
      });
    });

    // Global activity
    activities.push({
      id: 'global-update',
      type: 'global',
      title: 'Global Intelligence Update',
      description: `${countries.length} countries monitored`,
      timestamp: new Date(now.getTime() - 30 * 60000), // 30 minutes ago
      icon: Globe,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      country: 'Global',
      value: 'Active'
    });

    return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 5);
  };

  const activities = generateRecentActivity();

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}h ago`;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="glass-hierarchy-child p-3 rounded-lg animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-muted rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-2 bg-muted rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity, index) => {
        const IconComponent = activity.icon;
        return (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass-hierarchy-child p-3 rounded-lg hover:scale-[1.02] transition-transform cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${activity.bgColor} group-hover:scale-110 transition-transform`}>
                <IconComponent className={`h-4 w-4 ${activity.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium text-foreground truncate">
                    {activity.title}
                  </h4>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatTimeAgo(activity.timestamp)}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {activity.description}
                </p>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {activity.country}
                  </Badge>
                  <span className={`text-xs font-medium ${activity.color}`}>
                    {activity.value}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}