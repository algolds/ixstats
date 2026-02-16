"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { MetricCard, type MetricCardProps } from "~/components/shared/data-display/MetricCard";
import { staggerContainer, staggerItem } from "./TabMotionConfig";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Edit2, ImageIcon, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { api } from "~/trpc/react";
import { 
  getCardImagePreset, 
  getFallbackGradient, 
  allowsCustomUpload,
  type CardImageType 
} from "~/lib/card-image-presets";
import { cn } from "~/lib/utils";

// Theme color configurations
const themeColors = {
  economy: {
    primary: "from-emerald-500 to-green-600",
    secondary: "from-emerald-500/10 to-green-600/10",
    accent: "rgb(16, 185, 129)",
    bg: "rgba(16, 185, 129, 0.05)",
  },
  labor: {
    primary: "from-red-500 to-rose-600",
    secondary: "from-red-500/10 to-rose-600/10",
    accent: "rgb(239, 68, 68)",
    bg: "rgba(239, 68, 68, 0.05)",
  },
  government: {
    primary: "from-violet-500 to-purple-600",
    secondary: "from-violet-500/10 to-purple-600/10",
    accent: "rgb(139, 92, 246)",
    bg: "rgba(139, 92, 246, 0.05)",
  },
  demographics: {
    primary: "from-cyan-500 to-blue-600",
    secondary: "from-cyan-500/10 to-blue-600/10",
    accent: "rgb(6, 182, 212)",
    bg: "rgba(6, 182, 212, 0.05)",
  },
  analytics: {
    primary: "from-pink-500 to-rose-600",
    secondary: "from-pink-500/10 to-rose-600/10",
    accent: "rgb(236, 72, 153)",
    bg: "rgba(236, 72, 153, 0.05)",
  },
  overview: {
    primary: "from-amber-500 to-yellow-600",
    secondary: "from-amber-500/10 to-yellow-600/10",
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
  icon?: LucideIcon;
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
  };
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
}: MetricCardGridProps) {
  const themeConfig = themeColors[theme];
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Fetch the card image from database if backgroundImage is provided
  const { data: cardImage, isLoading: isLoadingImage } = api.cardImages.getByCountryAndType.useQuery(
    { 
      countryId: backgroundImage?.countryId || "", 
      cardType: backgroundImage?.cardType || "national_identity" 
    },
    { enabled: !!backgroundImage?.countryId }
  );
  
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

  // Get image URL and fallback gradient
  const imageUrl = cardImage?.imageUrl || null;
  const hasImage = !!imageUrl && !imageError;
  const fallbackGradient = backgroundImage?.cardType 
    ? getFallbackGradient(backgroundImage.cardType) 
    : `bg-gradient-to-br from-${theme}-50/80 to-${theme}-100/80 dark:from-${theme}-900/20 dark:to-${theme}-800/20`;
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
  return (
    <Card className={cn(
      "relative overflow-hidden border-border",
      !hasImage && fallbackGradient,
      className
    )}>
      {/* Background Image */}
      <AnimatePresence>
        {hasImage && (
          <motion.div
            key={imageUrl}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: imageLoaded ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl!}
              alt={preset?.label || "Background"}
              className="h-full w-full object-cover"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
            {/* Gradient overlay for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/80 to-background/50" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading indicator */}
      {isLoadingImage && (
        <div className="absolute top-2 right-2 z-10">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Edit button */}
      {backgroundImage?.showEditButton && preset?.allowCustomUpload && backgroundImage?.onEditClick && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 h-8 w-8 bg-black/30 hover:bg-black/50 text-white"
              onClick={(e) => {
                e.stopPropagation();
                backgroundImage.onEditClick?.();
              }}
            >
              {hasImage ? (
                <Edit2 className="h-4 w-4" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {hasImage ? "Change image" : "Add custom image"}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Content */}
      <div className="relative z-[5]">
        <CardHeader className={cn(hasImage && "text-foreground")}>
          <CardTitle className="text-sm">{title}</CardTitle>
          {subtitle && <CardDescription className={cn(hasImage && "text-muted-foreground")}>{subtitle}</CardDescription>}
        </CardHeader>
        <CardContent>
          {metricsGrid}
          {cardFooter}
        </CardContent>
      </div>
    </Card>
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
