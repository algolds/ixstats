"use client";

import React, { useState, useMemo } from "react";
import { motion } from "motion/react";

import { MetricCard } from "./MetricCard";
import { staggerContainer, staggerItem } from "./TabMotionConfig";
import { FacetCard, FacetCardContent, FacetCardHeader } from "~/components/ui/facet-container";
import { GlassPanel, PanelCard } from "~/components/mycountry/cards";
import type { MyCountryAccent } from "~/components/mycountry/shared/cards/accents";
import { Button } from "~/components/ui/button";
import {
  EditPencil as Edit2,
  MediaImage as ImageIcon,
  SystemRestart as Loader2,
} from "iconoir-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { api } from "~/trpc/react";
import { getCardImagePreset, type CardImageType } from "~/lib/cards/image-presets";
import { useFlag } from "~/hooks/useUnifiedFlags";
import type { CountryImageData } from "~/lib/media";
import { cn } from "~/lib/utils";

// Theme color configurations
const themeColors = {
  economy: {
    primary: "from-green to-green",
    secondary: "from-green/10 to-green/10",
    accent: "rgb(16, 185, 129)",
    bg: "rgba(16, 185, 129, 0.05)",
  },
  labor: {
    primary: "from-red to-red",
    secondary: "from-red/10 to-red/10",
    accent: "rgb(239, 68, 68)",
    bg: "rgba(239, 68, 68, 0.05)",
  },
  government: {
    primary: "from-indigo to-indigo",
    secondary: "from-indigo/10 to-indigo/10",
    accent: "rgb(99, 102, 241)",
    bg: "rgba(99, 102, 241, 0.05)",
  },
  demographics: {
    primary: "from-cyan to-cyan",
    secondary: "from-cyan/10 to-cyan/10",
    accent: "rgb(6, 182, 212)",
    bg: "rgba(6, 182, 212, 0.05)",
  },
  analytics: {
    primary: "from-blue to-blue",
    secondary: "from-blue/10 to-blue/10",
    accent: "rgb(59, 130, 246)",
    bg: "rgba(59, 130, 246, 0.05)",
  },
  overview: {
    primary: "from-yellow to-yellow",
    secondary: "from-yellow/10 to-yellow/10",
    accent: "rgb(245, 158, 11)",
    bg: "rgba(245, 158, 11, 0.05)",
  },
} as const;

export type MetricTheme = keyof typeof themeColors;

export interface MetricGridItem {
  id: string;
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: {
    direction: "up" | "down" | "stable";
    value?: number;
    label?: string;
  };
  status?: "success" | "warning" | "error" | "info" | "neutral";
  badge?: {
    label: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
  onClick?: () => void;
  footer?: React.ReactNode;
  tooltip?: string;
}

export interface MetricCardGridProps {
  metrics: MetricGridItem[];
  theme?: MetricTheme;
  columns?: 2 | 3 | 4;
  animate?: boolean;
  className?: string;
  // Optional title/subtitle header
  title?: string;
  subtitle?: string;
  // Optional footer rendered below the metrics grid (inside the card)
  cardFooter?: React.ReactNode;
  // Optional background image configuration
  backgroundImage?: {
    countryId: string;
    cardType: CardImageType;
    showEditButton?: boolean;
    onEditClick?: () => void;
    /** Auto-fetch contextual Unsplash image when no custom DB image exists */
    autoFallback?: boolean;
    /** Country data for keyword generation (required if autoFallback=true) */
    countryImageData?: CountryImageData;
    countryName?: string;
  };
  cardWrapper?: "glass" | "panel" | "card";
}

/**
 * MetricCardGrid - A themed grid of metric cards with staggered animations
 *
 * Displays metrics in a responsive grid layout with consistent theming
 * and entrance animations. Uses the MetricCard component under the hood.
 *
 * Now supports optional title/subtitle header with background image support
 * for enhanced visual presentation in MyCountry interface.
 */
export function MetricCardGrid({
  metrics,
  theme = "overview",
  columns = 4,
  animate = true,
  className = "",
  title,
  subtitle,
  cardFooter,
  backgroundImage,
  cardWrapper = "card",
}: MetricCardGridProps) {
  const themeConfig = themeColors[theme];
  const accent = useMemo((): MyCountryAccent => {
    if (theme === "economy") return "emerald";
    if (theme === "labor") return "red";
    if (theme === "government") return "amber";
    if (theme === "overview") return "amber";
    if (theme === "demographics") return "cyan";
    if (theme === "analytics") return "indigo";
    return "neutral";
  }, [theme]);
  const [_imageLoaded, _setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Fetch the card image from database if backgroundImage is provided
  const { data: cardImage, isLoading: isLoadingImage } =
    api.cardImages.getByCountryAndType.useQuery(
      {
        countryId: backgroundImage?.countryId || "",
        cardType: backgroundImage?.cardType || "national_identity",
      },
      { enabled: !!backgroundImage?.countryId }
    );

  const { flagUrl: countryFlagUrl } = useFlag(backgroundImage?.countryName);

  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
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

  // Get image URL: DB custom image takes priority, then auto-fallback
  const imageUrl = cardImage?.imageUrl || null;
  const hasImage = !!imageUrl && !imageError;
  const preset = backgroundImage?.cardType ? getCardImagePreset(backgroundImage.cardType) : null;

  // Render the metrics grid
  const metricsGrid = (
    <Wrapper
      className={`grid gap-2 sm:gap-3 ${gridCols[columns]} ${!title ? className : ""}`}
      {...wrapperProps}
    >
      {metrics.map((metric) => (
        <ItemWrapper key={metric.id} {...itemProps}>
          <MetricCard
            title={metric.title}
            value={metric.value}
            description={metric.description}
            icon={metric.icon}
            trend={metric.trend}
            status={metric.status}
            badge={metric.badge}
            theme={themeConfig}
            onClick={metric.onClick}
            footer={metric.footer}
            tooltip={metric.tooltip}
          />
        </ItemWrapper>
      ))}
    </Wrapper>
  );

  // If no title, just return the grid
  if (!title) {
    return metricsGrid;
  }

  // Return wrapped in a card with optional background image
  const cardContent = (
    <>
      {/* Optional background: the custom card image or a desaturated flag wash */}
      {backgroundImage && (
        <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
          {hasImage ? (
            <img
              src={imageUrl!}
              alt={preset?.label || "Custom Background"}
              className="h-full w-full object-cover opacity-25 blur-[12px] saturate-50"
              onLoad={() => _setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          ) : countryFlagUrl ? (
            <img
              src={countryFlagUrl}
              alt="Flag Wash Background"
              className="h-full w-full object-cover opacity-15 blur-[24px] saturate-[0.35]"
            />
          ) : null}

          {/* Readability scrim over the (user-chosen) background image */}
          <div className="from-background/98 via-background/90 to-background/70 absolute inset-0 bg-gradient-to-t" />
        </div>
      )}

      {/* Loading indicator */}
      {isLoadingImage && (
        <div className="absolute top-2 right-2 z-10">
          <Loader2 className="text-label-secondary h-4 w-4 animate-spin" />
        </div>
      )}

      {/* Edit button */}
      {backgroundImage?.showEditButton &&
        preset?.allowCustomUpload &&
        backgroundImage?.onEditClick && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="bg-fill-2 hover:bg-label-tertiary text-background absolute top-2 right-2 z-10 h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  backgroundImage.onEditClick?.();
                }}
              >
                {hasImage ? <Edit2 className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{hasImage ? "Change image" : "Add custom image"}</TooltipContent>
          </Tooltip>
        )}

      {/* Content */}
      <div className="relative z-[5]">
        <FacetCardHeader className="p-4 pb-2">
          <h3 className="text-label text-headline">{title}</h3>
          {subtitle && <p className="text-label-secondary text-footnote">{subtitle}</p>}
        </FacetCardHeader>
        <FacetCardContent className="px-4 pb-4">
          {metricsGrid}
          {cardFooter}
        </FacetCardContent>
      </div>
    </>
  );

  if (cardWrapper === "glass") {
    return (
      <GlassPanel accent={accent} className={cn("relative overflow-hidden", className)}>
        {cardContent}
      </GlassPanel>
    );
  }

  if (cardWrapper === "panel") {
    return (
      <PanelCard accent={accent} className={cn("relative overflow-hidden", className)}>
        {cardContent}
      </PanelCard>
    );
  }

  return (
    <FacetCard className={cn("rounded-card relative overflow-hidden", className)}>
      {cardContent}
    </FacetCard>
  );
}

// Convenience components for specific themes
export function EconomyMetricGrid(props: Omit<MetricCardGridProps, "theme">) {
  return <MetricCardGrid {...props} theme="economy" />;
}

export function LaborMetricGrid(props: Omit<MetricCardGridProps, "theme">) {
  return <MetricCardGrid {...props} theme="labor" />;
}

export function GovernmentMetricGrid(props: Omit<MetricCardGridProps, "theme">) {
  return <MetricCardGrid {...props} theme="government" />;
}

export function DemographicsMetricGrid(props: Omit<MetricCardGridProps, "theme">) {
  return <MetricCardGrid {...props} theme="demographics" />;
}

export function AnalyticsMetricGrid(props: Omit<MetricCardGridProps, "theme">) {
  return <MetricCardGrid {...props} theme="analytics" />;
}
