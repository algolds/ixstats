// src/app/countries/_components/CountryInfobox.tsx
"use client";

import { useState, useEffect } from "react";
import { 
  ChevronDown, 
  ChevronRight, 
  ExternalLink, 
  Info, 
  Flag,
  MapPin,
  Users,
  Banknote,
  Crown,
  Clock,
  Phone,
  Globe as GlobeIcon,
  Calendar,
  Loader2
} from "lucide-react";
import { ixnayWiki, type CountryInfoboxData } from "~/lib/mediawiki-service";

interface CountryInfoboxProps {
  countryName: string;
  className?: string;
}

interface InfoboxField {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  format?: (value: string) => string;
  priority: number; // Lower numbers = higher priority
}

// Define the fields we want to display and their formatting
const INFOBOX_FIELDS: InfoboxField[] = [
  { key: 'capital', label: 'Capital', icon: MapPin, priority: 1 },
  { key: 'largest_city', label: 'Largest City', icon: MapPin, priority: 2 },
  { key: 'official_languages', label: 'Official Languages', priority: 3 },
  { key: 'government', label: 'Government Type', icon: Crown, priority: 4 },
  { key: 'leader_name1', label: 'Head of State', icon: Crown, priority: 5 },
  { key: 'leader_name2', label: 'Head of Government', icon: Crown, priority: 6 },
  { key: 'area_total', label: 'Total Area', format: (v) => `${v} km²`, priority: 7 },
  { key: 'area_land', label: 'Land Area', format: (v) => `${v} km²`, priority: 8 },
  { key: 'population_estimate', label: 'Population', icon: Users, priority: 9 },
  { key: 'population_density', label: 'Population Density', icon: Users, format: (v) => `${v}/km²`, priority: 10 },
  { key: 'gdp_nominal', label: 'GDP (Nominal)', icon: Banknote, priority: 11 },
  { key: 'gdp_nominal_per_capita', label: 'GDP per Capita', icon: Banknote, priority: 12 },
  { key: 'currency', label: 'Currency', icon: Banknote, priority: 13 },
  { key: 'time_zone', label: 'Time Zone', icon: Clock, priority: 14 },
  { key: 'calling_code', label: 'Calling Code', icon: Phone, priority: 15 },
  { key: 'internet_tld', label: 'Internet TLD', icon: GlobeIcon, priority: 16 },
  { key: 'established', label: 'Established', icon: Calendar, priority: 17 },
  { key: 'independence', label: 'Independence', icon: Calendar, priority: 18 },
];

export function CountryInfobox({ countryName, className = "" }: CountryInfoboxProps) {
  const [infoboxData, setInfoboxData] = useState<CountryInfoboxData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wikiUrl, setWikiUrl] = useState<string>("");

  useEffect(() => {
    const loadInfobox = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Get wiki URL immediately (it's computed, not fetched)
        const url = ixnayWiki.getWikiUrl(countryName);
        setWikiUrl(url);
        
        // Fetch infobox data
        const data = await ixnayWiki.getCountryInfobox(countryName);
        setInfoboxData(data);
        
        if (!data) {
          setError("No infobox data found for this country");
        }
      } catch (err) {
        console.error(`Failed to load infobox for ${countryName}:`, err);
        setError("Failed to load country information");
      } finally {
        setIsLoading(false);
      }
    };

    if (countryName) {
      loadInfobox();
    }
  }, [countryName]);

  const getDisplayFields = (): Array<{ field: InfoboxField; value: string }> => {
    if (!infoboxData) return [];
    
    const fields = INFOBOX_FIELDS
      .filter(field => {
        const value = infoboxData[field.key];
        return value && value.trim() !== '';
      })
      .map(field => ({
        field,
        value: infoboxData[field.key]!
      }))
      .sort((a, b) => a.field.priority - b.field.priority);
    
    return fields;
  };

  const formatValue = (field: InfoboxField, value: string): string => {
    if (field.format) {
      try {
        return field.format(value);
      } catch {
        return value;
      }
    }
    return value;
  };

  const displayFields = getDisplayFields();

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 ${className}`}>
        <div className="p-4">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-primary)] mr-2" />
            <span className="text-[var(--color-text-muted)]">Loading country info...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !infoboxData || displayFields.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 ${className}`}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center">
              <Info className="h-5 w-5 mr-2" />
              Country Information
            </h3>
            {wikiUrl && (
              <a
                href={wikiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-sm flex items-center px-3 py-1"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Wiki
              </a>
            )}
          </div>
          <div className="text-center py-4">
            <Info className="h-8 w-8 text-[var(--color-text-muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--color-text-muted)]">
              {error || "No additional country information available"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center text-lg font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-brand-primary)] transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5 mr-2" />
            ) : (
              <ChevronDown className="h-5 w-5 mr-2" />
            )}
            <Info className="h-5 w-5 mr-2" />
            Country Information
          </button>
          
          <div className="flex items-center gap-2">
            {wikiUrl && (
              <a
                href={wikiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-sm flex items-center px-3 py-1 hover:bg-[var(--color-brand-primary)] hover:text-white transition-colors"
                title="View on Wiki"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Wiki
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-4">
          <div className="space-y-3">
            {displayFields.map(({ field, value }) => {
              const IconComponent = field.icon;
              const formattedValue = formatValue(field, value);
              
              return (
                <div key={field.key} className="flex items-start justify-between gap-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                  <div className="flex items-center min-w-0 flex-1">
                    {IconComponent && (
                      <IconComponent className="h-4 w-4 text-[var(--color-text-muted)] mr-2 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium text-[var(--color-text-muted)] min-w-0">
                      {field.label}:
                    </span>
                  </div>
                  <div className="text-sm text-[var(--color-text-secondary)] text-right flex-shrink-0 max-w-[60%]">
                    {formattedValue}
                  </div>
                </div>
              );
            })}
          </div>
          
          {displayFields.length === 0 && (
            <div className="text-center py-4">
              <Info className="h-8 w-8 text-[var(--color-text-muted)] mx-auto mb-2" />
              <p className="text-sm text-[var(--color-text-muted)]">
                No additional information available
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { CountryInfobox };