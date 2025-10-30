"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { HealthRing } from "~/components/ui/health-ring";
import { Badge } from "~/components/ui/badge";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import {
  TrendingUp,
  Users,
  DollarSign,
  Shield,
  Target,
  Activity,
  Crown,
  Zap,
  Flag,
} from "lucide-react";
import { cn } from "~/lib/utils";
import type { EconomicInputs } from "../lib/economy-data-service";
import type { ExtractedColors } from "~/lib/image-color-extractor";

interface BuilderVitalityRingsProps {
  economicInputs: EconomicInputs;
  extractedColors?: ExtractedColors | null;
  flagUrl?: string;
  coatOfArmsUrl?: string;
  onRingClick?: (ringIndex: number) => void;
  className?: string;
  compact?: boolean;
  showMomentum?: boolean;
}

export const BuilderVitalityRings: React.FC<BuilderVitalityRingsProps> = ({
  economicInputs,
  extractedColors,
  flagUrl,
  coatOfArmsUrl,
  onRingClick,
  className,
  compact = false,
  showMomentum = true,
}) => {
  const [prevMetrics, setPrevMetrics] = useState<any>(null);
  const [momentum, setMomentum] = useState({ economic: 0, social: 0, government: 0 });

  // Calculate health scores from economic inputs
  const economicHealth = Math.min(100, (economicInputs.coreIndicators.gdpPerCapita / 50000) * 100);
  const socialHealth = Math.min(
    100,
    Math.max(0, (economicInputs.demographics.populationGrowthRate + 2) * 25)
  );
  const governmentHealth = Math.min(
    100,
    (economicInputs.fiscalSystem.taxRevenueGDPPercent / 30) * 100
  );

  // Calculate momentum (rate of change)
  useEffect(() => {
    if (prevMetrics && showMomentum) {
      const economicMomentum = economicHealth - prevMetrics.economic;
      const socialMomentum = socialHealth - prevMetrics.social;
      const governmentMomentum = governmentHealth - prevMetrics.government;

      setMomentum({
        economic: economicMomentum,
        social: socialMomentum,
        government: governmentMomentum,
      });
    }

    setPrevMetrics({
      economic: economicHealth,
      social: socialHealth,
      government: governmentHealth,
    });
  }, [economicHealth, socialHealth, governmentHealth, showMomentum]);

  // Use extracted colors or fallback to defaults
  const colors = extractedColors || {
    primary: "#10b981",
    secondary: "#3b82f6",
    accent: "#8b5cf6",
  };

  const rings = [
    {
      id: "economic",
      label: "Economic Vitality",
      icon: <DollarSign className="h-5 w-5" />,
      value: economicHealth,
      color: colors.primary,
      metric: formatCurrency(economicInputs.coreIndicators.gdpPerCapita),
      subtitle: "GDP per Capita",
      description: "Economic strength and prosperity indicator",
      momentum: momentum.economic,
      badge:
        economicHealth > 80
          ? "Excellent"
          : economicHealth > 60
            ? "Strong"
            : economicHealth > 40
              ? "Moderate"
              : "Developing",
      badgeVariant:
        economicHealth > 80
          ? "default"
          : economicHealth > 60
            ? "secondary"
            : economicHealth > 40
              ? "outline"
              : "destructive",
    },
    {
      id: "social",
      label: "Social Vitality",
      icon: <Users className="h-5 w-5" />,
      value: socialHealth,
      color: colors.secondary,
      metric: formatPopulation(economicInputs.coreIndicators.totalPopulation),
      subtitle: "Population",
      description: "Social stability and demographic health",
      momentum: momentum.social,
      badge:
        socialHealth > 75
          ? "Thriving"
          : socialHealth > 50
            ? "Stable"
            : socialHealth > 25
              ? "Growing"
              : "Emerging",
      badgeVariant: "outline" as const,
    },
    {
      id: "government",
      label: "Government Vitality",
      icon: <Shield className="h-5 w-5" />,
      value: governmentHealth,
      color: colors.accent,
      metric: `${economicInputs.fiscalSystem.taxRevenueGDPPercent.toFixed(1)}%`,
      subtitle: "Tax Revenue",
      description: "Government efficiency and fiscal health",
      momentum: momentum.government,
      badge:
        governmentHealth > 80
          ? "Efficient"
          : governmentHealth > 60
            ? "Balanced"
            : governmentHealth > 40
              ? "Adequate"
              : "Strained",
      badgeVariant: "secondary" as const,
    },
  ];

  // Calculate momentum rotation speed (degrees per second)
  const getMomentumRotation = (momentum: number) => {
    return Math.abs(momentum) * 10; // 10 degrees per momentum point
  };

  if (compact) {
    return (
      <div className={cn("space-y-4", className)}>
        {/* Country Header */}
        <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
          {flagUrl && (
            <div className="h-6 w-8 flex-shrink-0 overflow-hidden rounded border border-white/20">
              <img src={flagUrl} alt="Flag" className="h-full w-full object-cover" />
            </div>
          )}
        </div>

        {/* Compact Rings Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
          {rings.map((ring, index) => (
            <motion.div
              key={ring.id}
              className="group flex min-h-[44px] cursor-pointer touch-manipulation flex-col items-center rounded-lg bg-white/5 p-4 transition-all duration-200 hover:bg-white/10 md:p-3"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onRingClick?.(index)}
            >
              <div className="relative mb-2">
                <motion.div
                  animate={
                    showMomentum
                      ? {
                          rotate: ring.momentum !== 0 ? [0, getMomentumRotation(ring.momentum)] : 0,
                        }
                      : {}
                  }
                  transition={{
                    duration: 2,
                    repeat: ring.momentum !== 0 ? Infinity : 0,
                    ease: "linear",
                  }}
                >
                  <HealthRing
                    value={ring.value}
                    size={50}
                    color={ring.color}
                    label={ring.label}
                    tooltip={`${ring.description} (Momentum: ${ring.momentum > 0 ? "+" : ""}${ring.momentum.toFixed(1)})`}
                    isClickable={true}
                    className="transition-all duration-200 group-hover:drop-shadow-lg"
                  />
                </motion.div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    style={{ color: ring.color }}
                    className="opacity-80 transition-opacity group-hover:opacity-100"
                  >
                    {ring.icon}
                  </div>
                </div>
              </div>
              <span className="text-foreground text-center text-xs font-medium">
                {ring.label.split(" ")[0]}
              </span>
              <span className="text-muted-foreground w-full truncate text-center text-xs">
                {ring.metric}
              </span>
              {/* Momentum Indicator */}
              {showMomentum && ring.momentum !== 0 && (
                <div
                  className={cn(
                    "mt-1 flex items-center gap-1 text-xs font-medium",
                    ring.momentum > 0 ? "text-green-400" : "text-red-400"
                  )}
                >
                  {ring.momentum > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <Activity className="h-3 w-3" />
                  )}
                  {Math.abs(ring.momentum).toFixed(1)}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Country Header with Symbols */}
      <div className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-6">
        <div className="flex gap-2">
          {flagUrl && (
            <div className="h-8 w-12 overflow-hidden rounded border border-white/20">
              <img src={flagUrl} alt="Flag" className="h-full w-full object-cover" />
            </div>
          )}
          {coatOfArmsUrl && (
            <div className="h-8 w-8 overflow-hidden rounded border border-white/20">
              <img src={coatOfArmsUrl} alt="Coat of Arms" className="h-full w-full object-cover" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white">{economicInputs.countryName}</h2>
          <p className="text-white/60">Live Economic Dashboard</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">
            {Math.round((economicHealth + socialHealth + governmentHealth) / 3)}%
          </div>
          <p className="text-sm text-white/60">Overall Vitality</p>
        </div>
      </div>

      {/* Individual Vitality Rings */}
      <div className="space-y-4">
        {rings.map((ring, index) => (
          <motion.div
            key={ring.id}
            className="group flex cursor-pointer items-center gap-4 rounded-lg bg-white/5 p-4 transition-all duration-200 hover:bg-white/10"
            whileHover={{ scale: 1.01, y: -1 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onRingClick?.(index)}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
          >
            {/* Vitality Ring with Momentum */}
            <div className="relative flex-shrink-0">
              <motion.div
                animate={
                  showMomentum
                    ? {
                        rotate: ring.momentum !== 0 ? [0, getMomentumRotation(ring.momentum)] : 0,
                      }
                    : {}
                }
                transition={{
                  duration: 3,
                  repeat: ring.momentum !== 0 ? Infinity : 0,
                  ease: "linear",
                }}
              >
                <HealthRing
                  value={ring.value}
                  size={80}
                  color={ring.color}
                  label={ring.label}
                  tooltip={ring.description}
                  isClickable={true}
                  className="transition-all duration-200 group-hover:drop-shadow-lg"
                />
              </motion.div>
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  style={{ color: ring.color }}
                  className="opacity-80 transition-opacity group-hover:opacity-100"
                  whileHover={{ scale: 1.1 }}
                >
                  {ring.icon}
                </motion.div>
              </div>
            </div>

            {/* Info Section */}
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <h4 className="text-foreground group-hover:text-opacity-80 font-semibold transition-colors">
                  {ring.label}
                </h4>
                <Badge variant={ring.badgeVariant as any} className="text-xs">
                  {ring.badge}
                </Badge>
                {/* Momentum Badge */}
                {showMomentum && ring.momentum !== 0 && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      ring.momentum > 0
                        ? "border-green-500/50 text-green-400"
                        : "border-red-500/50 text-red-400"
                    )}
                  >
                    {ring.momentum > 0 ? "+" : ""}
                    {ring.momentum.toFixed(1)}
                  </Badge>
                )}
              </div>
              <div className="mb-1 text-2xl font-bold" style={{ color: ring.color }}>
                {ring.metric}
              </div>
              <p className="text-muted-foreground mb-2 text-sm">{ring.subtitle}</p>
              <p className="text-muted-foreground text-xs opacity-80 transition-opacity group-hover:opacity-100">
                {ring.description}
              </p>
            </div>

            {/* Performance Indicator */}
            <div className="flex flex-col items-center gap-2">
              <div className="glow-text text-lg font-bold" style={{ color: ring.color }}>
                {Math.round(ring.value)}%
              </div>
              <div className="flex items-center gap-1">
                {ring.value > 75 ? (
                  <Crown className="h-4 w-4 text-yellow-400" />
                ) : ring.value > 50 ? (
                  <Target className="h-4 w-4 text-blue-400" />
                ) : ring.value > 25 ? (
                  <Activity className="h-4 w-4 text-orange-400" />
                ) : (
                  <Zap className="h-4 w-4 text-red-400" />
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default BuilderVitalityRings;
