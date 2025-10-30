/**
 * ActivityFeedCard Component
 *
 * Displays the live activity marquee with platform activity:
 * - Country updates (GDP, population changes)
 * - Economic milestones
 * - User activity highlights
 * - Loading states
 */

"use client";

import React from "react";
import { GlassActivityMarquee } from "./GlassActivityMarquee";

interface CountryData {
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

interface UserCountry {
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

interface ActivityFeedCardProps {
  countries: CountryData[];
  userCountry?: UserCountry;
  isLoading?: boolean;
  className?: string;
}

export function ActivityFeedCard({
  countries,
  userCountry,
  isLoading = false,
  className,
}: ActivityFeedCardProps) {
  return (
    <GlassActivityMarquee countries={countries} userCountry={userCountry} isLoading={isLoading} />
  );
}
