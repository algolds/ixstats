// src/app/countries/_components/CountriesPageHeader.tsx
"use client";

import { Globe, BarChart3, Users } from "lucide-react";

interface CountriesPageHeaderProps {
  totalCountries: number;
  isLoading?: boolean;
}

export function CountriesPageHeader({ totalCountries, isLoading = false }: CountriesPageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-[var(--color-text-primary)] flex items-center">
            <Globe className="h-10 w-10 mr-3 text-[var(--color-brand-primary)]" />
            Explore Countries
          </h1>
          <p className="mt-2 text-lg text-[var(--color-text-muted)]">
            Browse detailed economic statistics for all countries in the world.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Quick Stats */}
          <div className="flex items-center px-4 py-2 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-primary)]">
            <Users className="h-5 w-5 mr-2 text-[var(--color-info)]" />
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">Total Countries</p>
              <p className="font-semibold text-[var(--color-text-primary)]">
                {isLoading ? "Loading..." : totalCountries.toLocaleString()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center px-4 py-2 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-primary)]">
            <BarChart3 className="h-5 w-5 mr-2 text-[var(--color-success)]" />
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">Active Stats</p>
              <p className="font-semibold text-[var(--color-text-primary)]">
                {isLoading ? "..." : "Real-time"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}