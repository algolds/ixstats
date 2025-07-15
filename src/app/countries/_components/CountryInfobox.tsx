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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

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
  const [coatOfArmsUrl, setCoatOfArmsUrl] = useState<string | null>(null);
  const [mapImageUrl, setMapImageUrl] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [activeTab, setActiveTab] = useState<string>("structured");
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: true,
    error: null,
    retryCount: 0
  });

  const MAX_RETRIES = 3;

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
      
      // Special handling for Caphiria - first clear the cache to ensure fresh data
      if (countryName.toLowerCase() === 'caphiria' && isRetry) {
        console.log(`[CountryInfobox] Applying special handling for Caphiria - clearing cache`);
        await fetch(`/api/mediawiki?country=Caphiria`, { method: 'DELETE' });
      }
      
      // Load infobox data first, then flag separately to avoid overwhelming the API
      const data = await ixnayWiki.getCountryInfobox(countryName);
      
      if (!data) {
        console.warn(`[CountryInfobox] No infobox data found for: ${countryName}`);
        setLoadingState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: `No infobox data found for ${countryName}. The country page may not exist or may not have an infobox template.`,
          retryCount: prev.retryCount + 1
        }));
        return;
      }
      
      setInfobox(data);
      
      // Load flag separately to avoid concurrent request issues
      try {
        const flag = await ixnayWiki.getFlagUrl(countryName);
        if (typeof flag === 'string') {
          let processedFlagUrl = flag;
          if (processedFlagUrl.includes('localhost') || processedFlagUrl.includes('127.0.0.1')) {
            processedFlagUrl = processedFlagUrl.replace(/https?:\/\/[^\/]+/, 'https://ixwiki.com');
          }
          setFlagUrl(processedFlagUrl);
        } else {
          setFlagUrl(null);
        }
      } catch (flagError) {
        console.warn(`[CountryInfobox] Failed to load flag for ${countryName}:`, flagError);
        setFlagUrl(null);
      }
      
      // If this country has parsed HTML, default to HTML tab
      if (data?.renderedHtml) {
        setActiveTab("html");
        console.log(`[CountryInfobox] Received HTML content for ${countryName}, defaulting to HTML tab`);
      }
      
      // Load image URLs if we have image references (do this asynchronously)
      if (data) {
        // Load coat of arms
        if (data.coat_of_arms || data.image_coat) {
          const coatName = data.coat_of_arms || data.image_coat;
          if (coatName) {
            try {
              const coatUrl = await ixnayWiki.getFileUrl(coatName);
              if (typeof coatUrl === 'string') {
                let processedCoatUrl = coatUrl;
                if (processedCoatUrl.includes('localhost') || processedCoatUrl.includes('127.0.0.1')) {
                  processedCoatUrl = processedCoatUrl.replace(/https?:\/\/[^\/]+/, 'https://ixwiki.com');
                }
                setCoatOfArmsUrl(processedCoatUrl);
              } else {
                setCoatOfArmsUrl(null);
              }
            } catch (coatError) {
              console.warn(`[CountryInfobox] Failed to load coat of arms for ${countryName}:`, coatError);
              setCoatOfArmsUrl(null);
            }
          }
        }
        
        // Load map image
        if (data.locator_map || data.image_map) {
          const mapName = data.locator_map || data.image_map;
          if (mapName) {
            try {
              // Handle both simple filenames and complex descriptions from switcher templates
              let actualFileName = mapName;
              
              // If the mapName looks like it came from a switcher template, try to extract filename
              // Pattern: Look for file extensions in the string
              const fileMatch = mapName.match(/([^\/\s]+\.(?:png|jpg|jpeg|gif|svg|webp))/i);
              if (fileMatch && fileMatch[1]) {
                actualFileName = fileMatch[1];
              }
              
              console.log(`[CountryInfobox] Processing map image: "${mapName}" -> "${actualFileName}"`);
              const mapUrl = await ixnayWiki.getFileUrl(actualFileName);
              if (typeof mapUrl === 'string') {
                let processedMapUrl = mapUrl;
                if (processedMapUrl.includes('localhost') || processedMapUrl.includes('127.0.0.1')) {
                  processedMapUrl = processedMapUrl.replace(/https?:\/\/[^\/]+/, 'https://ixwiki.com');
                }
                setMapImageUrl(processedMapUrl);
              } else {
                setMapImageUrl(null);
              }
            } catch (mapError) {
              console.warn(`[CountryInfobox] Failed to load map image for ${countryName}:`, mapError);
              setMapImageUrl(null);
            }
          }
        }
      }
      
      setLoadingState(prev => ({ ...prev, isLoading: false, error: null }));

      console.log(`[CountryInfobox] Successfully loaded infobox for: ${countryName}`);
      console.log(`[CountryInfobox] Infobox has ${Object.keys(data).length} properties`);
      
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
      console.log(`[CountryInfobox] Retrying load for ${countryName} (attempt ${loadingState.retryCount + 1}/${MAX_RETRIES})`);
      // Add a small delay before retrying to avoid overwhelming the server
      setTimeout(() => {
        loadInfoboxData(true);
      }, 1000 * (loadingState.retryCount + 1)); // Exponential backoff: 1s, 2s, 3s
    } else {
      console.warn(`[CountryInfobox] Max retries reached for ${countryName}`);
      setLoadingState(prev => ({
        ...prev,
        error: `Failed to load infobox after ${MAX_RETRIES} attempts. Please try refreshing the page or contact support if the problem persists.`
      }));
    }
  };

  const handleClearCache = async () => {
    try {
      setLoadingState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Clear both country cache and force reload
      await fetch(`/api/mediawiki?country=${encodeURIComponent(countryName)}`, { method: 'DELETE' });
      console.log(`[CountryInfobox] Cache cleared for ${countryName}, reloading data with enhanced template processing`);
      
      // Reset local state
      setInfobox(null);
      setFlagUrl(null);
      setCoatOfArmsUrl(null);
      setMapImageUrl(null);
      
      // Force reload with enhanced processing
      loadInfoboxData(true);
    } catch (error) {
      console.error(`[CountryInfobox] Error clearing cache:`, error);
      setLoadingState(prev => ({
        isLoading: false,
        error: "Failed to clear cache. Please try again.",
        retryCount: prev.retryCount
      }));
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
    
    // Enhanced field mappings with more comprehensive coverage
    const fieldMappings: Array<{
      keys: string[]; // Use string array instead of keyof to handle dynamic properties
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      priority: number;
      formatter?: (value: string) => string;
    }> = [
      // Core identification
      { keys: ['capital', 'capital_city'], label: 'Capital', icon: Building, priority: 1 },
      { keys: ['largest_city'], label: 'Largest City', icon: Building, priority: 2 },
      { keys: ['conventional_long_name', 'official_name'], label: 'Official Name', icon: Globe, priority: 3 },
      { keys: ['native_name'], label: 'Native Name', icon: Globe, priority: 4 },
      { keys: ['motto', 'national_motto'], label: 'National Motto', icon: Info, priority: 5 },
      { keys: ['englishmotto'], label: 'English Motto', icon: Info, priority: 6 },
      
      // Geographic
      { keys: ['continent'], label: 'Continent', icon: Globe, priority: 7 },
      { keys: ['area', 'area_km2', 'area_total'], label: 'Area', icon: MapPin, priority: 8, formatter: (v) => v.includes('km') ? v : `${parseFloat(v).toLocaleString()} km²` },
      { keys: ['area_rank'], label: 'Area Rank', icon: MapPin, priority: 9 },
      
      // Government
      { keys: ['government', 'government_type'], label: 'Government', icon: Building, priority: 10 },
      { keys: ['leader_title1', 'head_of_state'], label: 'Head of State', icon: Users, priority: 11 },
      { keys: ['leader_name1', 'leader'], label: 'Leader', icon: Users, priority: 12 },
      { keys: ['leader_title2'], label: 'Deputy Title', icon: Users, priority: 13 },
      { keys: ['leader_name2', 'deputy_leader'], label: 'Deputy Leader', icon: Users, priority: 14 },
      { keys: ['legislature'], label: 'Legislature', icon: Building, priority: 15 },
      { keys: ['upper_house'], label: 'Upper House', icon: Building, priority: 16 },
      { keys: ['lower_house'], label: 'Lower House', icon: Building, priority: 17 },
      { keys: ['sovereignty_type'], label: 'Sovereignty Type', icon: Building, priority: 18 },
      
      // Economic
      { keys: ['currency', 'currency_code'], label: 'Currency', icon: DollarSign, priority: 19 },
      { keys: ['GDP_nominal'], label: 'GDP (Nominal)', icon: DollarSign, priority: 20 },
      { keys: ['GDP_nominal_per_capita'], label: 'GDP per Capita', icon: DollarSign, priority: 21 },
      
      // Cultural
      { keys: ['official_languages', 'official_language'], label: 'Official Languages', icon: Languages, priority: 22 },
      { keys: ['national_language'], label: 'National Language', icon: Languages, priority: 23 },
      { keys: ['regional_languages'], label: 'Regional Languages', icon: Languages, priority: 24 },
      { keys: ['recognized_languages'], label: 'Recognized Languages', icon: Languages, priority: 25 },
      { keys: ['languages'], label: 'Languages', icon: Languages, priority: 26 },
      { keys: ['ethnic_groups'], label: 'Ethnic Groups', icon: Users, priority: 27 },
      { keys: ['religion', 'state_religion'], label: 'Religion', icon: Info, priority: 28 },
      { keys: ['demonym'], label: 'Demonym', icon: Users, priority: 29 },
      { keys: ['national_anthem'], label: 'National Anthem', icon: Info, priority: 30 },
      { keys: ['royal_anthem'], label: 'Royal Anthem', icon: Info, priority: 31 },
      { keys: ['patron_saint'], label: 'Patron Saint', icon: Info, priority: 32 },
      
      // Historical - all establishment events
      { keys: ['established_event1'], label: 'Foundation', icon: Clock, priority: 33 },
      { keys: ['established_date1'], label: 'Foundation Date', icon: Clock, priority: 34 },
      { keys: ['established_event2'], label: 'Historical Event', icon: Clock, priority: 35 },
      { keys: ['established_date2'], label: 'Historical Date', icon: Clock, priority: 36 },
      { keys: ['established_event3'], label: 'Historical Event', icon: Clock, priority: 37 },
      { keys: ['established_date3'], label: 'Historical Date', icon: Clock, priority: 38 },
      { keys: ['established_event4'], label: 'Historical Event', icon: Clock, priority: 39 },
      { keys: ['established_date4'], label: 'Historical Date', icon: Clock, priority: 40 },
      { keys: ['established_event5'], label: 'Historical Event', icon: Clock, priority: 41 },
      { keys: ['established_date5'], label: 'Historical Date', icon: Clock, priority: 42 },
      { keys: ['established_event6'], label: 'Historical Event', icon: Clock, priority: 43 },
      { keys: ['established_date6'], label: 'Historical Date', icon: Clock, priority: 44 },
      { keys: ['independence', 'independence_date'], label: 'Independence', icon: Clock, priority: 45 },
      
      // Technical
      { keys: ['timezone', 'time_zone'], label: 'Timezone', icon: Clock, priority: 46 },
      { keys: ['calling_code', 'callingCode'], label: 'Calling Code', icon: Phone, priority: 47 },
      { keys: ['internetTld', 'cctld'], label: 'Internet TLD', icon: Wifi, priority: 48 },
      { keys: ['driving_side', 'drives_on', 'drivingSide'], label: 'Driving Side', icon: Navigation, priority: 49 },
      { keys: ['electricity'], label: 'Electricity', icon: Info, priority: 50 },
    ];

    // Apply direct mappings
    for (const mapping of fieldMappings) {
      let value: string | undefined;
      let usedKey: string | undefined;
      for (const key of mapping.keys) {
        const val = (currentInfobox as any)[key];
        if (val && String(val).trim()) {
          value = String(val);
          usedKey = key;
          break;
        }
      }
      if (value && usedKey) {
        const formattedValue = mapping.formatter ? mapping.formatter(value) : value;
        fields.push({ key: usedKey, label: mapping.label, value: formattedValue, icon: mapping.icon, priority: mapping.priority });
      }
    }
    
    // Add all other dynamic fields that weren't explicitly mapped
    const mappedKeys = new Set(fieldMappings.flatMap(m => m.keys));
    // Exclude visual fields and fields pulled from ixstats (population, GDP)
    const excludedKeys = new Set<string>([
      'image_flag', 'flag', 'image_coat', 'coat_of_arms', 'locator_map', 'image_map', 'flag_caption',
      'alt_map', 'image_map2', 'alt_map2', 'map_caption2', 'map_caption',
      // Exclude population and GDP fields since they're pulled from ixstats
      'population_estimate', 'population_census', 'population', 'population_density_km2',
      'GDP_PPP', 'GDP_PPP_per_capita', 'gdp', 'gdp_ppp',
      // Exclude raw content and technical fields
      'renderedHtml', 'rawWikitext', 'parsedTemplateData',
      // Exclude empty or very short values that are likely formatting artifacts
      'name' // The name is already shown in the header
    ]);

    // Get all dynamic properties from the infobox
    Object.entries(currentInfobox).forEach(([key, value]) => {
        if (!mappedKeys.has(key) && 
            !excludedKeys.has(key) &&
            value && typeof value === 'string' && value.trim() && 
            value.length > 2 && // Exclude very short values
            !value.includes('{{') && // Exclude values that still contain template syntax
            !value.startsWith('|') && // Exclude values that look like they weren't parsed properly
            !key.startsWith('_') && // Exclude internal properties
            !/^\d+$/.test(value) // Exclude values that are just numbers (likely technical)
        ) {
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            fields.push({ key, label, value: value.trim(), icon: Info, priority: 100 }); // Low priority for dynamic fields
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
              <div className="flex gap-2 mt-2">
                {canRetry && (
                  <Button onClick={handleRetry} variant="outline" size="sm">
                    <RefreshCw className="h-3 w-3 mr-1.5" />
                    Retry ({loadingState.retryCount + 1}/{MAX_RETRIES})
                  </Button>
                )}
                <Button onClick={handleClearCache} variant="outline" size="sm">
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                  Force Refresh
                </Button>
              </div>
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
          <Button onClick={handleClearCache} variant="outline" size="sm" className="mt-3">
            <RefreshCw className="h-3 w-3 mr-1.5" />
            Force Refresh with Enhanced Processing
          </Button>
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
  const displayFields = isExpanded ? fields : fields.slice(0, 12); // Show more fields by default since we have better parsing
  
  // Check if we have parsed HTML content
  const hasHtmlContent = Boolean(infobox.renderedHtml);

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
          <CardDescription 
            className="text-sm italic"
            dangerouslySetInnerHTML={{ __html: infobox.native_name }}
          />
        )}
      </CardHeader>

      <CardContent className="px-4 pt-0 pb-4 country-infobox-content">
        {(flagUrl || coatOfArmsUrl || mapImageUrl) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
            {flagUrl && (
                <div className="flex flex-col items-center">
                <img 
                  src={flagUrl} 
                  alt={`Flag of ${countryName}`} 
                  className="h-16 max-w-full object-contain border rounded shadow-sm bg-muted/20" 
                  onError={(e) => { 
                    console.error(`Failed to load flag: ${flagUrl}`);
                    (e.target as HTMLImageElement).style.display = 'none'; 
                  }}
                />
                <span className="text-xs text-muted-foreground mt-1">Flag</span>
                </div>
            )}
            {coatOfArmsUrl && (
                <div className="flex flex-col items-center">
                <img 
                  src={coatOfArmsUrl} 
                  alt="Coat of Arms" 
                  className="h-16 max-w-full object-contain" 
                  onError={(e) => { 
                    console.error(`Failed to load coat of arms: ${coatOfArmsUrl}`);
                    (e.target as HTMLImageElement).style.display = 'none'; 
                  }}
                />
                <span className="text-xs text-muted-foreground mt-1">Coat of Arms</span>
                </div>
            )}
            {mapImageUrl && (
                <div className="flex flex-col items-center">
                <img 
                  src={mapImageUrl} 
                  alt="Map" 
                  className="h-16 max-w-full object-contain" 
                  onError={(e) => { 
                    console.error(`Failed to load map: ${mapImageUrl}`);
                    (e.target as HTMLImageElement).style.display = 'none'; 
                  }}
                />
                <span className="text-xs text-muted-foreground mt-1">Map</span>
                </div>
            )}
            </div>
        )}
        
        {hasHtmlContent ? (
          // Use tabs for countries with both structured data and HTML
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="structured">Structured</TabsTrigger>
              <TabsTrigger value="html">Full Infobox</TabsTrigger>
            </TabsList>
            
            <TabsContent value="structured">
              {displayFields.length > 0 && <Separator className="my-3" />}
              <div className="space-y-3">
                {displayFields.map((field) => {
                  const Icon = field.icon;
                  
                  return (
                    <div key={field.key} className="flex items-start text-sm">
                      <Icon className="h-4 w-4 mt-0.5 text-primary mr-3 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-muted-foreground font-medium mr-2">{field.label}:</span>
                        <span 
                          className="text-foreground wiki-content"
                          dangerouslySetInnerHTML={{ __html: field.value }}
                          title={field.value !== (infobox.parsedTemplateData?.[field.key] || field.value) ? 
                                 `Original: ${infobox.parsedTemplateData?.[field.key] || 'N/A'}` : undefined}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <style jsx global>{`
                .wiki-content a {
                  color: #429284 !important;
                  text-decoration: none !important;
                  border-bottom: 1px solid transparent;
                  transition: all 0.2s ease;
                }
                .wiki-content a:hover {
                  color: #2d6b5f !important;
                  border-bottom-color: #429284;
                  text-decoration: none !important;
                }
                .wiki-content a:visited {
                  color: #357a6e !important;
                }
              `}</style>
              
              {fields.length > 12 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggle}
                  className="w-full text-primary hover:text-primary/90 mt-4"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 mr-1.5" />
                  ) : (
                    <ChevronDown className="h-4 w-4 mr-1.5" />
                  )}
                  {isExpanded ? 'Show Less' : `Show ${fields.length - 12} More Field${fields.length - 12 > 1 ? 's' : ''}`}
                </Button>
              )}
            </TabsContent>
            
            <TabsContent value="html">
              <div 
                className="wiki-infobox prose prose-sm max-w-none mt-4 overflow-x-auto styled-infobox"
                dangerouslySetInnerHTML={{ __html: infobox.renderedHtml || '' }}
              />
              <style jsx global>{`
                .styled-infobox table.infobox,
                .styled-infobox .infobox,
                .styled-infobox table.wikitable {
                  width: 100%;
                  border-collapse: collapse;
                  font-size: 0.9rem;
                  background-color: rgba(var(--card-rgb), 0.2);
                  border-radius: 0.5rem;
                  overflow: hidden;
                }
                .styled-infobox table.infobox th,
                .styled-infobox .infobox th,
                .styled-infobox table.wikitable th {
                  background-color: rgba(var(--card-rgb), 0.5);
                  color: var(--foreground);
                  font-weight: 600;
                  text-align: left;
                  padding: 0.5rem;
                  vertical-align: top;
                  border-bottom: 1px solid rgba(var(--card-foreground-rgb), 0.1);
                }
                .styled-infobox table.infobox td,
                .styled-infobox .infobox td,
                .styled-infobox table.wikitable td {
                  padding: 0.5rem;
                  vertical-align: top;
                  border-bottom: 1px solid rgba(var(--card-foreground-rgb), 0.1);
                }
                .styled-infobox .infobox caption,
                .styled-infobox table.infobox caption,
                .styled-infobox table.wikitable caption {
                  font-weight: bold;
                  font-size: 1rem;
                  padding: 0.5rem;
                  background-color: rgba(var(--card-rgb), 0.8);
                  text-align: center;
                }
                .styled-infobox .infobox img,
                .styled-infobox table.infobox img,
                .styled-infobox table.wikitable img {
                  max-width: 100%;
                  height: auto;
                  margin: 0 auto;
                  display: block;
                }
                .styled-infobox .infobox a,
                .styled-infobox table.infobox a,
                .styled-infobox table.wikitable a {
                  color: #429284 !important;
                  text-decoration: none !important;
                  border-bottom: 1px solid transparent;
                  transition: all 0.2s ease;
                }
                .styled-infobox .infobox a:hover,
                .styled-infobox table.infobox a:hover,
                .styled-infobox table.wikitable a:hover {
                  color: #2d6b5f !important;
                  border-bottom-color: #429284;
                  text-decoration: none !important;
                }
                .styled-infobox .infobox a:visited,
                .styled-infobox table.infobox a:visited,
                .styled-infobox table.wikitable a:visited {
                  color: #357a6e !important;
                }
                
                /* Special styles for complex infoboxes */
                .styled-infobox table tr[style*="background"] td {
                  background-color: rgba(var(--card-rgb), 0.3) !important;
                }
                .styled-infobox table td[style*="background"] {
                  background-color: rgba(var(--card-rgb), 0.3) !important;
                }
                .styled-infobox table tr[bgcolor] td {
                  background-color: rgba(var(--card-rgb), 0.3) !important;
                }
              `}</style>
            </TabsContent>
          </Tabs>
        ) : (
          // Standard display for countries with only structured data
          <>
            {displayFields.length > 0 && <Separator className="my-3" />}
                        <div className="space-y-3">
              {displayFields.map((field) => {
                const Icon = field.icon;
                
                return (
                  <div key={field.key} className="flex items-start text-sm">
                    <Icon className="h-4 w-4 mt-0.5 text-primary mr-3 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-muted-foreground font-medium mr-2">{field.label}:</span>
                      <span 
                        className="text-foreground wiki-content"
                        dangerouslySetInnerHTML={{ __html: field.value }}
                        title={field.value !== (infobox.parsedTemplateData?.[field.key] || field.value) ? 
                               `Original: ${infobox.parsedTemplateData?.[field.key] || 'N/A'}` : undefined}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>

      {!hasHtmlContent && fields.length > 12 && (
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
            {isExpanded ? 'Show Less' : `Show ${fields.length - 12} More Field${fields.length - 12 > 1 ? 's' : ''}`}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}