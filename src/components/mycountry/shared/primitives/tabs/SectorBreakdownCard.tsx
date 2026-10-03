"use client";

import React, { useMemo } from "react";
import { formatCompactCurrency, formatPopulation } from "~/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

import { StatUp as TrendingUp, StatDown as TrendingDown, Minus } from "iconoir-react";
import { staggerContainer, staggerItem } from "./TabMotionConfig";
import { useCountryImage } from "~/hooks/useCountryImage";
import { useCountryData } from "../CountryDataProvider";
import { extractCountryImageData, type ImageContext } from "~/lib/media";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

export interface SectorData {
  id: string;
  name: string;
  value: number; // Monetary value
  percentage: number; // Percentage of total
  color: string; // Tailwind color name (e.g., "green", "blue")
  trend?: "up" | "down" | "stable";
  trendValue?: number;
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
  /** ImageContext key for contextual background image (e.g., "sector_agriculture") */
  imageKeyword?: string;
}

export interface SectorBreakdownCardProps {
  title: string;
  subtitle?: string;
  sectors: SectorData[];
  totalValue?: number;
  currency?: string;
  showProgressBars?: boolean;
  showTrends?: boolean;
  layout?: "list" | "grid";
  animate?: boolean;
  className?: string;
  /** Enable background images on grid items that have imageKeyword */
  showSectorImages?: boolean;
  /** Format values as people counts (no decimals, no currency symbol) instead of currency */
  valueAsPeople?: boolean;
}

// Format currency value with null safety
function formatCurrency(
  value: number | undefined | null,
  notation: "compact" | "standard" = "compact",
  currency: string = "USD"
): string {
  if (value == null || !isFinite(value)) return "0";
  return formatCompactCurrency(value, "N/A", currency);
}

// Get color classes for a given color name
function getColorClasses(color: string) {
  const colorMap: Record<string, { bg: string; text: string; progress: string; border: string }> = {
    emerald: {
      bg: "bg-fill-3",
      text: "text-label",
      progress: "bg-green",
      border: "border-transparent",
    },
    green: {
      bg: "bg-fill-3",
      text: "text-label",
      progress: "bg-green",
      border: "border-transparent",
    },
    cyan: {
      bg: "bg-fill-3",
      text: "text-label",
      progress: "bg-cyan",
      border: "border-transparent",
    },
    indigo: {
      bg: "bg-fill-3",
      text: "text-label",
      progress: "bg-indigo",
      border: "border-transparent",
    },
    purple: {
      bg: "bg-fill-3",
      text: "text-label",
      progress: "bg-indigo",
      border: "border-transparent",
    },
    amber: {
      bg: "bg-fill-3",
      text: "text-label",
      progress: "bg-yellow",
      border: "border-transparent",
    },
    red: {
      bg: "bg-fill-3",
      text: "text-label",
      progress: "bg-red",
      border: "border-transparent",
    },
    blue: {
      bg: "bg-fill-3",
      text: "text-label",
      progress: "bg-blue",
      border: "border-transparent",
    },
  };

  return colorMap[color] || colorMap.blue;
}

/**
 * Background image overlay for individual sector grid items.
 * Extracted as a separate component so each can call useCountryImage independently.
 */
const SectorGridItemImage = React.memo(function SectorGridItemImage({
  imageKeyword,
}: {
  imageKeyword: string;
}) {
  const { country } = useCountryData();
  const countryImageData = useMemo(() => extractCountryImageData(country), [country]);

  const { imageUrl } = useCountryImage({
    countryData: countryImageData,
    context: imageKeyword as ImageContext,
    enabled: !!countryImageData,
    size: "small",
  });

  if (!imageUrl) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={imageUrl}
        className="rounded-row absolute inset-0 z-0 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/60 to-black/40" />
      </motion.div>
    </AnimatePresence>
  );
});

/**
 * SectorBreakdownCard - Displays economic sector data with visual breakdown
 */
export function SectorBreakdownCard({
  title,
  subtitle,
  sectors,
  totalValue,
  currency: _currency = "USD",
  showProgressBars = true,
  showTrends = true,
  layout = "list",
  animate = true,
  className = "",
  showSectorImages = false,
  valueAsPeople = false,
}: SectorBreakdownCardProps) {
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

  // Trend icon component
  const TrendIcon = ({ trend, value }: { trend?: "up" | "down" | "stable"; value?: number }) => {
    if (!trend) return null;

    const icons = {
      up: TrendingUp,
      down: TrendingDown,
      stable: Minus,
    };
    const colors = {
      up: "text-green",
      down: "text-destructive",
      stable: "text-label-secondary",
    };

    const Icon = icons[trend];
    return (
      <div className={cn("text-footnote flex items-center gap-1", colors[trend])}>
        <Icon className="h-3 w-3" />
        {value !== undefined && (
          <span>
            {value > 0 ? "+" : ""}
            {value.toFixed(1)}%
          </span>
        )}
      </div>
    );
  };

  const cardInner = (
    <>
      <CardHeader className="p-4 pb-2">
        <h3 className="text-label text-headline">{title}</h3>
        {subtitle && <p className="text-label-secondary text-footnote">{subtitle}</p>}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <Wrapper
          className={cn(
            layout === "grid" ? "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4" : "space-y-2"
          )}
          {...wrapperProps}
        >
          {sectors.map((sector) => {
            const colors = getColorClasses(sector.color);
            const IconComponent = sector.icon;

            if (layout === "grid") {
              const hasImage = showSectorImages && sector.imageKeyword;
              return (
                <ItemWrapper key={sector.id} {...itemProps}>
                  <div
                    className={cn(
                      "rounded-row relative p-3 text-center",
                      hasImage ? "overflow-hidden" : "",
                      hasImage ? "" : colors.bg,
                      colors.border,
                      "border"
                    )}
                  >
                    {hasImage && <SectorGridItemImage imageKeyword={sector.imageKeyword!} />}
                    <div className={cn("relative", hasImage ? "z-[1]" : "")}>
                      {IconComponent && (
                        <IconComponent
                          className={cn(
                            "mx-auto mb-2 h-6 w-6",
                            hasImage ? "text-white" : "text-label-secondary"
                          )}
                        />
                      )}
                      {sector.value > 0 && (
                        <div className={cn("text-title-3", hasImage ? "text-white" : colors.text)}>
                          {valueAsPeople
                            ? formatPopulation(sector.value, "0")
                            : formatCurrency(sector.value, "compact", _currency)}
                        </div>
                      )}
                      <div
                        className={cn(
                          "text-footnote mt-1",
                          hasImage ? "text-white/80" : "text-label-secondary"
                        )}
                      >
                        {sector.name}
                      </div>
                      {sector.description && (
                        <div
                          className={cn(
                            "text-footnote opacity-70",
                            hasImage ? "text-white/60" : "text-label-secondary"
                          )}
                        >
                          ({sector.description})
                        </div>
                      )}
                      <div
                        className={cn(
                          "text-body mt-2 font-medium",
                          hasImage ? "text-white" : colors.text
                        )}
                      >
                        {sector.percentage.toFixed(1)}%
                      </div>
                      {showTrends && sector.trend && (
                        <div className="mt-1 flex justify-center">
                          <TrendIcon trend={sector.trend} value={sector.trendValue} />
                        </div>
                      )}
                    </div>
                  </div>
                </ItemWrapper>
              );
            }

            // List layout
            return (
              <ItemWrapper key={sector.id} {...itemProps}>
                <div className="group">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {IconComponent && <IconComponent className="text-label-secondary h-4 w-4" />}
                      <span className="text-label text-body font-medium">{sector.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-label-secondary text-body">
                        {sector.percentage.toFixed(1)}%
                      </span>
                      {sector.value > 0 && (
                        <>
                          <span className="text-label-secondary text-body">•</span>
                          <span className={cn("text-body font-medium", colors.text)}>
                            {valueAsPeople
                              ? formatPopulation(sector.value, "0")
                              : formatCurrency(sector.value, "compact", _currency)}
                          </span>
                        </>
                      )}
                      {showTrends && sector.trend && (
                        <TrendIcon trend={sector.trend} value={sector.trendValue} />
                      )}
                    </div>
                  </div>
                  {showProgressBars && (
                    <div className="bg-fill-3 h-2 overflow-hidden rounded-full">
                      {/* Categorical series colour: the bar is the chart. Animates transform only. */}
                      <motion.div
                        className={cn("h-full w-full origin-left rounded-full", colors.progress)}
                        initial={animate ? { scaleX: 0 } : undefined}
                        animate={{ scaleX: Math.min(100, Math.max(0, sector.percentage)) / 100 }}
                        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                      />
                    </div>
                  )}
                </div>
              </ItemWrapper>
            );
          })}
        </Wrapper>

        {totalValue !== undefined && (
          <div className="border-separator mt-3 flex items-center justify-between border-t pt-3">
            <span className="text-label-secondary text-body font-medium">Total</span>
            <span className="text-label text-title-3 tabular-nums">
              {valueAsPeople
                ? formatPopulation(totalValue, "0")
                : formatCurrency(totalValue, "compact", _currency)}
            </span>
          </div>
        )}
      </CardContent>
    </>
  );

  return <Card className={cn("rounded-card", className)}>{cardInner}</Card>;
}

/**
 * QuickSectorGrid - Compact grid display for sector overview
 */
export function QuickSectorGrid({
  sectors,
  className = "",
}: {
  sectors: SectorData[];
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}>
      {sectors.map((sector) => {
        const colors = getColorClasses(sector.color);
        return (
          <div key={sector.id} className="bg-fill-3 rounded-row p-3 text-center">
            <div className="text-label text-title-2 tabular-nums">
              {formatCurrency(sector.value)}
            </div>
            <div className="text-label-secondary text-footnote mt-1">{sector.name}</div>
            <Badge variant="outline" className="mt-1">
              {sector.percentage.toFixed(1)}%
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
