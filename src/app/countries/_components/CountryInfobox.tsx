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
  Loader2
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
  priority: number; // Lower numbers shown first
}

export function CountryInfobox({ countryName, onToggle }: CountryInfoboxProps) {
  const [infobox, setInfobox] = useState<CountryInfobox | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInfobox = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await ixnayWiki.getCountryInfobox(countryName);
        setInfobox(data);
      } catch (err) {
        console.error(`Failed to load infobox for ${countryName}:`, err);
        setError('Failed to load country information');
      } finally {
        setIsLoading(false);
      }
    };

    loadInfobox();
  }, [countryName]);

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

    // Define field mappings with icons and priorities
    const fieldMappings: Array<{
      key: keyof CountryInfobox | string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      priority: number;
      formatter?: (value: string) => string;
    }> = [
      { key: 'capital', label: 'Capital', icon: Building, priority: 1 },
      { key: 'continent', label: 'Continent', icon: Globe, priority: 2 },
      { key: 'area', label: 'Area', icon: MapPin, priority: 3, formatter: (v) => v.includes('km') ? v : `${v} km²` },
      { key: 'population', label: 'Population', icon: Users, priority: 4 },
      { key: 'currency', label: 'Currency', icon: DollarSign, priority: 5 },
      { key: 'government', label: 'Government', icon: Building, priority: 6 },
      { key: 'leader', label: 'Leader', icon: Users, priority: 7 },
      { key: 'gdp', label: 'GDP', icon: DollarSign, priority: 8 },
      { key: 'languages', label: 'Languages', icon: Languages, priority: 9 },
      { key: 'timezone', label: 'Timezone', icon: Clock, priority: 10 },
      { key: 'callingCode', label: 'Calling Code', icon: Phone, priority: 11 },
      { key: 'internetTld', label: 'Internet TLD', icon: Wifi, priority: 12 },
      { key: 'drivingSide', label: 'Driving Side', icon: Navigation, priority: 13 },
    ];

    // Process standard fields
    for (const mapping of fieldMappings) {
      const value = infobox[mapping.key as keyof CountryInfobox];
      if (value && value.trim()) {
        const formattedValue = mapping.formatter ? mapping.formatter(value) : value;
        fields.push({
          key: mapping.key as string,
          label: mapping.label,
          value: formattedValue,
          icon: mapping.icon,
          priority: mapping.priority
        });
      }
    }

    // Process any additional fields not in our standard mappings
    const standardKeys = new Set(fieldMappings.map(m => m.key));
    for (const [key, value] of Object.entries(infobox)) {
      if (!standardKeys.has(key) && key !== 'name' && value && typeof value === 'string' && value.trim()) {
        // Format the key as a readable label
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        fields.push({
          key,
          label,
          value,
          icon: Info,
          priority: 20 // Lower priority for additional fields
        });
      }
    }

    // Sort by priority
    return fields.sort((a, b) => a.priority - b.priority);
  };

  if (isLoading) {
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
                  <div className="h-4 bg-[var(--color-bg-tertiary)] rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !infobox) {
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
            <p>{error || 'No country information available'}</p>
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

  const fields = formatInfoboxFields(infobox);
  const displayFields = isExpanded ? fields : fields.slice(0, 6); // Show first 6 when collapsed

  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-primary)] rounded-lg shadow-md transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b border-[var(--color-border-primary)]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center">
            <Globe className="h-5 w-5 mr-2" />
            {infobox.name}
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

      {/* Footer with wiki link when expanded */}
      {isExpanded && (
        <div className="px-4 py-3 bg-[var(--color-bg-tertiary)] border-t border-[var(--color-border-primary)] rounded-b-lg">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>Source: Ixnay Wiki</span>
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
      )}
    </div>
  );
}