/**
 * Country Header Component
 *
 * Displays country flag, name, slug, and selected badge.
 * Clean white design with purple accents.
 */

'use client';

import React from 'react';
import { Badge } from '~/components/ui/badge';
import UnifiedCountryFlag from '~/components/UnifiedCountryFlag';

interface CountryHeaderProps {
  name: string;
  officialName?: string | null;
  motto?: string | null;
  slug?: string | null;
  flag?: string | null;
  isNpc?: boolean;
}

export const CountryHeader = React.memo(function CountryHeader({
  name,
  officialName,
  motto,
  slug,
  flag,
  isNpc = false,
}: CountryHeaderProps) {
  return (
    <div className="relative bg-white p-4 border-b border-gray-100">
      <div className="flex items-start gap-3">
        <div className="w-12 h-9 flex-shrink-0">
          <UnifiedCountryFlag
            countryName={name}
            size="lg"
            showPlaceholder
            shadow
            border
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-gray-900 leading-tight">
              {name}
            </h3>
            <Badge
              variant="outline"
              className="text-xs px-2 py-0.5 bg-purple-100 border-purple-200 text-purple-700"
            >
              Selected
            </Badge>
            {isNpc && (
              <Badge
                variant="secondary"
                className="text-xs px-2 py-0.5 bg-gray-200 border-gray-300 text-gray-700"
              >
                NPC
              </Badge>
            )}
          </div>
          {slug && (
            <p className="text-sm text-purple-600 mt-1">/{slug}</p>
          )}
        </div>
      </div>
    </div>
  );
});
