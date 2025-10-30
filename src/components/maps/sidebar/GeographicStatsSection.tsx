/**
 * Geographic Stats Section
 *
 * Displays land area, area in square miles, and coastline information.
 * Clean design with purple accents and section header.
 */

'use client';

import React from 'react';
import { formatNumberWithDecimals } from '~/lib/format-utils';
import {
  RiMapLine,
  RiRulerLine,
  RiCompass3Line,
} from 'react-icons/ri';

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
    if (num === null || num === undefined) return 'N/A';
    return formatNumberWithDecimals(num, 0);
  };

  return (
    <div className="space-y-3 pt-3 border-t border-gray-100">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <RiMapLine className="w-4 h-4 text-purple-500" />
        <span className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
          Geographic Data
        </span>
      </div>

      {/* Content */}
      <div className="space-y-2">
        {landArea && (
          <div className="flex items-start gap-3 p-2 rounded hover:bg-purple-50/50 transition-colors">
            <RiRulerLine className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
              <span className="text-xs text-gray-500">Land Area</span>
              <span className="text-sm text-gray-900 font-medium">
                {formatNumber(landArea)} km²
              </span>
            </div>
          </div>
        )}

        {areaSqMi && (
          <div className="flex items-start gap-3 p-2 rounded hover:bg-purple-50/50 transition-colors">
            <RiRulerLine className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
              <span className="text-xs text-gray-500">Area</span>
              <span className="text-sm text-gray-900 font-medium">
                {formatNumber(areaSqMi)} sq mi
              </span>
            </div>
          </div>
        )}

        {coastlineKm && (
          <div className="flex items-start gap-3 p-2 rounded hover:bg-purple-50/50 transition-colors">
            <RiCompass3Line className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
              <span className="text-xs text-gray-500">Coastline</span>
              <span className="text-sm text-gray-900 font-medium">
                {formatNumber(coastlineKm)} km
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
