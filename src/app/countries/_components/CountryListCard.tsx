// src/app/countries/_components/CountryListCard.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  TrendingUp,
  Globe,
  ArrowRight,
  MapPin,
  Scaling,
  Info,
  Flag,
  LocateFixed // Icon for continent/region
} from "lucide-react";
import { ixnayWiki } from "~/lib/mediawiki-service";
import { getTierStyle } from "~/lib/theme-utils";

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
  continent?: string | null;
  region?: string | null;
  lastCalculated: Date; // Added to match usage in CountriesGrid
}

interface CountryListCardProps {
  country: CountryData;
}

type FlagState = 'loading' | 'loaded' | 'error';

export function CountryListCard({ country }: CountryListCardProps) {
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [flagState, setFlagState] = useState<FlagState>('loading');

  useEffect(() => {
    let isMounted = true;
    const loadFlag = async () => {
      if (!country.name) {
          setFlagState('error');
          return;
      }
      try {
        setFlagState('loading');
        const url = await ixnayWiki.getFlagUrl(country.name);
        if (isMounted) {
          if (url) {
            setFlagUrl(url);
            // Image onLoad/onError will set final state
          } else {
            setFlagState('error');
          }
        }
      } catch (error) {
        console.warn(`Failed to load flag for ${country.name}:`, error);
        if (isMounted) {
          setFlagState('error');
        }
      }
    };

    loadFlag();
    return () => { isMounted = false; };
  }, [country.name]);

  // Helper function to format numbers (could be moved to a utils file)
  const formatNumber = (num: number | null | undefined, isCurrency = true, precision = 2, compact = true): string => {
    if (num == null || isNaN(num)) return isCurrency ? '$0.00' : '0';
    if (compact) {
      if (Math.abs(num) >= 1e12) return `${isCurrency ? '$' : ''}${(num / 1e12).toFixed(precision)}T`;
      if (Math.abs(num) >= 1e9) return `${isCurrency ? '$' : ''}${(num / 1e9).toFixed(precision)}B`;
      if (Math.abs(num) >= 1e6) return `${isCurrency ? '$' : ''}${(num / 1e6).toFixed(precision)}M`;
      if (Math.abs(num) >= 1e3) return `${isCurrency ? '$' : ''}${(num / 1e3).toFixed(precision)}K`;
    }
    return `${isCurrency ? '$' : ''}${num.toLocaleString(undefined, {minimumFractionDigits: isCurrency ? precision : 0, maximumFractionDigits: precision })}`;
  };
  
  const formatPopulation = (pop: number | null | undefined): string => {
    if (pop == null || isNaN(pop)) return '0';
    if (pop >= 1e9) return `${(pop / 1e9).toFixed(1)}B`;
    if (pop >= 1e6) return `${(pop / 1e6).toFixed(1)}M`;
    if (pop >= 1e3) return `${(pop / 1e3).toFixed(0)}K`;
    return pop.toLocaleString();
  };
  
  const getEconomicEfficiency = (): { rating: string; color: string; description: string } => {
    if (!country.landArea || !country.populationDensity || !country.gdpDensity || country.landArea === 0 || country.populationDensity === 0) {
      return {
        rating: 'N/A',
        color: 'var(--color-text-muted)',
        description: 'Insufficient geographic data to calculate economic efficiency'
      };
    }
    const economicDensity = country.currentTotalGdp / country.landArea;
    const populationEfficiency = country.currentGdpPerCapita / country.populationDensity;
    // Note: The efficiencyScore calculation might need domain-specific scaling factors
    // to produce a balanced distribution of ratings.
    // The current constants (1000000, 100) are kept from the original.
    const efficiencyScore = (economicDensity / 1000000) + (populationEfficiency / 100);

    if (efficiencyScore > 100) return { rating: 'Excellent', color: 'var(--color-success)', description: 'Exceptional economic output per unit of land and population density' };
    if (efficiencyScore > 50) return { rating: 'Good', color: 'var(--color-info)', description: 'Strong economic efficiency with good resource utilization' };
    if (efficiencyScore > 25) return { rating: 'Average', color: 'var(--color-warning)', description: 'Moderate economic efficiency' };
    if (efficiencyScore > 10) return { rating: 'Below Avg', color: 'var(--color-warning-dark)', description: 'Below average economic efficiency' };
    return { rating: 'Poor', color: 'var(--color-error)', description: 'Low economic efficiency' };
  };
  
  const efficiency = getEconomicEfficiency();
  const tierStyle = getTierStyle(country.economicTier);

  const stats = [
    { icon: Users, label: "Population", value: formatPopulation(country.currentPopulation), color: "var(--color-info)" },
    { icon: TrendingUp, label: "GDP p.c.", value: formatNumber(country.currentGdpPerCapita, true, 2, true), color: "var(--color-success)" },
    { icon: Globe, label: "Total GDP", value: formatNumber(country.currentTotalGdp, true, 1, true), color: "var(--color-chart-1)" },
    { icon: Scaling, label: "Density", value: country.populationDensity ? `${country.populationDensity.toFixed(1)}/km²` : 'N/A', color: "var(--color-warning)" }
  ];

  return (
    <Link
      href={`/countries/${country.id}`}
      className="card group hover:scale-[1.02] transition-all duration-300 flex flex-col h-full"
    >
      <div className="p-6 flex-grow">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center min-w-0 flex-1">
            <div className="flex-shrink-0 mr-3 w-8 h-6 relative">
              {flagState === 'loading' && (
                <div className="w-8 h-6 bg-[var(--color-bg-tertiary)] rounded animate-pulse flex items-center justify-center border border-[var(--color-border-primary)] absolute inset-0 z-10">
                  <Flag className="h-3 w-3 text-[var(--color-text-muted)]" />
                </div>
              )}
              {flagUrl && (
                <img
                  src={flagUrl}
                  alt={`Flag of ${country.name}`}
                  className="w-8 h-6 object-cover rounded shadow-sm border border-[var(--color-border-primary)]"
                  style={{ visibility: flagState === 'loaded' ? 'visible' : 'hidden', position: 'absolute', top:0, left:0 }}
                  onLoad={() => setFlagState('loaded')}
                  onError={() => setFlagState('error')}
                />
              )}
              {(flagState === 'error' || (flagState === 'loading' && !flagUrl)) && ( 
                <div className="w-8 h-6 bg-[var(--color-bg-tertiary)] rounded flex items-center justify-center border border-[var(--color-border-primary)] absolute inset-0 z-0">
                  <Flag className="h-3 w-3 text-[var(--color-text-muted)]" />
                </div>
              )}
            </div>
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-primary)] transition-colors truncate" title={country.name}>
              {country.name}
            </h3>
          </div>
          <ArrowRight className="h-5 w-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-brand-primary)] transition-all group-hover:translate-x-1 flex-shrink-0" />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center mb-1">
                  <Icon className="h-4 w-4 mr-1" style={{ color: stat.color }} />
                  <span className="text-[var(--color-text-muted)] text-xs">{stat.label}</span>
                </div>
                <span className="font-medium text-[var(--color-text-secondary)] text-base truncate" title={stat.value}>
                  {stat.value}
                </span>
              </div>
            );
          })}
        </div>
        
        {(country.continent || country.region) && (
             <div className="flex items-center justify-center text-xs text-[var(--color-text-muted)] mb-4">
                <LocateFixed className="h-3 w-3 mr-1.5 text-[var(--color-brand-secondary)]" />
                <span className="truncate" title={`${country.continent || ''}${country.continent && country.region ? ' - ' : ''}${country.region || ''}`}>
                    {country.continent || 'N/A Continent'}
                    {country.continent && country.region && " - "}
                    {country.region || (country.continent ? '' : 'N/A Region')}
                </span>
            </div>
        )}

        {country.landArea && (
          <div className="flex items-center justify-center text-xs text-[var(--color-text-muted)] mb-4">
            <MapPin className="h-3 w-3 mr-1" />
            {/* Using formatNumber for landArea for consistency, with compact=false and no currency */}
            <span>Land Area: {formatNumber(country.landArea, false, 0, false)} km²</span>
          </div>
        )}
      </div>

      <div className="px-6 py-4 bg-[var(--color-bg-tertiary)] border-t border-[var(--color-border-primary)] rounded-b-lg">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className={`tier-badge ${tierStyle.className}`}>
            {country.economicTier}
          </span>
          <div className="group/tooltip relative">
            <span
              className="px-2 py-1 rounded-full text-xs font-medium border"
              style={{
                color: efficiency.color,
                backgroundColor: `${efficiency.color}20`, // Assuming var colors are hex for opacity
                borderColor: `${efficiency.color}40`
              }}
            >
              {efficiency.rating}
            </span>
            <div className="absolute bottom-full right-0 mb-2 hidden group-hover/tooltip:block z-10">
              <div className="bg-[var(--color-surface-blur)] text-[var(--color-text-primary)] text-xs rounded-lg p-3 shadow-xl border border-[var(--color-border-primary)] max-w-xs">
                <div className="flex items-center mb-1">
                  <Info className="h-3 w-3 mr-1" />
                  <span className="font-semibold">Economic Efficiency</span>
                </div>
                <p>{efficiency.description}</p>
                {/* Tooltip arrow styling might need CSS if var(--color-surface-blur) is not a simple color */}
                <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent" style={{borderTopColor: 'var(--color-surface-blur)'}}></div>
              </div>
            </div>
          </div>
        </div>
        <div className="text-center">
          <span className="text-xs text-[var(--color-text-muted)] font-medium">
            {country.populationTier} Population
          </span>
        </div>
      </div>
    </Link>
  );
}