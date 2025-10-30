"use client";

import React from "react";
import { GlassActivityMarquee } from "./GlassActivityMarquee";

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

interface LiveActivityMarqueeProps {
  countries: ProcessedCountryData[];
  userCountry?: ProcessedCountryData;
  isLoading: boolean;
}

export function LiveActivityMarquee({
  countries,
  userCountry,
  isLoading,
}: LiveActivityMarqueeProps) {
  return (
    <GlassActivityMarquee countries={countries} userCountry={userCountry} isLoading={isLoading} />
  );
}
