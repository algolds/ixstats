"use client";

import { use } from "react";
import { api } from "~/trpc/react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { AlertTriangle, Eye, Activity, Users, TrendingUp, MapPin, Globe, Building, Heart, BookOpen, ExternalLink, Settings, Crown, Rss } from "lucide-react";
import { createUrl } from "~/lib/url-utils";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { SocialProfileTransformer } from "~/lib/social-profile-transformer";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { unsplashService } from "~/lib/unsplash-service";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import type { EnhancedCountryProfileData, SocialActionType } from "~/types/social-profile";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { IxnayWikiService, type CountryInfobox } from "~/lib/mediawiki-service";
import { WikiIntelligenceTab } from "~/components/countries/WikiIntelligenceTab";
import { ThinkpagesSocialPlatform } from "~/components/thinkpages/ThinkpagesSocialPlatform";
import { CountryMetricsGrid } from "~/components/mycountry/primitives/CountryMetricsGrid";
import { VitalityRings } from "~/components/mycountry/primitives/VitalityRings";
import { CountryActionsMenu } from "~/components/countries/CountryActionsMenu";
import { EnhancedEmbassyNetwork } from "~/components/diplomatic/EnhancedEmbassyNetwork";
import { SecureDiplomaticChannels } from "~/components/diplomatic/SecureDiplomaticChannels";
import { CulturalExchangeProgram } from "~/components/diplomatic/CulturalExchangeProgram";
import { InlineDiplomaticActions } from "~/components/diplomatic/InlineDiplomaticActions";
import dynamic from "next/dynamic";
import { IxTime } from "~/lib/ixtime";



// Dynamically import chart-heavy components to prevent SSR/hydration issues
const LaborEmployment = dynamic(() => import("~/app/countries/_components/economy").then(mod => ({ default: mod.LaborEmployment })), {
  ssr: false,
  loading: () => <div className="text-center py-8 text-muted-foreground">Loading labor data...</div>
});
const Demographics = dynamic(() => import("~/app/countries/_components/economy").then(mod => ({ default: mod.Demographics })), {
  ssr: false,
  loading: () => <div className="text-center py-8 text-muted-foreground">Loading demographics...</div>
});
const GovernmentSpending = dynamic(() => import("~/app/countries/_components/economy").then(mod => ({ default: mod.GovernmentSpending })), {
  ssr: false,
  loading: () => <div className="text-center py-8 text-muted-foreground">Loading spending data...</div>
});
const FiscalSystemComponent = dynamic(() => import("~/app/countries/_components/economy").then(mod => ({ default: mod.FiscalSystemComponent })), {
  ssr: false,
  loading: () => <div className="text-center py-8 text-muted-foreground">Loading fiscal data...</div>
});
const CountryAtGlance = dynamic(() => import("~/app/countries/_components/detail").then(mod => ({ default: mod.CountryAtGlance })), {
  ssr: false,
  loading: () => <div className="text-center py-8 text-muted-foreground">Loading economic indicators...</div>
});
import type {
  CoreEconomicIndicatorsData,
  DemographicsData,
  LaborEmploymentData,
  FiscalSystemData,
  GovernmentSpendingData
} from "~/types/economics";

interface PublicCountryPageProps {
  params: Promise<{ slug: string }>;
}

export default function PublicCountryPage({ params }: PublicCountryPageProps) {
  useEffect(() => {
    document.title = "Country Profile - IxStats";
  }, []);

  const { slug } = use(params);
  const { user } = useUser();

  // State management
  const [unsplashImageUrl, setUnsplashImageUrl] = useState<string | undefined>();
  const [wikiInfobox, setWikiInfobox] = useState<CountryInfobox | null>(null);
  const [wikiIntro, setWikiIntro] = useState<string[]>([]);
  const [showFullWikiIntro, setShowFullWikiIntro] = useState(false);
  const [showGdpPerCapita, setShowGdpPerCapita] = useState(true);
  const [showFullPopulation, setShowFullPopulation] = useState(false);
  type TabType = 'overview' | 'mycountry' | 'lore' | 'diplomatic' | 'diplomacy';
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isMounted, setIsMounted] = useState(false);
  const [showCountryActions, setShowCountryActions] = useState(false);
  const [showDiplomaticActions, setShowDiplomaticActions] = useState(false);
  type DiplomacySubTab = 'embassy-network' | 'secure-channels' | 'cultural-exchange';
  const [activeDiplomacyTab, setActiveDiplomacyTab] = useState<DiplomacySubTab>('embassy-network');

  // Prevent hydration issues with charts
  useEffect(() => {
    setIsMounted(true);
  }, []);
  const currentIxTime = IxTime.getCurrentIxTime();

  // Data fetching - the API already handles both names and IDs
  // Just pass the slug as-is, replacing underscores with spaces for pretty URLs
  const querySlug = slug.replace(/_/g, ' ');
  const { data: country, isLoading, error } = api.countries.getByIdWithEconomicData.useQuery({ id: querySlug });
  const { data: userProfile } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );
  const { data: governmentStructure } = api.government.getByCountryId.useQuery(
    { countryId: country?.id || '' },
    { enabled: !!country?.id }
  );

  // Flag loading
  const { flagUrl, isLoading: flagLoading } = useFlag(country?.name || "");

  // Load Unsplash header image
  useEffect(() => {
    if (country && !unsplashImageUrl) {
      unsplashService.getCountryHeaderImage(
        country.economicTier,
        country.populationTier,
        country.name,
        country.continent || undefined
      )
        .then(imageData => {
          setUnsplashImageUrl(imageData.url);
          if (imageData.downloadUrl) {
            void unsplashService.trackDownload(imageData.downloadUrl);
          }
        })
        .catch(error => {
          console.warn('Failed to load Unsplash image:', error);
          setUnsplashImageUrl(undefined);
        });
    }
  }, [country, unsplashImageUrl]);

  // Load wiki infobox and intro content
  useEffect(() => {
    if (country?.name) {
      const wikiService = new IxnayWikiService();

      // Load infobox
      wikiService.getCountryInfobox(country.name)
        .then((infobox: CountryInfobox | null) => {
          setWikiInfobox(infobox);
        })
        .catch((error: Error) => {
          console.warn('Failed to load wiki infobox:', error);
        });

      // Load wiki intro text - Use same parsing logic as WikiIntelligenceTab
      wikiService.getPageWikitext(country.name)
        .then((wikitext) => {
          if (typeof wikitext === 'string' && wikitext.length > 0) {
            // Extract infobox to get the template content (service already has method for this)
            const infoboxTemplate = wikiService.extractInfoboxTemplate(wikitext);

            // Get content after infobox
            let contentAfterInfobox = wikitext;
            if (infoboxTemplate) {
              const infoboxIndex = wikitext.indexOf(infoboxTemplate);
              if (infoboxIndex !== -1) {
                contentAfterInfobox = wikitext.substring(infoboxIndex + infoboxTemplate.length).trim();
              }
            }

            // Extract content before first heading (intro section)
            const beforeFirstHeading = contentAfterInfobox.split(/^==/m)[0] || contentAfterInfobox;

            // CLEAN WIKITEXT - Extract template content instead of just removing
            let cleanContent = beforeFirstHeading
              // First, process common templates to extract their display text
              // {{wp|page|display}} -> display
              .replace(/\{\{wp\|[^\|\}]+\|([^\}]+)\}\}/g, '$1')
              // {{wp|text}} -> text
              .replace(/\{\{wp\|([^\}]+)\}\}/g, '$1')
              // {{lang|code|text}} -> text
              .replace(/\{\{lang\|[^\|]+\|([^\}]+)\}\}/g, '$1')
              // {{nowrap|text}} -> text
              .replace(/\{\{nowrap\|([^\}]+)\}\}/g, '$1')
              // {{convert|...}} and other complex templates - just remove
              .replace(/\{\{convert[^\}]*\}\}/gi, '')
              // Generic {{template|text}} -> text (last param)
              .replace(/\{\{[^\}]+\|([^\|\}]+)\}\}/g, '$1')
              // Remove any remaining simple templates
              .replace(/\{\{[^\}]+\}\}/g, '')
              // Remove [[Template:...]] links completely
              .replace(/\[\[Template:[^\]]*\]\]/gi, '')
              // Remove categories, files, language links
              .replace(/\[\[Category:[^\]]*\]\]/gi, '')
              .replace(/\[\[File:[^\]]*\]\]/gi, '')
              .replace(/\[\[Image:[^\]]*\]\]/gi, '')
              .replace(/\[\[[a-z]{2,3}:[^\]]*\]\]/gi, '')
              // Remove refs and citations
              .replace(/<ref[^>]*>.*?<\/ref>/gi, '')
              .replace(/<ref[^>]*\/>/gi, '')
              // Remove HTML comments
              .replace(/<!--.*?-->/gs, '')
              // Remove table markup
              .replace(/\{\|.*?\|\}/gs, '')
              // Remove magic words
              .replace(/__[A-Z_]+__/g, '')
              // PRESERVE paragraph breaks by replacing them with a marker
              .replace(/\n\n+/g, '|||PARAGRAPH_BREAK|||')
              // Clean up multiple spaces (but NOT the paragraph markers)
              .replace(/[ \t]+/g, ' ')
              // Clean up single newlines (but NOT the markers)
              .replace(/\n/g, ' ')
              .trim();

            // NOW process the cleaned content for display (FIXED: non-greedy wikilink matching)
            const processedContent = cleanContent
              // Preserve internal links with proper formatting (ONLY non-template links)
              // Use [^\[\]\|] to prevent matching across multiple links
              .replace(/\[\[([^\[\]\|]+)\|([^\[\]]+?)\]\]/g, (_, page, display) => {
                if (page.toLowerCase().includes('template:')) return '';
                return `<a href="https://ixwiki.com/wiki/${encodeURIComponent(page)}" class="wiki-link text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">${display}</a>`;
              })
              .replace(/\[\[([^\[\]]+?)\]\]/g, (_, page) => {
                if (page.toLowerCase().includes('template:')) return '';
                return `<a href="https://ixwiki.com/wiki/${encodeURIComponent(page)}" class="wiki-link text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">${page}</a>`;
              })
              // Preserve external links
              .replace(/\[([^\s\]]+)\s+([^\]]+)\]/g, '<a href="$1" class="external-link text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 underline" target="_blank">$2</a>')
              // Preserve text formatting
              .replace(/'''([^']*)'''/g, '<strong class="font-semibold text-foreground">$1</strong>')
              .replace(/''([^']*)''/g, '<em class="italic text-muted-foreground">$1</em>');

            // Split into paragraphs using our preserved markers
            const paragraphs = processedContent
              .split('|||PARAGRAPH_BREAK|||')
              .map(p => p.trim())
              .filter(p => p.length > 50)
              .slice(0, 3);

            console.log(`[Wiki Intro] Loaded ${paragraphs.length} paragraphs from IxWiki for ${country.name}`);

            if (paragraphs.length > 0) {
              setWikiIntro(paragraphs);
            }
          }
        })
        .catch((error: Error) => {
          console.warn('Failed to load wiki intro:', error);
        });
    }
  }, [country?.name]);

  const isOwnCountry = userProfile?.countryId && country?.id && userProfile.countryId === country.id;

  // Transform country data into economics component formats
  const economicsData = useMemo(() => {
    if (!country) return null;

    const coreIndicators: CoreEconomicIndicatorsData = {
      totalPopulation: country.currentPopulation,
      nominalGDP: country.currentTotalGdp,
      gdpPerCapita: country.currentGdpPerCapita,
      realGDPGrowthRate: country.adjustedGdpGrowth ?? 0.03,
      inflationRate: 0.02, // Default 2%
      currencyExchangeRate: 1.0,
      giniCoefficient: 35
    };

    const demographicsData: DemographicsData = {
      lifeExpectancy: 78,
      urbanRuralSplit: { urban: 75, rural: 25 },
      ageDistribution: [
        { group: "0-14", percent: 18, color: "#3b82f6" },
        { group: "15-24", percent: 12, color: "#10b981" },
        { group: "25-54", percent: 42, color: "#f59e0b" },
        { group: "55-64", percent: 15, color: "#ef4444" },
        { group: "65+", percent: 13, color: "#8b5cf6" }
      ],
      regions: [],
      educationLevels: [
        { level: "Primary", percent: 15, color: "#3b82f6" },
        { level: "Secondary", percent: 45, color: "#10b981" },
        { level: "Tertiary", percent: 30, color: "#f59e0b" },
        { level: "Post-graduate", percent: 10, color: "#ef4444" }
      ],
      literacyRate: 95,
      citizenshipStatuses: [
        { status: "Citizen", percent: 92, color: "#3b82f6" },
        { status: "Permanent Resident", percent: 5, color: "#10b981" },
        { status: "Temporary", percent: 3, color: "#f59e0b" }
      ]
    };

    const laborData: LaborEmploymentData = {
      laborForceParticipationRate: 65,
      employmentRate: 94,
      unemploymentRate: 6,
      totalWorkforce: country.currentPopulation * 0.65,
      averageWorkweekHours: 40,
      minimumWage: country.currentGdpPerCapita * 0.4 / 2080,
      averageAnnualIncome: country.currentGdpPerCapita * 0.85,
      employmentBySector: {
        agriculture: 5,
        industry: 25,
        services: 70
      },
      employmentByType: {
        fullTime: 75,
        partTime: 15,
        temporary: 5,
        selfEmployed: 10,
        informal: 5
      },
      skillsAndProductivity: {
        averageEducationYears: 12.5,
        tertiaryEducationRate: 30,
        vocationalTrainingRate: 20,
        skillsGapIndex: 25,
        laborProductivityIndex: 100,
        productivityGrowthRate: 2.5
      },
      demographicsAndConditions: {
        youthUnemploymentRate: 12,
        femaleParticipationRate: 60,
        genderPayGap: 15,
        unionizationRate: 25,
        workplaceSafetyIndex: 85,
        averageCommutingTime: 30
      },
      regionalEmployment: {
        urban: {
          participationRate: 70,
          unemploymentRate: 5,
          averageIncome: country.currentGdpPerCapita * 1.1
        },
        rural: {
          participationRate: 55,
          unemploymentRate: 8,
          averageIncome: country.currentGdpPerCapita * 0.7
        }
      },
      socialProtection: {
        unemploymentBenefitCoverage: 80,
        pensionCoverage: 95,
        healthInsuranceCoverage: 90,
        paidSickLeaveDays: 10,
        paidVacationDays: 20,
        parentalLeaveWeeks: 16
      }
    };

    const fiscalData: FiscalSystemData = {
      taxRevenueGDPPercent: 25,
      governmentRevenueTotal: country.currentTotalGdp * 0.25,
      taxRevenuePerCapita: country.currentGdpPerCapita * 0.25,
      governmentBudgetGDPPercent: 28,
      budgetDeficitSurplus: -country.currentTotalGdp * 0.03,
      internalDebtGDPPercent: 40,
      externalDebtGDPPercent: 20,
      totalDebtGDPRatio: 60,
      debtPerCapita: country.currentGdpPerCapita * 0.6,
      interestRates: 0.03,
      debtServiceCosts: country.currentTotalGdp * 0.02,
      taxRates: {
        personalIncomeTaxRates: [
          { bracket: 0, rate: 10 },
          { bracket: 50000, rate: 20 },
          { bracket: 100000, rate: 30 },
          { bracket: 200000, rate: 40 }
        ],
        corporateTaxRates: [
          { size: "Small", rate: 15 },
          { size: "Medium", rate: 20 },
          { size: "Large", rate: 25 }
        ],
        salesTaxRate: 8,
        propertyTaxRate: 1.5,
        payrollTaxRate: 7.5,
        exciseTaxRates: [],
        wealthTaxRate: 0.5
      },
      governmentSpendingByCategory: [
        { category: "Healthcare", amount: country.currentTotalGdp * 0.06, percent: 20, color: "#3b82f6" },
        { category: "Education", amount: country.currentTotalGdp * 0.05, percent: 18, color: "#10b981" },
        { category: "Defense", amount: country.currentTotalGdp * 0.04, percent: 15, color: "#ef4444" },
        { category: "Social Security", amount: country.currentTotalGdp * 0.07, percent: 25, color: "#8b5cf6" }
      ]
    };

    const spendingData: GovernmentSpendingData = {
      education: country.currentTotalGdp * 0.05,
      healthcare: country.currentTotalGdp * 0.06,
      socialSafety: country.currentTotalGdp * 0.07,
      totalSpending: country.currentTotalGdp * 0.28,
      spendingGDPPercent: 28,
      spendingPerCapita: country.currentGdpPerCapita * 0.28,
      deficitSurplus: -country.currentTotalGdp * 0.03,
      spendingCategories: [
        { category: "Healthcare", amount: country.currentTotalGdp * 0.06, percent: 21, color: "#3b82f6" },
        { category: "Education", amount: country.currentTotalGdp * 0.05, percent: 18, color: "#10b981" },
        { category: "Defense", amount: country.currentTotalGdp * 0.04, percent: 14, color: "#ef4444" },
        { category: "Social Security", amount: country.currentTotalGdp * 0.07, percent: 25, color: "#8b5cf6" },
        { category: "Infrastructure", amount: country.currentTotalGdp * 0.03, percent: 11, color: "#f59e0b" },
        { category: "Other", amount: country.currentTotalGdp * 0.03, percent: 11, color: "#6b7280" }
      ],
      performanceBasedBudgeting: true,
      universalBasicServices: false,
      greenInvestmentPriority: true,
      digitalGovernmentInitiative: true
    };

    return {
      core: coreIndicators,
      demographics: demographicsData,
      labor: laborData,
      fiscal: fiscalData,
      spending: spendingData
    };
  }, [country]);

  // Enhanced profile data transformation
  const enhancedCountryData: EnhancedCountryProfileData | null = useMemo(() => {
    if (!country) return null;

    try {
      return SocialProfileTransformer.transformCountryData(
        {
          ...country,
          landArea: country.landArea ?? undefined,
          populationDensity: country.populationDensity ?? undefined,
          gdpDensity: country.gdpDensity ?? undefined,
          continent: country.continent ?? undefined,
          region: country.region ?? undefined,
          governmentType: country.governmentType ?? undefined,
          leader: country.leader ?? undefined,
          religion: country.religion ?? undefined
        },
        flagUrl || undefined,
        unsplashImageUrl
      );
    } catch (error) {
      console.error('Error transforming country data for enhanced profile:', error);
      return null;
    }
  }, [country, flagUrl, unsplashImageUrl]);

  // Calculate vitality rings data (public-facing metrics)
  const vitalityData = useMemo(() => {
    if (!country) return { economicVitality: 0, populationWellbeing: 0, diplomaticStanding: 0, governmentalEfficiency: 0 };

    // Economic Vitality (based on GDP per capita and growth)
    const economicTierScore = {
      "Extravagant": 95,
      "Very Strong": 85,
      "Strong": 75,
      "Healthy": 65,
      "Developed": 50,
      "Developing": 35,
    }[country.economicTier] || 25;

    const gdpGrowthBonus = Math.min(20, Math.max(-20, (country.adjustedGdpGrowth ?? 0) * 400));
    const economicVitality = Math.min(100, Math.max(0, economicTierScore + gdpGrowthBonus));

    // Population Wellbeing (based on population growth and density)
    const popGrowthHealth = (country.populationGrowthRate ?? 0) > 0 ? 70 : 40;
    const densityFactor = country.populationDensity
      ? Math.max(50, 100 - (country.populationDensity / 500))
      : 60;
    const populationWellbeing = (popGrowthHealth + densityFactor) / 2;

    // Diplomatic Standing (simplified for public view)
    const diplomaticStanding = 60; // Placeholder - would come from diplomatic relations

    // Governmental Efficiency (based on economic tier as proxy)
    const governmentalEfficiency = economicTierScore * 0.8;

    return {
      economicVitality,
      populationWellbeing,
      diplomaticStanding,
      governmentalEfficiency
    };
  }, [country]);

  // Prepare metrics for CountryMetricsGrid
  const countryMetrics = useMemo(() => {
    if (!country) return [];

    return [
      {
        label: 'Population',
        value: `${((country.currentPopulation || 0) / 1000000).toFixed(1)}M`,
        subtext: `${(country.currentPopulation || 0).toLocaleString()} citizens`,
        colorClass: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600',
        tooltip: {
          title: 'Current Population',
          details: [
            `Total: ${(country.currentPopulation || 0).toLocaleString()} citizens`,
            `Population Tier: ${country.populationTier || "Unknown"}`
          ]
        }
      },
      {
        label: 'GDP/Capita',
        value: `$${((country.currentGdpPerCapita || 0) / 1000).toFixed(0)}k`,
        subtext: `$${(country.currentGdpPerCapita || 0).toLocaleString()} per person`,
        colorClass: 'bg-green-50 dark:bg-green-950/50 text-green-600',
        tooltip: {
          title: 'GDP per Capita',
          details: [
            `$${(country.currentGdpPerCapita || 0).toLocaleString()} per person`,
            'Economic strength indicator'
          ]
        }
      },
      {
        label: 'Growth',
        value: `${((country.adjustedGdpGrowth || 0) * 100).toFixed(2)}%`,
        subtext: 'Adjusted GDP growth rate',
        colorClass: 'bg-purple-50 dark:bg-purple-950/50 text-purple-600',
        tooltip: {
          title: 'Economic Growth Rate',
          details: [
            'Adjusted GDP growth rate after global factors',
            (country.adjustedGdpGrowth || 0) > 0.05 ? "Strong growth" :
            (country.adjustedGdpGrowth || 0) > 0.02 ? "Moderate growth" :
            (country.adjustedGdpGrowth || 0) > 0 ? "Slow growth" : "Declining"
          ]
        }
      },
      {
        label: 'Economic Tier',
        value: country.economicTier || "Unknown",
        subtext: 'Development classification',
        colorClass: 'bg-orange-50 dark:bg-orange-950/50 text-orange-600',
        tooltip: {
          title: 'Economic Development Tier',
          details: [
            'Based on GDP per capita and economic indicators',
            `Current classification: ${country.economicTier || "Unknown"}`
          ]
        }
      },
      {
        label: 'Total GDP',
        value: `$${((country.currentTotalGdp || 0) / 1000000000).toFixed(1)}B`,
        subtext: 'National economic output',
        colorClass: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600',
        tooltip: {
          title: 'Total GDP',
          details: [
            `$${(country.currentTotalGdp || 0).toLocaleString()}`,
            'Total national economic output'
          ]
        }
      },
      {
        label: 'Land Area',
        value: country.landArea ? `${(country.landArea / 1000).toFixed(0)}k km²` : 'N/A',
        subtext: country.landArea ? `${country.landArea.toLocaleString()} km²` : 'Not available',
        colorClass: 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600',
        tooltip: {
          title: 'Territory',
          details: [
            country.landArea ? `${country.landArea.toLocaleString()} km²` : 'Data not available',
            country.populationDensity ? `Density: ${Math.round(country.populationDensity)}/km²` : 'Density: N/A'
          ]
        }
      }
    ];
  }, [country]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-1/2 mb-4" />
        <Skeleton className="h-4 w-1/4 mb-8" />
        <div className="space-y-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-96 lg:col-span-2 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 border-destructive/50">
          <div className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            <div>
              <h3 className="font-semibold">Error Loading Country Data</h3>
              <p className="text-sm text-muted-foreground">{error.message}</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!country) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">Country Not Found</h3>
          <p className="text-muted-foreground">The requested country could not be found.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section with Header Image */}
      <div className="relative w-full h-64 md:h-80 lg:h-96 overflow-hidden">
        {unsplashImageUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${unsplashImageUrl})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-background" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
          </div>
        )}

        {/* Country Header Content */}
        <div className="relative container mx-auto px-4 h-full flex flex-col justify-end pb-8">
          <div className="flex items-end gap-4 md:gap-6">
            {/* Flag */}
            <div className="flex-shrink-0 mb-2">
              <UnifiedCountryFlag
                countryName={country.name}
                size="xl"
                flagUrl={flagUrl}
                isLoading={flagLoading}
                rounded={true}
                shadow={true}
                border={true}
                className="w-20 h-20 md:w-24 md:h-24 lg:w-32 lg:h-32"
              />
            </div>

            {/* Country Name and Basic Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white drop-shadow-lg mb-2">
                {country.name.replace(/_/g, ' ')}
              </h1>
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                {/* Population Badge - Clickable to toggle between formatted and full */}
                <Badge
                  className="bg-blue-600/90 backdrop-blur-sm text-white border-blue-400/30 font-semibold cursor-pointer hover:bg-blue-500/90 transition-colors"
                  onClick={() => setShowFullPopulation(!showFullPopulation)}
                >
                  <Users className="h-3 w-3 mr-1.5" />
                  {showFullPopulation
                    ? country.currentPopulation.toLocaleString()
                    : formatPopulation(country.currentPopulation)
                  }
                </Badge>

                {/* GDP Badge - Clickable to toggle between per capita and total */}
                <Badge
                  className="bg-green-600/90 backdrop-blur-sm text-white border-green-400/30 font-semibold cursor-pointer hover:bg-green-500/90 transition-colors"
                  onClick={() => setShowGdpPerCapita(!showGdpPerCapita)}
                >
                  <TrendingUp className="h-3 w-3 mr-1.5" />
                  {showGdpPerCapita
                    ? `${formatCurrency(country.currentGdpPerCapita)}/capita`
                    : formatCurrency(country.currentTotalGdp)
                  }
                </Badge>

                {/* Land Area Badge */}
                {country.landArea && (
                  <Badge className="bg-purple-600/90 backdrop-blur-sm text-white border-purple-400/30 font-semibold">
                    <MapPin className="h-3 w-3 mr-1.5" />
                    {country.landArea.toLocaleString()} km²
                  </Badge>
                )}

                {/* Growth Rate Badge */}
                <Badge className={`backdrop-blur-sm text-white font-semibold ${
                  (country.adjustedGdpGrowth ?? 0) > 0
                    ? 'bg-emerald-600/90 border-emerald-400/30'
                    : 'bg-red-600/90 border-red-400/30'
                }`}>
                  <Activity className="h-3 w-3 mr-1.5" />
                  {((country.adjustedGdpGrowth ?? 0) * 100).toFixed(2)}% growth
                </Badge>

                {/* Continent Badge */}
                {country.continent && (
                  <Badge variant="outline" className="bg-black/30 backdrop-blur-sm text-white border-white/20">
                    <Globe className="h-3 w-3 mr-1" />
                    {country.continent}
                  </Badge>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-end gap-2 flex-shrink-0">
              <Button
                size="lg"
                variant={isOwnCountry ? "default" : "outline"}
                onClick={() => setShowCountryActions(true)}
                className={isOwnCountry
                  ? "shadow-lg"
                  : "shadow-lg bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm"
                }
              >
                <Users className="h-4 w-4 mr-2" />
                <span className="hidden md:inline">
                  {isOwnCountry ? "Country Management" : "Country Actions"}
                </span>
                <span className="md:hidden">Actions</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={createUrl("/countries")}>Countries</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{country.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Tab Navigation */}
        <div className="glass-hierarchy-child rounded-lg p-1 flex gap-1 overflow-x-auto">
          <Button
            variant={activeTab === 'overview' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('overview')}
            className="flex-1 min-w-[120px]"
          >
            <Eye className="h-4 w-4 mr-2" />
            Overview
          </Button>
          <Button
            variant={activeTab === 'mycountry' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('mycountry')}
            className="flex-1 min-w-[120px]"
          >
            <Crown className="h-4 w-4 mr-2" />
            MyCountry
          </Button>
          <Button
            variant={activeTab === 'lore' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('lore')}
            className="flex-1 min-w-[120px]"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Lore & History
          </Button>
          <Button
            variant={activeTab === 'diplomatic' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('diplomatic')}
            className="flex-1 min-w-[120px]"
          >
            <Rss className="h-4 w-4 mr-2" />
            ThinkPages
          </Button>
          <Button
            variant={activeTab === 'diplomacy' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('diplomacy')}
            className="flex-1 min-w-[120px]"
          >
            <Building className="h-4 w-4 mr-2" />
            Diplomacy
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Single Scrollable Overview Page - No Sub-tabs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content - MyCountry Public Data */}
                <div className="lg:col-span-2 space-y-6">

                  {/* Wiki Overview Section - Historical Background */}
                  {wikiIntro.length > 0 && (
                    <Card className="backdrop-blur-sm bg-card/50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <BookOpen className="h-5 w-5" />
                          About {country.name.replace(/_/g, ' ')}
                        </CardTitle>
                        <CardDescription>Historical overview and background</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Text content - 2 columns */}
                          <div className="md:col-span-2">
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              {/* First paragraph - always visible */}
                              <p
                                className="mb-3 text-sm leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: wikiIntro[0] }}
                              />

                              {/* Additional paragraphs - collapsible */}
                              {wikiIntro.length > 1 && (
                                <>
                                  {showFullWikiIntro && (
                                    <div className="space-y-3">
                                      {wikiIntro.slice(1).map((paragraph, idx) => (
                                        <p
                                          key={idx}
                                          className="mb-3 text-sm leading-relaxed"
                                          dangerouslySetInnerHTML={{ __html: paragraph }}
                                        />
                                      ))}
                                    </div>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowFullWikiIntro(!showFullWikiIntro)}
                                    className="mt-2 text-primary hover:text-primary/80"
                                  >
                                    {showFullWikiIntro ? (
                                      <>Show less</>
                                    ) : (
                                      <>See more ({wikiIntro.length - 1} more paragraph{wikiIntro.length > 2 ? 's' : ''})</>
                                    )}
                                  </Button>
                                </>
                              )}
                            </div>
                            <div className="mt-4 pt-4 border-t">
                              <a
                                href={`https://ixwiki.com/wiki/${country.name}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline flex items-center gap-2"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Read more on IxWiki
                              </a>
                            </div>
                          </div>

                          {/* National Symbols - 1 column */}
                          {wikiInfobox && (wikiInfobox.image_flag || wikiInfobox.flag || wikiInfobox.image_coat) && (
                            <div className="space-y-4">
                              <div>
                                <h3 className="text-lg font-semibold mb-4">National Symbols</h3>
                              </div>
                              {(wikiInfobox.image_flag || wikiInfobox.flag) && (
                                <div className="flex items-center gap-3 p-3 bg-blue-500/10 rounded-lg">
                                  <img
                                    src={`https://ixwiki.com/wiki/Special:Filepath/${wikiInfobox.image_flag || wikiInfobox.flag}`}
                                    alt="National Flag"
                                    className="w-16 h-10 rounded shadow-md object-cover"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                  <div className="flex-1">
                                    <p className="text-xs text-muted-foreground mb-1">National Flag</p>
                                    <p className="text-sm font-medium">Official Symbol</p>
                                  </div>
                                </div>
                              )}
                              {(wikiInfobox.image_coat || wikiInfobox.coat_of_arms) && (
                                <div className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-lg">
                                  <img
                                    src={`https://ixwiki.com/wiki/Special:Filepath/${wikiInfobox.image_coat || wikiInfobox.coat_of_arms}`}
                                    alt="Coat of Arms"
                                    className="w-12 h-12 rounded shadow-md object-cover"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                  <div className="flex-1">
                                    <p className="text-xs text-muted-foreground mb-1">Coat of Arms</p>
                                    <p className="text-sm font-medium">State Emblem</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Government & National Identity (DB-backed with graceful fallbacks) */}
                  <Card className="backdrop-blur-sm bg-card/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building className="h-5 w-5" />
                        Government & National Identity
                      </CardTitle>
                      <CardDescription>Live government structure (builder) and identity from the database</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {(governmentStructure?.governmentName || country?.nationalIdentity?.officialName) && (
                          <div className="flex items-start gap-3">
                            <Building className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Government</p>
                              <p className="font-semibold">{governmentStructure?.governmentName || country?.nationalIdentity?.officialName}</p>
                            </div>
                          </div>
                        )}

                        {(governmentStructure?.governmentType || country?.governmentType || country?.nationalIdentity?.governmentType) && (
                          <div className="flex items-start gap-3">
                            <Crown className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Government Type</p>
                              <p className="font-semibold">{governmentStructure?.governmentType || country?.governmentType || country?.nationalIdentity?.governmentType}</p>
                            </div>
                          </div>
                        )}

                        {(governmentStructure?.headOfState || country?.leader) && (
                          <div className="flex items-start gap-3">
                            <Users className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Head of State</p>
                              <p className="font-semibold">{governmentStructure?.headOfState || country?.leader}</p>
                            </div>
                          </div>
                        )}

                        {governmentStructure?.headOfGovernment && (
                          <div className="flex items-start gap-3">
                            <Users className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Head of Government</p>
                              <p className="font-semibold">{governmentStructure.headOfGovernment}</p>
                            </div>
                          </div>
                        )}

                        {(country?.nationalIdentity?.capitalCity || wikiInfobox?.capital) && (
                          <div className="flex items-start gap-3">
                            <MapPin className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Capital</p>
                              <p className="font-semibold">{country?.nationalIdentity?.capitalCity || wikiInfobox?.capital}</p>
                            </div>
                          </div>
                        )}

                        {country?.religion && (
                          <div className="flex items-start gap-3">
                            <Heart className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Religion</p>
                              <p className="font-semibold">{country.religion}</p>
                            </div>
                          </div>
                        )}

                        {(country?.nationalIdentity?.currency || wikiInfobox?.currency) && (
                          <div className="flex items-start gap-3">
                            <Globe className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Currency</p>
                              <p className="font-semibold">
                                {country?.nationalIdentity?.currency || wikiInfobox?.currency}
                                {country?.nationalIdentity?.currencySymbol ? ` (${country.nationalIdentity.currencySymbol})` : ''}
                              </p>
                            </div>
                          </div>
                        )}

                        {governmentStructure?.legislatureName && (
                          <div className="flex items-start gap-3">
                            <Building className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Legislature</p>
                              <p className="font-semibold">{governmentStructure.legislatureName}</p>
                            </div>
                          </div>
                        )}

                        {governmentStructure?.executiveName && (
                          <div className="flex items-start gap-3">
                            <Building className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Executive</p>
                              <p className="font-semibold">{governmentStructure.executiveName}</p>
                            </div>
                          </div>
                        )}

                        {governmentStructure?.judicialName && (
                          <div className="flex items-start gap-3">
                            <Building className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Judiciary</p>
                              <p className="font-semibold">{governmentStructure.judicialName}</p>
                            </div>
                          </div>
                        )}

                        {(typeof governmentStructure?.totalBudget === 'number') && (
                          <div className="flex items-start gap-3">
                            <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Total Budget</p>
                              <p className="font-semibold">
                                {governmentStructure!.totalBudget!.toLocaleString('en-US', { style: 'currency', currency: (governmentStructure?.budgetCurrency || 'USD') as any, maximumFractionDigits: 0 })}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {(country?.nationalIdentity?.motto || wikiInfobox?.motto) && (
                        <div className="mt-6 pt-6 border-t">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                            National Motto
                          </p>
                          <p className="text-base italic text-muted-foreground border-l-4 border-primary/30 pl-4">
                            &ldquo;{country?.nationalIdentity?.motto || wikiInfobox?.motto}&rdquo;
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Recent Activity Feed - NEW */}
                  <Card className="backdrop-blur-sm bg-card/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Recent Activity
                      </CardTitle>
                      <CardDescription>Latest developments and updates</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3 pb-3 border-b border-border/50">
                          <div className="w-2 h-2 rounded-full bg-blue-400 mt-2"></div>
                          <div className="flex-1">
                            <p className="text-sm">Economic data updated</p>
                            <p className="text-xs text-muted-foreground">
                              {country.lastCalculated && new Date(country.lastCalculated).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {wikiInfobox && (
                          <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-green-400 mt-2"></div>
                            <div className="flex-1">
                              <p className="text-sm">Wiki profile connected</p>
                              <p className="text-xs text-muted-foreground">Live data from IxWiki</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Navigation Card */}
                  <Card className="backdrop-blur-sm bg-card/50 border-primary/20">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <h3 className="font-semibold mb-3">Explore {country.name.replace(/_/g, ' ')}</h3>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTab('mycountry')}
                            className="w-full justify-start"
                          >
                            <Crown className="h-3 w-3 mr-2" />
                            MyCountry
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTab('lore')}
                            className="w-full justify-start"
                          >
                            <BookOpen className="h-3 w-3 mr-2" />
                            Lore
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTab('diplomatic')}
                            className="w-full justify-start"
                          >
                            <Rss className="h-3 w-3 mr-2" />
                            Open in IxMaps
                          </Button>
                          <a
                            href={`https://ixwiki.com/wiki/${country.name}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full"
                          >
                            <Button variant="outline" size="sm" className="w-full justify-start">
                              <ExternalLink className="h-3 w-3 mr-2" />
                              Open in Wiki
                            </Button>
                          </a>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

            {/* Sidebar - National Vitality Rings */}
            <div className="space-y-6">
              {/* National Vitality */}
              <VitalityRings data={vitalityData} variant="sidebar" />
            </div>
          </div>
        </div>
        )}

        {/* MyCountry Tab - Public Economic Data (All Visitors) */}
        {activeTab === 'mycountry' && country && economicsData && (
          <div className="space-y-6" key={`mycountry-${country.id}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Public Economic Profile</h2>
                <p className="text-muted-foreground">
                  {isOwnCountry
                    ? "Public economic data visible to all countries"
                    : "Public economic information about this country"
                  }
                </p>
              </div>
              {isOwnCountry && (
                <Link href={createUrl("/mycountry")}>
                  <Button variant="outline" size="sm">
                    <Activity className="h-4 w-4 mr-2" />
                    Manage in Dashboard
                  </Button>
                </Link>
              )}
            </div>

            {/* Overview (At a Glance) */}
            <div>
              <CountryAtGlance
                country={{
                  id: country.id,
                  name: country.name,
                  continent: country.continent ?? null,
                  region: country.region ?? null,
                  governmentType: country.governmentType ?? null,
                  religion: country.religion ?? null,
                  leader: country.leader ?? null,
                  landArea: country.landArea ?? null,
                  currentPopulation: country.currentPopulation,
                  currentGdpPerCapita: country.currentGdpPerCapita,
                  currentTotalGdp: country.currentTotalGdp,
                  populationGrowthRate: country.populationGrowthRate ?? 0,
                  adjustedGdpGrowth: country.adjustedGdpGrowth ?? 0,
                  maxGdpGrowthRate: 0.05,
                  populationDensity: country.populationDensity ?? null,
                  gdpDensity: country.gdpDensity ?? null,
                  economicTier: country.economicTier,
                  populationTier: country.populationTier,
                  lastCalculated: (country as any).lastCalculated instanceof Date ? (country as any).lastCalculated.getTime() : ((country as any).lastCalculated ?? Date.now()),
                  baselineDate: (country as any).baselineDate instanceof Date ? (country as any).baselineDate.getTime() : ((country as any).baselineDate ?? Date.now()),
                  localGrowthFactor: 1.0,
                  nationalIdentity: (country as any).nationalIdentity || null,
                }}
                currentIxTime={currentIxTime}
                isLoading={false}
              />
            </div>

            {/* Government Overview (public, read-only) */}
            <Card className="backdrop-blur-sm bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Government & National Identity
                </CardTitle>
                <CardDescription>Live government structure and identity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(governmentStructure?.governmentName || country?.nationalIdentity?.officialName) && (
                    <div className="flex items-start gap-3">
                      <Building className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Government</p>
                        <p className="font-semibold">{governmentStructure?.governmentName || country?.nationalIdentity?.officialName}</p>
                      </div>
                    </div>
                  )}

                  {(governmentStructure?.governmentType || country?.governmentType || country?.nationalIdentity?.governmentType) && (
                    <div className="flex items-start gap-3">
                      <Crown className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Government Type</p>
                        <p className="font-semibold">{governmentStructure?.governmentType || country?.governmentType || country?.nationalIdentity?.governmentType}</p>
                      </div>
                    </div>
                  )}

                  {(governmentStructure?.headOfState || country?.leader) && (
                    <div className="flex items-start gap-3">
                      <Users className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Head of State</p>
                        <p className="font-semibold">{governmentStructure?.headOfState || country?.leader}</p>
                      </div>
                    </div>
                  )}

                  {governmentStructure?.headOfGovernment && (
                    <div className="flex items-start gap-3">
                      <Users className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Head of Government</p>
                        <p className="font-semibold">{governmentStructure.headOfGovernment}</p>
                      </div>
                    </div>
                  )}

                  {(country?.nationalIdentity?.capitalCity || wikiInfobox?.capital) && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Capital</p>
                        <p className="font-semibold">{country?.nationalIdentity?.capitalCity || wikiInfobox?.capital}</p>
                      </div>
                    </div>
                  )}

                  {country?.religion && (
                    <div className="flex items-start gap-3">
                      <Heart className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Religion</p>
                        <p className="font-semibold">{country.religion}</p>
                      </div>
                    </div>
                  )}

                  {(country?.nationalIdentity?.currency || wikiInfobox?.currency) && (
                    <div className="flex items-start gap-3">
                      <Globe className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Currency</p>
                        <p className="font-semibold">
                          {country?.nationalIdentity?.currency || wikiInfobox?.currency}
                          {country?.nationalIdentity?.currencySymbol ? ` (${country.nationalIdentity.currencySymbol})` : ''}
                        </p>
                      </div>
                    </div>
                  )}

                  {governmentStructure?.legislatureName && (
                    <div className="flex items-start gap-3">
                      <Building className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Legislature</p>
                        <p className="font-semibold">{governmentStructure.legislatureName}</p>
                      </div>
                    </div>
                  )}

                  {governmentStructure?.executiveName && (
                    <div className="flex items-start gap-3">
                      <Building className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Executive</p>
                        <p className="font-semibold">{governmentStructure.executiveName}</p>
                      </div>
                    </div>
                  )}

                  {governmentStructure?.judicialName && (
                    <div className="flex items-start gap-3">
                      <Building className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Judiciary</p>
                        <p className="font-semibold">{governmentStructure.judicialName}</p>
                      </div>
                    </div>
                  )}
                </div>

                {(country?.nationalIdentity?.motto || wikiInfobox?.motto) && (
                  <div className="mt-6 pt-6 border-t">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                      National Motto
                    </p>
                    <p className="text-base italic text-muted-foreground border-l-4 border-primary/30 pl-4">
                      &ldquo;{country?.nationalIdentity?.motto || wikiInfobox?.motto}&rdquo;
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Public Economic Data */}
            {!isMounted ? (
              <Card className="backdrop-blur-sm bg-card/50">
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">Loading economic analysis...</div>
                </CardContent>
              </Card>
            ) : (
              <Card className="backdrop-blur-sm bg-card/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building className="h-5 w-5" />
                        Economic Analysis
                      </CardTitle>
                      <CardDescription>Detailed public economic data and analysis</CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                      READ-ONLY
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Tabs defaultValue="fiscal" className="w-full" key={`tabs-${country.id}`}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="fiscal">Fiscal & Revenue</TabsTrigger>
                      <TabsTrigger value="spending">Government</TabsTrigger>
                      <TabsTrigger value="labor">Labor & Demographics</TabsTrigger>
                    </TabsList>

                    <TabsContent value="fiscal" className="space-y-4">
                      {economicsData?.fiscal ? (
                        <Suspense fallback={<div className="text-center py-8 text-muted-foreground">Loading fiscal data...</div>}>
                          <FiscalSystemComponent
                            fiscalData={economicsData.fiscal}
                            nominalGDP={country.currentTotalGdp}
                            totalPopulation={country.currentPopulation}
                            countryId={country.id}
                            onFiscalDataChange={() => {}}
                            isReadOnly={true}
                          />
                        </Suspense>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          Loading fiscal data...
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="spending" className="space-y-4">
                      {economicsData?.spending ? (
                        <Suspense fallback={<div className="text-center py-8 text-muted-foreground">Loading spending data...</div>}>
                          <GovernmentSpending
                            {...economicsData.spending}
                            nominalGDP={country.currentTotalGdp}
                            totalPopulation={country.currentPopulation}
                            onSpendingDataChangeAction={() => {}}
                            isReadOnly={true}
                          />
                        </Suspense>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          Loading spending data...
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="labor" className="space-y-4">
                      <div className="space-y-4">
                        {economicsData?.demographics && economicsData?.labor ? (
                          <Suspense fallback={<div className="text-center py-8 text-muted-foreground">Loading labor and demographic data...</div>}>
                            <>
                              <Demographics
                                demographicData={economicsData.demographics}
                                totalPopulation={country.currentPopulation}
                                onDemographicDataChangeAction={() => {}}
                                isReadOnly={true}
                                showComparison={false}
                              />
                              <LaborEmployment
                                laborData={economicsData.labor}
                                totalPopulation={country.currentPopulation}
                                onLaborDataChangeAction={() => {}}
                                isReadOnly={true}
                                showComparison={false}
                              />
                            </>
                          </Suspense>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            Loading labor and demographic data...
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {/* Owner Call to Action */}
            {isOwnCountry && (
              <Alert className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/30">
                <Activity className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-amber-900 dark:text-amber-100">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <span className="text-sm">This tab shows read-only public economic data. To manage your country and access private features, use the full MyCountry dashboard.</span>
                    <Link href={createUrl("/mycountry")}>
                      <Button size="sm" variant="default" className="whitespace-nowrap">
                        Open Full Dashboard
                      </Button>
                    </Link>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Lore & History Tab - Pure Narrative Content */}
        {activeTab === 'lore' && country && (
          <WikiIntelligenceTab
            countryName={country.name}
            countryData={{
              currentPopulation: country.currentPopulation,
              currentGdpPerCapita: country.currentGdpPerCapita,
              currentTotalGdp: country.currentTotalGdp,
              economicTier: country.economicTier,
              continent: country.continent ?? undefined,
              region: country.region ?? undefined,
              governmentType: country.governmentType ?? undefined,
              leader: country.leader ?? undefined,
              religion: country.religion ?? undefined,
            }}
            viewerClearanceLevel={isOwnCountry ? 'CONFIDENTIAL' : 'PUBLIC'}
          />
        )}

        {/* ThinkPages Tab - Country's Social Posts */}
        {activeTab === 'diplomatic' && country && (
          <ThinkpagesSocialPlatform
            countryId={country.id}
            countryName={country.name}
            isOwner={!!isOwnCountry}
          />
        )}

        {/* Diplomacy Tab - Diplomatic Operations */}
        {activeTab === 'diplomacy' && country && (
          <div className="space-y-6">
            {/* Header with Diplomatic Actions Button */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Diplomatic Network</h2>
                <p className="text-muted-foreground">
                  Embassy network, secure channels, and cultural exchanges
                </p>
              </div>
              {!isOwnCountry && (
                <Button
                  onClick={() => setShowDiplomaticActions(true)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Diplomatic Actions
                </Button>
              )}
            </div>

            {/* Diplomatic Actions Modal */}
            <InlineDiplomaticActions
              viewerCountryId={userProfile?.countryId ?? undefined}
              viewerCountryName={userProfile?.country?.name ?? undefined}
              targetCountryId={country.id}
              targetCountryName={country.name}
              isOwner={!!isOwnCountry}
              isOpen={showDiplomaticActions}
              onClose={() => setShowDiplomaticActions(false)}
            />

            {/* Sub-Tabs for Diplomacy Section */}
            <div className="flex gap-2 border-b">
              <Button
                variant={activeDiplomacyTab === 'embassy-network' ? 'default' : 'ghost'}
                onClick={() => setActiveDiplomacyTab('embassy-network')}
                className="rounded-b-none"
              >
                <Building className="h-4 w-4 mr-2" />
                Embassy Network
              </Button>
              <Button
                variant={activeDiplomacyTab === 'secure-channels' ? 'default' : 'ghost'}
                onClick={() => setActiveDiplomacyTab('secure-channels')}
                className="rounded-b-none"
              >
                <Globe className="h-4 w-4 mr-2" />
                Secure Channels
              </Button>
              <Button
                variant={activeDiplomacyTab === 'cultural-exchange' ? 'default' : 'ghost'}
                onClick={() => setActiveDiplomacyTab('cultural-exchange')}
                className="rounded-b-none"
              >
                <Heart className="h-4 w-4 mr-2" />
                Cultural Exchange
              </Button>
            </div>

            {/* Embassy Network */}
            {activeDiplomacyTab === 'embassy-network' && (
              <EnhancedEmbassyNetwork
                countryId={country.id}
                countryName={country.name}
                isOwner={!!isOwnCountry}
              />
            )}

            {/* Secure Diplomatic Channels */}
            {activeDiplomacyTab === 'secure-channels' && (
              <SecureDiplomaticChannels
                currentCountryId={country.id}
                currentCountryName={country.name}
                channels={[]}
                messages={[]}
              />
            )}

            {/* Cultural Exchange Program */}
            {activeDiplomacyTab === 'cultural-exchange' && (
              <CulturalExchangeProgram
                primaryCountry={{
                  id: country.id,
                  name: country.name,
                  flagUrl: flagUrl ?? undefined,
                  economicTier: country.economicTier ?? undefined
                }}
                exchanges={[]}
              />
            )}
          </div>
        )}
      </div>

      {/* Country Actions Menu Modal */}
      {country && (
        <CountryActionsMenu
          targetCountryId={country.id}
          targetCountryName={country.name}
          viewerCountryId={userProfile?.countryId ?? undefined}
          isOpen={showCountryActions}
          onClose={() => setShowCountryActions(false)}
          isOwnCountry={!!isOwnCountry}
        />
      )}
    </div>
  );
}