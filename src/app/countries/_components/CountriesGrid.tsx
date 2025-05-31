// src/app/countries/_components/CountriesGrid.tsx
"use client";

import { Globe } from "lucide-react";
import { CountryListCard } from "./CountryListCard"; // Assuming this is already converted
import { Skeleton } from "~/components/ui/skeleton"; // For loading state
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card"; // For "No countries" message
import { Button } from "~/components/ui/button"; // For "No countries" message button
import type { PageCountryData } from "../page"; // Import the specific type
import { IxTime } from "~/lib/ixtime"; // Assuming IxTime provides getInGameEpoch static method

interface CountriesGridProps {
  countries: PageCountryData[]; // Use the specific type
  isLoading?: boolean;
  searchTerm?: string;
}

// Assuming PageCountryData has a structure compatible with the properties being accessed.
// For example, it should include: id, name, continent, region, currentPopulation,
// currentGdpPerCapita, currentTotalGdp, economicTier, populationTier, landArea,
// populationDensity, gdpDensity, and lastCalculated.

export function CountriesGrid({ countries, isLoading = false, searchTerm = "" }: CountriesGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 12 }).map((_, i) => (
          // Using shadcn Skeleton within a Card structure for consistent loading appearance
          <Card key={i} className="flex flex-col h-full">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3 min-w-0">
                  <Skeleton className="h-6 w-8 rounded" /> {/* Flag skeleton */}
                  <Skeleton className="h-6 w-32 rounded" /> {/* Title skeleton */}
                </div>
                <Skeleton className="h-7 w-7 rounded-full" /> {/* Button skeleton */}
              </div>
              <Skeleton className="h-4 w-2/3 mt-1 rounded" /> {/* Description skeleton */}
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mb-4">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="space-y-1">
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-5 w-20 rounded" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-8 w-full rounded-md" /> {/* Efficiency badge skeleton */}
            </CardContent>
            <CardFooter className="pt-4">
              <div className="flex justify-between items-center w-full">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-4 w-24 rounded" />
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (countries.length === 0) {
    return (
      <Card className="text-center py-16 col-span-full"> {/* Ensure it spans full width if in a grid */}
        <CardHeader>
            <Globe className="mx-auto h-16 w-16 text-muted-foreground opacity-50" />
            <CardTitle className="mt-4 text-xl font-medium text-foreground">
                 {searchTerm ? "No countries match your search" : "No countries available"}
            </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            {searchTerm ? (
              <>
                Try adjusting your search terms "{searchTerm}" or check the filters you've applied.
              </>
            ) : (
              "Upload an Excel roster file via the Admin Panel to get started with country data."
            )}
          </p>
          {!searchTerm && (
            <Button variant="secondary" className="mt-6" onClick={() => window.location.href = '/admin'}>
              Go to Admin Panel
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {countries.map((country) => (
          <CountryListCard
            key={country.id}
            // The `country` prop for CountryListCard now expects `lastCalculated` as a Date.
            // Other fields like baselinePopulation, maxGdpGrowthRate, areaSqMi etc.,
            // are passed but are not part of the defined CountryData interface in CountryListCard
            // (except for those explicitly listed there). This doesn't cause the *reported*
            // error but means they are not type-checked for CountryListCard.
            // For a cleaner setup, CountryData should reflect all used props or CountryListCard
            // should expect a more comprehensive type like a subset of CountryStats.
            country={{
              id: country.id,
              name: country.name,
              continent: country.continent,
              region: country.region,
              currentPopulation: country.currentPopulation,
              currentGdpPerCapita: country.currentGdpPerCapita,
              currentTotalGdp: country.currentTotalGdp,
              economicTier: country.economicTier,
              populationTier: country.populationTier,
              landArea: country.landArea,
              populationDensity: country.populationDensity,
              gdpDensity: country.gdpDensity,
              lastCalculated: new Date(country.lastCalculated), // This now matches CountryData

              // These fields are passed but are not in CountryListCard's CountryData interface:
              // baselinePopulation: country.currentPopulation,
              // baselineGdpPerCapita: country.currentGdpPerCapita,
              // maxGdpGrowthRate: 0.05,
              // adjustedGdpGrowth: 0.03,
              // populationGrowthRate: 0.01,
              // localGrowthFactor: 1.0,
              // baselineDate: new Date(IxTime.getInGameEpoch()),
              // projected2040Population: 0,
              // projected2040Gdp: 0,
              // projected2040GdpPerCapita: 0,
              // actualGdpGrowth: 0,
              // areaSqMi: country.landArea ? country.landArea / 2.59 : null,
            }}
          />
        ))}
      </div>

      {countries.length > 0 && (
        <div className="text-center text-sm text-muted-foreground mt-8">
          Showing {countries.length} countries
        </div>
      )}
    </div>
  );
}