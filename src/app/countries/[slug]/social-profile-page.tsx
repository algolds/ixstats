"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "~/trpc/react";
import { EnhancedSocialCountryProfile } from "~/components/countries/EnhancedSocialCountryProfile";
import { DynamicCountryHeader } from "~/components/countries/DynamicCountryHeader";
import { PublicVitalityRings } from "~/components/countries/PublicVitalityRings";
import { CountryProfileInfoBox } from "~/components/countries/CountryProfileInfoBox";
import { Spotlight } from "~/components/ui/spotlight-new";
import { ProgressiveBlur } from "~/components/magicui/progressive-blur";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { unsplashService, type UnsplashImageData } from "~/lib/unsplash-service";
import type {
  EnhancedCountryProfileData,
  SocialActionType,
  NationalMilestone,
  DiplomaticRelation,
  SocialActivity,
  SocialMetrics,
  AchievementConstellation,
} from "~/types/social-profile";
import { adaptCountryForSocialProfile } from "~/lib/transformers/interface-adapters";
import {
  RiStarLine,
  RiTrophyLine,
  RiGlobalLine,
  RiFireLine,
  RiArrowLeftLine,
  RiShareLine,
  RiBookmarkLine,
  RiEyeLine,
  RiUserAddLine,
  RiShakeHandsLine,
  RiChat3Line,
} from "react-icons/ri";
import { createUrl } from "~/lib/url-utils";

interface SocialCountryProfilePageProps {
  params: {
    id: string;
  };
}

export default function SocialCountryProfilePage({ params }: SocialCountryProfilePageProps) {
  const countryId = params.id;
  const [viewMode, setViewMode] = useState<"social" | "traditional">("social");
  const [currentUserCountryId, setCurrentUserCountryId] = useState<string | undefined>();
  const [isFollowing, setIsFollowing] = useState(false);
  const [socialActionLoading, setSocialActionLoading] = useState<SocialActionType | null>(null);

  // Fetch country data
  const {
    data: country,
    isLoading,
    error,
  } = api.countries.getByIdWithEconomicData.useQuery({ id: countryId });

  // Get flag data
  const { flagUrl } = useFlag(country?.name);

  // Get dynamic background image
  const [unsplashImage, setUnsplashImage] = useState<UnsplashImageData | undefined>();

  useEffect(() => {
    if (country?.economicTier && country?.populationTier && country?.name) {
      unsplashService
        .getCountryHeaderImage(
          country.economicTier,
          country.populationTier,
          country.name,
          country.continent || undefined
        )
        .then(setUnsplashImage)
        .catch(() => setUnsplashImage(undefined));
    }
  }, [country?.economicTier, country?.populationTier, country?.name, country?.continent]);

  // Mock social data generation (in real app, this would come from the API)
  const enhancedCountryData: EnhancedCountryProfileData | null = useMemo(() => {
    if (!country) return null;

    // Generate realistic social metrics based on country tier and GDP
    const followerBase = Math.floor((country.currentGdpPerCapita / 10000) * 12);
    const visitorBase = Math.floor((country.currentTotalGdp / 1e9) * 3);

    const socialMetrics: SocialMetrics = {
      followers: Math.max(5, followerBase + Math.floor(Math.random() * 15)),
      recentVisitors: Math.max(2, visitorBase + Math.floor(Math.random() * 8)),
      diplomaticRelationships: Math.floor(Math.random() * 12) + 3,
      achievementPoints: Math.floor(Math.random() * 850) + 150,
      influenceScore: Math.min(100, followerBase * 2 + Math.floor(Math.random() * 20)),
      engagementRate: Math.random() * 0.15 + 0.05, // 5-20% engagement rate
    };

    // Generate achievements based on economic performance
    const recentAchievements: NationalMilestone[] = [];

    if (country.economicTier === "Extravagant" || country.economicTier === "Very Strong") {
      recentAchievements.push({
        id: `achievement-${country.id}-1`,
        title: "Elite Economic Status",
        description: `Achieved ${country.economicTier} economic tier with exceptional performance`,
        category: "economic",
        tier: country.economicTier === "Extravagant" ? "platinum" : "gold",
        achievedAt: "IxTime 2030.4",
        ixTimeEpoch: 2030.4,
        celebrationState: "acknowledged",
        socialReactions: [],
        rarity: country.economicTier === "Extravagant" ? 95 : 78,
        icon: "trophy",
      });
    }

    if (country.adjustedGdpGrowth && country.adjustedGdpGrowth > 0.03) {
      recentAchievements.push({
        id: `achievement-${country.id}-2`,
        title: "Growth Excellence",
        description: `Maintained strong economic growth of ${(country.adjustedGdpGrowth * 100).toFixed(1)}%`,
        category: "economic",
        tier: "gold",
        achievedAt: "IxTime 2030.3",
        ixTimeEpoch: 2030.3,
        celebrationState: "new",
        socialReactions: [],
        rarity: 65,
        icon: "trending-up",
      });
    }

    // Generate diplomatic relations
    const sampleCountries = ["Lysandria", "Valorheim", "Crystalia", "Shadowmere", "Goldshore"];
    const diplomaticRelations: DiplomaticRelation[] = sampleCountries
      .filter(() => Math.random() > 0.4) // Not all countries have relations
      .map((countryName, index) => ({
        id: `diplomatic-${country.id}-${index}`,
        countryId: `country-${index}`,
        countryName,
        flagUrl: undefined,
        relationType: ["alliance", "trade", "neutral", "defense_pact"][
          Math.floor(Math.random() * 4)
        ] as any,
        relationshipStrength: Math.floor(Math.random() * 40) + 60,
        establishedDate: `IxTime ${2028 + Math.random() * 2}`,
        lastInteraction: `IxTime ${2030 + Math.random() * 0.5}`,
        recentActivity: [
          {
            id: `activity-${index}`,
            type: "trade_agreement",
            title: "Trade Agreement Renewed",
            description: `Extended trade partnership with ${countryName}`,
            timestamp: `IxTime ${2030 + Math.random() * 0.3}`,
            impact: "positive",
            participants: [country.name, countryName],
          },
        ],
        treatiesActive: [],
        tradeValue: Math.floor(Math.random() * 50e9) + 10e9,
        mutualBenefits: ["Economic cooperation", "Cultural exchange"],
      }));

    // Generate recent activities
    const recentActivities: SocialActivity[] = [
      {
        id: `activity-${country.id}-1`,
        type: "achievement_earned",
        title: "New Achievement Unlocked",
        description: `${country.name} earned the "${recentAchievements[0]?.title || "Economic Excellence"}" achievement`,
        timestamp: `IxTime 2030.4`,
        importance: "high",
        category: "achievement",
        visibilityLevel: "public",
        engagementMetrics: { views: 127, reactions: 23, shares: 8, comments: 5 },
      },
      {
        id: `activity-${country.id}-2`,
        type: "diplomatic_event",
        title: "New Trade Partnership",
        description: `Established beneficial trade agreement with ${diplomaticRelations[0]?.countryName || "allied nation"}`,
        timestamp: `IxTime 2030.35`,
        importance: "medium",
        category: "diplomacy",
        visibilityLevel: "public",
        engagementMetrics: { views: 89, reactions: 15, shares: 3, comments: 2 },
      },
      {
        id: `activity-${country.id}-3`,
        type: "growth_streak",
        title: "Economic Growth Milestone",
        description: `Maintained positive economic growth for ${Math.floor(Math.random() * 6) + 3} consecutive quarters`,
        timestamp: `IxTime 2030.3`,
        importance: "medium",
        category: "economy",
        visibilityLevel: "public",
        engagementMetrics: { views: 156, reactions: 31, shares: 12, comments: 7 },
      },
    ];

    const achievementConstellation: AchievementConstellation = {
      recentMilestones: recentAchievements,
      activeStreaks: [],
      rareAccomplishments: [],
      upcomingTargets: [],
      totalAchievementScore: socialMetrics.achievementPoints,
      achievementRanking: {
        global: Math.floor(Math.random() * 180) + 1,
        regional: Math.floor(Math.random() * 25) + 1,
        tierBased: Math.floor(Math.random() * 15) + 1,
      },
    };

    return {
      ...adaptCountryForSocialProfile(country as unknown as Record<string, unknown>),
      id: country.id,
      name: country.name,
      currentPopulation: country.currentPopulation,
      currentGdpPerCapita: country.currentGdpPerCapita,
      currentTotalGdp: country.currentTotalGdp,
      economicTier: country.economicTier,
      populationTier: country.populationTier,
      continent: country.continent || undefined,
      region: country.region || undefined,
      governmentType: country.governmentType || undefined,
      leader: country.leader || undefined,
      religion: country.religion || undefined,
      flagUrl: flagUrl || undefined,
      unsplashImageUrl: unsplashImage?.url,
      socialMetrics,
      achievementConstellation,
      diplomaticRelations,
      recentActivities,
      followers: [],
      recentVisitors: [],
      publicMessages: [],
      collaborationRequests: [],
      regionalContext: {
        regionName: "Northern Kingdoms",
        continent: "Aethermoor",
        neighboringCountries: sampleCountries.slice(0, 3),
        regionalRanking: {
          economic: Math.floor(Math.random() * 15) + 1,
          population: Math.floor(Math.random() * 20) + 1,
          influence: Math.floor(Math.random() * 12) + 1,
          development: Math.floor(Math.random() * 10) + 1,
        },
        regionalEvents: [],
        tradingBlocs: ["Northern Trade Alliance", "Aethermoor Economic Zone"],
        culturalConnections: ["Ancient Kingdoms Heritage", "Mountain Peoples Alliance"],
      },
      globalRanking: Math.floor(Math.random() * 180) + 1,
      regionalRanking: Math.floor(Math.random() * 25) + 1,
      growthStreak: Math.max(0, Math.floor(Math.random() * 8)),
      influenceLevel:
        country.currentTotalGdp > 5e12
          ? "superpower"
          : country.currentTotalGdp > 2e12
            ? "global"
            : country.currentTotalGdp > 500e9
              ? "major"
              : country.currentTotalGdp > 100e9
                ? "regional"
                : "emerging",
      lastUpdated: "IxTime 2030.41",
      profileCreated: "IxTime 2028.1",
      nextMilestoneCheck: "IxTime 2030.5",
    };
  }, [country, flagUrl, unsplashImage]);

  const handleSocialAction = async (action: SocialActionType, targetId: string) => {
    setSocialActionLoading(action);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      switch (action) {
        case "follow":
          setIsFollowing(!isFollowing);
          break;
        case "message":
          // Open message dialog
          console.log("Opening message dialog for", targetId);
          break;
        case "congratulate":
          console.log("Sending congratulations to", targetId);
          break;
        case "propose_alliance":
          console.log("Proposing alliance to", targetId);
          break;
        default:
          console.log("Social action:", action, "for", targetId);
      }
    } catch (error) {
      console.error("Social action failed:", error);
    } finally {
      setSocialActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <ProgressiveBlur>
            <div className="space-y-8">
              <div className="glass-hierarchy-parent h-96 animate-pulse rounded-xl" />
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                  <div className="glass-hierarchy-child h-64 animate-pulse rounded-xl" />
                  <div className="glass-hierarchy-child h-48 animate-pulse rounded-xl" />
                </div>
                <div className="space-y-6">
                  <div className="glass-hierarchy-child h-32 animate-pulse rounded-xl" />
                  <div className="glass-hierarchy-child h-48 animate-pulse rounded-xl" />
                </div>
              </div>
            </div>
          </ProgressiveBlur>
        </div>
      </div>
    );
  }

  if (error || !enhancedCountryData) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="glass-hierarchy-child rounded-xl p-8 text-center">
          <h1 className="text-destructive mb-4 text-2xl font-bold">Country Not Found</h1>
          <p className="text-muted-foreground mb-6">
            {error?.message || "The requested country profile could not be loaded."}
          </p>
          <button
            onClick={() => window.history.back()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground mx-auto flex items-center gap-2 rounded-lg px-6 py-3 font-medium transition-colors"
          >
            <RiArrowLeftLine className="h-4 w-4" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background relative min-h-screen">
      {/* Background Enhancement */}
      <div className="pointer-events-none absolute inset-0">
        <Spotlight
          gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(220, 100%, 85%, .08) 0, hsla(220, 100%, 65%, .02) 50%, hsla(220, 100%, 55%, 0) 80%)"
          gradientSecond="radial-gradient(50% 50% at 50% 50%, hsla(240, 100%, 85%, .06) 0, hsla(240, 100%, 65%, .02) 80%, transparent 100%)"
          gradientThird="radial-gradient(50% 50% at 50% 50%, hsla(200, 100%, 85%, .04) 0, hsla(200, 100%, 55%, .01) 80%, transparent 100%)"
          translateY={-300}
          width={600}
          height={800}
          duration={15}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header Controls */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() => window.history.back()}
            className="glass-hierarchy-interactive hover:bg-accent/10 flex items-center gap-2 rounded-lg px-4 py-2 transition-colors"
          >
            <RiArrowLeftLine className="h-4 w-4" />
            <span className="font-medium">Back</span>
          </button>

          <div className="flex items-center gap-4">
            {/* Mode Toggle */}
            <div className="glass-hierarchy-child flex items-center gap-1 rounded-lg p-1">
              <button
                onClick={() => setViewMode("social")}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  viewMode === "social"
                    ? "text-foreground bg-white/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                }`}
              >
                Social Profile
              </button>
              <button
                onClick={() => setViewMode("traditional")}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  viewMode === "traditional"
                    ? "text-foreground bg-white/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                }`}
              >
                Traditional View
              </button>
            </div>

            {/* Profile Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSocialAction("follow", countryId)}
                disabled={socialActionLoading === "follow"}
                className={`glass-hierarchy-interactive flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-all ${
                  isFollowing
                    ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                    : "hover:bg-accent/10"
                }`}
              >
                <RiUserAddLine className="h-4 w-4" />
                {socialActionLoading === "follow"
                  ? "Loading..."
                  : isFollowing
                    ? "Following"
                    : "Follow"}
              </button>

              <button className="glass-hierarchy-interactive hover:bg-accent/10 flex items-center gap-2 rounded-lg px-4 py-2 transition-colors">
                <RiShareLine className="h-4 w-4" />
                Share
              </button>

              <button className="glass-hierarchy-interactive hover:bg-accent/10 flex items-center gap-2 rounded-lg px-4 py-2 transition-colors">
                <RiBookmarkLine className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Content Based on View Mode */}
        <AnimatePresence mode="wait">
          {viewMode === "social" ? (
            <motion.div
              key="social-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <EnhancedSocialCountryProfile
                country={enhancedCountryData}
                viewerCountryId={currentUserCountryId}
                onSocialAction={handleSocialAction}
              />
            </motion.div>
          ) : (
            <motion.div
              key="traditional-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 gap-8 lg:grid-cols-3"
            >
              {/* Main Content */}
              <div className="space-y-8 lg:col-span-2">
                {/* Dynamic Header */}
                <DynamicCountryHeader country={enhancedCountryData} />

                {/* Vitality Rings */}
                <PublicVitalityRings country={enhancedCountryData} />
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <CountryProfileInfoBox country={enhancedCountryData} />

                {/* Social Summary */}
                <div className="glass-hierarchy-child rounded-xl p-6">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                    <RiGlobalLine className="h-5 w-5 text-blue-400" />
                    Social Influence
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Followers</span>
                      <span className="font-semibold text-blue-400">
                        {enhancedCountryData.socialMetrics.followers}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Diplomatic Relations</span>
                      <span className="font-semibold text-green-400">
                        {enhancedCountryData.socialMetrics.diplomaticRelationships}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Recent Achievements</span>
                      <span className="font-semibold text-yellow-400">
                        {enhancedCountryData.achievementConstellation.recentMilestones.length}
                      </span>
                    </div>
                    {enhancedCountryData.growthStreak > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1 text-sm">
                          <RiFireLine className="h-3 w-3 text-orange-400" />
                          Growth Streak
                        </span>
                        <span className="font-semibold text-orange-400">
                          {enhancedCountryData.growthStreak}Q
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Stats Bar */}
        <div className="glass-hierarchy-interactive fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-6 rounded-full px-6 py-3 shadow-lg">
          <div className="flex items-center gap-2 text-sm">
            <RiEyeLine className="h-4 w-4 text-blue-400" />
            <span className="font-medium">
              {enhancedCountryData.socialMetrics.recentVisitors} recent visits
            </span>
          </div>
          <div className="bg-border h-4 w-px" />
          <div className="flex items-center gap-2 text-sm">
            <RiTrophyLine className="h-4 w-4 text-yellow-400" />
            <span className="font-medium">Rank #{enhancedCountryData.globalRanking}</span>
          </div>
          <div className="bg-border h-4 w-px" />
          <div className="flex items-center gap-2 text-sm">
            <RiStarLine className="h-4 w-4 text-purple-400" />
            <span className="font-medium">
              {enhancedCountryData.socialMetrics.influenceScore} influence
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
