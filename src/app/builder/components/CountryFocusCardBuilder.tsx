"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";
import { useCountryFlagRouteAware } from "~/hooks/useCountryFlagRouteAware";
import { Globe, Check, Xmark as X } from "iconoir-react";

export interface CountryCardData {
  id: string;
  name: string;
  originalId?: string;
  flagUrl?: string;
  population?: number;
  gdpPerCapita?: number;
}

interface CountryFocusCardProps {
  country: CountryCardData;
  onHoverChange: (countryId: string | null) => void;
  onCountryClick?: (countryId: string) => void;
  onConfirmSelect?: (countryId: string) => void;
  onCancelSelect?: () => void;
  cardSize?: "default" | "small";
  softSelectedCountryId?: string | null;
  /** Pre-resolved flag URL from server cache. If provided, skips browser-side Commons API call. */
  flagUrl?: string | null;
}

function formatFullWordNumber(num: number): string {
  if (num >= 1_000_000_000) {
    const formatted = (num / 1_000_000_000).toFixed(1).replace(/\.0$/, "");
    return `${formatted} billion`;
  }
  if (num >= 1_000_000) {
    const formatted = (num / 1_000_000).toFixed(1).replace(/\.0$/, "");
    return `${formatted} million`;
  }
  if (num >= 1_000) {
    const formatted = (num / 1_000).toFixed(1).replace(/\.0$/, "");
    return `${formatted} thousand`;
  }
  return num.toLocaleString();
}

export const CountryFocusCardBuilder = React.memo<CountryFocusCardProps>(
  ({
    country,
    onHoverChange,
    onCountryClick,
    onConfirmSelect,
    onCancelSelect,
    cardSize = "default",
    softSelectedCountryId,
    flagUrl: serverFlagUrl,
  }) => {
    const [imgError, setImgError] = useState(false);

    // If flagUrl prop is provided by parent (even if null while resolving),
    // skip individual per-card tRPC queries to prevent batch request HTTP 431 errors.
    const isParentControlled = serverFlagUrl !== undefined;
    const shouldFetchIndividually = !isParentControlled;

    const { flag, loading, error } = useCountryFlagRouteAware(
      shouldFetchIndividually ? country.name : ""
    );

    const resolvedFlagUrl = isParentControlled
      ? serverFlagUrl
      : (flag?.flagUrl ?? null);

    // Reset error when resolved flag changes
    React.useEffect(() => {
      setImgError(false);
      // oxlint-disable-next-line
    }, [resolvedFlagUrl, country.name]);

    const isPlaceholder =
      !resolvedFlagUrl ||
      resolvedFlagUrl.includes("placeholder-flag.svg") ||
      resolvedFlagUrl.includes("placeholder");

    const isLoading = isParentControlled ? false : (loading || (!flag && !error));
    const hasError = isParentControlled ? imgError : (!!error || imgError);
    const showFlag = Boolean(resolvedFlagUrl && !imgError && !isPlaceholder);

    const aspectClass = cardSize === "small" ? "aspect-square" : "aspect-[3/4]";
    const isSelected =
      softSelectedCountryId === country.originalId || softSelectedCountryId === country.id;

    return (
      <div className={cn("relative overflow-visible rounded-xl", aspectClass)}>
        <motion.div
          className="group relative h-full w-full cursor-pointer select-none"
          data-cuelume-press
          onMouseEnter={() => onHoverChange(country.id)}
          onMouseLeave={() => onHoverChange(null)}
          onClick={() => onCountryClick?.(country.id)}
          whileHover={{
            scale: 1.025,
            y: -4,
          }}
          whileTap={{ scale: 0.98 }}
          transition={{
            type: "spring",
            stiffness: 380,
            damping: 30,
          }}
        >
          <div
            className={cn(
              "relative h-full w-full overflow-hidden rounded-xl border transition-all duration-200 ease-out",
              "shadow-md shadow-black/10 dark:shadow-black/35",
              "group-hover:shadow-2xl group-hover:shadow-black/25 group-hover:brightness-105 group-hover:saturate-110 dark:group-hover:shadow-black/60",
              isSelected
                ? "border-amber-500 bg-amber-500/10 shadow-2xl ring-2 shadow-amber-500/20 ring-amber-400/60 dark:border-amber-400"
                : "border-border/40 hover:border-border/80"
            )}
          >
            {/* Selected Checkmark Badge */}
            {isSelected && (
              <div className="absolute top-3 right-3 z-30 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-foreground shadow-md ring-2 shadow-amber-500/25 ring-white/20">
                <Check className="h-3.5 w-3.5 stroke-[3]" />
              </div>
            )}

            {/* Contextual Confirmation Popup */}
            <AnimatePresence>
              {isSelected && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  className="absolute inset-0 z-40 flex flex-col justify-between rounded-xl border-2 border-amber-500/80 bg-card/95 p-3 text-center shadow-2xl backdrop-blur-md select-none sm:p-3.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                      <span>Confirm</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCancelSelect?.();
                      }}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
                      aria-label="Cancel selection"
                      data-cuelume-press
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="my-auto space-y-2">
                    <div>
                      <h4 className="line-clamp-1 text-sm sm:text-base font-bold tracking-tight text-foreground leading-tight">
                        {country.name}
                      </h4>
                      <p className="text-[11px] font-medium text-muted-foreground">
                        Use as template?
                      </p>
                    </div>

                    {(country.population !== undefined || country.gdpPerCapita !== undefined) && (
                      <div className="rounded-lg border border-border/40 bg-muted/40 p-2 space-y-1 text-left text-[10px] sm:text-[11px]">
                        {country.population !== undefined && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Population</span>
                            <span className="font-semibold text-foreground">
                              {formatFullWordNumber(country.population)}
                            </span>
                          </div>
                        )}
                        {country.gdpPerCapita !== undefined && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">GDP per capita</span>
                            <span className="font-semibold text-foreground">
                              ${Math.round(country.gdpPerCapita).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 pt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCancelSelect?.();
                      }}
                      className="flex-1 rounded-lg border border-border/40 bg-muted/50 py-1.5 px-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.96] cursor-pointer"
                      data-cuelume-press
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onConfirmSelect?.(country.id);
                      }}
                      className="flex-1 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 py-1.5 px-2 text-xs font-bold text-foreground shadow-md shadow-amber-500/20 transition-all hover:from-amber-400 hover:to-yellow-400 active:scale-[0.96] cursor-pointer"
                      data-cuelume-press
                    >
                      Yes →
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>


            {/* Flag Background */}
            {showFlag ? (
              <img
                src={resolvedFlagUrl ?? undefined}
                alt={`Flag of ${country.name}`}
                className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300"
                style={{
                  opacity: isLoading || hasError ? 0.2 : 1,
                }}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-card/70">
                <Globe className="h-12 w-12 text-muted-foreground" />
              </div>
            )}

            {/* Ambient Scrim Overlay */}
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-75 transition-opacity duration-200 group-hover:opacity-100"
            />

            {/* Persistent Country Name Label */}
            <div className="pointer-events-none absolute right-3.5 bottom-3.5 left-3.5 z-10 sm:right-4 sm:bottom-4 sm:left-4">
              <span className="text-base sm:text-lg font-semibold text-white tracking-tight antialiased [text-shadow:0_2px_8px_rgba(0,0,0,0.75)]">
                {country.name}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }
);

CountryFocusCardBuilder.displayName = "CountryFocusCard";
