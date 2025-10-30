"use client";

import { Globe } from "lucide-react";
import { Pagination } from "~/components/ui/pagination";
import { CountryListCard } from "./CountryListCard";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { useBulkFlagCache } from "~/hooks/useBulkFlagCache";
import { useMemo } from "react";
// Define the type locally to avoid circular imports
export interface PageCountryData {
  id: string;
  name: string;
  slug?: string;
  continent: string | null;
  region: string | null;
  economicTier: string | null;
  populationTier: string | null;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  landArea: number | null;
  populationDensity: number | null;
  gdpDensity: number | null;
  lastCalculated: string;
}

interface CountriesGridProps {
  countries: PageCountryData[];
  isLoading?: boolean;
  searchTerm?: string;
  page: number;
  pageCount: number;
  onPageChangeAction: (page: number) => void;
}

export function CountriesGrid({
  countries,
  isLoading = false,
  searchTerm = "",
  page,
  pageCount,
  onPageChangeAction,
}: CountriesGridProps) {
  // Use bulk flag cache for all countries
  const countryNames = useMemo(() => countries.map((c) => c.name), [countries]);
  const { flagUrls, isLoading: flagsLoading } = useBulkFlagCache(countryNames);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-4">
              <Skeleton className="h-6 w-8 rounded" />
              <Skeleton className="mt-2 h-6 w-32 rounded" />
            </CardHeader>
            <CardContent className="h-40" />
          </Card>
        ))}
      </div>
    );
  }

  if (countries.length === 0) {
    return (
      <Card className="col-span-full py-16 text-center">
        <CardHeader>
          <Globe className="text-muted-foreground mx-auto h-16 w-16 opacity-50" />
          <CardTitle className="text-foreground mt-4 text-xl font-medium">
            {searchTerm ? "No countries match your search" : "No countries available"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
            {searchTerm
              ? `Try adjusting "${searchTerm}" or clear filters.`
              : "No data. Please upload via Admin Panel."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {countries.map((c) => (
          <CountryListCard
            key={c.id}
            country={c}
            flagUrl={flagUrls[c.name] || null}
            flagLoading={flagsLoading}
          />
        ))}
      </div>

      {pageCount > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            totalPages={pageCount}
            currentPage={page}
            onPageChangeAction={onPageChangeAction}
          />
        </div>
      )}
    </div>
  );
}
