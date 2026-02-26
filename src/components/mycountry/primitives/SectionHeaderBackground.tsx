"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useCountryData } from "./CountryDataProvider";
import { useCountryImage } from "~/hooks/useCountryImage";
import { extractCountryImageData, type ImageContext } from "~/lib/country-image-engine";
import { cn } from "~/lib/utils";

interface SectionHeaderBackgroundProps {
  context: ImageContext;
  children: React.ReactNode;
  className?: string;
  /** Controls overlay darkness. Default 0.82 */
  overlayOpacity?: number;
}

/**
 * Wraps a section header with a contextual background image.
 * The image loads asynchronously and fades in behind the glass-hierarchy content.
 * In light mode, the glass layer is nearly opaque so the image is subtle.
 * In dark mode, more image shows through for atmospheric effect.
 */
export function SectionHeaderBackground({
  context,
  children,
  className,
  overlayOpacity = 0.82,
}: SectionHeaderBackgroundProps) {
  const { country } = useCountryData();
  const countryImageData = useMemo(() => extractCountryImageData(country), [country]);

  const { imageUrl, isLoading } = useCountryImage({
    countryData: countryImageData,
    context,
    enabled: !!countryImageData,
    size: "small",
  });

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      {/* Background image layer */}
      <AnimatePresence>
        {imageUrl && (
          <motion.div
            key={imageUrl}
            className="absolute inset-0 z-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
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
                background: `linear-gradient(135deg,
                  rgba(0,0,0,${overlayOpacity}) 0%,
                  rgba(0,0,0,${overlayOpacity * 0.75}) 50%,
                  rgba(0,0,0,${overlayOpacity}) 100%)`,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content (glass-hierarchy-parent div from caller) */}
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
