// src/app/countries/_components/CountriesPageHeader.tsx
"use client";

import { Globe, BarChart3, Users } from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton"; // Assuming Skeleton is in this path
import {
  formatPopulation,
  formatCurrency
} from '~/lib/chart-utils';

interface CountriesPageHeaderProps {
  // totalCountries: number; // Removed
  isLoading?: boolean;
  // showing?: number; // Removed
  totalPopulation?: number; // Add totalPopulation prop
  combinedGdp?: number; // Add combinedGdp prop
}

export function CountriesPageHeader({
  // totalCountries, // Removed
  isLoading = false,
  // showing, // Removed
  totalPopulation, // Destructure totalPopulation prop
  combinedGdp // Destructure combinedGdp prop
}: CountriesPageHeaderProps) {
  // This function renders the header section for the countries page.
  // It displays the title, a brief description, and some quick stats like total countries.
  // It also handles a loading state by showing skeletons.

  return (
    <div className="mb-8">
      {/* Main container for the header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left side: Title and description */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
            <Globe className="h-8 w-8 md:h-10 md:w-10 mr-3 text-primary" />
            Explore Countries
          </h1>
          <p className="mt-2 text-base md:text-lg text-muted-foreground">
            Browse detailed statistics for all countries in the world.
          </p>
        </div>

        {/* Right side: Quick Stats */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Stat Card: Total Countries - Removed */}
          {/*
          <div className="flex items-center px-4 py-2 bg-card text-card-foreground rounded-lg border">
            <Users className="h-5 w-5 mr-2 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Total Countries</p>
              {isLoading ? (
                <Skeleton className="h-5 w-16 mt-1" />
              ) : (
                <div className="font-semibold text-foreground">
                  {totalCountries.toLocaleString()}
                </div>
              )}
            </div>
          </div>
          */}

          {/* Stat Card: Showing - Removed */}
          {/*
          {showing !== undefined && (
            <div className="flex items-center px-4 py-2 bg-card text-card-foreground rounded-lg border">
              <Users className="h-5 w-5 mr-2 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Showing</p>
                {isLoading ? (
                  <Skeleton className="h-5 w-16 mt-1" />
                ) : (
                  <div className="font-semibold text-foreground">
                    {showing.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          )}
          */}

          {totalPopulation !== undefined && (
            <div className="flex items-center px-4 py-2 bg-card text-card-foreground rounded-lg border">
              <Users className="h-5 w-5 mr-2 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total Population</p>
                {isLoading ? (
                  <Skeleton className="h-5 w-16 mt-1" />
                ) : (
                  <div className="font-semibold text-foreground">
                    {formatPopulation(totalPopulation)}
                  </div>
                )}
              </div>
            </div>
          )}

          {combinedGdp !== undefined && (
            <div className="flex items-center px-4 py-2 bg-card text-card-foreground rounded-lg border">
              <BarChart3 className="h-5 w-5 mr-2 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Combined GDP</p>
                {isLoading ? (
                  <Skeleton className="h-5 w-20 mt-1" />
                ) : (
                  <div className="font-semibold text-foreground">
                    {formatCurrency(combinedGdp)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stat Card: Active Stats */}
          <div className="flex items-center px-4 py-2 bg-card text-card-foreground rounded-lg border">
            <BarChart3 className="h-5 w-5 mr-2 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Active Stats</p>
              {isLoading ? (
                // Show skeleton if data is loading
                <Skeleton className="h-5 w-20 mt-1" />
              ) : (
                // Show "Real-time" text. Changed <p> to <div> to avoid hydration error.
                <div className="font-semibold text-foreground">
                  Real-time
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Default export for the component, useful for dynamic imports or if it's the primary export of the file.
export default CountriesPageHeader;
