"use client";

import React, { useState, useEffect } from "react";
import { IxTime } from "~/lib/ixtime";
import { useIxTime } from "~/context/IxTimeContext";
import { formatCurrency, formatPopulation, formatGrowthRateFromDecimal } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import {
  Refresh as RefreshCw,
  Clock,
  StatUp as TrendingUp,
  Group as Users,
  Dollar as DollarSign,
  City as Building2,
  MapPin,
  Activity,
  Archery as Target,
} from "iconoir-react";
import type { GlobalEconomicSnapshot } from "~/types/ixstats";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

interface LiveGameBannerProps {
  onRefresh: () => void;
  isLoading: boolean;
  globalStats?: GlobalEconomicSnapshot;
}

export function LiveGameBanner({ onRefresh, isLoading, globalStats }: LiveGameBannerProps) {
  // Use centralized time context
  // oxlint-disable-next-line eslint/no-unused-vars
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
    // oxlint-disable-next-line
  }, [ixTimeTimestamp, multiplier]);

  useEffect(() => {
    // Check bot status
    const checkBotStatus = async () => {
      try {
        const status = await IxTime.checkBotHealth();
        setBotStatus(status);
      } catch {
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
          color: "text-blue",
          bgColor: "bg-blue/20",
        },
        {
          icon: DollarSign,
          label: "Total GDP",
          value: formatCurrency(globalStats.totalGdp),
          subValue: `Avg: ${formatCurrency(globalStats.averageGdpPerCapita)}/capita`,
          color: "text-green",
          bgColor: "bg-green/20",
        },
        {
          icon: TrendingUp,
          label: "Global Growth",
          value: formatGrowthRateFromDecimal(globalStats.globalGrowthRate),
          subValue: "Annual rate",
          color: "text-purple",
          bgColor: "bg-purple/20",
        },
        {
          icon: Building2,
          label: "Economic Activity",
          value: `${globalStats.countryCount}`,
          subValue: "Active economies",
          color: "text-orange",
          bgColor: "bg-orange/20",
        },
      ]
    : [];

  return (
    <div className="border-separator bg-surface text-label relative border-b">
      <div className="container mx-auto px-4 py-4 sm:px-6 lg:px-8">
        {/* GlassCard overlay for main info/time block */}
        <div className="relative z-10 mx-auto mb-6 max-w-2xl">
          <Card className="flex flex-col items-center justify-between gap-4 p-6 lg:flex-row">
            {/* Game Time Section */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6" />
                <div>
                  <div className="text-title-1">{currentTime.greeting}</div>
                  <div className="text-body text-label-secondary">
                    The date is {currentTime.dateDisplay}
                  </div>
                  <div className="text-body text-label-secondary">{currentTime.timeDisplay}</div>
                </div>
              </div>
            </div>
            {/* Refresh Button with glass effect */}
            <div className="flex items-center gap-4">
              <Button onClick={handleRefresh} disabled={isLoading} size="sm" variant="gray">
                <RefreshCw aria-hidden className={isLoading ? "animate-spin" : ""} />
                Refresh All
              </Button>
            </div>
          </Card>
        </div>

        {/* Mobile-friendly time display */}
        <div className="mt-3 flex items-center justify-between md:hidden">
          <div className="flex items-center gap-2">
            <Badge
              variant={botStatus.available ? "default" : "destructive"}
              className={botStatus.available ? "bg-green" : "bg-red"}
            ></Badge>
          </div>
          <div className="text-body text-label-secondary">{currentTime.timeDisplay}</div>
        </div>

        {/* Mobile Global Stats */}
        {globalStats && (
          <div className="border-separator mt-3 border-t pt-3 lg:hidden">
            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div
                    className={`rounded-control mb-2 inline-flex h-8 w-8 items-center justify-center ${stat.bgColor}`}
                  >
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                  <div className="text-headline">{stat.value}</div>
                  <div className="text-caption text-label-secondary">{stat.label}</div>
                  <div className="text-footnote text-label-tertiary mt-1">{stat.subValue}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Left Side Additional Metrics Row - Desktop */}
        {globalStats && (
          <div className="border-separator mt-4 hidden border-t pt-4 lg:block">
            <div className="flex items-center justify-between">
              {/* Left side - Icons with stats */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-control bg-blue/20 inline-flex h-8 w-8 items-center justify-center">
                    <Users className="text-blue h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-body font-medium">Global Population</div>
                    <div className="text-footnote text-label-secondary">
                      {formatPopulation(globalStats.totalPopulation)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-control bg-green/20 inline-flex h-8 w-8 items-center justify-center">
                    <DollarSign className="text-green h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-body font-medium">Global GDP</div>
                    <div className="text-footnote text-label-secondary">
                      {formatCurrency(globalStats.totalGdp)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-control bg-purple/20 inline-flex h-8 w-8 items-center justify-center">
                    <TrendingUp className="text-purple h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-body font-medium">Global Growth</div>
                    <div className="text-footnote text-label-secondary">
                      {formatGrowthRateFromDecimal(globalStats.globalGrowthRate)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-control bg-orange/20 inline-flex h-8 w-8 items-center justify-center">
                    <Building2 className="text-orange h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-body font-medium">Active Economies</div>
                    <div className="text-footnote text-label-secondary">
                      {globalStats.countryCount} countries
                    </div>
                  </div>
                </div>
              </div>

              {/* Right side - Additional metrics */}
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-3">
                  <MapPin className="text-label-secondary h-4 w-4" />
                  <div></div>
                </div>
                <div className="flex items-center gap-3">
                  <Activity className="text-label-secondary h-4 w-4" />
                  <div></div>
                </div>
                <div className="flex items-center gap-3">
                  <Target className="text-label-secondary h-4 w-4" />
                  <div></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Additional Metrics Row - Mobile */}
        {globalStats && (
          <div className="border-separator mt-3 border-t pt-3 lg:hidden">
            <div className="grid grid-cols-2 gap-3">
              {/* Icons with stats */}
              <div className="flex items-center gap-3">
                <div className="rounded-control bg-blue/20 inline-flex h-8 w-8 items-center justify-center">
                  <Users className="text-blue h-4 w-4" />
                </div>
                <div>
                  <div className="text-body font-medium">Population</div>
                  <div className="text-footnote text-label-secondary">
                    {formatPopulation(globalStats.totalPopulation)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-control bg-green/20 inline-flex h-8 w-8 items-center justify-center">
                  <DollarSign className="text-green h-4 w-4" />
                </div>
                <div>
                  <div className="text-body font-medium">GDP</div>
                  <div className="text-footnote text-label-secondary">
                    {formatCurrency(globalStats.totalGdp)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-control bg-purple/20 inline-flex h-8 w-8 items-center justify-center">
                  <TrendingUp className="text-purple h-4 w-4" />
                </div>
                <div>
                  <div className="text-body font-medium">Growth</div>
                  <div className="text-footnote text-label-secondary">
                    {formatGrowthRateFromDecimal(globalStats.globalGrowthRate)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-control bg-orange/20 inline-flex h-8 w-8 items-center justify-center">
                  <Building2 className="text-orange h-4 w-4" />
                </div>
                <div>
                  <div className="text-body font-medium">Activity</div>
                  <div className="text-footnote text-label-secondary">
                    {globalStats.countryCount} countries
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="text-label-secondary h-4 w-4" />
                <div>
                  <div className="text-body font-medium">Avg Population Density</div>
                  <div className="text-footnote text-label-secondary">
                    {globalStats.averagePopulationDensity.toLocaleString()}/km²
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Activity className="text-label-secondary h-4 w-4" />
                <div>
                  <div className="text-body font-medium">Avg GDP Density</div>
                  <div className="text-footnote text-label-secondary">
                    {formatCurrency(globalStats.averageGdpDensity)}/km²
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Target className="text-label-secondary h-4 w-4" />
                <div>
                  <div className="text-body font-medium">Last Updated</div>
                  <div className="text-footnote text-label-secondary">
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
