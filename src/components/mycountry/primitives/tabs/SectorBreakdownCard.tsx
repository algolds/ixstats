"use client";

import React, { useMemo } from "react";
import { formatCompactCurrency } from "~/lib/format-utils";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { GlassPanel, PanelCard } from "~/components/mycountry/cards";
import type { MyCountryAccent } from "~/components/mycountry/cards/accents";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { staggerContainer, staggerItem } from "./TabMotionConfig";
import { useCountryImage } from "~/hooks/useCountryImage";
import { useCountryData } from "../CountryDataProvider";
import { extractCountryImageData, type ImageContext } from "~/lib/country-image-engine";

export interface SectorData {
  id: string;
  name: string;
  value: number; // Monetary value
  percentage: number; // Percentage of total
  color: string; // Tailwind color name (e.g., "green", "blue")
  trend?: "up" | "down" | "stable";
  trendValue?: number;
  icon?: LucideIcon;
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
  accent?: MyCountryAccent;
  cardWrapper?: "glass" | "panel" | "card";
}

// Format currency value with null safety
function formatCurrency(
  value: number | undefined | null,
  // eslint-disable-next-line unused-imports/no-unused-vars
  notation: "compact" | "standard" = "compact",
  currency: string = "USD"
): string {
  if (value == null || !isFinite(value)) return "0";
  return formatCompactCurrency(value, "N/A", currency);
}

// Format people/population counts without decimals
function formatPeopleCount(value: number | undefined | null): string {
  if (value == null || !isFinite(value) || value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${Math.round(value / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)}K`;
  return Math.round(value).toLocaleString();
}

// Get color classes for a given color name
function getColorClasses(color: string) {
  const colorMap: Record<string, { bg: string; text: string; progress: string; border: string }> = {
    green: {
      bg: "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20",
      text: "text-green-600 dark:text-green-400",
      progress: "bg-green-500 dark:bg-green-400",
      border: "border-green-200 dark:border-green-700/40",
    },
    blue: {
      bg: "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20",
      text: "text-blue-600 dark:text-blue-400",
      progress: "bg-blue-500 dark:bg-blue-400",
      border: "border-blue-200 dark:border-blue-700/40",
    },
    purple: {
      bg: "bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20",
      text: "text-purple-600 dark:text-purple-400",
      progress: "bg-purple-500 dark:bg-purple-400",
      border: "border-purple-200 dark:border-purple-700/40",
    },
    emerald: {
      bg: "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20",
      text: "text-emerald-600 dark:text-emerald-400",
      progress: "bg-emerald-500 dark:bg-emerald-400",
      border: "border-emerald-200 dark:border-emerald-700/40",
    },
    cyan: {
      bg: "bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-900/20 dark:to-sky-900/20",
      text: "text-cyan-600 dark:text-cyan-400",
      progress: "bg-cyan-500 dark:bg-cyan-400",
      border: "border-cyan-200 dark:border-cyan-700/40",
    },
    amber: {
      bg: "bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20",
      text: "text-amber-600 dark:text-amber-400",
      progress: "bg-amber-500 dark:bg-amber-400",
      border: "border-amber-200 dark:border-amber-700/40",
    },
    red: {
      bg: "bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20",
      text: "text-red-600 dark:text-red-400",
      progress: "bg-red-500 dark:bg-red-400",
      border: "border-red-200 dark:border-red-700/40",
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
        className="absolute inset-0 z-0 overflow-hidden rounded-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
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
  accent = "neutral",
  cardWrapper = "card",
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
      up: "text-green-500",
      down: "text-red-500",
      stable: "text-gray-500",
    };

    const Icon = icons[trend];
    return (
      <div className={cn("flex items-center gap-1 text-xs", colors[trend])}>
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
      <CardHeader className="pb-1">
        <CardTitle className="text-sm">{title}</CardTitle>
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
      </CardHeader>
      <CardContent>
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
                      "relative rounded-xl p-3 text-center transition-all hover:scale-[1.02]",
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
                            hasImage ? "text-white" : colors.text
                          )}
                        />
                      )}
                      {sector.value > 0 && (
                        <div
                          className={cn("text-lg font-bold", hasImage ? "text-white" : colors.text)}
                        >
                          {valueAsPeople
                            ? formatPeopleCount(sector.value)
                            : formatCurrency(sector.value, "compact", _currency)}
                        </div>
                      )}
                      <div
                        className={cn(
                          "mt-1 text-xs",
                          hasImage ? "text-white/80" : "text-muted-foreground"
                        )}
                      >
                        {sector.name}
                      </div>
                      {sector.description && (
                        <div
                          className={cn(
                            "text-xs opacity-70",
                            hasImage ? "text-white/60" : "text-muted-foreground"
                          )}
                        >
                          ({sector.description})
                        </div>
                      )}
                      <div
                        className={cn(
                          "mt-2 text-sm font-medium",
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
                      {IconComponent && <IconComponent className={cn("h-4 w-4", colors.text)} />}
                      <span className="text-sm font-medium">{sector.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">
                        {sector.percentage.toFixed(1)}%
                      </span>
                      {sector.value > 0 && (
                        <>
                          <span className="text-muted-foreground text-sm">•</span>
                          <span className={cn("text-sm font-medium", colors.text)}>
                            {valueAsPeople
                              ? formatPeopleCount(sector.value)
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
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                      <motion.div
                        className={cn("h-full rounded-full", colors.progress)}
                        initial={animate ? { width: 0 } : undefined}
                        animate={{ width: `${sector.percentage}%` }}
                        transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 }}
                      />
                    </div>
                  )}
                </div>
              </ItemWrapper>
            );
          })}
        </Wrapper>

        {totalValue !== undefined && (
          <div className="border-border/50 mt-3 flex items-center justify-between border-t pt-3">
            <span className="text-muted-foreground text-sm font-medium">Total</span>
            <span className="text-lg font-bold">
              {valueAsPeople
                ? formatPeopleCount(totalValue)
                : formatCurrency(totalValue, "compact", _currency)}
            </span>
          </div>
        )}
      </CardContent>
    </>
  );

  if (cardWrapper === "glass") {
    return (
      <GlassPanel accent={accent} className={cn("relative overflow-hidden", className)}>
        {cardInner}
      </GlassPanel>
    );
  }

  if (cardWrapper === "panel") {
    return (
      <PanelCard
        accent={accent}
        tinted
        texture="dots"
        className={cn("relative overflow-hidden", className)}
      >
        {cardInner}
      </PanelCard>
    );
  }

  return <Card className={cn("glass-hierarchy-child", className)}>{cardInner}</Card>;
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
          <div
            key={sector.id}
            className={cn("rounded-lg p-3 text-center", colors.bg, colors.border, "border")}
          >
            <div className={cn("text-xl font-bold", colors.text)}>
              {formatCurrency(sector.value)}
            </div>
            <div className="text-muted-foreground mt-1 text-xs">{sector.name}</div>
            <Badge variant="outline" className={cn("mt-1 text-xs", colors.text)}>
              {sector.percentage.toFixed(1)}%
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
