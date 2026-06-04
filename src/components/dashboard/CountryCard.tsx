"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { getCountryPath } from "~/lib/slug-utils";

interface CountryCardProps {
  country: {
    id: string;
    name: string;
    currentTotalGdp: number;
    currentPopulation: number;
    currentGdpPerCapita: number;
    economicTier: string;
    slug?: string | null;
  };
  index: number;
}

/** Leaderboard country card for the dashboard discover view. Extracted from
 * EnhancedCommandCenter.tsx (audit C2). */
export function CountryCard({ country, index }: CountryCardProps) {
  const { flagUrl } = useFlag(country.name);
  const countryPath = getCountryPath({
    id: country.id,
    name: country.name,
    slug: country.slug,
  });

  return (
    <Link href={countryPath} className="block">
      <Card
        key={country.id}
        className="glass-hierarchy-interactive relative cursor-pointer overflow-hidden transition-all duration-200 hover:scale-[1.02]"
      >
        {/* Flag Background */}
        {flagUrl && (
          <div className="absolute inset-0 opacity-10">
            <img
              src={flagUrl}
              alt={`${country.name} flag`}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <CardContent className="relative z-10 p-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white",
                index < 3
                  ? "bg-gradient-to-br from-yellow-400 to-yellow-600"
                  : "bg-gradient-to-br from-gray-400 to-gray-600"
              )}
            >
              #{index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-foreground truncate font-semibold">
                {country.name.replace(/_/g, " ")}
              </h3>
              <p className="text-muted-foreground text-sm">{country.economicTier}</p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">GDP</span>
              <span className="text-foreground font-medium">
                {formatCurrency(country.currentTotalGdp)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Pop.</span>
              <span className="text-foreground font-medium">
                {formatPopulation(country.currentPopulation)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Per Capita</span>
              <span className="font-medium text-green-600">
                {formatCurrency(country.currentGdpPerCapita)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
