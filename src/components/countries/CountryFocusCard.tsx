"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { HealthRing } from "~/components/ui/health-ring";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { TextReveal, FadeIn, CountUp } from "~/components/ui/text-reveal";
import { Spotlight } from "~/components/ui/spotlight-new";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { createUrl } from "~/lib/url-utils";
import { UsersIcon } from "~/components/ui/users";
import { TrendingUpIcon } from "~/components/ui/trending-up";
import { ActivityIcon } from "~/components/ui/activity";
import { LayersIcon } from "~/components/ui/layers";
import { 
  RiEyeLine, 
  RiBarChartLine, 
  RiMapPin2Line, 
  RiGlobalLine,
  RiArrowRightLine,
  RiStarLine,
  RiTrophyLine,
  RiShieldLine,
  RiMoneyDollarCircleLine,
  RiAwardLine
} from "react-icons/ri";

export interface CountryCardData {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
  populationTier: string;
  landArea?: number;
  populationDensity?: number;
  gdpDensity?: number;
  adjustedGdpGrowth?: number;
  populationGrowthRate?: number;
  flagUrl?: string;
}

interface CountryFocusCardProps {
  country: CountryCardData;
  index: number;
  hovered: number | null;
  setHovered: React.Dispatch<React.SetStateAction<number | null>>;
  expanded: number | null;
  setExpanded: React.Dispatch<React.SetStateAction<number | null>>;
  onCountryClick?: (countryId: string) => void;
  size?: 'default' | 'small';
}

export const CountryFocusCard = React.memo<CountryFocusCardProps>(({
  country,
  index,
  hovered,
  setHovered,
  expanded,
  setExpanded,
  onCountryClick
}) => {
  const isHovered = hovered === index;
  const isExpanded = expanded === index;
  const isOtherHovered = hovered !== null && hovered !== index;
  const isOtherExpanded = expanded !== null && expanded !== index;

  // Icon refs for controlling animations
  const usersIconRef = useRef<any>(null);
  const trendingIconRef = useRef<any>(null);
  const activityIconRef = useRef<any>(null);
  const layersIconRef = useRef<any>(null);

  // Calculate metrics for visual displays
  const economicScore = Math.min(100, (country.currentGdpPerCapita / 50000) * 100);
  const populationScore = Math.min(100, Math.max(0, ((country.populationGrowthRate || 0) * 100 + 2) * 25));
  const developmentScore = 
    country.economicTier === "Extravagant" ? 100 :
    country.economicTier === "Very Strong" ? 85 :
    country.economicTier === "Strong" ? 70 :
    country.economicTier === "Healthy" ? 55 :
    country.economicTier === "Developed" ? 40 :
    country.economicTier === "Developing" ? 25 : 10;

  const handleCardClick = () => {
    if (isExpanded) {
      setExpanded(null);
    } else {
      setExpanded(index);
    }
  };

  const handleCountryVisit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCountryClick?.(country.id);
  };

  return (
    <motion.div
      layout
      className={cn(
        "relative cursor-pointer country-focus-card",
        isOtherHovered && !isExpanded && "transition-all duration-300"
      )}
      onMouseEnter={() => {
        setHovered(index);
        // Trigger icon animations when hovering
        usersIconRef.current?.startAnimation();
        trendingIconRef.current?.startAnimation();
        activityIconRef.current?.startAnimation();
        layersIconRef.current?.startAnimation();
      }}
      onMouseLeave={() => {
        setHovered(null);
        // Stop icon animations when leaving
        usersIconRef.current?.stopAnimation();
        trendingIconRef.current?.stopAnimation();
        activityIconRef.current?.stopAnimation();
        layersIconRef.current?.stopAnimation();
      }}
      onClick={handleCardClick}
      animate={{
        scale: isOtherHovered && !isExpanded ? 0.95 : 1,
        opacity: isOtherExpanded ? 0.7 : 1,
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 25
      }}
    >
      <div
        className={cn(
          "relative glass-floating glass-refraction glass-interactive overflow-hidden transition-all duration-500 ease-out",
          isExpanded ? "h-auto min-h-[600px]" : "h-60 md:h-96",
          isOtherHovered && !isExpanded && "blur-sm scale-[0.98]"
        )}
        style={{
          height: isExpanded ? 'auto' : undefined,
          minHeight: isExpanded ? '600px' : undefined
        }}
      >
        {/* Animated Flag Background */}
        {/* Flag Background */}
        {country.flagUrl ? (
          <img
            src={country.flagUrl}
            alt={`${country.name} flag`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20" />
        )}

        {/* Content Overlay */}
        <div 
          className={cn(
            "absolute inset-0 bg-black/50 flex flex-col justify-end p-6 transition-opacity duration-300",
            (isHovered || isExpanded) ? "opacity-100" : "opacity-0"
          )}
        >
          {/* Basic Info */}
          <div className="space-y-4">
            <motion.div
              animate={{
                scale: isHovered ? 1.05 : 1,
              }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <TextReveal 
                className="text-xl md:text-2xl font-medium text-white [text-shadow:0_0_10px_rgba(255,255,255,0.3)] antialiased"
                delay={0.1}
              >
                {country.name}
              </TextReveal>
            </motion.div>
            
            <FadeIn direction="up" delay={0.2} className="flex items-center gap-2 text-white/90 text-sm font-medium [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">
              <RiGlobalLine className="h-4 w-4 drop-shadow-sm" />
              <span>{country.economicTier}</span>
              <span>•</span>
              <span>{formatPopulation(country.currentPopulation)}</span>
            </FadeIn>

            {/* Quick Stats */}
            <AnimatePresence>
              {isHovered && !isExpanded && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3 mt-4 p-4 bg-black/20 backdrop-blur-sm rounded-lg border border-white/10"
                >
                  <FadeIn direction="left" delay={0.1} className="flex items-center justify-between text-white/90 text-sm">
                    <div className="flex items-center gap-2">
                      <UsersIcon ref={usersIconRef} size={16} className="text-blue-400" />
                      <span className="font-medium [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">Population</span>
                    </div>
                    <NumberFlowDisplay 
                      value={country.currentPopulation}
                      format="population"
                      className="font-semibold [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased"
                    />
                  </FadeIn>
                  
                  <FadeIn direction="left" delay={0.2} className="flex items-center justify-between text-white/90 text-sm">
                    <div className="flex items-center gap-2">
                      <RiMoneyDollarCircleLine className="h-4 w-4 text-green-400 drop-shadow-sm" />
                      <span className="font-medium [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">GDP per Capita</span>
                    </div>
                    <NumberFlowDisplay 
                      value={country.currentGdpPerCapita}
                      format="currency"
                      className="font-semibold [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased"
                    />
                  </FadeIn>
                  
                  <FadeIn direction="left" delay={0.3} className="flex items-center justify-between text-white/90 text-sm">
                    <div className="flex items-center gap-2">
                      <RiGlobalLine className="h-4 w-4 text-purple-400 drop-shadow-sm" />
                      <span className="font-medium [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">Total GDP</span>
                    </div>
                    <NumberFlowDisplay 
                      value={country.currentTotalGdp}
                      format="currency"
                      decimalPlaces={1}
                      className="font-semibold [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased"
                    />
                  </FadeIn>
                  
                  {country.adjustedGdpGrowth && (
                    <FadeIn direction="left" delay={0.4} className="flex items-center justify-between text-white/90 text-sm">
                      <div className="flex items-center gap-2">
                        <TrendingUpIcon ref={trendingIconRef} size={16} className="text-emerald-400" />
                        <span className="font-medium [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">Growth Rate</span>
                      </div>
                      <NumberFlowDisplay 
                        value={country.adjustedGdpGrowth * 100}
                        format="percentage"
                        decimalPlaces={1}
                        trend="up"
                        className="font-semibold text-emerald-400 [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased"
                      />
                    </FadeIn>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Buttons */}
            <AnimatePresence>
              {isHovered && !isExpanded && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex gap-2 mt-4"
                >
                  <button
                    onClick={handleCountryVisit}
                    className="flex-1 flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors backdrop-blur-sm"
                  >
                    <RiEyeLine className="h-4 w-4" />
                    <span className="text-sm font-medium">View</span>
                  </button>
                  <button className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg transition-colors backdrop-blur-sm">
                    <RiStarLine className="h-4 w-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Always Visible Country Name - Enhanced */}
        <AnimatePresence>
          {!isExpanded && !isHovered && (
            <motion.div 
              className="absolute bottom-4 left-4 right-4"
              initial={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div 
                className="text-xl md:text-2xl font-medium text-white [text-shadow:0_0_15px_rgba(255,255,255,0.4)] antialiased"
                animate={{
                  textShadow: "0 0 15px rgba(255,255,255,0.4)"
                }}
                transition={{ duration: 0.3 }}
              >
                {country.name}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="absolute inset-x-0 bottom-0 overflow-hidden"
            >
              <div className="glass-overlay glass-refraction border-t border-white/20 relative overflow-hidden">
                <AnimatePresence>
                  {isExpanded && (
                    <Spotlight
                      gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(220, 100%, 85%, .12) 0, hsla(220, 100%, 65%, .04) 50%, hsla(220, 100%, 55%, 0) 80%)"
                      gradientSecond="radial-gradient(50% 50% at 50% 50%, hsla(200, 100%, 85%, .08) 0, hsla(200, 100%, 65%, .03) 80%, transparent 100%)"
                      gradientThird="radial-gradient(50% 50% at 50% 50%, hsla(240, 100%, 85%, .06) 0, hsla(240, 100%, 55%, .02) 80%, transparent 100%)"
                      translateY={-200}
                      width={300}
                      height={600}
                      smallWidth={120}
                      duration={12}
                      xOffset={50}
                    />
                  )}
                </AnimatePresence>
                <div className="p-6 space-y-6 relative z-10">
                  {/* Activity Dashboard */}
                  <FadeIn direction="up" delay={0.1}>
                    <TextReveal 
                      className="text-lg font-semibold text-white/95 mb-4 [text-shadow:0_0_10px_rgba(255,255,255,0.3)] antialiased"
                    >
                      Executive Dashboard
                    </TextReveal>
                  </FadeIn>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <FadeIn direction="up" delay={0.2} className="text-center">
                      <div className="relative">
                        <HealthRing
                          value={economicScore}
                          size={60}
                          color="rgba(34, 197, 94, 0.8)"
                          label=""
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <RiMoneyDollarCircleLine className="h-5 w-5 text-green-400 drop-shadow-lg" />
                        </div>
                      </div>
                      <div className="text-white/90 text-xs mt-2 font-medium [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">
                        Economic Health
                      </div>
                      <div className="text-white/70 text-xs [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">
                        <NumberFlowDisplay 
                          value={economicScore}
                          format="percentage"
                          decimalPlaces={0}
                          className=""
                        />
                      </div>
                    </FadeIn>
                    
                    <FadeIn direction="up" delay={0.3} className="text-center">
                      <div className="relative">
                        <HealthRing
                          value={populationScore}
                          size={60}
                          color="rgba(59, 130, 246, 0.8)"
                          label=""
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <TrendingUpIcon ref={trendingIconRef} size={20} className="text-blue-400" />
                        </div>
                      </div>
                      <div className="text-white/90 text-xs mt-2 font-medium [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">
                        Growth Rate
                      </div>
                      <div className="text-white/70 text-xs [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">
                        {country.adjustedGdpGrowth ? (
                          <NumberFlowDisplay 
                            value={country.adjustedGdpGrowth * 100}
                            format="percentage"
                            decimalPlaces={1}
                            className=""
                          />
                        ) : 'N/A'}
                      </div>
                    </FadeIn>
                    
                    <FadeIn direction="up" delay={0.4} className="text-center">
                      <div className="relative">
                        <HealthRing
                          value={developmentScore}
                          size={60}
                          color="rgba(168, 85, 247, 0.8)"
                          label=""
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ActivityIcon ref={activityIconRef} size={20} className="text-purple-400" />
                        </div>
                      </div>
                      <div className="text-white/90 text-xs mt-2 font-medium [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">
                        Development Index
                      </div>
                      <div className="text-white/70 text-xs [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">
                        <NumberFlowDisplay 
                          value={developmentScore}
                          format="percentage"
                          decimalPlaces={0}
                          className=""
                        />
                      </div>
                    </FadeIn>
                  </div>

                  {/* Detailed Stats Grid */}
                  <div className="grid grid-cols-2 gap-6">
                    <FadeIn direction="left" delay={0.5} className="space-y-4">
                      <div className="flex items-center gap-2 text-white/95">
                        <RiMapPin2Line className="h-5 w-5 text-orange-400 drop-shadow-sm" />
                        <span className="text-sm font-semibold [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">Geography</span>
                      </div>
                      <div className="space-y-3 pl-2">
                        {country.landArea && (
                          <div className="flex justify-between text-white/85 text-sm">
                            <span className="[text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">Land Area</span>
                            <span className="font-medium [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">
                              <NumberFlowDisplay 
                                value={country.landArea}
                                suffix=" km²"
                                className=""
                              />
                            </span>
                          </div>
                        )}
                        {country.populationDensity && (
                          <div className="flex justify-between text-white/85 text-sm">
                            <span className="[text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">Population Density</span>
                            <span className="font-medium [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">
                              <NumberFlowDisplay 
                                value={Math.round(country.populationDensity)}
                                suffix="/km²"
                                className=""
                              />
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-white/85 text-sm">
                          <span className="[text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">Population Tier</span>
                          <div className="flex items-center gap-1">
                            <LayersIcon ref={layersIconRef} size={14} className="text-cyan-400" />
                            <span className="font-medium [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">
                              {country.populationTier}
                            </span>
                          </div>
                        </div>
                      </div>
                    </FadeIn>

                    <FadeIn direction="right" delay={0.6} className="space-y-4">
                      <div className="flex items-center gap-2 text-white/95">
                        <RiBarChartLine className="h-5 w-5 text-blue-400 drop-shadow-sm" />
                        <span className="text-sm font-semibold [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">Economics</span>
                      </div>
                      <div className="space-y-3 pl-2">
                        {country.gdpDensity && (
                          <div className="flex justify-between text-white/85 text-sm">
                            <span className="[text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">GDP Density</span>
                            <span className="font-medium [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">
                              <NumberFlowDisplay 
                                value={country.gdpDensity / 1e6}
                                prefix="$"
                                suffix="M/km²"
                                decimalPlaces={1}
                                className=""
                              />
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-white/85 text-sm">
                          <span className="[text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">Economic Tier</span>
                          <div className="flex items-center gap-1">
                            <RiAwardLine className="h-3 w-3 text-yellow-400 drop-shadow-sm" />
                            <span className="font-medium [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">
                              {country.economicTier}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between text-white/85 text-sm">
                          <span className="[text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">Global Ranking</span>
                          <span className="flex items-center gap-1">
                            <RiTrophyLine className="h-3 w-3 text-amber-400 drop-shadow-sm" />
                            <span className="font-medium text-amber-400 [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased">
                              Elite Tier
                            </span>
                          </span>
                        </div>
                      </div>
                    </FadeIn>
                  </div>

                  {/* Action Bar */}
                  <FadeIn direction="up" delay={0.7} className="pt-4 border-t border-white/10">
                    <div className="flex gap-3">
                      <motion.button
                        onClick={handleCountryVisit}
                        className="flex-1 flex items-center justify-center gap-2 glass-floating glass-interactive bg-blue-500/20 hover:bg-blue-500/30 text-white px-4 py-3 rounded-lg font-medium [text-shadow:0_0_8px_rgba(0,0,0,0.8)] antialiased"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <RiEyeLine className="h-4 w-4" />
                        View Country Details
                        <RiArrowRightLine className="h-4 w-4" />
                      </motion.button>
                      <motion.button 
                        className="flex items-center justify-center gap-2 glass-surface glass-interactive bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-lg transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <RiStarLine className="h-4 w-4" />
                      </motion.button>
                      <motion.button 
                        className="flex items-center justify-center gap-2 glass-surface glass-interactive bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-lg transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <RiShieldLine className="h-4 w-4" />
                      </motion.button>
                    </div>
                  </FadeIn>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

CountryFocusCard.displayName = "CountryFocusCard";