// src/app/countries/_components/CountriesPageHeader.tsx
"use client";

import { Globe, BarChart3, Users } from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";

interface CountriesPageHeaderProps {
  totalCountries: number;
  isLoading?: boolean;
}

export function CountriesPageHeader({ totalCountries, isLoading = false }: CountriesPageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
            <Globe className="h-8 w-8 md:h-10 md:w-10 mr-3 text-primary" />
            Explore Countries
          </h1>
          <p className="mt-2 text-base md:text-lg text-muted-foreground">
            Browse detailed statistics for all countries in the world.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Quick Stats */}
          <div className="flex items-center px-4 py-2 bg-card text-card-foreground rounded-lg border">
            <Users className="h-5 w-5 mr-2 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Total Countries</p>
              {isLoading ? (
                <Skeleton className="h-5 w-16 mt-1" />
              ) : (
                <p className="font-semibold text-foreground">
                  {totalCountries.toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center px-4 py-2 bg-card text-card-foreground rounded-lg border">
            <BarChart3 className="h-5 w-5 mr-2 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Active Stats</p>
              <p className="font-semibold text-foreground">
                {isLoading ? <Skeleton className="h-5 w-20 mt-1" /> : "Real-time"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
