"use client";

import { Crown, BarChart3, Edit, Sparkles } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import Link from 'next/link';
import { createUrl } from '~/lib/url-utils';

interface CountryHeaderProps {
  countryName: string;
  countryId: string;
  economicTier?: string;
  populationTier?: string;
  variant?: 'unified' | 'standard' | 'premium';
}

export function CountryHeader({ 
  countryName, 
  countryId,
  economicTier, 
  populationTier,
  variant = 'unified' 
}: CountryHeaderProps) {
  const variantConfig = {
    unified: {
      badge: 'UNIFIED',
      colors: 'from-amber-500 to-yellow-500',
      subtitle: 'Integrated Dashboard & Command Center'
    },
    standard: {
      badge: 'STANDARD',
      colors: 'from-blue-500 to-indigo-500',
      subtitle: 'Standard Dashboard & Analytics'
    },
    premium: {
      badge: 'PREMIUM',
      colors: 'from-purple-500 to-blue-500',
      subtitle: 'Executive Command Center & Intelligence Suite'
    }
  };

  const config = variantConfig[variant];

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-full bg-gradient-to-r ${config.colors}`}>
          <Crown className="h-8 w-8 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">MyCountry: {countryName}</h1>
            <Badge className={`bg-gradient-to-r ${config.colors} text-white`}>
              <Sparkles className="h-3 w-3 mr-1" />
              {config.badge}
            </Badge>
          </div>
          <p className="text-muted-foreground">{config.subtitle}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <Link href={createUrl(`/countries/${countryId}`)}>
          <Button variant="outline" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Public View
          </Button>
        </Link>
        <Link href={createUrl("/mycountry/editor")}>
          <Button variant="outline" className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Edit Data
          </Button>
        </Link>
        {economicTier && <Badge variant="outline">{economicTier}</Badge>}
        {populationTier && <Badge variant="outline">Tier {populationTier}</Badge>}
      </div>
    </div>
  );
}