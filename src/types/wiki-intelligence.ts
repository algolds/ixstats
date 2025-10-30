/**
 * Wiki Intelligence Types
 *
 * Type definitions for the Wiki Intelligence Tab component that integrates
 * MediaWiki data with IxStats country profiles. Supports multi-source wiki
 * integration (IxWiki, IIWiki, custom wikis) with intelligent content processing.
 */

import { type CountryInfobox } from "~/lib/mediawiki-service";

/**
 * Represents a single intelligence section extracted from wiki sources.
 *
 * Each section corresponds to a distinct topic or category of information
 * about a country (e.g., economy, government, history).
 */
export interface WikiSection {
  /** Unique identifier for the section (e.g., 'economy', 'government', 'overview') */
  id: string;

  /** Display title of the section */
  title: string;

  /** Source wiki page that produced this section */
  sourcePage?: string;

  /** Direct URL to the source wiki page */
  sourceUrl?: string;

  /** Full wiki markup content of the section */
  content: string;

  /** Security classification level determining access control */
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';

  /** Relative importance for prioritization and display order */
  importance: 'critical' | 'high' | 'medium' | 'low';

  /** ISO 8601 timestamp of last modification on the wiki */
  lastModified: string;

  /** Word count of the section content (excluding markup) */
  wordCount: number;

  /** Optional array of wiki image file names referenced in the section */
  images?: string[];

  /** Optional array of internal wiki links discovered in the section */
  links?: string[];

  /** Optional category tags associated with the section content */
  categories?: string[];

  /** Count of resolved wiki links within the section */
  linkCount?: number;

  /** Metadata describing when source content was fetched */
  lastFetched?: number;

  /** Approximate wikitext length retrieved when parsing */
  wikitextLength?: number;

  /** Number of API calls required to build this section */
  apiCallCount?: number;
}

/**
 * Complete wiki intelligence data package for a country.
 *
 * Aggregates all wiki-sourced information including structured infobox data,
 * content sections, metadata, and confidence metrics.
 */
export interface WikiIntelligenceData {
  /** Name of the country this intelligence data pertains to */
  countryName: string;

  /** Structured infobox data from the wiki (null if unavailable) */
  infobox: CountryInfobox | null;

  /** Optional direct flag asset URL derived from wiki sources */
  flagUrl?: string | null;

  /** Array of intelligence sections extracted from wiki pages */
  sections: WikiSection[];

  /** Unix timestamp (milliseconds) of when this data was last fetched/updated */
  lastUpdated: number;

  /** Confidence score (0-100) indicating data quality and completeness */
  confidence: number;

  /** Whether data is currently being fetched from wiki sources */
  isLoading: boolean;

  /** Optional error message if data fetching failed */
  error?: string;
}

/**
 * Represents a detected discrepancy between wiki data and IxStats data.
 *
 * Used for data integrity analysis and identifying inconsistencies that
 * may require manual review or synchronization.
 */
export interface DataConflict {
  /** Name of the field where the conflict was detected */
  field: string;

  /** Value from the wiki source (undefined if missing) */
  wikiValue: string | undefined;

  /** Value from IxStats database (undefined if missing) */
  ixStatsValue: string | number | undefined;

  /** Type of conflict detected */
  type: 'missing_in_wiki' | 'missing_in_ixstats' | 'value_mismatch' | 'format_difference';

  /** Severity level for prioritizing resolution efforts */
  severity: 'low' | 'medium' | 'high';
}

/**
 * Component props for the WikiIntelligenceTab component.
 */
export interface WikiIntelligenceTabProps {
  /** Name of the country to fetch intelligence for */
  countryName: string;

  /** Current country data from IxStats for comparison and fallback */
  countryData: {
    /** Current population count */
    currentPopulation: number;

    /** Current GDP per capita in USD */
    currentGdpPerCapita: number;

    /** Current total GDP in USD */
    currentTotalGdp: number;

    /** Economic tier classification */
    economicTier: string;

    /** Optional continent location */
    continent?: string;

    /** Optional region within continent */
    region?: string;

    /** Optional government system type */
    governmentType?: string;

    /** Optional current leader/head of state */
    leader?: string;

    /** Optional capital city */
    capital?: string;

    /** Optional primary religion */
    religion?: string;
  };

  /** Viewer's security clearance level for access control */
  viewerClearanceLevel: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';

  /** Optional flag colors for UI theming */
  flagColors?: {
    /** Primary flag color (hex) */
    primary: string;

    /** Secondary flag color (hex) */
    secondary: string;

    /** Accent flag color (hex) */
    accent: string;
  };
}

/**
 * Configuration settings for wiki intelligence gathering.
 *
 * Controls which wiki sources to use, how to discover pages, what content
 * to filter, and how to process the retrieved information.
 */
export interface WikiSettings {
  /** Enable IxWiki as a data source */
  enableIxWiki: boolean;

  /** Enable IIWiki as a data source */
  enableIIWiki: boolean;

  /** Enable generic MediaWiki API support */
  enableMediaWiki: boolean;

  /** Enable automatic discovery of related wiki pages */
  autoDiscovery: boolean;

  /** Maximum number of sections to display (fixed at 10) */
  maxSections: number;

  /** Array of custom wiki page names to explicitly include */
  customPages: string[];

  /** Base URLs for different wiki sources */
  wikiBaseUrls: {
    /** IxWiki base URL */
    ixwiki: string;

    /** IIWiki base URL */
    iiwiki: string;

    /** Custom wiki base URL (optional) */
    custom: string;
  };

  /** Content filtering preferences */
  contentFilters: {
    /** Remove wiki template markup */
    removeTemplates: boolean;

    /** Preserve wiki links in content */
    preserveLinks: boolean;

    /** Remove category tags */
    removeCategories: boolean;

    /** Remove infobox markup from sections */
    removeInfoboxes: boolean;

    /** Apply aggressive cleaning of wiki markup */
    aggressiveCleaning: boolean;
  };

  /** Page discovery strategy preferences */
  pageVariants: {
    /** Search for country name variants (e.g., "Country", "Country (nation)") */
    useCountryVariants: boolean;

    /** Search for topic-specific pages (e.g., "Economy of Country") */
    useTopicPages: boolean;

    /** Use custom search patterns */
    useCustomSearch: boolean;
  };
}
