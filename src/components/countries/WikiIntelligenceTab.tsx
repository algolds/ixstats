"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { CountryProfileInfoBox } from "./CountryProfileInfoBox";
import { IxTime } from "~/lib/ixtime";
import { IxnayWikiService, type CountryInfobox } from "~/lib/mediawiki-service";
import { api } from "~/trpc/react";
import {
  // Wiki Icons
  RiBookOpenLine,
  RiGlobalLine,
  RiMapLine,
  RiBuildingLine,
  RiMoneyDollarCircleLine,
  RiTeamLine,
  RiHeartLine,
  // Intelligence Icons
  RiShieldLine,
  RiInformationLine,
  RiAlertLine,
  RiExternalLinkLine,
  RiRefreshLine,
  RiSettings3Line,
  // Media Icons
  RiImageLine,
  RiFileLine,
  RiHistoryLine,
  RiArrowDownLine
} from "react-icons/ri";

// Enhanced wiki data types
interface WikiSection {
  id: string;
  title: string;
  content: string;
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  importance: 'critical' | 'high' | 'medium' | 'low';
  lastModified: string;
  wordCount: number;
  images?: string[];
}

interface WikiIntelligenceData {
  countryName: string;
  infobox: CountryInfobox | null;
  sections: WikiSection[];
  lastUpdated: number;
  confidence: number;
  isLoading: boolean;
  error?: string;
}

interface DataConflict {
  field: string;
  wikiValue: string | undefined;
  ixStatsValue: string | number | undefined;
  type: 'missing_in_wiki' | 'missing_in_ixstats' | 'value_mismatch' | 'format_difference';
  severity: 'low' | 'medium' | 'high';
}

interface WikiIntelligenceTabProps {
  countryName: string;
  countryData: {
    currentPopulation: number;
    currentGdpPerCapita: number;
    currentTotalGdp: number;
    economicTier: string;
    continent?: string;
    region?: string;
    governmentType?: string;
    leader?: string;
    capital?: string;
    religion?: string;
  };
  viewerClearanceLevel: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  flagColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

const CLASSIFICATION_STYLES = {
  'PUBLIC': {
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    label: 'PUBLIC'
  },
  'RESTRICTED': {
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    label: 'RESTRICTED'
  },
  'CONFIDENTIAL': {
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    label: 'CONFIDENTIAL'
  }
} as const;

const SECTION_ICONS = {
  'overview': RiGlobalLine,
  'geography': RiMapLine,
  'government': RiBuildingLine,
  'economy': RiMoneyDollarCircleLine,
  'demographics': RiTeamLine,
  'history': RiHistoryLine,
  'culture': RiHeartLine,
  'foreign_relations': RiGlobalLine,
  'military': RiShieldLine,
  'education': RiBookOpenLine,
  'default': RiBookOpenLine
} as const;


// Helper functions for intelligent content processing
const determineSectionType = (pageTitle: string, countryName: string): string => {
  const title = pageTitle.toLowerCase();
  const country = countryName.toLowerCase();
  
  // Main country page should be "overview"
  if (title === country || title === `${country} (country)` || title === `${country} (nation)`)
  {
    return 'overview';
  }
  
  // Specific topic pages
  if (title.includes('economy')) return 'economy';
  if (title.includes('politics') || title.includes('government')) return 'government';
  if (title.includes('history')) return 'history';
  if (title.includes('geography')) return 'geography';
  if (title.includes('demographics') || title.includes('population')) return 'demographics';
  if (title.includes('foreign relations') || title.includes('diplomatic')) return 'foreign_relations';
  if (title.includes('military') || title.includes('defense')) return 'military';
  if (title.includes('education')) return 'education';
  if (title.includes('culture')) return 'culture';
  return 'overview';
};

const determineImportance = (sectionType: string, content: string): 'critical' | 'high' | 'medium' | 'low' => {
  const criticalSections = ['economy', 'government', 'foreign_relations'];
  const highSections = ['geography', 'demographics', 'history'];
  
  if (criticalSections.includes(sectionType)) return 'critical';
  if (highSections.includes(sectionType)) return 'high';
  if (content.length > 1000) return 'medium';
  return 'low';
};

const determineClassification = (sectionType: string, content: string): 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL' => {
  const sensitiveKeywords = ['military', 'defense', 'intelligence', 'classified', 'secret'];
  const restrictedSections = ['foreign_relations', 'military'];
  
  if (restrictedSections.includes(sectionType) || 
      sensitiveKeywords.some(keyword => content.toLowerCase().includes(keyword))) {
    return 'RESTRICTED';
  }
  
  return 'PUBLIC';
};

const formatSectionTitle = (pageTitle: string, countryName: string): string => {
  return pageTitle
    .replace(new RegExp(`^(Economy|Politics|History|Geography|Demographics|Foreign relations|Military|Education|Culture) of ${countryName}`, 'i'), '$1')
    .replace(new RegExp(`^${countryName}( \(country\)| \(nation\))?$`, 'i'), 'Overview')
    .replace(/^(\\|w)/, char => char.toUpperCase());
};

const extractIntelligentSummary = (content: string, sectionType: string): string => {
  // AGGRESSIVELY REMOVE ALL TEMPLATE CODE FIRST
  let cleanContent = content
    // Remove ALL templates {{...}} completely
    .replace(/\{\{[^\{\}]*(?:\{[^\{\}]*\}[^\{\}]*)*\}\}/g, '')
    .replace(/\{\{.*?\}\}/gs, '')
    // Remove [[Template:...]] links completely
    .replace(/\[\[Template:[^\]]*\]\]/gi, '')
    // Remove any remaining template references
    .replace(/Template:[^\s\[\]]+/gi, '')
    .replace(/\[\[.*?Template.*?\]\]/gi, '')
    // Remove categories, files, language links
    .replace(/\[\[Category:[^\]]*\]\]/gi, '')
    .replace(/\[\[File:[^\]]*\]\]/gi, '')
    .replace(/\[\[[a-z]{2,3}:[^\]]*\]\]/gi, '')
    // Remove refs and citations
    .replace(/<ref[^>]*>.*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '')
    // Remove HTML comments
    .replace(/<!--.*?-->/g, '')
    // Remove table markup
    .replace(/\{\|.*?\|\}/gs, '')
    // Remove magic words
    .replace(/__[A-Z_]+__/g, '')
    .trim();

  // NOW process the cleaned content for display
  const processedContent = cleanContent
    // Preserve internal links with proper formatting (ONLY non-template links)
    .replace(/\[\[([^|]*)\|([^\]]*)\]\]/g, (_, page, display) => {
      if (page.toLowerCase().includes('template:')) return '';
      return `<a href="https://ixwiki.com/wiki/${encodeURIComponent(page)}" class="wiki-link text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">${display}</a>`;
    })
    .replace(/\[\[([^\]]*)\]\]/g, (_, page) => {
      if (page.toLowerCase().includes('template:')) return '';
      return `<a href="https://ixwiki.com/wiki/${encodeURIComponent(page)}" class="wiki-link text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">${page}</a>`;
    })
    // Preserve external links
    .replace(/\[([^\s\]]+)\s+([^\]]+)\]/g, '<a href="$1" class="external-link text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 underline" target="_blank">$2</a>')
    // Preserve text formatting
    .replace(/'''([^']*)'''/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/''([^']*)''/g, '<em class="italic text-muted-foreground">$1</em>')
    // Handle lists
    .replace(/^\*\s+(.+)$/gm, '<li class="ml-4 text-sm">• $1</li>')
    .replace(/^#\s+(.+)$/gm, '<li class="ml-4 text-sm list-decimal">$1</li>')
    // Handle headings
    .replace(/^==\s+([^=]+)\s+==/gm, '<h3 class="text-lg font-semibold text-foreground mt-4 mb-2">$1</h3>')
    .replace(/^===\s+([^=]+)\s+===/gm, '<h4 class="text-md font-medium text-muted-foreground mt-3 mb-1">$1</h4>')
    // Clean up paragraphs
    .replace(/\n\n+/g, '</p><p class="mb-3 text-sm leading-relaxed">')
    .replace(/^\s*<\/p>/, '')
    .replace(/<p[^>]*>\s*<\/p>/g, '');

  // Split into paragraphs and take first few
  const paragraphs = processedContent
    .split('</p><p')
    .filter(p => p.trim().length > 50)
    .slice(0, 3)
    .join('</p><p');
    
  // Wrap in paragraph tags and truncate if needed
  let result = `<p class="mb-3 text-sm leading-relaxed">${paragraphs}</p>`;
  
  if (result.length > 1200) {
    result = result.substring(0, 1200) + '...</p>';
  }
  
  return result || `<p class="text-sm text-muted-foreground">Detailed information about ${sectionType} is available in the wiki archives.</p>`;
};

// Helper to parse infobox values that may contain wiki markup
const parseInfoboxValue = (value: string | undefined, handleWikiLinkClick: (page: string) => void): React.ReactElement | string => {
  if (!value) return '';
  
  // Simple check if it contains wiki markup
  if (value.includes('[[') || value.includes('{{')) {
    return parseWikiContent(value, handleWikiLinkClick);
  }
  
  // Return plain text for simple values
  return value;
};

// Enhanced content parser that aggressively filters out wiki noise
const parseWikiContent = (content: string, handleWikiLinkClick: (page: string) => void): React.ReactElement => {
  // Aggressively clean content - remove ALL templates, categories, and wiki markup noise
  let cleanedContent = content
    // Remove ALL templates {{...}} completely - INCLUDING NESTED ONES
    .replace(/\{\{[^\{\}]*(?:\{[^\{\}]*\}[^\{\}]*)*\}\}/g, '')
    .replace(/\{\{.*?\}\}/gs, '')
    // Remove [[Template:...]] links completely
    .replace(/\[\[Template:[^\]]*\]\]/gi, '')
    // Remove categories [[Category:...]]
    .replace(/\[\[Category:[^\]]*\]\]/gi, '')
    // Remove file/image links that aren't displayed [[File:...]]
    .replace(/\[\[File:[^\]]*\]\]/gi, '')
    // Remove language links [[es:...]], [[fr:...]], etc
    .replace(/\[\[[a-z]{2,3}:[^\]]*\]\]/gi, '')
    // Remove refs and citations <ref>...</ref>
    .replace(/<ref[^>]*>.*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '')
    // Remove HTML comments <!-- ... -->
    .replace(/<!--.*?-->/g, '')
    // Remove table markup
    .replace(/\{\|.*?\|\}/gs, '')
    // Remove magic words __NOTOC__, __FORCETOC__, etc
    .replace(/__[A-Z_]+__/g, '')
    // Remove div tags and other HTML
    .replace(/<\/?div[^>]*>/gi, '')
    .replace(/<\/?span[^>]*>/gi, '')
    // REMOVE ANY REMAINING TEMPLATE REFERENCES
    .replace(/Template:[^\s\[\]]+/gi, '')
    .replace(/\[\[.*?Template.*?\]\]/gi, '')
    // Clean up excessive whitespace and newlines
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
  
  // Split content by wiki links to handle them properly in React
  const parts = cleanedContent.split(/(\[\[[^\]]*\]\])/g);
  
  return (
    <div className="wiki-content">
      {parts.map((part, index) => {
        // Handle wiki links [[Page]] or [[Page|Display]]
        const wikiLinkMatch = part.match(/\[\[([^|]*)\|?([^\]]*)\]\]/);
        if (wikiLinkMatch) {
          const [, page, displayText] = wikiLinkMatch;
          const linkText = displayText || page;
          if (page) {
            return (
              <button
                key={index}
                onClick={() => handleWikiLinkClick(page)}
                className="wiki-link text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline cursor-pointer bg-transparent border-none p-0 font-inherit"
              >
                {linkText}
              </button>
            );
          }
        }
        
        // Handle external links [URL Text]
        const externalLinkMatch = part.match(/\[([^\s\]]+)\s+([^\]]+)\]/);
        if (externalLinkMatch) {
          const [, url, text] = externalLinkMatch;
          return (
            <a
              key={index}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="external-link text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 underline"
            >
              {text} <RiExternalLinkLine className="inline h-3 w-3" />
            </a>
          );
        }
        
        // Handle other markup and return as HTML
        return (
          <span
            key={index}
            dangerouslySetInnerHTML={{
              __html: part
                .replace(/'''([^']*)'''/g, '<strong class="font-semibold text-foreground">$1</strong>')
                .replace(/''([^']*)''/g, '<em class="italic text-muted-foreground">$1</em>')
                .replace(/^\*\s+(.+)$/gm, '<li class="ml-4">• $1</li>')
                .replace(/^==\s+([^=]+)\s+==/gm, '<h3 class="text-lg font-semibold text-foreground mt-4 mb-2">$1</h3>')
            }}
          />
        );
      })}
    </div>
  );
};

export const WikiIntelligenceTab: React.FC<WikiIntelligenceTabProps> = ({
  countryName,
  countryData,
  viewerClearanceLevel = 'PUBLIC',
  flagColors = { primary: '#3b82f6', secondary: '#6366f1', accent: '#8b5cf6' }
}) => {
  const [activeView, setActiveView] = useState<'sections' | 'conflicts' | 'settings'>('sections');
  const [wikiSettings, setWikiSettings] = useState({
    enableIxWiki: true,
    enableIIWiki: false,
    enableMediaWiki: true,
    autoDiscovery: true,
    maxSections: 8,
    customPages: [] as string[],
    wikiBaseUrls: {
      ixwiki: 'https://ixwiki.com',
      iiwiki: 'https://iiwiki.com',
      custom: ''
    },
    contentFilters: {
      removeTemplates: true,
      preserveLinks: true,
      removeCategories: true,
      removeInfoboxes: false,
      aggressiveCleaning: true
    },
    pageVariants: {
      useCountryVariants: true,
      useTopicPages: true,
      useCustomSearch: false
    }
  });

  // NEW: Use tRPC cached data (3-layer caching: Redis → Database → API)
  const { data: profileData, isLoading, error, refetch } = api.wikiCache.getCountryProfile.useQuery({
    countryName,
    includePageVariants: wikiSettings.autoDiscovery,
    maxSections: wikiSettings.maxSections,
  });

  // NEW: Mutation for refreshing cache
  const refreshMutation = api.wikiCache.refreshCountryCache.useMutation();

  // Transform cached profile data to component state format
  const wikiData = useMemo((): WikiIntelligenceData => {
    if (isLoading) {
      return {
        countryName,
        infobox: null,
        sections: [],
        lastUpdated: 0,
        confidence: 0,
        isLoading: true,
        error: undefined
      };
    }

    if (error || !profileData) {
      // Fallback sections when no data is available
      const fallbackSections: WikiSection[] = [
        {
          id: 'overview',
          title: 'Overview',
          content: `[[${countryName}]] is a sovereign nation located in ${countryData.continent || 'an undisclosed region'}. With a population of ${countryData.currentPopulation.toLocaleString()} and operating under a ${countryData.governmentType || 'democratic'} system of government, the country plays an important role in regional affairs.`,
          classification: 'PUBLIC',
          importance: 'critical',
          lastModified: new Date().toISOString(),
          wordCount: 120
        },
      ];

      return {
        countryName,
        infobox: null,
        sections: fallbackSections,
        lastUpdated: Date.now(),
        confidence: 0,
        isLoading: false,
        error: error?.message || 'Failed to load wiki data'
      };
    }

    return {
      countryName,
      infobox: profileData.infobox,
      sections: profileData.sections || [],
      lastUpdated: profileData.lastUpdated || Date.now(),
      confidence: profileData.confidence || 0,
      isLoading: false,
      error: undefined
    };
  }, [profileData, isLoading, error, countryName, countryData]);

  // Initialize wiki service (keep for fallback/legacy support)
  const wikiService = useMemo(() => new IxnayWikiService(), []);

  // Handle wiki link clicks
  const handleWikiLinkClick = useCallback((pageName: string) => {
    console.log(`[WikiIntelligence] Wiki link clicked: ${pageName}`);
    
    // In a real implementation, this would:
    // 1. Open the wiki page in a new tab/modal
    // 2. Or navigate to the page within the app
    // 3. Or show a preview popup
    
    // For now, open in new tab to IxWiki
    const wikiUrl = `https://ixwiki.com/wiki/${encodeURIComponent(pageName)}`;
    window.open(wikiUrl, '_blank', 'noopener,noreferrer');
    
    // Alternative: Could add to recent pages or show inline preview
    // setRecentWikiPages(prev => [pageName, ...prev.slice(0, 4)]);
  }, []);

  // OLD: Removed discoverSectionsWithSettings and useEffect - now using tRPC cached data

  // Calculate data conflicts
  const dataConflicts: DataConflict[] = useMemo(() => {
    if (!wikiData.infobox) return [];
    
    const conflicts: DataConflict[] = [];
    
    // Check population conflicts
    if (wikiData.infobox.population_estimate) {
      const wikiPop = parseInt(wikiData.infobox.population_estimate.replace(/[^0-9]/g, ''));
      const ixStatsPop = countryData.currentPopulation;
      if (Math.abs(wikiPop - ixStatsPop) / ixStatsPop > 0.1) { // 10% difference
        conflicts.push({
          field: 'Population',
          wikiValue: wikiData.infobox.population_estimate,
          ixStatsValue: ixStatsPop.toLocaleString(),
          type: 'value_mismatch',
          severity: 'high'
        });
      }
    }
    
    // Check capital conflicts
    if (wikiData.infobox.capital && countryData.capital) {
      if (wikiData.infobox.capital.toLowerCase() !== countryData.capital.toLowerCase()) {
        conflicts.push({
          field: 'Capital',
          wikiValue: wikiData.infobox.capital,
          ixStatsValue: countryData.capital,
          type: 'value_mismatch',
          severity: 'medium'
        });
      }
    }
    
    // Check government type conflicts
    if (wikiData.infobox.government_type && countryData.governmentType) {
      if (!wikiData.infobox.government_type.toLowerCase().includes(countryData.governmentType.toLowerCase())) {
        conflicts.push({
          field: 'Government Type',
          wikiValue: wikiData.infobox.government_type,
          ixStatsValue: countryData.governmentType,
          type: 'value_mismatch',
          severity: 'low'
        });
      }
    }
    
    return conflicts;
  }, [wikiData.infobox, countryData]);

  // NEW: Refresh wiki data using tRPC mutation (clears cache and refetches)
  const handleRefresh = async () => {
    try {
      console.log('[WikiIntelligence] Manual refresh triggered - clearing cache');
      
      // Clear cache and refetch
      await refreshMutation.mutateAsync({ countryName });
      
      // Refetch the data
      await refetch();
      
      console.log(`[WikiIntelligence] Refresh complete for ${countryName}`);
    } catch (error) {
      console.error('[WikiIntelligence] Refresh error:', error);
    }
  };

  // Check access permissions
  const hasAccess = (classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL') => {
    const levels = { 'PUBLIC': 1, 'RESTRICTED': 2, 'CONFIDENTIAL': 3 };
    return levels[viewerClearanceLevel] >= levels[classification];
  };

  if (wikiData.isLoading) {
    return (
      <div className="space-y-6">
        <Card className="glass-hierarchy-child">
          <CardHeader>
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (wikiData.error) {
    return (
      <Card className="glass-hierarchy-child">
        <CardContent className="p-8 text-center">
          <RiAlertLine className="h-12 w-12 mx-auto mb-4 text-red-600 dark:text-red-400" />
          <h3 className="text-lg font-semibold mb-2">Wiki Intelligence Unavailable</h3>
          <p className="text-muted-foreground mb-4">{wikiData.error}</p>
          <Button onClick={handleRefresh} variant="outline">
            <RiRefreshLine className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Flag Background */}
      <div className="glass-hierarchy-child rounded-lg relative overflow-hidden">
        {/* Country Flag Background */}
        {wikiData.infobox?.image_flag || wikiData.infobox?.flag ? (
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
            <img
              src={`https://ixwiki.com/wiki/Special:Filepath/${wikiData.infobox.image_flag || wikiData.infobox.flag}`}
              alt="Flag background"
              className="w-full h-full object-cover object-center scale-150 blur-sm"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/60 to-background/80"></div>
          </div>
        ) : null}
        
        <div className="relative p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-blue-500/20 backdrop-blur-sm">
                <RiBookOpenLine className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Wiki Intelligence</h2>
               
              </div>
            </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-blue-500/30 text-blue-400">
              {wikiData.infobox ? 'CONNECTED' : 'LIMITED'}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshMutation.isPending || isLoading}
              className="border-green-500/30 text-green-400 hover:bg-green-500/10"
            >
              <RiRefreshLine className={cn("h-4 w-4 mr-2", (refreshMutation.isPending || isLoading) && "animate-spin")} />
              Refresh
            </Button>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex flex-wrap gap-2 mb-6">
            {[ 
              { id: 'sections', label: 'Dossier', icon: RiBookOpenLine },
              { id: 'conflicts', label: `Data Analysis ${dataConflicts.length > 0 ? `(${dataConflicts.length})` : ''}`, icon: RiShieldLine },
              // Only show settings for authenticated users with higher clearance
              ...(viewerClearanceLevel !== 'PUBLIC' ? [{ id: 'settings', label: 'Discovery Settings', icon: RiSettings3Line }] : [])
            ].map((view) => {
            const ViewIcon = view.icon;
            return (
              <Button
                key={view.id}
                variant={activeView === view.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveView(view.id as any)}
                className="flex items-center gap-2"
              >
                <ViewIcon className="h-4 w-4" />
                {view.label}
              </Button>
            );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeView === 'sections' && (
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              {/* Main Content - Dossier Sections */}
              <div className="xl:col-span-3 space-y-4">
                {wikiData.sections
                  .filter(section => hasAccess(section.classification) && section.id !== 'overview')
                  .map((section) => {
                  const SectionIcon = SECTION_ICONS[section.id as keyof typeof SECTION_ICONS] || SECTION_ICONS.default;
                  return (
                    <Card key={section.id} className="glass-hierarchy-child">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <SectionIcon className="h-5 w-5" style={{ color: flagColors.primary }} />
                            {section.title}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline"
                              className={cn(
                                "text-xs",
                                CLASSIFICATION_STYLES[section.classification].color
                              )}
                            >
                              {section.classification}
                            </Badge>
                            <Badge 
                              variant="secondary"
                              className={cn(
                                "text-xs",
                                section.importance === 'critical' && "bg-red-500/20 text-red-400",
                                section.importance === 'high' && "bg-orange-500/20 text-orange-400",
                                section.importance === 'medium' && "bg-blue-500/20 text-blue-400",
                                section.importance === 'low' && "bg-gray-500/20 text-gray-400"
                              )}
                            >
                              {section.importance.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* Enhanced content with image support */}
                        <div className="space-y-4">
                          {/* Content with proper link handling and image support */}
                          <div className="text-sm leading-relaxed prose prose-sm prose-invert max-w-none">
                            {parseWikiContent(section.content, handleWikiLinkClick)}
                          </div>
                          
                          {/* Display actual images if they exist */}
                          {section.images && section.images.length > 0 && (
                            <div className="mt-4 space-y-2">
                              <p className="text-xs text-muted-foreground mb-2">Media from wiki source:</p>
                              <div className="flex flex-wrap gap-2">
                                {section.images.map((imageLink, index) => {
                                  const fileName = imageLink.replace(/\\\[\[File:([^|\\]+).*\\\]\]/, '$1');
                                  return (
                                    <img
                                      key={index}
                                      src={`https://ixwiki.com/wiki/Special:Filepath/${fileName}`}
                                      alt={`Image from ${section.title}`}
                                      className="max-w-32 h-auto rounded border border-muted-foreground/30 cursor-pointer"
                                      onError={(e) => e.currentTarget.style.display = 'none'}
                                      onClick={() => window.open(`https://ixwiki.com/wiki/File:${fileName}`, '_blank')}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* Wiki markup indicators */}
                          {section.content.includes('{{') && (
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                              <div className="flex items-center gap-2 text-sm text-blue-400">
                                <RiFileLine className="h-4 w-4" />
                                <span>Contains Wiki Templates</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Dynamic content available - templates may include infoboxes, navboxes, or other structured data
                              </p>
                            </div>
                          )}
                          
                          {/* Full Article Access */}
                          <div className="flex gap-2 pt-3 border-t border-border/30">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Open full wiki article for the section
                                const articleName = section.title.includes(' of ') 
                                  ? section.title 
                                  : `${section.title} of ${countryName}`;
                                window.open(`https://ixwiki.com/wiki/${encodeURIComponent(articleName)}`, '_blank');
                              }}
                              className="flex-1"
                            >
                              <RiExternalLinkLine className="h-3 w-3 mr-1" />
                              View Full Article
                            </Button>
                            
                            {section.images && section.images.length > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  // Show category page for this section's media
                                  const articleName = section.title.includes(' of ') 
                                    ? section.title 
                                    : `${section.title} of ${countryName}`;
                                  window.open(`https://ixwiki.com/wiki/Category:${encodeURIComponent(articleName)}_images`, '_blank');
                                }}
                              >
                                <RiImageLine className="h-3 w-3 mr-1" />
                                {section.images.length} Media
                              </Button>
                            )}
                          </div>
                          
                          {/* Section metadata */}
                          <div className="mt-4 pt-3 border-t border-border/30 text-xs text-muted-foreground">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <span>{section.wordCount} words</span>
                                <span>Last updated: {new Date(section.lastModified).toLocaleDateString()}</span>
                              </div>
                              {section.content.includes('[') && (
                                <span className="flex items-center gap-1 text-blue-400">
                                  <RiExternalLinkLine className="h-3 w-3" />
                                  {section.content.match(/\\\[\[[^\]]*\\\]/g)?.length || 0} wiki links
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Right Sidebar - Wiki Infobox */}
              <div className="xl:col-span-1">
                <div className="sticky top-6">
                  {wikiData.infobox ? (
                    <Card className="glass-hierarchy-child">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <RiGlobalLine className="h-5 w-5" style={{ color: flagColors.primary }} />
                          Wiki Intelligence
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* NATIONAL SYMBOLS - Compact but Prominent */}
                        {(wikiData.infobox.image_flag || wikiData.infobox.flag || wikiData.infobox.image_coat || wikiData.infobox.coat_of_arms) && (
                          <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 rounded-lg border border-amber-500/20 p-3">
                            <h4 className="font-medium flex items-center gap-2 mb-3 text-sm">
                              <RiShieldLine className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                              National Symbols
                            </h4>
                            <div className="flex items-center justify-center gap-4">
                              {(wikiData.infobox.image_flag || wikiData.infobox.flag) && (
                                <div className="group cursor-pointer" 
                                     onClick={() => {
                                       const flagFile = wikiData.infobox?.image_flag || wikiData.infobox?.flag;
                                       if (flagFile) window.open(`https://ixwiki.com/wiki/File:${flagFile}`, '_blank');
                                     }}>
                                  <div className="text-center">
                                    <div className="relative p-2 bg-blue-500/10 rounded-lg border border-blue-400/30 group-hover:border-blue-400/50 transition-all duration-300 mb-1">
                                      <img
                                        src={`https://ixwiki.com/wiki/Special:Filepath/${wikiData.infobox.image_flag || wikiData.infobox.flag}`}
                                        alt="National Flag"
                                        className="w-12 h-7 rounded shadow-lg object-cover group-hover:scale-105 transition-transform duration-300"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                      />
                                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                                    </div>
                                    <div className="font-medium text-blue-400 text-xs">Flag</div>
                                  </div>
                                </div>
                              )}
                              
                              {(wikiData.infobox.image_coat || wikiData.infobox.coat_of_arms) && (
                                <div className="group cursor-pointer"
                                     onClick={() => {
                                       const coatFile = wikiData.infobox?.image_coat || wikiData.infobox?.coat_of_arms;
                                       if (coatFile) window.open(`https://ixwiki.com/wiki/File:${coatFile}`, '_blank');
                                     }}>
                                  <div className="text-center">
                                    <div className="relative p-2 bg-amber-500/10 rounded-lg border border-amber-400/30 group-hover:border-amber-400/50 transition-all duration-300 mb-1">
                                      <img
                                        src={`https://ixwiki.com/wiki/Special:Filepath/${wikiData.infobox.image_coat || wikiData.infobox.coat_of_arms}`}
                                        alt="Coat of Arms"
                                        className="w-7 h-7 rounded shadow-lg object-cover group-hover:scale-105 transition-transform duration-300"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                      />
                                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                                    </div>
                                    <div className="font-medium text-amber-400 text-xs">Coat of Arms</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Key Info Fields - Compact Sidebar Format */}
                        {(() => {
                          // Extract key fields for sidebar display
                          const keyFields = [
                            { key: 'capital', label: 'Capital' },
                            { key: 'government_type', label: 'Government' },
                            { key: 'leader_name1', label: 'Head of State' },
                            { key: 'official_languages', label: 'Languages' },
                            { key: 'currency', label: 'Currency' },
                            { key: 'demonym', label: 'Demonym' },
                          ].filter(field => wikiData.infobox?.[field.key as keyof typeof wikiData.infobox]);

                          return keyFields.length > 0 ? (
                            <div className="space-y-3">
                              {keyFields.map(field => (
                                <div key={field.key} className="bg-muted/20 rounded-lg p-2">
                                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                                    {field.label}
                                  </div>
                                  <div className="text-xs text-foreground leading-relaxed">
                                    {parseInfoboxValue(
                                      wikiData.infobox?.[field.key as keyof typeof wikiData.infobox] as string,
                                      handleWikiLinkClick
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null;
                        })()}

                        {/* Raw data for advanced users */}
                        {viewerClearanceLevel !== 'PUBLIC' && (
                          <div className="pt-3 border-t border-border/50">
                            <details className="group">
                              <summary className="cursor-pointer text-xs font-medium text-muted-foreground group-open:text-foreground">
                                Raw Data ({Object.keys(wikiData.infobox).length} fields)
                              </summary>
                              <div className="mt-2 p-2 bg-muted/30 rounded text-xs font-mono max-h-32 overflow-auto">
                                <pre className="text-xs">{JSON.stringify(wikiData.infobox, null, 1)}</pre>
                              </div>
                            </details>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="glass-hierarchy-child">
                      <CardContent className="p-4 text-center">
                        <RiBookOpenLine className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <h3 className="text-sm font-semibold mb-1">No Infobox Data</h3>
                        <p className="text-xs text-muted-foreground mb-3">
                          Wiki infobox could not be retrieved.
                        </p>
                        <Button onClick={handleRefresh} variant="outline" size="sm">
                          <RiRefreshLine className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeView === 'conflicts' && (
            <div className="space-y-6">
              {dataConflicts.length > 0 ? (
                <Card className="glass-hierarchy-child">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RiShieldLine className="h-5 w-5 text-orange-400" />
                      Data Intelligence Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dataConflicts.map((conflict, index) => (
                        <div 
                          key={index}
                          className={cn(
                            "p-4 rounded-lg border-l-4",
                            conflict.severity === 'high' && "border-red-500 bg-red-500/10",
                            conflict.severity === 'medium' && "border-yellow-500 bg-yellow-500/10",
                            conflict.severity === 'low' && "border-blue-500 bg-blue-500/10"
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium">{conflict.field} Discrepancy</h4>
                              <div className="mt-2 space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Wiki:</span>
                                  <span>{conflict.wikiValue || 'Not specified'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">IxStats:</span>
                                  <span>{conflict.ixStatsValue || 'Not specified'}</span>
                                </div>
                              </div>
                            </div>
                            <Badge 
                              variant="outline"
                              className={cn(
                                "ml-4",
                                conflict.severity === 'high' && "border-red-500/30 text-red-400",
                                conflict.severity === 'medium' && "border-yellow-500/30 text-yellow-400",
                                conflict.severity === 'low' && "border-blue-500/30 text-blue-400"
                              )}
                            >
                              {conflict.severity.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="glass-hierarchy-child">
                  <CardContent className="p-8 text-center">
                    <RiShieldLine className="h-12 w-12 mx-auto mb-4 text-green-400" />
                    <h3 className="text-lg font-semibold mb-2">Data Integrity Confirmed</h3>
                    <p className="text-muted-foreground">
                      No significant conflicts detected between Wiki and IxStats data.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeView === 'settings' && (
            <div className="space-y-6">
              <Card className="glass-hierarchy-child">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RiSettings3Line className="h-5 w-5 text-blue-400" />
                    Intelligence Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Wiki Sources */}
                  <div>
                    <h4 className="font-medium mb-3">Sources</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={wikiSettings.enableIxWiki}
                            onChange={(e) => setWikiSettings(prev => ({ ...prev, enableIxWiki: e.target.checked }))}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <div>
                            <div className="font-medium">IxWiki</div>
                            <div className="text-sm text-muted-foreground">ixwiki.com - The bespoke two-decades old geopolitical worldbuilding community & fictional encyclopedia                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-green-400 border-green-400/30">
                          Active
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={wikiSettings.enableIIWiki}
                            onChange={(e) => setWikiSettings(prev => ({ ...prev, enableIIWiki: e.target.checked }))}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <div>
                            <div className="font-medium">IIWiki</div>
                            <div className="text-sm text-muted-foreground">iiwiki.com - SimFic and Alt-History Encyclopedia</div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-blue-400 border-blue-400/30">
                          Optional
                        </Badge>
                      </div>

                      <div className="p-3 bg-muted/20 rounded-lg">
                        <div className="font-medium mb-2">Custom Wiki URL</div>
                        <input
                          type="url"
                          placeholder="https://custom-wiki.com"
                          value={wikiSettings.wikiBaseUrls.custom}
                          onChange={(e) => setWikiSettings(prev => ({
                            ...prev, 
                            wikiBaseUrls: { ...prev.wikiBaseUrls, custom: e.target.value }
                          }))}
                          className="w-full p-2 bg-background/50 rounded border border-border text-sm"
                        />
                        <div className="text-xs text-muted-foreground mt-1">
                          Use a custom wiki for additional content sources
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Content Processing */}
                  <div>
                    <h4 className="font-medium mb-3">Content Processing & Filters</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-muted/20 rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                          <input
                            type="checkbox"
                            checked={wikiSettings.contentFilters.removeTemplates}
                            onChange={(e) => setWikiSettings(prev => ({
                              ...prev, 
                              contentFilters: { ...prev.contentFilters, removeTemplates: e.target.checked }
                            }))}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <div className="font-medium">Remove Templates</div>
                        </div>
                        <div className="text-xs text-muted-foreground">Strip {'{{'} templates {'}}'}  markup from content</div>
                      </div>

                      <div className="p-3 bg-muted/20 rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                          <input
                            type="checkbox"
                            checked={wikiSettings.contentFilters.preserveLinks}
                            onChange={(e) => setWikiSettings(prev => ({
                              ...prev, 
                              contentFilters: { ...prev.contentFilters, preserveLinks: e.target.checked }
                            }))}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <div className="font-medium">Preserve Wiki Links</div>
                        </div>
                        <div className="text-xs text-muted-foreground">Keep [[Internal]] and [External] links</div>
                      </div>

                      <div className="p-3 bg-muted/20 rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                          <input
                            type="checkbox"
                            checked={wikiSettings.contentFilters.removeCategories}
                            onChange={(e) => setWikiSettings(prev => ({
                              ...prev, 
                              contentFilters: { ...prev.contentFilters, removeCategories: e.target.checked }
                            }))}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <div className="font-medium">Remove Categories</div>
                        </div>
                        <div className="text-xs text-muted-foreground">Strip [[Category:...]] markup</div>
                      </div>

                      <div className="p-3 bg-muted/20 rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                          <input
                            type="checkbox"
                            checked={wikiSettings.contentFilters.aggressiveCleaning}
                            onChange={(e) => setWikiSettings(prev => ({
                              ...prev, 
                              contentFilters: { ...prev.contentFilters, aggressiveCleaning: e.target.checked }
                            }))}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <div className="font-medium">Aggressive Cleaning</div>
                        </div>
                        <div className="text-xs text-muted-foreground">Remove refs, comments, and markup</div>
                      </div>
                    </div>
                  </div>

                  {/* Page Discovery Strategy */}
                  <div>
                    <h4 className="font-medium mb-3">Page Discovery Strategy</h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-muted/20 rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                          <input
                            type="checkbox"
                            checked={wikiSettings.pageVariants.useCountryVariants}
                            onChange={(e) => setWikiSettings(prev => ({
                              ...prev, 
                              pageVariants: { ...prev.pageVariants, useCountryVariants: e.target.checked }
                            }))}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <div className="font-medium">Country Name Variants</div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Search: "{countryName}", "{countryName} (country)", "{countryName} (nation)"
                        </div>
                      </div>

                      <div className="p-3 bg-muted/20 rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                          <input
                            type="checkbox"
                            checked={wikiSettings.pageVariants.useTopicPages}
                            onChange={(e) => setWikiSettings(prev => ({
                              ...prev, 
                              pageVariants: { ...prev.pageVariants, useTopicPages: e.target.checked }
                            }))}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <div className="font-medium">Topic-Specific Pages</div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Search: "Economy of X", "Politics of X", "History of X", etc.
                        </div>
                      </div>

                      <div className="p-3 bg-muted/20 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">Maximum Sections to Fetch</div>
                          <span className="text-sm text-muted-foreground">{wikiSettings.maxSections}</span>
                        </div>
                        <input
                          type="range"
                          min="3"
                          max="20"
                          value={wikiSettings.maxSections}
                          onChange={(e) => setWikiSettings(prev => ({ ...prev, maxSections: parseInt(e.target.value) }))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="text-xs text-muted-foreground mt-1">
                          Limit the number of wiki pages to process (affects performance)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Custom Pages */}
                  <div>
                    <h4 className="font-medium mb-3">Custom Wiki Pages</h4>
                    <div className="p-3 bg-muted/20 rounded-lg">
                      <div className="text-sm text-muted-foreground mb-2">
                        Add specific wiki pages to search for (one per line). These will be processed in addition to automatic discovery.
                      </div>
                      <textarea
                        placeholder={`List of ${countryName}\nGovernment of ${countryName}\nMilitary of ${countryName}\n${countryName} Armed Forces\nCulture of ${countryName}\nCustom page name...`}
                        value={wikiSettings.customPages.join('\n')}
                        onChange={(e) => setWikiSettings(prev => ({
                          ...prev, 
                          customPages: e.target.value.split('\n').filter(p => p.trim())
                        }))}
                        className="w-full h-32 p-3 bg-background/50 rounded border border-border text-sm resize-none font-mono"
                      />
                      <div className="text-xs text-muted-foreground mt-2">
                        {wikiSettings.customPages.length} custom pages configured
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t border-border/50">
                    <Button 
                      onClick={async () => {
                        console.log('[WikiIntelligence] Applying advanced settings:', wikiSettings);
                        await handleRefresh();
                      }}
                      className="flex-1"
                    >
                      <RiRefreshLine className="h-4 w-4 mr-2" />
                      Apply Settings & Refresh
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setWikiSettings({
                          enableIxWiki: true,
                          enableIIWiki: false,
                          enableMediaWiki: true,
                          autoDiscovery: true,
                          maxSections: 8,
                          customPages: [],
                          wikiBaseUrls: {
                            ixwiki: 'https://ixwiki.com',
                            iiwiki: 'https://iiwiki.com',
                            custom: ''
                          },
                          contentFilters: {
                            removeTemplates: true,
                            preserveLinks: true,
                            removeCategories: true,
                            removeInfoboxes: false,
                            aggressiveCleaning: true
                          },
                          pageVariants: {
                            useCountryVariants: true,
                            useTopicPages: true,
                            useCustomSearch: false
                          }
                        });
                      }}
                    >
                      Reset to Defaults
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      
      {/* Footer */}
      <div className="glass-hierarchy-child rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Wiki data last updated: {IxTime.formatIxTime(wikiData.lastUpdated, true)} • 
            Confidence: {wikiData.confidence}%
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              MediaWiki API
            </Badge>
            <Badge variant="outline" className="text-xs">
              {wikiData.sections.length} sections
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WikiIntelligenceTab;