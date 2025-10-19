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
import { formatPopulation, formatCurrency } from '~/lib/chart-utils';
import { Button } from '~/components/ui/button';
import { CardFooter } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { GlassCard } from '~/components/ui/enhanced-card';
import { FastAverageColor } from 'fast-average-color';
import { useRef } from 'react';
import { cn } from '~/lib/utils';
import { createUrl } from '~/lib/url-utils';
import { getCountryPath } from '~/lib/slug-utils';

export interface CountryData {
  id: string;
  name: string;
  slug?: string | null;
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
  
  // Determine which flag data to use - prefer props when available
  const flagUrl = propFlagUrl;
  const flagLoading = propFlagLoading;

  const dominantColor = useDominantColor(flagUrl);

  const wikiUrl = `https://ixwiki.com/wiki/${encodeURIComponent(
    country.name.replace(/ /g, '_')
  )}`;

  const goToDetail = () => {
    router.push(createUrl(`/countries/${country.slug}`));
  };

  return (
    <GlassCard
      variant="diplomatic"
      hover="none"
      className={cn(
        "group glass-floating glass-refraction glass-interactive transition-all duration-200 flex flex-col h-full cursor-pointer overflow-hidden",
        dominantColor && "border-l-2"
      )}
      style={dominantColor ? { borderLeftColor: dominantColor } : undefined}
      onClick={goToDetail}
    >
      {/* Flag as subtle background accent - constrained to top portion */}
      {flagUrl && (
        <div
          className="absolute top-0 left-0 right-0 h-16 z-0 flag-background-accent"
          style={{
            backgroundImage: `url(${flagUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(8px) brightness(0.4) saturate(1.1)',
            opacity: 0.3,
            pointerEvents: 'none',
          }}
        />
      )}
      {/* Subtle color accent overlay - constrained to top */}
      {dominantColor && (
        <div
          className="absolute top-0 left-0 right-0 h-16 z-10 pointer-events-none color-accent-overlay"
          style={{
            background: `linear-gradient(180deg, ${dominantColor}20 0%, transparent 100%)`,
          }}
        />
      )}
      <div className="relative z-20 p-3 flex-grow min-h-0 country-card-content">
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-6 relative flex-shrink-0">
              {flagLoading && (
                <div className="w-8 h-6 bg-muted rounded border-border animate-pulse" />
              )}
              {!flagLoading && flagUrl && (
                <img
                  src={flagUrl}
                  alt={`Flag of ${country.name}`}
                  className="w-8 h-6 object-cover rounded border-border"
                />
              )}
              {!flagLoading && !flagUrl && (
                <div className="w-8 h-6 bg-muted rounded border flex items-center justify-center">
                  <FlagIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h3
                className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate"
                title={country.name}
              >
                {country.name}
              </h3>
              {(country.continent || country.region) && (
                <div className="flex items-center text-[10px] text-muted-foreground mt-0.5 truncate">
                  <LocateFixed className="h-3 w-3 mr-1 text-primary/70" />
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
              className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-0.5"
            />
          </div>
        </div>

        {/* Compact stats row */}
        <div className="flex items-center justify-between gap-2 text-xs mb-2">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3 text-blue-500" />
            <span>{formatPopulation(country.currentPopulation)}</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-green-500" />
            <span>{formatCurrency(country.currentGdpPerCapita)}</span>
          </div>
          <div className="flex items-center gap-1">
            <GlobeIcon className="h-3 w-3 text-purple-500" />
            <span>{formatCurrency(country.currentTotalGdp)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Scaling className="h-3 w-3 text-orange-500" />
            <span>{country.populationDensity != null ? `${country.populationDensity.toFixed(1)}/km²` : 'N/A'}</span>
          </div>
        </div>
      </div>

      <CardFooter className="relative z-20 px-3 pb-3 pt-0 flex justify-between items-center gap-2 min-h-0 country-card-content">
        <Badge className="text-[10px] px-2 py-0.5">{country.economicTier ?? '—'}</Badge>
        <Badge variant="outline" className="text-[10px] px-2 py-0.5">
          {country.populationTier ?? '—'}
        </Badge>
      </CardFooter>
      <style jsx>{`
        .flag-background-accent {
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%);
          transition: opacity 0.3s ease;
        }
        .color-accent-overlay {
          transition: opacity 0.3s ease;
        }
        
        /* Hover enhancements for flag and color overlays */
        .glass-interactive:hover .flag-background-accent {
          opacity: 0.5;
        }
        .glass-interactive:hover .color-accent-overlay {
          opacity: 0.7;
        }
      `}</style>
    </GlassCard>
  );
}
