/**
 * Country Header Component
 *
 * Displays country flag, name, slug, and selected badge.
 * Clean white design with purple accents.
 */

"use client";

import React from "react";
import { Badge } from "~/components/ui/badge";
import UnifiedCountryFlag from "~/components/UnifiedCountryFlag";

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
    <div className="relative border-b border-gray-100 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-12 flex-shrink-0">
          <UnifiedCountryFlag countryName={name} size="lg" showPlaceholder shadow border />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg leading-tight font-bold text-gray-900">{name}</h3>
            <Badge
              variant="outline"
              className="border-purple-200 bg-purple-100 px-2 py-0.5 text-xs text-purple-700"
            >
              Selected
            </Badge>
            {isNpc && (
              <Badge
                variant="secondary"
                className="border-gray-300 bg-gray-200 px-2 py-0.5 text-xs text-gray-700"
              >
                NPC
              </Badge>
            )}
          </div>
          {slug && <p className="mt-1 text-sm text-purple-600">/{slug}</p>}
        </div>
      </div>
    </div>
  );
});
