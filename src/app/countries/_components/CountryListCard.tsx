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
  Flag
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
}

interface CountryListCardProps {
  country: CountryData;
}

export function CountryListCard({ country }: CountryListCardProps) {
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [flagLoading, setFlagLoading] = useState(true);

  // Load flag from MediaWiki
  useEffect(() => {
    const loadFlag = async () => {
      try {
        setFlagLoading(true);
        const url = await ixnayWiki.getFlagUrl(country.name);
        setFlagUrl(url);
      } catch (error) {
        console.warn(`Failed to load flag for ${country.name}:`, error);
      } finally {
        setFlagLoading(false);
      }
    };

    loadFlag();
  }, [country.name]);

  const formatNumber = (num: number | null | undefined, p0: boolean): string => {
    if (num == null) return '$0.00';
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPopulation = (num: number | null | undefined): string => {
    if (num == null) return '0';
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(0);
  };

  const getEconomicEfficiency = (): { rating: string; color: string; description: string } => {
    if (!country.landArea || !country.populationDensity || !country.gdpDensity) {
      return { 
        rating: 'N/A', 
        color: 'var(--color-text-muted)',
        description: 'Insufficient geographic data to calculate economic efficiency'
      };
    }
    
    const economicDensity = country.currentTotalGdp / country.landArea;
    const populationEfficiency = country.currentGdpPerCapita / country.populationDensity;
    
    // Create a composite efficiency score
    const efficiencyScore = (economicDensity / 1000000) + (populationEfficiency / 100);
    
    if (efficiencyScore > 100) return { 
      rating: 'Excellent', 
      color: 'var(--color-success)',
      description: 'Exceptional economic output per unit of land and population density'
    };
    if (efficiencyScore > 50) return { 
      rating: 'Good', 
      color: 'var(--color-info)',
      description: 'Strong economic efficiency with good resource utilization'
    };
    if (efficiencyScore > 25) return { 
      rating: 'Average', 
      color: 'var(--color-warning)',
      description: 'Moderate economic efficiency with room for improvement'
    };
    if (efficiencyScore > 10) return { 
      rating: 'Below Avg', 
      color: 'var(--color-warning-dark)',
      description: 'Below average economic efficiency, potential for optimization'
    };
    return { 
      rating: 'Poor', 
      color: 'var(--color-error)',
      description: 'Low economic efficiency, significant optimization potential'
    };
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "Advanced": return "bg-purple-100 text-purple-800 dark:bg-purple-700 dark:text-purple-100";
      case "Developed": return "bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-100";
      case "Emerging": return "bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100";
      default: return "bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100";
    }
  };

  const efficiency = getEconomicEfficiency();
  const tierStyle = getTierStyle(country.economicTier);

  return (
    <Link
      href={`/countries/${country.id}`}
      className="card group hover:scale-[1.02] transition-all duration-300 flex flex-col h-full"
    >
      {/* Header with Flag and Country Name */}
      <div className="p-6 flex-grow">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center min-w-0 flex-1">
            {/* Flag */}
            <div className="flex-shrink-0 mr-3">
              {flagLoading ? (
                <div className="w-8 h-6 bg-[var(--color-bg-tertiary)] rounded animate-pulse flex items-center justify-center">
                  <Flag className="h-3 w-3 text-[var(--color-text-muted)]" />
                </div>
              ) : flagUrl ? (
                <img
                  src={flagUrl}
                  alt={`Flag of ${country.name}`}
                  className="w-8 h-6 object-cover rounded shadow-sm border border-[var(--color-border-primary)]"
                  onError={(e) => {
                    // Fallback to icon if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              {/* Fallback flag icon */}
              <div 
                className="w-8 h-6 bg-[var(--color-bg-tertiary)] rounded flex items-center justify-center border border-[var(--color-border-primary)]"
                style={{ display: flagUrl ? 'none' : 'flex' }}
              >
                <Flag className="h-3 w-3 text-[var(--color-text-muted)]" />
              </div>
            </div>
            
            {/* Country Name */}
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-primary)] transition-colors truncate">
              {country.name}
            </h3>
          </div>
          
          <ArrowRight className="h-5 w-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-brand-primary)] transition-all group-hover:translate-x-1 flex-shrink-0" />
        </div>

        {/* Economic Stats Grid - Centered */}
        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center justify-center mb-2">
              <Users className="h-4 w-4 text-[var(--color-info)] mr-1" />
              <span className="text-[var(--color-text-muted)] text-xs">Population</span>
            </div>
            <span className="font-medium text-[var(--color-text-secondary)] text-base">
              {formatPopulation(country.currentPopulation)}
            </span>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="h-4 w-4 text-[var(--color-success)] mr-1" />
              <span className="text-[var(--color-text-muted)] text-xs">GDP p.c.</span>
            </div>
            <span className="font-medium text-[var(--color-text-secondary)] text-base">
              {formatNumber(country.currentGdpPerCapita)}
            </span>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="flex items-center justify-center mb-2">
              <Globe className="h-4 w-4 text-[var(--color-chart-1)] mr-1" />
              <span className="text-[var(--color-text-muted)] text-xs">Total GDP</span>
            </div>
            <span className="font-medium text-[var(--color-text-secondary)] text-base">
              {formatNumber(country.currentTotalGdp)}
            </span>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="flex items-center justify-center mb-2">
              <Scaling className="h-4 w-4 text-[var(--color-warning)] mr-1" />
              <span className="text-[var(--color-text-muted)] text-xs">Density</span>
            </div>
            <span className="font-medium text-[var(--color-text-secondary)] text-base">
              {country.populationDensity ? `${country.populationDensity.toFixed(1)}/km²` : 'N/A'}
            </span>
          </div>
        </div>

        {/* Geographic Info */}
        {country.landArea && (
          <div className="flex items-center justify-center text-xs text-[var(--color-text-muted)] mb-4">
            <MapPin className="h-3 w-3 mr-1" />
            <span>Land Area: {formatNumber(country.landArea, false)} km²</span>
          </div>
        )}
      </div>

      {/* Footer with Tier and Efficiency Badges */}
      <div className="px-6 py-4 bg-[var(--color-bg-tertiary)] border-t border-[var(--color-border-primary)] rounded-b-lg">
        <div className="flex items-center justify-between gap-2">
          {/* Economic Tier Badge */}
          <span className={`tier-badge ${tierStyle.className}`}>
            {country.economicTier}
          </span>
          
          {/* Economic Efficiency Badge */}
          <div className="group/tooltip relative">
            <span 
              className="px-2 py-1 rounded-full text-xs font-medium border"
              style={{ 
                color: efficiency.color,
                backgroundColor: `${efficiency.color}20`,
                borderColor: `${efficiency.color}40`
              }}
            >
              {efficiency.rating}
            </span>
            
            {/* Tooltip */}
            <div className="absolute bottom-full right-0 mb-2 hidden group-hover/tooltip:block z-10">
              <div className="bg-[var(--color-surface-blur)] text-[var(--color-text-primary)] text-xs rounded-lg p-3 shadow-xl border border-[var(--color-border-primary)] max-w-xs">
                <div className="flex items-center mb-1">
                  <Info className="h-3 w-3 mr-1" />
                  <span className="font-semibold">Economic Efficiency</span>
                </div>
                <p>{efficiency.description}</p>
                <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[var(--color-surface-blur)]"></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Population Tier (smaller, secondary info) */}
        <div className="mt-2 text-center">
          <span className="text-xs text-[var(--color-text-muted)] font-medium">
            {country.populationTier} Population
          </span>
        </div>
      </div>
    </Link>
  );
}