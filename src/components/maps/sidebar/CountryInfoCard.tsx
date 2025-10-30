/**
 * Country Info Card - Main Orchestrator
 *
 * Displays comprehensive country information when a country is selected.
 * Clean white design with purple accents.
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { RiMapPinLine, RiBarChartBoxLine } from 'react-icons/ri';
import { CountryHeader } from './CountryHeader';
import { NationalIdentitySection } from './NationalIdentitySection';
import { GeographicStatsSection } from './GeographicStatsSection';

interface CountryInfo {
  id: string;
  name: string;
  slug: string | null;
  landArea: number | null;
  areaSqMi: number | null;
  coastlineKm: number | null;
  populationDensity: number | null;
  gdpDensity: number | null;
  currentTotalGdp: number | null;
  currentGdpPerCapita: number | null;
  currentPopulation: number | null;
  countryId: string | null;
  flag: string | null;
  coatOfArms: string | null;
  governmentType: string | null;
  capitalCity: string | null;
  currency: string | null;
  currencySymbol: string | null;
  motto: string | null;
  officialName: string | null;
  continent: string | null;
  region: string | null;
  isNpc: boolean;
}

interface CountryInfoCardProps {
  selectedCountry: CountryInfo | null;
}

export const CountryInfoCard = React.memo(function CountryInfoCard({
  selectedCountry,
}: CountryInfoCardProps) {
  // Component only renders when a country is selected (checked in parent)
  if (!selectedCountry) return null;

  // Show loading state if only name is available (placeholder)
  const isLoading = !selectedCountry.countryId;

  return (
    <Card className="bg-white border-gray-200 shadow-lg overflow-hidden">
      {/* Header Section */}
      <CardHeader className="pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <CardTitle className="text-gray-900 text-base font-semibold">
            Country Information
          </CardTitle>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Click a country on the map to view details
        </p>
      </CardHeader>

      <CardContent className="p-0">
        {/* Country Header */}
        <CountryHeader
          name={selectedCountry.name}
          officialName={selectedCountry.officialName}
          motto={selectedCountry.motto}
          slug={selectedCountry.slug}
          flag={selectedCountry.flag}
          isNpc={selectedCountry.isNpc}
        />

        {isLoading ? (
          // Loading skeleton
          <div className="p-4 space-y-4">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
            <div className="text-center text-xs text-gray-400 pt-4">
              Loading country details...
            </div>
          </div>
        ) : (
          <>
            {/* National Identity Section */}
            <div className="p-4 pb-3">
              <NationalIdentitySection
                capitalCity={selectedCountry.capitalCity}
                governmentType={selectedCountry.governmentType}
                currency={selectedCountry.currency}
                currencySymbol={selectedCountry.currencySymbol}
                continent={selectedCountry.continent}
                region={selectedCountry.region}
                landArea={selectedCountry.landArea}
                areaSqMi={selectedCountry.areaSqMi}
                coastlineKm={selectedCountry.coastlineKm}
                populationDensity={selectedCountry.populationDensity}
                gdpDensity={selectedCountry.gdpDensity}
                currentTotalGdp={selectedCountry.currentTotalGdp}
                currentPopulation={selectedCountry.currentPopulation}
                currentGdpPerCapita={selectedCountry.currentGdpPerCapita}
              />
            </div>

            {/* Geographic Stats Section */}
            <div className="p-4 pt-0 pb-3">
              <GeographicStatsSection
                landArea={selectedCountry.landArea}
                areaSqMi={selectedCountry.areaSqMi}
                coastlineKm={selectedCountry.coastlineKm}
              />
            </div>

            {/* View Country Page Button */}
            {selectedCountry.slug && (
              <div className="px-4 pb-3">
                <a
                  href={`/countries/${selectedCountry.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button className="w-full bg-purple-500 hover:bg-purple-600 text-white border-0">
                    <RiMapPinLine className="w-4 h-4 mr-2" />
                    View Country Page
                  </Button>
                </a>
              </div>
            )}

            {/* Metadata Footer */}
            {selectedCountry.countryId && (
              <div className="px-4 pb-3 border-t border-gray-100 pt-3">
                <div className="text-xs text-gray-400 text-center">
                  ID: {selectedCountry.countryId}
                </div>
              </div>
            )}

            {/* Map Statistics Section */}
            <div className="px-4 pb-4 border-t border-gray-100 pt-3">
              <div className="flex items-center gap-2">
                <RiBarChartBoxLine className="w-4 h-4 text-purple-500" />
                <span className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
                  Map Statistics
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
});
