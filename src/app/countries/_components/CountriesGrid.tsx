// src/app/countries/_components/CountriesGrid.tsx
"use client";

import { Globe } from "lucide-react";
import { CountryListCard } from "./CountryListCard";

interface CountryData {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
  populationTier: string;
  landArea?: number | null;
  populationDensity?: number | null;
  gdpDensity?: number | null;
}

interface CountriesGridProps {
  countries: CountryData[];
  isLoading?: boolean;
  searchTerm?: string;
}

export function CountriesGrid({ countries, isLoading = false, searchTerm = "" }: CountriesGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="p-6">
              {/* Header skeleton */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-8 h-6 bg-[var(--color-bg-tertiary)] rounded mr-3"></div>
                  <div className="h-6 bg-[var(--color-bg-tertiary)] rounded w-32"></div>
                </div>
                <div className="w-5 h-5 bg-[var(--color-bg-tertiary)] rounded"></div>
              </div>
              
              {/* Stats grid skeleton */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex flex-col items-center text-center">
                    <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-16 mb-2"></div>
                    <div className="h-5 bg-[var(--color-bg-tertiary)] rounded w-20"></div>
                  </div>
                ))}
              </div>
              
              {/* Geographic info skeleton */}
              <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-24 mx-auto mb-4"></div>
            </div>
            
            {/* Footer skeleton */}
            <div className="px-6 py-4 bg-[var(--color-bg-tertiary)] border-t border-[var(--color-border-primary)] rounded-b-lg">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="h-6 bg-[var(--color-bg-accent)] rounded w-20"></div>
                <div className="h-6 bg-[var(--color-bg-accent)] rounded w-16"></div>
              </div>
              <div className="h-4 bg-[var(--color-bg-accent)] rounded w-24 mx-auto"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (countries.length === 0) {
    return (
      <div className="text-center py-16">
        <Globe className="mx-auto h-16 w-16 text-[var(--color-text-muted)] opacity-50" />
        <h3 className="mt-4 text-xl font-medium text-[var(--color-text-primary)]">
          {searchTerm ? "No countries match your search" : "No countries available"}
        </h3>
        <p className="mt-2 text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
          {searchTerm ? (
            <>
              Try adjusting your search terms "{searchTerm}" or check the filters you've applied.
            </>
          ) : (
            "Upload an Excel roster file via the IxStats Dashboard to get started with country data."
          )}
        </p>
        
        {!searchTerm && (
          <div className="mt-6">
            <button
              onClick={() => window.location.href = '/admin'}
              className="btn-primary"
            >
              Go to Admin Panel
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Grid Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {countries.map((country) => (
          <CountryListCard
            key={country.id}
            country={country}
          />
        ))}
      </div>
      
      {/* Load More / Pagination could go here in the future */}
      {countries.length > 0 && (
        <div className="text-center text-sm text-[var(--color-text-muted)] mt-8">
          Showing {countries.length} countries
        </div>
      )}
    </div>
  );
}