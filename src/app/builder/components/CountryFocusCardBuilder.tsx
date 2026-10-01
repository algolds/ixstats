"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";
import { useCountryFlagRouteAware } from "~/hooks/useCountryFlagRouteAware";
import { formatFullWordNumber } from "~/app/builder/components/enhanced/steps/foundation/foundationUtils";
import { Globe, Check, Xmark as X } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { IMAGE_SCRIM } from "~/app/builder/lib/image-scrim";

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
      <div className={cn("rounded-row relative overflow-visible", aspectClass)}>
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
              "rounded-row shadow-card group-hover:shadow-floating relative h-full w-full overflow-hidden border transition-[border-color,box-shadow] duration-200 ease-out",
              isSelected
                ? "border-tint ring-tint/50 ring-2"
                : "border-separator hover:border-label-tertiary"
            )}
          >
            {/* Selected Checkmark Badge */}
            {isSelected && (
              <Badge
                className="bg-tint text-on-tint absolute top-3 right-3 z-30"
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
                  <div className="bg-surface-elevated border-tint rounded-row shadow-floating flex h-full flex-col justify-between border p-3 text-center select-none">
                    <div className="flex items-center justify-between">
                      <Badge variant="tinted">
                        <Check aria-hidden="true" className="stroke-[3]" />
                        Confirm
                      </Badge>
                      <Button
                        type="button"
                        variant="plain"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCancelSelect?.();
                        }}
                        className="text-label-secondary rounded-full"
                        aria-label="Cancel selection"
                      >
                        <X aria-hidden="true" />
                      </Button>
                    </div>

                    <div className="my-auto space-y-2">
                      <div>
                        <h4 className="text-headline text-label line-clamp-1">{country.name}</h4>
                        <p className="text-label-secondary text-caption">Use as template?</p>
                      </div>

                      {(country.population !== undefined || country.gdpPerCapita !== undefined) && (
                        <div className="bg-surface-secondary rounded-control text-footnote space-y-1 p-2 text-left tabular-nums">
                          {country.population !== undefined && (
                            <div className="flex items-center justify-between">
                              <span className="text-label-secondary">Population</span>
                              <span className="text-label font-semibold">
                                {formatFullWordNumber(country.population)}
                              </span>
                            </div>
                          )}
                          {country.gdpPerCapita !== undefined && (
                            <div className="flex items-center justify-between">
                              <span className="text-label-secondary">GDP per capita</span>
                              <span className="text-label font-semibold">
                                ${Math.round(country.gdpPerCapita).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        type="button"
                        variant="bordered"
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
                        className="flex-1"
                      >
                        Yes →
                      </Button>
                    </div>
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
              <div className="bg-fill-3 absolute inset-0 flex items-center justify-center">
                <Globe aria-hidden="true" className="text-label-secondary h-12 w-12" />
              </div>
            )}

            {/* Persistent Country Name Label — a flat image scrim band (fixed white on black) */}
            <div
              className={cn(
                "pointer-events-none absolute inset-x-0 bottom-0 z-10 px-3 py-2",
                IMAGE_SCRIM
              )}
            >
              <span className="text-headline line-clamp-2">{country.name}</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }
);

CountryFocusCardBuilder.displayName = "CountryFocusCard";
