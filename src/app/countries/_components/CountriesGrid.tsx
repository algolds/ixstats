// src/app/countries/_components/CountriesGrid.tsx
"use client";

import { Globe, ExternalLink } from "lucide-react"; // Added ExternalLink for potential use in CountryListCard
import { CountryListCard } from "./CountryListCard";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import type { PageCountryData } from "../page"; // Ensure this type includes country.name
// import { useFlagPreloader } from "~/hooks/useFlagPreloader"; // CountryListCard would use this
// import { useTheme } from "next-themes"; // CountryListCard would use this

interface CountriesGridProps {
  countries: PageCountryData[];
  isLoading?: boolean;
  searchTerm?: string;
}

export function CountriesGrid({ countries, isLoading = false, searchTerm = "" }: CountriesGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <Card key={i} className="flex flex-col h-full">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3 min-w-0">
                  {/* Skeleton for the Country Flag Icon */}
                  <Skeleton className="h-6 w-8 rounded" /> {/* Represents the flag */}
                  {/* Skeleton for the Country Name */}
                  <Skeleton className="h-6 w-32 rounded" />
                </div>
                {/* Skeleton for the IxWiki Link Button (e.g., an icon button) */}
                <Skeleton className="h-7 w-7 rounded-full" />
              </div>
              <Skeleton className="h-4 w-2/3 mt-1 rounded" />
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
              <Skeleton className="h-8 w-full rounded-md" />
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
      <Card className="text-center py-16 col-span-full">
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
            // The `country` prop for CountryListCard provides all necessary data.
            // CountryListCard.tsx will need to:
            // 1. Use `country.name` with the `useFlagPreloader` hook to get the flag URL.
            //    (It will also need to get the current theme using `useTheme`).
            //    Example: const { theme } = useTheme();
            //             const flagUrl = useFlagPreloader(country.name, theme as "light" | "dark");
            //             Then render: <img src={flagUrl} alt={`${country.name} flag`} className="h-6 w-8 mr-2" /> (adjust styling as needed)
            //
            // 2. Create a button/link to IxWiki:
            //    - URL: `https://ixwiki.com/${encodeURIComponent(country.name.replace(/ /g, '_'))}` (ensure proper encoding)
            //    - Render as: <Button asChild variant="outline" size="icon"><a href={wikiUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
            //      (Place this button appropriately in the card's header or footer)
            country={{
              id: country.id,
              name: country.name, // Essential for flag and IxWiki link
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
              lastCalculated: new Date(country.lastCalculated),
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