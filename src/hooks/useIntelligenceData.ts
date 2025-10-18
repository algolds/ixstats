// useIntelligenceData hook - Data management for intelligence briefing
// Refactored from EnhancedIntelligenceBriefing.tsx

import { useMemo, useState, useEffect, useCallback } from "react";
import { IxnayWikiService } from "~/lib/mediawiki-service";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { getStatusFromValue } from "~/components/countries/intelligence/utils";
import { TIER_SCORE_MAP } from "~/components/countries/intelligence/constants";
import type {
  VitalityMetric,
  CountryMetric,
  CountryInformation,
  WikiIntelligenceData,
  CountryData,
  ClearanceLevel
} from "~/components/countries/intelligence/types";
import {
  RiMoneyDollarCircleLine,
  RiTeamLine,
  RiRidingLine,
  RiBarChartLine,
  RiLineChartLine,
  RiSettings3Line,
  RiMapLine,
  RiGlobalLine,
  RiBuildingLine,
  RiTvLine,
} from "react-icons/ri";

export interface UseIntelligenceDataProps {
  country: CountryData;
  viewerClearanceLevel: ClearanceLevel;
  flagColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  propWikiData?: WikiIntelligenceData;
}

export interface UseIntelligenceDataReturn {
  vitalityMetrics: VitalityMetric[];
  countryMetrics: CountryMetric[];
  countryInformation: CountryInformation[];
  wikiData?: WikiIntelligenceData;
  isLoadingWiki: boolean;
  saveWikiOverview: (content: string) => void;
}

export function useIntelligenceData({
  country,
  viewerClearanceLevel,
  flagColors = { primary: '#3b82f6', secondary: '#6366f1', accent: '#8b5cf6' },
  propWikiData
}: UseIntelligenceDataProps): UseIntelligenceDataReturn {
  // Local wiki data state
  const [localWikiData, setLocalWikiData] = useState<WikiIntelligenceData | undefined>(undefined);
  const [isLoadingWiki, setIsLoadingWiki] = useState(false);

  // Use provided wikiData or fetch our own
  const wikiData = propWikiData || localWikiData;

  // Fetch wiki data if not provided
  useEffect(() => {
    if (propWikiData || isLoadingWiki || localWikiData) return;

    const fetchWikiData = async () => {
      setIsLoadingWiki(true);
      try {
        const wikiService = new IxnayWikiService();
        const [mainPageWikitext, infobox] = await Promise.all([
          wikiService.getPageWikitext(country.name),
          wikiService.getCountryInfobox(country.name)
        ]);

        if (typeof mainPageWikitext === 'string' && mainPageWikitext.length > 100) {
          // Clean and parse content
          let cleanContent = mainPageWikitext;

          // Remove infobox using proper brace counting
          let braceDepth = 0;
          let infoboxStart = -1;
          let infoboxEnd = -1;

          const infoboxMatch = cleanContent.match(/\{\{\s*Infobox\s+/i);
          if (infoboxMatch) {
            infoboxStart = infoboxMatch.index!;
            let i = infoboxStart;

            while (i < cleanContent.length - 1) {
              const char = cleanContent[i];
              const nextChar = cleanContent[i + 1];

              if (char === '{' && nextChar === '{') {
                braceDepth++;
                i += 2;
              } else if (char === '}' && nextChar === '}') {
                braceDepth--;
                if (braceDepth === 0) {
                  infoboxEnd = i + 2;
                  break;
                }
                i += 2;
              } else {
                i++;
              }
            }

            if (infoboxEnd > infoboxStart) {
              cleanContent = cleanContent.substring(0, infoboxStart) + cleanContent.substring(infoboxEnd);
            }
          }

          // Remove templates and markup
          cleanContent = cleanContent
            .replace(/\{\{[^\{\}]*(?:\{[^\{\}]*\}[^\{\}]*)*\}\}/g, '')
            .replace(/\[\[Category:[^\]]*\]\]/gi, '')
            .replace(/\[\[File:[^\]]*\]\]/gi, '')
            .replace(/<ref[^>]*>.*?<\/ref>/gi, '')
            .replace(/<!--.*?-->/g, '')
            .replace(/\{\|[\s\S]*?\|\}/g, '')
            .trim();

          // Extract paragraphs
          const allParagraphs = cleanContent
            .split(/\n\n+/)
            .filter(p => p.trim().length > 50)
            .slice(0, 5);

          const paragraphs = allParagraphs.join('\n\n||PARAGRAPH_BREAK||');

          setLocalWikiData({
            countryName: country.name,
            infobox: infobox?.parsedTemplateData,
            sections: [{
              id: 'overview',
              title: 'Overview',
              content: paragraphs,
              classification: 'PUBLIC',
              importance: 'critical'
            }],
            lastUpdated: Date.now(),
            confidence: 75
          });
        }
      } catch (error) {
        console.error('[useIntelligenceData] Failed to fetch wiki data:', error);
      } finally {
        setIsLoadingWiki(false);
      }
    };

    fetchWikiData();
  }, [country.name, propWikiData, isLoadingWiki, localWikiData]);

  // Calculate vitality metrics
  const vitalityMetrics = useMemo<VitalityMetric[]>(() => {
    const economicHealth = Math.min(100, (country.currentGdpPerCapita / 50000) * 100);
    const populationGrowth = Math.min(100, Math.max(0, (country.populationGrowthRate * 100 + 2) * 25));
    const developmentIndex = TIER_SCORE_MAP[country.economicTier] || 10;

    return [
      {
        id: 'economic',
        label: 'Economic Health',
        value: economicHealth,
        color: flagColors.primary,
        icon: RiMoneyDollarCircleLine,
        trend: country.adjustedGdpGrowth > 0.02 ? 'up' : country.adjustedGdpGrowth < -0.01 ? 'down' : 'stable',
        status: getStatusFromValue(economicHealth),
        classification: 'PUBLIC'
      },
      {
        id: 'population',
        label: 'Population Vitality',
        value: populationGrowth,
        color: flagColors.secondary,
        icon: RiTeamLine,
        trend: country.populationGrowthRate > 0.01 ? 'up' : country.populationGrowthRate < 0 ? 'down' : 'stable',
        status: getStatusFromValue(populationGrowth),
        classification: 'PUBLIC'
      },
      {
        id: 'development',
        label: 'Development Index',
        value: developmentIndex,
        color: flagColors.accent,
        icon: RiRidingLine,
        trend: 'stable',
        status: getStatusFromValue(developmentIndex),
        classification: viewerClearanceLevel !== 'PUBLIC' ? 'RESTRICTED' : 'PUBLIC'
      }
    ];
  }, [country, flagColors, viewerClearanceLevel]);

  // Calculate country metrics
  const countryMetrics = useMemo<CountryMetric[]>(() => {
    const laborForce = Math.round(country.currentPopulation * 0.65);
    const unemploymentRate = Math.max(2, Math.min(15, 8 - (country.adjustedGdpGrowth * 100)));
    const literacyRate = Math.min(99, 70 + (country.currentGdpPerCapita / 1000));
    const lifeExpectancy = Math.min(85, 65 + (country.currentGdpPerCapita / 2000));

    return [
      // Economy
      {
        id: 'total_gdp',
        label: 'Total GDP',
        value: formatCurrency(country.currentTotalGdp),
        icon: RiBarChartLine,
        trend: {
          direction: country.adjustedGdpGrowth > 0 ? 'up' : 'down',
          value: Math.abs(country.adjustedGdpGrowth * 100),
          period: 'annual'
        },
        classification: 'PUBLIC',
        importance: 'critical'
      },
      {
        id: 'gdp_per_capita',
        label: 'GDP per Capita',
        value: formatCurrency(country.currentGdpPerCapita),
        icon: RiMoneyDollarCircleLine,
        trend: {
          direction: country.adjustedGdpGrowth > 0.01 ? 'up' : country.adjustedGdpGrowth < -0.01 ? 'down' : 'stable',
          value: Math.abs(country.adjustedGdpGrowth * 100),
          period: 'annual'
        },
        classification: 'PUBLIC',
        importance: 'critical'
      },
      {
        id: 'economic_tier',
        label: 'Economic Classification',
        value: country.economicTier,
        icon: RiLineChartLine,
        classification: 'PUBLIC',
        importance: 'high'
      },
      // Demographics
      {
        id: 'population',
        label: 'Total Population',
        value: formatPopulation(country.currentPopulation),
        icon: RiTeamLine,
        trend: {
          direction: country.populationGrowthRate > 0 ? 'up' : 'down',
          value: Math.abs(country.populationGrowthRate * 100),
          period: 'annual'
        },
        classification: 'PUBLIC',
        importance: 'high'
      },
      {
        id: 'population_tier',
        label: 'Population Classification',
        value: `Tier ${country.populationTier}`,
        icon: RiTeamLine,
        classification: 'PUBLIC',
        importance: 'medium'
      },
      {
        id: 'life_expectancy',
        label: 'Life Expectancy',
        value: lifeExpectancy.toFixed(1),
        unit: 'years',
        icon: RiRidingLine,
        classification: 'PUBLIC',
        importance: 'medium'
      },
      {
        id: 'literacy_rate',
        label: 'Literacy Rate',
        value: literacyRate.toFixed(1),
        unit: '%',
        icon: RiTvLine,
        classification: 'PUBLIC',
        importance: 'medium'
      },
      // Labor
      {
        id: 'labor_force',
        label: 'Labor Force',
        value: formatPopulation(laborForce),
        icon: RiBuildingLine,
        classification: 'PUBLIC',
        importance: 'high'
      },
      {
        id: 'unemployment_rate',
        label: 'Unemployment Rate',
        value: unemploymentRate.toFixed(1),
        unit: '%',
        icon: RiSettings3Line,
        trend: {
          direction: country.adjustedGdpGrowth > 0 ? 'down' : 'up',
          value: Math.abs(country.adjustedGdpGrowth * 50),
          period: 'annual'
        },
        classification: 'PUBLIC',
        importance: 'high'
      },
      // Government
      {
        id: 'government_type',
        label: 'Government System',
        value: country.governmentType || 'Constitutional',
        icon: RiBuildingLine,
        classification: 'PUBLIC',
        importance: 'medium'
      },
      {
        id: 'capital_city',
        label: 'Capital',
        value: country.capital || 'Unknown',
        icon: RiMapLine,
        classification: 'PUBLIC',
        importance: 'low'
      },
      // Geography
      ...(country.populationDensity ? [{
        id: 'density',
        label: 'Population Density',
        value: country.populationDensity.toFixed(1),
        unit: '/km²',
        icon: RiMapLine,
        classification: 'PUBLIC' as const,
        importance: 'medium' as const
      }] : []),
      ...(country.landArea ? [{
        id: 'land_area',
        label: 'Land Area',
        value: country.landArea.toLocaleString(),
        unit: 'km²',
        icon: RiGlobalLine,
        classification: 'PUBLIC' as const,
        importance: 'medium' as const
      }] : []),
      {
        id: 'continent',
        label: 'Continent',
        value: country.continent || 'Unknown',
        icon: RiGlobalLine,
        classification: 'PUBLIC',
        importance: 'low'
      },
      {
        id: 'region',
        label: 'Region',
        value: country.region || 'Unknown',
        icon: RiMapLine,
        classification: 'PUBLIC',
        importance: 'low'
      }
    ];
  }, [country]);

  // Organize country information
  const countryInformation = useMemo<CountryInformation[]>(() => {
    const info: CountryInformation[] = [];

    if (country.continent || country.region) {
      info.push({
        id: 'geographic',
        category: 'Geographic Intelligence',
        icon: RiMapLine,
        items: [
          ...(country.continent ? [{ label: 'Continent', value: country.continent, classification: 'PUBLIC' as const }] : []),
          ...(country.region ? [{ label: 'Region', value: country.region, classification: 'PUBLIC' as const }] : []),
          ...(country.capital ? [{ label: 'Capital', value: country.capital, classification: 'PUBLIC' as const }] : [])
        ]
      });
    }

    if (country.governmentType || country.leader) {
      info.push({
        id: 'government',
        category: 'Government Intelligence',
        icon: RiBuildingLine,
        items: [
          ...(country.governmentType ? [{ label: 'System', value: country.governmentType, classification: 'PUBLIC' as const }] : []),
          ...(country.leader ? [{ label: 'Leader', value: country.leader, classification: 'PUBLIC' as const }] : [])
        ]
      });
    }

    if (country.religion) {
      info.push({
        id: 'cultural',
        category: 'Cultural Intelligence',
        icon: RiGlobalLine,
        items: [
          { label: 'Primary Religion', value: country.religion, classification: 'PUBLIC' }
        ]
      });
    }

    info.push({
      id: 'classification',
      category: 'Economic Classification',
      icon: RiBarChartLine,
      items: [
        { label: 'Economic Tier', value: country.economicTier, classification: 'PUBLIC' },
        { label: 'Population Tier', value: `Tier ${country.populationTier}`, classification: 'PUBLIC' }
      ]
    });

    return info;
  }, [country]);

  // Save wiki overview
  const saveWikiOverview = useCallback((content: string) => {
    setLocalWikiData({
      countryName: country.name,
      infobox: undefined,
      sections: [{
        id: 'overview',
        title: 'Overview',
        content: content.trim(),
        classification: 'PUBLIC',
        importance: 'critical'
      }],
      lastUpdated: Date.now(),
      confidence: 100
    });
  }, [country.name]);

  return {
    vitalityMetrics,
    countryMetrics,
    countryInformation,
    wikiData,
    isLoadingWiki,
    saveWikiOverview
  };
}
