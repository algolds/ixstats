"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useCountryData } from "./CountryDataProvider";
import { useCountryImage } from "~/hooks/useCountryImage";
import { extractCountryImageData, type ImageContext } from "~/lib/country-image-engine";
import { cn } from "~/lib/utils";
import type { LucideIcon } from "lucide-react";

interface TabHeroBannerProps {
  context: ImageContext;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Height class. Default: "h-20 sm:h-24" */
  heightClass?: string;
  /** Overlay darkness. Default 0.75 */
  overlayOpacity?: number;
  /** Theme accent color name for bottom border */
  accentColor?: string;
  className?: string;
}

/**
 * Compact hero banner for tab content areas.
 * Renders a contextual Unsplash image with title overlay.
 * Place at the top of ThemedTabContent, before the panel component.
 */
export const TabHeroBanner = React.memo(function TabHeroBanner({
  context,
  title,
  subtitle,
  icon: Icon,
  heightClass = "h-20 sm:h-24",
  overlayOpacity = 0.75,
  accentColor,
  className,
}: TabHeroBannerProps) {
  const { country } = useCountryData();
  const countryImageData = useMemo(() => extractCountryImageData(country), [country]);

  const { imageUrl } = useCountryImage({
    countryData: countryImageData,
    context,
    enabled: !!countryImageData,
    size: "small",
  });

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg mb-4",
        heightClass,
        accentColor && `border-b-2 border-${accentColor}-500/30`,
        className,
      )}
    >
      {/* Background image */}
      <AnimatePresence>
        {imageUrl && (
          <motion.div
            key={imageUrl}
            className="absolute inset-0 z-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to right,
                  rgba(0,0,0,${overlayOpacity}) 0%,
                  rgba(0,0,0,${overlayOpacity * 0.6}) 60%,
                  rgba(0,0,0,${overlayOpacity * 0.85}) 100%)`,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fallback background when no image */}
      {!imageUrl && (
        <div className="absolute inset-0 bg-muted/20" />
      )}

      {/* Content overlay */}
      <div className="relative z-[1] flex items-center h-full px-4 sm:px-6">
        {Icon && (
          <div
            className={cn(
              "rounded-lg p-2 mr-3 flex-shrink-0",
              imageUrl ? "bg-white/10 backdrop-blur-sm" : "bg-muted/50",
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5 sm:h-6 sm:w-6",
                imageUrl ? "text-white" : "text-muted-foreground",
              )}
            />
          </div>
        )}
        <div>
          <h3
            className={cn(
              "text-sm sm:text-base font-semibold",
              imageUrl ? "text-white" : "text-foreground",
            )}
          >
            {title}
          </h3>
          {subtitle && (
            <p
              className={cn(
                "text-xs sm:text-sm mt-0.5",
                imageUrl ? "text-white/70" : "text-muted-foreground",
              )}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});
