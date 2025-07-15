// src/app/countries/_components/CountryListCard.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  Globe as GlobeIcon,
  ArrowRight,
  Scaling,
  LocateFixed,
  Flag as FlagIcon,
  ExternalLink,
} from 'lucide-react';
import { ixnayWiki } from '~/lib/mediawiki-service';
import { formatPopulation, formatCurrency } from '~/lib/chart-utils';
import { Button } from '~/components/ui/button';
import { CardFooter } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';

export interface CountryData {
  id: string;
  name: string;
  continent?: string | null;
  region?: string | null;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string | null;
  populationTier: string | null;
  landArea?: number | null;
  populationDensity?: number | null;
  gdpDensity?: number | null;
  lastCalculated: Date | string;
}

interface CountryListCardProps {
  country: CountryData;
  flagUrl?: string | null;
  flagLoading?: boolean;
}

export function CountryListCard({ country, flagUrl: propFlagUrl, flagLoading: propFlagLoading }: CountryListCardProps) {
  // Use props if provided, otherwise fall back to individual loading
  const [localFlagUrl, setLocalFlagUrl] = useState<string | null>(null);
  const [localFlagState, setLocalFlagState] = useState<'loading'|'loaded'|'error'>('loading');

  // Determine which flag data to use
  const flagUrl = propFlagUrl !== undefined ? propFlagUrl : localFlagUrl;
  const flagLoading = propFlagLoading !== undefined ? propFlagLoading : localFlagState === 'loading';
  const flagState = propFlagUrl !== undefined ? (propFlagUrl ? 'loaded' : 'error') : localFlagState;

  // Only load individually if props are not provided
  useEffect(() => {
    if (propFlagUrl !== undefined || propFlagLoading !== undefined) {
      return; // Use props, don't load individually
    }

    let mounted = true;
    (async () => {
      if (!country.name) {
        mounted && setLocalFlagState('error');
        return;
      }
      mounted && setLocalFlagState('loading');
      try {
        const url = await ixnayWiki.getFlagUrl(country.name);
        if (mounted) {
          if (typeof url === 'string') {
            setLocalFlagUrl(url);
            setLocalFlagState('loaded');
          } else if (url && typeof url === 'object' && 'error' in url) {
            // Handle error object (legacy case)
            setLocalFlagState('error');
          } else {
            setLocalFlagState('error');
          }
        }
      } catch {
        if (mounted) {
          setLocalFlagState('error');
        }
      }
    })();
    return () => { mounted = false; };
  }, [country.name, propFlagUrl, propFlagLoading]);

  const wikiUrl = `https://ixwiki.com/wiki/${encodeURIComponent(
    country.name.replace(/ /g, '_')
  )}`;

  const goToDetail = () => {
    window.location.href = `/countries/${country.id}`;
  };

  return (
    <div
      className="card group hover:scale-[1.01] transition-all duration-200 flex flex-col h-full cursor-pointer min-h-0"
      onClick={goToDetail}
    >
      <div className="p-3 flex-grow min-h-0">
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-6 relative flex-shrink-0">
              {flagLoading && (
                <div className="w-8 h-6 bg-[var(--color-bg-tertiary)] rounded border border-[var(--color-border-primary)] animate-pulse" />
              )}
              {!flagLoading && flagUrl && (
                <img
                  src={flagUrl}
                  alt={`Flag of ${country.name}`}
                  className="w-8 h-6 object-cover rounded border border-[var(--color-border-primary)]"
                  onError={() => {
                    if (propFlagUrl === undefined) {
                      setLocalFlagState('error');
                    }
                  }}
                />
              )}
              {!flagLoading && !flagUrl && (
                <div className="w-8 h-6 bg-muted rounded border-border flex items-center justify-center">
                  <FlagIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h3
                className="text-base font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-primary)] transition-colors truncate"
                title={country.name}
              >
                {country.name}
              </h3>
              {(country.continent || country.region) && (
                <div className="flex items-center text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate">
                  <LocateFixed className="h-3 w-3 mr-1 text-[var(--color-brand-secondary)]" />
                  <span className="truncate">
                    {country.continent || '—'}
                    {country.continent && country.region ? ' – ' : ''}
                    {country.region || '—'}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                window.open(wikiUrl, '_blank', 'noopener');
              }}
              aria-label={`View ${country.name} on IxWiki`}
              className="h-7 w-7"
            >
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <ArrowRight
              className="h-4 w-4 text-muted-foreground group-hover:text-[var(--color-brand-primary)] transition-all group-hover:translate-x-0.5"
            />
          </div>
        </div>

        {/* Compact stats row */}
        <div className="flex items-center justify-between gap-2 text-xs mb-2">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3 text-[var(--color-info)]" />
            <span>{formatPopulation(country.currentPopulation)}</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-[var(--color-success)]" />
            <span>{formatCurrency(country.currentGdpPerCapita)}</span>
          </div>
          <div className="flex items-center gap-1">
            <GlobeIcon className="h-3 w-3 text-[var(--color-chart-1)]" />
            <span>{formatCurrency(country.currentTotalGdp)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Scaling className="h-3 w-3 text-[var(--color-warning)]" />
            <span>{country.populationDensity != null ? `${country.populationDensity.toFixed(1)}/km²` : 'N/A'}</span>
          </div>
        </div>
      </div>

      <CardFooter className="px-3 pb-3 pt-0 flex justify-between items-center gap-2 min-h-0">
        <Badge className="text-[10px] px-2 py-0.5">{country.economicTier ?? '—'}</Badge>
        <Badge variant="outline" className="text-[10px] px-2 py-0.5">
          {country.populationTier ?? '—'}
        </Badge>
      </CardFooter>
    </div>
  );
}
