"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Marquee } from "~/components/ui/marquee";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Activity,
  TrendingUp,
  Users,
  Globe,
  Crown,
  Settings,
  DollarSign,
  ArrowUp,
  Star,
  Building2,
  Zap,
  Trophy,
  AlertTriangle,
  BarChart3,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { SimpleFlag } from "~/components/SimpleFlag";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { cn } from "~/lib/utils";

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

interface ActivityItem {
  id: string;
  type: "economic" | "demographic" | "milestone" | "alert";
  title: string;
  description: string;
  country: string;
  value: string;
  timestamp: Date;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  isGlobal: boolean;
}

interface GlassActivityMarqueeProps {
  countries: ProcessedCountryData[];
  userCountry?: ProcessedCountryData;
  isLoading: boolean;
}

type FeedMode = "global" | "domestic" | "custom";

export function GlassActivityMarquee({
  countries,
  userCountry,
  isLoading,
}: GlassActivityMarqueeProps) {
  const [feedMode, setFeedMode] = useState<FeedMode>("global");
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-refresh every 2 minutes (reduced frequency for better performance)
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 120000); // 2 minutes instead of 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Generate activity items with real-time updates
  const activities = useMemo(() => {
    if (!countries.length) return [];

    const generateActivities = (): ActivityItem[] => {
      const now = lastUpdate; // Use lastUpdate to trigger refresh
      const items: ActivityItem[] = [];

      // Global activities
      const topGrowthCountries = [...countries]
        .sort((a, b) => b.adjustedGdpGrowth - a.adjustedGdpGrowth)
        .slice(0, 5);

      const largestEconomies = [...countries]
        .sort((a, b) => b.currentTotalGdp - a.currentTotalGdp)
        .slice(0, 3);

      const mostPopulous = [...countries]
        .sort((a, b) => b.currentPopulation - a.currentPopulation)
        .slice(0, 3);

      // Economic growth activities
      topGrowthCountries.forEach((country, index) => {
        items.push({
          id: `growth-${country.id}`,
          type: "economic",
          title: "Economic Surge",
          description: `${country.name} +${((country.adjustedGdpGrowth || 0) * 100).toFixed(1)}%`,
          country: country.name,
          value: formatCurrency(country.currentGdpPerCapita),
          timestamp: new Date(now.getTime() - (index + 1) * 1800000), // 30 min intervals
          icon: Zap,
          color: "text-green-400",
          bgColor: "bg-green-500/20",
          isGlobal: true,
        });
      });

      // Major economy updates
      largestEconomies.forEach((country, index) => {
        items.push({
          id: `economy-${country.id}`,
          type: "milestone",
          title: "Economic Powerhouse",
          description: `${country.name} GDP Update`,
          country: country.name,
          value: formatCurrency(country.currentTotalGdp),
          timestamp: new Date(now.getTime() - (index + 6) * 1800000),
          icon: Trophy,
          color: "text-yellow-400",
          bgColor: "bg-yellow-500/20",
          isGlobal: true,
        });
      });

      // Population milestones
      mostPopulous.forEach((country, index) => {
        items.push({
          id: `pop-${country.id}`,
          type: "demographic",
          title: "Population Giant",
          description: `${country.name} Demographics`,
          country: country.name,
          value: formatPopulation(country.currentPopulation),
          timestamp: new Date(now.getTime() - (index + 10) * 1800000),
          icon: Users,
          color: "text-blue-400",
          bgColor: "bg-blue-500/20",
          isGlobal: true,
        });
      });

      // Domestic activities (if user has a country)
      if (userCountry) {
        items.push({
          id: `domestic-growth-${userCountry.id}`,
          type: "economic",
          title: "Your Nation",
          description: `${userCountry.name} Growth +${((userCountry.adjustedGdpGrowth || 0) * 100).toFixed(1)}%`,
          country: userCountry.name,
          value: formatCurrency(userCountry.currentGdpPerCapita),
          timestamp: new Date(now.getTime() - 600000), // 10 min ago
          icon: Crown,
          color: "text-purple-400",
          bgColor: "bg-purple-500/20",
          isGlobal: false,
        });

        items.push({
          id: `domestic-tier-${userCountry.id}`,
          type: "milestone",
          title: "Tier Status",
          description: `${userCountry.name} ${userCountry.economicTier}`,
          country: userCountry.name,
          value: userCountry.economicTier,
          timestamp: new Date(now.getTime() - 1200000), // 20 min ago
          icon: BarChart3,
          color: "text-orange-400",
          bgColor: "bg-orange-500/20",
          isGlobal: false,
        });
      }

      // Global system alerts
      items.push({
        id: "global-system",
        type: "alert",
        title: "System Status",
        description: "Global Intelligence Active",
        country: "System",
        value: `${countries.length} nations`,
        timestamp: new Date(now.getTime() - 300000), // 5 min ago
        icon: AlertTriangle,
        color: "text-indigo-400",
        bgColor: "bg-indigo-500/20",
        isGlobal: true,
      });

      return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    };

    return generateActivities();
  }, [countries, userCountry, lastUpdate]);

  // Filter activities based on feed mode
  const filteredActivities = useMemo(() => {
    switch (feedMode) {
      case "domestic":
        return activities.filter((activity) => !activity.isGlobal);
      case "global":
        return activities.filter((activity) => activity.isGlobal);
      case "custom":
        // For now, show all - could be customizable in the future
        return activities;
      default:
        return activities;
    }
  }, [activities, feedMode]);

  // Get activity type icon (for tags)
  const getActivityTypeIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "economic":
        return Zap;
      case "demographic":
        return Users;
      case "milestone":
        return Trophy;
      case "alert":
        return AlertTriangle;
      default:
        return Activity;
    }
  };

  // Get activity type color
  const getActivityTypeColor = (type: ActivityItem["type"]) => {
    switch (type) {
      case "economic":
        return "text-green-400";
      case "demographic":
        return "text-blue-400";
      case "milestone":
        return "text-yellow-400";
      case "alert":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getFeedModeIcon = (mode: FeedMode) => {
    switch (mode) {
      case "global":
        return Globe;
      case "domestic":
        return Crown;
      case "custom":
        return Settings;
    }
  };

  const getFeedModeLabel = (mode: FeedMode) => {
    switch (mode) {
      case "global":
        return "Global Intel";
      case "domestic":
        return "Domestic";
      case "custom":
        return "Custom";
    }
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-hierarchy-parent glass-refraction mb-6 rounded-xl border border-neutral-200 p-4 dark:border-white/[0.2]"
      >
        <div className="flex h-16 items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="bg-muted h-6 w-6 animate-pulse rounded-full" />
            <div className="bg-muted h-4 w-32 animate-pulse rounded" />
          </div>
        </div>
      </motion.div>
    );
  }

  // Collapsed state
  if (isCollapsed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-hierarchy-parent glass-refraction relative mb-4 cursor-pointer overflow-hidden rounded-lg border border-neutral-200 p-2 dark:border-white/[0.2]"
        onClick={() => setIsCollapsed(false)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-400" />
            <span className="text-foreground text-sm font-medium">Live Activity Stream</span>
            <Badge
              variant="outline"
              className="border-green-400/30 bg-green-500/10 text-xs text-green-400"
            >
              {filteredActivities.length}
            </Badge>
          </div>
          <ChevronDown className="text-muted-foreground h-4 w-4" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-hierarchy-parent glass-refraction relative mb-4 overflow-hidden rounded-lg border border-neutral-200 p-3 dark:border-white/[0.2]"
    >
      {/* Glass shimmer background */}
      <div className="absolute inset-0 -translate-x-full skew-x-12 transform bg-gradient-to-r from-transparent via-blue-400/10 to-transparent transition-transform duration-3000 ease-in-out group-hover:translate-x-full" />

      {/* Header with toggle buttons */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Activity className="h-5 w-5 text-blue-400" />
            <div className="absolute -top-1 -right-1 h-2 w-2 animate-pulse rounded-full bg-green-400" />
          </div>
          <h3 className="text-foreground text-sm font-semibold">Live Activity Stream</h3>
          <Badge
            variant="outline"
            className="border-green-400/30 bg-green-500/10 text-xs text-green-400"
          >
            LIVE
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          {/* Feed mode toggles */}
          {(["global", "domestic", "custom"] as FeedMode[]).map((mode) => {
            const Icon = getFeedModeIcon(mode);
            const isActive = feedMode === mode;
            const isDisabled = mode === "domestic" && !userCountry;

            return (
              <Button
                key={mode}
                variant="ghost"
                size="sm"
                onClick={() => !isDisabled && setFeedMode(mode)}
                disabled={isDisabled}
                className={cn(
                  "glass-hierarchy-interactive h-8 px-3 text-xs transition-all duration-200",
                  isActive && "bg-primary/20 text-primary",
                  isDisabled && "cursor-not-allowed opacity-50"
                )}
              >
                <Icon className="mr-1 h-3 w-3" />
                {getFeedModeLabel(mode)}
              </Button>
            );
          })}

          {/* Collapse button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(true)}
            className="glass-hierarchy-interactive hover:bg-muted/20 h-8 px-2 text-xs transition-all duration-200"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Marquee container */}
      <div className="relative overflow-hidden rounded-lg">
        <Marquee
          speed={30}
          pauseOnHover={true}
          className="bg-transparent py-2"
          gap="1.5rem"
          autoFill={true}
          fade={true}
        >
          {filteredActivities.map((activity) => {
            const IconComponent = activity.icon;
            return (
              <motion.div
                key={activity.id}
                className="glass-hierarchy-child group mx-1 flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 whitespace-nowrap transition-transform hover:scale-[1.02]"
                whileHover={{ y: -1 }}
              >
                {/* Icon with colored background */}
                <div
                  className={cn(
                    "rounded-full p-2 transition-all duration-200",
                    activity.bgColor,
                    "group-hover:scale-105"
                  )}
                >
                  <IconComponent className={cn("h-4 w-4", activity.color)} />
                </div>

                {/* Content */}
                <div className="flex min-w-0 items-center gap-2">
                  {/* Activity type icon tag */}
                  <div
                    className={cn(
                      "rounded border p-1 transition-all duration-200",
                      getActivityTypeColor(activity.type).replace("text-", "border-"),
                      "bg-background/30"
                    )}
                  >
                    {React.createElement(getActivityTypeIcon(activity.type), {
                      className: cn("h-3 w-3", getActivityTypeColor(activity.type)),
                    })}
                  </div>

                  {/* Country flag and name (if not system activity) */}
                  {activity.country !== "System" && (
                    <div className="flex items-center gap-1">
                      <div className="h-3 w-4 overflow-hidden rounded-sm border border-white/20">
                        <SimpleFlag
                          countryName={activity.country}
                          className="h-full w-full object-cover"
                          showPlaceholder={true}
                        />
                      </div>
                      <span className="text-foreground/80 text-xs font-medium whitespace-nowrap">
                        {activity.country}
                      </span>
                    </div>
                  )}

                  <span className="text-foreground text-sm font-medium whitespace-nowrap">
                    {activity.title}
                  </span>

                  <span className="text-muted-foreground text-sm whitespace-nowrap">
                    {activity.description
                      .replace(new RegExp(`^${activity.country}\\s*`, "i"), "")
                      .trim()}
                  </span>

                  <span className={cn("text-sm font-semibold whitespace-nowrap", activity.color)}>
                    {activity.value}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </Marquee>
      </div>

      {/* Footer info */}
      <div className="text-muted-foreground mt-3 flex items-center justify-between text-xs">
        <span>
          Showing {filteredActivities.length} activities • {getFeedModeLabel(feedMode)} feed
        </span>
        <div className="flex items-center gap-2">
          <span>Updates every 2min</span>
          <div className="h-1 w-1 animate-pulse rounded-full bg-green-400" />
        </div>
      </div>
    </motion.div>
  );
}
