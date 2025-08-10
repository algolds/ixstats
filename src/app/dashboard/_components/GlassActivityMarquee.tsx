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
  ChevronDown
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

export function GlassActivityMarquee({ countries, userCountry, isLoading }: GlassActivityMarqueeProps) {
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
          isGlobal: true
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
          isGlobal: true
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
          isGlobal: true
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
          isGlobal: false
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
          isGlobal: false
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
        isGlobal: true
      });

      return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    };

    return generateActivities();
  }, [countries, userCountry, lastUpdate]);

  // Filter activities based on feed mode
  const filteredActivities = useMemo(() => {
    switch (feedMode) {
      case "domestic":
        return activities.filter(activity => !activity.isGlobal);
      case "global":
        return activities.filter(activity => activity.isGlobal);
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
      case "economic": return Zap;
      case "demographic": return Users;
      case "milestone": return Trophy;
      case "alert": return AlertTriangle;
      default: return Activity;
    }
  };

  // Get activity type color
  const getActivityTypeColor = (type: ActivityItem["type"]) => {
    switch (type) {
      case "economic": return "text-green-400";
      case "demographic": return "text-blue-400";
      case "milestone": return "text-yellow-400";
      case "alert": return "text-red-400";
      default: return "text-gray-400";
    }
  };

  const getFeedModeIcon = (mode: FeedMode) => {
    switch (mode) {
      case "global": return Globe;
      case "domestic": return Crown;
      case "custom": return Settings;
    }
  };

  const getFeedModeLabel = (mode: FeedMode) => {
    switch (mode) {
      case "global": return "Global Intel";
      case "domestic": return "Domestic";
      case "custom": return "Custom";
    }
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-hierarchy-parent glass-refraction rounded-xl border border-neutral-200 dark:border-white/[0.2] p-4 mb-6"
      >
        <div className="flex items-center justify-center h-16">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-muted animate-pulse" />
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
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
        className="glass-hierarchy-parent glass-refraction rounded-xl border border-neutral-200 dark:border-white/[0.2] p-3 mb-6 relative overflow-hidden cursor-pointer"
        onClick={() => setIsCollapsed(false)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-foreground">Live Activity Stream</span>
            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-400/30">
              {filteredActivities.length}
            </Badge>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-hierarchy-parent glass-refraction rounded-xl border border-neutral-200 dark:border-white/[0.2] p-4 mb-6 relative overflow-hidden"
    >
      {/* Glass shimmer background */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/10 to-transparent transform skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-3000 ease-in-out" />
      
      {/* Header with toggle buttons */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Activity className="h-5 w-5 text-blue-400" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Live Activity Stream</h3>
          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-400/30">
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
                  "h-8 px-3 text-xs glass-hierarchy-interactive transition-all duration-200",
                  isActive && "bg-primary/20 text-primary",
                  isDisabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <Icon className="h-3 w-3 mr-1" />
                {getFeedModeLabel(mode)}
              </Button>
            );
          })}
          
          {/* Collapse button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(true)}
            className="h-8 px-2 text-xs glass-hierarchy-interactive transition-all duration-200 hover:bg-muted/20"
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
          className="py-2 bg-transparent"
          gap="1.5rem"
          autoFill={true}
          fade={true}
        >
          {filteredActivities.map((activity) => {
            const IconComponent = activity.icon;
            return (
              <motion.div
                key={activity.id}
                className="flex items-center gap-3 px-4 py-2 mx-2 glass-hierarchy-child rounded-lg hover:scale-[1.02] transition-transform cursor-pointer group min-w-0 whitespace-nowrap"
                whileHover={{ y: -1 }}
              >
                {/* Icon with colored background */}
                <div className={cn(
                  "p-2 rounded-full transition-all duration-200",
                  activity.bgColor,
                  "group-hover:scale-105"
                )}>
                  <IconComponent className={cn("h-4 w-4", activity.color)} />
                </div>

                {/* Content */}
                <div className="flex items-center gap-2 min-w-0">
                  {/* Activity type icon tag */}
                  <div className={cn(
                    "p-1 rounded border transition-all duration-200",
                    getActivityTypeColor(activity.type).replace("text-", "border-"),
                    "bg-background/30"
                  )}>
                    {React.createElement(getActivityTypeIcon(activity.type), {
                      className: cn("h-3 w-3", getActivityTypeColor(activity.type))
                    })}
                  </div>
                  
                  {/* Country flag and name (if not system activity) */}
                  {activity.country !== "System" && (
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-3 rounded-sm overflow-hidden border border-white/20">
                        <SimpleFlag 
                          countryName={activity.country} 
                          className="w-full h-full object-cover"
                          showPlaceholder={true}
                        />
                      </div>
                      <span className="text-xs font-medium text-foreground/80 whitespace-nowrap">
                        {activity.country}
                      </span>
                    </div>
                  )}
                  
                  <span className="text-sm font-medium text-foreground whitespace-nowrap">
                    {activity.title}
                  </span>
                  
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {activity.description.replace(new RegExp(`^${activity.country}\\s*`, 'i'), '').trim()}
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
      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
        <span>
          Showing {filteredActivities.length} activities • {getFeedModeLabel(feedMode)} feed
        </span>
        <div className="flex items-center gap-2">
          <span>
            Updates every 2min
          </span>
          <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}