// src/app/countries/page.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Globe,
  Users,
  DollarSign,
  TrendingUp,
  ChevronRight,
  Flag,
} from "lucide-react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { ixnayWiki } from "~/lib/mediawiki-service";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import { formatPopulation, formatCurrency } from "~/lib/chart-utils";

// Define and export PageCountryData type
export type PageCountryData = {
  id: string;
  name: string;
  continent: string | null;
  region: string | null;
  economicTier: string | null;
  populationTier: string | null;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  populationGrowthRate: number | null;
  adjustedGdpGrowth: number | null;
  // Fields required by CountriesGrid / CountryListCard
  // Assuming these are available on the 'country' object from the API
  landArea: number | null;
  populationDensity: number | null;
  gdpDensity: number | null;
  lastCalculated: string; // Or Date, if API provides Date objects directly. CountriesGrid expects to convert this.
};

// Helper function for type predicate filtering
const isNonNull = <T,>(value: T | null): value is T => value !== null;

// Flag cache to avoid repeated API calls
const flagCache = new Map<string, string | null>();

// Component for individual country card with flag
function CountryCard({ country }: { country: PageCountryData }) {
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [flagLoading, setFlagLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    
    const loadFlag = async () => {
      if (!country.name) {
        if (isMounted) {
          setFlagLoading(false);
        }
        return;
      }

      // Check cache first
      if (flagCache.has(country.name)) {
        if (isMounted) {
          setFlagUrl(flagCache.get(country.name) || null);
          setFlagLoading(false);
        }
        return;
      }

      try {
        const url = await ixnayWiki.getFlagUrl(country.name);
        flagCache.set(country.name, url);
        if (isMounted) {
          setFlagUrl(url);
          setFlagLoading(false);
        }
      } catch (error) {
        console.warn(`Failed to load flag for ${country.name}:`, error);
        flagCache.set(country.name, null);
        if (isMounted) {
          setFlagUrl(null);
          setFlagLoading(false);
        }
      }
    };

    void loadFlag();
    return () => {
      isMounted = false;
    };
  }, [country.name]);

  return (
    <Link href={`/countries/${country.id}`}>
      <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Flag */}
              <div className="flex-shrink-0 w-8 h-6 relative">
                {flagLoading ? (
                  <Skeleton className="w-8 h-6 rounded" />
                ) : flagUrl ? (
                  <img
                    src={flagUrl}
                    alt={`Flag of ${country.name}`}
                    className="w-8 h-6 object-cover rounded border border-border shadow-sm"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      setFlagUrl(null);
                    }}
                  />
                ) : (
                  <div className="w-8 h-6 bg-muted rounded border border-border flex items-center justify-center">
                    <Flag className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
              </div>
              
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-foreground mb-1 group-hover:text-primary transition-colors truncate">
                  {country.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {country.region && country.continent 
                    ? `${country.region}, ${country.continent}`
                    : country.continent || 'Unknown Region'
                  }
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Users className="h-4 w-4 text-blue-600 mr-2" />
                <span className="text-sm">Population</span>
              </div>
              <span className="text-sm font-medium">
                {formatPopulation(country.currentPopulation)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <DollarSign className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm">GDP per Capita</span>
              </div>
              <span className="text-sm font-medium">
                {formatCurrency(country.currentGdpPerCapita)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <TrendingUp className="h-4 w-4 text-purple-600 mr-2" />
                <span className="text-sm">Total GDP</span>
              </div>
              <span className="text-sm font-medium">
                {formatCurrency(country.currentTotalGdp)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <Badge 
              variant={
                country.economicTier === 'Advanced' ? 'default' :
                country.economicTier === 'Developed' ? 'secondary' : 'outline'
              }
              className="text-xs"
            >
              {country.economicTier || 'Unknown'}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {country.populationTier || 'Unknown'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function CountriesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContinent, setSelectedContinent] = useState<string>("all");
  const [selectedTier, setSelectedTier] = useState<string>("all");

  // Build query input, ensuring it's never undefined
  const queryInput = useMemo(() => ({
    search: searchTerm || undefined,
    continent: selectedContinent === "all" ? undefined : selectedContinent,
    economicTier: selectedTier === "all" ? undefined : selectedTier,
    limit: 50,
    offset: 0,
  }), [searchTerm, selectedContinent, selectedTier]);

  const { data: countriesResult, isLoading, error } = api.countries.getAll.useQuery(
    queryInput,
    {
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
    }
  );

  const countries = countriesResult?.countries || [];
  // Ensure processedCountries conforms to PageCountryData
  const processedCountries: PageCountryData[] = countries.map((country: any): PageCountryData => ({ // Added 'any' for country, or define a more specific API type
    id: country.id,
    name: country.name,
    continent: country.continent,
    region: country.region,
    economicTier: country.economicTier,
    populationTier: country.populationTier,
    currentPopulation: country.currentPopulation,
    currentGdpPerCapita: country.currentGdpPerCapita,
    currentTotalGdp: country.currentTotalGdp,
    populationGrowthRate: country.populationGrowthRate,
    adjustedGdpGrowth: country.adjustedGdpGrowth,
    // Add missing fields, assuming they exist on 'country' from the API response
    landArea: country.landArea,
    populationDensity: country.populationDensity,
    gdpDensity: country.gdpDensity,
    lastCalculated: country.lastCalculated,
  }));

  const currentIxTime = IxTime.getCurrentIxTime();
  const currentGameYear = IxTime.getCurrentGameYear(currentIxTime);

  // Get unique continents and tiers for filters - FIXED: Use proper type predicate
  const continents = useMemo(() => {
    const unique = new Set(processedCountries.map(c => c.continent).filter(isNonNull));
    return Array.from(unique);
  }, [processedCountries]);

  const economicTiers = useMemo(() => {
    const unique = new Set(processedCountries.map(c => c.economicTier).filter(isNonNull));
    return Array.from(unique);
  }, [processedCountries]);

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Error Loading Countries</h1>
          <p className="text-muted-foreground mt-2">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Countries Dashboard
          </h1>
          <p className="text-muted-foreground">
            Explore nations in the World
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="h-5 w-5 mr-2" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search countries..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Continent</label>
                <Select value={selectedContinent} onValueChange={setSelectedContinent}>
                  <SelectTrigger>
                    <SelectValue placeholder="All continents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All continents</SelectItem>
                    {continents.map((continent: string) => (
                      <SelectItem key={continent} value={continent}>
                        {continent}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Economic Tier</label>
                <Select value={selectedTier} onValueChange={setSelectedTier}>
                  <SelectTrigger>
                    <SelectValue placeholder="All tiers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tiers</SelectItem>
                    {economicTiers.map((tier: string) => (
                      <SelectItem key={tier} value={tier}>
                        {tier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedContinent("all");
                    setSelectedTier("all");
                  }}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Countries Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Skeleton className="h-6 w-8 rounded" />
                    <Skeleton className="h-6 w-32 rounded" />
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {processedCountries.map((country: PageCountryData) => (
                <CountryCard key={country.id} country={country} />
              ))}
            </div>

            {processedCountries.length === 0 && !isLoading && (
              <div className="text-center py-12">
                <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No countries found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search criteria to find countries.
                </p>
              </div>
            )}

            {/* Summary */}
            {processedCountries.length > 0 && (
              <Card className="mt-6">
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Countries</p>
                      <p className="text-2xl font-bold">{countriesResult?.total || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Showing</p>
                      <p className="text-2xl font-bold">{processedCountries.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Population</p>
                      <p className="text-2xl font-bold">
                        {formatPopulation(
                          processedCountries.reduce((sum: number, c: PageCountryData) => sum + c.currentPopulation, 0)
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Combined GDP</p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(
                          processedCountries.reduce((sum: number, c: PageCountryData) => sum + c.currentTotalGdp, 0)
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}