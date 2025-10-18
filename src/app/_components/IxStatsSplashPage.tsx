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
  const ixstatsUrl = `/countries/${country.id}`;

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
              v1.0.9 Beta
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
            Build your country, manage economics, conduct diplomacy, and lead your nation through sophisticated simulation systems
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
                  <p className="text-xl text-muted-foreground">Your Country Command Center</p>
                </div>
              </div>

              <p className="text-lg text-muted-foreground mb-8 max-w-3xl">
                Complete nation management platform with real-time modeling, intelligence dashboards, and strategic command systems. Build your nation from the ground up, with real-time data and calculations.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="glass-hierarchy-child p-6 rounded-xl border border-yellow-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                      <Crown className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">Dashboard</h3>
                  </div>
                  <p className="text-muted-foreground">Real-time overview with economic stats, intelligence feeds, and quick actions</p>
                </div>

                <div className="glass-hierarchy-child p-6 rounded-xl border border-orange-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">MyCountry Builder</h3>
                  </div>
                  <p className="text-muted-foreground">Guided setup wizard with government configuration and economic initialization</p>
                </div>

                <div className="glass-hierarchy-child p-6 rounded-xl border border-cyan-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                      <Globe className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">IIWiki Importer</h3>
                  </div>
                  <p className="text-muted-foreground">Import your country data from IIWiki with automatic calculations</p>
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
                  <p className="text-xl text-muted-foreground">Where Minds Meet</p>
                </div>
              </div>

              <p className="text-lg text-muted-foreground mb-8 max-w-3xl">
                ThinkPages empowers billions to connect, collaborate, and create through the open exchange of thought. Create up to 25 in-character accounts per nation - from government officials and journalists to activists and everyday citizens - and roleplay your nation&apos;s social discourse.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="glass-hierarchy-child p-6 rounded-xl border border-blue-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">25 IC Accounts</h3>
                  </div>
                  <p className="text-muted-foreground">5 government officials, 10 media personalities, 17 citizens - each with unique personalities and posting styles</p>
                </div>

                <div className="glass-hierarchy-child p-6 rounded-xl border border-cyan-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-400 flex items-center justify-center">
                      <MessageSquare className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">ThinkShare</h3>
                  </div>
                  <p className="text-muted-foreground">Secure private messaging platform - perfect for diplomatic communications and back-channel negotiations</p>
                </div>

                <div className="glass-hierarchy-child p-6 rounded-xl border border-indigo-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                      <MessageCircle className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">ThinkTanks</h3>
                  </div>
                  <p className="text-muted-foreground">Group discussion spaces for collaborative lore and worldbuilding - public or private invitation-only</p>
                </div>
              </div>

              <div className="mt-6 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-blue-400">Note:</strong> ThinkPages is an{" "}
                  <a
                    href="https://ixwiki.com/wiki/ThinkPages"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
                  >
                    established in-world platform
                  </a>
                  {" "}in our worldbuilding universe. IxStats integrates it canonically for roleplay purposes and is treated as "in-character".
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
            <h2 className="text-4xl font-bold text-foreground mb-3">Atomic Design Philosophy</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Build complex systems from simple, reusable components. Mix and match 24+ atomic government components, tax system modules, and institutional building blocks.
            </p>
          </div>

          <div className="relative overflow-hidden">
            <Marquee pauseOnHover className="[--duration:40s]">
              {[
                ComponentType.DEMOCRATIC_PROCESS,
                ComponentType.FEDERAL_SYSTEM,
                ComponentType.TECHNOCRATIC_PROCESS,
                ComponentType.ELECTORAL_LEGITIMACY,
                ComponentType.INDEPENDENT_JUDICIARY,
                ComponentType.RULE_OF_LAW,
                ComponentType.AUTOCRATIC_PROCESS,
                ComponentType.CENTRALIZED_POWER,
                ComponentType.PROFESSIONAL_BUREAUCRACY,
                ComponentType.SURVEILLANCE_SYSTEM,
                ComponentType.CONSENSUS_PROCESS,
                ComponentType.TRADITIONAL_LEGITIMACY,
              ].map((componentType) => {
                const component = ATOMIC_COMPONENTS[componentType];
                if (!component) return null;
                return (
                  <Card
                    key={component.id}
                    className="glass-hierarchy-child border border-purple-500/20 hover:border-purple-500/40 transition-all w-80 flex-shrink-0"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <Blocks className="h-5 w-5 text-white" />
                        </div>
                        <CardTitle className="text-base">{component.name}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-xs text-muted-foreground line-clamp-2">{component.description}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-purple-500/20 text-purple-600 border-purple-500/30 text-xs">
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

              
        </motion.div>

        {/* Platform Capabilities */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.0 }}
          className="max-w-6xl mx-auto mb-20"
        > 
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
              Connect with us on Discord to follow the development of IxStats
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
