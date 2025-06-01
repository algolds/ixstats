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
  ExternalLink
} from 'lucide-react';
import { ixnayWiki } from '~/lib/mediawiki-service';
import { getTierStyle } from '~/lib/theme-utils';
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
}

export function CountryListCard({ country }: CountryListCardProps) {
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [flagState, setFlagState] = useState<'loading' | 'loaded' | 'error'>(
    'loading'
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!country.name) {
        mounted && setFlagState('error');
        return;
      }
      mounted && setFlagState('loading');
      try {
        const url = await ixnayWiki.getFlagUrl(country.name);
        if (mounted && url) {
          setFlagUrl(url);
          setFlagState('loaded');
        } else {
          mounted && setFlagState('error');
        }
      } catch {
        mounted && setFlagState('error');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [country.name]);

  const fmtNum = (
    n: number,
    opts?: { isCurrency?: boolean; compact?: boolean }
  ) => {
    if (opts?.isCurrency) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: opts.compact ? 'compact' : 'standard'
      }).format(n);
    }
    return new Intl.NumberFormat('en-US', {
      notation: opts?.compact ? 'compact' : 'standard'
    }).format(n);
  };

  const wikiUrl = `https://ixwiki.com/wiki/${encodeURIComponent(
    country.name.replace(/ /g, '_')
  )}`;

  const gotoDetail = () => {
    window.location.href = `/countries/${country.id}`;
  };

  return (
    <div
      className="card group hover:scale-[1.02] transition-all duration-300 
      flex flex-col h-full cursor-pointer"
      onClick={gotoDetail}
    >
      <div className="p-6 flex-grow">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-12 h-9 relative flex-shrink-0">
              {flagState === 'loading' && (
                <div className="w-12 h-9 bg-[var(--color-bg-tertiary)] 
                  rounded border border-[var(--color-border-primary)] 
                  animate-pulse"
                />
              )}
              {flagState === 'loaded' && flagUrl && (
                <img
                  src={flagUrl}
                  alt={`Flag of ${country.name}`}
                  className="w-12 h-9 object-cover rounded 
                    border border-[var(--color-border-primary)]"
                  onError={() => setFlagState('error')}
                />
              )}
              {flagState === 'error' && (
                <div className="w-12 h-9 bg-muted rounded border-border 
                  flex items-center justify-center"
                >
                  <FlagIcon className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </div>
            <h3
              className="text-xl font-semibold text-[var(--color-text-primary)] 
                group-hover:text-[var(--color-brand-primary)] 
                transition-colors truncate"
              title={country.name}
            >
              {country.name}
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                window.open(wikiUrl, '_blank', 'noopener');
              }}
              aria-label={`View ${country.name} on IxWiki`}
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </Button>
            <ArrowRight
              className="h-5 w-5 text-muted-foreground 
                group-hover:text-[var(--color-brand-primary)] 
                transition-all group-hover:translate-x-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div className="flex flex-col items-center text-center">
            <Users className="h-4 w-4 mb-1 text-[var(--color-info)]" />
            <span className="text-xs text-[var(--color-text-muted)]">
              Pop
            </span>
            <span className="font-medium text-[var(--color-text-secondary)]">
              {fmtNum(country.currentPopulation, { compact: true })}
            </span>
          </div>
          <div className="flex flex-col items-center text-center">
            <TrendingUp className="h-4 w-4 mb-1 text-[var(--color-success)]" />
            <span className="text-xs text-[var(--color-text-muted)]">
              GDP p.c.
            </span>
            <span className="font-medium text-[var(--color-text-secondary)]">
              {fmtNum(country.currentGdpPerCapita, {
                isCurrency: true,
                compact: true
              })}
            </span>
          </div>
          <div className="flex flex-col items-center text-center">
            <GlobeIcon className="h-4 w-4 mb-1 text-[var(--color-chart-1)]" />
            <span className="text-xs text-[var(--color-text-muted)]">
              Total GDP
            </span>
            <span className="font-medium text-[var(--color-text-secondary)]">
              {fmtNum(country.currentTotalGdp, {
                isCurrency: true,
                compact: true
              })}
            </span>
          </div>
          <div className="flex flex-col items-center text-center">
            <Scaling className="h-4 w-4 mb-1 text-[var(--color-warning)]" />
            <span className="text-xs text-[var(--color-text-muted)]">
              Density
            </span>
            <span className="font-medium text-[var(--color-text-secondary)]">
              {country.populationDensity != null
                ? `${country.populationDensity.toFixed(1)}/km²`
                : 'N/A'}
            </span>
          </div>
        </div>

        {(country.continent || country.region) && (
          <div
            className="flex items-center justify-center text-xs 
              text-[var(--color-text-muted)] mb-4"
          >
            <LocateFixed className="h-3 w-3 mr-1 text-[var(--color-brand-secondary)]" />
            <span className="truncate">
              {country.continent || '—'}
              {country.continent && country.region ? ' - ' : ''}
              {country.region || '—'}
            </span>
          </div>
        )}
      </div>

      <CardFooter className="px-6 pb-6 pt-0 flex justify-between">
        <Badge className="text-xs">
          {country.economicTier ?? '—'}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {country.populationTier ?? '—'}
        </Badge>
      </CardFooter>
    </div>
  );
}
