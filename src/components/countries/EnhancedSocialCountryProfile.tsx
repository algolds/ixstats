"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { Spotlight } from "~/components/ui/spotlight-new";
import { HealthRing } from "~/components/ui/health-ring";
import { TextReveal, FadeIn } from "~/components/ui/text-reveal";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { createUrl } from "~/lib/url-utils";
import { 
  RiStarLine, 
  RiEyeLine, 
  RiUserAddLine,
  RiChat3Line,
  RiShakeHandsLine,
  RiTrophyLine,
  RiShieldLine,
  RiGlobalLine,
  RiFireLine,
  RiArrowRightLine,
  RiHistoryLine,
  RiSettings4Line,
  RiTeamLine,
  RiAwardLine
} from "react-icons/ri";

import type { EnhancedCountryProfileData, SocialActionType } from "~/types/social-profile";

interface EnhancedSocialCountryProfileProps {
  country: EnhancedCountryProfileData;
  viewerCountryId?: string; // If viewing as another country leader
  onSocialAction?: (action: SocialActionType, targetId: string) => void;
}

const EnhancedSocialCountryProfileComponent: React.FC<EnhancedSocialCountryProfileProps> = ({
  country,
  viewerCountryId,
  onSocialAction
}) => {
  const [profileState, setProfileState] = useState<'basic' | 'hover' | 'expanded'>('basic');
  const [activeTab, setActiveTab] = useState<'overview' | 'achievements' | 'diplomacy' | 'activity'>('overview');
  const [showSocialPalette, setShowSocialPalette] = useState(false);

  // Calculate enhanced metrics with memoization for performance
  const economicScore = useMemo(() => 
    Math.min(100, (country.currentGdpPerCapita / 65000) * 100), 
    [country.currentGdpPerCapita]
  );
  
  const developmentScore = useMemo(() => {
    const tierScores: Record<string, number> = {
      "Extravagant": 100,
      "Very Strong": 85,
      "Strong": 70,
      "Healthy": 55,
      "Developed": 40,
      "Developing": 25
    };
    return tierScores[country.economicTier] || 10;
  }, [country.economicTier]);
  
  const socialInfluenceScore = useMemo(() => 
    Math.min(100, (country.socialMetrics.followers / 50) + (country.socialMetrics.diplomaticRelationships * 5)),
    [country.socialMetrics.followers, country.socialMetrics.diplomaticRelationships]
  );

  const handleSocialAction = useCallback((action: SocialActionType) => {
    onSocialAction?.(action, country.id);
  }, [onSocialAction, country.id]);

  return (
    <motion.div
      className="relative cursor-pointer"
      onMouseEnter={() => setProfileState('hover')}
      onMouseLeave={() => profileState !== 'expanded' && setProfileState('basic')}
      onClick={() => setProfileState(profileState === 'expanded' ? 'basic' : 'expanded')}
    >
      <div
        className={cn(
          "relative glass-hierarchy-parent glass-refraction overflow-hidden transition-all duration-500 ease-out",
          profileState === 'expanded' ? "min-h-[800px]" : "h-96",
          profileState === 'hover' && "shadow-xl"
        )}
      >
        {/* Dynamic Background */}
        <div className="absolute inset-0">
          {country.unsplashImageUrl ? (
            <img
              src={country.unsplashImageUrl}
              alt={`${country.name} landscape`}
              className="w-full h-full object-cover"
            />
          ) : country.flagUrl ? (
            <img
              src={country.flagUrl}
              alt={`${country.name} flag`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-500/20 to-purple-500/20" />
          )}
          
          {/* Achievement Celebration Overlay */}
          <AnimatePresence>
            {country.achievementConstellation?.recentMilestones?.some(a => a.celebrationState === 'new') && (
              <Spotlight
                gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(45, 100%, 75%, .15) 0, hsla(45, 100%, 55%, .05) 50%, hsla(45, 100%, 45%, 0) 80%)"
                gradientSecond="radial-gradient(50% 50% at 50% 50%, hsla(60, 100%, 85%, .10) 0, hsla(60, 100%, 65%, .04) 80%, transparent 100%)"
                gradientThird="radial-gradient(50% 50% at 50% 50%, hsla(30, 100%, 85%, .08) 0, hsla(30, 100%, 55%, .03) 80%, transparent 100%)"
                translateY={-100}
                width={400}
                height={300}
                duration={8}
              />
            )}
          </AnimatePresence>

          {/* Diplomatic Status Indicators */}
          <div className="absolute top-4 right-4 flex gap-2">
            {country.diplomaticRelations?.slice(0, 3).map((relation, index) => (
              <motion.div
                key={relation.id}
                initial={{ scale: 0, rotate: 180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: index * 0.1, type: "spring", stiffness: 300 }}
                className={cn(
                  "w-8 h-8 rounded-full glass-hierarchy-interactive flex items-center justify-center text-xs",
                  relation.relationType === 'alliance' && "bg-green-500/30 text-green-200",
                  relation.relationType === 'trade' && "bg-blue-500/30 text-blue-200", 
                  relation.relationType === 'neutral' && "bg-gray-500/30 text-gray-200",
                  relation.relationType === 'tension' && "bg-red-500/30 text-red-200"
                )}
                title={`${relation.relationType} with ${relation.countryName}`}
              >
                {relation.relationType === 'alliance' && <RiShakeHandsLine />}
                {relation.relationType === 'trade' && <RiGlobalLine />}
                {relation.relationType === 'neutral' && <RiEyeLine />}
                {relation.relationType === 'tension' && <RiShieldLine />}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Content Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
          
          {/* Basic State - Always Visible Country Name */}
          <AnimatePresence>
            {profileState === 'basic' && (
              <motion.div 
                className="absolute bottom-6 left-6 right-6"
                initial={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-end justify-between">
                  <div>
                    <motion.h1 
                      className="text-3xl md:text-4xl font-bold text-white [text-shadow:0_0_20px_rgba(0,0,0,0.8)]"
                    >
                      {country.name}
                    </motion.h1>
                    <p className="text-white/80 text-lg mt-2 [text-shadow:0_0_15px_rgba(0,0,0,0.8)]">
                      {country.economicTier} • {formatPopulation(country.currentPopulation)}
                    </p>
                  </div>

                  {/* Growth Streak Indicator */}
                  {country.growthStreak > 0 && (
                    <motion.div 
                      className="flex items-center gap-2 glass-hierarchy-child px-3 py-2 rounded-lg"
                      whileHover={{ scale: 1.05 }}
                    >
                      <RiFireLine className="text-orange-400" />
                      <span className="text-white font-medium text-sm">
                        {country.growthStreak}Q Streak
                      </span>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hover State - Social Metrics Preview */}
          <AnimatePresence>
            {profileState === 'hover' && (
              <motion.div
                className="absolute inset-0 flex flex-col justify-end p-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="space-y-4">
                  {/* Enhanced Header */}
                  <div>
                    <motion.h1 
                      className="text-3xl md:text-4xl font-bold text-white [text-shadow:0_0_20px_rgba(0,0,0,0.8)]"
                      animate={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 400 }}
                    >
                      {country.name}
                    </motion.h1>
                    
                    <FadeIn direction="up" delay={0.1} className="flex items-center gap-3 text-white/90 mt-2">
                      <RiGlobalLine className="h-5 w-5" />
                      <span className="text-lg font-medium [text-shadow:0_0_15px_rgba(0,0,0,0.8)]">
                        {country.economicTier}
                      </span>
                      <span>•</span>
                      <span className="[text-shadow:0_0_15px_rgba(0,0,0,0.8)]">
                        {formatPopulation(country.currentPopulation)}
                      </span>
                      {country.globalRanking && (
                        <>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <RiTrophyLine className="h-4 w-4 text-yellow-400" />
                            <span className="text-yellow-400 font-medium [text-shadow:0_0_15px_rgba(0,0,0,0.8)]">
                              #{country.globalRanking}
                            </span>
                          </div>
                        </>
                      )}
                    </FadeIn>
                  </div>

                  {/* Social Metrics Grid */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="grid grid-cols-4 gap-4 p-4 glass-hierarchy-child rounded-lg"
                  >
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400 [text-shadow:0_0_15px_rgba(0,0,0,0.8)]">
                        {country.socialMetrics.followers}
                      </div>
                      <div className="text-xs text-white/70 [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                        Followers
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-400 [text-shadow:0_0_15px_rgba(0,0,0,0.8)]">
                        {country.socialMetrics.recentVisitors}
                      </div>
                      <div className="text-xs text-white/70 [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                        Recent Visits
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400 [text-shadow:0_0_15px_rgba(0,0,0,0.8)]">
                        {country.socialMetrics.diplomaticRelationships}
                      </div>
                      <div className="text-xs text-white/70 [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                        Diplomatic
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-400 [text-shadow:0_0_15px_rgba(0,0,0,0.8)]">
                        {country.achievementConstellation?.recentMilestones?.length || 0}
                      </div>
                      <div className="text-xs text-white/70 [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                        Recent
                      </div>
                    </div>
                  </motion.div>

                  {/* Quick Action Buttons */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                    className="flex gap-3"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSocialAction('follow');
                      }}
                      className="flex-1 flex items-center justify-center gap-2 glass-hierarchy-interactive bg-blue-500/20 hover:bg-blue-500/30 text-white px-4 py-3 rounded-lg font-medium [text-shadow:0_0_10px_rgba(0,0,0,0.8)]"
                    >
                      <RiUserAddLine className="h-4 w-4" />
                      Follow
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSocialAction('message');
                      }}
                      className="flex items-center justify-center gap-2 glass-hierarchy-interactive bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-lg [text-shadow:0_0_10px_rgba(0,0,0,0.8)]"
                    >
                      <RiChat3Line className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSocialPalette(true);
                      }}
                      className="flex items-center justify-center gap-2 glass-hierarchy-interactive bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-lg [text-shadow:0_0_10px_rgba(0,0,0,0.8)]"
                    >
                      <RiSettings4Line className="h-4 w-4" />
                    </button>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Expanded State - Full Intelligence Dashboard */}
          <AnimatePresence>
            {profileState === 'expanded' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="absolute inset-0 flex flex-col"
              >
                {/* Enhanced Header */}
                <div className="p-6 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <TextReveal className="text-4xl font-bold text-white [text-shadow:0_0_20px_rgba(0,0,0,0.8)]">
                        {country.name}
                      </TextReveal>
                      <div className="flex items-center gap-4 mt-2 text-white/90 [text-shadow:0_0_15px_rgba(0,0,0,0.8)]">
                        <div className="flex items-center gap-2">
                          <RiGlobalLine className="h-5 w-5" />
                          <span className="text-lg">{country.economicTier}</span>
                        </div>
                        <span>•</span>
                        <span>{formatPopulation(country.currentPopulation)}</span>
                        <span>•</span>
                        <span>{formatCurrency(country.currentGdpPerCapita)}</span>
                      </div>
                    </div>

                    {/* Health Rings Overview */}
                    <div className="flex gap-4">
                      <div className="text-center">
                        <HealthRing
                          value={economicScore}
                          size={60}
                          color="rgba(34, 197, 94, 0.8)"
                          label=""
                        />
                        <div className="text-white/80 text-xs mt-1 font-medium [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                          Economic
                        </div>
                      </div>
                      <div className="text-center">
                        <HealthRing
                          value={developmentScore}
                          size={60}
                          color="rgba(168, 85, 247, 0.8)"
                          label=""
                        />
                        <div className="text-white/80 text-xs mt-1 font-medium [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                          Development
                        </div>
                      </div>
                      <div className="text-center">
                        <HealthRing
                          value={socialInfluenceScore}
                          size={60}
                          color="rgba(59, 130, 246, 0.8)"
                          label=""
                        />
                        <div className="text-white/80 text-xs mt-1 font-medium [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                          Influence
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="px-6 pb-4">
                  <div className="flex gap-1 glass-hierarchy-child rounded-lg p-1">
                    {[
                      { id: 'overview', label: 'Overview', icon: RiEyeLine },
                      { id: 'achievements', label: 'Achievements', icon: RiTrophyLine },
                      { id: 'diplomacy', label: 'Diplomacy', icon: RiShakeHandsLine },
                      { id: 'activity', label: 'Activity', icon: RiHistoryLine }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab(tab.id as any);
                        }}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all",
                          activeTab === tab.id 
                            ? "bg-white/20 text-white [text-shadow:0_0_10px_rgba(0,0,0,0.8)]" 
                            : "text-white/70 hover:text-white hover:bg-white/10 [text-shadow:0_0_10px_rgba(0,0,0,0.8)]"
                        )}
                      >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 px-6 pb-6 overflow-y-auto">
                  <AnimatePresence mode="wait">
                    {activeTab === 'overview' && (
                      <motion.div
                        key="overview"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                      >
                        {/* Economic Metrics */}
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-white/95 [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                              Economic Performance
                            </h3>
                            <div className="space-y-3">
                              <div className="flex justify-between text-white/85">
                                <span className="[text-shadow:0_0_10px_rgba(0,0,0,0.8)]">Total GDP</span>
                                <span className="font-semibold [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                                  {country.currentTotalGdp >= 1e12 
                                    ? `$${(country.currentTotalGdp / 1e12).toFixed(1)}T`
                                    : country.currentTotalGdp >= 1e9
                                    ? `$${(country.currentTotalGdp / 1e9).toFixed(1)}B`
                                    : `$${(country.currentTotalGdp / 1e6).toFixed(1)}M`
                                  }
                                </span>
                              </div>
                              {country.adjustedGdpGrowth && (
                                <div className="flex justify-between text-white/85">
                                  <span className="[text-shadow:0_0_10px_rgba(0,0,0,0.8)]">Growth Rate</span>
                                  <span className="font-semibold text-emerald-400 [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                                    {(country.adjustedGdpGrowth * 100).toFixed(1)}%
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between text-white/85">
                                <span className="[text-shadow:0_0_10px_rgba(0,0,0,0.8)]">Population Tier</span>
                                <span className="font-semibold [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                                  {country.populationTier}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-white/95 [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                              Social Standing
                            </h3>
                            <div className="space-y-3">
                              <div className="flex justify-between text-white/85">
                                <span className="[text-shadow:0_0_10px_rgba(0,0,0,0.8)]">Followers</span>
                                <span className="font-semibold text-blue-400 [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                                  {country.socialMetrics.followers}
                                </span>
                              </div>
                              <div className="flex justify-between text-white/85">
                                <span className="[text-shadow:0_0_10px_rgba(0,0,0,0.8)]">Diplomatic Relations</span>
                                <span className="font-semibold text-green-400 [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                                  {country.socialMetrics.diplomaticRelationships}
                                </span>
                              </div>
                              <div className="flex justify-between text-white/85">
                                <span className="[text-shadow:0_0_10px_rgba(0,0,0,0.8)]">Recent Achievements</span>
                                <span className="font-semibold text-yellow-400 [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                                  {country.achievementConstellation?.recentMilestones?.length || 0}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {activeTab === 'achievements' && (
                      <motion.div
                        key="achievements"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                      >
                        <h3 className="text-lg font-semibold text-white/95 [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                          Recent Achievements
                        </h3>
                        <div className="grid gap-4">
                          {country.achievementConstellation?.recentMilestones?.map((achievement, index) => (
                            <motion.div
                              key={achievement.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className={cn(
                                "p-4 glass-hierarchy-child rounded-lg",
                                achievement.celebrationState === 'new' && "ring-2 ring-yellow-400/50"
                              )}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiAwardLine className={cn(
                                      "h-5 w-5",
                                      achievement.tier === 'platinum' && "text-purple-400",
                                      achievement.tier === 'gold' && "text-yellow-400",
                                      achievement.tier === 'silver' && "text-gray-300",
                                      achievement.tier === 'bronze' && "text-orange-400"
                                    )} />
                                    <h4 className="font-semibold text-white [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                                      {achievement.title}
                                    </h4>
                                    {achievement.celebrationState === 'new' && (
                                      <span className="px-2 py-1 bg-yellow-400/20 text-yellow-300 text-xs rounded-full">
                                        New!
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-white/80 text-sm [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                                    {achievement.description}
                                  </p>
                                  <p className="text-white/60 text-xs mt-2 [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                                    Achieved {achievement.achievedAt}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <div className="flex items-center gap-1 text-pink-400">
                                    <RiStarLine className="h-4 w-4" />
                                    <span className="text-sm font-medium">{achievement.socialReactions}</span>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {activeTab === 'diplomacy' && (
                      <motion.div
                        key="diplomacy"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                      >
                        <h3 className="text-lg font-semibold text-white/95 [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                          Diplomatic Relations
                        </h3>
                        <div className="grid gap-3">
                          {country.diplomaticRelations?.map((relation, index) => (
                            <motion.div
                              key={relation.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="flex items-center justify-between p-3 glass-hierarchy-child rounded-lg hover:glass-hierarchy-interactive cursor-pointer"
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                                  relation.relationType === 'alliance' && "bg-green-500/30 text-green-200",
                                  relation.relationType === 'trade' && "bg-blue-500/30 text-blue-200", 
                                  relation.relationType === 'neutral' && "bg-gray-500/30 text-gray-200",
                                  relation.relationType === 'tension' && "bg-red-500/30 text-red-200"
                                )}>
                                  {relation.relationType === 'alliance' && <RiShakeHandsLine />}
                                  {relation.relationType === 'trade' && <RiGlobalLine />}
                                  {relation.relationType === 'neutral' && <RiEyeLine />}
                                  {relation.relationType === 'tension' && <RiShieldLine />}
                                </div>
                                <div>
                                  <div className="font-medium text-white [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                                    {relation.countryName}
                                  </div>
                                  {relation.recentActivity && (
                                    <div className="text-xs text-white/60 [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                                      {relation.recentActivity}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-white/80 text-sm font-medium [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                                  {relation.strength}%
                                </div>
                                <div className="text-xs text-white/60 capitalize [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                                  {relation.relationType}
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {activeTab === 'activity' && (
                      <motion.div
                        key="activity"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                      >
                        <h3 className="text-lg font-semibold text-white/95 [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                          Recent Activity
                        </h3>
                        <div className="space-y-3">
                          {country.recentActivities?.map((activity, index) => (
                            <motion.div
                              key={activity.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className={cn(
                                "flex items-start gap-3 p-3 glass-hierarchy-child rounded-lg",
                                activity.importance === 'high' && "ring-1 ring-yellow-400/30",
                                activity.importance === 'medium' && "ring-1 ring-blue-400/20"
                              )}
                            >
                              <div className={cn(
                                "w-2 h-2 rounded-full mt-2 flex-shrink-0",
                                activity.importance === 'high' && "bg-yellow-400",
                                activity.importance === 'medium' && "bg-blue-400",
                                activity.importance === 'low' && "bg-gray-400"
                              )} />
                              <div className="flex-1">
                                <p className="text-white/90 text-sm [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                                  {activity.description}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-white/60 text-xs [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                                    {activity.timestamp}
                                  </span>
                                  {activity.relatedCountry && (
                                    <>
                                      <span className="text-white/40">•</span>
                                      <span className="text-white/60 text-xs [text-shadow:0_0_10px_rgba(0,0,0,0.8)]">
                                        {activity.relatedCountry}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Action Bar */}
                <div className="p-6 pt-4 border-t border-white/10">
                  <div className="flex gap-3">
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = createUrl(`/countries/${country.id}`);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 glass-hierarchy-interactive bg-blue-500/20 hover:bg-blue-500/30 text-white px-6 py-3 rounded-lg font-medium [text-shadow:0_0_10px_rgba(0,0,0,0.8)]"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <RiEyeLine className="h-5 w-5" />
                      View Full Profile
                      <RiArrowRightLine className="h-4 w-4" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Social Command Palette */}
      <AnimatePresence>
        {showSocialPalette && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSocialPalette(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10001]"
            />
            
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed right-4 top-1/2 -translate-y-1/2 w-96 z-[10002] glass-modal rounded-xl p-6"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                    <RiTeamLine className="h-6 w-6 text-blue-400" />
                    Social Actions
                  </h3>
                  <button
                    onClick={() => setShowSocialPalette(false)}
                    className="text-muted-foreground hover:text-foreground hover:bg-accent/10 p-2 rounded-lg transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => handleSocialAction('follow')}
                    className="w-full flex items-center gap-3 p-3 bg-accent/10 hover:bg-accent/20 rounded-lg transition-colors text-left"
                  >
                    <RiUserAddLine className="h-5 w-5 text-blue-400" />
                    <div>
                      <div className="font-medium">Follow Country</div>
                      <div className="text-sm text-muted-foreground">Get updates on achievements and activities</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleSocialAction('message')}
                    className="w-full flex items-center gap-3 p-3 bg-accent/10 hover:bg-accent/20 rounded-lg transition-colors text-left"
                  >
                    <RiChat3Line className="h-5 w-5 text-purple-400" />
                    <div>
                      <div className="font-medium">Send Message</div>
                      <div className="text-sm text-muted-foreground">Diplomatic correspondence</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleSocialAction('propose')}
                    className="w-full flex items-center gap-3 p-3 bg-accent/10 hover:bg-accent/20 rounded-lg transition-colors text-left"
                  >
                    <RiShakeHandsLine className="h-5 w-5 text-green-400" />
                    <div>
                      <div className="font-medium">Propose Alliance</div>
                      <div className="text-sm text-muted-foreground">Formal diplomatic proposal</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleSocialAction('congratulate')}
                    className="w-full flex items-center gap-3 p-3 bg-accent/10 hover:bg-accent/20 rounded-lg transition-colors text-left"
                  >
                    <RiTrophyLine className="h-5 w-5 text-yellow-400" />
                    <div>
                      <div className="font-medium">Congratulate</div>
                      <div className="text-sm text-muted-foreground">Recognize recent achievements</div>
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

EnhancedSocialCountryProfileComponent.displayName = 'EnhancedSocialCountryProfile';

export const EnhancedSocialCountryProfile = React.memo(EnhancedSocialCountryProfileComponent);