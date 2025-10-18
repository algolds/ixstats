"use client";

import React, { useMemo, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { HealthRing } from "~/components/ui/health-ring";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  AreaChart,
  Area,
  ComposedChart,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
} from "recharts";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { IxTime } from "~/lib/ixtime";
import { IxnayWikiService } from "~/lib/mediawiki-service";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { AnimatedFlagBackground } from "~/components/ui/animated-flag-background";
import { unsplashService, type UnsplashImageData } from "~/lib/unsplash-service";
import {
  // Intelligence Icons
  RiBarChartLine,
  RiEyeLine,
  RiGlobalLine,
  RiSettings3Line,
  RiArrowUpLine,
  RiArrowDownLine,
  RiSubtractLine,
  // Metric Icons
  RiMoneyDollarCircleLine,
  RiTeamLine,
  RiRidingLine,
  RiLineChartLine,
  RiMapLine,
  RiBuildingLine,
  RiTvLine,
  RiFlagLine,
  // Additional Icons for Enhanced Intelligence
  RiArrowUpCircleLine,
  RiMapPinLine,
  RiBarChart2Line,
  RiUserLine,
  RiGroup2Line,
  // Status Icons
  RiCheckboxCircleLine,
  RiAlertLine,
  RiInformationLine,
  // Wiki Intelligence Icons
  RiExternalLinkLine,
  RiImageLine,
  RiFileLine,
  RiEditLine
} from "react-icons/ri";
import { sanitizeWikiContent } from "~/lib/sanitize-html";

// Types for enhanced briefing
interface VitalityMetric {
  id: string;
  label: string;
  value: number;
  color: string;
  icon: React.ElementType;
  trend: 'up' | 'down' | 'stable';
  status: 'excellent' | 'good' | 'fair' | 'poor';
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
}

interface CountryMetric {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ElementType;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    value: number;
    period: string;
  };
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  importance: 'critical' | 'high' | 'medium' | 'low';
}

interface IntelligenceAlert {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  timestamp: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface CountryInformation {
  id: string;
  category: string;
  items: {
    label: string;
    value: string;
    classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  }[];
  icon: React.ElementType;
}

// Wiki Intelligence Data interfaces
interface WikiSection {
  id: string;
  title: string;
  content: string;
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  importance: 'critical' | 'high' | 'medium' | 'low';
  images?: string[];
}

interface WikiIntelligenceData {
  countryName: string;
  sections: WikiSection[];
  lastUpdated: number;
  confidence: number;
  infobox?: {
    image_flag?: string;
    flag?: string;
    image_coat?: string;
    coat_of_arms?: string;
    [key: string]: any;
  };
}

interface EnhancedIntelligenceBriefingProps {
  // Country data
  country: {
    id: string;
    name: string;
    continent?: string;
    region?: string;
    governmentType?: string;
    leader?: string;
    religion?: string;
    capital?: string;
    currentPopulation: number;
    currentGdpPerCapita: number;
    currentTotalGdp: number;
    economicTier: string;
    populationTier: string;
    populationGrowthRate: number;
    adjustedGdpGrowth: number;
    populationDensity?: number;
    landArea?: number;
    lastCalculated: number;
    baselineDate: number;
  };
  
  // Intelligence data
  intelligenceAlerts?: IntelligenceAlert[];
  wikiData?: WikiIntelligenceData;
  currentIxTime: number;
  
  // Security context
  viewerClearanceLevel: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  isOwnCountry?: boolean;
  
  // Styling
  flagColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

// Classification styling
const CLASSIFICATION_STYLES = {
  'PUBLIC': {
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    label: 'PUBLIC'
  },
  'RESTRICTED': {
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    label: 'RESTRICTED'
  },
  'CONFIDENTIAL': {
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    label: 'CONFIDENTIAL'
  }
} as const;

// Status styling
const STATUS_STYLES = {
  'excellent': { color: 'text-green-400', bg: 'bg-green-500/20' },
  'good': { color: 'text-blue-400', bg: 'bg-blue-500/20' },
  'fair': { color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  'poor': { color: 'text-red-400', bg: 'bg-red-500/20' }
} as const;

// Importance styling
const IMPORTANCE_STYLES = {
  'critical': { priority: 4, glow: 'shadow-red-500/20' },
  'high': { priority: 3, glow: 'shadow-orange-500/20' },
  'medium': { priority: 2, glow: 'shadow-blue-500/20' },
  'low': { priority: 1, glow: 'shadow-gray-500/20' }
} as const;

// Helper functions
const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
  switch (trend) {
    case 'up': return RiArrowUpLine;
    case 'down': return RiArrowDownLine;
    default: return RiSubtractLine;
  }
};

const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
  switch (trend) {
    case 'up': return 'text-green-400';
    case 'down': return 'text-red-400';
    default: return 'text-gray-400';
  }
};

const getStatusFromValue = (value: number): 'excellent' | 'good' | 'fair' | 'poor' => {
  if (value >= 80) return 'excellent';
  if (value >= 60) return 'good';
  if (value >= 40) return 'fair';
  return 'poor';
};

export const EnhancedIntelligenceBriefing: React.FC<EnhancedIntelligenceBriefingProps> = ({
  country,
  intelligenceAlerts = [],
  wikiData: propWikiData,
  currentIxTime,
  viewerClearanceLevel = 'PUBLIC',
  isOwnCountry = false,
  flagColors = { primary: '#3b82f6', secondary: '#6366f1', accent: '#8b5cf6' }
}) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'vitality' | 'metrics' | 'information'>('overview');
  const [showClassified, setShowClassified] = useState(false);
  const [expandedMetrics, setExpandedMetrics] = useState<Set<string>>(new Set());

  // Local wiki data state - fetch our own if not provided
  const [localWikiData, setLocalWikiData] = useState<WikiIntelligenceData | undefined>(undefined);
  const [isLoadingWiki, setIsLoadingWiki] = useState(false);
  const [showFullOverview, setShowFullOverview] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  
  // Unsplash background images state
  const [cardBackgroundImages, setCardBackgroundImages] = useState<{[key: string]: UnsplashImageData}>({});
  const [isLoadingBackgrounds, setIsLoadingBackgrounds] = useState(false);
  const [unsplashEnabled, setUnsplashEnabled] = useState(true);
  
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
          // Extract first 3 paragraphs (same logic as WikiIntelligenceTab)
          let cleanContent = mainPageWikitext;
          
          // Remove infobox completely using proper brace counting
          let braceDepth = 0;
          let infoboxStart = -1;
          let infoboxEnd = -1;
          
          // Find infobox start
          const infoboxMatch = cleanContent.match(/\{\{\s*Infobox\s+/i);
          if (infoboxMatch) {
            infoboxStart = infoboxMatch.index!;
            let i = infoboxStart;
            
            // Count braces to find the end
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
            
            // Remove the infobox
            if (infoboxEnd > infoboxStart) {
              cleanContent = cleanContent.substring(0, infoboxStart) + cleanContent.substring(infoboxEnd);
            }
          }
          
          // Remove templates but preserve wiki markup for bold/italics
          cleanContent = cleanContent
            .replace(/\{\{[^\{\}]*(?:\{[^\{\}]*\}[^\{\}]*)*\}\}/g, '')
            .replace(/\[\[Category:[^\]]*\]\]/gi, '')
            .replace(/\[\[File:[^\]]*\]\]/gi, '')
            .replace(/<ref[^>]*>.*?<\/ref>/gi, '')
            .replace(/<!--.*?-->/g, '')
            // Remove any remaining table markup
            .replace(/\{\|[\s\S]*?\|\}/g, '')
            .trim();

          // Split into paragraphs and store all paragraphs
          const allParagraphs = cleanContent
            .split(/\n\n+/)
            .filter(p => p.trim().length > 50)
            .slice(0, 5); // Get up to 5 paragraphs
            
          // Join all paragraphs but mark where to split for "show more"
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
        console.error('[EnhancedIntelligenceBriefing] Failed to fetch wiki data:', error);
      } finally {
        setIsLoadingWiki(false);
      }
    };

    fetchWikiData();
  }, [country.name, propWikiData, isLoadingWiki, localWikiData]);

  // Load Unsplash background images for individual cards
  useEffect(() => {
    const loadCardBackgroundImages = async () => {
      if (!unsplashEnabled || isLoadingBackgrounds || Object.keys(cardBackgroundImages).length > 0) return;
      
      setIsLoadingBackgrounds(true);
      
      try {
        // Generate tier-specific search queries for different card types
        const tierKeywords = {
          'Extravagant': 'luxury modern',
          'Very Strong': 'developed advanced',
          'Strong': 'growing urban',
          'Healthy': 'city community',
          'Developed': 'developing growth',
          'Developing': 'emerging progress',
          'Impoverished': 'rural basic'
        };

        const baseTierKeyword = tierKeywords[country.economicTier as keyof typeof tierKeywords] || 'business';
        
        // Define different search queries for different card types with more variety
        const cardQueries = {
          'economic-analysis': `${baseTierKeyword} economics finance charts graphs dashboard`,
          'demographics-analysis': `${baseTierKeyword} population people urban society demographics`,
          'development-analysis': `${baseTierKeyword} infrastructure construction development urban planning`,
          'executive-summary': `${baseTierKeyword} government leadership headquarters executive`,
          'economic-power': `${baseTierKeyword} financial markets money banking currency`,
          'demographics': `${baseTierKeyword} community people social population statistics`,
          'strategic-assessment': `${baseTierKeyword} military strategy defense intelligence analysis`,
          'labor-force': `${baseTierKeyword} workers employment labor industry workforce`,
          'geography': `${baseTierKeyword} landscape geography terrain natural environment`
        };
        
        const loadedImages: {[key: string]: UnsplashImageData} = {};
        
        // Load images for each card type with fallback handling
        const cardKeys = Object.keys(cardQueries);
        for (let i = 0; i < cardKeys.length; i++) {
          const cardKey = cardKeys[i];
          const query = cardQueries[cardKey as keyof typeof cardQueries];
          
          try {
            // Add delay between requests to avoid rate limiting
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 800));
            }
            
            const images = await unsplashService.searchImages({
              query,
              orientation: 'landscape',
              size: 'regular',
              per_page: 3, // Get 3 images to have variety
              page: Math.floor(i / 3) + 1 // Different pages for different cards
            });
            
            if (images.length > 0) {
              // Select different images from the results to ensure variety
              const imageIndex = i % images.length;
              const selectedImage = images[imageIndex];
              loadedImages[cardKey] = selectedImage;
              
              // Track download as required by Unsplash API
              if (selectedImage.downloadUrl) {
                try {
                  await unsplashService.trackDownload(selectedImage.downloadUrl);
                } catch (trackError) {
                  console.warn(`Failed to track download for ${cardKey}:`, trackError);
                }
              }
            }
          } catch (error) {
            console.warn(`Failed to load image for ${cardKey}:`, error);
            // Continue loading other images even if one fails
          }
        }
        
        setCardBackgroundImages(loadedImages);
      } catch (error) {
        console.error('[EnhancedIntelligenceBriefing] Failed to load background images:', error);
        // Disable Unsplash if there's a 403 or other API error
        if (error instanceof Error && error.message.includes('403')) {
          console.warn('Unsplash API access denied - disabling background images');
          setUnsplashEnabled(false);
        }
      } finally {
        setIsLoadingBackgrounds(false);
      }
    };
    
    loadCardBackgroundImages();
  }, [country.economicTier, country.name, isLoadingBackgrounds, cardBackgroundImages, unsplashEnabled]);

  // Wiki content parsing functions
  const handleWikiLinkClick = useCallback((link: string) => {
    if (link.startsWith('http')) {
      window.open(link, '_blank');
    } else {
      window.open(`https://ixwiki.com/wiki/${encodeURIComponent(link)}`, '_blank');
    }
  }, []);

  const parseWikiContent = useCallback((content: string, linkHandler: (link: string) => void) => {
    if (!content) return null;
    
    // Replace wiki links [[Link|Display]] or [[Link]]
    let parsed = content.replace(/\[\[([^|\]]+)(\|([^\]]+))?\]\]/g, (match, link, pipe, display) => {
      const displayText = display || link;
      const onClick = () => linkHandler(link);
      return `<span class="text-blue-400 hover:text-blue-300 cursor-pointer underline" data-link="${link}">${displayText}</span>`;
    });
    
    // Replace external links [http://example.com Display]
    parsed = parsed.replace(/\[([^\s]+)\s+([^\]]+)\]/g, (match, url, display) => {
      return `<a href="${url}" target="_blank" class="text-blue-400 hover:text-blue-300 underline">${display}</a>`;
    });
    
    // Parse wiki markup for bold and italics
    parsed = parsed.replace(/'''([^']+)'''/g, '<strong class="font-bold">$1</strong>'); // Bold
    parsed = parsed.replace(/''([^']+)''/g, '<em class="italic">$1</em>'); // Italics
    
    // Add basic line breaks
    parsed = parsed.replace(/\n\n/g, '<br/><br/>');
    parsed = parsed.replace(/\n/g, ' ');

    // SECURITY: Sanitize parsed wiki markup to prevent XSS
    const sanitized = sanitizeWikiContent(parsed);

    return (
      <div
        dangerouslySetInnerHTML={{ __html: sanitized }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const link = target.getAttribute('data-link');
          if (link) {
            e.preventDefault();
            linkHandler(link);
          }
        }}
      />
    );
  }, []);

  // Calculate vitality metrics
  const vitalityMetrics: VitalityMetric[] = useMemo(() => {
    const economicHealth = Math.min(100, (country.currentGdpPerCapita / 50000) * 100);
    const populationGrowth = Math.min(100, Math.max(0, (country.populationGrowthRate * 100 + 2) * 25));
    const developmentIndex = (() => {
      const tierScores: Record<string, number> = {
        "Extravagant": 100, "Very Strong": 85, "Strong": 70,
        "Healthy": 55, "Developed": 40, "Developing": 25
      };
      return tierScores[country.economicTier] || 10;
    })();

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
  const countryMetrics: CountryMetric[] = useMemo(() => {
    // Calculate derived metrics
    const laborForce = Math.round(country.currentPopulation * 0.65); // Approximate labor force participation
    const unemploymentRate = Math.max(2, Math.min(15, 8 - (country.adjustedGdpGrowth * 100))); // Inverse correlation with growth
    const literacyRate = Math.min(99, 70 + (country.currentGdpPerCapita / 1000)); // Economic correlation
    const lifeExpectancy = Math.min(85, 65 + (country.currentGdpPerCapita / 2000)); // Economic correlation
    
    return [
      // Economy Section
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
      
      // Demographics Section
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
      
      // Labor Section
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
          direction: country.adjustedGdpGrowth > 0 ? 'down' : 'up', // Unemployment inverse to growth
          value: Math.abs(country.adjustedGdpGrowth * 50),
          period: 'annual'
        },
        classification: 'PUBLIC',
        importance: 'high'
      },
      
      // Government Section
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
      
      // Geographic Section
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
  const countryInformation: CountryInformation[] = useMemo(() => {
    const info: CountryInformation[] = [];

    // Geographic information
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

    // Government information
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

    // Cultural information
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

    // Classification information
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

  // Filter content based on clearance level
  const hasAccess = (classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL') => {
    const levels = { 'PUBLIC': 1, 'RESTRICTED': 2, 'CONFIDENTIAL': 3 };
    return levels[viewerClearanceLevel] >= levels[classification];
  };

  return (
    <div className="space-y-6">
      {/* Intelligence Header with Country Flag Background */}
      <div className="glass-hierarchy-child rounded-lg relative overflow-hidden">
        {/* Country Flag Background - Add flag URL prop and implement background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          {/* Flag will be added as background when flag data is available */}
          <div className="w-full h-full bg-gradient-to-r from-background/80 via-background/60 to-background/80"></div>
        </div>
        
        <div className="relative p-6">
          <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
                        <UnifiedCountryFlag countryName={country.name} size="xl" />
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">{country.name}</h2>
                <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10">
                  <RiCheckboxCircleLine className="h-3 w-3 mr-1" />
                  STABLE
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Country Intelligence Briefing • {IxTime.formatIxTime(currentIxTime, true)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge 
              variant="outline" 
              className={cn(
                "border-2",
                CLASSIFICATION_STYLES[viewerClearanceLevel].color,
                CLASSIFICATION_STYLES[viewerClearanceLevel].border
              )}
            >
              {CLASSIFICATION_STYLES[viewerClearanceLevel].label}
            </Badge>
            {viewerClearanceLevel !== 'PUBLIC' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClassified(!showClassified)}
                className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
              >
                <RiEyeLine className="h-4 w-4 mr-2" />
                {showClassified ? 'Hide' : 'Show'} Classified
              </Button>
            )}
          </div>
        </div>

        {/* Section Navigation */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: 'overview', label: 'Overview', icon: RiInformationLine },
            { id: 'metrics', label: 'Key Metrics', icon: RiBarChartLine },
            { id: 'information', label: 'Briefing', icon: RiTvLine }
          ].map((section) => {
            const SectionIcon = section.icon;
            return (
              <Button
                key={section.id}
                variant={activeSection === section.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveSection(section.id as any)}
                className="flex items-center gap-2"
              >
                <SectionIcon className="h-4 w-4" />
                {section.label}
              </Button>
            );
          })}
        </div>
        </div>
      </div>

      {/* Section Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeSection === 'overview' && (
            <div className="space-y-6">
              {/* Intelligence Alerts */}
              {intelligenceAlerts.length > 0 && (
                <Card className="glass-hierarchy-child">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RiAlertLine className="h-5 w-5 text-orange-400" />
                      Active Intelligence Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {intelligenceAlerts
                        .filter(alert => hasAccess(alert.classification))
                        .map((alert) => (
                        <div
                          key={alert.id}
                          className={cn(
                            "p-4 rounded-lg border-l-4",
                            alert.type === 'critical' && "border-red-500 bg-red-500/10",
                            alert.type === 'warning' && "border-yellow-500 bg-yellow-500/10",
                            alert.type === 'info' && "border-blue-500 bg-blue-500/10",
                            alert.type === 'success' && "border-green-500 bg-green-500/10"
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium">{alert.title}</h4>
                              <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-xs",
                                    CLASSIFICATION_STYLES[alert.classification].color
                                  )}
                                >
                                  {alert.classification}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {IxTime.formatIxTime(alert.timestamp, true)}
                                </span>
                              </div>
                            </div>
                            {alert.action && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={alert.action.onClick}
                                className="ml-4"
                              >
                                {alert.action.label}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Country Status Summary */}
              <Card className="glass-hierarchy-child relative overflow-hidden">
                {/* Flag Background */}
                <div className="absolute inset-0 opacity-[0.05] pointer-events-none">
                  {wikiData?.infobox?.image_flag || wikiData?.infobox?.flag ? (
                    <img
                      src={`https://ixwiki.com/wiki/Special:Filepath/${wikiData.infobox.image_flag || wikiData.infobox.flag}`}
                      alt="Flag background"
                      className="w-full h-full object-cover object-center blur-sm"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <UnifiedCountryFlag countryName={country.name} size="xl" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-background/75 via-background/50 to-background/75"></div>
                </div>
                
                <CardHeader>
                 
                </CardHeader>
                <CardContent>
                  <div className="space-y-6 relative">
                    {/* Strategic Intelligence Briefing - Overview directly in main container */}
                    
                    {/* Coat of Arms - Prominent display */}
                    {(wikiData?.infobox?.image_coat || wikiData?.infobox?.coat_of_arms) && (
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1"></div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <div className="group cursor-pointer">
                              <div className="relative p-3 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-lg border border-amber-400/30 group-hover:border-amber-400/50 transition-all duration-300 backdrop-blur-sm">
                                <img
                                  src={`https://ixwiki.com/wiki/Special:Filepath/${wikiData.infobox.image_coat || wikiData.infobox.coat_of_arms}`}
                                  alt="Coat of Arms"
                                  className="w-16 h-16 rounded object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-pulse"></div>
                              </div>
                              <div className="text-center mt-2">
                                <div className="text-xs font-medium text-amber-400">Coat of Arms</div>
                              </div>
                            </div>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Coat of Arms - {country.name}</DialogTitle>
                            </DialogHeader>
                            <div className="flex justify-center p-4">
                              <img
                                src={`https://ixwiki.com/wiki/Special:Filepath/${wikiData.infobox.image_coat || wikiData.infobox.coat_of_arms}`}
                                alt="Coat of Arms"
                                className="max-w-full max-h-96 object-contain rounded-lg"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            </div>
                            <div className="text-center text-sm text-muted-foreground">
                              Official coat of arms of {country.name}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    )}

                    {/* Overview Text - Wiki data or IxStats fallback */}
                    {(() => {
                      const overviewSection = wikiData?.sections?.find(section => section.id === 'overview');
                      
                      // Fallback content using IxStats data when no wiki data
                      if (!overviewSection) {
                        const fallbackContent = `${country.name} is a ${country.governmentType || 'sovereign'} nation located in ${country.continent || 'an undisclosed region'}. With a population of ${country.currentPopulation.toLocaleString()} citizens and a GDP per capita of $${country.currentGdpPerCapita.toLocaleString()}, the country operates as a ${country.economicTier.toLowerCase()}-tier economy. ${country.leader ? `The current leader is ${country.leader}.` : ''} ${country.capital ? `The capital city is ${country.capital}.` : ''}`;
                        
                        return (
                          <div className="space-y-4">
                            <div className="text-sm leading-relaxed prose prose-sm prose-invert max-w-none">
                              <div className="text-muted-foreground">{fallbackContent}</div>
                            </div>
                            
                            {/* Echo Editor Interface */}
                            <div className="flex gap-2 pt-3 border-t border-border/30">
                              <Dialog open={showEditor} onOpenChange={setShowEditor}>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="flex-1">
                                    <RiEditLine className="h-3 w-3 mr-1" />
                                    Create Overview
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Create Country Overview - {country.name}</DialogTitle>
                                  </DialogHeader>
                                  
                                  <div className="space-y-4">
                                    <div>
                                      <p className="text-sm text-muted-foreground mb-4">
                                        Write a comprehensive overview of {country.name}. This will be displayed as the main description on the intelligence briefing.
                                      </p>
                                      
                                      <Textarea
                                        value={editorContent}
                                        onChange={(e) => setEditorContent(e.target.value)}
                                        placeholder={`${country.name} is located in ${country.continent || 'the region'}. With a population of ${country.currentPopulation.toLocaleString()} and a ${country.economicTier.toLowerCase()}-tier economy, the nation...`}
                                        className="min-h-[300px] font-mono text-sm"
                                        style={{ fontFamily: 'ui-monospace, "Cascadia Code", "Roboto Mono", monospace' }}
                                      />
                                      
                                      <div className="text-xs text-muted-foreground mt-2">
                                        {editorContent.length} characters • Supports wiki markup ('''bold''', ''italic'', [[links]])
                                      </div>
                                    </div>
                                    
                                    <div className="flex justify-end gap-2">
                                      <Button variant="outline" onClick={() => setShowEditor(false)}>
                                        Cancel
                                      </Button>
                                      <Button 
                                        onClick={() => {
                                          // Save the content as local wiki data
                                          if (editorContent.trim()) {
                                            setLocalWikiData({
                                              countryName: country.name,
                                              infobox: undefined,
                                              sections: [{
                                                id: 'overview',
                                                title: 'Overview',
                                                content: editorContent.trim(),
                                                classification: 'PUBLIC',
                                                importance: 'critical'
                                              }],
                                              lastUpdated: Date.now(),
                                              confidence: 100
                                            });
                                            setShowEditor(false);
                                            setEditorContent('');
                                          }
                                        }}
                                        disabled={!editorContent.trim()}
                                      >
                                        Save Overview
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        );
                      }

                      // Wiki content exists - show it
                      const paragraphs = overviewSection.content.split('||PARAGRAPH_BREAK||');
                      const firstParagraph = paragraphs[0] || '';
                      const remainingParagraphs = paragraphs.slice(1);
                      const hasMoreContent = remainingParagraphs.length > 0 && remainingParagraphs.some(p => p.trim());

                      return (
                        <div className="space-y-4">
                          <div className="text-sm leading-relaxed prose prose-sm prose-invert max-w-none">
                            {parseWikiContent(firstParagraph, handleWikiLinkClick)}
                            
                            {showFullOverview && hasMoreContent && (
                              <div className="mt-4 space-y-3">
                                {remainingParagraphs.filter(p => p.trim()).map((paragraph, index) => (
                                  <div key={index}>
                                    {parseWikiContent(paragraph, handleWikiLinkClick)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          {hasMoreContent && (
                            <div className="flex justify-center pt-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowFullOverview(!showFullOverview)}
                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                              >
                                {showFullOverview ? (
                                  <>
                                    <RiArrowUpLine className="h-4 w-4 mr-1" />
                                    Show Less
                                  </>
                                ) : (
                                  <>
                                    <RiArrowDownLine className="h-4 w-4 mr-1" />
                                    Show More
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                          
                          {/* Full Article Access */}
                          <div className="flex gap-2 pt-3 border-t border-border/30">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                window.open(`https://ixwiki.com/wiki/${encodeURIComponent(country.name)}`, '_blank');
                              }}
                              className="flex-1"
                            >
                              <RiExternalLinkLine className="h-3 w-3 mr-1" />
                              View Full Article
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                    
                  </div>
                </CardContent>
              </Card>
            </div>
          )}


          {activeSection === 'metrics' && (
            <div className="space-y-6">
              {/* Comprehensive Economic Intelligence Analysis */}
              <Card className="glass-hierarchy-child relative overflow-hidden">
                {/* Card Background Image */}
                {cardBackgroundImages['economic-analysis'] && (
                  <div className="absolute inset-0 z-0">
                    <img
                      src={cardBackgroundImages['economic-analysis'].url}
                      alt={cardBackgroundImages['economic-analysis'].description || 'Economic analysis background'}
                      className="w-full h-full object-cover object-center blur-sm"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 bg-background/70"></div>
                  </div>
                )}
                <CardHeader className="relative z-10">
                  <CardTitle className="flex items-center gap-2">
                    <RiBarChartLine className="h-5 w-5" style={{ color: flagColors.secondary }} />
                    Economic Intelligence Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Card className="cursor-pointer hover:scale-[1.01] transition-all duration-300 border border-border/50 hover:border-border group">
                        <CardContent className="p-6">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/20">
                                  <RiMoneyDollarCircleLine className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-lg">GDP & Economic Analysis</h3>
                                  <p className="text-sm text-muted-foreground">Complete economic intelligence profile</p>
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-xs group-hover:bg-primary/10">Click to Expand</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">GDP per Capita</div>
                                <div className="text-lg font-semibold">{formatCurrency(country.currentGdpPerCapita)}</div>
                                <div className="text-xs text-amber-600 dark:text-amber-400">{country.economicTier}</div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Economic Health</div>
                                <div className="text-lg font-semibold">{Math.min(100, (country.currentGdpPerCapita / 50000) * 100).toFixed(1)}%</div>
                                <div className="text-xs text-green-600 dark:text-green-400">Growth: {(country.adjustedGdpGrowth * 100).toFixed(2)}%</div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </DialogTrigger>
                    <DialogContent className="!max-w-none !w-[96vw] !h-[96vh] !max-h-none overflow-y-auto !left-[2vw] !top-[2vh] !translate-x-0 !translate-y-0 !sm:max-w-none backdrop-blur-xl bg-background/80 border border-border/50">
                      <DialogHeader className="backdrop-blur-md bg-background/60 rounded-lg p-6 mb-6 border border-border/30">
                        <DialogTitle className="flex items-center gap-2 text-foreground">
                          <RiMoneyDollarCircleLine className="h-5 w-5" style={{ color: flagColors.primary }} />
                          GDP & Economic Intelligence Analysis - {country.name}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-8 p-8 max-w-7xl mx-auto w-full">
                        <Tabs defaultValue="overview" className="w-full">
                          <TabsList className="backdrop-blur-md bg-background/70 border border-border/30 grid w-full grid-cols-4 max-w-2xl mx-auto">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="historical">Historical Trends</TabsTrigger>
                            <TabsTrigger value="analysis">Economic Analysis</TabsTrigger>
                            <TabsTrigger value="projections">Projections</TabsTrigger>
                          </TabsList>

                          <TabsContent value="overview" className="backdrop-blur-sm bg-background/40 rounded-lg p-6 mt-6 border border-border/20">
                            <div className="space-y-6">
                              {/* Current Overview */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                                <div className="backdrop-blur-sm bg-background/50 p-4 rounded-lg border border-border/20 hover:bg-background/60 transition-all">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiMoneyDollarCircleLine className="h-4 w-4 text-green-400 dark:text-green-300" />
                                    <span className="text-sm font-medium">Current GDP/Capita</span>
                                  </div>
                                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                                    {formatCurrency(country.currentGdpPerCapita)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {country.economicTier}
                                  </p>
                                </div>

                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiArrowUpCircleLine className="h-4 w-4 text-blue-400 dark:text-blue-300" />
                                    <span className="text-sm font-medium">Growth Rate</span>
                                  </div>
                                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                                    {(country.adjustedGdpGrowth * 100).toFixed(2)}%
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    annually
                                  </p>
                                </div>

                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiGlobalLine className="h-4 w-4 text-purple-400 dark:text-purple-300" />
                                    <span className="text-sm font-medium">Economic Health</span>
                                  </div>
                                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                                    {Math.min(100, (country.currentGdpPerCapita / 50000) * 100).toFixed(1)}%
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    performance index
                                  </p>
                                </div>

                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiBarChart2Line className="h-4 w-4 text-orange-400 dark:text-orange-300" />
                                    <span className="text-sm font-medium">Tier Progress</span>
                                  </div>
                                  <p className="text-lg font-bold text-orange-700 dark:text-orange-400">
                                    {(() => {
                                      const tiers = ['Impoverished', 'Developing', 'Developed', 'Healthy', 'Strong', 'Very Strong', 'Extravagant'];
                                      const currentIndex = tiers.indexOf(country.economicTier);
                                      return `${currentIndex + 1}/7`;
                                    })()}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {country.economicTier}
                                  </p>
                                </div>
                              </div>

                              {/* GDP Performance Summary */}
                              <Card className="backdrop-blur-sm bg-background/50 border border-border/20">
                                <CardHeader>
                                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                    <RiBarChartLine className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    GDP Performance Summary
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-8">
                                    <div className="text-center">
                                      <div className="text-lg font-semibold text-blue-700 dark:text-blue-400">
                                        {formatCurrency(country.currentTotalGdp / 1e12)}T
                                      </div>
                                      <div className="text-sm text-muted-foreground">Total GDP</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-lg font-semibold text-purple-700 dark:text-purple-400">
                                        {(country.adjustedGdpGrowth * 100).toFixed(2)}%
                                      </div>
                                      <div className="text-sm text-muted-foreground">Growth Volatility</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-lg font-semibold text-green-700 dark:text-green-400">
                                        {formatCurrency(country.currentTotalGdp)}
                                      </div>
                                      <div className="text-sm text-muted-foreground">Peak GDP</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-lg font-semibold text-orange-700 dark:text-orange-400">
                                        Active
                                      </div>
                                      <div className="text-sm text-muted-foreground">Economic Status</div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

                              {/* Economic Tier System */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-lg font-semibold">Economic Tier System</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-3">
                                    {[
                                      { name: "Impoverished", min: 0, max: 9999, icon: "📉" },
                                      { name: "Developing", min: 10000, max: 24999, icon: "📈" },
                                      { name: "Developed", min: 25000, max: 34999, icon: "🏭" },
                                      { name: "Healthy", min: 35000, max: 44999, icon: "💰" },
                                      { name: "Strong", min: 45000, max: 54999, icon: "🚀" },
                                      { name: "Very Strong", min: 55000, max: 64999, icon: "🌟" },
                                      { name: "Extravagant", min: 65000, max: Infinity, icon: "👑" }
                                    ].map((tier, index) => {
                                      const isCurrent = tier.name === country.economicTier;
                                      return (
                                        <div 
                                          key={tier.name}
                                          className={`p-3 rounded-lg border-2 ${
                                            isCurrent 
                                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                                              : 'border-gray-200 dark:border-gray-700'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <span className="text-lg">{tier.icon}</span>
                                              <span className="font-medium">{tier.name}</span>
                                              {isCurrent && (
                                                <Badge variant="default">Current</Badge>
                                              )}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                              {formatCurrency(tier.min)} - {tier.max === Infinity ? '∞' : formatCurrency(tier.max)}
                                            </div>
                                          </div>
                                          
                                          {isCurrent && (
                                            <div className="mt-2 text-sm">
                                              <div className="flex items-center gap-2">
                                                <span>Current: {formatCurrency(country.currentGdpPerCapita)}</span>
                                                {index < 6 && (
                                                  <span className="text-muted-foreground">
                                                    (Need {formatCurrency(([
                                                      10000, 25000, 35000, 45000, 55000, 65000, Infinity
                                                    ][index + 1] || Infinity) - country.currentGdpPerCapita)} for next tier)
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>

                          <TabsContent value="historical" className="mt-6">
                            <div className="space-y-6">
                              <Alert>
                                <RiInformationLine className="h-4 w-4" />
                                <AlertDescription>
                                  Historical trend analysis would show GDP per capita progression over time with multiple chart formats. This requires historical data integration.
                                </AlertDescription>
                              </Alert>
                              
                              <Card>
                                <CardHeader>
                                  <CardTitle>GDP Historical Trends</CardTitle>
                                  <CardDescription>GDP development over time with interactive controls</CardDescription>
                                </CardHeader>
                                <CardContent>
                                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                                    <div className="text-center">
                                      <RiLineChartLine className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                      <p>Historical data visualization</p>
                                      <p className="text-sm">Time series analysis with trend indicators</p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>

                          <TabsContent value="analysis" className="mt-6">
                            <div className="space-y-6">
                              <Card>
                                <CardHeader>
                                  <CardTitle>Economic Analysis Framework</CardTitle>
                                  <CardDescription>Advanced economic metrics and comparative analysis</CardDescription>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-2xl font-bold text-blue-600 mb-2">
                                        {(country.adjustedGdpGrowth * 100).toFixed(2)}%
                                      </div>
                                      <div className="text-sm font-medium mb-1">GDP Volatility</div>
                                      <div className="text-xs text-muted-foreground">
                                        {country.adjustedGdpGrowth < 0.05 ? 'Very Stable' :
                                         country.adjustedGdpGrowth < 0.10 ? 'Stable' :
                                         country.adjustedGdpGrowth < 0.20 ? 'Moderate' : 'High Growth'}
                                      </div>
                                    </div>
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-2xl font-bold text-green-600 mb-2">
                                        {Math.min(100, (country.currentGdpPerCapita / 50000) * 100).toFixed(1)}%
                                      </div>
                                      <div className="text-sm font-medium mb-1">Economic Health</div>
                                      <div className="text-xs text-muted-foreground">
                                        Performance Index
                                      </div>
                                    </div>
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-2xl font-bold text-purple-600 mb-2">
                                        Regional
                                      </div>
                                      <div className="text-sm font-medium mb-1">Competitiveness</div>
                                      <div className="text-xs text-muted-foreground">
                                        {country.region || 'Global Position'}
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>

                          <TabsContent value="projections" className="mt-6">
                            <div className="space-y-6">
                              <Card>
                                <CardHeader>
                                  <CardTitle className="flex items-center gap-2">
                                    <RiArrowUpCircleLine className="h-5 w-5 text-green-500" />
                                    10-Year GDP per Capita Projections
                                    <Badge variant="outline" className="ml-2">
                                      {(country.adjustedGdpGrowth * 100).toFixed(2)}% growth
                                    </Badge>
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                      {[1, 3, 5, 10].map(years => {
                                        const projected = country.currentGdpPerCapita * Math.pow(1 + country.adjustedGdpGrowth, years);
                                        return (
                                          <div key={years} className="text-center p-3 bg-muted/50 rounded-lg">
                                            <div className="text-lg font-semibold">
                                              {formatCurrency(projected)}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                              Year +{years}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    
                                    <div className="text-sm text-muted-foreground space-y-1">
                                      <p>* Projections assume constant growth rates and current economic policies</p>
                                      <p>* Economic tier advancements may affect actual growth rates</p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              {/* Comprehensive Demographics Intelligence Analysis */}
              <Card className="glass-hierarchy-child relative overflow-hidden">
                {/* Card Background Image */}
                {cardBackgroundImages['demographics-analysis'] && (
                  <div className="absolute inset-0 z-0">
                    <img
                      src={cardBackgroundImages['demographics-analysis'].url}
                      alt={cardBackgroundImages['demographics-analysis'].description || 'Demographics analysis background'}
                      className="w-full h-full object-cover object-center blur-sm"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 bg-background/70"></div>
                  </div>
                )}
                <CardHeader className="relative z-10">
                  <CardTitle className="flex items-center gap-2">
                    <RiTeamLine className="h-5 w-5" style={{ color: flagColors.accent }} />
                    Demographics Intelligence Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Card className="cursor-pointer hover:scale-[1.01] transition-all duration-300 border border-border/50 hover:border-border group">
                        <CardContent className="p-6">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                                  <RiTeamLine className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-lg">Population & Demographics</h3>
                                  <p className="text-sm text-muted-foreground">Complete demographic intelligence profile</p>
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-xs group-hover:bg-primary/10">Click to Expand</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Current Population</div>
                                <div className="text-lg font-semibold">{formatPopulation(country.currentPopulation)}</div>
                                <div className="text-xs text-blue-600 dark:text-blue-400">Tier {country.populationTier}</div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Population Growth</div>
                                <div className="text-lg font-semibold">{(country.populationGrowthRate * 100).toFixed(2)}%</div>
                                <div className="text-xs text-green-600 dark:text-green-400">
                                  {country.populationDensity ? `Density: ${country.populationDensity.toFixed(1)}/km²` : 'Density N/A'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </DialogTrigger>
                    <DialogContent className="!max-w-none !w-[96vw] !h-[96vh] !max-h-none overflow-y-auto !left-[2vw] !top-[2vh] !translate-x-0 !translate-y-0 !sm:max-w-none backdrop-blur-xl bg-background/80 border border-border/50">
                      <DialogHeader className="backdrop-blur-md bg-background/60 rounded-lg p-6 mb-6 border border-border/30">
                        <DialogTitle className="flex items-center gap-2 text-foreground">
                          <RiTeamLine className="h-5 w-5" style={{ color: flagColors.secondary }} />
                          Demographics Intelligence Analysis - {country.name}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-8 p-8 max-w-7xl mx-auto w-full">
                        <Tabs defaultValue="overview" className="w-full">
                          <TabsList className="backdrop-blur-md bg-background/70 border border-border/30 grid w-full grid-cols-4 max-w-2xl mx-auto">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="historical">Population Trends</TabsTrigger>
                            <TabsTrigger value="analysis">Demographic Analysis</TabsTrigger>
                            <TabsTrigger value="projections">Population Projections</TabsTrigger>
                          </TabsList>

                          <TabsContent value="overview" className="backdrop-blur-sm bg-background/40 rounded-lg p-6 mt-6 border border-border/20">
                            <div className="space-y-6">
                              {/* Current Overview */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                                <div className="backdrop-blur-sm bg-background/50 p-4 rounded-lg border border-border/20 hover:bg-background/60 transition-all">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiTeamLine className="h-4 w-4 text-blue-400 dark:text-blue-300" />
                                    <span className="text-sm font-medium">Current Population</span>
                                  </div>
                                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                                    {formatPopulation(country.currentPopulation)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    IxTime projection
                                  </p>
                                </div>

                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiArrowUpCircleLine className="h-4 w-4 text-green-400 dark:text-green-300" />
                                    <span className="text-sm font-medium">Growth Rate</span>
                                  </div>
                                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                                    {(country.populationGrowthRate * 100).toFixed(2)}%
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    annual growth
                                  </p>
                                </div>

                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiMapPinLine className="h-4 w-4 text-purple-400 dark:text-purple-300" />
                                    <span className="text-sm font-medium">Population Density</span>
                                  </div>
                                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                                    {country.populationDensity ? `${country.populationDensity.toFixed(1)}` : 'N/A'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    people/km²
                                  </p>
                                </div>

                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiBarChart2Line className="h-4 w-4 text-orange-400 dark:text-orange-300" />
                                    <span className="text-sm font-medium">Population Tier</span>
                                  </div>
                                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                                    Tier {country.populationTier}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    classification level
                                  </p>
                                </div>
                              </div>

                              {/* Geographic Context */}
                              <Card className="backdrop-blur-sm bg-background/50 border border-border/20">
                                <CardHeader>
                                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                    <RiMapPinLine className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                    Geographic Context
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {country.landArea && (
                                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                                        <div className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">
                                          {country.landArea.toLocaleString()} km²
                                        </div>
                                        <div className="text-sm font-medium mb-1">Land Area</div>
                                        <div className="text-xs text-muted-foreground">
                                          Total territorial area
                                        </div>
                                      </div>
                                    )}
                                    {country.populationDensity && (
                                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 mb-2">
                                          {country.populationDensity.toFixed(1)}/km²
                                        </div>
                                        <div className="text-sm font-medium mb-1">Population Density</div>
                                        <div className="text-xs text-muted-foreground">
                                          People per square kilometer
                                        </div>
                                      </div>
                                    )}
                                    {country.continent && (
                                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                                        <div className="text-2xl font-bold text-purple-600 mb-2">
                                          {country.continent}
                                        </div>
                                        <div className="text-sm font-medium mb-1">Location</div>
                                        <div className="text-xs text-muted-foreground">
                                          {country.region || 'Continental region'}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>

                              {/* Population Tier System */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-lg font-semibold">Population Tier System</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-3">
                                    {[
                                      { tier: 1, name: "Small Nation", min: 0, max: 999999, icon: "🏘️" },
                                      { tier: 2, name: "Medium Nation", min: 1000000, max: 4999999, icon: "🏙️" },
                                      { tier: 3, name: "Large Nation", min: 5000000, max: 19999999, icon: "🌆" },
                                      { tier: 4, name: "Major Nation", min: 20000000, max: 49999999, icon: "🌇" },
                                      { tier: 5, name: "Great Nation", min: 50000000, max: 99999999, icon: "🗾" },
                                      { tier: 6, name: "Superpower", min: 100000000, max: Infinity, icon: "🌍" }
                                    ].map((tierInfo) => {
                                      const isCurrent = tierInfo.tier === Number(country.populationTier);
                                      return (
                                        <div 
                                          key={tierInfo.tier}
                                          className={`p-3 rounded-lg border-2 ${
                                            isCurrent 
                                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                                              : 'border-gray-200 dark:border-gray-700'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <span className="text-lg">{tierInfo.icon}</span>
                                              <span className="font-medium">Tier {tierInfo.tier} - {tierInfo.name}</span>
                                              {isCurrent && (
                                                <Badge variant="default">Current</Badge>
                                              )}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                              {formatPopulation(tierInfo.min)} - {tierInfo.max === Infinity ? '∞' : formatPopulation(tierInfo.max)}
                                            </div>
                                          </div>
                                          
                                          {isCurrent && (
                                            <div className="mt-2 text-sm">
                                              <div className="flex items-center gap-2">
                                                <span>Current: {formatPopulation(country.currentPopulation)}</span>
                                                {tierInfo.tier < 6 && (
                                                  <span className="text-muted-foreground">
                                                    (Need {formatPopulation(([1000000, 5000000, 20000000, 50000000, 100000000, Infinity][tierInfo.tier] || Infinity) - country.currentPopulation)} for next tier)
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>

                          <TabsContent value="historical" className="mt-6">
                            <div className="space-y-6">
                              <Alert>
                                <RiInformationLine className="h-4 w-4" />
                                <AlertDescription>
                                  Historical population trend analysis would show demographic progression over time with birth/death rates and migration patterns.
                                </AlertDescription>
                              </Alert>
                              
                              <Card>
                                <CardHeader>
                                  <CardTitle>Population Historical Trends</CardTitle>
                                  <CardDescription>Demographic development over time with growth indicators</CardDescription>
                                </CardHeader>
                                <CardContent>
                                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                                    <div className="text-center">
                                      <RiLineChartLine className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                      <p>Population trend visualization</p>
                                      <p className="text-sm">Time series analysis with demographic indicators</p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>

                          <TabsContent value="analysis" className="mt-6">
                            <div className="space-y-6">
                              <Card>
                                <CardHeader>
                                  <CardTitle>Demographic Analysis Framework</CardTitle>
                                  <CardDescription>Advanced demographic metrics and comparative analysis</CardDescription>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-2xl font-bold text-blue-600 mb-2">
                                        {(country.populationGrowthRate * 100).toFixed(2)}%
                                      </div>
                                      <div className="text-sm font-medium mb-1">Growth Stability</div>
                                      <div className="text-xs text-muted-foreground">
                                        {country.populationGrowthRate < 0.01 ? 'Stable' :
                                         country.populationGrowthRate < 0.03 ? 'Growing' :
                                         country.populationGrowthRate < 0.05 ? 'High Growth' : 'Rapid Growth'}
                                      </div>
                                    </div>
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-2xl font-bold text-green-600 mb-2">
                                        {country.populationDensity ? country.populationDensity.toFixed(0) : 'N/A'}
                                      </div>
                                      <div className="text-sm font-medium mb-1">Density Classification</div>
                                      <div className="text-xs text-muted-foreground">
                                        {!country.populationDensity ? 'Unknown' :
                                         country.populationDensity < 50 ? 'Sparse' :
                                         country.populationDensity < 150 ? 'Moderate' :
                                         country.populationDensity < 300 ? 'Dense' : 'Very Dense'}
                                      </div>
                                    </div>
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-2xl font-bold text-purple-600 mb-2">
                                        Tier {country.populationTier}
                                      </div>
                                      <div className="text-sm font-medium mb-1">Population Ranking</div>
                                      <div className="text-xs text-muted-foreground">
                                        {country.region || 'Global Position'}
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>

                          <TabsContent value="projections" className="mt-6">
                            <div className="space-y-6">
                              <Card>
                                <CardHeader>
                                  <CardTitle className="flex items-center gap-2">
                                    <RiArrowUpCircleLine className="h-5 w-5 text-green-500" />
                                    10-Year Population Projections
                                    <Badge variant="outline" className="ml-2">
                                      {(country.populationGrowthRate * 100).toFixed(2)}% growth
                                    </Badge>
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                      {[1, 3, 5, 10].map(years => {
                                        const projected = country.currentPopulation * Math.pow(1 + country.populationGrowthRate, years);
                                        return (
                                          <div key={years} className="text-center p-3 bg-muted/50 rounded-lg">
                                            <div className="text-lg font-semibold">
                                              {formatPopulation(projected)}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                              Year +{years}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    
                                    <div className="text-sm text-muted-foreground space-y-1">
                                      <p>* Projections assume constant growth rates and current demographic policies</p>
                                      <p>* Migration patterns and social factors may affect actual population growth</p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              {/* Comprehensive Development & Government Intelligence Analysis */}
              <Card className="glass-hierarchy-child relative overflow-hidden">
                {/* Card Background Image */}
                {cardBackgroundImages['development-analysis'] && (
                  <div className="absolute inset-0 z-0">
                    <img
                      src={cardBackgroundImages['development-analysis'].url}
                      alt={cardBackgroundImages['development-analysis'].description || 'Development analysis background'}
                      className="w-full h-full object-cover object-center blur-sm"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 bg-background/70"></div>
                  </div>
                )}
                <CardHeader className="relative z-10">
                  <CardTitle className="flex items-center gap-2">
                    <RiGlobalLine className="h-5 w-5" style={{ color: flagColors.primary }} />
                    Development & Government Intelligence
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Card className="cursor-pointer hover:scale-[1.01] transition-all duration-300 border border-border/50 hover:border-border group">
                        <CardContent className="p-6">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                                  <RiGlobalLine className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-lg">Government & Development</h3>
                                  <p className="text-sm text-muted-foreground">Complete governance and development intelligence</p>
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-xs group-hover:bg-primary/10">Click to Expand</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Government Structure</div>
                                <div className="text-lg font-semibold">{country.governmentType || 'N/A'}</div>
                                <div className="text-xs text-purple-600 dark:text-purple-400">{country.leader || 'Leadership Data N/A'}</div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Development Index</div>
                                <div className="text-lg font-semibold">
                                  {(() => {
                                    const tierScores: Record<string, number> = {
                                      "Extravagant": 100, "Very Strong": 85, "Strong": 70,
                                      "Healthy": 55, "Developed": 40, "Developing": 25
                                    };
                                    return tierScores[country.economicTier] || 10;
                                  })()}%
                                </div>
                                <div className="text-xs text-green-600 dark:text-green-400">Based on {country.economicTier} tier</div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </DialogTrigger>
                    <DialogContent className="!max-w-none !w-[96vw] !h-[96vh] !max-h-none overflow-y-auto !left-[2vw] !top-[2vh] !translate-x-0 !translate-y-0 !sm:max-w-none backdrop-blur-xl bg-background/80 border border-border/50">
                      <DialogHeader className="backdrop-blur-md bg-background/60 rounded-lg p-6 mb-6 border border-border/30">
                        <DialogTitle className="flex items-center gap-2 text-foreground">
                          <RiGlobalLine className="h-5 w-5" style={{ color: flagColors.accent }} />
                          Development & Government Intelligence Analysis - {country.name}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-8 p-8 max-w-7xl mx-auto w-full">
                        <Tabs defaultValue="overview" className="w-full">
                          <TabsList className="backdrop-blur-md bg-background/70 border border-border/30 grid w-full grid-cols-4 max-w-2xl mx-auto">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="governance">Governance Structure</TabsTrigger>
                            <TabsTrigger value="development">Development Index</TabsTrigger>
                            <TabsTrigger value="analysis">Comprehensive Analysis</TabsTrigger>
                          </TabsList>

                          <TabsContent value="overview" className="backdrop-blur-sm bg-background/40 rounded-lg p-6 mt-6 border border-border/20">
                            <div className="space-y-6">
                              {/* Current Overview */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                                <div className="backdrop-blur-sm bg-background/50 p-4 rounded-lg border border-border/20 hover:bg-background/60 transition-all">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiGlobalLine className="h-4 w-4 text-purple-400 dark:text-purple-300" />
                                    <span className="text-sm font-medium">Government Type</span>
                                  </div>
                                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                                    {country.governmentType || 'N/A'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    political system
                                  </p>
                                </div>

                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiUserLine className="h-4 w-4 text-blue-400 dark:text-blue-300" />
                                    <span className="text-sm font-medium">Leadership</span>
                                  </div>
                                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                                    {country.leader ? 'Active' : 'N/A'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {country.leader || 'leadership status'}
                                  </p>
                                </div>

                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiBarChartLine className="h-4 w-4 text-green-400 dark:text-green-300" />
                                    <span className="text-sm font-medium">Development Index</span>
                                  </div>
                                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                                    {(() => {
                                      const tierScores: Record<string, number> = {
                                        "Extravagant": 100, "Very Strong": 85, "Strong": 70,
                                        "Healthy": 55, "Developed": 40, "Developing": 25
                                      };
                                      return tierScores[country.economicTier] || 10;
                                    })()}%
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    development score
                                  </p>
                                </div>

                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiMapPinLine className="h-4 w-4 text-orange-400 dark:text-orange-300" />
                                    <span className="text-sm font-medium">Regional Position</span>
                                  </div>
                                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                                    {country.region || country.continent || 'Global'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    geographic region
                                  </p>
                                </div>
                              </div>

                              {/* Cultural & Social Context */}
                              <Card className="backdrop-blur-sm bg-background/50 border border-border/20">
                                <CardHeader>
                                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                    <RiGroup2Line className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    Cultural & Social Context
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {country.religion && (
                                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 mb-2">
                                          {country.religion}
                                        </div>
                                        <div className="text-sm font-medium mb-1">Primary Religion</div>
                                        <div className="text-xs text-muted-foreground">
                                          Cultural foundation
                                        </div>
                                      </div>
                                    )}
                                    {country.capital && (
                                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                                        <div className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">
                                          {country.capital}
                                        </div>
                                        <div className="text-sm font-medium mb-1">Capital City</div>
                                        <div className="text-xs text-muted-foreground">
                                          Administrative center
                                        </div>
                                      </div>
                                    )}
                                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                                      <div className="text-2xl font-bold text-purple-600 mb-2">
                                        {country.continent || 'Global'}
                                      </div>
                                      <div className="text-sm font-medium mb-1">Continental Position</div>
                                      <div className="text-xs text-muted-foreground">
                                        Geographic classification
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

                              {/* Development Classification System */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-lg font-semibold">Development Classification System</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-3">
                                    {[
                                      { name: "Impoverished", score: 10, min: 0, max: 9999, icon: "📉", color: "text-red-600" },
                                      { name: "Developing", score: 25, min: 10000, max: 24999, icon: "📈", color: "text-orange-600" },
                                      { name: "Developed", score: 40, min: 25000, max: 34999, icon: "🏭", color: "text-yellow-600" },
                                      { name: "Healthy", score: 55, min: 35000, max: 44999, icon: "💰", color: "text-green-600" },
                                      { name: "Strong", score: 70, min: 45000, max: 54999, icon: "🚀", color: "text-blue-600" },
                                      { name: "Very Strong", score: 85, min: 55000, max: 64999, icon: "🌟", color: "text-indigo-600" },
                                      { name: "Extravagant", score: 100, min: 65000, max: Infinity, icon: "👑", color: "text-purple-600" }
                                    ].map((tier) => {
                                      const isCurrent = tier.name === country.economicTier;
                                      return (
                                        <div 
                                          key={tier.name}
                                          className={`p-3 rounded-lg border-2 ${
                                            isCurrent 
                                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                                              : 'border-gray-200 dark:border-gray-700'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <span className="text-lg">{tier.icon}</span>
                                              <span className="font-medium">{tier.name} ({tier.score}%)</span>
                                              {isCurrent && (
                                                <Badge variant="default">Current</Badge>
                                              )}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                              GDP: {formatCurrency(tier.min)} - {tier.max === Infinity ? '∞' : formatCurrency(tier.max)}
                                            </div>
                                          </div>
                                          
                                          {isCurrent && (
                                            <div className="mt-2 text-sm">
                                              <div className="flex items-center gap-2">
                                                <span>Current GDP/capita: {formatCurrency(country.currentGdpPerCapita)}</span>
                                                <span className={`font-medium ${tier.color}`}>
                                                  Development Score: {tier.score}%
                                                </span>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>

                          <TabsContent value="governance" className="mt-6">
                            <div className="space-y-6">
                              <Card>
                                <CardHeader>
                                  <CardTitle>Government Structure Analysis</CardTitle>
                                  <CardDescription>Political system and administrative framework</CardDescription>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                      <h4 className="font-semibold mb-3">Executive Branch</h4>
                                      <div className="space-y-3">
                                        <div className="p-4 border rounded-lg">
                                          <div className="text-sm font-medium mb-1">Government Type</div>
                                          <div className="text-lg">{country.governmentType || 'Not specified'}</div>
                                        </div>
                                        <div className="p-4 border rounded-lg">
                                          <div className="text-sm font-medium mb-1">Current Leader</div>
                                          <div className="text-lg">{country.leader || 'Not specified'}</div>
                                        </div>
                                        <div className="p-4 border rounded-lg">
                                          <div className="text-sm font-medium mb-1">Capital City</div>
                                          <div className="text-lg">{country.capital || 'Not specified'}</div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="space-y-4">
                                      <h4 className="font-semibold mb-3">Administrative Metrics</h4>
                                      <div className="space-y-3">
                                        <div className="p-4 border rounded-lg">
                                          <div className="text-sm font-medium mb-1">Governance Efficiency</div>
                                          <div className="text-lg text-blue-600">
                                            {(() => {
                                              const tierScores: Record<string, number> = {
                                                "Extravagant": 95, "Very Strong": 85, "Strong": 75,
                                                "Healthy": 65, "Developed": 55, "Developing": 35
                                              };
                                              return tierScores[country.economicTier] || 25;
                                            })()}%
                                          </div>
                                        </div>
                                        <div className="p-4 border rounded-lg">
                                          <div className="text-sm font-medium mb-1">Administrative Capacity</div>
                                          <div className="text-lg text-green-600">
                                            {country.economicTier === 'Extravagant' ? 'Very High' :
                                             ['Very Strong', 'Strong'].includes(country.economicTier) ? 'High' :
                                             ['Healthy', 'Developed'].includes(country.economicTier) ? 'Moderate' : 'Developing'}
                                          </div>
                                        </div>
                                        <div className="p-4 border rounded-lg">
                                          <div className="text-sm font-medium mb-1">Institutional Stability</div>
                                          <div className="text-lg text-purple-600">
                                            {(country.populationGrowthRate < 0.02 && ['Extravagant', 'Very Strong', 'Strong'].includes(country.economicTier)) ? 'Very Stable' :
                                             ['Healthy', 'Developed'].includes(country.economicTier) ? 'Stable' : 'Developing'}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>

                          <TabsContent value="development" className="mt-6">
                            <div className="space-y-6">
                              <Card>
                                <CardHeader>
                                  <CardTitle>Development Index Analysis</CardTitle>
                                  <CardDescription>Comprehensive development metrics and regional comparison</CardDescription>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-3xl font-bold text-blue-600 mb-2">
                                        {(() => {
                                          const tierScores: Record<string, number> = {
                                            "Extravagant": 100, "Very Strong": 85, "Strong": 70,
                                            "Healthy": 55, "Developed": 40, "Developing": 25
                                          };
                                          return tierScores[country.economicTier] || 10;
                                        })()}%
                                      </div>
                                      <div className="text-sm font-medium mb-1">Overall Development Index</div>
                                      <div className="text-xs text-muted-foreground">
                                        Based on economic tier classification
                                      </div>
                                    </div>
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-3xl font-bold text-green-600 mb-2">
                                        {Math.min(100, (country.currentGdpPerCapita / 50000) * 100).toFixed(0)}%
                                      </div>
                                      <div className="text-sm font-medium mb-1">Economic Development</div>
                                      <div className="text-xs text-muted-foreground">
                                        GDP per capita relative score
                                      </div>
                                    </div>
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-3xl font-bold text-purple-600 mb-2">
                                        {((country.populationGrowthRate * 100 + 2) * 25).toFixed(0)}%
                                      </div>
                                      <div className="text-sm font-medium mb-1">Social Development</div>
                                      <div className="text-xs text-muted-foreground">
                                        Population and social indicators
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>

                          <TabsContent value="analysis" className="mt-6">
                            <div className="space-y-6">
                              <Card>
                                <CardHeader>
                                  <CardTitle>Comprehensive Development Analysis</CardTitle>
                                  <CardDescription>Multi-dimensional assessment of national development</CardDescription>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div>
                                        <h4 className="font-semibold mb-3">Strengths</h4>
                                        <div className="space-y-2">
                                          {country.economicTier === 'Extravagant' && (
                                            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/20 rounded">
                                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                              <span className="text-sm">Highest economic tier achieved</span>
                                            </div>
                                          )}
                                          {['Very Strong', 'Strong', 'Healthy'].includes(country.economicTier) && (
                                            <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                              <span className="text-sm">Strong economic foundation</span>
                                            </div>
                                          )}
                                          {country.populationGrowthRate > 0.01 && (
                                            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/20 rounded">
                                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                              <span className="text-sm">Positive population growth</span>
                                            </div>
                                          )}
                                          {country.currentGdpPerCapita > 35000 && (
                                            <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-950/20 rounded">
                                              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                              <span className="text-sm">High standard of living</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div>
                                        <h4 className="font-semibold mb-3">Development Opportunities</h4>
                                        <div className="space-y-2">
                                          {country.economicTier === 'Developing' && (
                                            <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded">
                                              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                              <span className="text-sm">Economic diversification potential</span>
                                            </div>
                                          )}
                                          {country.populationGrowthRate > 0.03 && (
                                            <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-950/20 rounded">
                                              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                              <span className="text-sm">Demographic dividend opportunity</span>
                                            </div>
                                          )}
                                          {!country.religion && (
                                            <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                              <span className="text-sm">Cultural identity development</span>
                                            </div>
                                          )}
                                          <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-950/20 rounded">
                                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                            <span className="text-sm">Governance modernization</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              {/* Labor & Government Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Labor Metrics */}
                <Card className="glass-hierarchy-child relative overflow-hidden">
                  {/* Card Background Image */}
                  {cardBackgroundImages['labor-force'] && (
                    <div className="absolute inset-0 z-0">
                      <img
                        src={cardBackgroundImages['labor-force'].url}
                        alt={cardBackgroundImages['labor-force'].description || 'Labor force background'}
                        className="w-full h-full object-cover object-center blur-sm"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <div className="absolute inset-0 bg-background/70"></div>
                    </div>
                  )}
                  <CardHeader className="relative z-10">
                    <CardTitle className="flex items-center gap-2">
                      <RiBuildingLine className="h-5 w-5" style={{ color: flagColors.primary }} />
                      Labor Force
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className="space-y-4">
                      {countryMetrics
                        .filter(metric => metric.id.includes('labor') || metric.id.includes('unemployment'))
                        .filter(metric => hasAccess(metric.classification))
                        .length === 0 ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            No labor force data available
                          </div>
                        ) : countryMetrics
                        .filter(metric => metric.id.includes('labor') || metric.id.includes('unemployment'))
                        .filter(metric => hasAccess(metric.classification))
                        .map((metric) => {
                        const MetricIcon = metric.icon as React.ComponentType<{ className?: string; style?: React.CSSProperties; }>;
                        const TrendIcon = metric.trend ? getTrendIcon(metric.trend.direction) : null;
                        
                        return (
                          <div 
                            key={metric.id}
                            className="p-4 rounded-lg border bg-card/50"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <MetricIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{metric.label}</span>
                            </div>
                            
                            <div className="flex items-baseline gap-1 mb-2">
                              <span className="text-xl font-semibold">{metric.value}</span>
                              {metric.unit && (
                                <span className="text-sm text-muted-foreground">{metric.unit}</span>
                              )}
                            </div>
                            
                            {metric.trend && (
                              <div className="flex items-center gap-1">
                                {TrendIcon && (
                                  <TrendIcon className={cn("h-3 w-3", getTrendColor(metric.trend.direction))} />
                                )}
                                <span className={cn("text-xs", getTrendColor(metric.trend.direction))}>
                                  {metric.trend.value.toFixed(2)}% {metric.trend.period}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                        })}
                    </div>
                  </CardContent>
                </Card>

                {/* Government & Geographic */}
                <Card className="glass-hierarchy-child relative overflow-hidden">
                  {/* Card Background Image */}
                  {cardBackgroundImages['geography'] && (
                    <div className="absolute inset-0 z-0">
                      <img
                        src={cardBackgroundImages['geography'].url}
                        alt={cardBackgroundImages['geography'].description || 'Geography background'}
                        className="w-full h-full object-cover object-center blur-sm"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <div className="absolute inset-0 bg-background/70"></div>
                    </div>
                  )}
                  <CardHeader className="relative z-10">
                    <CardTitle className="flex items-center gap-2">
                      <RiMapLine className="h-5 w-5" style={{ color: flagColors.primary }} />
                      Government & Geography
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {countryMetrics
                        .filter(metric => 
                          metric.id.includes('government') || 
                          metric.id.includes('capital') || 
                          metric.id.includes('continent') || 
                          metric.id.includes('region') ||
                          metric.id.includes('area') ||
                          metric.id.includes('density')
                        )
                        .filter(metric => hasAccess(metric.classification))
                        .length === 0 ? (
                          <div className="col-span-2 p-4 text-center text-sm text-muted-foreground">
                            No government & geography data available
                          </div>
                        ) : countryMetrics
                        .filter(metric => 
                          metric.id.includes('government') || 
                          metric.id.includes('capital') || 
                          metric.id.includes('continent') || 
                          metric.id.includes('region') ||
                          metric.id.includes('area') ||
                          metric.id.includes('density')
                        )
                        .filter(metric => hasAccess(metric.classification))
                        .map((metric) => {
                        const MetricIcon = metric.icon as React.ComponentType<{ className?: string; style?: React.CSSProperties; }>;
                        
                        return (
                          <div 
                            key={metric.id}
                            className="p-3 rounded-lg border bg-card/50"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <MetricIcon className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
                            </div>
                            
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm font-semibold">{metric.value}</span>
                              {metric.unit && (
                                <span className="text-xs text-muted-foreground">{metric.unit}</span>
                              )}
                            </div>
                          </div>
                        );
                        })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeSection === 'information' && (
            <div className="space-y-6">
              {/* CIA Factbook-Style Analysis */}
              <div className="flex items-center gap-2 mb-4">
                <RiGlobalLine className="h-5 w-5 text-blue-400" />
                <h3 className="text-lg font-semibold">Intelligence Analysis</h3>
                <Badge variant="outline" className="text-xs">
                  Classification: {viewerClearanceLevel}
                </Badge>
              </div>
              
              {/* Executive Summary */}
              <Card className="bg-gradient-to-r from-blue-500/5 to-cyan-500/5 border-blue-500/20 relative z-10 overflow-hidden">
                {/* Card Background Image */}
                {cardBackgroundImages['executive-summary'] && (
                  <div className="absolute inset-0 z-0">
                    <img
                      src={cardBackgroundImages['executive-summary'].url}
                      alt={cardBackgroundImages['executive-summary'].description || 'Executive summary background'}
                      className="w-full h-full object-cover object-center blur-sm"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 bg-background/70"></div>
                  </div>
                )}
                <CardHeader className="pb-3 relative z-10">
                  <CardTitle className="text-base flex items-center gap-2">
                    <RiEyeLine className="h-4 w-4" />
                    Executive Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 relative z-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Economic Threat Level:</span>{' '}
                      <span className={`font-semibold ${
                        country.economicTier === 'High' ? 'text-red-400' :
                        country.economicTier === 'Upper-Middle' ? 'text-orange-400' :
                        country.economicTier === 'Lower-Middle' ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {country.economicTier === 'High' ? 'SIGNIFICANT' :
                         country.economicTier === 'Upper-Middle' ? 'MODERATE' :
                         country.economicTier === 'Lower-Middle' ? 'LOW' : 'MINIMAL'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Regional Influence:</span>{' '}
                      <span className="font-semibold text-blue-400">
                        {country.currentTotalGdp > 500000000000 ? 'MAJOR' :
                         country.currentTotalGdp > 100000000000 ? 'SIGNIFICANT' :
                         country.currentTotalGdp > 50000000000 ? 'MODERATE' : 'LIMITED'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Stability Index:</span>{' '}
                      <span className={`font-semibold ${
                        country.populationGrowthRate > 0.03 ? 'text-orange-400' :
                        country.populationGrowthRate > 0.01 ? 'text-green-400' : 'text-yellow-400'
                      }`}>
                        {country.populationGrowthRate > 0.03 ? 'DYNAMIC' :
                         country.populationGrowthRate > 0.01 ? 'STABLE' : 'DECLINING'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Development Status:</span>{' '}
                      <span className="font-semibold text-purple-400">
                        {country.currentGdpPerCapita > 40000 ? 'ADVANCED' :
                         country.currentGdpPerCapita > 20000 ? 'DEVELOPING' : 'EMERGING'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-blue-500/10 rounded-md p-3 mt-4">
                    <p className="text-sm leading-relaxed">
                      <strong>Intelligence Summary:</strong> {country.name} represents a {country.economicTier.toLowerCase()}-tier economy with 
                      {country.currentTotalGdp > 100000000000 ? ' significant regional economic influence' : ' moderate regional presence'}. 
                      Population dynamics show {country.populationGrowthRate > 0.02 ? 'robust growth' : 'stable demographics'} 
                      with {Math.round(country.populationDensity || 0)} people per sq km. 
                      {country.leader ? `Current leadership under ${country.leader} ` : 'Government leadership '}
                      maintains {country.governmentType || 'standard'} governance structure.
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              {/* Key Metrics Dashboard */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Economic Power */}
                <Card className="bg-gradient-to-br from-emerald-500/5 to-green-500/5 border-emerald-500/20 relative z-10 overflow-hidden">
                  {/* Card Background Image */}
                  {cardBackgroundImages['economic-power'] && (
                    <div className="absolute inset-0 z-0">
                      <img
                        src={cardBackgroundImages['economic-power'].url}
                        alt={cardBackgroundImages['economic-power'].description || 'Economic power background'}
                        className="w-full h-full object-cover object-center blur-sm"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <div className="absolute inset-0 bg-background/75"></div>
                    </div>
                  )}
                  <CardContent className="p-4 relative z-10">
                    <div className="flex items-center justify-between mb-2">
                      <RiMoneyDollarCircleLine className="h-5 w-5 text-emerald-400" />
                      <Badge variant="outline" className="text-xs">Economic</Badge>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="text-xs text-muted-foreground">Total GDP</div>
                        <div className="font-semibold">${(country.currentTotalGdp / 1e9).toFixed(1)}B</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Per Capita</div>
                        <div className="font-semibold">${country.currentGdpPerCapita.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Growth Rate</div>
                        <div className="font-semibold text-emerald-400">+{(country.adjustedGdpGrowth * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Demographics */}
                <Card className="bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border-blue-500/20 relative z-10 overflow-hidden">
                  {/* Card Background Image */}
                  {cardBackgroundImages['demographics'] && (
                    <div className="absolute inset-0 z-0">
                      <img
                        src={cardBackgroundImages['demographics'].url}
                        alt={cardBackgroundImages['demographics'].description || 'Demographics background'}
                        className="w-full h-full object-cover object-center blur-sm"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <div className="absolute inset-0 bg-background/75"></div>
                    </div>
                  )}
                  <CardContent className="p-4 relative z-10">
                    <div className="flex items-center justify-between mb-2">
                      <RiTeamLine className="h-5 w-5 text-blue-400" />
                      <Badge variant="outline" className="text-xs">Demographics</Badge>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="text-xs text-muted-foreground">Population</div>
                        <div className="font-semibold">{(country.currentPopulation / 1e6).toFixed(1)}M</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Density</div>
                        <div className="font-semibold">{Math.round(country.populationDensity || 0)}/km²</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Growth Rate</div>
                        <div className="font-semibold text-blue-400">+{(country.populationGrowthRate * 100).toFixed(2)}%</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Strategic Assessment */}
                <Card className="bg-gradient-to-br from-purple-500/5 to-violet-500/5 border-purple-500/20 relative z-10 overflow-hidden">
                  {/* Card Background Image */}
                  {cardBackgroundImages['strategic-assessment'] && (
                    <div className="absolute inset-0 z-0">
                      <img
                        src={cardBackgroundImages['strategic-assessment'].url}
                        alt={cardBackgroundImages['strategic-assessment'].description || 'Strategic assessment background'}
                        className="w-full h-full object-cover object-center blur-sm"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <div className="absolute inset-0 bg-background/75"></div>
                    </div>
                  )}
                  <CardContent className="p-4 relative z-10">
                    <div className="flex items-center justify-between mb-2">
                      <RiBarChart2Line className="h-5 w-5 text-purple-400" />
                      <Badge variant="outline" className="text-xs">Strategic</Badge>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="text-xs text-muted-foreground">Economic Tier</div>
                        <div className="font-semibold">{country.economicTier}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Pop. Tier</div>
                        <div className="font-semibold">{country.populationTier}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Last Updated</div>
                        <div className="font-semibold text-purple-400">
                          {Math.floor((currentIxTime - country.lastCalculated) / (1000 * 60 * 60 * 24))}d ago
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Intelligence Alerts */}
              {intelligenceAlerts && intelligenceAlerts.length > 0 && (
                <Card className="bg-gradient-to-r from-amber-500/5 to-orange-500/5 border-amber-500/20 relative z-10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <RiAlertLine className="h-4 w-4 text-amber-400" />
                      Active Intelligence Alerts ({intelligenceAlerts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {intelligenceAlerts.slice(0, 3).map((alert) => (
                        <div key={alert.id} className="flex items-start gap-3 p-2 rounded-md bg-background/50">
                          <div className={`w-2 h-2 rounded-full mt-2 ${
                            alert.type === 'critical' ? 'bg-red-400' :
                            alert.type === 'warning' ? 'bg-orange-400' :
                            alert.type === 'info' ? 'bg-blue-400' : 'bg-green-400'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{alert.title}</div>
                            <div className="text-xs text-muted-foreground">{alert.description}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {new Date(alert.timestamp).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))}
                      {intelligenceAlerts.length > 3 && (
                        <div className="text-xs text-muted-foreground text-center pt-2">
                          +{intelligenceAlerts.length - 3} more alerts available
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer Actions */}
      <div className="glass-hierarchy-child rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Last updated: {IxTime.formatIxTime(country.lastCalculated, true)} • 
            Data classification: {viewerClearanceLevel}
          </div>
          {isOwnCountry && (
            <Button variant="outline" size="sm">
              <RiSettings3Line className="h-4 w-4 mr-2" />
              Manage Intelligence Settings
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedIntelligenceBriefing;