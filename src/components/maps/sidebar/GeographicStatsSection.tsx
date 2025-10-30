/**
 * Geographic Stats Section
 *
 * Displays land area, area in square miles, and coastline information.
 * Clean design with purple accents and section header.
 */

"use client";

import React from "react";
import { formatNumberWithDecimals } from "~/lib/format-utils";
import { RiMapLine, RiRulerLine, RiCompass3Line } from "react-icons/ri";

interface GeographicStatsSectionProps {
  landArea?: number | null;
  areaSqMi?: number | null;
  coastlineKm?: number | null;
}

export const GeographicStatsSection = React.memo(function GeographicStatsSection({
  landArea,
  areaSqMi,
  coastlineKm,
}: GeographicStatsSectionProps) {
  const hasData = landArea || areaSqMi || coastlineKm;

  if (!hasData) {
    return null;
  }

  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return "N/A";
    return formatNumberWithDecimals(num, 0);
  };

  return (
    <div className="space-y-3 border-t border-gray-100 pt-3">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <RiMapLine className="h-4 w-4 text-purple-500" />
        <span className="text-xs font-semibold tracking-wide text-gray-900 uppercase">
          Geographic Data
        </span>
      </div>

      {/* Content */}
      <div className="space-y-2">
        {landArea && (
          <div className="flex items-start gap-3 rounded p-2 transition-colors hover:bg-purple-50/50">
            <RiRulerLine className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
            <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
              <span className="text-xs text-gray-500">Land Area</span>
              <span className="text-sm font-medium text-gray-900">
                {formatNumber(landArea)} km²
              </span>
            </div>
          </div>
        )}

        {areaSqMi && (
          <div className="flex items-start gap-3 rounded p-2 transition-colors hover:bg-purple-50/50">
            <RiRulerLine className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
            <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
              <span className="text-xs text-gray-500">Area</span>
              <span className="text-sm font-medium text-gray-900">
                {formatNumber(areaSqMi)} sq mi
              </span>
            </div>
          </div>
        )}

        {coastlineKm && (
          <div className="flex items-start gap-3 rounded p-2 transition-colors hover:bg-purple-50/50">
            <RiCompass3Line className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
            <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
              <span className="text-xs text-gray-500">Coastline</span>
              <span className="text-sm font-medium text-gray-900">
                {formatNumber(coastlineKm)} km
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
