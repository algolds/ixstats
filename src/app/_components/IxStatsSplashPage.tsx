"use client";

import React, { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useUser } from "~/context/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "~/trpc/react";

// UI Components
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Carousel, Card as CarouselCard } from "~/components/ui/apple-cards-carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

// Icons
import {
  Globe,
  TrendingUp,
  Users,
  BarChart3,
  Target,
  Star,
  Crown,
  Activity,
  FileText,
  MessageSquare,
  MessageCircle,
  Zap,
  Shield,
  ArrowRight,
  Sparkles,
  Brain,
  Network,
  Building2,
  Scale,
  Blocks
} from "lucide-react";

// Components
import { InteractiveGridPattern } from "~/components/magicui/interactive-grid-pattern";
import { Marquee } from "~/components/magicui/marquee";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { cn } from "~/lib/utils";
import { ATOMIC_COMPONENTS, ComponentType } from "~/components/government/atoms/AtomicGovernmentComponents";
import { PublicVitalityRings } from "~/components/countries/PublicVitalityRings";
import { ExternalLink } from "lucide-react";
import { createUrl } from "~/lib/url-utils";

// Country showcase card for carousel with vitality rings and wiki intro
function CountryShowcaseCard({ country }: { country: any }) {
  const { flagUrl } = useFlag(country.name);
  const [wikiIntro, setWikiIntro] = React.useState<string>("");
  const [coatOfArmsUrl, setCoatOfArmsUrl] = React.useState<string>("");

  // Fetch wiki intro and coat of arms - first paragraph and a half
  React.useEffect(() => {
    const fetchWikiData = async () => {
      try {
        // Fetch extract and page images
        const apiUrl = `https://ixwiki.com/api.php?action=query&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=original&format=json&titles=${encodeURIComponent(country.name)}`;
        const resp = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'IxStats-Platform',
            'Accept': 'application/json'
          }
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data?.query?.pages) {
            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0];
            const page = pages[pageId];

            if (page && !page.missing) {
              // Extract intro text
              if (page.extract) {
                const paragraphs = page.extract.split('\n\n');
                if (paragraphs.length > 0) {
                  const firstParagraph = paragraphs[0];
                  const secondParagraph = paragraphs[1];
                  if (secondParagraph) {
                    const sentences = secondParagraph.split('. ');
                    const halfSecond = sentences.slice(0, Math.ceil(sentences.length / 2)).join('. ') + (sentences.length > 1 ? '.' : '');
                    setWikiIntro(firstParagraph + '\n\n' + halfSecond);
                  } else {
                    setWikiIntro(firstParagraph);
                  }
                }
              }

              // Try to get coat of arms from page images
              if (page.original?.source) {
                // Check if it might be a coat of arms
                const imageUrl = page.original.source;
                if (imageUrl.toLowerCase().includes('coat') || imageUrl.toLowerCase().includes('coa') || imageUrl.toLowerCase().includes('emblem')) {
                  setCoatOfArmsUrl(imageUrl);
                }
              }
            }
          }
        }

        // Fallback: Try to fetch coat of arms specifically
        if (!coatOfArmsUrl) {
          const coaApiUrl = `https://ixwiki.com/api.php?action=query&prop=images&format=json&titles=${encodeURIComponent(country.name)}`;
          const coaResp = await fetch(coaApiUrl, {
            headers: {
              'User-Agent': 'IxStats-Platform',
              'Accept': 'application/json'
            }
          });

          if (coaResp.ok) {
            const coaData = await coaResp.json();
            if (coaData?.query?.pages) {
              const pages = coaData.query.pages;
              const pageId = Object.keys(pages)[0];
              const page = pages[pageId];

              if (page?.images) {
                // Look for coat of arms in images
                const coaImage = page.images.find((img: any) =>
                  img.title?.toLowerCase().includes('coat') ||
                  img.title?.toLowerCase().includes('coa') ||
                  img.title?.toLowerCase().includes('emblem')
                );

                if (coaImage) {
                  const imageTitle = coaImage.title.replace('File:', '');
                  setCoatOfArmsUrl(`https://ixwiki.com/wiki/Special:Filepath/${encodeURIComponent(imageTitle)}`);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching wiki data:', error);
      }
    };

    fetchWikiData();
  }, [country.name]);

  const wikiUrl = `https://ixwiki.com/wiki/${encodeURIComponent(country.name.replace(/ /g, '_'))}`;
  const ixstatsUrl = `/nation/${country.slug || country.id}`;

  return (
    <div className="relative w-full h-full p-8 overflow-y-auto">
      {/* Flag background */}
      {flagUrl && (
        <div className="absolute inset-0 opacity-10">
          <img src={flagUrl} alt={country.name} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="relative z-10 space-y-6">
        {/* Header with COA */}
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h3 className="text-4xl font-bold text-white mb-2">{country.name.replace(/_/g, ' ')}</h3>
            <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
              {country.economicTier}
            </Badge>
          </div>
          {/* Coat of Arms */}
          {coatOfArmsUrl && (
            <div className="w-20 h-20 glass-hierarchy-child rounded-xl p-2 flex items-center justify-center">
              <img
                src={coatOfArmsUrl}
                alt={`${country.name} coat of arms`}
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </div>

        {/* Wiki Intro - First Paragraph and a Half */}
        {wikiIntro && (
          <div className="glass-hierarchy-child p-4 rounded-xl space-y-3">
            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-line">{wikiIntro}</p>
            <div className="flex items-center gap-4">
              <a
                href={wikiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Read more on IxWiki
              </a>
              <Link
                href={ixstatsUrl}
                className="inline-flex items-center gap-2 text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
              >
                <BarChart3 className="h-3 w-3" />
                View in IxStats
              </Link>
            </div>
          </div>
        )}

        {/* Vitality Rings - Using actual component */}
        <div className="scale-90 origin-center">
          <PublicVitalityRings
            country={{
              name: country.name,
              currentGdpPerCapita: country.currentGdpPerCapita || 0,
              currentTotalGdp: country.currentTotalGdp || 0,
              currentPopulation: country.currentPopulation || 0,
              populationGrowthRate: country.populationGrowthRate,
              adjustedGdpGrowth: country.adjustedGdpGrowth,
              economicTier: country.economicTier || 'Unknown',
              populationTier: country.populationTier,
              populationDensity: country.populationDensity,
              landArea: country.landArea,
              continent: country.continent,
              region: country.region
            }}
          />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-hierarchy-child p-3 rounded-xl text-center">
            <div className="text-xs text-gray-400 mb-1">Total GDP</div>
            <div className="text-sm font-bold text-green-400">{formatCurrency(country.currentTotalGdp)}</div>
          </div>
          <div className="glass-hierarchy-child p-3 rounded-xl text-center">
            <div className="text-xs text-gray-400 mb-1">Population</div>
            <div className="text-sm font-bold text-blue-400">{formatPopulation(country.currentPopulation)}</div>
          </div>
          <div className="glass-hierarchy-child p-3 rounded-xl text-center">
            <div className="text-xs text-gray-400 mb-1">Per Capita</div>
            <div className="text-sm font-bold text-yellow-400">{formatCurrency(country.currentGdpPerCapita)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function IxStatsSplashPage() {
  const { user } = useUser();
  const router = useRouter();

  // Fetch live data
  const { data: countriesData } = api.countries.getAll.useQuery();
  const { data: globalStats } = api.countries.getGlobalStats.useQuery();

  // Prefetch flags for top countries in the background
  useEffect(() => {
    if (countriesData?.countries && countriesData.countries.length > 0) {
      const topCountryNames = countriesData.countries
        .slice(0, 20) // Just prefetch top 20 for splash page
        .map(c => c.name);
      console.log(`[SplashPage] Prefetching ${topCountryNames.length} top country flags`);
      import('~/lib/unified-flag-service').then(({ unifiedFlagService }) => {
        unifiedFlagService.prefetchFlags(topCountryNames);
      });
    }
  }, [countriesData]);

  // Prepare top countries for carousel
  const topCountries = useMemo(() => {
    if (!countriesData?.countries) return [];
    return [...countriesData.countries]
      .sort((a, b) => (b.currentTotalGdp || 0) - (a.currentTotalGdp || 0))
      .slice(0, 6);
  }, [countriesData]);

  // Country card component that uses the flag hook
  const CountryCarouselCard = ({ country, index }: { country: any; index: number }) => {
    const { flagUrl } = useFlag(country.name);

    return (
      <CarouselCard
        card={{
          src: flagUrl || '/api/placeholder/800/1200',
          title: country.name.replace(/_/g, ' '),
          category: `#${index + 1} Global Ranking`,
          content: <CountryShowcaseCard country={country} />
        }}
        index={index}
      />
    );
  };

  // Prepare carousel cards with flag backgrounds
  const carouselCards = useMemo(() => {
    return topCountries.map((country, idx) => (
      <CountryCarouselCard key={country.id} country={country} index={idx} />
    ));
  }, [topCountries]);

  // Showcase atomic components
  const showcaseComponents = useMemo(() => {
    return [
      ATOMIC_COMPONENTS[ComponentType.DEMOCRATIC_PROCESS],
      ATOMIC_COMPONENTS[ComponentType.FEDERAL_SYSTEM],
      ATOMIC_COMPONENTS[ComponentType.INDEPENDENT_JUDICIARY]
    ].filter(Boolean);
  }, []);

  // Type guard for globalStats
  const isValidGlobalStats = (stats: unknown): stats is { totalCountries: number; totalGdp: number; totalPopulation: number; globalGrowthRate: number } => {
    return typeof stats === 'object' && stats !== null && 'totalCountries' in stats;
  };

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user) {
      router.push(createUrl('/dashboard'));
    }
  }, [user, router]);

  // Show loading state while checking auth
  if (user) {
    return (
      <div className="relative min-h-screen bg-background flex items-center justify-center">
        <InteractiveGridPattern
          width={40}
          height={40}
          squares={[50, 40]}
          className="fixed inset-0 opacity-30 dark:opacity-20 z-0"
          squaresClassName="fill-slate-200/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30"
        />
        <div className="text-center relative z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4" />
          <p className="text-muted-foreground">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Interactive Grid Background - IxStats Design Language */}
      <InteractiveGridPattern
        width={40}
        height={40}
        squares={[50, 40]}
        className="fixed inset-0 opacity-30 dark:opacity-20 z-0"
        squaresClassName="fill-slate-200/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30 [&:nth-child(4n+1):hover]:fill-yellow-600/40 [&:nth-child(4n+1):hover]:stroke-yellow-600/60 [&:nth-child(4n+2):hover]:fill-blue-600/40 [&:nth-child(4n+2):hover]:stroke-blue-600/60 [&:nth-child(4n+3):hover]:fill-indigo-600/40 [&:nth-child(4n+3):hover]:stroke-indigo-600/60 [&:nth-child(4n+4):hover]:fill-red-600/40 [&:nth-child(4n+4):hover]:stroke-red-600/60 transition-all duration-200"
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Hero Section - MyCountry Gold Theme */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-6xl mx-auto mb-20 mt-16"
        >
          {/* Dynamic Island-inspired status badge */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center gap-3 mb-8 glass-hierarchy-parent px-6 py-3 rounded-full border border-yellow-500/30"
          >
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium text-foreground">{isValidGlobalStats(globalStats) ? globalStats.totalCountries : 0} Nations Active</span>
            <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs px-2 py-0.5">
              v1.1 Preview
            </Badge>
            
          </motion.div>

          {/* IxStats Logo */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="relative w-20 h-20 md:w-24 md:h-24">
              {/* Outer ring - represents global/world */}
              <div className="absolute inset-0 rounded-full border-4 border-yellow-500/30"></div>
              {/* Inner elements - stats/analytics symbols */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-full h-full">
                  {/* Rising bar chart representation */}
                  <TrendingUp className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 text-yellow-500" strokeWidth={2.5} />
                  {/* Crown symbol overlay for nation/leadership */}
                  <Crown className="absolute top-0 right-0 w-5 h-5 md:w-6 md:h-6 text-orange-500" strokeWidth={2} />
                  {/* Globe symbol for international */}
                  <Globe className="absolute bottom-0 left-0 w-5 h-5 md:w-6 md:h-6 text-yellow-600" strokeWidth={2} />
                </div>
              </div>
              {/* Animated pulse effect */}
              <div className="absolute inset-0 rounded-full border-4 border-yellow-500 animate-ping opacity-20"></div>
            </div>
            <h1 className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-600 bg-clip-text text-transparent">
              IxStats™
            </h1>
          </div>

          <p className="text-2xl md:text-3xl text-muted-foreground mb-4 max-w-4xl mx-auto font-light">
          The Complete Nation Management Platform
          </p>

          <p className="text-lg text-muted-foreground/80 mb-10 max-w-3xl mx-auto">
            Create your nation. Tell your story through multiple characters. Build your government piece by piece. Participate in a living, breathing world.
          </p>

          {/* Live Global Stats - Dynamic Island Colors */}
          {isValidGlobalStats(globalStats) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-10"
            >
              <div className="glass-hierarchy-child p-4 rounded-xl border border-blue-500/20">
                <div className="text-3xl font-bold text-blue-500">{globalStats.totalCountries}</div>
                <div className="text-sm text-muted-foreground">Active Nations</div>
              </div>
              <div className="glass-hierarchy-child p-4 rounded-xl border border-green-500/20">
                <div className="text-3xl font-bold text-green-500">{formatCurrency(globalStats.totalGdp)}</div>
                <div className="text-sm text-muted-foreground">World GDP</div>
              </div>
              <div className="glass-hierarchy-child p-4 rounded-xl border border-purple-500/20">
                <div className="text-3xl font-bold text-purple-500">{formatPopulation(globalStats.totalPopulation)}</div>
                <div className="text-sm text-muted-foreground">Total Population</div>
              </div>
              <div className="glass-hierarchy-child p-4 rounded-xl border border-yellow-500/20">
                <div className="text-3xl font-bold text-yellow-500">{(globalStats.globalGrowthRate * 100).toFixed(3)}%</div>
                <div className="text-sm text-muted-foreground">Global Growth</div>
              </div>
            </motion.div>
          )}

          <div className="flex items-center justify-center gap-4 flex-wrap">
         
            <Link href="/countries">
              <Button size="lg" variant="outline" className="px-10 py-6 text-lg border-yellow-500/30 hover:border-yellow-500/50 hover:bg-yellow-500/10">
                Explore Countries
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Top Nations Carousel - Apple Cards Style */}
        {carouselCards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mb-20"
          >
            <div className="text-center mb-10">
              <h2 className="text-4xl font-bold text-foreground mb-3">Global Leaders</h2>
              <p className="text-muted-foreground">Explore the world's most powerful nations with live data</p>
            </div>
            <Carousel items={carouselCards} />
          </motion.div>
        )}

        {/* MyCountry Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="max-w-7xl mx-auto mb-32"
        >
          <div className="glass-hierarchy-parent p-12 rounded-3xl border border-yellow-500/30 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-yellow-500/10 to-transparent pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-xl shadow-yellow-500/30">
                  <Crown className="h-10 w-10 text-white" />
                </div>
                <div>
                  <h2 className="text-5xl font-bold bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-600 bg-clip-text text-transparent">
                    MyCountry©
                  </h2>
                  <p className="text-xl text-muted-foreground">Your Nation Management Hub</p>
                </div>
              </div>

              <p className="text-lg text-muted-foreground mb-8 max-w-3xl">
                Everything you need to build, manage, and grow your nation. Track your economy, monitor your nation&apos;s health, and make informed decisions with comprehensive dashboards and tools.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="glass-hierarchy-child p-6 rounded-xl border border-yellow-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">Country Builder</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">7-step guided setup from national identity to economic indicators. Import from IIWiki or build from scratch with 100+ customizable data points.</p>
                </div>

                <div className="glass-hierarchy-child p-6 rounded-xl border border-blue-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <Crown className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">Executive Dashboard</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">8 specialized tabs covering economy, labor, demographics, and government. Critical alerts, policy management, cabinet meetings, and activity scheduling all in one place.</p>
                </div>

                <div className="glass-hierarchy-child p-6 rounded-xl border border-purple-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">Defense System</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">Build and manage your military with 8 branch types (Army, Navy, Air Force, Cyber Command, etc.). Organize units, track assets, monitor readiness, and assess security threats.</p>
                </div>

                <div className="glass-hierarchy-child p-6 rounded-xl border border-green-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                      <Brain className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">Intelligence & Insights</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">Real-time alerts, trend analysis, risk assessment, and forward-looking predictions. Vitality scoring across 5 dimensions helps you understand your nation&apos;s health at a glance.</p>
                </div>
              </div>

            
            </div>
          </div>
        </motion.div>

        {/* ThinkPages Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="max-w-7xl mx-auto mb-32"
        >
          <div className="glass-hierarchy-parent p-12 rounded-3xl border border-blue-500/30 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-blue-500/10 to-transparent pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-xl shadow-blue-500/30">
                  <MessageSquare className="h-10 w-10 text-white" />
                </div>
                <div>
                  <h2 className="text-5xl font-bold bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 bg-clip-text text-transparent">
                    ThinkPages
                  </h2>
                  <p className="text-xl text-muted-foreground">25 Voices, One Nation
                  </p>
                </div>
              </div>

              <p className="text-lg text-muted-foreground mb-8 max-w-3xl">
                Tell your nation&apos;s story through the voices of your people. Create government officials debating policy, journalists breaking stories, citizens reacting to events. Build a rich, living society with up to 25 characters that make your worldbuilding come alive.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="glass-hierarchy-child p-6 rounded-xl border border-blue-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">Create Your Society</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">Design unique characters - from prime ministers to street activists. Give each one personality, political views, and a distinct voice. Watch your national story unfold through their interactions.</p>
                </div>

                <div className="glass-hierarchy-child p-6 rounded-xl border border-cyan-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-400 flex items-center justify-center">
                      <MessageSquare className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">Share & Collaborate</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">Post updates on the social feed, message other nations privately, or join collaborative think tanks. Connect with other players to build shared storylines and regional politics.</p>
                </div>

                <div className="glass-hierarchy-child p-6 rounded-xl border border-indigo-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">Canon Worldbuilding</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">ThinkPages is <a href="https://ixwiki.com/wiki/ThinkPages" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">part of the IxWiki universe</a>. Your posts contribute to a shared, persistent world with deep lore and interconnected stories.</p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-blue-300">Roleplay with Depth:</strong> Create opposition parties that challenge your government. Write news articles covering your elections. Have citizens protest controversial policies. Your worldbuilding becomes interactive storytelling.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Atomic Design System Showcase */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.0 }}
          className="max-w-7xl mx-auto mb-32"
        >
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground mb-3">Build Your Government, Your Way</h2>
            <p className="text-muted-foreground max-w-3xl mx-auto">
              No preset government types. Choose from 106+ individual components across government structure, economic policy, and administrative systems. Mix and match to create exactly the nation you imagine - components interact naturally to create realistic outcomes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 max-w-4xl mx-auto">
            <div className="glass-hierarchy-child p-4 rounded-xl border border-purple-500/30 text-center">
              <div className="text-3xl font-bold text-purple-400 mb-1">24</div>
              <div className="text-sm text-muted-foreground">Government & Structure</div>
            </div>
            <div className="glass-hierarchy-child p-4 rounded-xl border border-green-500/30 text-center">
              <div className="text-3xl font-bold text-green-400 mb-1">40+</div>
              <div className="text-sm text-muted-foreground">Economic & Social Policy</div>
            </div>
            <div className="glass-hierarchy-child p-4 rounded-xl border border-blue-500/30 text-center">
              <div className="text-3xl font-bold text-blue-400 mb-1">42</div>
              <div className="text-sm text-muted-foreground">Administration & Systems</div>
            </div>
          </div>

          <div className="relative overflow-hidden">
            <Marquee pauseOnHover className="[--duration:50s]">
              {useMemo(() => {
                const allComponents = [
                  // Government Components (Purple)
                  { type: ComponentType.DEMOCRATIC_PROCESS, color: 'purple' },
                  { type: ComponentType.FEDERAL_SYSTEM, color: 'purple' },
                  { type: ComponentType.INDEPENDENT_JUDICIARY, color: 'purple' },
                  { type: ComponentType.RULE_OF_LAW, color: 'purple' },
                  { type: ComponentType.PROFESSIONAL_BUREAUCRACY, color: 'purple' },
                  { type: ComponentType.TECHNOCRATIC_PROCESS, color: 'purple' },
                  { type: ComponentType.ELECTORAL_LEGITIMACY, color: 'purple' },
                  { type: ComponentType.AUTOCRATIC_PROCESS, color: 'purple' },

                  // Economy Components (Green)
                  { type: ComponentType.FREE_MARKET_SYSTEM, color: 'green' },
                  { type: ComponentType.KNOWLEDGE_ECONOMY, color: 'green' },
                  { type: ComponentType.INNOVATION_ECOSYSTEM, color: 'green' },
                  { type: ComponentType.DIGITAL_GOVERNMENT, color: 'green' },
                  { type: ComponentType.RESEARCH_AND_DEVELOPMENT, color: 'green' },
                  { type: ComponentType.ENTREPRENEURSHIP_SUPPORT, color: 'green' },
                  { type: ComponentType.MIXED_ECONOMY, color: 'green' },
                  { type: ComponentType.SOCIAL_MARKET_ECONOMY, color: 'green' },

                  // Administrative Components (Blue)
                  { type: ComponentType.MERIT_BASED_SYSTEM, color: 'blue' },
                  { type: ComponentType.TRANSPARENCY_INITIATIVE, color: 'blue' },
                  { type: ComponentType.ANTI_CORRUPTION, color: 'blue' },
                  { type: ComponentType.E_GOVERNANCE, color: 'blue' },
                  { type: ComponentType.PERFORMANCE_MANAGEMENT, color: 'blue' },
                  { type: ComponentType.ACCOUNTABILITY_FRAMEWORK, color: 'blue' },
                  { type: ComponentType.STRATEGIC_PLANNING, color: 'blue' },
                  { type: ComponentType.QUALITY_ASSURANCE, color: 'blue' },

                  // Social & International (Cyan)
                  { type: ComponentType.UNIVERSAL_HEALTHCARE, color: 'cyan' },
                  { type: ComponentType.PUBLIC_EDUCATION, color: 'cyan' },
                  { type: ComponentType.MULTILATERAL_DIPLOMACY, color: 'cyan' },
                  { type: ComponentType.INTERNATIONAL_LAW, color: 'cyan' },
                  { type: ComponentType.WELFARE_STATE, color: 'cyan' },
                  { type: ComponentType.ENVIRONMENTAL_PROTECTION, color: 'cyan' },
                ];

                // Shuffle the array
                return allComponents.sort(() => Math.random() - 0.5);
              }, []).map((item, idx) => {
                const component = ATOMIC_COMPONENTS[item.type];
                if (!component) return null;

                const colorConfigs = {
                  purple: { border: 'border-purple-500/20 hover:border-purple-500/40', gradient: 'from-purple-500 to-pink-500', badge: 'bg-purple-500/20 text-purple-600 border-purple-500/30' },
                  green: { border: 'border-green-500/20 hover:border-green-500/40', gradient: 'from-green-500 to-emerald-500', badge: 'bg-green-500/20 text-green-600 border-green-500/30' },
                  blue: { border: 'border-blue-500/20 hover:border-blue-500/40', gradient: 'from-blue-500 to-cyan-500', badge: 'bg-blue-500/20 text-blue-600 border-blue-500/30' },
                  cyan: { border: 'border-cyan-500/20 hover:border-cyan-500/40', gradient: 'from-cyan-500 to-teal-500', badge: 'bg-cyan-500/20 text-cyan-600 border-cyan-500/30' },
                };
                const colorConfig = colorConfigs[item.color as keyof typeof colorConfigs] || colorConfigs.purple;

                return (
                  <Card
                    key={`${component.id}-${idx}`}
                    className={`glass-hierarchy-child border ${colorConfig.border} transition-all w-80 flex-shrink-0`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorConfig.gradient} flex items-center justify-center`}>
                          <Blocks className="h-5 w-5 text-white" />
                        </div>
                        <CardTitle className="text-base">{component.name}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-xs text-muted-foreground line-clamp-2">{component.description}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`${colorConfig.badge} text-xs`}>
                          {component.effectiveness}% effective
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {component.synergies.length} synergies
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </Marquee>

            <div className="pointer-events-none absolute inset-y-0 left-0 w-1/12 bg-gradient-to-r from-background to-transparent"></div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/12 bg-gradient-to-l from-background to-transparent"></div>
          </div>

          <div className="mt-10 max-w-4xl mx-auto space-y-4">
            <div className="glass-hierarchy-child p-6 rounded-xl border border-purple-500/20">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong className="text-purple-300">Natural Interactions:</strong> Components work together realistically - choose a Technocratic Process with Professional Bureaucracy and watch them enhance each other. Or create conflicts by mixing contradictory elements for interesting storytelling.
              </p>
            </div>
            <div className="glass-hierarchy-child p-6 rounded-xl border border-green-500/20">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong className="text-green-300">Shape Your Economy:</strong> Your choices matter. A Free Market System with Innovation support grows differently than a Planned Economy with Social Welfare. Watch your selections influence GDP, employment, and quality of life over time.
              </p>
            </div>
            <div className="glass-hierarchy-child p-6 rounded-xl border border-blue-500/20">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong className="text-blue-300">Everything Connects:</strong> Your government structure affects how efficiently you can collect taxes. Your economic model influences which social programs work best. Build a nation that makes sense for your story.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Real Economic Simulation Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="max-w-7xl mx-auto mb-32"
        >
          <div className="glass-hierarchy-parent p-12 rounded-3xl border border-green-500/30 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-green-500/10 to-transparent pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-xl shadow-green-500/30">
                  <Globe className="h-10 w-10 text-white" />
                </div>
                <div>
                  <h2 className="text-5xl font-bold bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 bg-clip-text text-transparent">
                    Dynamic World
                  </h2>
                  <p className="text-xl text-muted-foreground">Where Every Choice Matters</p>
                </div>
              </div>

              <p className="text-lg text-muted-foreground mb-8 max-w-3xl">
                Experience a living, breathing world where time moves forward, economies grow and contract, and your decisions have lasting consequences. Your nation exists alongside others on a shared timeline, creating opportunities for coordinated storytelling and authentic international relations.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="glass-hierarchy-child p-6 rounded-xl border border-green-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                      <Activity className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">Shared Timeline</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">Everyone plays on the same clock. Schedule cabinet meetings with specific dates, coordinate regional summits, and watch events unfold simultaneously across all nations for authentic geopolitical storytelling.</p>
                </div>

                <div className="glass-hierarchy-child p-6 rounded-xl border border-emerald-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">Growing Nations</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">Watch your economy grow over months and years. Track meaningful progress as your GDP increases, your population shifts, and your policies reshape your nation&apos;s trajectory in realistic ways.</p>
                </div>

                <div className="glass-hierarchy-child p-6 rounded-xl border border-teal-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                      <Network className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">Real Impact</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">Your choices matter. Trade agreements strengthen partner economies. Diplomatic missions succeed or fail based on your relationships. Your ThinkPages characters create narratives others can engage with and build upon.</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Diplomatic & Intelligence Operations Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.4 }}
          className="max-w-7xl mx-auto mb-32"
        >
          <div className="glass-hierarchy-parent p-12 rounded-3xl border border-indigo-500/30 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-indigo-500/10 to-transparent pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-xl shadow-indigo-500/30">
                  <Globe className="h-10 w-10 text-white" />
                </div>
                <div>
                  <h2 className="text-5xl font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 bg-clip-text text-transparent">
                    Diplomacy & Relations
                  </h2>
                  <p className="text-xl text-muted-foreground">Connect with the World</p>
                </div>
              </div>

              <p className="text-lg text-muted-foreground mb-8 max-w-3xl">
                Build relationships with other nations. Establish embassies, conduct diplomatic missions, exchange culture and knowledge. Navigate the complexities of international relations and forge alliances that shape your region&apos;s story.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-hierarchy-child p-6 rounded-xl border border-indigo-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">Embassies & Missions</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">Open embassies in other nations and run diplomatic missions - negotiate trade deals, organize cultural exchanges, coordinate during crises, or pursue economic cooperation projects.</p>
                </div>

                <div className="glass-hierarchy-child p-6 rounded-xl border border-purple-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <MessageSquare className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">Private Communications</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">Send secure messages to other nations&apos; leaders. Negotiate treaties, share intelligence, coordinate regional events, or simply build friendships behind the scenes.</p>
                </div>

                <div className="glass-hierarchy-child p-6 rounded-xl border border-pink-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                      <Network className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">Track Relationships</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">See your diplomatic ties at a glance. Monitor relationship strength with other nations, review your shared history, and understand the web of alliances shaping your region.</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

       

        {/* Discord CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="text-center max-w-4xl mx-auto mb-16"
        >
          <div className="glass-hierarchy-parent p-12 rounded-3xl border border-[#5865F2]/30">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-[#5865F2] via-[#7289DA] to-[#5865F2] bg-clip-text text-transparent">
              Join Our Community
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              IxStats is in active development. Join our Discord to follow updates, suggest features, and connect with the community.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <a href="https://discord.gg/mgXAEYdqkd" target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-12 py-6 text-lg shadow-xl shadow-[#5865F2]/30">
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Join our Discord
                </Button>
              </a>
            
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
