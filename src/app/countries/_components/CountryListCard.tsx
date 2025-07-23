// src/app/countries/_components/CountryListCard.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { flagService } from '~/lib/flag-service';
import { formatPopulation, formatCurrency } from '~/lib/chart-utils';
import { Button } from '~/components/ui/button';
import { CardFooter } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { GlassCard } from '~/components/ui/enhanced-card';
import { FastAverageColor } from 'fast-average-color';
import { useRef } from 'react';
import { cn } from '~/lib/utils';

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

// Add a hook to extract the dominant color from the flag
function useDominantColor(imageUrl: string | null | undefined) {
  const [color, setColor] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!imageUrl) return;
    const fac = new FastAverageColor();
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
      const result = fac.getColor(img);
      setColor(result.hex);
    };
    img.onerror = () => setColor(null);
    imgRef.current = img;
    return () => { imgRef.current = null; };
  }, [imageUrl]);
  return color;
}

export function CountryListCard({ country, flagUrl: propFlagUrl, flagLoading: propFlagLoading }: CountryListCardProps) {
  const router = useRouter();
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
        // Try cached flag first for immediate response
        const cachedUrl = flagService.getCachedFlagUrl(country.name);
        if (cachedUrl && mounted) {
          setLocalFlagUrl(cachedUrl);
          setLocalFlagState('loaded');
          return;
        }

        // Fetch if not cached
        const url = await flagService.getFlagUrl(country.name);
        if (mounted) {
          if (url) {
            setLocalFlagUrl(url);
            setLocalFlagState('loaded');
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

  const dominantColor = useDominantColor(flagUrl);

  const wikiUrl = `https://ixwiki.com/wiki/${encodeURIComponent(
    country.name.replace(/ /g, '_')
  )}`;

  const goToDetail = () => {
    router.push(`/countries/${country.id}`);
  };

  return (
    <GlassCard
      variant="diplomatic"
      hover="lift"
      className={cn(
        "group hover:scale-[1.01] transition-all duration-200 flex flex-col h-full cursor-pointer min-h-0 overflow-hidden",
        dominantColor && "border-2",
        "glass-hover-animate"
      )}
      style={dominantColor ? { boxShadow: `0 0 0 3px ${dominantColor}55, 0 4px 24px ${dominantColor}33` } : undefined}
      onClick={goToDetail}
    >
      {/* Flag as blurred glassy background with waving animation */}
      {flagUrl && (
        <div
          className="absolute inset-0 z-0 flag-waving-bg"
          style={{
            backgroundImage: `url(${flagUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(12px) brightness(0.7) saturate(1.2)',
            opacity: 0.7,
            pointerEvents: 'none',
          }}
        />
      )}
      {/* Animated overlay using dominant color */}
      {dominantColor && (
        <div
          className="absolute inset-0 z-10 pointer-events-none animate-pulse"
          style={{
            background: `radial-gradient(circle at 70% 30%, ${dominantColor}33 0%, transparent 70%)`,
            mixBlendMode: 'lighten',
          }}
        />
      )}
      <div className="relative z-20 p-3 flex-grow min-h-0">
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

      <CardFooter className="relative z-20 px-3 pb-3 pt-0 flex justify-between items-center gap-2 min-h-0">
        <Badge className="text-[10px] px-2 py-0.5">{country.economicTier ?? '—'}</Badge>
        <Badge variant="outline" className="text-[10px] px-2 py-0.5">
          {country.populationTier ?? '—'}
        </Badge>
      </CardFooter>
      <style jsx>{`
        .flag-waving-bg {
          animation: flag-wave 6s ease-in-out infinite;
          will-change: transform;
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0.7) 80%, transparent 100%);
        }
        @keyframes flag-wave {
          0% { transform: skewY(0deg) scaleX(1) translateY(0); }
          10% { transform: skewY(-2deg) scaleX(1.01) translateY(-1px); }
          20% { transform: skewY(2deg) scaleX(0.99) translateY(1px); }
          30% { transform: skewY(-1deg) scaleX(1.01) translateY(-2px); }
          40% { transform: skewY(1deg) scaleX(0.99) translateY(2px); }
          50% { transform: skewY(0deg) scaleX(1) translateY(0); }
          100% { transform: skewY(0deg) scaleX(1) translateY(0); }
        }
        .glass-hover-animate {
          transition: box-shadow 0.4s cubic-bezier(0.4,0.2,0.2,1), transform 0.3s cubic-bezier(0.4,0.2,0.2,1);
        }
        .glass-hover-animate:hover {
          box-shadow: 0 8px 32px 0 rgba(99,102,241,0.18), 0 1.5px 8px 0 rgba(0,0,0,0.10);
          background: rgba(255,255,255,0.08);
          filter: brightness(1.05) saturate(1.1);
        }
      `}</style>
    </GlassCard>
  );
}
