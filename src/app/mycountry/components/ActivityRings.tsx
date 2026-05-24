"use client";

import React from "react";
import { motion } from "motion/react";
import { TrendingUp, Users, Globe, Building2, type LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { HealthRing } from "~/components/ui/health-ring";
import { cn } from "~/lib/utils";

interface ActivityRing {
  id: string;
  title: string;
  description: string;
  value: number; // 0-100 percentage
  max: number;
  color: string;
  icon: LucideIcon;
  metrics: {
    primary: string;
    secondary: string;
    trend: "up" | "down" | "stable";
    change: string;
  };
}

interface ActivityRingsProps {
  rings: ActivityRing[];
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onRingClick?: (ringId: string) => void;
  onRingHover?: (ringId: string) => void;
  className?: string;
}

const RING_CONFIGS = {
  sm: { diameter: 80, iconSize: 14 },
  md: { diameter: 120, iconSize: 18 },
  lg: { diameter: 160, iconSize: 22 },
};

const RING_COLORS = {
  economic: "#059669", // Emerald-600 - matches economy tab theme
  population: "#0891B2", // Cyan-600 - matches demographics tab theme
  diplomatic: "#7C3AED", // Violet-600 - matches government tab theme
  governmental: "#DC2626", // Red-600 - matches labor tab theme
};

function ActivityRingComponent({
  ring,
  config,
  index,
  interactive = false,
  onClick,
  onHover,
}: {
  ring: ActivityRing;
  config: typeof RING_CONFIGS.md;
  index: number;
  interactive?: boolean;
  onClick?: (ringId: string) => void;
  onHover?: (ringId: string) => void;
}) {
  const Icon = ring.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          className={cn("relative cursor-pointer", interactive && "hover:scale-105")}
          style={{ width: config.diameter, height: config.diameter }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: index * 0.1 }}
          onClick={() => onClick?.(ring.id)}
          onMouseEnter={() => onHover?.(ring.id)}
          whileHover={interactive ? { scale: 1.05 } : {}}
          whileTap={interactive ? { scale: 0.95 } : {}}
        >
          <HealthRing
            value={ring.value}
            size={config.diameter}
            color={ring.color}
            label={ring.title}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <Icon size={config.iconSize} className="mb-0.5" style={{ color: ring.color }} />
            <div className="text-[10px] leading-tight font-bold" style={{ color: ring.color }}>
              {ring.value}%
            </div>
          </div>
        </motion.div>
      </TooltipTrigger>

      <TooltipContent className="glass-hierarchy-child max-w-xs p-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Icon size={16} style={{ color: ring.color }} />
            <span className="font-semibold">{ring.title}</span>
          </div>
          <p className="text-muted-foreground text-sm">{ring.description}</p>

          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Score:</span>
              <span className="font-medium">{ring.value}/100</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Primary:</span>
              <span className="font-medium">{ring.metrics.primary}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Secondary:</span>
              <span className="font-medium">{ring.metrics.secondary}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Trend:</span>
              <span
                className={`flex items-center gap-1 font-medium ${
                  ring.metrics.trend === "up"
                    ? "text-green-600"
                    : ring.metrics.trend === "down"
                      ? "text-red-600"
                      : "text-yellow-600"
                }`}
              >
                {ring.metrics.trend === "up" ? "↗" : ring.metrics.trend === "down" ? "↘" : "→"}
                {ring.metrics.change}
              </span>
            </div>
          </div>

          <div className="border-border border-t pt-2">
            <p className="text-muted-foreground text-xs">
              {ring.value >= 80
                ? "Excellent performance"
                : ring.value >= 60
                  ? "Good performance"
                  : ring.value >= 40
                    ? "Needs attention"
                    : "Critical - immediate action required"}
            </p>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function ActivityRings({
  rings,
  size = "md",
  interactive = true,
  onRingClick,
  onRingHover,
  className = "",
}: ActivityRingsProps) {
  const config = RING_CONFIGS[size];

  return (
    <div className={cn("flex flex-wrap justify-center gap-6", className)}>
      {rings.map((ring, index) => (
        <ActivityRingComponent
          key={`ring-${ring.id || `index-${index}`}`}
          ring={ring}
          config={config}
          index={index}
          interactive={interactive}
          onClick={onRingClick}
          onHover={onRingHover}
        />
      ))}
    </div>
  );
}

// Default rings configuration for MyCountry
export function createDefaultActivityRings(countryData: {
  economicVitality: number;
  populationWellbeing: number;
  diplomaticStanding: number;
  governmentalEfficiency: number;
  economicMetrics: {
    gdpPerCapita: string;
    growthRate: string;
    tier: string;
  };
  populationMetrics: {
    population: string;
    growthRate: string;
    tier: string;
  };
  diplomaticMetrics: {
    allies: string;
    reputation: string;
    treaties: string;
  };
  governmentMetrics: {
    approval: string;
    efficiency: string;
    stability: string;
  };
}): ActivityRing[] {
  return [
    {
      id: "economic-vitality",
      title: "Economic Vitality",
      description:
        "Overall economic health including GDP growth, trade balance, and economic stability",
      value: countryData.economicVitality,
      max: 100,
      color: RING_COLORS.economic,
      icon: TrendingUp,
      metrics: {
        primary: countryData.economicMetrics.gdpPerCapita,
        secondary: `${countryData.economicMetrics.growthRate} growth`,
        trend: "up",
        change: countryData.economicMetrics.tier,
      },
    },
    {
      id: "population-wellbeing",
      title: "Population Wellbeing",
      description:
        "Demographics health, quality of life, education, and social cohesion indicators",
      value: countryData.populationWellbeing,
      max: 100,
      color: RING_COLORS.population,
      icon: Users,
      metrics: {
        primary: countryData.populationMetrics.population,
        secondary: `${countryData.populationMetrics.growthRate} growth`,
        trend: "stable",
        change: `Tier ${countryData.populationMetrics.tier}`,
      },
    },
    {
      id: "diplomatic-standing",
      title: "Diplomatic Health",
      description:
        "Embassy network strength, relationship quality, mission success, and cultural exchange participation",
      value: countryData.diplomaticStanding,
      max: 100,
      color: RING_COLORS.diplomatic,
      icon: Globe,
      metrics: {
        primary: `${countryData.diplomaticMetrics.allies} embassies`,
        secondary: countryData.diplomaticMetrics.reputation,
        trend: "up",
        change: `${countryData.diplomaticMetrics.treaties} active missions`,
      },
    },
    {
      id: "governmental-efficiency",
      title: "Government Efficiency",
      description:
        "Policy effectiveness, administrative efficiency, public approval, and governance quality",
      value: countryData.governmentalEfficiency,
      max: 100,
      color: RING_COLORS.governmental,
      icon: Building2,
      metrics: {
        primary: `${countryData.governmentMetrics.approval} approval`,
        secondary: countryData.governmentMetrics.efficiency,
        trend: "stable",
        change: countryData.governmentMetrics.stability,
      },
    },
  ];
}

export default ActivityRings;
