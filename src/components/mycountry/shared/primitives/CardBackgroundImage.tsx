"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "~/trpc/react";
import {
  getCardImagePreset,
  getFallbackGradient,
  allowsCustomUpload,
  type CardImageType,
} from "~/lib/cards/image-presets";
import {
  EditPencil as Edit2,
  MediaImage as ImageIcon,
  SystemRestart as Loader2,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

interface CardBackgroundImageProps {
  countryId: string;
  cardType: CardImageType;
  className?: string;
  children: React.ReactNode;
  // Controls for editing
  showEditButton?: boolean;
  onEditClick?: () => void;
  // Overlay opacity for readability
  overlayOpacity?: number;
  // Optional override image URL (for preview before save)
  previewImageUrl?: string;
}

/**
 * CardBackgroundImage - A wrapper component that provides:
 * - Background image loading from database
 * - Fallback to preset images or gradients
 * - Loading state handling
 * - Edit button for authorized users
 * - Smooth image transitions
 */
export function CardBackgroundImage({
  countryId,
  cardType,
  className,
  children,
  showEditButton = false,
  onEditClick,
  overlayOpacity = 0.85,
  previewImageUrl,
}: CardBackgroundImageProps) {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);

  // Fetch the card image from database
  const { data: cardImage, isLoading } = api.cardImages.getByCountryAndType.useQuery(
    { countryId, cardType },
    { enabled: !!countryId }
  );

  // Get preset for this card type
  const preset = getCardImagePreset(cardType);

  // Determine the image URL to display
  const imageUrl = previewImageUrl || cardImage?.imageUrl || null;
  const hasImage = !!imageUrl && !imageError;

  // Reset image loaded state when URL changes
  React.useEffect(() => {
    if (imageUrl) {
      // oxlint-disable-next-line
      setImageLoaded(false);
      setImageError(false);
    }
  }, [imageUrl]);

  // Fallback gradient when no image
  const fallbackClass = getFallbackGradient(cardType);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl",
        !hasImage && `bg-gradient-to-br ${fallbackClass}`,
        className
      )}
    >
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
            <img
              src={imageUrl}
              alt={preset.label}
              className="h-full w-full object-cover"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
            {/* Dark overlay for text readability */}
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30"
              style={{ opacity: overlayOpacity }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Loader2 className="h-6 w-6 animate-spin text-white/70" />
        </div>
      )}

      {/* Edit button */}
      {showEditButton && allowsCustomUpload(cardType) && onEditClick && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 h-8 w-8 bg-black/30 text-white hover:bg-black/50"
              onClick={(e) => {
                e.stopPropagation();
                onEditClick();
              }}
            >
              {hasImage ? <Edit2 className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{hasImage ? "Change image" : "Add custom image"}</TooltipContent>
        </Tooltip>
      )}

      {/* Content */}
      <div className="relative z-[5]">{children}</div>
    </div>
  );
}

/**
 * Hook to get card image for a specific card type
 */
export function useCardImage(countryId: string, cardType: CardImageType) {
  const {
    data: cardImage,
    isLoading,
    refetch,
  } = api.cardImages.getByCountryAndType.useQuery(
    { countryId, cardType },
    { enabled: !!countryId }
  );

  const preset = getCardImagePreset(cardType);
  const imageUrl = cardImage?.imageUrl || null;
  const fallbackGradient = getFallbackGradient(cardType);

  return {
    imageUrl,
    isLoading,
    refetch,
    preset,
    fallbackGradient,
    isCustom: cardImage?.isCustom ?? false,
    allowsUpload: allowsCustomUpload(cardType),
  };
}

/**
 * Hook to get all card images for a country
 */
export function useAllCardImages(countryId: string) {
  const {
    data: cardImages,
    isLoading,
    refetch,
  } = api.cardImages.getAllByCountry.useQuery({ countryId }, { enabled: !!countryId });

  return {
    cardImages: cardImages ?? {},
    isLoading,
    refetch,
  };
}

export default CardBackgroundImage;
