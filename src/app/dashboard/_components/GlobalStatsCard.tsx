/**
 * GlobalStatsCard Component
 *
 * Displays global intelligence and statistics with:
 * - Rubik's cube flag animation background
 * - Global activity rings
 * - SDI overview (crises, intelligence feed)
 * - Economic indicators
 * - Power distribution breakdown (expandable)
 */

"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, ChevronLeft, TrendingUp, Badge
} from "lucide-react";
import { ExecutiveActivityRings } from "~/components/ui/executive-activity-rings";
import { RubiksCubeFlags } from "~/components/ui/rubiks-cube-flags";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

interface CountryData {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
}

interface GlobalStats {
  totalPopulation: number;
  totalGdp: number;
  averageGdpPerCapita: number;
  countryCount: number;
  economicTierDistribution: Record<string, number>;
  populationTierDistribution: Record<string, number>;
  averagePopulationDensity: number;
  averageGdpDensity: number;
  globalGrowthRate: number;
  timestamp: number;
  ixTimeTimestamp: number;
}

interface PowerGrouped {
  superpower?: CountryData[];
  major?: CountryData[];
  regional?: CountryData[];
  rising?: CountryData[];
  emerging?: CountryData[];
  developing?: CountryData[];
}

interface GlobalStatsCardProps {
  processedCountries: CountryData[];
  globalStats?: GlobalStats;
  powerGrouped: PowerGrouped;
  isGlobalCardHovered: boolean;
  setIsGlobalCardHovered: (value: boolean) => void;
  isGlobalCollapsing: boolean;
  isGlobalCardSlid: boolean;
  collapseGlobalCard: () => void;
  className?: string;
}

export function GlobalStatsCard({
  processedCountries,
  globalStats,
  powerGrouped,
  isGlobalCardHovered,
  setIsGlobalCardHovered,
  isGlobalCollapsing,
  isGlobalCardSlid,
  collapseGlobalCard,
  className
}: GlobalStatsCardProps) {
  // Wire to live data via tRPC (migrated from deprecated SDI router to unified intelligence)
  const { data: activeCrises, isLoading: crisesLoading } = api.unifiedIntelligence.getActiveCrises.useQuery();
  const { data: intelligenceFeed, isLoading: intelLoading } = api.unifiedIntelligence.getIntelligenceFeed.useQuery({
    limit: 10,
    offset: 0
  });
  const { data: economicIndicators, isLoading: economicLoading } = api.unifiedIntelligence.getEconomicIndicators.useQuery();

  const isLoading = crisesLoading || intelLoading || economicLoading;
  return (
    <AnimatePresence>
      {!isGlobalCardSlid && (
        <motion.div
          layout
          className={cn("lg:col-span-4", className)}
          initial={{ x: 0, opacity: 1 }}
          exit={{
            x: 300,
            opacity: 0,
            transition: { duration: 0.6, ease: "easeInOut" }
          }}
        >
          <motion.div
            className={cn(
              "glass-hierarchy-parent glass-refraction relative overflow-hidden group",
              "rounded-xl border border-neutral-200 dark:border-white/[0.2] transition-all duration-200",
              "hover:shadow-xl hover:shadow-blue-500/10 dark:hover:shadow-blue-400/20",
              "backdrop-blur-xl bg-gradient-to-br from-white/10 via-white/5 to-white/10",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(255,255,255,0.05)]",
              "h-auto p-6"
            )}
            whileHover={{ y: -2 }}
            initial={{ opacity: 0, x: 10 }}
            animate={
              isGlobalCollapsing ? {
                scaleY: 0.1,
                height: "20px",
                transition: {
                  duration: 0.4,
                  ease: "easeInOut"
                }
              } : isGlobalCardSlid ? {
                scaleX: 0,
                width: "0px",
                opacity: 0,
                transition: {
                  duration: 0.6,
                  ease: "easeInOut"
                }
              } : {
                opacity: 1,
                x: 0
              }
            }
            transition={{ type: "spring", stiffness: 400, damping: 40, delay: 0.1 }}
            layout
            onMouseEnter={() => setIsGlobalCardHovered(true)}
            onMouseLeave={() => setIsGlobalCardHovered(false)}
          >
            {/* Rubik's Cube Flag Animation with Camera Depth of Field Blur */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {/* Background layer with heavy depth of field blur */}
              <div className="absolute inset-0 filter blur-[12px] opacity-60">
                <RubiksCubeFlags
                  countries={processedCountries.map(country => ({
                    id: country.id,
                    name: country.name,
                    currentPopulation: country.currentPopulation,
                    currentGdpPerCapita: country.currentGdpPerCapita,
                    currentTotalGdp: country.currentTotalGdp,
                    economicTier: country.economicTier
                  }))}
                  className="w-full h-full"
                  gridSize={4}
                  animationSpeed={1500}
                  hoverOnly={true}
                  externalHover={isGlobalCardHovered}
                />
              </div>

              {/* Mid-ground layer with moderate blur */}
              <div className="absolute inset-0 filter blur-[6px] opacity-40">
                <RubiksCubeFlags
                  countries={processedCountries.map(country => ({
                    id: country.id,
                    name: country.name,
                    currentPopulation: country.currentPopulation,
                    currentGdpPerCapita: country.currentGdpPerCapita,
                    currentTotalGdp: country.currentTotalGdp,
                    economicTier: country.economicTier
                  }))}
                  className="w-full h-full"
                  gridSize={4}
                  animationSpeed={1500}
                  hoverOnly={true}
                  externalHover={isGlobalCardHovered}
                />
              </div>

              {/* Foreground layer with subtle blur */}
              <div className="absolute inset-0 filter blur-[2px] opacity-25">
                <RubiksCubeFlags
                  countries={processedCountries.map(country => ({
                    id: country.id,
                    name: country.name,
                    currentPopulation: country.currentPopulation,
                    currentGdpPerCapita: country.currentGdpPerCapita,
                    currentTotalGdp: country.currentTotalGdp,
                    economicTier: country.economicTier
                  }))}
                  className="w-full h-full"
                  gridSize={4}
                  animationSpeed={1500}
                  hoverOnly={true}
                  externalHover={isGlobalCardHovered}
                />
              </div>

              {/* Text visibility overlay with adaptive backdrop blur */}
              <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/70 to-background/90 backdrop-blur-md" />

              {/* Enhanced text legibility with soft depth blur */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/15 dark:from-black/20 dark:via-transparent dark:to-black/25 backdrop-blur-sm" />

              {/* Final text contrast enhancement */}
              <div className="absolute inset-0" style={{
                background: 'radial-gradient(circle at center, rgba(var(--background-rgb, 255, 255, 255), 0.3) 0%, transparent 50%, rgba(var(--background-rgb, 255, 255, 255), 0.4) 100%)'
              }} />
            </div>

            {/* Blue Shimmer Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 via-blue-500/10 to-indigo-400/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/30 to-transparent transform skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-3000 ease-in-out" />

            {/* Content Layout */}
            <div className="relative z-10 h-full flex flex-col justify-between">
              {/* Top Section - Title */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Brain className="h-6 w-6 text-blue-400 drop-shadow-sm" />
                  <h3 className="text-lg font-bold text-foreground drop-shadow-sm">Global Intelligence</h3>
                </div>

                {/* Collapse Arrow */}
                <button
                  className="p-2 rounded-full glass-surface glass-interactive hover:glass-depth-2 transition-all duration-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    collapseGlobalCard();
                  }}
                >
                  <ChevronLeft className="h-5 w-5 text-foreground" />
                </button>
              </div>

              {/* Global Activity Rings */}
              <div className="mb-4 flex justify-center">
                <ExecutiveActivityRings
                  countryData={{
                    name: "Global Economy",
                    currentGdpPerCapita: globalStats?.averageGdpPerCapita || 0,
                    currentTotalGdp: globalStats?.totalGdp || 0,
                    currentPopulation: globalStats?.totalPopulation || 0,
                    populationGrowthRate: 0.01,
                    adjustedGdpGrowth: globalStats?.globalGrowthRate || 0,
                    economicTier: "Global",
                    populationTier: "Global",
                    populationDensity: globalStats?.averagePopulationDensity || 0
                  }}
                  onRingClick={() => {}}
                  compact={true}
                  className="mb-4"
                />
              </div>

              {/* SDI Overview */}
              <div className="space-y-3">
                {isLoading ? (
                  <div className="text-center text-muted-foreground">Loading...</div>
                ) : (
                  <>
                    {/* Active Crises and Intel Items */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="glass-hierarchy-child p-3 rounded text-center">
                        <div className="text-lg font-bold text-red-400">
                          {activeCrises?.length || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Active Crises</div>
                      </div>
                      <div className="glass-hierarchy-child p-3 rounded text-center">
                        <div className="text-lg font-bold text-blue-400">
                          {intelligenceFeed?.pagination?.total || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Intel Items</div>
                      </div>
                    </div>

                    {/* Economic Intelligence */}
                    {economicIndicators && (
                      <div className="glass-hierarchy-child p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-green-400" />
                          <span className="text-sm font-medium text-foreground">Economic Intelligence</span>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Global Growth:</span>
                            <span className="text-green-400">+{((economicIndicators.globalGrowth || 0) * 100).toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Inflation Rate:</span>
                            <span className="text-yellow-400">{((economicIndicators.inflationRate || 0) * 100).toFixed(2)}%</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Expandable Content - Power Distribution (currently disabled) */}
              <AnimatePresence>
                {false && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="mt-6 overflow-hidden"
                  >
                    <div className="glass-hierarchy-child p-6 rounded-lg space-y-6">
                      <h4 className="text-lg font-semibold mb-4">Global Intelligence Network</h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="glass-depth-1 glass-refraction p-4 rounded-lg">
                          <h3 className="font-semibold mb-3">Power Distribution</h3>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="flex items-center gap-2">
                                <span>👑</span>
                                <span className="text-sm">Superpowers</span>
                              </span>
                              <span className="text-sm font-medium">{powerGrouped.superpower?.length || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="flex items-center gap-2">
                                <span>⭐</span>
                                <span className="text-sm">Major Powers</span>
                              </span>
                              <span className="text-sm font-medium">{powerGrouped.major?.length || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="flex items-center gap-2">
                                <span>🌍</span>
                                <span className="text-sm">Regional Powers</span>
                              </span>
                              <span className="text-sm font-medium">{powerGrouped.regional?.length || 0}</span>
                            </div>
                          </div>
                        </div>

                        {globalStats && (
                          <div className="glass-depth-1 glass-refraction p-4 rounded-lg">
                            <h3 className="font-semibold mb-3">Global Statistics</h3>
                            <div className="space-y-3">
                              <div>
                                <div className="text-2xl font-bold text-green-500">
                                  ${((globalStats?.totalGdp || 0) / 1e12).toFixed(1)}T
                                </div>
                                <p className="text-sm text-muted-foreground">World GDP</p>
                              </div>
                              <div>
                                <div className="text-2xl font-bold text-blue-500">
                                  {globalStats?.countryCount || 0}
                                </div>
                                <p className="text-sm text-muted-foreground">Active Nations</p>
                              </div>
                              <div>
                                <div className="text-2xl font-bold text-purple-500">
                                  +{((globalStats?.globalGrowthRate || 0) * 100).toFixed(1)}%
                                </div>
                                <p className="text-sm text-muted-foreground">Global Growth</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
