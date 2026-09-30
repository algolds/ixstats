"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";
import { useCountryFlagRouteAware } from "~/hooks/useCountryFlagRouteAware";
import { formatFullWordNumber } from "~/app/builder/components/enhanced/steps/foundation/foundationUtils";
import { Globe, Check, Xmark as X } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { FacetContainer } from "~/components/ui/facet-container";

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

    const resolvedFlagUrl = isParentControlled ? serverFlagUrl : (flag?.flagUrl ?? null);

    // Reset error when resolved flag changes
    React.useEffect(() => {
      setImgError(false);
      // oxlint-disable-next-line
    }, [resolvedFlagUrl, country.name]);

    const isPlaceholder =
      !resolvedFlagUrl ||
      resolvedFlagUrl.includes("placeholder-flag.svg") ||
      resolvedFlagUrl.includes("placeholder");

    const isLoading = isParentControlled ? false : loading || (!flag && !error);
    const hasError = isParentControlled ? imgError : !!error || imgError;
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
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        >
          <div
            className={cn(
              "relative h-full w-full overflow-hidden rounded-xl border shadow-sm transition-[border-color,box-shadow] duration-200 ease-out group-hover:shadow-md",
              isSelected
                ? "border-amber-500 ring-2 ring-amber-500/50"
                : "border-border hover:border-foreground/30"
            )}
          >
            {/* Selected Checkmark Badge */}
            {isSelected && (
              <Badge
                className="absolute top-3 right-3 z-30 bg-amber-600 text-white"
                aria-hidden="true"
              >
                <Check className="stroke-[3]" />
              </Badge>
            )}

            {/* Contextual Confirmation Popup */}
            <AnimatePresence>
              {isSelected && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                  className="absolute inset-0 z-40"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FacetContainer
                    depth={3}
                    surface="solid"
                    className="flex h-full flex-col justify-between rounded-xl border-amber-500/60 p-3 text-center select-none sm:p-3.5"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="border-amber-500/40 text-amber-600">
                        <Check aria-hidden="true" className="stroke-[3]" />
                        Confirm
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCancelSelect?.();
                        }}
                        className="text-muted-foreground h-7 w-7 rounded-full"
                        aria-label="Cancel selection"
                      >
                        <X aria-hidden="true" className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="my-auto space-y-2">
                      <div>
                        <h4 className="text-foreground line-clamp-1 text-sm leading-tight font-semibold tracking-tight sm:text-base">
                          {country.name}
                        </h4>
                        <p className="text-muted-foreground text-xs font-medium">
                          Use as template?
                        </p>
                      </div>

                      {(country.population !== undefined || country.gdpPerCapita !== undefined) && (
                        <div className="border-border space-y-1 rounded-lg border p-2 text-left text-xs">
                          {country.population !== undefined && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Population</span>
                              <span className="text-foreground font-semibold">
                                {formatFullWordNumber(country.population)}
                              </span>
                            </div>
                          )}
                          {country.gdpPerCapita !== undefined && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">GDP per capita</span>
                              <span className="text-foreground font-semibold">
                                ${Math.round(country.gdpPerCapita).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCancelSelect?.();
                        }}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onConfirmSelect?.(country.id);
                        }}
                        className="flex-1 bg-amber-600 font-semibold text-white hover:bg-amber-600/90"
                      >
                        Yes →
                      </Button>
                    </div>
                  </FacetContainer>
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
              <div className="bg-muted absolute inset-0 flex items-center justify-center">
                <Globe aria-hidden="true" className="text-muted-foreground h-12 w-12" />
              </div>
            )}

            {/* Ambient Scrim Overlay */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-75 transition-opacity duration-200 group-hover:opacity-100" />

            {/* Persistent Country Name Label */}
            <div className="pointer-events-none absolute right-3.5 bottom-3.5 left-3.5 z-10 sm:right-4 sm:bottom-4 sm:left-4">
              <span className="text-base font-semibold tracking-tight text-white antialiased [text-shadow:0_2px_8px_rgba(0,0,0,0.75)] sm:text-lg">
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
