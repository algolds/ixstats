"use client";

import React from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Globe, Trophy, Eye } from "lucide-react";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { SectionHelpIcon } from "~/components/ui/help-icon";
import { CountryCard } from "~/components/dashboard/CountryCard";

interface DiscoverModeProps {
  adaptedGlobalStats?: {
    totalPopulation: number;
    totalGdp: number;
    averageGdpPerCapita: number;
    totalCountries: number;
    globalGrowthRate: number;
  };
  countries: any[];
}

/** Discover view: global statistics + top-nations leaderboard.
 * Extracted from EnhancedCommandCenter.tsx (audit C2). */
export function DiscoverMode({ adaptedGlobalStats, countries }: DiscoverModeProps) {
  return (
    <>
      {/* Global Stats Overview */}
      <div className="space-y-4">
        <h3 className="text-foreground flex items-center gap-3 text-xl font-bold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
            <Globe className="h-4 w-4 text-white" />
          </div>
          Global Statistics
          <SectionHelpIcon
            title="Global Overview"
            content="View aggregate statistics across all nations in IxStats, including total population, combined GDP, and global economic growth rates."
          />
        </h3>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <div className="glass-hierarchy-child rounded-lg p-3 text-center sm:p-4">
            <div className="text-foreground mb-1 text-xl font-bold sm:text-2xl">
              {adaptedGlobalStats?.totalCountries || 0}
            </div>
            <div className="text-muted-foreground text-xs sm:text-sm">Nations</div>
          </div>
          <div className="glass-hierarchy-child rounded-lg p-3 text-center sm:p-4">
            <div className="text-foreground mb-1 text-xl font-bold sm:text-2xl">
              {formatPopulation(adaptedGlobalStats?.totalPopulation || 0)}
            </div>
            <div className="text-muted-foreground text-xs sm:text-sm">Total Population</div>
          </div>
          <div className="glass-hierarchy-child rounded-lg p-3 text-center sm:p-4">
            <div className="text-foreground mb-1 text-xl font-bold sm:text-2xl">
              {formatCurrency(adaptedGlobalStats?.totalGdp || 0)}
            </div>
            <div className="text-muted-foreground text-xs sm:text-sm">World GDP</div>
          </div>
          <div className="glass-hierarchy-child rounded-lg p-3 text-center sm:p-4">
            <div className="mb-1 text-xl font-bold text-green-500 sm:text-2xl">
              {adaptedGlobalStats?.globalGrowthRate
                ? (adaptedGlobalStats.globalGrowthRate * 100).toFixed(3)
                : "0.000"}
              %
            </div>
            <div className="text-muted-foreground text-xs sm:text-sm">Global Growth</div>
          </div>
        </div>
      </div>

      {/* Top Nations Section */}
      <div className="space-y-4">
        <h3 className="text-foreground flex items-center gap-3 text-xl font-bold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500">
            <Trophy className="h-4 w-4 text-white" />
          </div>
          Global Leaderboard
          <SectionHelpIcon
            title="Top Nations"
            content="Rankings of the highest-performing countries by total GDP. Click on any country to view detailed economic data and statistics."
          />
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {countries
            .sort((a, b) => b.currentTotalGdp - a.currentTotalGdp)
            .slice(0, 9)
            .map((country, index) => (
              <CountryCard key={country.id} country={country} index={index} />
            ))}
        </div>

        <div className="text-center">
          <Link href="/countries">
            <Button variant="outline" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              View Complete Leaderboards
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}
