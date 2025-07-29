"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { 
  Crown, Building2, Globe, Settings, TrendingUp, 
  Users, DollarSign, BarChart3, ChevronUp, ChevronDown,
  Plus, ExternalLink, Briefcase, Brain, FileText, 
  Search, Calculator, Star
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { ThemedTabContent } from "~/components/ui/themed-tab-content";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "~/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { AppleRippleEffect } from "~/components/ui/apple-ripple-effect";
import { SimpleFlag } from "~/components/SimpleFlag";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { cn } from "~/lib/utils";

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
  populationDensity?: number | null;
  continent?: string | null;
  region?: string | null;
  governmentType?: string | null;
  religion?: string | null;
  leader?: string | null;
}

interface MyCountryCardProps {
  countryData?: CountryData;
  expandedCards: Set<string>;
  setExpandedCards: (cards: Set<string>) => void;
  setActivityPopoverOpen: (index: number | null) => void;
  isRippleActive: boolean;
  isGlobalCardSlid: boolean;
}

export function MyCountryCard({ 
  countryData, 
  expandedCards, 
  setExpandedCards, 
  setActivityPopoverOpen,
  isRippleActive,
  isGlobalCardSlid 
}: MyCountryCardProps) {
  return (
    <motion.div
      layout
      className={cn(
        isGlobalCardSlid ? "lg:col-span-12" : "lg:col-span-8"
      )}
    >
      <AppleRippleEffect
        isActive={isRippleActive}
        direction="right"
        className="rounded-xl"
      >
        <motion.div
          className={cn(
            "glass-hierarchy-parent relative overflow-hidden group",
            "rounded-xl border border-neutral-200 dark:border-white/[0.2] p-6 transition-all duration-200",
            "hover:shadow-xl hover:shadow-yellow-500/10 dark:hover:shadow-yellow-400/20 mycountry-card"
          )}
          whileHover={{ y: -2 }}
          transition={{ type: "spring", stiffness: 400, damping: 40 }}
          layout
          data-theme="executive"
        >
          {/* Full Bento Flag Background with Realistic Ripple */}
          {countryData && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <motion.div 
                className="w-full h-full relative"
                style={{
                  filter: "blur(8px)",
                  opacity: 0.4
                }}
              >
                <motion.div
                  className="w-full h-full"
                  animate={{
                    x: [0, 2, -1, 1, 0],
                    rotateY: [0, 1, -0.5, 0.5, 0],
                    scaleX: [1, 1.01, 0.99, 1.005, 1]
                  }}
                  transition={{
                    duration: 6,
                    ease: "easeInOut",
                    repeat: Infinity,
                    times: [0, 0.25, 0.5, 0.75, 1]
                  }}
                >
                  <SimpleFlag 
                    countryName={countryData.name}
                    className="w-full h-full object-cover"
                    showPlaceholder={true}
                  />
                </motion.div>
              </motion.div>
              
              {/* Overlay to ensure readability */}
              <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background/80" />
            </div>
          )}

          {/* MyCountry Themed Shimmer Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 via-yellow-500/10 to-orange-400/20 mycountry-gold-shimmer" />
          <div className="absolute inset-0 tab-shimmer" />

          {/* Content Layout */}
          <div className="relative z-10 h-full flex flex-col">
            {/* Top Section - Country Info */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-8 rounded border border-white/30 overflow-hidden shadow-lg">
                  {countryData && <SimpleFlag countryName={countryData.name} className="w-full h-full object-cover" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Crown className="h-5 w-5 text-yellow-400" />
                    <h3 className="text-xl font-bold text-foreground drop-shadow-sm">MyCountry® Premium</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-foreground drop-shadow-sm">
                      {countryData?.name || 'Configure Country'}
                    </span>
                    {countryData && (
                      <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-800 dark:text-yellow-200 border-yellow-400/50">
                        {countryData.economicTier}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Dropdown Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <div className="p-3 rounded-full glass-hierarchy-interactive glass-refraction transition-all duration-200 relative z-10 hover:scale-105 cursor-pointer">
                    <Plus className="h-5 w-5 text-foreground" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 glass-modal border-yellow-400/30">
                  <DropdownMenuItem className="flex items-center gap-2 glass-hierarchy-interactive">
                    <Crown className="h-4 w-4 text-yellow-400" />
                    <span>MyCountry Profile</span>
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex items-center gap-2 glass-hierarchy-interactive">
                    <TrendingUp className="h-4 w-4 text-green-400" />
                    <span>Economic Dashboard</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex items-center gap-2 glass-hierarchy-interactive">
                    <Settings className="h-4 w-4 text-blue-400" />
                    <span>Policy Management</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex items-center gap-2 glass-hierarchy-interactive">
                    <Users className="h-4 w-4 text-purple-400" />
                    <span>Demographics</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex items-center gap-2 glass-hierarchy-interactive">
                    <Brain className="h-4 w-4 text-indigo-400" />
                    <span>Intelligence Center</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* National Performance Metrics Section */}
            {countryData && (
              <ThemedTabContent theme="executive" className="tab-content-enter mb-6">
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-400" />
                    National Performance Metrics
                  </h4>
                  
                  <div className="grid grid-cols-3 gap-3">
                    {/* Economic Performance */}
                    <div className="glass-hierarchy-child p-4 rounded-lg text-center cursor-pointer hover:scale-105 transition-transform"
                         onClick={() => setActivityPopoverOpen(0)}>
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-400/20 flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-green-400" />
                      </div>
                      <div className="text-lg font-bold text-green-400 mb-1">
                        {Math.min(100, Math.round((countryData.currentGdpPerCapita / 70000) * 100))}%
                      </div>
                      <div className="text-xs text-muted-foreground">Economic Index</div>
                    </div>
                    
                    {/* Social Performance */}
                    <div className="glass-hierarchy-child p-4 rounded-lg text-center cursor-pointer hover:scale-105 transition-transform"
                         onClick={() => setActivityPopoverOpen(1)}>
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-blue-400/20 flex items-center justify-center">
                        <Users className="h-6 w-6 text-blue-400" />
                      </div>
                      <div className="text-lg font-bold text-blue-400 mb-1">
                        {Math.min(100, Math.round(85 + (countryData.populationGrowthRate * 1000)))}%
                      </div>
                      <div className="text-xs text-muted-foreground">Social Index</div>
                    </div>
                    
                    {/* Governance Performance */}
                    <div className="glass-hierarchy-child p-4 rounded-lg text-center cursor-pointer hover:scale-105 transition-transform"
                         onClick={() => setActivityPopoverOpen(2)}>
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-purple-400/20 flex items-center justify-center">
                        <Crown className="h-6 w-6 text-purple-400" />
                      </div>
                      <div className="text-lg font-bold text-purple-400 mb-1">
                        {countryData.economicTier === 'Extravagant' ? '95' : 
                         countryData.economicTier === 'Very Strong' ? '88' : 
                         countryData.economicTier === 'Strong' ? '82' : '75'}%
                      </div>
                      <div className="text-xs text-muted-foreground">Governance Index</div>
                    </div>
                  </div>
                  
                  {/* Performance Summary */}
                  <div className="glass-hierarchy-child p-3 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Overall Performance:</span>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold text-green-400">
                          {Math.round((
                            Math.min(100, Math.round((countryData.currentGdpPerCapita / 70000) * 100)) +
                            Math.min(100, Math.round(85 + (countryData.populationGrowthRate * 1000))) +
                            (countryData.economicTier === 'Extravagant' ? 95 : 
                             countryData.economicTier === 'Very Strong' ? 88 : 
                             countryData.economicTier === 'Strong' ? 82 : 75)
                          ) / 3)}%
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {Math.round((
                            Math.min(100, Math.round((countryData.currentGdpPerCapita / 70000) * 100)) +
                            Math.min(100, Math.round(85 + (countryData.populationGrowthRate * 1000))) +
                            (countryData.economicTier === 'Extravagant' ? 95 : 
                             countryData.economicTier === 'Very Strong' ? 88 : 
                             countryData.economicTier === 'Strong' ? 82 : 75)
                          ) / 3) >= 85 ? 'Excellent' : 
                          Math.round((
                            Math.min(100, Math.round((countryData.currentGdpPerCapita / 70000) * 100)) +
                            Math.min(100, Math.round(85 + (countryData.populationGrowthRate * 1000))) +
                            (countryData.economicTier === 'Extravagant' ? 95 : 
                             countryData.economicTier === 'Very Strong' ? 88 : 
                             countryData.economicTier === 'Strong' ? 82 : 75)
                          ) / 3) >= 75 ? 'Good' : 'Needs Improvement'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </ThemedTabContent>
            )}

            {/* Key Metrics Grid - Always visible */}
            {countryData && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="glass-hierarchy-child p-3 rounded-lg text-center">
                  <div className="text-xs text-muted-foreground mb-1">Population</div>
                  <div className="text-sm font-bold text-blue-400">
                    {(countryData.currentPopulation / 1000000).toFixed(1)}M
                  </div>
                </div>
                <div className="glass-hierarchy-child p-3 rounded-lg text-center">
                  <div className="text-xs text-muted-foreground mb-1">GDP per Capita</div>
                  <div className="text-sm font-bold text-green-400">
                    ${(countryData.currentGdpPerCapita / 1000).toFixed(0)}k
                  </div>
                </div>
                <div className="glass-hierarchy-child p-3 rounded-lg text-center">
                  <div className="text-xs text-muted-foreground mb-1">Employment</div>
                  <div className="text-sm font-bold text-purple-400">
                    {(96.5 - (countryData.adjustedGdpGrowth < 0 ? 2 : 0)).toFixed(1)}%
                  </div>
                </div>
                <div className="glass-hierarchy-child p-3 rounded-lg text-center">
                  <div className="text-xs text-muted-foreground mb-1">Economic Health</div>
                  <div className="text-sm font-bold text-green-400">
                    {Math.min(100, Math.round((countryData.currentGdpPerCapita / 70000) * 100))}%
                  </div>
                </div>
              </div>
            )}

            {/* Expandable Content - Only shows when expanded */}
            <AnimatePresence>
              {expandedCards.has('mycountry') && countryData && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="mb-6 overflow-hidden"
                >
                  <div className="space-y-6">
                    {/* Location/Government/Leader/Religion Section */}
                    <div>
                      <h4 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Globe className="h-5 w-5 text-blue-400" />
                        Country Profile
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Location */}
                        <div className="glass-hierarchy-child p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Globe className="h-4 w-4 text-blue-400" />
                            <div className="text-xs text-muted-foreground">Location</div>
                          </div>
                          <div className="text-sm font-medium text-foreground">
                            {countryData.region ? `${countryData.region}, ${countryData.continent || 'Unknown'}` : (countryData.continent || 'Unknown Region')}
                          </div>
                        </div>
                        
                        {/* Government Type */}
                        <div className="glass-hierarchy-child p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Building2 className="h-4 w-4 text-purple-400" />
                            <div className="text-xs text-muted-foreground">Government</div>
                          </div>
                          <div className="text-sm font-medium text-foreground">
                            {countryData.governmentType || 'Constitutional Democracy'}
                          </div>
                        </div>
                        
                        {/* Leader */}
                        <div className="glass-hierarchy-child p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Crown className="h-4 w-4 text-yellow-400" />
                            <div className="text-xs text-muted-foreground">Leader</div>
                          </div>
                          <div className="text-sm font-medium text-foreground">
                            {countryData.leader || 'Prime Minister'}
                          </div>
                        </div>
                        
                        {/* Religion */}
                        <div className="glass-hierarchy-child p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Star className="h-4 w-4 text-indigo-400" />
                            <div className="text-xs text-muted-foreground">Religion</div>
                          </div>
                          <div className="text-sm font-medium text-foreground">
                            {countryData.religion || 'Secular Pluralism'}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Economic Health Indicators Section */}
                    <div>
                      <h4 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-green-400" />
                        Economic Health Indicators
                      </h4>
                      <div className="space-y-3">
                        {/* Unemployment Rate */}
                        <div className="glass-hierarchy-child p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground">Unemployment Rate</span>
                            <span className="text-xs text-muted-foreground">{(3.5 + (countryData.adjustedGdpGrowth < 0 ? 2 : 0)).toFixed(1)}%</span>
                          </div>
                          <Progress value={((3.5 + (countryData.adjustedGdpGrowth < 0 ? 2 : 0)) / 25) * 100} className="h-2" />
                          <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>0%</span>
                            <span className="text-green-600">Optimal: 3-7%</span>
                            <span>25%</span>
                          </div>
                        </div>
                        
                        {/* Labor Force Participation */}
                        <div className="glass-hierarchy-child p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground">Labor Force Participation</span>
                            <span className="text-xs text-muted-foreground">{(68.5 + (countryData.currentGdpPerCapita / 100000) * 5).toFixed(1)}%</span>
                          </div>
                          <Progress value={68.5 + (countryData.currentGdpPerCapita / 100000) * 5} className="h-2" />
                          <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>0%</span>
                            <span className="text-green-600">Optimal: 60-80%</span>
                            <span>100%</span>
                          </div>
                        </div>
                        
                        {/* Economic Growth Health */}
                        <div className="glass-hierarchy-child p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground">Economic Growth Health</span>
                            <span className="text-xs text-muted-foreground">{((countryData.adjustedGdpGrowth || 0) * 100).toFixed(1)}%</span>
                          </div>
                          <Progress value={Math.max(0, Math.min(100, ((countryData.adjustedGdpGrowth || 0) * 100 + 5) * 10))} className="h-2" />
                          <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>-5%</span>
                            <span className="text-green-600">Optimal: 2-5%</span>
                            <span>10%</span>
                          </div>
                        </div>
                        
                        {/* Economic Stability Index */}
                        <div className="glass-hierarchy-child p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground">Economic Stability Index</span>
                            <span className="text-xs text-muted-foreground">{Math.min(100, Math.round((countryData.currentGdpPerCapita / 70000) * 100))}%</span>
                          </div>
                          <Progress value={Math.min(100, Math.round((countryData.currentGdpPerCapita / 70000) * 100))} className="h-2" />
                          <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>0%</span>
                            <span className="text-green-600">Target: 85%+</span>
                            <span>100%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* MyCountry Submodule Icons - Always at bottom */}
            {countryData && (
              <div className="mt-auto">
                {/* Expand/Collapse Button */}
                <div className="flex justify-center mb-4">
                  <button
                    onClick={() => {
                      const newExpanded = new Set(expandedCards);
                      if (newExpanded.has('mycountry')) {
                        newExpanded.delete('mycountry');
                      } else {
                        newExpanded.add('mycountry');
                      }
                      setExpandedCards(newExpanded);
                    }}
                    className="px-4 py-2 glass-hierarchy-interactive rounded-lg text-sm font-medium text-foreground hover:scale-105 transition-transform flex items-center gap-2"
                  >
                    {expandedCards.has('mycountry') ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        Show More
                      </>
                    )}
                  </button>
                </div>

                {/* Icons - Always visible at bottom */}
                <div className="flex flex-wrap gap-2 justify-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                        <FileText className="h-4 w-4 text-blue-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Overview</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                        <Crown className="h-4 w-4 text-yellow-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Executive</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                        <TrendingUp className="h-4 w-4 text-green-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Economy</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                        <Briefcase className="h-4 w-4 text-orange-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Labor</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                        <Building2 className="h-4 w-4 text-purple-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Government</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                        <Users className="h-4 w-4 text-pink-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Demographics</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                        <Brain className="h-4 w-4 text-indigo-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Intelligence</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                        <Search className="h-4 w-4 text-teal-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Detailed Analysis</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                        <Calculator className="h-4 w-4 text-cyan-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Economic Modeling</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}

            {/* No country data state */}
            {!countryData && (
              <div className="text-center py-8 text-muted-foreground">
                <Crown className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Configure your country profile to access MyCountry® Premium</p>
              </div>
            )}
          </div>
        </motion.div>
      </AppleRippleEffect>
    </motion.div>
  );
}