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

interface MetricGridItem {
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

interface MetricCardGridProps {
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

type BackgroundImage = NonNullable<MetricCardGridProps["backgroundImage"]>;

const GRID_COLUMNS = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

/** The card's custom image or a desaturated flag wash, under a readability scrim, plus the edit control. */
function BackgroundLayer({ background }: { background: BackgroundImage }) {
  const [imageError, setImageError] = useState(false);
  const { data: cardImage, isLoading } = api.cardImages.getByCountryAndType.useQuery(
    { countryId: background.countryId || "", cardType: background.cardType || "national_identity" },
    { enabled: !!background.countryId }
  );
  const { flagUrl } = useFlag(background.countryName);

  const imageUrl = cardImage?.imageUrl || null;
  const hasImage = !!imageUrl && !imageError;
  const preset = background.cardType ? getCardImagePreset(background.cardType) : null;
  const canEdit = background.showEditButton && preset?.allowCustomUpload && background.onEditClick;

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
        {hasImage ? (
          <img
            src={imageUrl}
            alt={preset?.label || "Custom Background"}
            className="h-full w-full object-cover opacity-25 blur-[12px] saturate-50"
            onError={() => setImageError(true)}
          />
        ) : flagUrl ? (
          <img
            src={flagUrl}
            alt="Flag Wash Background"
            className="h-full w-full object-cover opacity-15 blur-[24px] saturate-[0.35]"
          />
        ) : null}

        {/* Readability scrim over the (user-chosen) background image */}
        <div className="from-background/98 via-background/90 to-background/70 absolute inset-0 bg-gradient-to-t" />
      </div>

      {isLoading && (
        <div className="absolute top-2 right-2 z-10">
          <Loader2 className="text-label-secondary h-4 w-4 animate-spin" />
        </div>
      )}

      {canEdit && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="bg-fill-2 hover:bg-label-tertiary text-background absolute top-2 right-2 z-10 h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                background.onEditClick?.();
              }}
            >
              {hasImage ? <Edit2 className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{hasImage ? "Change image" : "Add custom image"}</TooltipContent>
        </Tooltip>
      )}
    </>
  );
}

/**
 * A grid of metric cards with staggered entrance animations. With a `title` it is wrapped in a
 * card that can carry a background image (see `backgroundImage`).
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
  const Wrapper = animate ? motion.div : "div";
  const ItemWrapper = animate ? motion.div : "div";
  const wrapperProps = animate
    ? { variants: staggerContainer, initial: "hidden", animate: "show" }
    : {};
  const itemProps = animate ? { variants: staggerItem } : {};

  const metricsGrid = (
    <Wrapper
      className={`grid gap-2 sm:gap-3 ${GRID_COLUMNS[columns]} ${!title ? className : ""}`}
      {...wrapperProps}
    >
      {metrics.map(({ id, ...metric }) => (
        <ItemWrapper key={id} {...itemProps}>
          <MetricCard {...metric} />
        </ItemWrapper>
      ))}
    </Wrapper>
  );

  if (!title) return metricsGrid;

  return (
    <Card className={cn("rounded-card relative overflow-hidden", className)}>
      {backgroundImage && <BackgroundLayer background={backgroundImage} />}
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
    </Card>
  );
}
