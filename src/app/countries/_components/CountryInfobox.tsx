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
  AlertTriangle
} from "lucide-react";
import { ixnayWiki, type CountryInfobox } from "~/lib/mediawiki-service";

interface CountryInfoboxProps {
  countryName: string;
  onToggle?: (isExpanded: boolean) => void;
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

export function CountryInfobox({ countryName, onToggle }: CountryInfoboxProps) {
  const [infobox, setInfobox] = useState<CountryInfobox | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: true,
    error: null,
    retryCount: 0
  });

  const MAX_RETRIES = 2;

  useEffect(() => {
    loadInfoboxData();
  }, [countryName]);

  const loadInfoboxData = async (isRetry = false) => {
    try {
      if (!isRetry) {
        setLoadingState(prev => ({ ...prev, isLoading: true, error: null }));
      }

      console.log(`[CountryInfobox] Loading data for: ${countryName}`);
      const data = await ixnayWiki.getCountryInfobox(countryName);
      
      setInfobox(data);
      setLoadingState(prev => ({ ...prev, isLoading: false, error: null }));
      
      if (data) {
        console.log(`[CountryInfobox] Successfully loaded infobox for: ${countryName}`);
      } else {
        console.log(`[CountryInfobox] No infobox data found for: ${countryName}`);
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

  const formatInfoboxFields = (infobox: CountryInfobox): InfoboxField[] => {
    const fields: InfoboxField[] = [];

    const fieldMappings: Array<{
      keys: string[];
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      priority: number;
      formatter?: (value: string) => string;
    }> = [
      { keys: ['capital'], label: 'Capital', icon: Building, priority: 1 },
      { keys: ['continent'], label: 'Continent', icon: Globe, priority: 2 },
      { keys: ['area', 'area_km2'], label: 'Area', icon: MapPin, priority: 3, formatter: (v) => v.includes('km') ? v : `${v} km²` },
      { keys: ['population', 'population_estimate'], label: 'Population', icon: Users, priority: 4 },
      { keys: ['currency', 'currency_code'], label: 'Currency', icon: DollarSign, priority: 5 },
      { keys: ['government', 'government_type'], label: 'Government', icon: Building, priority: 6 },
      { keys: ['leader', 'leader_name1'], label: 'Leader', icon: Users, priority: 7 },
      { keys: ['gdp', 'GDP_PPP', 'GDP_nominal'], label: 'GDP', icon: DollarSign, priority: 8 },
      { keys: ['languages', 'official_languages'], label: 'Languages', icon: Languages, priority: 9 },
      { keys: ['timezone', 'time_zone'], label: 'Timezone', icon: Clock, priority: 10 },
      { keys: ['callingCode', 'calling_code'], label: 'Calling Code', icon: Phone, priority: 11 },
      { keys: ['internetTld', 'cctld'], label: 'Internet TLD', icon: Wifi, priority: 12 },
      { keys: ['drivingSide', 'drives_on'], label: 'Driving Side', icon: Navigation, priority: 13 },
    ];

    // Process mapped fields
    for (const mapping of fieldMappings) {
      let value: string | undefined;
      let usedKey: string | undefined;

      // Find first available value from the key options
      for (const key of mapping.keys) {
        const val = infobox[key as keyof CountryInfobox];
        if (val && val.trim()) {
          value = val;
          usedKey = key;
          break;
        }
      }

      if (value && usedKey) {
        const formattedValue = mapping.formatter ? mapping.formatter(value) : value;
        fields.push({
          key: usedKey,
          label: mapping.label,
          value: formattedValue,
          icon: mapping.icon,
          priority: mapping.priority
        });
      }
    }

    // Add any additional fields not in our standard mappings
    const mappedKeys = new Set(fieldMappings.flatMap(m => m.keys));
    const standardKeys = new Set(['name', 'conventional_long_name', 'native_name', 'image_flag', 'flag', 'image_coat']);
    
    for (const [key, value] of Object.entries(infobox)) {
      if (!mappedKeys.has(key) && !standardKeys.has(key) && value && typeof value === 'string' && value.trim()) {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        fields.push({
          key,
          label,
          value,
          icon: Info,
          priority: 20
        });
      }
    }

    return fields.sort((a, b) => a.priority - b.priority);
  };

  // Loading state
  if (loadingState.isLoading) {
    return (
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-primary)] rounded-lg shadow-md">
        <div className="p-4 border-b border-[var(--color-border-primary)]">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center">
              <Globe className="h-5 w-5 mr-2" />
              Country Information
            </h3>
            <div className="flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--color-brand-primary)]" />
              <span className="text-sm text-[var(--color-text-muted)]">Loading...</span>
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-5 h-5 bg-[var(--color-bg-tertiary)] rounded animate-pulse"></div>
                <div className="flex-1">
                  <div className="h-4 bg-[var(--color-bg-tertiary)] rounded animate-pulse" style={{width: `${60 + Math.random() * 40}%`}}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (loadingState.error) {
    const canRetry = loadingState.retryCount < MAX_RETRIES;
    
    return (
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-primary)] rounded-lg shadow-md">
        <div className="p-4 border-b border-[var(--color-border-primary)]">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center">
            <Globe className="h-5 w-5 mr-2" />
            Country Information
          </h3>
        </div>
        <div className="p-4 text-center">
          <div className="text-[var(--color-error)] mb-4">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm font-medium">Failed to load country information</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">{loadingState.error}</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {canRetry && (
              <button
                onClick={handleRetry}
                className="inline-flex items-center px-3 py-2 bg-[var(--color-brand-primary)] text-white rounded-md hover:bg-[var(--color-brand-dark)] transition-colors text-sm"
              >
                Try Again ({loadingState.retryCount}/{MAX_RETRIES})
              </button>
            )}
            <a
              href={getWikiUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-md hover:bg-[var(--color-bg-accent)] transition-colors text-sm"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View on Wiki
            </a>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!infobox) {
    return (
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-primary)] rounded-lg shadow-md">
        <div className="p-4 border-b border-[var(--color-border-primary)]">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center">
            <Globe className="h-5 w-5 mr-2" />
            Country Information
          </h3>
        </div>
        <div className="p-4 text-center">
          <div className="text-[var(--color-text-muted)] mb-4">
            <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No country information available</p>
            <p className="text-xs mt-1">This country may not have a wiki page yet.</p>
          </div>
          <a
            href={getWikiUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-[var(--color-brand-primary)] text-white rounded-md hover:bg-[var(--color-brand-dark)] transition-colors"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Wiki Page
          </a>
        </div>
      </div>
    );
  }

  // Success state with data
  const fields = formatInfoboxFields(infobox);
  const displayFields = isExpanded ? fields : fields.slice(0, 6);

  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-primary)] rounded-lg shadow-md transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b border-[var(--color-border-primary)]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center">
            <Globe className="h-5 w-5 mr-2" />
            {infobox.conventional_long_name || infobox.name}
          </h3>
          <div className="flex items-center space-x-2">
            <a
              href={getWikiUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-1 text-sm bg-[var(--color-brand-primary)] text-white rounded-md hover:bg-[var(--color-brand-dark)] transition-colors"
              title="View full wiki page"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Wiki
            </a>
            {fields.length > 6 && (
              <button
                onClick={handleToggle}
                className="inline-flex items-center px-3 py-1 text-sm bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-md hover:bg-[var(--color-bg-accent)] transition-colors"
                title={isExpanded ? 'Show less' : 'Show more'}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    More
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        
        {/* Native name subtitle */}
        {infobox.native_name && infobox.native_name !== infobox.name && (
          <p className="text-sm text-[var(--color-text-muted)] mt-1 italic">
            {infobox.native_name}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="space-y-3">
          {displayFields.map((field) => {
            const Icon = field.icon;
            return (
              <div key={field.key} className="flex items-start space-x-3">
                <Icon className="h-4 w-4 mt-0.5 text-[var(--color-brand-primary)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="text-sm font-medium text-[var(--color-text-muted)] sm:w-24 flex-shrink-0">
                      {field.label}:
                    </span>
                    <span className="text-sm text-[var(--color-text-primary)] break-words">
                      {field.value}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Show expand hint if there are more fields */}
        {!isExpanded && fields.length > 6 && (
          <div className="mt-4 pt-3 border-t border-[var(--color-border-primary)]">
            <button
              onClick={handleToggle}
              className="w-full text-center text-sm text-[var(--color-brand-primary)] hover:text-[var(--color-brand-dark)] transition-colors flex items-center justify-center"
            >
              <ChevronDown className="h-4 w-4 mr-1" />
              Show {fields.length - 6} more fields
            </button>
          </div>
        )}
      </div>

      {/* Footer with source info when expanded */}
      {isExpanded && (
        <div className="px-4 py-3 bg-[var(--color-bg-tertiary)] border-t border-[var(--color-border-primary)] rounded-b-lg">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>Source: Ixnay Wiki</span>
            <div className="flex items-center space-x-4">
              <span>Fields: {fields.length}</span>
              <a
                href={getWikiUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-brand-primary)] hover:text-[var(--color-brand-dark)] transition-colors flex items-center"
              >
                View full page
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}