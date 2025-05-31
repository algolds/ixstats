// src/app/countries/_components/CountryInfobox.tsx
"use client";

import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe,
  MapPin,
  Users,
  Building,
  DollarSign,
  Languages,
  Clock,
  Phone,
  Wifi,
  Navigation,
  Info,
  Loader2,
  AlertTriangle,
  Flag,
  RefreshCw
} from "lucide-react";
import { ixnayWiki } from "~/lib/mediawiki-service";
import type { CountryInfobox as CountryInfoboxType } from "~/lib/mediawiki-service"; // Renamed to avoid conflict
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from "~/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";

interface CountryInfoboxProps {
  countryName: string;
  onToggle?: (isExpanded: boolean) => void;
  initialExpanded?: boolean; // Allow parent to control initial state
}

interface InfoboxField {
  key: string;
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  priority: number;
}

interface LoadingState {
  isLoading: boolean;
  error: string | null;
  retryCount: number;
}

export function CountryInfobox({ countryName, onToggle, initialExpanded = false }: CountryInfoboxProps) {
  const [infobox, setInfobox] = useState<CountryInfoboxType | null>(null);
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: true,
    error: null,
    retryCount: 0
  });

  const MAX_RETRIES = 2;

  const loadInfoboxData = async (isRetry = false) => {
    if (!countryName) {
        setLoadingState({ isLoading: false, error: "Country name not provided.", retryCount: 0 });
        return;
    }
    try {
      if (!isRetry) {
        setLoadingState(prev => ({ ...prev, isLoading: true, error: null, retryCount: 0 }));
      } else {
        setLoadingState(prev => ({ ...prev, isLoading: true, error: null }));
      }

      console.log(`[CountryInfobox] Loading data for: ${countryName}`);
      const [flag, data] = await Promise.all([
        ixnayWiki.getFlagUrl(countryName),
        ixnayWiki.getCountryInfobox(countryName)
      ]);

      setFlagUrl(flag);
      setInfobox(data);
      setLoadingState(prev => ({ ...prev, isLoading: false, error: null }));

      if (data) {
        console.log(`[CountryInfobox] Successfully loaded infobox for: ${countryName}`);
      } else {
        console.log(`[CountryInfobox] No infobox data found for: ${countryName}`);
        // Optionally set a specific error or message if data is null but no exception occurred
        // setLoadingState(prev => ({ ...prev, isLoading: false, error: "No infobox data found."}));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load country information';
      console.error(`[CountryInfobox] Error loading data for ${countryName}:`, error);
      setLoadingState(prev => ({
        isLoading: false,
        error: errorMessage,
        retryCount: prev.retryCount + 1
      }));
    }
  };

  useEffect(() => {
    loadInfoboxData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryName]); // Only re-run if countryName changes

  const handleRetry = () => {
    if (loadingState.retryCount < MAX_RETRIES) {
      loadInfoboxData(true);
    }
  };

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onToggle?.(newExpanded);
  };

  const getWikiUrl = () => {
    return ixnayWiki.getCountryWikiUrl(countryName);
  };

  const formatInfoboxFields = (currentInfobox: CountryInfoboxType): InfoboxField[] => {
    const fields: InfoboxField[] = [];
    const fieldMappings: Array<{
      keys: (keyof CountryInfoboxType)[]; // Ensure keys are valid
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      priority: number;
      formatter?: (value: string) => string;
    }> = [
      { keys: ['capital'], label: 'Capital', icon: Building, priority: 1 },
      { keys: ['largest_city'], label: 'Largest City', icon: Building, priority: 2 },
      { keys: ['official_name', 'conventional_long_name'], label: 'Official Name', icon: Globe, priority: 3 },
      { keys: ['motto'], label: 'Motto', icon: Info, priority: 4 },
      { keys: ['continent'], label: 'Continent', icon: Globe, priority: 5 },
      { keys: ['area', 'area_km2'], label: 'Area', icon: MapPin, priority: 6, formatter: (v) => v.includes('km') ? v : `${parseFloat(v).toLocaleString()} km²` },
      { keys: ['population', 'population_estimate'], label: 'Population', icon: Users, priority: 7, formatter: (v) => parseFloat(v).toLocaleString() },
      { keys: ['currency', 'currency_code'], label: 'Currency', icon: DollarSign, priority: 8 },
      { keys: ['government', 'government_type'], label: 'Government', icon: Building, priority: 9 },
      { keys: ['leader_title1', 'head_of_state'], label: 'Head of State', icon: Users, priority: 10 },
      { keys: ['leader_name1', 'leader'], label: 'Leader', icon: Users, priority: 11 },
      { keys: ['legislature'], label: 'Legislature', icon: Building, priority: 12 },
      { keys: ['established_event1', 'established_date1', 'established'], label: 'Established', icon: Clock, priority: 13 },
      { keys: ['gdp_ppp', 'GDP_PPP', 'gdp_nominal', 'GDP_nominal', 'gdp'], label: 'GDP', icon: DollarSign, priority: 14 },
      { keys: ['languages', 'official_languages'], label: 'Languages', icon: Languages, priority: 15 },
      { keys: ['religion', 'state_religion'], label: 'Religion', icon: Info, priority: 16 },
      { keys: ['timezone', 'time_zone'], label: 'Timezone', icon: Clock, priority: 17 },
      { keys: ['calling_code', 'callingCode'], label: 'Calling Code', icon: Phone, priority: 18 },
      { keys: ['internetTld', 'cctld'], label: 'Internet TLD', icon: Wifi, priority: 19 },
      { keys: ['driving_side', 'drives_on'], label: 'Driving Side', icon: Navigation, priority: 20 },
    ];

    for (const mapping of fieldMappings) {
      let value: string | undefined;
      let usedKey: string | undefined;
      for (const key of mapping.keys) {
        const val = currentInfobox[key];
        if (val && String(val).trim()) {
          value = String(val);
          usedKey = String(key);
          break;
        }
      }
      if (value && usedKey) {
        const formattedValue = mapping.formatter ? mapping.formatter(value) : value;
        fields.push({ key: usedKey, label: mapping.label, value: formattedValue, icon: mapping.icon, priority: mapping.priority });
      }
    }
    // Add other fields not explicitly mapped, with lower priority
    const mappedKeys = new Set(fieldMappings.flatMap(m => m.keys));
    const standardKeys = new Set<keyof CountryInfoboxType>(['name', 'conventional_long_name', 'native_name', 'image_flag', 'flag', 'image_coat', 'locator_map', 'image_map']);

    Object.entries(currentInfobox).forEach(([key, value]) => {
        if (!mappedKeys.has(key as keyof CountryInfoboxType) && !standardKeys.has(key as keyof CountryInfoboxType) && value && typeof value === 'string' && value.trim()) {
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            fields.push({ key, label, value, icon: Info, priority: 99 }); // Low priority for other fields
        }
    });


    return fields.sort((a, b) => a.priority - b.priority);
  };


  if (loadingState.isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (loadingState.error) {
    const canRetry = loadingState.retryCount < MAX_RETRIES;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Globe className="h-5 w-5 mr-2" /> Country Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading Infobox</AlertTitle>
            <AlertDescription>
              {loadingState.error}
              {canRetry && (
                <Button onClick={handleRetry} variant="outline" size="sm" className="mt-2">
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                  Try Again ({loadingState.retryCount + 1}/{MAX_RETRIES})
                </Button>
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
         <CardFooter className="p-4 border-t">
            <Button variant="outline" asChild className="w-full">
                <a href={getWikiUrl()} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" /> View on Wiki
                </a>
            </Button>
        </CardFooter>
      </Card>
    );
  }

  if (!infobox) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Globe className="h-5 w-5 mr-2" /> {countryName}
          </CardTitle>
          <CardDescription>Country Information</CardDescription>
        </CardHeader>
        <CardContent className="p-4 text-center">
          <Info className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No detailed infobox data found on Ixnay Wiki for this country.</p>
        </CardContent>
        <CardFooter className="p-4 border-t">
            <Button variant="outline" asChild className="w-full">
                <a href={getWikiUrl()} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" /> View Wiki Page
                </a>
            </Button>
        </CardFooter>
      </Card>
    );
  }

  const fields = formatInfoboxFields(infobox);
  const displayFields = isExpanded ? fields : fields.slice(0, 6);
  const mapImage = infobox.locator_map || infobox.image_map;
  const coatOfArms = infobox.image_coat || infobox.coat_of_arms;


  return (
    <Card className="transition-all duration-300">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-lg">
            <Globe className="h-5 w-5 mr-2 text-primary" />
            {infobox.conventional_long_name || countryName}
          </CardTitle>
           <Button variant="outline" size="sm" asChild>
                <a href={getWikiUrl()} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Wiki
                </a>
            </Button>
        </div>
        {infobox.native_name && infobox.native_name !== countryName && (
          <CardDescription className="text-sm italic">
            {infobox.native_name}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="px-4 pt-0 pb-4">
        {(flagUrl || coatOfArms || mapImage) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-4">
            {flagUrl && (
                <div className="flex flex-col items-center">
                <img src={flagUrl} alt={`Flag of ${countryName}`} className="h-16 max-w-full object-contain border rounded shadow-sm bg-muted/20" />
                <span className="text-xs text-muted-foreground mt-1">Flag</span>
                </div>
            )}
            {coatOfArms && (
                <div className="flex flex-col items-center">
                <img src={`https://ixwiki.com/images/${coatOfArms.replace(/ /g, '_')}`} alt="Coat of Arms" className="h-16 max-w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}/>
                <span className="text-xs text-muted-foreground mt-1">Coat of Arms</span>
                </div>
            )}
            {mapImage && (
                <div className="flex flex-col items-center">
                <img src={`https://ixwiki.com/images/${mapImage.replace(/ /g, '_')}`} alt="Map" className="h-16 max-w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}/>
                <span className="text-xs text-muted-foreground mt-1">Map</span>
                </div>
            )}
            </div>
        )}
        {displayFields.length > 0 && <Separator className="my-3" />}

        <div className="space-y-2.5">
          {displayFields.map((field) => {
            const Icon = field.icon;
            return (
              <div key={field.key} className="flex items-start text-sm">
                <Icon className="h-4 w-4 mt-0.5 text-primary mr-2.5 flex-shrink-0" />
                <span className="font-medium text-muted-foreground w-28 sm:w-32 flex-shrink-0 truncate" title={field.label}>
                  {field.label}:
                </span>
                <span className="text-foreground break-words flex-1 text-right sm:text-left" title={field.value}>
                  {field.value}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>

      {fields.length > 6 && (
        <CardFooter className="p-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggle}
            className="w-full text-primary hover:text-primary/90"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 mr-1.5" />
            ) : (
              <ChevronDown className="h-4 w-4 mr-1.5" />
            )}
            {isExpanded ? 'Show Less' : `Show ${fields.length - 6} More Field${fields.length - 6 > 1 ? 's' : ''}`}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

