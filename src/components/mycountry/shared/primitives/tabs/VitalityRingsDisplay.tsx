"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { HealthRing } from "~/components/ui/health-ring";
import { FacetCard, FacetCardContent, FacetCardHeader } from "~/components/ui/facet-container";
import { Activity, Dollar as DollarSign, Group as Users, Globe, Building } from "iconoir-react";
import { staggerContainer, staggerItem } from "./TabMotionConfig";
import { cn } from "~/lib/utils";

import { VitalityBreakdownModal } from "~/components/mycountry/shared/modals/VitalityBreakdownModal";

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

export interface VitalityRingsDisplayProps {
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
export const defaultVitalityRings: VitalityRing[] = [
  {
    id: "economic",
    label: "Economic Vitality",
    value: 0,
    color: "#F59E0B", // Amber
    icon: DollarSign,
    description: "Economic health and performance",
  },
  {
    id: "population",
    label: "Population Wellbeing",
    value: 0,
    color: "#06B6D4", // Cyan
    icon: Users,
    description: "Quality of life and development",
  },
  {
    id: "diplomatic",
    label: "Diplomatic Standing",
    value: 0,
    color: "#8B5CF6", // Violet
    icon: Globe,
    description: "International relations strength",
  },
  {
    id: "government",
    label: "Government Efficiency",
    value: 0,
    color: "#EF4444", // Red
    icon: Building,
    description: "Governance effectiveness",
  },
];

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
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-foreground";
    if (score >= 40) return "text-amber-500";
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
    <FacetCard depth={2} className={cn("rounded-2xl", className)}>
      {(title || subtitle) && (
        <FacetCardHeader className="p-5 pb-2">
          {title && (
            <h3 className="text-foreground flex items-center gap-2 text-base font-semibold">
              <Activity className="text-muted-foreground h-4 w-4" />
              {title}
            </h3>
          )}
          {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
        </FacetCardHeader>
      )}
      <FacetCardContent className="px-5 pt-2 pb-5">
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
                    <p className="text-foreground text-xs font-medium">{ring.label}</p>
                    {ring.description && size !== "sm" && (
                      <p className="text-muted-foreground mt-0.5 max-w-[100px] text-xs">
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
            className="border-border mt-4 border-t pt-4"
            initial={animate ? { opacity: 0, y: 10 } : undefined}
            animate={animate ? { opacity: 1, y: 0 } : undefined}
            transition={{ delay: 0.1, duration: 0.2 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-foreground text-sm font-semibold">Overall National Health</h4>
                <p className="text-muted-foreground text-xs">Average of all vitality indicators</p>
              </div>
              <div className="text-right">
                <span
                  className={cn(
                    "text-2xl font-semibold tabular-nums",
                    getOverallStatusColor(overallScore)
                  )}
                >
                  {overallScore.toFixed(1)}%
                </span>
                <p className={cn("text-xs font-medium", getOverallStatusColor(overallScore))}>
                  {getOverallStatusLabel(overallScore)}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </FacetCardContent>
    </FacetCard>
  );
}

/**
 * QuickVitalityRings - Compact inline version without card wrapper
 */
export function QuickVitalityRings({
  rings,
  size = "sm",
  className = "",
  countryName,
}: {
  rings: VitalityRing[];
  size?: "sm" | "md";
  className?: string;
  countryName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ringSize = size === "sm" ? 60 : 80;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "hover:bg-accent/50 focus-visible:ring-ring flex cursor-pointer items-center gap-2 rounded-xl p-1 transition-[background-color,transform] duration-150 outline-none focus-visible:ring-2 active:scale-[0.98]",
          className
        )}
        title="Click for Vitality Index Breakdown"
        aria-label="Open vitality index breakdown"
      >
        {rings.map((ring) => (
          <HealthRing
            key={ring.id}
            value={ring.value}
            size={ringSize}
            color={ring.color}
            label={ring.label}
            tooltip={`${ring.label}: ${ring.value}/100 — Click for breakdown`}
          />
        ))}
      </button>

      <VitalityBreakdownModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        rings={rings}
        countryName={countryName}
      />
    </>
  );
}

export function getAppleVitalityColor(score: number): string {
  if (score >= 80) return "#10B981"; // Apple Emerald Green (Optimal)
  if (score >= 65) return "#06B6D4"; // Apple Cyan Blue (Strong)
  if (score >= 45) return "#F59E0B"; // Apple Amber Gold (Moderate)
  return "#EF4444"; // Apple Rose Red (Strained)
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
