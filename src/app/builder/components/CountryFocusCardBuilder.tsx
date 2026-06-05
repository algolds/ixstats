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

    const isPlaceholder =
      !serverFlagUrl ||
      serverFlagUrl.includes("placeholder-flag.svg") ||
      serverFlagUrl.includes("placeholder");
    // Only fetch from browser if no server-provided flag URL or it is a placeholder
    const { flag, loading, error } = useCountryFlagRouteAware(isPlaceholder ? country.name : "");

    const resolvedFlagUrl =
      !serverFlagUrl || isPlaceholder ? (flag?.flagUrl ?? serverFlagUrl) : serverFlagUrl;

    // Reset error when resolved flag changes
    React.useEffect(() => {
      setImgError(false);
    }, [resolvedFlagUrl, country.name]);

    const _isLoaded = !!resolvedFlagUrl;
    const isLoading = isPlaceholder && (loading || (!flag && !error));
    const hasError = isPlaceholder ? !!error || imgError : imgError;
    const showFlag = resolvedFlagUrl && !imgError;

    const aspectClass = cardSize === "small" ? "aspect-square" : "aspect-[3/4]";

    return (
      <div className={cn("relative overflow-visible rounded-xl", aspectClass)}>
        {/* Recessed Indent / Card Slot (always underneath, visible when card floats up) */}
        <div className="pointer-events-none absolute inset-0 rounded-xl border-t border-r border-b border-l border-white/60 border-zinc-400/40 bg-zinc-200/40 shadow-[inset_0_4px_10px_rgba(0,0,0,0.25)] dark:border-black/80 dark:border-white/10 dark:bg-zinc-950/60 dark:shadow-[inset_0_6px_16px_rgba(0,0,0,0.85)]" />

        <motion.div
          layout
          className="country-focus-card relative h-full w-full cursor-pointer"
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
              "glass-floating glass-refraction glass-interactive relative h-full w-full overflow-hidden rounded-xl border border-black/5 transition-all duration-500 ease-out dark:border-white/10",
              isHovered
                ? "shadow-2xl shadow-black/25 brightness-105 saturate-110 backdrop-blur-md dark:shadow-black/60"
                : "shadow-md shadow-black/10 dark:shadow-black/35",
              (softSelectedCountryId === country.originalId ||
                softSelectedCountryId === country.id) &&
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
      </div>
    );
  }
);

CountryFocusCardBuilder.displayName = "CountryFocusCard";
