"use client";

import React from "react";
import { motion } from "motion/react";
import { HealthRing } from "~/components/ui/health-ring";
import { Activity, Dollar as DollarSign, Group as Users, Globe, Building } from "iconoir-react";
import { staggerContainer, staggerItem } from "./TabMotionConfig";
import { cn } from "~/lib/utils";

import { Card, CardContent, CardHeader } from "~/components/ui/card";

export interface VitalityRing {
  id: string;
  label: string;
  value: number; // 0-100
  target?: number;
  color: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  description?: string;
  onClick?: () => void;
}

interface VitalityRingsDisplayProps {
  rings: VitalityRing[];
  title?: string;
  subtitle?: string;
  showLabels?: boolean;
  showOverallScore?: boolean;
  size?: "sm" | "md" | "lg";
  layout?: "horizontal" | "grid" | "compact";
  className?: string;
  animate?: boolean;
}

// Default vitality ring configurations for national metrics
// Size configurations
const sizeConfig = {
  sm: { ring: 80, gap: "gap-3" },
  md: { ring: 110, gap: "gap-4" },
  lg: { ring: 140, gap: "gap-6" },
};

// Layout configurations
const layoutConfig = {
  horizontal: "flex flex-wrap justify-center items-center",
  grid: "grid grid-cols-2 sm:grid-cols-4",
  compact: "flex flex-wrap justify-start items-center",
};

/**
 * VitalityRingsDisplay - Apple Watch-style health rings for national vitality metrics
 *
 * Displays circular progress rings showing various national health indicators
 * with smooth animations and interactive tooltips.
 */
export function VitalityRingsDisplay({
  rings,
  title,
  subtitle,
  showLabels = true,
  showOverallScore = true,
  size = "md",
  layout = "horizontal",
  className = "",
  animate = true,
}: VitalityRingsDisplayProps) {
  const { ring: ringSize, gap } = sizeConfig[size];
  const layoutClass = layoutConfig[layout];

  // Calculate overall score
  const overallScore =
    rings.length > 0 ? rings.reduce((sum, r) => sum + r.value, 0) / rings.length : 0;

  // Get overall status color based on score
  const getOverallStatusColor = (score: number) => {
    if (score >= 80) return "text-green";
    if (score >= 60) return "text-label";
    if (score >= 40) return "text-yellow";
    return "text-destructive";
  };

  // Get overall status label
  const getOverallStatusLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Strong";
    if (score >= 40) return "Moderate";
    return "Developing";
  };

  const Wrapper = animate ? motion.div : "div";
  const ItemWrapper = animate ? motion.div : "div";

  const wrapperProps = animate
    ? {
        variants: staggerContainer,
        initial: "hidden",
        animate: "show",
      }
    : {};

  const itemProps = animate ? { variants: staggerItem } : {};

  return (
    <Card className={cn("rounded-card", className)}>
      {(title || subtitle) && (
        <CardHeader className="p-5 pb-2">
          {title && (
            <h3 className="text-label text-title-3 flex items-center gap-2">
              <Activity className="text-label-secondary h-4 w-4" />
              {title}
            </h3>
          )}
          {subtitle && <p className="text-label-secondary text-body">{subtitle}</p>}
        </CardHeader>
      )}
      <CardContent className="px-5 pt-2 pb-5">
        <Wrapper className={cn(layoutClass, gap, "justify-center")} {...wrapperProps}>
          {rings.map((ring) => {
            const IconComponent = ring.icon;
            return (
              <ItemWrapper key={ring.id} className="flex flex-col items-center" {...itemProps}>
                <div className="relative">
                  <HealthRing
                    value={ring.value}
                    size={ringSize}
                    color={ring.color}
                    label={ring.label}
                    target={ring.target || 100}
                    tooltip={ring.description}
                    onClick={ring.onClick}
                    isClickable={!!ring.onClick}
                  />
                  {IconComponent && (
                    <div
                      className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{
                        marginTop: size === "sm" ? "18px" : size === "lg" ? "30px" : "24px",
                      }}
                    >
                      <IconComponent
                        className={cn(
                          "opacity-60",
                          size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4"
                        )}
                        style={{ color: ring.color }}
                      />
                    </div>
                  )}
                </div>
                {showLabels && (
                  <div className="mt-2 text-center">
                    <p className="text-label text-caption">{ring.label}</p>
                    {ring.description && size !== "sm" && (
                      <p className="text-label-secondary text-footnote mt-0.5 max-w-[100px]">
                        {ring.description}
                      </p>
                    )}
                  </div>
                )}
              </ItemWrapper>
            );
          })}
        </Wrapper>

        {/* Overall Score Section */}
        {showOverallScore && (
          <motion.div
            className="border-separator mt-4 border-t pt-4"
            initial={animate ? { opacity: 0, y: 10 } : undefined}
            animate={animate ? { opacity: 1, y: 0 } : undefined}
            transition={{ delay: 0.1, duration: 0.2 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-label text-headline">Overall national health</h4>
                <p className="text-label-secondary text-footnote">
                  Average of all vitality indicators
                </p>
              </div>
              <div className="text-right">
                <span
                  className={cn("text-title-1 tabular-nums", getOverallStatusColor(overallScore))}
                >
                  {overallScore.toFixed(1)}%
                </span>
                <p className={cn("text-caption", getOverallStatusColor(overallScore))}>
                  {getOverallStatusLabel(overallScore)}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

function getAppleVitalityColor(score: number): string {
  if (score >= 80) return "var(--color-emerald-500)"; // Optimal
  if (score >= 65) return "var(--color-cyan-500)"; // Strong
  if (score >= 45) return "var(--color-amber-500)"; // Moderate
  return "var(--color-red-500)"; // Strained
}

/**
 * Helper function to create vitality rings from country data
 */
export function createVitalityRingsFromCountry(country: {
  economicVitality?: number | null;
  populationWellbeing?: number | null;
  diplomaticStanding?: number | null;
  governmentalEfficiency?: number | null;
}): VitalityRing[] {
  const econ = Number(country.economicVitality) || 0;
  const pop = Number(country.populationWellbeing) || 0;
  const diplo = Number(country.diplomaticStanding) || 0;
  const gov = Number(country.governmentalEfficiency) || 0;

  return [
    {
      id: "economic",
      label: "Economic",
      value: econ,
      color: getAppleVitalityColor(econ),
      icon: DollarSign,
      description: "Economic health",
    },
    {
      id: "population",
      label: "Wellbeing",
      value: pop,
      color: getAppleVitalityColor(pop),
      icon: Users,
      description: "Population wellbeing",
    },
    {
      id: "diplomatic",
      label: "Diplomatic",
      value: diplo,
      color: getAppleVitalityColor(diplo),
      icon: Globe,
      description: "Diplomatic standing",
    },
    {
      id: "government",
      label: "Efficiency",
      value: gov,
      color: getAppleVitalityColor(gov),
      icon: Building,
      description: "Government efficiency",
    },
  ];
}
