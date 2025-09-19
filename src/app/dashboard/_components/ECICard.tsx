"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { 
  Gauge, TrendingUp, Globe, DollarSign, Users, Building2, ChevronUp, ChevronDown
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { CountryExecutiveSection } from "~/app/countries/_components/CountryExecutiveSection";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { createUrl } from "~/lib/url-utils";
import { cn } from "~/lib/utils";

interface CountryData {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
  populationTier: string;
  populationDensity?: number | null;
  landArea?: number | null;
}

interface ECICardProps {
  countryData?: CountryData;
  userProfile?: { countryId: string | null };
  userId?: string;
  isEciExpanded: boolean;
  toggleEciExpansion: () => void;
  focusedCard: string | null;
  setFocusedCard: (card: string | null) => void;
}

export function ECICard({
  countryData,
  userProfile,
  userId,
  isEciExpanded,
  toggleEciExpansion,
  focusedCard,
  setFocusedCard
}: ECICardProps) {
  return (
    <motion.div
      className={cn(
        "lg:col-span-6",
        "glass-hierarchy-parent relative overflow-hidden group cursor-pointer",
        "rounded-xl border border-neutral-200 dark:border-white/[0.2] transition-all duration-200",
        "hover:shadow-xl hover:shadow-indigo-500/10 dark:hover:shadow-indigo-400/20",
        focusedCard && focusedCard !== "eci" && "blur-sm scale-95 opacity-50"
      )}
      onClick={() => setFocusedCard(focusedCard === "eci" ? null : "eci")}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 40, delay: 0.2 }}
      layout
    >
      {/* Indigo glow overlay for ECI section theme */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/10 via-indigo-300/5 to-indigo-500/10 
                    rounded-xl animate-pulse pointer-events-none" style={{ animationDuration: '6s' }} />
      
      <div className="relative z-10 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Gauge className="h-6 w-6 text-indigo-400" />
            <div>
              <h3 className="text-xl font-bold text-foreground">Executive Command Interface</h3>
              <p className="text-sm text-muted-foreground">High-level executive tools for strategic governance</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="glass-hierarchy-interactive"
              onClick={(e) => {
                e.stopPropagation();
                window.open(createUrl("/eci"), "_blank");
              }}
            >
              → Open ECI
            </Button>
            
            {/* Expand Arrow */}
            <button 
              className="p-2 rounded-full glass-surface glass-interactive hover:glass-depth-2 transition-all duration-200"
              onClick={(e) => {
                e.stopPropagation();
                toggleEciExpansion();
              }}
            >
              {isEciExpanded ? (
                <ChevronUp className="h-5 w-5 text-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* ECI Preview - Always Visible with Live National Metrics */}
        {countryData ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 glass-hierarchy-child rounded-lg">
              <div className="text-2xl font-bold text-green-400 mb-2">
                {formatCurrency(countryData.currentGdpPerCapita || 0)}
              </div>
              <div className="text-sm text-muted-foreground">GDP per Capita</div>
              <Progress 
                value={Math.min(((countryData.currentGdpPerCapita || 0) / 100000) * 100, 100)} 
                className="mt-2 h-2" 
              />
            </div>
            <div className="text-center p-4 glass-hierarchy-child rounded-lg">
              <div className="text-2xl font-bold text-blue-400 mb-2">
                {formatPopulation(countryData.currentPopulation || 0)}
              </div>
              <div className="text-sm text-muted-foreground">Population</div>
              <Progress 
                value={Math.min(((countryData.currentPopulation || 0) / 1000000000) * 100, 100)} 
                className="mt-2 h-2" 
              />
            </div>
            <div className="text-center p-4 glass-hierarchy-child rounded-lg">
              <div className="text-2xl font-bold text-purple-400 mb-2">
                {countryData.populationDensity !== null && countryData.populationDensity !== undefined ? 
                  `${Math.round(countryData.populationDensity)}` : 
                  `${Math.round((countryData.currentPopulation || 0) / (countryData.landArea || 1000000))}`}
              </div>
              <div className="text-sm text-muted-foreground">Density/km²</div>
              <Progress 
                value={countryData.populationDensity !== null && countryData.populationDensity !== undefined ? 
                  Math.min((countryData.populationDensity / 1000) * 100, 100) : 
                  Math.min(((countryData.currentPopulation || 0) / (countryData.landArea || 1000000) / 1000) * 100, 100)} 
                className="mt-2 h-2" 
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 glass-hierarchy-child rounded-lg">
              <div className="text-2xl font-bold text-muted-foreground mb-2">--</div>
              <div className="text-sm text-muted-foreground">GDP per Capita</div>
              <Progress value={0} className="mt-2 h-2" />
            </div>
            <div className="text-center p-4 glass-hierarchy-child rounded-lg">
              <div className="text-2xl font-bold text-muted-foreground mb-2">--</div>
              <div className="text-sm text-muted-foreground">Population</div>
              <Progress value={0} className="mt-2 h-2" />
            </div>
            <div className="text-center p-4 glass-hierarchy-child rounded-lg">
              <div className="text-2xl font-bold text-muted-foreground mb-2">--</div>
              <div className="text-sm text-muted-foreground">Density/km²</div>
              <Progress value={0} className="mt-2 h-2" />
            </div>
          </div>
        )}

        {/* ECI Submodule Icons - Only show when not expanded */}
        {!isEciExpanded && (
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/mycountry#economy">
                  <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                    <TrendingUp className="h-4 w-4 text-green-400" />
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Economic Intelligence</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/countries">
                  <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                    <Globe className="h-4 w-4 text-blue-400" />
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Trade Analysis</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/mycountry#economy">
                  <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                    <DollarSign className="h-4 w-4 text-yellow-400" />
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Financial Metrics</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/mycountry#demographics">
                  <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                    <Users className="h-4 w-4 text-purple-400" />
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Population Analytics</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/mycountry#government">
                  <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                    <Building2 className="h-4 w-4 text-orange-400" />
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Infrastructure Status</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/mycountry#analytics">
                  <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                    <Gauge className="h-4 w-4 text-indigo-400" />
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Performance Gauge</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Expandable ECI Content */}
        <AnimatePresence>
          {isEciExpanded && userProfile?.countryId && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="mt-6 overflow-hidden"
            >
              <div className="glass-hierarchy-child p-6 rounded-lg">
                {userProfile.countryId && (
                  <CountryExecutiveSection countryId={userProfile.countryId} userId={userId || ''} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!userProfile?.countryId && (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">Configure your country profile to access the Executive Command Center</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}