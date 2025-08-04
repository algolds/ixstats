"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Brain, ChevronLeft, TrendingUp, AlertTriangle, Eye
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { ExecutiveActivityRings } from "~/components/ui/executive-activity-rings";
import { RubiksCubeFlags } from "~/components/ui/rubiks-cube-flags";
import { cn } from "~/lib/utils";

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

interface SDIData {
  activeCrises?: Array<{ id: string; title: string; severity: string; status: string; timestamp: Date }>;
  intelligenceFeed?: { total: number; data: Array<any> };
  economicIndicators?: { globalGrowth: number; inflationRate: number; [key: string]: any };
}

interface GlobalIntelligenceCardProps {
  processedCountries: ProcessedCountryData[];
  adaptedGlobalStats?: AdaptedGlobalStats;
  sdiData: SDIData;
  isGlobalCardHovered: boolean;
  setIsGlobalCardHovered: (hovered: boolean) => void;
  collapseGlobalCard: () => void;
  isGlobalCollapsing: boolean;
  isGlobalCardSlid: boolean;
}

export function GlobalIntelligenceCard({
  processedCountries,
  adaptedGlobalStats,
  sdiData,
  isGlobalCardHovered,
  setIsGlobalCardHovered,
  collapseGlobalCard,
  isGlobalCollapsing,
  isGlobalCardSlid
}: GlobalIntelligenceCardProps) {
  const { activeCrises, intelligenceFeed, economicIndicators } = sdiData;

  return (
    <AnimatePresence>
      {!isGlobalCardSlid && (
        <motion.div
          layout
          className="lg:col-span-4"
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
                    currentGdpPerCapita: adaptedGlobalStats?.averageGdpPerCapita || 0,
                    currentTotalGdp: adaptedGlobalStats?.totalGdp || 0,
                    currentPopulation: adaptedGlobalStats?.totalPopulation || 0,
                    populationGrowthRate: 0.01,
                    adjustedGdpGrowth: adaptedGlobalStats?.globalGrowthRate || 0,
                    economicTier: "Global",
                    populationTier: "Global",
                    populationDensity: adaptedGlobalStats?.averagePopulationDensity || 0
                  }}
                  onRingClick={() => {}}
                  compact={true}
                  className="mb-4"
                />
              </div>
              
              {/* SDI Overview */}
              <div className="space-y-3">
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
                      {intelligenceFeed?.total || 0}
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
                        <span className="text-green-400">+{(economicIndicators.globalGrowth || 0).toFixed(3)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Inflation Rate:</span>
                        <span className="text-yellow-400">{(economicIndicators.inflationRate || 0).toFixed(3)}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}