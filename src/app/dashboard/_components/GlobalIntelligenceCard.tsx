"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, ChevronLeft, TrendingUp, AlertTriangle, Eye } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { ExecutiveActivityRings } from "~/components/ui/executive-activity-rings";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

interface ProcessedCountryData {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
}

interface AdaptedGlobalStats {
  totalPopulation: number;
  totalGdp: number;
  averageGdpPerCapita: number;
  countryCount: number;
  averagePopulationDensity: number;
  averageGdpDensity: number;
  globalGrowthRate: number;
  timestamp: number;
  ixTimeTimestamp: number;
}

interface GlobalIntelligenceCardProps {
  adaptedGlobalStats?: AdaptedGlobalStats;
  setIsGlobalCardHovered: (hovered: boolean) => void;
  collapseGlobalCard: () => void;
  isGlobalCollapsing: boolean;
  isGlobalCardSlid: boolean;
  className?: string;
}

export function GlobalIntelligenceCard({
  adaptedGlobalStats,
  setIsGlobalCardHovered,
  collapseGlobalCard,
  isGlobalCollapsing,
  isGlobalCardSlid,
  className,
}: GlobalIntelligenceCardProps) {
  // Wire to live data via tRPC (migrated from deprecated SDI router to unified intelligence)
  const { data: activeCrises, isLoading: crisesLoading } =
    api.unifiedIntelligence.getActiveCrises.useQuery();
  const { data: intelligenceFeed, isLoading: intelLoading } =
    api.unifiedIntelligence.getIntelligenceFeed.useQuery({
      limit: 10,
      offset: 0,
    });
  const { data: economicIndicators, isLoading: economicLoading } =
    api.unifiedIntelligence.getEconomicIndicators.useQuery();

  const isLoading = crisesLoading || intelLoading || economicLoading;

  return (
    <AnimatePresence>
      {!isGlobalCardSlid && (
        <motion.div
          layout
          className={cn(className)}
          initial={{ x: 0, opacity: 1 }}
          exit={{
            x: 200,
            opacity: 0,
            scale: 0.95,
            transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] },
          }}
        >
          <motion.div
            className={cn(
              "glass-hierarchy-parent glass-refraction group relative overflow-hidden",
              "rounded-xl border border-neutral-200 transition-all duration-200 dark:border-white/[0.2]",
              "hover:shadow-xl hover:shadow-blue-500/10 dark:hover:shadow-blue-400/20",
              "bg-gradient-to-br from-white/10 via-white/5 to-white/10 backdrop-blur-xl",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(255,255,255,0.05)]",
              "h-auto p-6"
            )}
            style={{
              willChange: isGlobalCollapsing || isGlobalCardSlid ? "transform, opacity" : "auto",
            }}
            initial={{ opacity: 0, x: 10 }}
            animate={
              isGlobalCollapsing
                ? {
                    scaleY: 0,
                    opacity: 0.3,
                    transition: {
                      duration: 0.25,
                      ease: [0.25, 0.1, 0.25, 1],
                    },
                  }
                : isGlobalCardSlid
                  ? {
                      scaleX: 0,
                      opacity: 0,
                      transition: {
                        duration: 0.2,
                        ease: [0.25, 0.1, 0.25, 1],
                      },
                    }
                  : {
                      opacity: 1,
                      x: 0,
                      scaleX: 1,
                      scaleY: 1,
                    }
            }
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            onMouseEnter={() => setIsGlobalCardHovered(true)}
            onMouseLeave={() => setIsGlobalCardHovered(false)}
          >
            {/* Simplified static background pattern - much lighter on performance */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-indigo-500/10 to-blue-600/15" />
              <div
                className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0%,transparent_50%)]"
                style={{ animationDuration: "4s" }}
              />
              <div className="absolute top-0 left-0 h-32 w-32 rounded-full bg-blue-400/10 blur-xl" />
              <div className="absolute right-0 bottom-0 h-24 w-24 rounded-full bg-indigo-400/10 blur-lg" />
            </div>

            {/* Blue Shimmer Background - Simplified */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 via-blue-500/10 to-indigo-400/20" />
            <div className="absolute inset-0 -translate-x-full skew-x-12 transform bg-gradient-to-r from-transparent via-blue-400/20 to-transparent transition-transform duration-2000 ease-in-out hover:translate-x-full" />

            {/* Content Layout */}
            <div className="relative z-10 flex h-full flex-col justify-between">
              {/* Top Section - Title */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-6 w-6 text-blue-400 drop-shadow-sm" />
                  <h3 className="text-foreground text-lg font-bold drop-shadow-sm">
                    Global Activity
                  </h3>
                </div>

                {/* Collapse Arrow */}
                <button
                  className="glass-surface glass-interactive hover:glass-depth-2 rounded-full p-2 transition-all duration-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    collapseGlobalCard();
                  }}
                >
                  <ChevronLeft className="text-foreground h-5 w-5" />
                </button>
              </div>

              {/* Global Activity Rings */}
              <div className="mb-4 flex justify-center">
                <ExecutiveActivityRings
                  countryData={{
                    name: "Global Economy",
                    currentGdpPerCapita: adaptedGlobalStats?.averageGdpPerCapita || 0,
                    currentTotalGdp: adaptedGlobalStats?.totalGdp || 0,
                    currentPopulation: adaptedGlobalStats?.totalPopulation || 0,
                    populationGrowthRate: 0.01,
                    adjustedGdpGrowth: adaptedGlobalStats?.globalGrowthRate || 0,
                    economicTier: "Global",
                    populationTier: "Global",
                    populationDensity: adaptedGlobalStats?.averagePopulationDensity || 0,
                  }}
                  onRingClick={() => {}}
                  compact={true}
                  className="mb-4"
                />
              </div>

              {/* SDI Overview */}
              <div className="space-y-3">
                {isLoading ? (
                  <div className="text-muted-foreground text-center">Loading...</div>
                ) : (
                  <>
                    {/* Active Crises and Intel Items */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="glass-hierarchy-child rounded p-3 text-center">
                        <div className="text-lg font-bold text-red-400">
                          {activeCrises?.length || 0}
                        </div>
                        <div className="text-muted-foreground text-xs">Active Crises</div>
                      </div>
                      <div className="glass-hierarchy-child rounded p-3 text-center">
                        <div className="text-lg font-bold text-blue-400">
                          {intelligenceFeed?.pagination?.total || 0}
                        </div>
                        <div className="text-muted-foreground text-xs">Intel Items</div>
                      </div>
                    </div>

                    {/* Economic Intelligence */}
                    {economicIndicators && (
                      <div className="glass-hierarchy-child rounded-lg p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-400" />
                          <span className="text-foreground text-sm font-medium">
                            Economic Intelligence
                          </span>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Global Growth:</span>
                            <span className="text-green-400">
                              +{((economicIndicators.globalGrowth || 0) * 100).toFixed(2)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Inflation Rate:</span>
                            <span className="text-yellow-400">
                              {((economicIndicators.inflationRate || 0) * 100).toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
