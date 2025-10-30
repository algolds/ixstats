"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  ChevronLeft,
  Calendar,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Building2,
  Zap,
  Globe,
  Flag,
  Crown,
  Heart,
  Shield,
  Activity,
  CheckCircle,
  AlertTriangle,
  Clock,
  Target,
  Rocket,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { GlassCard, GlassCardContent, GlassCardHeader } from "../glass/GlassCard";
import { GlassTooltip } from "../glass/GlassTooltip";
import { Button } from "~/components/ui/button";
import { BuilderVitalityRings } from "../BuilderVitalityRings";
import { useBuilderTheming } from "~/hooks/useBuilderTheming";
import { withBasePath } from "~/lib/base-path";
import type { EconomicInputs, RealCountryData } from "../../lib/economy-data-service";
import type { ExtractedColors } from "~/lib/image-color-extractor";
import type { BuilderStyle, BuilderMode } from "../glass/BuilderStyleToggle";
import { EnhancedCountryFlag } from "~/components/ui/enhanced-country-flag";

// Placeholder for MyCountryLogo (assuming it's an image or simple text)
const MyCountryLogo = () => (
  <img src={withBasePath("/images/ix-logo.svg")} alt="MyCountry Logo" className="h-8 w-auto" />
);

// Placeholder for SectionHeader (assuming it's a simple text)
const SectionHeader = ({ text }: { text: string }) => (
  <h1 className="text-3xl font-bold text-white">{text}</h1>
);

interface InteractivePreviewProps {
  inputs: EconomicInputs;
  referenceCountry: RealCountryData;
  allCountries: RealCountryData[];
  onBack: () => void;
  onConfirm: () => void;
  isCreating: boolean;
  hoveredCountryId?: string | null;
  extractedColors?: ExtractedColors | null;
  builderStyle?: BuilderStyle;
  builderMode?: BuilderMode;
}

interface TimePoint {
  year: number;
  month: number;
  gdp: number;
  population: number;
  stability: number;
  happiness: number;
  events: string[];
}

interface NationalMetric {
  id: string;
  name: string;
  value: number;
  change: number;
  trend: "up" | "down" | "stable";
  icon: React.ElementType;
  color: string;
  description: string;
}

export function InteractivePreview({
  inputs,
  referenceCountry,
  allCountries,
  onBack,
  onConfirm,
  isCreating,
  extractedColors,
}: InteractivePreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [timelineData, setTimelineData] = useState<TimePoint[]>([]);
  const [nationalMetrics, setNationalMetrics] = useState<NationalMetric[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generate timeline projections
  useEffect(() => {
    const generateTimeline = (): TimePoint[] => {
      const timeline: TimePoint[] = [];
      const monthsToProject = 24; // 2 years

      let currentGdp = inputs.coreIndicators.totalPopulation * inputs.coreIndicators.gdpPerCapita;
      let currentPopulation = inputs.coreIndicators.totalPopulation;
      let baseStability = 75;
      let baseHappiness = 70;

      for (let month = 0; month <= monthsToProject; month++) {
        const year = Math.floor(month / 12);
        const monthInYear = month % 12;

        // Apply growth and changes over time
        const growthFactor = 1 + inputs.coreIndicators.realGDPGrowthRate / 100 / 12;
        const populationGrowthFactor = 1 + 0.8 / 100 / 12; // 0.8% annual pop growth

        currentGdp *= growthFactor;
        currentPopulation *= populationGrowthFactor;

        // Stability factors
        const unemploymentImpact = Math.max(0, 100 - inputs.laborEmployment.unemploymentRate * 2);
        const fiscalImpact = Math.max(0, 100 - inputs.fiscalSystem.totalDebtGDPRatio / 2);
        const stabilityTrend = (unemploymentImpact + fiscalImpact) / 2;

        baseStability = Math.max(
          0,
          Math.min(100, baseStability + (stabilityTrend - baseStability) * 0.1)
        );
        baseHappiness = Math.max(
          0,
          Math.min(100, baseHappiness + (baseStability - baseHappiness) * 0.05)
        );

        const events = [];

        // Generate events based on economic conditions
        if (month === 6 && inputs.coreIndicators.realGDPGrowthRate > 5) {
          events.push("Economic boom drives infrastructure expansion");
        }
        if (month === 12 && inputs.laborEmployment.unemploymentRate < 5) {
          events.push("Full employment achieved - labor market tightens");
        }
        if (month === 18 && inputs.fiscalSystem.totalDebtGDPRatio < 60) {
          events.push("Strong fiscal position attracts foreign investment");
        }

        timeline.push({
          year,
          month: monthInYear,
          gdp: currentGdp,
          population: currentPopulation,
          stability: baseStability,
          happiness: baseHappiness,
          events,
        });
      }

      return timeline;
    };

    setTimelineData(generateTimeline());
  }, [inputs]);

  // Calculate national metrics
  useEffect(() => {
    if (timelineData.length === 0) return; // Ensure timelineData is not empty

    const currentPoint = timelineData[currentTime] || timelineData[0];
    if (!currentPoint) {
      console.warn("currentPoint is undefined, skipping national metrics calculation.");
      return;
    }

    const metrics: NationalMetric[] = [
      {
        id: "gdp-total",
        name: "Total GDP",
        value: currentPoint!.gdp,
        change:
          currentTime > 0 && timelineData[0]?.gdp !== undefined
            ? ((currentPoint.gdp - timelineData[0].gdp) / timelineData[0].gdp) * 100
            : 0,
        trend:
          currentTime > 0 &&
          currentPoint!.gdp > (timelineData[Math.max(0, currentTime - 1)]?.gdp || 0)
            ? "up"
            : "down",
        icon: DollarSign,
        color: "text-emerald-400",
        description: "Total economic output",
      },
      {
        id: "population",
        name: "Population",
        value: currentPoint!.population,
        change:
          currentTime > 0 && timelineData[0]?.population !== undefined
            ? ((currentPoint.population - timelineData[0].population) /
                timelineData[0].population) *
              100
            : 0,
        trend: "up",
        icon: Users,
        color: "text-blue-400",
        description: "Total citizens",
      },
      {
        id: "stability",
        name: "Stability Index",
        value: currentPoint!.stability,
        change:
          currentTime > 0 && timelineData[0]?.stability !== undefined
            ? currentPoint.stability - timelineData[0].stability
            : 0,
        trend:
          currentTime > 0
            ? currentPoint.stability > (timelineData[Math.max(0, currentTime - 1)]?.stability ?? 0)
              ? "up"
              : "down"
            : "stable",
        icon: Shield,
        color: "text-purple-400",
        description: "Political and economic stability",
      },
      {
        id: "happiness",
        name: "Citizen Wellbeing",
        value: currentPoint!.happiness,
        change:
          currentTime > 0 && timelineData[0]?.happiness !== undefined
            ? currentPoint.happiness - timelineData[0].happiness
            : 0,
        trend:
          currentTime > 0
            ? currentPoint!.happiness > (timelineData[Math.max(0, currentTime - 1)]?.happiness || 0)
              ? "up"
              : "down"
            : "stable",
        icon: Heart,
        color: "text-pink-400",
        description: "Overall citizen satisfaction",
      },
    ];

    setNationalMetrics(metrics);
  }, [currentTime, timelineData]);

  // Animation control
  useEffect(() => {
    if (isPlaying && currentTime < timelineData.length - 1) {
      intervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= timelineData.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 500 / playbackSpeed);
    } else {
      clearInterval(intervalRef.current as unknown as number | undefined);
    }

    return () => clearInterval(intervalRef.current as unknown as number | undefined);
  }, [isPlaying, currentTime, timelineData.length, playbackSpeed]);

  const formatValue = (value: number, metric: NationalMetric): string => {
    if (metric.id === "gdp-total") {
      if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
      if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
      if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
      return `${(value / 1e3).toFixed(0)}K`;
    }
    if (metric.id === "population") {
      if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
      if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
      return value.toFixed(0);
    }
    return value.toFixed(1);
  };

  const getCurrentTimeData = () => timelineData[currentTime] || timelineData[0];
  const currentData = getCurrentTimeData();

  const togglePlayback = () => setIsPlaying(!isPlaying);
  const resetTimeline = () => {
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const getTrendIcon = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return TrendingUp;
      case "down":
        return TrendingDown;
      default:
        return Activity;
    }
  };

  const getTrendColor = (trend: "up" | "down" | "stable", change: number) => {
    if (trend === "stable") return "text-gray-400";
    return change > 0 ? "text-emerald-400" : "text-red-400";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "relative mb-8 overflow-hidden rounded-lg p-6",
            "flex items-center justify-between" // Keep existing flex properties
          )}
          style={{
            backgroundImage: referenceCountry
              ? `url(/public/flags/${referenceCountry.name.toLowerCase().replace(/ /g, "-")}.svg)`
              : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Overlay for blur effect */}
          <div className="absolute inset-0 z-0 bg-black/50 backdrop-blur-md backdrop-filter" />

          <div className="relative z-10 flex items-center gap-4">
            <Button
              onClick={onBack}
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Customize
            </Button>
            {referenceCountry ? (
              <div className="flex items-center gap-4">
                <EnhancedCountryFlag
                  countryName={referenceCountry.name}
                  size="lg"
                  hoverBlur={false}
                  priority={true}
                />
                <h2 className="text-3xl font-bold text-white">{inputs.countryName}</h2>
              </div>
            ) : (
              <div>
                <MyCountryLogo />
                <SectionHeader text="Preview your nation's projected development over the next 2 years" />
              </div>
            )}
          </div>
          <div className="relative z-10 flex items-center gap-3">
            <Button
              onClick={() => setShowComparison(!showComparison)}
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Compare
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isCreating}
              className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 disabled:opacity-50"
            >
              {isCreating ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creating Nation...
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-4 w-4" />
                  Launch Nation
                </>
              )}
            </Button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Timeline */}
          <div className="space-y-6 lg:col-span-2">
            {/* Time Controls */}
            <GlassCard depth="elevated" blur="medium">
              <GlassCardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-blue-400" />
                      <span className="font-medium text-white">
                        Year {currentData?.year || 0}, Month {(currentData?.month || 0) + 1}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={resetTimeline}
                        variant="outline"
                        size="sm"
                        className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={togglePlayback}
                        variant="outline"
                        size="sm"
                        className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                      >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button
                        onClick={() =>
                          setPlaybackSpeed(playbackSpeed === 1 ? 2 : playbackSpeed === 2 ? 4 : 1)
                        }
                        variant="outline"
                        size="sm"
                        className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                      >
                        <FastForward className="h-4 w-4" />
                        {playbackSpeed}x
                      </Button>
                    </div>
                  </div>

                  {/* Timeline Scrubber */}
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="range"
                        min={0}
                        max={timelineData.length - 1}
                        value={currentTime}
                        onChange={(e) => setCurrentTime(Number(e.target.value))}
                        className="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/20"
                      />
                      <div
                        className="absolute top-0 left-0 h-2 rounded-lg bg-gradient-to-r from-blue-400 to-purple-400 transition-all duration-300"
                        style={{ width: `${(currentTime / (timelineData.length - 1)) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-white/60">
                      <span>Start</span>
                      <span>Year 1</span>
                      <span>Year 2</span>
                    </div>
                  </div>
                </div>
              </GlassCardContent>
            </GlassCard>

            {/* Live Preview Dashboard with Vitality Rings */}
            <GlassCard depth="elevated" blur="medium">
              <GlassCardHeader>
                <div className="flex items-center gap-2">
                  <Activity className="h-6 w-6 text-blue-400" />
                  <h3 className="text-xl font-semibold text-white">Live Preview Dashboard</h3>
                </div>
                <p className="mt-1 text-sm text-white/60">
                  Real-time vitality monitoring with momentum visualization
                </p>
              </GlassCardHeader>
              <GlassCardContent>
                <BuilderVitalityRings
                  economicInputs={inputs}
                  extractedColors={extractedColors}
                  flagUrl={inputs.flagUrl}
                  coatOfArmsUrl={inputs.coatOfArmsUrl}
                  onRingClick={(index) => {
                    // Handle ring click to show detailed breakdown
                    console.log(`Clicked vitality ring ${index}`);
                  }}
                  showMomentum={true}
                  className="bg-transparent"
                />
              </GlassCardContent>
            </GlassCard>

            {/* Timeline Events */}
            {currentData?.events && currentData.events.length > 0 && (
              <GlassCard depth="elevated" blur="medium" theme="gold">
                <GlassCardHeader>
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-300" />
                    <h3 className="font-semibold text-white">Current Events</h3>
                  </div>
                </GlassCardHeader>
                <GlassCardContent>
                  <div className="space-y-2">
                    {currentData.events.map((event, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-3 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3"
                      >
                        <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
                        <p className="text-sm text-amber-200">{event}</p>
                      </motion.div>
                    ))}
                  </div>
                </GlassCardContent>
              </GlassCard>
            )}
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            {/* Nation Summary */}
            <GlassCard depth="modal" blur="heavy">
              <GlassCardHeader>
                <div className="flex items-center gap-2">
                  <Crown className="text-gold-400 h-5 w-5" />
                  <h3 className="font-semibold text-white">Nation Summary</h3>
                </div>
              </GlassCardHeader>
              <GlassCardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-12 w-16 items-center justify-center rounded-md bg-gradient-to-r from-blue-500 to-purple-500">
                      <Flag className="h-6 w-6 text-white" />
                    </div>
                    <h4 className="text-lg font-bold text-white">{inputs.countryName}</h4>
                    <p className="text-sm text-white/60">Founded in {new Date().getFullYear()}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-white/60">Economic Tier:</span>
                      <div className="font-medium text-white">Developing</div>
                    </div>
                    <div>
                      <span className="text-white/60">Government:</span>
                      <div className="font-medium text-white">Democratic</div>
                    </div>
                    <div>
                      <span className="text-white/60">Foundation:</span>
                      <div className="font-medium text-white">{referenceCountry.name}</div>
                    </div>
                    <div>
                      <span className="text-white/60">Launch Ready:</span>
                      <div className="flex items-center gap-1 font-medium text-emerald-400">
                        <CheckCircle className="h-3 w-3" />
                        Yes
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCardContent>
            </GlassCard>

            {/* Projection Confidence */}
            <GlassCard depth="base" blur="light">
              <GlassCardContent>
                <div className="text-center">
                  <Target className="mx-auto mb-3 h-8 w-8 text-blue-400" />
                  <h4 className="mb-2 font-semibold text-white">Projection Confidence</h4>
                  <div className="mb-1 text-2xl font-bold text-emerald-400">87%</div>
                  <p className="text-sm text-white/60">
                    Based on historical data from {allCountries.length} countries
                  </p>
                </div>
              </GlassCardContent>
            </GlassCard>

            {/* Quick Actions */}
            <GlassCard depth="base" blur="light">
              <GlassCardContent>
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-white">Quick Actions</h4>
                  <div className="space-y-2">
                    <Button
                      onClick={() => setCurrentTime(6)}
                      variant="outline"
                      size="sm"
                      className="w-full border-white/20 bg-white/10 text-white hover:bg-white/20"
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      Jump to 6 Months
                    </Button>
                    <Button
                      onClick={() => setCurrentTime(12)}
                      variant="outline"
                      size="sm"
                      className="w-full border-white/20 bg-white/10 text-white hover:bg-white/20"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Jump to Year 1
                    </Button>
                    <Button
                      onClick={() => setCurrentTime(timelineData.length - 1)}
                      variant="outline"
                      size="sm"
                      className="w-full border-white/20 bg-white/10 text-white hover:bg-white/20"
                    >
                      <Target className="mr-2 h-4 w-4" />
                      View Final Results
                    </Button>
                  </div>
                </div>
              </GlassCardContent>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
