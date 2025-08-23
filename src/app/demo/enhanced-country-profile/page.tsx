"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EnhancedSocialCountryProfile } from "~/components/countries/EnhancedSocialCountryProfile";
import { Spotlight } from "~/components/ui/spotlight-new";
import { TextReveal, FadeIn } from "~/components/ui/text-reveal";
import { SocialProfileTransformer } from "~/lib/social-profile-transformer";
import { api } from "~/trpc/react";
import { useBulkFlags } from "~/hooks/useUnifiedFlags";
import { unsplashService } from "~/lib/unsplash-service";
import type { EnhancedCountryProfileData, SocialActionType } from "~/types/social-profile";
import { 
  RiStarLine, 
  RiTrophyLine,
  RiEyeLine,
  RiUserAddLine,
  RiGlobalLine,
  RiFireLine,
  RiSparklingLine,
  RiMagicLine,
  RiRocket2Line,
  RiShieldLine,
  RiCommandLine,
  RiArrowRightLine,
  RiRefreshLine
} from "react-icons/ri";

// Live country data for real countries - using name matching instead of ID
const liveCountryNames = ["Caphiria", "Urcea", "Cartadania"];

/**
 * DEMO PAGE: Enhanced Country Profile System
 * 
 * This demo showcases the enhanced country profile features that are now 
 * integrated into the production country profile pages at /countries/[id].
 * 
 * Users can toggle between traditional and enhanced views on any country page.
 */
export default function EnhancedCountryProfileDemo() {
  const [selectedCountryIndex, setSelectedCountryIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserCountryId] = useState("demo-user-country");
  const [socialActions, setSocialActions] = useState<{ [key: string]: boolean }>({});
  const [unsplashImages, setUnsplashImages] = useState<Record<string, string>>({});

  // Fetch all countries data
  const { data: countriesResult, isLoading: countriesLoading } = api.countries.getAll.useQuery({
    limit: 50
  });

  // Get the filtered demo countries - use any available countries if target countries don't exist
  const demoCountries = useMemo(() => {
    if (!countriesResult?.countries) return [];
    
    // First try to find the target countries by name
    const targetCountries = countriesResult.countries.filter(c => 
      liveCountryNames.includes(c.name)
    );
    
    // If we found some target countries, use them
    if (targetCountries.length > 0) {
      return targetCountries;
    }
    
    // Otherwise, use the first 3 countries available
    return countriesResult.countries.slice(0, 3);
  }, [countriesResult]);

  const countryNames = useMemo(() => {
    return demoCountries.map(c => c.name);
  }, [demoCountries]);

  const { flagUrls, isLoading: flagsLoading } = useBulkFlags(countryNames);

  const selectedCountry = demoCountries[selectedCountryIndex];
  
  // Load Unsplash images
  useEffect(() => {
    if (demoCountries.length > 0) {
      Promise.all(
        demoCountries.map(async (country) => {
          try {
            const imageData = await unsplashService.getCountryHeaderImage(
              country.economicTier, 
              country.populationTier,
              country.name,
              country.continent || undefined
            );
            // Track download as required by Unsplash API terms
            if (imageData.downloadUrl) {
              void unsplashService.trackDownload(imageData.downloadUrl);
            }
            return { [country.name]: imageData.url };
          } catch {
            return { [country.name]: undefined };
          }
        })
      ).then(results => {
        const imageMap = results.reduce((acc, curr) => ({ ...acc, ...curr }), {}) as Record<string, string | undefined>;
        setUnsplashImages(imageMap as Record<string, string>);
      });
    }
  }, [demoCountries]);

  // Transform the selected country data into enhanced format
  const enhancedCountryData: EnhancedCountryProfileData | null = useMemo(() => {
    if (!selectedCountry) return null;
    
    return SocialProfileTransformer.transformCountryData(
      {
        ...selectedCountry,
        landArea: selectedCountry.landArea ?? undefined,
        populationDensity: selectedCountry.populationDensity ?? undefined,
        gdpDensity: selectedCountry.gdpDensity ?? undefined,
        continent: selectedCountry.continent ?? undefined,
        region: selectedCountry.region ?? undefined,
        governmentType: selectedCountry.governmentType ?? undefined,
        religion: selectedCountry.religion ?? undefined,
        leader: selectedCountry.leader ?? undefined
      },
      flagUrls[selectedCountry.name] || undefined,
      unsplashImages[selectedCountry.name] || undefined
    );
  }, [selectedCountry, flagUrls, unsplashImages]);

  const handleCountrySwitch = async (index: number) => {
    if (index === selectedCountryIndex) return;
    
    setIsLoading(true);
    // Simulate loading time for dramatic effect
    await new Promise(resolve => setTimeout(resolve, 1200));
    setSelectedCountryIndex(index);
    setIsLoading(false);
  };

  const handleSocialAction = async (action: SocialActionType, targetId: string) => {
    console.log(`Demo: ${action} action for ${targetId}`);
    
    // Simulate social action
    setSocialActions(prev => ({
      ...prev,
      [`${action}-${targetId}`]: !prev[`${action}-${targetId}`]
    }));
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
  };

  // Show error state if countries failed to load
  if (countriesResult && demoCountries.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center glass-hierarchy-child p-8 rounded-xl">
          <h1 className="text-2xl font-bold text-destructive mb-4">
            No Countries Available
          </h1>
          <p className="text-muted-foreground mb-6">
            Unable to load country data for the demo.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors"
          >
            Reload Demo
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || countriesLoading || flagsLoading || !enhancedCountryData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full animate-spin border-t-blue-500" />
            <RiGlobalLine className="absolute inset-2 w-8 h-8 text-blue-400 animate-pulse" />
          </div>
          <TextReveal className="text-xl font-semibold mb-2">
            Loading Enhanced Profile
          </TextReveal>
          <p className="text-muted-foreground">
            Preparing social gaming experience...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 pointer-events-none">
        <Spotlight
          gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(220, 100%, 85%, .12) 0, hsla(220, 100%, 65%, .04) 50%, hsla(220, 100%, 55%, 0) 80%)"
          gradientSecond="radial-gradient(50% 50% at 50% 50%, hsla(240, 100%, 85%, .08) 0, hsla(240, 100%, 65%, .03) 80%, transparent 100%)"
          gradientThird="radial-gradient(50% 50% at 50% 50%, hsla(200, 100%, 85%, .06) 0, hsla(200, 100%, 55%, .02) 80%, transparent 100%)"
          translateY={-400}
          width={800}
          height={1000}
          duration={20}
        />
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Demo Header */}
        <div className="mb-12 text-center">
          <FadeIn direction="up" delay={0.1}>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-purple-500 to-green-400 bg-clip-text text-transparent">
              Enhanced Country Profile System
            </h1>
          </FadeIn>
          <FadeIn direction="up" delay={0.2}>
            <p className="text-xl text-muted-foreground mb-6 max-w-3xl mx-auto">
              Experience the future of diplomatic social gaming with Apple-inspired design, 
              sophisticated glassmorphism, and deep worldbuilding integration.
            </p>
          </FadeIn>
          
          {/* Feature Highlights */}
          <FadeIn direction="up" delay={0.3}>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2 glass-hierarchy-child px-4 py-2 rounded-full">
                <RiTrophyLine className="h-4 w-4 text-yellow-400" />
                <span>Achievement System</span>
              </div>
              <div className="flex items-center gap-2 glass-hierarchy-child px-4 py-2 rounded-full">
                <RiShieldLine className="h-4 w-4 text-blue-400" />
                <span>Diplomatic Relations</span>
              </div>
              <div className="flex items-center gap-2 glass-hierarchy-child px-4 py-2 rounded-full">
                <RiSparklingLine className="h-4 w-4 text-purple-400" />
                <span>Social Gaming</span>
              </div>
              <div className="flex items-center gap-2 glass-hierarchy-child px-4 py-2 rounded-full">
                <RiMagicLine className="h-4 w-4 text-green-400" />
                <span>Focus Card Design</span>
              </div>
            </div>
          </FadeIn>
        </div>

        {/* Country Selector */}
        <div className="mb-8">
          <FadeIn direction="up" delay={0.4}>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold mb-4 flex items-center justify-center gap-2">
                <RiCommandLine className="h-6 w-6 text-blue-400" />
                Choose Demo Country
              </h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {demoCountries.map((country, index) => (
              <motion.button
                key={country.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index, duration: 0.3 }}
                onClick={() => handleCountrySwitch(index)}
                className={`p-4 rounded-xl text-left transition-all duration-300 ${
                  selectedCountryIndex === index
                    ? 'glass-hierarchy-interactive bg-blue-500/20 ring-2 ring-blue-400/50'
                    : 'glass-hierarchy-child hover:glass-hierarchy-interactive'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-lg">{country.name}</h3>
                  {selectedCountryIndex === index && (
                    <RiStarLine className="h-5 w-5 text-blue-400" />
                  )}
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      country.economicTier === 'Extravagant' ? 'bg-purple-500/20 text-purple-300' :
                      country.economicTier === 'Very Strong' ? 'bg-blue-500/20 text-blue-300' :
                      country.economicTier === 'Strong' ? 'bg-green-500/20 text-green-300' :
                      country.economicTier === 'Healthy' ? 'bg-cyan-500/20 text-cyan-300' :
                      'bg-orange-500/20 text-orange-300'
                    }`}>
                      {country.economicTier}
                    </span>
                  </div>
                  <p>{(country.currentPopulation / 1e6).toFixed(1)}M people</p>
                  <p>${(country.currentGdpPerCapita / 1000).toFixed(0)}K GDP/capita</p>
                  {country.adjustedGdpGrowth && country.adjustedGdpGrowth > 0 && (
                    <div className="flex items-center gap-1">
                      <RiFireLine className="h-3 w-3 text-orange-400" />
                      <span className="text-orange-400 font-medium">
                        {(country.adjustedGdpGrowth * 100).toFixed(1)}% growth
                      </span>
                    </div>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Enhanced Profile Display */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedCountry?.id || 'default'}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            <EnhancedSocialCountryProfile
              country={enhancedCountryData}
              viewerCountryId={currentUserCountryId}
              onSocialAction={handleSocialAction}
            />
          </motion.div>
        </AnimatePresence>

        {/* Demo Features Showcase */}
        <div className="mt-16 mb-12">
          <FadeIn direction="up" delay={0.5}>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-3">
                <RiRocket2Line className="h-8 w-8 text-green-400" />
                Key Innovations
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                This enhanced profile system brings together the best of focus card design, 
                social gaming mechanics, and Apple-inspired interactions.
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Focus Card Integration */}
            <FadeIn direction="up" delay={0.6}>
              <div className="glass-hierarchy-child rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <RiEyeLine className="h-6 w-6 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold">Focus Card Design</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Progressive disclosure with hover and expanded states, bringing the sophisticated 
                  countries page interaction patterns to profile viewing.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full" />
                    <span>Flag-based dynamic backgrounds</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full" />
                    <span>Spotlight celebration effects</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full" />
                    <span>Glass physics hierarchy</span>
                  </li>
                </ul>
              </div>
            </FadeIn>

            {/* Achievement System */}
            <FadeIn direction="up" delay={0.7}>
              <div className="glass-hierarchy-child rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                    <RiTrophyLine className="h-6 w-6 text-yellow-400" />
                  </div>
                  <h3 className="text-xl font-semibold">Achievement Constellation</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Dynamic achievement system with celebration states, social reactions, 
                  and milestone tracking integrated with economic performance.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full" />
                    <span>Tier-based achievement generation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full" />
                    <span>Growth streak tracking</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full" />
                    <span>Rare accomplishment recognition</span>
                  </li>
                </ul>
              </div>
            </FadeIn>

            {/* Social Gaming */}
            <FadeIn direction="up" delay={0.8}>
              <div className="glass-hierarchy-child rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                    <RiUserAddLine className="h-6 w-6 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-semibold">Social Interaction</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Comprehensive social features including following, diplomatic messaging, 
                  alliance proposals, and achievement congratulations.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full" />
                    <span>Command palette social actions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full" />
                    <span>Diplomatic relationship visualization</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full" />
                    <span>Activity timeline with engagement</span>
                  </li>
                </ul>
              </div>
            </FadeIn>
          </div>
        </div>

        {/* Interactive Demo Controls */}
        <div className="text-center glass-hierarchy-parent rounded-2xl p-8 max-w-2xl mx-auto">
          <h3 className="text-2xl font-semibold mb-4 flex items-center justify-center gap-3">
            <RiRefreshLine className="h-6 w-6 text-green-400" />
            Try the Interactive Features
          </h3>
          <p className="text-muted-foreground mb-6">
            Click on different country cards above to see how the profile adapts to different 
            economic tiers and performance levels. Each profile is dynamically generated with 
            realistic social metrics and achievements.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            <div className="flex items-center gap-2 text-sm glass-hierarchy-child px-4 py-2 rounded-full">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span>Hover states active</span>
            </div>
            <div className="flex items-center gap-2 text-sm glass-hierarchy-child px-4 py-2 rounded-full">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              <span>Click to expand</span>
            </div>
            <div className="flex items-center gap-2 text-sm glass-hierarchy-child px-4 py-2 rounded-full">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
              <span>Social actions enabled</span>
            </div>
          </div>

          <div className="mt-6">
            <motion.a
              href="/countries"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <RiGlobalLine className="h-5 w-5" />
              Explore Real Countries
              <RiArrowRightLine className="h-4 w-4" />
            </motion.a>
          </div>
        </div>

        {/* Technical Implementation Notes */}
        <div className="mt-16 text-center">
          <FadeIn direction="up" delay={0.9}>
            <div className="glass-hierarchy-child rounded-xl p-6 max-w-4xl mx-auto">
              <h3 className="text-xl font-semibold mb-4">Implementation Highlights</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-muted-foreground">
                <div>
                  <h4 className="font-medium text-foreground mb-2">Visual Excellence</h4>
                  <ul className="space-y-1 text-left">
                    <li>• Hierarchical glass physics system</li>
                    <li>• Framer Motion spring animations</li>
                    <li>• Progressive disclosure patterns</li>
                    <li>• Focus card hover/expand states</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Gaming Mechanics</h4>
                  <ul className="space-y-1 text-left">
                    <li>• Achievement constellation system</li>
                    <li>• Diplomatic relationship tracking</li>
                    <li>• Social engagement metrics</li>
                    <li>• IxTime temporal integration</li>
                  </ul>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}