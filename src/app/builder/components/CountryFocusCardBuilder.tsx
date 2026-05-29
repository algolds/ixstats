"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";
import { useCountryFlagRouteAware } from "~/hooks/useCountryFlagRouteAware";
import { Globe } from "lucide-react";

export interface CountryCardData {
  id: string;
  name: string;
  originalId?: string;
}

interface CountryFocusCardProps {
  country: CountryCardData;
  onHoverChange: (countryId: string | null) => void;
  onCountryClick?: (countryId: string) => void;
  cardSize?: "default" | "small";
  softSelectedCountryId?: string | null;
  /** Pre-resolved flag URL from server cache. If provided, skips browser-side Commons API call. */
  flagUrl?: string | null;
}

export const CountryFocusCardBuilder = React.memo<CountryFocusCardProps>(
  ({
    country,
    onHoverChange,
    onCountryClick,
    cardSize = "default",
    softSelectedCountryId,
    flagUrl: serverFlagUrl,
  }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [imgError, setImgError] = useState(false);

    // Only fetch from browser if no server-provided flag URL
    const { flag, loading, error } = useCountryFlagRouteAware(serverFlagUrl ? "" : country.name);

    const resolvedFlagUrl = serverFlagUrl ?? flag?.flagUrl ?? null;

    // Reset error when resolved flag changes
    React.useEffect(() => {
      setImgError(false);
    }, [resolvedFlagUrl, country.name]);

    const _isLoaded = !!resolvedFlagUrl;
    const isLoading = !serverFlagUrl && (loading || (!flag && !error));
    const hasError = !serverFlagUrl && (error || imgError);
    const showFlag = resolvedFlagUrl && !imgError;

    const aspectClass = cardSize === "small" ? "aspect-square" : "aspect-[3/4]";

    return (
      <motion.div
        layout
        className={cn(
          "country-focus-card relative cursor-pointer",
          isHovered && "shadow-2xl transition-all duration-100"
        )}
        onMouseEnter={() => {
          setIsHovered(true);
          onHoverChange(country.id);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          onHoverChange(null);
        }}
        onClick={() => {
          onCountryClick?.(country.id);
        }}
        animate={
          isHovered
            ? {
                scale: 1.08,
                y: -10,
                rotateZ: 0.5,
                rotateY: 0.5,
              }
            : {
                scale: 1,
                y: 0,
                rotateZ: 0,
                rotateY: 0,
              }
        }
        transition={
          isHovered
            ? {
                type: "spring",
                stiffness: 150,
                damping: 20,
              }
            : {
                duration: 0.1,
                ease: "easeInOut",
              }
        }
      >
        <div
          className={cn(
            "glass-floating glass-refraction glass-interactive relative overflow-hidden transition-all duration-500 ease-out",
            aspectClass,
            isHovered && "brightness-105 saturate-110 backdrop-blur-md",
            softSelectedCountryId === country.id &&
              "shadow-2xl ring-2 shadow-blue-500/20 ring-blue-400/60 ring-offset-2 ring-offset-black/20"
          )}
        >
          {/* Flag Background */}
          {showFlag ? (
            <img
              src={resolvedFlagUrl}
              alt={`Flag of ${country.name}`}
              className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300"
              style={{
                opacity: isLoading || hasError ? 0.2 : 1,
              }}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50">
              <Globe className="h-12 w-12 text-gray-400" />
            </div>
          )}

          {/* Content Overlay */}
          <div
            className={cn(
              "absolute inset-0 flex flex-col justify-end bg-black/50 p-6 transition-opacity duration-300",
              isHovered ? "opacity-100" : "opacity-0"
            )}
          >
            <motion.div
              animate={{
                scale: isHovered ? 1.05 : 1,
                opacity: isHovered ? 0.9 : 1,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <span className="text-xl font-medium text-white antialiased [text-shadow:0_0_10px_rgba(255,255,255,0.3)] md:text-2xl">
                {country.name}
              </span>
            </motion.div>
          </div>

          {/* Always Visible Country Name */}
          {!isHovered && (
            <div className="absolute right-4 bottom-4 left-4">
              <div className="text-xl font-medium text-white antialiased [text-shadow:0_0_15px_rgba(255,255,255,0.4)] md:text-2xl">
                {country.name}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  }
);

CountryFocusCardBuilder.displayName = "CountryFocusCard";
