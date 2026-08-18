/**
 * Card Design Metadata Resolver Utility
 *
 * Safely extracts and normalizes custom 3D card design metadata
 * (emblems, watermarks, custom subtitles, accent swatches) from CardInstance objects.
 *
 * ponytail: simplified single-source metadata parser
 */

import type { CardInstance } from "~/types/cards-display";

export interface CardDesignIconMetadata {
  id?: string;
  name?: string;
  slug?: string;
  author?: string;
  path: string;
  tags?: string[];
}

export interface ResolvedCardDesignMetadata {
  emblemIcon: CardDesignIconMetadata | null;
  emblemScale: number;
  emblemColor: string | null;
  watermarkIcon: CardDesignIconMetadata | null;
  watermarkOpacity: number;
  watermarkScale: number;
  watermarkColor: string | null;
  customSubtitle: string | null;
  accentColorOverride: string | null;
  enableCategoryTint: boolean;
}

export function getCardDesignMetadata(card: CardInstance): ResolvedCardDesignMetadata {
  const meta = (card.metadata as Record<string, unknown> | null | undefined) ?? {};

  const emblemIcon = (meta.emblemIcon as CardDesignIconMetadata | undefined) || null;
  const emblemScale = typeof meta.emblemScale === "number" ? meta.emblemScale : 1.0;
  const emblemColor =
    typeof meta.emblemColor === "string" && meta.emblemColor.trim() ? meta.emblemColor : null;

  const watermarkIcon = (meta.watermarkIcon as CardDesignIconMetadata | undefined) || null;
  const watermarkOpacity = typeof meta.watermarkOpacity === "number" ? meta.watermarkOpacity : 0.35;
  const watermarkScale = typeof meta.watermarkScale === "number" ? meta.watermarkScale : 1.0;
  const watermarkColor =
    typeof meta.watermarkColor === "string" && meta.watermarkColor.trim()
      ? meta.watermarkColor
      : null;

  const customSubtitle =
    typeof meta.customSubtitle === "string" && meta.customSubtitle.trim()
      ? meta.customSubtitle
      : null;
  const accentColorOverride =
    typeof meta.accentColorOverride === "string" && meta.accentColorOverride.trim()
      ? meta.accentColorOverride
      : null;
  const enableCategoryTint = meta.enableCategoryTint !== false;

  return {
    emblemIcon,
    emblemScale,
    emblemColor,
    watermarkIcon,
    watermarkOpacity,
    watermarkScale,
    watermarkColor,
    customSubtitle,
    accentColorOverride,
    enableCategoryTint,
  };
}
