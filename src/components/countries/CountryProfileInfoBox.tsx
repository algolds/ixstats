/**
 * Country Profile Info Box Component
 * Displays country flag, basic information, and wiki template integration
 */

"use client";

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { 
  MapPin,
  Users,
  Crown,
  Globe,
  Calendar,
  ExternalLink,
  Info,
  Flag,
  Building
} from 'lucide-react';
import { formatPopulation } from '~/lib/chart-utils';
import { getFlagColors } from '~/lib/flag-color-extractor';
import { UnifiedCountryFlag } from '~/components/UnifiedCountryFlag';
import { cn } from '~/lib/utils';
import { api } from '~/trpc/react';

interface CountryData {
  id: string;
  name: string;
  currentPopulation: number;
  economicTier: string;
  populationTier?: string | null;
  continent?: string | null;
  region?: string | null;
  governmentType?: string | null;
  leader?: string | null;
  religion?: string | null;
  populationDensity?: number | null;
  landArea?: number | null;
}

interface WikiInfoBoxData {
  flag?: string;
  coat_of_arms?: string;
  flagUrl?: string;
  coatOfArmsUrl?: string;
  capital?: string;
  largest_city?: string;
  official_languages?: string | string[];
  ethnic_groups?: string | string[];
  currency?: string;
  time_zone?: string | string[];
  calling_code?: string | string[];
  iso_code?: string;
  established?: string;
  independence?: string;
  government_type?: string;
  head_of_state?: string;
  head_of_government?: string;
  legislature?: string;
  area_total?: string;
  area_water?: string;
  population_total?: string;
  population_density?: string;
  gdp_nominal?: string;
  gdp_ppp?: string;
  hdi?: string;
  climate?: string;
  drives_on?: string;
  internet_tld?: string | string[];
  infobox?: Record<string, unknown>;
}

interface CountryProfileInfoBoxProps {
  country: CountryData;
  className?: string;
}

export const CountryProfileInfoBox: React.FC<CountryProfileInfoBoxProps> = ({
  country,
  className
}) => {
  const flagColors = getFlagColors(country.name);

  const { data: wikiDataRaw, isLoading: wikiLoading } = api.countries.getWikiInfobox.useQuery(
    { name: country.name },
    { enabled: Boolean(country?.name) }
  );

  const wikiData: (WikiInfoBoxData & { flagUrl?: string; coatOfArmsUrl?: string; infobox?: Record<string, unknown> }) | null = useMemo(() => {
    if (!wikiDataRaw) return null;
    const infobox = (wikiDataRaw as any).infobox || {};

    const normalizeList = (value: unknown): string | null => {
      if (!value) return null;
      if (Array.isArray(value)) {
        return value.map(v => (typeof v === 'string' ? v : String(v))).filter(Boolean).join(', ');
      }
      if (typeof value === 'string') {
        return value
          .replace(/<br\s*\/?>(\s*)/gi, ', ')
          .replace(/\s+/g, ' ')
          .replace(/\s*,\s*,/g, ',')
          .trim();
      }
      return null;
    };

    const fallbackImage = (file?: string | null) => {
      if (!file) return undefined;
      return `https://ixwiki.com/wiki/Special:Filepath/${file}`;
    };

    return {
      flag: wikiDataRaw.flag || infobox.image_flag || infobox.flag || undefined,
      coat_of_arms: wikiDataRaw.coatOfArms || infobox.image_coat || infobox.coat_of_arms || undefined,
      flagUrl: wikiDataRaw.flagUrl || fallbackImage(wikiDataRaw.flag || infobox.image_flag || infobox.flag),
      coatOfArmsUrl: wikiDataRaw.coatOfArmsUrl || fallbackImage(wikiDataRaw.coatOfArms || infobox.image_coat || infobox.coat_of_arms),
      capital: wikiDataRaw.capital || infobox.capital || null,
      largest_city: infobox.largest_city || null,
      official_languages: normalizeList(wikiDataRaw.languages || infobox.official_languages || infobox.official_language) || undefined,
      ethnic_groups: normalizeList(infobox.ethnic_groups || infobox.ethnicity) || undefined,
      currency: infobox.currency || wikiDataRaw.currency || null,
      time_zone: normalizeList(infobox.time_zone) || undefined,
      calling_code: normalizeList(infobox.calling_code) || undefined,
      iso_code: infobox.iso_code || infobox.iso || null,
      established: infobox.established || null,
      independence: infobox.independence || null,
      government_type: wikiDataRaw.government || infobox.government_type || infobox.government || null,
      head_of_state: infobox.head_of_state || null,
      head_of_government: infobox.head_of_government || null,
      legislature: infobox.legislature || null,
      area_total: infobox.area_total || null,
      area_water: infobox.area_water || null,
      population_total: infobox.population_total || wikiDataRaw.population?.toLocaleString() || null,
      population_density: infobox.population_density || null,
      gdp_nominal: infobox.GDP_nominal || null,
      gdp_ppp: infobox.GDP_PPP || null,
      hdi: infobox.HDI || infobox.hdi || null,
      climate: infobox.climate || null,
      drives_on: infobox.drives_on || infobox.drives || null,
      internet_tld: normalizeList(infobox.internet_tld || infobox.tld) || undefined,
      infobox,
    } as WikiInfoBoxData & { flagUrl?: string; coatOfArmsUrl?: string; infobox?: Record<string, unknown> };
  }, [wikiDataRaw]);

  const infoSections = [
    {
      title: 'Basic Information',
      icon: Info,
      items: [
        { label: 'Population', value: formatPopulation(country.currentPopulation), icon: Users },
        { label: 'Economic Tier', value: country.economicTier, icon: Crown },
        { label: 'Population Tier', value: country.populationTier || 'Standard', icon: Users },
        { label: 'Continent', value: country.continent, icon: Globe },
        { label: 'Region', value: country.region, icon: MapPin }
      ].filter(item => item.value)
    },
    {
      title: 'Geography',
      icon: MapPin,
      items: [
        { label: 'Land Area', value: country.landArea ? `${country.landArea.toLocaleString()} km²` : null },
        { label: 'Population Density', value: country.populationDensity ? `${country.populationDensity.toFixed(1)}/km²` : null },
        { label: 'Capital', value: wikiData?.capital },
        { label: 'Largest City', value: wikiData?.largest_city },
        { label: 'Climate', value: wikiData?.climate }
      ].filter(item => item.value)
    },
    {
      title: 'Government',
      icon: Building,
      items: [
        { label: 'Government Type', value: country.governmentType || wikiData?.government_type },
        { label: 'Head of State', value: wikiData?.head_of_state },
        { label: 'Head of Government', value: wikiData?.head_of_government || country.leader },
        { label: 'Legislature', value: wikiData?.legislature },
        { label: 'Independence', value: wikiData?.independence },
        { label: 'Established', value: wikiData?.established }
      ].filter(item => item.value)
    },
    {
      title: 'Culture & Society',
      icon: Globe,
      items: [
        { label: 'Official Languages', value: wikiData?.official_languages || undefined },
        { label: 'Primary Religion', value: country.religion },
        { label: 'Ethnic Groups', value: wikiData?.ethnic_groups || undefined },
        { label: 'Currency', value: wikiData?.currency },
        { label: 'Time Zone', value: wikiData?.time_zone },
        { label: 'Calling Code', value: wikiData?.calling_code }
      ].filter(item => item.value)
    }
  ];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Flag and Basic Info Card */}
      <Card className="glass-hierarchy-parent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" style={{ color: flagColors.primary }} />
            {country.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Country Flag */}
          <div className="mb-4 flex justify-center">
            <motion.div
              className="relative rounded-lg overflow-hidden shadow-lg border-2 glass-hierarchy-child"
              style={{ borderColor: flagColors.primary }}
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <UnifiedCountryFlag
                countryName={country.name}
                size="xl"
                className="w-32 h-20"
                rounded={true}
                shadow={false}
                border={false}
                showPlaceholder={true}
              />
              
              {/* Flag overlay effect */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
            </motion.div>
          </div>

          {/* Tier Badges */}
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            <Badge 
              style={{ 
                backgroundColor: `${flagColors.primary}20`, 
                borderColor: flagColors.primary,
                color: flagColors.primary 
              }}
              className="border"
            >
              {country.economicTier}
            </Badge>
            {country.populationTier && (
              <Badge 
                variant="outline"
                style={{ 
                  borderColor: flagColors.secondary,
                  color: flagColors.secondary 
                }}
              >
                {country.populationTier}
              </Badge>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="text-center p-2 rounded glass-hierarchy-child">
              <Users className="h-4 w-4 mx-auto mb-1" style={{ color: flagColors.primary }} />
              <div className="font-semibold">{formatPopulation(country.currentPopulation)}</div>
              <div className="text-xs text-muted-foreground">Population</div>
            </div>
            <div className="text-center p-2 rounded glass-hierarchy-child">
              <MapPin className="h-4 w-4 mx-auto mb-1" style={{ color: flagColors.secondary }} />
              <div className="font-semibold">{country.continent || 'Unknown'}</div>
              <div className="text-xs text-muted-foreground">Continent</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Information Sections */}
      {infoSections.map((section, index) => {
        if (section.items.length === 0) return null;
        
        return (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
          >
            <Card className="glass-hierarchy-child">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <section.icon className="h-4 w-4" style={{ color: flagColors.accent }} />
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {section.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex justify-between items-start gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {(item as any).icon && 
                          React.createElement((item as any).icon, { className: "h-3 w-3 flex-shrink-0 text-muted-foreground" })
                        }
                        <span className="text-sm text-muted-foreground truncate">{item.label}:</span>
                      </div>
                      <span className="text-sm font-medium text-right">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}

      {/* Wiki Integration */}
      {wikiData && (
        <Card className="glass-hierarchy-child">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ExternalLink className="h-4 w-4" style={{ color: flagColors.primary }} />
              Additional Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {wikiData.hdi && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Human Development Index:</span>
                  <span className="font-medium">{wikiData.hdi}</span>
                </div>
              )}
              {wikiData.internet_tld && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Internet TLD:</span>
                  <span className="font-medium">{wikiData.internet_tld}</span>
                </div>
              )}
              {wikiData.iso_code && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ISO Code:</span>
                  <span className="font-medium">{wikiData.iso_code}</span>
                </div>
              )}
              {wikiData.drives_on && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Drives on:</span>
                  <span className="font-medium">{wikiData.drives_on} side</span>
                </div>
              )}
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-4 text-xs"
              onClick={() => window.open(`https://ixwiki.com/wiki/${country.name}`, '_blank')}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View Full Wiki Page
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State for Wiki Data */}
      {wikiLoading && (
        <Card className="glass-hierarchy-child">
          <CardContent className="p-4">
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CountryProfileInfoBox;
