"use client";

import React, { useState, useEffect } from "react";
import { IxTime } from "~/lib/ixtime";
import { useIxTime } from "~/contexts/IxTimeContext";
import { formatCurrency, formatPopulation, formatGrowthRateFromDecimal } from "~/lib/chart-utils";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  RefreshCw,
  Clock,
  Globe,
  TrendingUp,
  Users,
  DollarSign,
  Building2,
  MapPin,
  Activity,
  Target,
} from "lucide-react";
import type { GlobalEconomicSnapshot } from "~/types/ixstats";
import { GlassCard } from "~/components/ui/enhanced-card";
import { GlassButton } from "~/components/ui/enhanced-button";

interface LiveGameBannerProps {
  onRefresh: () => void;
  isLoading: boolean;
  globalStats?: GlobalEconomicSnapshot;
}

export function LiveGameBanner({ onRefresh, isLoading, globalStats }: LiveGameBannerProps) {
  // Use centralized time context
  const { ixTimeTimestamp, multiplier, ixTimeFormatted, refreshTime } = useIxTime();

  const [currentTime, setCurrentTime] = useState<{
    greeting: string;
    dateDisplay: string;
    timeDisplay: string;
    multiplier: number;
  }>({
    greeting: "Good morning",
    dateDisplay: "",
    timeDisplay: "",
    multiplier: 2.0,
  });

  const [botStatus, setBotStatus] = useState<{
    available: boolean;
    message: string;
  }>({
    available: true,
    message: "Connected",
  });

  // Helper function to get greeting based on time of day
  const getGreeting = (ixTime: number): string => {
    const date = new Date(ixTime);
    const hour = date.getUTCHours();

    if (hour >= 5 && hour < 12) {
      return "Good morning";
    } else if (hour >= 12 && hour < 17) {
      return "Good afternoon";
    } else if (hour >= 17 && hour < 21) {
      return "Good evening";
    } else {
      return "Good night";
    }
  };

  // Helper function to format date display
  const getDateDisplay = (ixTime: number): string => {
    const date = new Date(ixTime);
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    const day = date.getUTCDate();
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    const weekday = weekdays[date.getUTCDay()];

    return `${weekday}, ${month} ${day}, ${year}`;
  };

  // Helper function to format time display
  const getTimeDisplay = (ixTime: number): string => {
    const date = new Date(ixTime);
    const hours = date.getUTCHours().toString().padStart(2, "0");
    const minutes = date.getUTCMinutes().toString().padStart(2, "0");
    const seconds = date.getUTCSeconds().toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds} ILT`;
  };

  // Comprehensive refresh function that syncs all data
  const handleRefresh = async () => {
    try {
      // Refresh time context first
      await refreshTime();

      // Check bot health
      const healthStatus = await IxTime.checkBotHealth();
      setBotStatus(healthStatus);

      // Call the parent refresh function to update global stats
      onRefresh();
    } catch (error) {
      console.error("Refresh failed:", error);
      setBotStatus({
        available: false,
        message: "Sync failed",
      });
    }
  };

  useEffect(() => {
    // Update time display when context changes
    const greeting = getGreeting(ixTimeTimestamp);
    const dateDisplay = getDateDisplay(ixTimeTimestamp);
    const timeDisplay = getTimeDisplay(ixTimeTimestamp);

    setCurrentTime({
      greeting,
      dateDisplay,
      timeDisplay,
      multiplier,
    });
  }, [ixTimeTimestamp, multiplier]);

  useEffect(() => {
    // Check bot status
    const checkBotStatus = async () => {
      try {
        const status = await IxTime.checkBotHealth();
        setBotStatus(status);
      } catch (error) {
        setBotStatus({
          available: false,
          message: "Connection failed",
        });
      }
    };

    checkBotStatus();
    const botInterval = setInterval(checkBotStatus, 30000); // Check every 30 seconds

    return () => {
      clearInterval(botInterval);
    };
  }, []);

  // Global stats configuration
  const stats = globalStats
    ? [
        {
          icon: Users,
          label: "Total Population",
          value: formatPopulation(globalStats.totalPopulation),
          subValue: `${globalStats.countryCount} countries`,
          color: "text-blue-200",
          bgColor: "bg-blue-500/20",
        },
        {
          icon: DollarSign,
          label: "Total GDP",
          value: formatCurrency(globalStats.totalGdp),
          subValue: `Avg: ${formatCurrency(globalStats.averageGdpPerCapita)}/capita`,
          color: "text-green-200",
          bgColor: "bg-green-500/20",
        },
        {
          icon: TrendingUp,
          label: "Global Growth",
          value: formatGrowthRateFromDecimal(globalStats.globalGrowthRate),
          subValue: "Annual rate",
          color: "text-purple-200",
          bgColor: "bg-purple-500/20",
        },
        {
          icon: Building2,
          label: "Economic Activity",
          value: `${globalStats.countryCount}`,
          subValue: "Active economies",
          color: "text-orange-200",
          bgColor: "bg-orange-500/20",
        },
      ]
    : [];

  return (
    <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white">
      <div className="container mx-auto px-4 py-4 sm:px-6 lg:px-8">
        {/* GlassCard overlay for main info/time block */}
        <div className="relative z-10 mx-auto mb-6 max-w-2xl">
          <GlassCard
            variant="glass"
            className="animate-fade-in flex flex-col items-center justify-between gap-4 p-6 shadow-xl lg:flex-row"
          >
            {/* Game Time Section */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6" />
                <div>
                  <div className="text-2xl font-bold">{currentTime.greeting}</div>
                  <div className="text-sm opacity-90">The date is {currentTime.dateDisplay}</div>
                  <div className="text-sm opacity-90">{currentTime.timeDisplay}</div>
                </div>
              </div>
            </div>
            {/* Refresh Button with glass effect */}
            <div className="flex items-center gap-4">
              <GlassButton
                onClick={handleRefresh}
                disabled={isLoading}
                glass
                size="sm"
                className="border-white/30 text-white"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh All
              </GlassButton>
            </div>
          </GlassCard>
          {/* Aurora/animated background effect (optional, subtle) */}
          <div className="aurora-bg pointer-events-none absolute inset-0 z-0 rounded-2xl" />
        </div>

        {/* Mobile-friendly time display */}
        <div className="mt-3 flex items-center justify-between md:hidden">
          <div className="flex items-center gap-2">
            <Badge
              variant={botStatus.available ? "default" : "destructive"}
              className={botStatus.available ? "bg-green-500" : "bg-red-500"}
            ></Badge>
          </div>
          <div className="text-sm opacity-90">{currentTime.timeDisplay}</div>
        </div>

        {/* Mobile Global Stats */}
        {globalStats && (
          <div className="mt-3 border-t border-white/20 pt-3 lg:hidden">
            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div
                    className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${stat.bgColor}`}
                  >
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                  <div className="text-sm font-bold">{stat.value}</div>
                  <div className="text-xs font-medium opacity-90">{stat.label}</div>
                  <div className="mt-1 text-xs opacity-75">{stat.subValue}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Left Side Additional Metrics Row - Desktop */}
        {globalStats && (
          <div className="mt-4 hidden border-t border-white/20 pt-4 lg:block">
            <div className="flex items-center justify-between">
              {/* Left side - Icons with stats */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
                    <Users className="h-4 w-4 text-blue-200" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Global Population</div>
                    <div className="text-xs opacity-90">
                      {formatPopulation(globalStats.totalPopulation)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/20">
                    <DollarSign className="h-4 w-4 text-green-200" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Global GDP</div>
                    <div className="text-xs opacity-90">{formatCurrency(globalStats.totalGdp)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20">
                    <TrendingUp className="h-4 w-4 text-purple-200" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Global Growth</div>
                    <div className="text-xs opacity-90">
                      {formatGrowthRateFromDecimal(globalStats.globalGrowthRate)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/20">
                    <Building2 className="h-4 w-4 text-orange-200" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Active Economies</div>
                    <div className="text-xs opacity-90">{globalStats.countryCount} countries</div>
                  </div>
                </div>
              </div>

              {/* Right side - Additional metrics */}
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-white/70" />
                  <div></div>
                </div>
                <div className="flex items-center gap-3">
                  <Activity className="h-4 w-4 text-white/70" />
                  <div></div>
                </div>
                <div className="flex items-center gap-3">
                  <Target className="h-4 w-4 text-white/70" />
                  <div></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Additional Metrics Row - Mobile */}
        {globalStats && (
          <div className="mt-3 border-t border-white/20 pt-3 lg:hidden">
            <div className="grid grid-cols-2 gap-3">
              {/* Icons with stats */}
              <div className="flex items-center gap-3">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
                  <Users className="h-4 w-4 text-blue-200" />
                </div>
                <div>
                  <div className="text-sm font-medium">Population</div>
                  <div className="text-xs opacity-90">
                    {formatPopulation(globalStats.totalPopulation)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/20">
                  <DollarSign className="h-4 w-4 text-green-200" />
                </div>
                <div>
                  <div className="text-sm font-medium">GDP</div>
                  <div className="text-xs opacity-90">{formatCurrency(globalStats.totalGdp)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20">
                  <TrendingUp className="h-4 w-4 text-purple-200" />
                </div>
                <div>
                  <div className="text-sm font-medium">Growth</div>
                  <div className="text-xs opacity-90">
                    {formatGrowthRateFromDecimal(globalStats.globalGrowthRate)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/20">
                  <Building2 className="h-4 w-4 text-orange-200" />
                </div>
                <div>
                  <div className="text-sm font-medium">Activity</div>
                  <div className="text-xs opacity-90">{globalStats.countryCount} countries</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-white/70" />
                <div>
                  <div className="text-sm font-medium">Avg Population Density</div>
                  <div className="text-xs opacity-90">
                    {globalStats.averagePopulationDensity.toLocaleString()}/km²
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Activity className="h-4 w-4 text-white/70" />
                <div>
                  <div className="text-sm font-medium">Avg GDP Density</div>
                  <div className="text-xs opacity-90">
                    {formatCurrency(globalStats.averageGdpDensity)}/km²
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Target className="h-4 w-4 text-white/70" />
                <div>
                  <div className="text-sm font-medium">Last Updated</div>
                  <div className="text-xs opacity-90">
                    {new Date(globalStats.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
