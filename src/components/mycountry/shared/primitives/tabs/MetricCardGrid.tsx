"use client";

import React, { useState } from "react";
import { motion } from "motion/react";

import { MetricCard } from "./MetricCard";
import { staggerContainer, staggerItem } from "./TabMotionConfig";
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
import { Card, CardContent, CardHeader } from "~/components/ui/card";

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
}

/**
 * MetricCardGrid - A grid of metric cards with staggered animations
 *
 * Displays metrics in a responsive grid layout with consistent theming
 * and entrance animations. Uses the MetricCard component under the hood.
 *
 * Now supports optional title/subtitle header with background image support
 * for enhanced visual presentation in MyCountry interface.
 */
export function MetricCardGrid({
  metrics,
  columns = 4,
  animate = true,
  className = "",
  title,
  subtitle,
  cardFooter,
  backgroundImage,
}: MetricCardGridProps) {
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
        <CardHeader className="p-4 pb-2">
          <h3 className="text-label text-headline">{title}</h3>
          {subtitle && <p className="text-label-secondary text-footnote">{subtitle}</p>}
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {metricsGrid}
          {cardFooter}
        </CardContent>
      </div>
    </>
  );

  return (
    <Card className={cn("rounded-card relative overflow-hidden", className)}>{cardContent}</Card>
  );
}
