/**
 * National Identity Section
 *
 * Displays government type and region information.
 * Clean design with purple icons and section header.
 */

"use client";

import React, { useMemo } from "react";
import {
  RiGovernmentLine,
  RiCompassLine,
  RiShieldLine,
  RiMapLine,
  RiWaterFlashLine,
  RiTeamLine,
  RiBarChart2Line,
  RiMoneyDollarCircleLine,
  RiEarthLine,
} from "react-icons/ri";

interface NationalIdentitySectionProps {
  capitalCity?: string | null;
  governmentType?: string | null;
  currency?: string | null;
  currencySymbol?: string | null;
  continent?: string | null;
  region?: string | null;
  landArea?: number | null;
  areaSqMi?: number | null;
  coastlineKm?: number | null;
  populationDensity?: number | null;
  gdpDensity?: number | null;
  currentTotalGdp?: number | null;
  currentGdpPerCapita?: number | null;
  currentPopulation?: number | null;
}

export const NationalIdentitySection = React.memo(function NationalIdentitySection({
  capitalCity,
  governmentType,
  currency,
  currencySymbol,
  continent,
  region,
  landArea,
  areaSqMi,
  coastlineKm,
  populationDensity,
  gdpDensity,
  currentTotalGdp,
  currentGdpPerCapita,
  currentPopulation,
}: NationalIdentitySectionProps) {
  const hasIdentityData = governmentType || continent || capitalCity || currency;
  const formatNumber = (value: number, options: Intl.NumberFormatOptions = {}) =>
    new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 1,
      ...options,
    }).format(value);

  const formatCompact = (value: number, options: Intl.NumberFormatOptions = {}) =>
    new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
      ...options,
    }).format(value);

  const geographyMetrics = useMemo(() => {
    const metrics: Array<{
      id: string;
      icon: React.ComponentType<{ className?: string }>;
      label: string;
      primary: string;
      secondary?: string;
    }> = [];

    if (landArea || areaSqMi) {
      metrics.push({
        id: "land-area",
        icon: RiMapLine,
        label: "Land Area",
        primary: landArea ? `${formatNumber(landArea)} km²` : "—",
        secondary: areaSqMi ? `${formatNumber(areaSqMi)} sq mi` : undefined,
      });
    }

    if (coastlineKm) {
      metrics.push({
        id: "coastline",
        icon: RiWaterFlashLine,
        label: "Coastline",
        primary: `${formatNumber(coastlineKm)} km`,
      });
    }

    if (currentPopulation || populationDensity) {
      metrics.push({
        id: "population",
        icon: RiTeamLine,
        label: "Population",
        primary: currentPopulation ? `${formatCompact(currentPopulation)} people` : "—",
        secondary: populationDensity ? `${formatNumber(populationDensity)} ppl / km²` : undefined,
      });
    }

    if (currentTotalGdp) {
      metrics.push({
        id: "gdp",
        icon: RiBarChart2Line,
        label: "GDP (Nominal)",
        primary: `${formatCompact(currentTotalGdp, {
          style: "currency",
          currency: "USD",
        })}`,
        secondary: gdpDensity
          ? `${formatNumber(gdpDensity, {
              maximumFractionDigits: 2,
            })} USD / km²`
          : undefined,
      });
    }

    if (currentGdpPerCapita) {
      metrics.push({
        id: "gdp-per-capita",
        icon: RiMoneyDollarCircleLine,
        label: "GDP per Capita",
        primary: `${formatNumber(currentGdpPerCapita, {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        })}`,
      });
    }

    return metrics;
  }, [
    landArea,
    areaSqMi,
    coastlineKm,
    currentPopulation,
    populationDensity,
    currentTotalGdp,
    gdpDensity,
    currentGdpPerCapita,
  ]);

  if (!hasIdentityData && geographyMetrics.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <RiShieldLine className="h-4 w-4 text-purple-500" />
        <span className="text-xs font-semibold tracking-wide text-gray-900 uppercase">
          National Identity
        </span>
      </div>

      {/* Content */}
      <div className="space-y-2">
        {capitalCity && (
          <div className="flex items-start gap-3 rounded p-2 transition-colors hover:bg-purple-50/50">
            <RiEarthLine className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
            <div className="min-w-0 flex-1">
              <span className="text-xs text-gray-500">Capital</span>
              <p className="text-sm font-medium text-gray-900">{capitalCity}</p>
            </div>
          </div>
        )}

        {governmentType && (
          <div className="flex items-start gap-3 rounded p-2 transition-colors hover:bg-purple-50/50">
            <RiGovernmentLine className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
            <div className="min-w-0 flex-1">
              <span className="text-xs text-gray-500">Government</span>
              <p className="text-sm font-medium text-gray-900">{governmentType}</p>
            </div>
          </div>
        )}

        {currency && (
          <div className="flex items-start gap-3 rounded p-2 transition-colors hover:bg-purple-50/50">
            <RiMoneyDollarCircleLine className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
            <div className="min-w-0 flex-1">
              <span className="text-xs text-gray-500">Currency</span>
              <p className="text-sm font-medium text-gray-900">
                {currencySymbol ? `${currencySymbol} ` : ""}
                {currency}
              </p>
            </div>
          </div>
        )}

        {continent && (
          <div className="flex items-start gap-3 rounded p-2 transition-colors hover:bg-purple-50/50">
            <RiCompassLine className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
            <div className="min-w-0 flex-1">
              <span className="text-xs text-gray-500">Region</span>
              <p className="text-sm font-medium text-gray-900">
                {region ? `${region}, ${continent}` : continent}
              </p>
            </div>
          </div>
        )}
      </div>

      {geographyMetrics.length > 0 && (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <div className="flex items-center gap-2">
            <RiEarthLine className="h-4 w-4 text-purple-500" />
            <span className="text-xs font-semibold tracking-wide text-gray-900 uppercase">
              Geography & Economy
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {geographyMetrics.map(({ id, icon: Icon, label, primary, secondary }) => (
              <div
                key={id}
                className="flex items-start gap-3 rounded border border-purple-100/60 bg-purple-50/20 px-3 py-2"
              >
                <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] tracking-wide text-purple-500 uppercase">
                    {label}
                  </span>
                  <p className="text-sm font-medium text-gray-900">{primary}</p>
                  {secondary && <p className="mt-0.5 text-[11px] text-gray-500">{secondary}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
